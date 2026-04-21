import express from "express";
import cors from "cors";
import axios from "axios";
import QRCode from "qrcode";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { db, firebaseDebug } from "./firebase.js";
import { buildNfePayload, emitirNfe, consultarNfe, getDanfePdfBuffer } from "./services/nfeService.js";
import { sendNotaFiscalEmail } from "./services/emailService.js";

import produtosRoutes from "./routes/produtos.js";
import uploadRoutes from "./routes/upload.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../../frontend");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const mpAccessToken = process.env.MP_ACCESS_TOKEN || "";
const mpPublicKey = process.env.MP_PUBLIC_KEY || "";
const pixProvider = String(process.env.PIX_PROVIDER || "mercadopago").trim().toLowerCase();
const pixNubankKey = String(process.env.PIX_NUBANK_KEY || "").trim();
const pixNubankBeneficiaryName = String(process.env.PIX_NUBANK_BENEFICIARY_NAME || "").trim();
const pixNubankCity = String(process.env.PIX_NUBANK_CITY || "").trim();
const publicAppUrl = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
const melhorEnvioToken = String(process.env.MELHOR_ENVIO_TOKEN || "").trim();
const melhorEnvioOriginCep = String(process.env.MELHOR_ENVIO_ORIGIN_CEP || "").trim();
const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const cookieName = "zuca_admin_session";
const cookieTtlMs = 1000 * 60 * 60 * 12;
const sessions = new Map();

const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.length === 0) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origem nao permitida"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

if (db) {
  console.log("[FIREBASE] Admin SDK inicializado");
} else {
  console.warn("[FIREBASE] Chave nao encontrada, endpoints de dados indisponiveis");
}

function requireDb(req, res, next) {
  if (!db) {
    return res.status(503).json({ success: false, error: "Firebase nao configurado no backend" });
  }
  return next();
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, part) => {
    const [key, ...value] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(value.join("="));
    return acc;
  }, {});
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, data] of sessions.entries()) {
    if (data.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? "None" : "Lax";
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${Math.floor(cookieTtlMs / 1000)}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

function adminAuth(req, res, next) {
  cleanupExpiredSessions();
  const cookies = parseCookies(req);
  const token = cookies[cookieName];

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: "Nao autenticado" });
  }

  const session = sessions.get(token);
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    clearSessionCookie(res);
    return res.status(401).json({ success: false, error: "Sessao expirada" });
  }

  req.adminSession = session;
  return next();
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  const sanitized = String(value || "0")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return Number(sanitized) || 0;
}

function parseDecimal(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function splitFullName(fullName) {
  const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "Cliente", lastName: "" };
  }

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function buildMercadoPagoPayer(cliente = {}) {
  const email = String(cliente.email || "").trim().toLowerCase();
  const { firstName, lastName } = splitFullName(cliente.nome);
  const phoneDigits = digitsOnly(cliente.telefone);
  const cpfDigits = digitsOnly(cliente.cpf || cliente.cpfCnpj);

  const payer = {
    email: email || "cliente@email.com",
    first_name: firstName,
    last_name: lastName,
  };

  // Envia telefone apenas quando tiver formato minimamente valido (DDD + numero)
  if (phoneDigits.length >= 10) {
    payer.phone = {
      area_code: phoneDigits.slice(0, 2),
      number: phoneDigits.slice(2),
    };
  }

  // Para PIX no Brasil, documento valido evita rejeicoes do pagador
  if (cpfDigits.length === 11) {
    payer.identification = {
      type: "CPF",
      number: cpfDigits,
    };
  } else if (cpfDigits.length === 14) {
    payer.identification = {
      type: "CNPJ",
      number: cpfDigits,
    };
  }

  return payer;
}

function buildMercadoPagoHeaders(token, withIdempotency = false) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (withIdempotency) {
    headers["X-Idempotency-Key"] = crypto.randomUUID();
  }

  return headers;
}

function isProdutoPersonalizado(produto = {}) {
  const valor = produto?.personalizado;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor === 1;
  if (typeof valor === "string") {
    const v = valor.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "personalizado"].includes(v)) return true;
    if (["false", "0", "nao", "não", "no"].includes(v)) return false;
  }
  return false;
}

function inferAppBaseUrl(req) {
  if (publicAppUrl) return publicAppUrl;
  const origin = String(req?.headers?.origin || "").trim().replace(/\/$/, "");
  if (origin) return origin;
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "https");
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").trim();
  if (!forwardedHost) return "";
  return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
}

