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

async function createCheckoutProPreference({ pedidoId, pedidoData }) {
  if (!mpAccessToken) {
    throw new Error("Credenciais do Mercado Pago nao configuradas");
  }

  const itens = Array.isArray(pedidoData?.itens) ? pedidoData.itens : [];
  if (!itens.length) {
    throw new Error("Pedido sem itens para pagamento");
  }

  const externalReference = String(pedidoId || "");
  const payload = {
    external_reference: externalReference,
    statement_descriptor: "ZUCA",
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
  return {
    id: docSnap.id,
    ...data,
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
    const { cliente, itens, pagamento, cupom, observacoes } = req.body;
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

    const itensNormalizados = itens.map((item) => ({
      id: String(item.id || ""),
      nome: String(item.nome || "Produto"),
      preco: parseMoney(item.preco),
      quantidade: Number(item.quantidade || 1),
      imagem: String(item.imagem || ""),
    }));

    const invalidos = [];
    for (const item of itensNormalizados) {
      const produtoSnap = await db.collection("produtos").doc(item.id).get();
      if (!produtoSnap.exists) {
        invalidos.push({ id: item.id, nome: item.nome, motivo: "Produto nao encontrado" });
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
      return res.status(409).json({ success: false, error: "Estoque insuficiente", itensInvalidos: invalidos });
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

    const total = Math.max(0, subtotal - desconto);
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

    return res.status(201).json({ success: true, pedidoId: pedidoRef.id, subtotal, desconto, total });
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

    const preference = await createCheckoutProPreference({ pedidoId, pedidoData: pedido });

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

    const preference = await createCheckoutProPreference({ pedidoId, pedidoData: pedido });
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
        installments: 1,
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
    const mercadoPagoId = String(pedidoData.mercadoPagoId || "").trim();
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
      return res.status(400).json({ success: false, error: "Pagamento ainda nao foi iniciado para este pedido" });
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

app.listen(PORT, () => {
  console.log(`\n[ZUCA] Backend-only rodando em http://localhost:${PORT}`);
  console.log(`[ZUCA] Firebase ativo: ${!!db}`);
  console.log(`[ZUCA] Admin auth: ${adminEmail ? "configurado" : "nao configurado"}`);
});

export default app;
