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
import { db } from "./firebase.js";

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
    timestamp: new Date().toISOString(),
  });
});

app.get("/config-mercadopago", (req, res) => {
  res.json({
    publicKey: mpPublicKey || null,
    configured: !!mpPublicKey && !!mpAccessToken,
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

    if (!cliente?.nome || !cliente?.email || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ success: false, error: "Dados obrigatorios ausentes" });
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
      pagamento: String(pagamento || "pix"),
      cupom: cupom ? String(cupom).toUpperCase() : null,
      observacoes: String(observacoes || ""),
      status: "pendente",
      statusPedido: "pendente",
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

app.post("/gerar-pix", async (req, res) => {
  try {
    const { valor, descricao, cliente, idPedido } = req.body;
    if (!valor || Number(valor) <= 0) {
      return res.status(400).json({ success: false, error: "Valor invalido" });
    }

    if (!mpAccessToken) {
      return res.status(500).json({ success: false, error: "MP_ACCESS_TOKEN nao configurado" });
    }

    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: Number(valor),
        description: descricao || "Compra Zuca Personalizados",
        payment_method_id: "pix",
        payer: {
          email: cliente?.email || "cliente@email.com",
          first_name: cliente?.nome?.split(" ")[0] || "Cliente",
          last_name: cliente?.nome?.split(" ").slice(1).join(" ") || "",
          phone: {
            area_code: String(cliente?.telefone || "11").slice(0, 2),
            number: String(cliente?.telefone || "999999999").slice(2),
          },
          identification: {
            type: "CPF",
            number: String(cliente?.cpf || "00000000000").replace(/\D/g, ""),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const payment = response.data;
    if (payment.point_of_interaction?.type !== "PIX_QR_CODE") {
      throw new Error("PIX indisponivel para este pagamento");
    }

    const pixData = payment.point_of_interaction.sub_type_data;
    const qrCodeImage = await QRCode.toDataURL(pixData.qr_code);

    if (db && idPedido) {
      await db.collection("pedidos").doc(idPedido).update({
        mercadoPagoId: payment.id,
        statusMercadoPago: payment.status,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.json({
      success: true,
      qr_code: qrCodeImage,
      brcode: pixData.qr_code,
      transaction_id: payment.id,
      status: payment.status,
      expira_em: pixData.expiration_date || Math.floor(Date.now() / 1000) + 1800,
      valor: Number(valor),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erro ao gerar PIX",
      details: error.response?.data?.message || error.message,
    });
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
        headers: {
          Authorization: `Bearer ${mpPublicKey}`,
          "Content-Type": "application/json",
        },
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
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
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

    const pedidoRef = db.collection("pedidos").doc(idPedido);
    const pedidoSnap = await pedidoRef.get();
    if (!pedidoSnap.exists) {
      return res.status(404).json({ success: false, error: "Pedido nao encontrado" });
    }

    const pedidoData = pedidoSnap.data() || {};
    const itens = Array.isArray(pedidoData.itens) ? pedidoData.itens : [];

    await pedidoRef.update({
      status: "pagto",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      pagamentoVerificadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

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

    return res.json({ success: true, message: "Pagamento verificado e estoque atualizado" });
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