async function buscarPagamentoMercadoPagoPorReferencia(referencia) {
  const ref = String(referencia || "").trim();
  if (!ref || !mpAccessToken) return null;

  const response = await axios.get("https://api.mercadopago.com/v1/payments/search", {
    params: {
      external_reference: ref,
      sort: "date_created",
      criteria: "desc",
      limit: 1,
    },
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
    },
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  return results[0] || null;
}

async function calcularFreteFallback({ cepDestino, itens }) {
  const destino = digitsOnly(cepDestino).slice(0, 8);
  if (destino.length !== 8) {
    throw new Error("CEP invalido para calculo de frete");
  }

  const quantidade = Array.isArray(itens)
    ? itens.reduce((acc, item) => acc + Math.max(1, Number(item.quantidade || 1)), 0)
    : 1;

  const distancia = Math.abs(Number(destino[0]) - Number((melhorEnvioOriginCep || "79000000")[0] || 7));
  const valor = Math.max(12, 14 + distancia * 2 + quantidade * 1.5);
  const prazo = Math.max(3, 4 + distancia);

  return {
    provider: "fallback",
    options: [
      {
        service: "Entrega padrao",
        price: Number(valor.toFixed(2)),
        delivery_time: prazo,
      },
    ],
  };
}

async function calcularFreteMelhorEnvio({ cepDestino, itens }) {
  if (!melhorEnvioToken || !melhorEnvioOriginCep) {
    return calcularFreteFallback({ cepDestino, itens });
  }

  const cepOrigem = digitsOnly(melhorEnvioOriginCep).slice(0, 8);
  const cepDestinoNormalizado = digitsOnly(cepDestino).slice(0, 8);

  if (cepOrigem.length !== 8 || cepDestinoNormalizado.length !== 8) {
    return calcularFreteFallback({ cepDestino, itens });
  }

  const itensNormalizados = Array.isArray(itens) && itens.length
    ? itens
    : [{ nome: "Pedido", quantidade: 1, preco: 0, larguraCm: 15, comprimentoCm: 20, alturaCm: 2, pesoKg: 0.3 }];

  const baseMaiorArea = itensNormalizados.reduce((maior, item) => {
    const largura = Math.max(1, parseDecimal(item.larguraCm ?? item.largura, 15));
    const comprimento = Math.max(1, parseDecimal(item.comprimentoCm ?? item.comprimento, 20));
    const area = largura * comprimento;
    if (!maior || area > maior.area) {
      return { area, largura, comprimento };
    }
    return maior;
  }, null);

  const alturaTotal = itensNormalizados.reduce((acc, item) => {
    const altura = Math.max(0.1, parseDecimal(item.alturaCm ?? item.altura, 2));
    const quantidade = Math.max(1, Number(item.quantidade || 1));
    return acc + (altura * quantidade);
  }, 0);

  const pesoTotal = itensNormalizados.reduce((acc, item) => {
    const peso = Math.max(0.01, parseDecimal(item.pesoKg ?? item.peso, 0.3));
    const quantidade = Math.max(1, Number(item.quantidade || 1));
    return acc + (peso * quantidade);
  }, 0);

  const seguroTotal = itensNormalizados.reduce((acc, item) => {
    const valor = parseMoney(item.preco);
    const quantidade = Math.max(1, Number(item.quantidade || 1));
    return acc + (valor * quantidade);
  }, 0);

  const produtos = [{
    id: "pacote-final",
    name: "Pedido consolidado",
    width: Number(Math.max(1, baseMaiorArea?.largura || 15).toFixed(2)),
    height: Number(Math.max(0.1, alturaTotal || 2).toFixed(2)),
    length: Number(Math.max(1, baseMaiorArea?.comprimento || 20).toFixed(2)),
    weight: Number(Math.max(0.01, pesoTotal || 0.3).toFixed(3)),
    insurance_value: Number(Math.max(0, seguroTotal).toFixed(2)),
    quantity: 1,
  }];

  const PRAZO_EXTRA = 3;

  try {
    const response = await axios.post(
      "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
      {
        from: { postal_code: cepOrigem },
        to: { postal_code: cepDestinoNormalizado },
        products: produtos,
        options: {
          receipt: false,
          own_hand: false,
          collect: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${melhorEnvioToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "ZucaPersonalizados (contato@zuca.com)",
        },
      }
    );

    const lista = Array.isArray(response.data) ? response.data : [];
    const validas = lista
      .filter((item) => !item.error && Number(item.price || 0) > 0)
      .map((item) => ({
        service: String(item.name || "Entrega"),
        company: String(item.company?.name || "Melhor Envio"),
        price: Number(item.price || 0),
        delivery_time: Number(item.delivery_time || 0) + PRAZO_EXTRA,
        originalPrice: Number(item.price || 0),
      }));

    if (!validas.length) {
      return calcularFreteFallback({ cepDestino, itens });
    }

    const opcoesSelecionadas = selecionarOpcoesFrete(validas);

    return {
      provider: "melhorenvio",
      options: opcoesSelecionadas,
    };
  } catch {
    return calcularFreteFallback({ cepDestino, itens });
  }
}

function selecionarOpcoesFrete(opcoes) {
  const isCorreios = (o) => /correios/i.test(o.company);

  const correios = opcoes.filter(isCorreios);
  const melhorEnvio = opcoes.filter((o) => !isCorreios(o));

  const menorPreco = (arr) => arr.length ? arr.reduce((a, b) => a.price < b.price ? a : b) : null;
  const menorPrazo = (arr) => arr.length ? arr.reduce((a, b) => a.delivery_time < b.delivery_time ? a : b) : null;

  const correiosBarato = menorPreco(correios);
  const correiosRapido = menorPrazo(correios);
  const meBarato = menorPreco(melhorEnvio);
  const meRapido = menorPrazo(melhorEnvio);

  const candidatos = [
    { item: correiosRapido, id: "correios-rapido", tipo: "Mais rápido", grupo: "Correios" },
    { item: correiosBarato, id: "correios-barato", tipo: "Mais barato", grupo: "Correios" },
    { item: meBarato, id: "me-barato", tipo: "Mais barato", grupo: "Melhor Envio" },
    { item: meRapido, id: "me-rapido", tipo: "Mais rápido", grupo: "Melhor Envio" },
  ].filter((c) => !!c.item);

  const usados = new Set();
  const resultadoBase = [];

  candidatos.forEach(({ item, id, tipo, grupo }) => {
    const chave = `${item.service}|${item.company}|${Number(item.price || 0).toFixed(2)}|${Number(item.delivery_time || 0)}`;
    if (usados.has(chave)) return;
    usados.add(chave);

    resultadoBase.push({
      ...item,
      id,
      label: `${item.company || grupo || "Transportadora"}`,
      escolha: tipo,
      grupo,
    });
  });

  const base = resultadoBase.length ? resultadoBase : [...opcoes].slice(0, 4).map((o, i) => ({
    ...o,
    id: `opcao-${i}`,
    label: `${o.company} • ${o.service}`,
    escolha: "",
    grupo: o.company || "Transportadora",
  }));

  const resultado = base.map((o) => {
    const freteGratis = o.price <= 20;
    return {
      id: o.id,
      label: o.label,
      service: o.service,
      company: o.company,
      escolha: o.escolha || "",
      grupo: o.grupo || o.company,
      price: freteGratis ? 0 : o.price,
      originalPrice: o.originalPrice,
      delivery_time: o.delivery_time,
      freteGratis,
    };
  });

  return resultado;
}

function removeAccents(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePixName(value = "") {
  const sanitized = removeAccents(value).replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  return sanitized.slice(0, 25) || "ZUCA PERSONALIZADOS";
}

function normalizePixCity(value = "") {
  const sanitized = removeAccents(value).replace(/[^A-Za-z ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  return sanitized.slice(0, 15) || "CAMPO GRANDE";
}

function emvField(id, value) {
  const content = String(value || "");
  return `${id}${String(content.length).padStart(2, "0")}${content}`;
}

function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function isNubankPixConfigured() {
  return !!pixNubankKey && !!pixNubankBeneficiaryName && !!pixNubankCity;
}

function isMercadoPagoPixConfigured() {
  return !!mpAccessToken;
}

function isPixAvailable() {
  if (pixProvider === "nubank") {
    return isNubankPixConfigured() || isMercadoPagoPixConfigured();
  }
  return isMercadoPagoPixConfigured() || isNubankPixConfigured();
}

function buildNubankPixPayload({ valor, descricao, pedidoId }) {
  const amount = Number(valor || 0);
  if (!(amount > 0)) {
    throw new Error("Valor invalido para PIX");
  }

  const txidRaw = String(pedidoId || crypto.randomUUID().replace(/-/g, "")).replace(/[^A-Za-z0-9]/g, "");
  const txid = (txidRaw.slice(0, 25) || "PEDIDOZUCA").toUpperCase();

  const merchantAccountInfo = (() => {
    const gui = emvField("00", "br.gov.bcb.pix");
    const key = emvField("01", pixNubankKey);
    const description = descricao ? emvField("02", String(descricao).slice(0, 72)) : "";
    return emvField("26", `${gui}${key}${description}`);
  })();

  const payloadSemCrc = [
    emvField("00", "01"),
    emvField("01", "12"),
    merchantAccountInfo,
    emvField("52", "0000"),
    emvField("53", "986"),
    emvField("54", amount.toFixed(2)),
    emvField("58", "BR"),
    emvField("59", normalizePixName(pixNubankBeneficiaryName)),
    emvField("60", normalizePixCity(pixNubankCity)),
    emvField("62", emvField("05", txid)),
    "6304",
  ].join("");

  const crc = crc16(payloadSemCrc);
  return `${payloadSemCrc}${crc}`;
}

async function createMercadoPagoPixCharge({ valor, descricao, cliente, pedidoId }) {
  const payer = buildMercadoPagoPayer(cliente);

  const response = await axios.post(
    "https://api.mercadopago.com/v1/payments",
    {
      transaction_amount: Number(valor),
      description: descricao || "Compra Zuca Personalizados",
      payment_method_id: "pix",
      payer,
      external_reference: pedidoId ? String(pedidoId) : undefined,
    },
    {
      headers: buildMercadoPagoHeaders(mpAccessToken, true),
    }
  );

  const payment = response.data || {};
  const poi = payment.point_of_interaction || {};
  const txData = poi.transaction_data || {};
  const subTypeData = poi.sub_type_data || {};

  const qrCodeText =
    subTypeData.qr_code ||
    txData.qr_code ||
    payment.qr_code ||
    "";

  const qrCodeImage =
    txData.qr_code_base64 ||
    subTypeData.qr_code_base64 ||
    (qrCodeText ? await QRCode.toDataURL(qrCodeText) : "");

  if (!qrCodeText || !qrCodeImage) {
    throw new Error(payment.status_detail || "PIX indisponivel para este pagamento");
  }

  return {
    provider: "mercadopago",
    qrCode: qrCodeImage,
    copiaECola: qrCodeText,
    mercadoPagoId: payment.id,
    statusMercadoPago: payment.status,
    expiraEm:
      subTypeData.expiration_date ||
      txData.expiration_date ||
      payment.date_of_expiration ||
      Math.floor(Date.now() / 1000) + 1800,
  };
}

async function createPixCharge({ valor, descricao, cliente, pedidoId }) {
  if (isNubankPixConfigured() && pixProvider === "nubank") {
    const copiaECola = buildNubankPixPayload({
      valor,
      descricao,
      pedidoId,
    });
    const qrCode = await QRCode.toDataURL(copiaECola);

    return {
      provider: "nubank",
      qrCode,
      copiaECola,
      mercadoPagoId: null,
      statusMercadoPago: null,
      expiraEm: null,
    };
  }

  if (!isMercadoPagoPixConfigured()) {
    if (isNubankPixConfigured()) {
      const copiaECola = buildNubankPixPayload({ valor, descricao, pedidoId });
      const qrCode = await QRCode.toDataURL(copiaECola);
      return {
        provider: "nubank",
        qrCode,
        copiaECola,
        mercadoPagoId: null,
        statusMercadoPago: null,
        expiraEm: null,
      };
    }
    throw new Error("PIX indisponivel no momento");
  }

  return createMercadoPagoPixCharge({ valor, descricao, cliente, pedidoId });
}

async function createCheckoutProPreference({ pedidoId, pedidoData, appBaseUrl }) {
  if (!mpAccessToken) {
    throw new Error("Credenciais do Mercado Pago nao configuradas");
  }

  const itens = Array.isArray(pedidoData?.itens) ? pedidoData.itens : [];
  if (!itens.length) {
    throw new Error("Pedido sem itens para pagamento");
  }

  const externalReference = String(pedidoId || "");
  const retornoBase = String(appBaseUrl || "").replace(/\/$/, "");
  const backUrls = retornoBase
    ? {
        success: `${retornoBase}/checkout?pedido=${encodeURIComponent(externalReference)}&retorno=success`,
        pending: `${retornoBase}/checkout?pedido=${encodeURIComponent(externalReference)}&retorno=pending`,
        failure: `${retornoBase}/checkout?pedido=${encodeURIComponent(externalReference)}&retorno=failure`,
      }
    : undefined;

  const payload = {
    external_reference: externalReference,
    statement_descriptor: "ZUCA",
    auto_return: "approved",
    back_urls: backUrls,
    notification_url: retornoBase ? `${retornoBase}/webhook/mercadopago` : undefined,
    payer: {
      email: String(pedidoData?.cliente?.email || "cliente@email.com"),
      name: String(pedidoData?.cliente?.nome || "Cliente"),
    },
    items: itens.map((item) => ({
      id: String(item.id || ""),
      title: String(item.nome || "Produto"),
      quantity: Number(item.quantidade || 1),
      currency_id: "BRL",
      unit_price: Number(item.preco || 0),
      picture_url: String(item.imagem || ""),
    })),
  };

  // Calculate installments: min R$50/installment, max 12, only above R$100
  const totalPedido = itens.reduce((acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 1), 0);
  if (totalPedido >= 100) {
    const maxParcelas = Math.min(12, Math.floor(totalPedido / 50));
    payload.payment_methods = {
      installments: maxParcelas,
      default_installments: 1,
    };
  }

  const response = await axios.post(
    "https://api.mercadopago.com/checkout/preferences",
    payload,
    { headers: buildMercadoPagoHeaders(mpAccessToken, true) }
  );

  const pref = response.data || {};
  return {
    preferenceId: pref.id || null,
    initPoint: pref.init_point || null,
    sandboxInitPoint: pref.sandbox_init_point || null,
  };
}

function normalizePedido(docSnap) {
  const data = docSnap.data() || {};

  // Normaliza timestamps do objeto notaFiscal (Firestore Timestamp → ISO string)
  let notaFiscal = data.notaFiscal || null;
  if (notaFiscal) {
    notaFiscal = {
      ...notaFiscal,
      emitidaEm: notaFiscal.emitidaEm?.toDate ? notaFiscal.emitidaEm.toDate().toISOString() : notaFiscal.emitidaEm || null,
      emailEnviadoEm: notaFiscal.emailEnviadoEm?.toDate ? notaFiscal.emailEnviadoEm.toDate().toISOString() : notaFiscal.emailEnviadoEm || null,
    };
  }

  return {
    id: docSnap.id,
    ...data,
    notaFiscal,
    criadoEmISO: data.criadoEm?.toDate ? data.criadoEm.toDate().toISOString() : data.criadoEm || null,
    atualizadoEmISO: data.atualizadoEm?.toDate ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm || null,
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "zuca-backend-only",
    firebase: !!db,
    firebaseDebug,
    timestamp: new Date().toISOString(),
  });
});

app.get("/config-mercadopago", (req, res) => {
  res.json({
    publicKey: mpPublicKey || null,
    configured: !!mpPublicKey && !!mpAccessToken,
    pixConfigured: isPixAvailable(),
    cardConfigured: !!mpAccessToken && !!mpPublicKey,
    pixProvider: isNubankPixConfigured() && pixProvider === "nubank" ? "nubank" : "mercadopago",
    pixNubankConfigured: isNubankPixConfigured(),
  });
});

app.use("/produtos", requireDb, produtosRoutes);
app.use("/upload", requireDb, uploadRoutes);

if (fs.existsSync(frontendDir)) {
  app.get("/admin", (req, res) => {
    res.sendFile(path.join(frontendDir, "admin.html"));
  });

  app.get("/checkout", (req, res) => {
    res.sendFile(path.join(frontendDir, "checkout.html"));
  });

  app.get("/produto", (req, res) => {
    res.sendFile(path.join(frontendDir, "produto.html"));
  });

  app.get("/minha-conta", (req, res) => {
    res.sendFile(path.join(frontendDir, "minha-conta.html"));
  });
}

app.get("/api/produtos", requireDb, async (req, res) => {
  try {
    const snapshot = await db.collection("produtos").get();
    const produtos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, produtos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/produtos/:id", requireDb, async (req, res) => {
  try {
    const snap = await db.collection("produtos").doc(req.params.id).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: "Produto nao encontrado" });
    }
    return res.json({ success: true, produto: { id: snap.id, ...snap.data() } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/cupons/aplicar", requireDb, async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim().toUpperCase();
    const subtotal = parseMoney(req.body.subtotal || 0);

    if (!codigo) {
      return res.status(400).json({ success: false, error: "Cupom obrigatorio" });
    }

    const cupomSnap = await db.collection("cupons").doc(codigo).get();
    if (!cupomSnap.exists) {
      return res.status(404).json({ success: false, valido: false, error: "Cupom invalido" });
    }

    const cupom = cupomSnap.data() || {};
    const valorCupom = Number(cupom.valor || 0);
    const desconto = cupom.tipo === "percentual" ? subtotal * (valorCupom / 100) : valorCupom;

    return res.json({
      success: true,
      valido: true,
      cupom: { codigo, ...cupom },
      desconto: Math.max(0, desconto),
      totalComDesconto: Math.max(0, subtotal - desconto),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/pedidos", requireDb, async (req, res) => {
  try {
    const { cliente, itens, pagamento, cupom, observacoes, frete } = req.body;
    const metodoPagamento = String(pagamento || "pix").toLowerCase();

    if (!cliente?.nome || !cliente?.email || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ success: false, error: "Dados obrigatorios ausentes" });
    }

    if (metodoPagamento === "pix" && !isPixAvailable()) {
      return res.status(503).json({
        success: false,
        error: "PIX indisponivel no momento",
        hint: "Configure MP_ACCESS_TOKEN ou PIX_NUBANK_* no Render",
      });
    }

    if (metodoPagamento === "cartao" && (!mpAccessToken || !mpPublicKey)) {
      return res.status(503).json({
        success: false,
        error: "Cartao indisponivel no momento",
        hint: "MP_ACCESS_TOKEN/MP_PUBLIC_KEY nao configurados",
      });
    }

    const extrairUrlAnexo = (item = {}) => {
      const candidatas = [
        item.arquivoPersonalizacaoUrl,
        item.arquivoUrl,
        item.anexoUrl,
        item.urlArquivo,
        item.uploadUrl,
        item.personalizacaoUrl,
        item?.arquivo?.url,
        item?.anexo?.url,
        item?.upload?.url,
      ];

      return candidatas
        .map((v) => String(v || "").trim())
        .find((v) => v && (/^https?:\/\//i.test(v) || v.startsWith("/upload") || v.includes("storage.googleapis.com"))) || "";
    };

    const extrairNomeAnexo = (item = {}, url = "") => {
      const candidatas = [
        item.arquivoPersonalizacaoNome,
        item.arquivoNome,
        item.anexoNome,
        item.nomeArquivo,
        item.personalizacaoNome,
        item?.arquivo?.nome,
        item?.anexo?.nome,
        item?.upload?.nome,
      ];

      const nome = candidatas.map((v) => String(v || "").trim()).find(Boolean);
      if (nome) return nome;
      if (!url) return "";

      const semQuery = String(url).split("?")[0];
      const partes = semQuery.split("/").filter(Boolean);
      return partes[partes.length - 1] || "arquivo";
    };

    const itensNormalizados = itens.map((item) => {
      const arquivoPersonalizacaoUrl = extrairUrlAnexo(item);
      return {
        id: String(item.id || ""),
        nome: String(item.nome || "Produto"),
        preco: parseMoney(item.preco),
        quantidade: Number(item.quantidade || 1),
        imagem: String(item.imagem || ""),
        personalizado: !!item.personalizado,
        arquivoPersonalizacaoUrl,
        arquivoPersonalizacaoNome: extrairNomeAnexo(item, arquivoPersonalizacaoUrl),
      };
    });

    const invalidos = [];
    for (const item of itensNormalizados) {
      const produtoSnap = await db.collection("produtos").doc(item.id).get();
      if (!produtoSnap.exists) {
        invalidos.push({ id: item.id, nome: item.nome, motivo: "Produto nao encontrado" });
        continue;
      }

      const produtoData = produtoSnap.data() || {};
      if (isProdutoPersonalizado(produtoData) && !item.arquivoPersonalizacaoUrl) {
        invalidos.push({
          id: item.id,
          nome: item.nome,
          motivo: "Produto personalizado sem arquivo anexado",
        });
        continue;
      }

      const estoque = Number(produtoSnap.data().estoque || 0);
      if (estoque < item.quantidade) {
        invalidos.push({
          id: item.id,
          nome: item.nome,
          motivo: `Estoque insuficiente (${estoque} disponivel)`
        });
      }
    }

    if (invalidos.length > 0) {
      return res.status(409).json({ success: false, error: "Itens invalidos para o pedido", itensInvalidos: invalidos });
    }

    const subtotal = itensNormalizados.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
    let desconto = 0;

    if (cupom) {
      const cupomSnap = await db.collection("cupons").doc(String(cupom).toUpperCase()).get();
      if (cupomSnap.exists) {
        const dataCupom = cupomSnap.data() || {};
        const valorCupom = Number(dataCupom.valor || 0);
        desconto = dataCupom.tipo === "percentual" ? subtotal * (valorCupom / 100) : valorCupom;
      }
    }

    const freteValor = Math.max(0, Number(frete?.valor || 0));
    const total = Math.max(0, subtotal - desconto + freteValor);
    const pedidoRef = await db.collection("pedidos").add({
      cliente: {
        nome: String(cliente.nome || ""),
        email: String(cliente.email || "").toLowerCase(),
        telefone: String(cliente.telefone || ""),
        cpfCnpj: String(cliente.cpfCnpj || ""),
        cep: String(cliente.cep || ""),
        endereco: String(cliente.endereco || ""),
        numero: String(cliente.numero || ""),
        bairro: String(cliente.bairro || ""),
        cidade: String(cliente.cidade || ""),
        estado: String(cliente.estado || ""),
      },
      itens: itensNormalizados,
      subtotal,
      desconto,
      frete: {
        valor: freteValor,
        servico: String(frete?.servico || "").trim(),
        prazoDias: Number(frete?.prazoDias || 0) || null,
      },
      total,
      pagamento: metodoPagamento,
      cupom: cupom ? String(cupom).toUpperCase() : null,
      observacoes: String(observacoes || ""),
      status: "pendente",
      statusPedido: "pendente",
      estoqueDebitado: false,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      pedidoId: pedidoRef.id,
      subtotal,
      desconto,
      frete: freteValor,
      total,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/pedidos", requireDb, async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: "Email obrigatorio" });
    }

    const snap = await db.collection("pedidos").where("cliente.email", "==", email).get();
    const pedidos = snap.docs.map(normalizePedido).sort((a, b) => {
      return String(b.criadoEmISO || "").localeCompare(String(a.criadoEmISO || ""));
    });

    return res.json({ success: true, pedidos });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "").trim();

  if (!adminEmail || !adminPassword) {
    return res.status(500).json({ success: false, error: "ADMIN_EMAIL/ADMIN_PASSWORD nao configurados" });
  }

  if (email !== adminEmail || senha !== adminPassword) {
    return res.status(401).json({ success: false, error: "Credenciais invalidas" });
  }

  cleanupExpiredSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + cookieTtlMs,
  });

  setSessionCookie(res, token);
  return res.json({ success: true, user: { email } });
});

app.post("/api/admin/logout", (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[cookieName];
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  return res.json({ success: true });
});

app.get("/api/admin/me", adminAuth, (req, res) => {
  return res.json({ success: true, user: { email: req.adminSession.email } });
});

app.get("/api/admin/anexos/download", adminAuth, async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "").trim();
    const rawNome = String(req.query.nome || "").trim();

    if (!rawUrl) {
      return res.status(400).json({ success: false, error: "URL do anexo nao informada" });
    }

    const urlObj = new URL(rawUrl);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return res.status(400).json({ success: false, error: "Protocolo de URL invalido" });
    }

    const host = String(urlObj.hostname || "").toLowerCase();
    const hostPermitido = host === "storage.googleapis.com" || host === "firebasestorage.googleapis.com";
    if (!hostPermitido) {
      return res.status(400).json({ success: false, error: "Host nao permitido para download" });
    }

    const upstream = await fetch(urlObj.toString());
    if (!upstream.ok) {
      return res.status(upstream.status || 502).json({ success: false, error: "Falha ao obter anexo" });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const nomeArquivo = String(rawNome || path.basename(urlObj.pathname) || "anexo")
      .replace(/[\r\n]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim() || "anexo";

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Erro ao baixar anexo" });
  }
});

app.get("/api/admin/pedidos", adminAuth, requireDb, async (req, res) => {
  try {
    const snap = await db.collection("pedidos").get();
    const pedidos = snap.docs.map(normalizePedido).sort((a, b) => {
      return String(b.criadoEmISO || "").localeCompare(String(a.criadoEmISO || ""));
    });

    const total = pedidos.length;
    const totalRenda = pedidos.reduce((acc, pedido) => acc + Number(pedido.total || 0), 0);
    const counts = {
      pendente: pedidos.filter((p) => p.status === "pendente").length,
      pagto: pedidos.filter((p) => p.status === "pagto").length,
      em_producao: pedidos.filter((p) => p.statusPedido === "em_producao").length,
      enviado: pedidos.filter((p) => p.statusPedido === "enviado").length,
      entregue: pedidos.filter((p) => p.statusPedido === "entregue").length,
    };

    return res.json({ success: true, pedidos, dashboard: { total, totalRenda, ...counts } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.patch("/api/admin/pedidos/:id/status", adminAuth, requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body.status || "");
    const statusPedido = String(req.body.statusPedido || "");

    const updates = {
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: req.adminSession.email,
    };

    if (status) updates.status = status;
    if (statusPedido) updates.statusPedido = statusPedido;

    await db.collection("pedidos").doc(id).update(updates);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/admin/produtos", adminAuth, requireDb, async (req, res) => {
  try {
    const snap = await db.collection("produtos").get();
    const produtos = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

    return res.json({ success: true, produtos });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/produtos", adminAuth, requireDb, async (req, res) => {
  try {
    const id = String(req.body.id || "").trim();
    const nome = String(req.body.nome || "").trim();

    if (!id || !nome) {
      return res.status(400).json({ success: false, error: "ID e nome sao obrigatorios" });
    }

    const produtoRef = db.collection("produtos").doc(id);
    const existente = await produtoRef.get();
    if (existente.exists) {
      return res.status(409).json({ success: false, error: "Ja existe produto com esse ID" });
    }

    const imagens = Array.isArray(req.body.imagens)
      ? req.body.imagens.map((img) => String(img || "").trim()).filter(Boolean)
      : [];

    const produto = {
      nome,
      preco: String(req.body.preco || "0,00"),
      descricaoCurta: String(req.body.descricaoCurta || ""),
      descricaoLonga: String(req.body.descricaoLonga || ""),
      categoria: String(req.body.categoria || ""),
      tipo: String(req.body.tipo || ""),
      tamanho: String(req.body.tamanho || ""),
      gramatura: String(req.body.gramatura || ""),
      larguraCm: Math.max(1, parseDecimal(req.body.larguraCm, 15)),
      comprimentoCm: Math.max(1, parseDecimal(req.body.comprimentoCm, 20)),
      alturaCm: Math.max(0.1, parseDecimal(req.body.alturaCm, 2)),
      pesoKg: Math.max(0.01, parseDecimal(req.body.pesoKg, 0.3)),
      link: String(req.body.link || ""),
      imagens,
      personalizado: !!req.body.personalizado,
      estoque: Number(req.body.estoque || 0),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: req.adminSession.email,
    };

    await produtoRef.set(produto);
    return res.status(201).json({ success: true, produto: { id, ...produto } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/admin/produtos/:id", adminAuth, requireDb, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ success: false, error: "ID do produto invalido" });
    }

    const produtoRef = db.collection("produtos").doc(id);
    const existente = await produtoRef.get();
    if (!existente.exists) {
      return res.status(404).json({ success: false, error: "Produto nao encontrado" });
    }

    const imagens = Array.isArray(req.body.imagens)
      ? req.body.imagens.map((img) => String(img || "").trim()).filter(Boolean)
      : [];

    const updates = {
      nome: String(req.body.nome || "").trim() || "Produto",
      preco: String(req.body.preco || "0,00"),
      descricaoCurta: String(req.body.descricaoCurta || ""),
      descricaoLonga: String(req.body.descricaoLonga || ""),
      categoria: String(req.body.categoria || ""),
      tipo: String(req.body.tipo || ""),
      tamanho: String(req.body.tamanho || ""),
      gramatura: String(req.body.gramatura || ""),
      larguraCm: Math.max(1, parseDecimal(req.body.larguraCm, 15)),
      comprimentoCm: Math.max(1, parseDecimal(req.body.comprimentoCm, 20)),
      alturaCm: Math.max(0.1, parseDecimal(req.body.alturaCm, 2)),
      pesoKg: Math.max(0.01, parseDecimal(req.body.pesoKg, 0.3)),
      link: String(req.body.link || ""),
      imagens,
      personalizado: !!req.body.personalizado,
      estoque: Number(req.body.estoque || 0),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: req.adminSession.email,
    };

    await produtoRef.update(updates);
    return res.json({ success: true, produto: { id, ...updates } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/admin/produtos/:id", adminAuth, requireDb, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ success: false, error: "ID do produto invalido" });
    }

    await db.collection("produtos").doc(id).delete();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/admin/cupons", adminAuth, requireDb, async (req, res) => {
  try {
    const snap = await db.collection("cupons").get();
    const cupons = snap.docs
      .map((doc) => ({ codigo: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || ""), "pt-BR"));

    return res.json({ success: true, cupons });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/cupons", adminAuth, requireDb, async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim().toUpperCase();
    const tipo = String(req.body.tipo || "percentual").trim().toLowerCase();
    const valor = Number(req.body.valor || 0);

    if (!codigo || !(valor > 0)) {
      return res.status(400).json({ success: false, error: "Codigo e valor valido sao obrigatorios" });
    }

    if (!["percentual", "fixo"].includes(tipo)) {
      return res.status(400).json({ success: false, error: "Tipo de cupom invalido" });
    }

    await db.collection("cupons").doc(codigo).set({
      tipo,
      valor,
      ativo: req.body.ativo !== false,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: req.adminSession.email,
    });

    return res.status(201).json({ success: true, cupom: { codigo, tipo, valor } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/admin/cupons/:codigo", adminAuth, requireDb, async (req, res) => {
  try {
    const codigo = String(req.params.codigo || "").trim().toUpperCase();
    if (!codigo) {
      return res.status(400).json({ success: false, error: "Codigo do cupom invalido" });
    }

    await db.collection("cupons").doc(codigo).delete();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/gerar-pix", async (req, res) => {
  try {
    const { valor, descricao, cliente, idPedido } = req.body;
    if (!valor || Number(valor) <= 0) {
      return res.status(400).json({ success: false, error: "Valor invalido" });
    }

    const pix = await createPixCharge({
      valor: Number(valor),
      descricao,
      cliente,
      pedidoId: idPedido,
    });

    if (db && idPedido) {
      await db.collection("pedidos").doc(idPedido).update({
        pagamentoProvider: pix.provider,
        mercadoPagoId: pix.mercadoPagoId,
        statusMercadoPago: pix.statusMercadoPago,
        pixCopiaECola: pix.copiaECola,
        pixExpiraEm: pix.expiraEm,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.json({
      success: true,
      provider: pix.provider,
      qr_code: pix.qrCode,
      brcode: pix.copiaECola,
      transaction_id: pix.mercadoPagoId,
      status: pix.statusMercadoPago || "pending",
      expira_em: pix.expiraEm,
      valor: Number(valor),
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    const details =
      error?.response?.data?.message ||
      error?.response?.data?.cause?.[0]?.description ||
      error?.message ||
      "Falha na comunicacao com o Mercado Pago";

    return res.status(500).json({
      success: false,
      error: "Erro ao gerar PIX",
      details,
      status,
    });
  }
});

app.post("/api/pedidos/:id/checkout-cartao", requireDb, async (req, res) => {
  try {
    const pedidoId = String(req.params.id || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!pedidoId) {
      return res.status(400).json({ success: false, error: "ID do pedido invalido" });
    }

    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) {
      return res.status(404).json({ success: false, error: "Pedido nao encontrado" });
    }

    const pedido = pedidoSnap.data() || {};
    const pedidoEmail = String(pedido?.cliente?.email || "").trim().toLowerCase();

    if (email && pedidoEmail && email !== pedidoEmail) {
      return res.status(403).json({ success: false, error: "Pedido nao pertence ao e-mail informado" });
    }

    if (String(pedido.status || "").toLowerCase() === "pagto") {
      return res.status(409).json({ success: false, error: "Pedido ja esta pago" });
    }

    const preference = await createCheckoutProPreference({
      pedidoId,
      pedidoData: pedido,
      appBaseUrl: inferAppBaseUrl(req),
    });

    if (!preference.initPoint && !preference.sandboxInitPoint) {
      throw new Error("Nao foi possivel gerar checkout do cartao");
    }

    await pedidoRef.update({
      pagamentoProvider: "mercadopago",
      pagamento: "cartao",
      checkoutPreferenceId: preference.preferenceId,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      action: "checkout_pro",
      checkoutUrl: preference.initPoint || preference.sandboxInitPoint,
      preferenceId: preference.preferenceId,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/pedidos/:id/pagar-agora", requireDb, async (req, res) => {
  try {
    const pedidoId = String(req.params.id || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const metodoSolicitado = String(req.body.metodo || "").trim().toLowerCase();

    if (!pedidoId) {
      return res.status(400).json({ success: false, error: "ID do pedido invalido" });
    }

    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) {
      return res.status(404).json({ success: false, error: "Pedido nao encontrado" });
    }

    const pedido = pedidoSnap.data() || {};
    const pedidoEmail = String(pedido?.cliente?.email || "").trim().toLowerCase();
    if (email && pedidoEmail && email !== pedidoEmail) {
      return res.status(403).json({ success: false, error: "Pedido nao pertence ao e-mail informado" });
    }

    if (String(pedido.status || "").toLowerCase() === "pagto") {
      return res.status(409).json({ success: false, error: "Pedido ja esta pago" });
    }

    const metodo = metodoSolicitado || String(pedido.pagamento || "pix").toLowerCase();

    if (metodo === "pix") {
      const pix = await createPixCharge({
        valor: Number(pedido.total || 0),
        descricao: `Pedido #${pedidoId.slice(0, 8)} - Zuca`,
        cliente: pedido.cliente || {},
        pedidoId,
      });

      await pedidoRef.update({
        pagamento: "pix",
        pagamentoProvider: pix.provider,
        mercadoPagoId: pix.mercadoPagoId,
        statusMercadoPago: pix.statusMercadoPago,
        pixCopiaECola: pix.copiaECola,
        pixExpiraEm: pix.expiraEm,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({
        success: true,
        action: "pix",
        provider: pix.provider,
        qr_code: pix.qrCode,
        brcode: pix.copiaECola,
        transaction_id: pix.mercadoPagoId,
        expira_em: pix.expiraEm,
      });
    }

    const preference = await createCheckoutProPreference({
      pedidoId,
      pedidoData: pedido,
      appBaseUrl: inferAppBaseUrl(req),
    });
    await pedidoRef.update({
      pagamento: "cartao",
      pagamentoProvider: "mercadopago",
      checkoutPreferenceId: preference.preferenceId,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      action: "checkout_pro",
      checkoutUrl: preference.initPoint || preference.sandboxInitPoint,
      preferenceId: preference.preferenceId,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/pedidos/:id/cancelar", requireDb, async (req, res) => {
  try {
    const pedidoId = String(req.params.id || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!pedidoId) {
      return res.status(400).json({ success: false, error: "ID do pedido invalido" });
    }

    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) {
      return res.status(404).json({ success: false, error: "Pedido nao encontrado" });
    }

    const pedido = pedidoSnap.data() || {};
    const pedidoEmail = String(pedido?.cliente?.email || "").trim().toLowerCase();
    if (email && pedidoEmail && email !== pedidoEmail) {
      return res.status(403).json({ success: false, error: "Pedido nao pertence ao e-mail informado" });
    }

    const statusAtual = String(pedido.status || "").toLowerCase();
    if (statusAtual === "cancelado") {
      return res.status(409).json({ success: false, error: "Pedido ja esta cancelado" });
    }

    if (statusAtual !== "pendente") {
      return res.status(409).json({ success: false, error: "Apenas pedidos pendentes podem ser cancelados" });
    }

    await pedidoRef.update({
      status: "cancelado",
      statusPedido: "cancelado",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: "Pedido cancelado com sucesso" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/processar-pagamento", async (req, res) => {
  try {
    const { valor, descricao, cliente, cartao, idPedido } = req.body;

    if (!cartao?.numero || !cartao?.titular || !cartao?.cvc || !cartao?.vencimiento) {
      return res.status(400).json({ success: false, error: "Dados de cartao incompletos" });
    }

    if (!mpAccessToken || !mpPublicKey) {
      return res.status(500).json({ success: false, error: "Credenciais do Mercado Pago nao configuradas" });
    }

    const tokenResponse = await axios.post(
      "https://api.mercadopago.com/v1/card_tokens",
      {
        cardNumber: String(cartao.numero).replace(/\s/g, ""),
        cardholderName: cartao.titular,
        cardExpirationMonth: parseInt(String(cartao.vencimiento).split("/")[0], 10),
        cardExpirationYear: parseInt(`20${String(cartao.vencimiento).split("/")[1] || "25"}`, 10),
        securityCode: cartao.cvc,
      },
      {
        headers: buildMercadoPagoHeaders(mpPublicKey),
      }
    );

    const paymentResponse = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: Number(valor),
        token: tokenResponse.data.id,
        description: descricao || "Compra Zuca Personalizados",
        payment_method_id: "credit_card",
        payer: {
          email: cliente?.email || "cliente@email.com",
          first_name: cliente?.nome?.split(" ")[0] || "Cliente",
          last_name: cliente?.nome?.split(" ").slice(1).join(" ") || "",
        },
        installments: (() => {
          const reqInstallments = Number(req.body?.installments || 1);
          if (!Number.isInteger(reqInstallments) || reqInstallments < 1) return 1;
          const maxAllowed = valor >= 100 ? Math.min(12, Math.floor(valor / 50)) : 1;
          return Math.min(reqInstallments, maxAllowed);
        })(),
      },
      {
        headers: buildMercadoPagoHeaders(mpAccessToken, true),
      }
    );

    const payment = paymentResponse.data;

    if (db && idPedido) {
      await db.collection("pedidos").doc(idPedido).update({
        mercadoPagoId: payment.id,
        statusMercadoPago: payment.status,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.json({
      success: true,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_id: payment.id,
      valor: Number(valor),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erro ao processar pagamento",
      details: error.response?.data?.message || error.message,
    });
  }
});

app.get("/api/frete/calcular", requireDb, async (req, res) => {
  try {
    const cepDestino = String(req.query.cep || "").trim();
    const itensRaw = String(req.query.itens || "").trim();

    if (!cepDestino) {
      return res.status(400).json({ success: false, error: "CEP de destino e obrigatorio" });
    }

    let itens = [];
    if (itensRaw) {
      try {
        const parsed = JSON.parse(itensRaw);
        if (Array.isArray(parsed)) itens = parsed;
      } catch {
        // mantém fallback de itens vazio
      }
    }

    const itensComDimensao = await Promise.all((Array.isArray(itens) ? itens : []).map(async (item) => {
      const id = String(item?.id || "").trim();
      const quantidade = Math.max(1, Number(item?.quantidade || 1));
      const preco = parseMoney(item?.preco);

      let produtoData = null;
      if (id) {
        const snap = await db.collection("produtos").doc(id).get();
        if (snap.exists) produtoData = snap.data() || null;
      }

      const base = produtoData || {};
      return {
        id,
        nome: String(item?.nome || base.nome || "Produto"),
        quantidade,
        preco,
        larguraCm: Math.max(1, parseDecimal(base.larguraCm ?? base.largura, 15)),
        comprimentoCm: Math.max(1, parseDecimal(base.comprimentoCm ?? base.comprimento, 20)),
        alturaCm: Math.max(0.1, parseDecimal(base.alturaCm ?? base.altura, 2)),
        pesoKg: Math.max(0.01, parseDecimal(base.pesoKg ?? base.peso, 0.3)),
      };
    }));

    const resultado = await calcularFreteMelhorEnvio({ cepDestino, itens: itensComDimensao });
    return res.json({ success: true, ...resultado });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/cep/:cep", async (req, res) => {
  try {
    const cep = digitsOnly(req.params.cep).slice(0, 8);
    if (cep.length !== 8) {
      return res.status(400).json({ success: false, error: "CEP invalido" });
    }

    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    const data = response.data || {};
    if (data.erro) {
      return res.status(404).json({ success: false, error: "CEP nao encontrado" });
    }

    return res.json({
      success: true,
      cep: String(data.cep || ""),
      logradouro: String(data.logradouro || ""),
      complemento: String(data.complemento || ""),
      bairro: String(data.bairro || ""),
      localidade: String(data.localidade || ""),
      uf: String(data.uf || ""),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Falha ao consultar CEP" });
  }
});

app.post("/webhook/mercadopago", requireDb, async (req, res) => {
  try {
    const type = String(req.body?.type || req.query?.type || "").toLowerCase();
    const topic = String(req.body?.topic || req.query?.topic || "").toLowerCase();
    const dataId = String(req.body?.data?.id || req.query?.["data.id"] || "").trim();

    if (type !== "payment" && topic !== "payment") {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (!dataId || !mpAccessToken) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const pagamentoRes = await axios.get(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
      },
    });

    const pagamento = pagamentoRes.data || {};
    const referencia = String(pagamento.external_reference || "").trim();
    if (!referencia) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const pedidoRef = db.collection("pedidos").doc(referencia);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const statusMercadoPago = String(pagamento.status || "").toLowerCase();
    const statusPedido = statusMercadoPago === "approved" ? "pagto" : "pendente";
    await pedidoRef.update({
      mercadoPagoId: String(pagamento.id || ""),
      statusMercadoPago,
      status: statusPedido,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      pagamentoVerificadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ received: true, updated: true });
  } catch {
    return res.status(200).json({ received: true });
  }
});

app.post("/verificar-pagamento", requireDb, async (req, res) => {
  try {
    const { idPedido } = req.body;
    if (!idPedido) {
      return res.status(400).json({ success: false, error: "ID do pedido invalido" });
    }

    if (!mpAccessToken) {
      return res.status(503).json({ success: false, error: "MP_ACCESS_TOKEN nao configurado" });
    }

    const pedidoRef = db.collection("pedidos").doc(idPedido);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) {
      return res.status(404).json({ success: false, error: "Pedido nao encontrado" });
    }

    const pedidoData = pedidoSnap.data() || {};
    let mercadoPagoId = String(pedidoData.mercadoPagoId || "").trim();
    const pagamentoProvider = String(pedidoData.pagamentoProvider || "").toLowerCase();

    if (!mercadoPagoId) {
      if (pagamentoProvider === "nubank") {
        return res.status(202).json({
          success: false,
          aprovado: false,
          statusMercadoPago: "pending",
          message: "Aguardando confirmacao manual do PIX na conta Nubank",
        });
      }
      const pagamentoReferencia = await buscarPagamentoMercadoPagoPorReferencia(idPedido);
      if (!pagamentoReferencia?.id) {
        return res.status(202).json({
          success: false,
          aprovado: false,
          statusMercadoPago: "pending",
          message: "Pagamento ainda nao encontrado. Aguarde alguns segundos e tente novamente.",
        });
      }

      mercadoPagoId = String(pagamentoReferencia.id);
      await pedidoRef.update({
        mercadoPagoId,
        statusMercadoPago: String(pagamentoReferencia.status || "pending").toLowerCase(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const pagamentoRes = await axios.get(`https://api.mercadopago.com/v1/payments/${mercadoPagoId}`, {
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
      },
    });

    const pagamentoData = pagamentoRes.data || {};
    const statusMercadoPago = String(pagamentoData.status || "").toLowerCase();

    if (statusMercadoPago !== "approved") {
      await pedidoRef.update({
        status: "pendente",
        statusMercadoPago,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(202).json({
        success: false,
        aprovado: false,
        statusMercadoPago,
        message: "Pagamento ainda nao aprovado",
      });
    }

    const itens = Array.isArray(pedidoData.itens) ? pedidoData.itens : [];
    const estoqueDebitado = !!pedidoData.estoqueDebitado;

    if (!estoqueDebitado) {
      for (const item of itens) {
        const produtoRef = db.collection("produtos").doc(item.id);
        const produtoSnap = await produtoRef.get();
        if (!produtoSnap.exists) continue;
        const estoqueAtual = Number(produtoSnap.data().estoque || 0);
        const novoEstoque = Math.max(0, estoqueAtual - Number(item.quantidade || 0));
        await produtoRef.update({
          estoque: novoEstoque,
          ultimaAtualizacaoEstoque: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    await pedidoRef.update({
      status: "pagto",
      statusMercadoPago,
      estoqueDebitado: true,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      pagamentoVerificadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      aprovado: true,
      statusMercadoPago,
      message: estoqueDebitado
        ? "Pagamento confirmado"
        : "Pagamento verificado e estoque atualizado",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AVALIAÇÕES ====================

// GET /api/avaliacoes/:produtoId
app.get("/api/avaliacoes/:produtoId", requireDb, async (req, res) => {
  try {
    const { produtoId } = req.params;
    if (!produtoId) return res.status(400).json({ success: false, error: "produtoId obrigatório" });

    let snap;
    try {
      snap = await db.collection("avaliacoes")
        .where("produtoId", "==", produtoId)
        .orderBy("criadoEm", "desc")
        .limit(50)
        .get();
    } catch (error) {
      // Fallback para quando o indice composto ainda nao foi criado no Firestore.
      const failedPrecondition = error?.code === 9 || /FAILED_PRECONDITION|requires an index/i.test(String(error?.message || ""));
      if (!failedPrecondition) throw error;

      snap = await db.collection("avaliacoes")
        .where("produtoId", "==", produtoId)
        .limit(50)
        .get();
    }

    const avaliacoes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

    const media = avaliacoes.length
      ? avaliacoes.reduce((s, a) => s + (a.nota || 0), 0) / avaliacoes.length
      : 0;

    return res.json({ success: true, avaliacoes, media: Math.round(media * 10) / 10, total: avaliacoes.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/avaliacoes
app.post("/api/avaliacoes", async (req, res) => {
  try {
    const { produtoId, email, nome, nota, comentario } = req.body;
    if (!produtoId || !email || !nota) {
      return res.status(400).json({ success: false, error: "produtoId, email e nota são obrigatórios" });
    }

    const notaNum = Number(nota);
    if (notaNum < 1 || notaNum > 5 || !Number.isInteger(notaNum)) {
      return res.status(400).json({ success: false, error: "Nota deve ser um inteiro de 1 a 5" });
    }

    // Check if already reviewed
    const existing = await db.collection("avaliacoes")
      .where("produtoId", "==", produtoId)
      .where("email", "==", String(email).toLowerCase().trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ success: false, error: "Você já avaliou este produto" });
    }

    const doc = {
      produtoId,
      email: String(email).toLowerCase().trim(),
      nome: String(nome || "Anônimo").trim().slice(0, 100),
      nota: notaNum,
      comentario: String(comentario || "").trim().slice(0, 500),
      criadoEm: new Date().toISOString(),
    };

    const ref = await db.collection("avaliacoes").add(doc);
    return res.status(201).json({ success: true, id: ref.id });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Nota Fiscal Eletrônica ────────────────────────────────────────────────

/**
 * POST /api/admin/pedidos/:id/nota-fiscal
 * Emite a NF-e junto à SEFAZ-MS via Focus NFe e envia a DANFE por e-mail ao cliente.
 */
app.post("/api/admin/pedidos/:id/nota-fiscal", adminAuth, requireDb, async (req, res) => {
  const pedidoId = String(req.params.id || "").trim();
  if (!pedidoId) return res.status(400).json({ success: false, error: "ID do pedido inválido" });

  try {
    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) return res.status(404).json({ success: false, error: "Pedido não encontrado" });

    const pedido = { id: pedidoId, ...pedidoSnap.data() };

    // Validações de negócio
    if (pedido.status !== "pagto") {
      return res.status(422).json({ success: false, error: "NF-e só pode ser emitida para pedidos com pagamento confirmado (status: pagto)" });
    }

    const cpfCnpj = String(pedido.cliente?.cpfCnpj || pedido.cliente?.cpf || "").replace(/\D/g, "");
    if (!cpfCnpj) {
      return res.status(422).json({ success: false, error: "CPF/CNPJ do cliente não preenchido no pedido" });
    }

    if (pedido.notaFiscal?.status === "aprovado") {
      return res.status(409).json({
        success: false,
        error: "NF-e já emitida para este pedido",
        notaFiscal: pedido.notaFiscal,
      });
    }

    // Busca NCM dos produtos no Firestore
    const itensIds = [...new Set((pedido.itens || []).map((i) => i.id).filter(Boolean))];
    const produtosMap = {};
    if (itensIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < itensIds.length; i += 10) chunks.push(itensIds.slice(i, i + 10));
      for (const chunk of chunks) {
        const snaps = await db.collection("produtos").where("__name__", "in", chunk).get();
        snaps.forEach((doc) => { produtosMap[doc.id] = doc.data(); });
      }
    }

    const ref = `zuca-${pedidoId}`;

    // Marca como processando
    await pedidoRef.update({
      notaFiscal: {
        ref,
        status: "processando",
        emitidaEm: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    let nfeData;
    try {
      const payload = buildNfePayload(pedido, produtosMap);
      await emitirNfe(ref, payload);
      nfeData = await consultarNfe(ref, { statusTimeoutMs: 40000 });
    } catch (nfeErr) {
      await pedidoRef.update({
        "notaFiscal.status": "erro",
        "notaFiscal.erros": [nfeErr.message],
      });
      return res.status(502).json({ success: false, error: `Erro ao emitir NF-e: ${nfeErr.message}` });
    }

    const statusNfe = String(nfeData?.status || "").toLowerCase();
    const chaveAcesso = String(nfeData?.chave_nfe || "");
    const numero = String(nfeData?.numero || "");
    const serie = String(nfeData?.serie || "1");
    const danfeUrl = String(nfeData?.caminho_danfe || "");
    const xmlUrl = String(nfeData?.caminho_xml_nota_fiscal || "");
    const erros = Array.isArray(nfeData?.erros) ? nfeData.erros.map((e) => e?.mensagem || String(e)) : [];

    const notaFiscalObj = {
      ref,
      status: statusNfe,
      chaveAcesso,
      numero,
      serie,
      danfeUrl,
      xmlUrl,
      emitidaEm: admin.firestore.FieldValue.serverTimestamp(),
      erros,
    };

    if (statusNfe !== "aprovado") {
      await pedidoRef.update({ notaFiscal: notaFiscalObj });
      const msgErro = erros[0] || `SEFAZ retornou status: ${statusNfe}`;
      return res.status(422).json({ success: false, error: `NF-e rejeitada: ${msgErro}`, status: statusNfe, erros });
    }

    // Envia DANFE por e-mail
    let emailEnviado = false;
    let emailErro = null;
    try {
      const danfePdfBuffer = await getDanfePdfBuffer(ref);
      await sendNotaFiscalEmail({ pedido, danfePdfBuffer, chaveAcesso, numero, serie });
      emailEnviado = true;
      notaFiscalObj.emailEnviadoEm = admin.firestore.FieldValue.serverTimestamp();
    } catch (emailErr) {
      emailErro = emailErr.message;
      console.error("[NF-e] Falha ao enviar e-mail:", emailErr.message);
    }

    await pedidoRef.update({ notaFiscal: notaFiscalObj });

    return res.json({
      success: true,
      status: statusNfe,
      chaveAcesso,
      numero,
      serie,
      danfeUrl,
      emailEnviado,
      emailErro,
    });
  } catch (error) {
    console.error("[NF-e] Erro inesperado:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/pedidos/:id/nota-fiscal
 * Retorna o objeto notaFiscal do pedido (status, chave, urls).
 */
app.get("/api/admin/pedidos/:id/nota-fiscal", adminAuth, requireDb, async (req, res) => {
  const pedidoId = String(req.params.id || "").trim();
  if (!pedidoId) return res.status(400).json({ success: false, error: "ID do pedido inválido" });

  try {
    const pedidoSnap = await db.collection("pedidos").doc(pedidoId).get();
    if (!pedidoSnap.exists) return res.status(404).json({ success: false, error: "Pedido não encontrado" });

    const { notaFiscal } = pedidoSnap.data();
    return res.json({ success: true, notaFiscal: notaFiscal || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/pedidos/:id/nota-fiscal/reenviar-email
 * Reenvia a DANFE por e-mail ao cliente (somente se a NF-e estiver aprovada).
 */
app.post("/api/admin/pedidos/:id/nota-fiscal/reenviar-email", adminAuth, requireDb, async (req, res) => {
  const pedidoId = String(req.params.id || "").trim();
  if (!pedidoId) return res.status(400).json({ success: false, error: "ID do pedido inválido" });

  try {
    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) return res.status(404).json({ success: false, error: "Pedido não encontrado" });

    const pedido = { id: pedidoId, ...pedidoSnap.data() };
    const nf = pedido.notaFiscal;

    if (!nf || nf.status !== "aprovado") {
      return res.status(422).json({ success: false, error: "Não há NF-e aprovada para este pedido" });
    }

    const danfePdfBuffer = await getDanfePdfBuffer(nf.ref);
    await sendNotaFiscalEmail({
      pedido,
      danfePdfBuffer,
      chaveAcesso: nf.chaveAcesso,
      numero: nf.numero,
      serie: nf.serie,
    });

    await pedidoRef.update({ "notaFiscal.emailEnviadoEm": admin.firestore.FieldValue.serverTimestamp() });

    return res.json({ success: true, message: "E-mail reenviado com sucesso" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n[ZUCA] Backend-only rodando em http://localhost:${PORT}`);
  console.log(`[ZUCA] Firebase ativo: ${!!db}`);
  console.log(`[ZUCA] Admin auth: ${adminEmail ? "configurado" : "nao configurado"}`);
});

export default app;
