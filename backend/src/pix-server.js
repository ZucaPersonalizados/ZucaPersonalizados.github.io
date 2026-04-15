// ==================== SERVIDOR PIX + MERCADO PAGO ====================
// Node.js v20+ com ES6 Modules
// npm run dev

import express from "express";
import cors from "cors";
import axios from "axios";
import QRCode from "qrcode";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// ==================== FIREBASE CONFIG ====================
const firebaseKeyPath = process.env.FIREBASE_KEY_PATH || "./config/firebase-key.json";
if (fs.existsSync(firebaseKeyPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(firebaseKeyPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn("⚠️  Firebase key not found, webhook updates disabled");
}
const db = admin.firestore?.();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const mpAccessToken = process.env.MP_ACCESS_TOKEN || "TEST-1234567890";
const mpPublicKey = process.env.MP_PUBLIC_KEY || "APP_USER_ID1234567890";

// ==================== HEALTH CHECK ====================
app.get("/health", (req, res) => {
  res.json({ status: "✓ Servidor PIX rodando", timestamp: new Date().toISOString() });
});

// ==================== CONFIG MERCADO PAGO ====================
app.get("/config-mercadopago", (req, res) => {
  res.json({ 
    publicKey: mpPublicKey,
    configured: !!process.env.MP_PUBLIC_KEY && !!process.env.MP_ACCESS_TOKEN
  });
});

// ==================== GERAR PIX DINÂMICO ====================
app.post("/gerar-pix", async (req, res) => {
  try {
    const { valor, descricao, cliente, idPedido } = req.body;
    if (!valor || valor <= 0) return res.status(400).json({ success: false, error: "Valor inválido" });

    console.log(`[PIX] Gerando PIX de R$ ${valor.toFixed(2)}`);

    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: parseFloat(valor),
        description: descricao || "Compra Zuca Personalizados",
        payment_method_id: "pix",
        payer: {
          email: cliente?.email || "cliente@email.com",
          first_name: cliente?.nome?.split(" ")[0] || "Cliente",
          last_name: cliente?.nome?.split(" ").slice(1).join(" ") || "",
          phone: {
            area_code: cliente?.telefone?.slice(0, 2) || "11",
            number: cliente?.telefone?.slice(2) || "999999999"
          },
          identification: {
            type: "CPF",
            number: cliente?.cpf?.replace(/\D/g, "") || "00000000000"
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const payment = response.data;

    if (payment.point_of_interaction?.type === "PIX_QR_CODE") {
      const pixData = payment.point_of_interaction.sub_type_data;
      const qrCodeImage = await QRCode.toDataURL(pixData.qr_code);

      console.log(`[PIX] ✓ PIX gerado - ID: ${payment.id}`);
      return res.json({
        success: true,
        qr_code: qrCodeImage,
        brcode: pixData.qr_code,
        transaction_id: payment.id,
        status: payment.status,
        expira_em: pixData.expiration_date || Math.floor(Date.now() / 1000) + 1800,
        valor: valor
      });
    } else {
      throw new Error("PIX não disponível");
    }
  } catch (error) {
    console.error("[PIX] Erro:", error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: "Erro ao gerar PIX",
      details: error.response?.data?.message || error.message 
    });
  }
});

// ==================== PROCESSAR PAGAMENTO CARTÃO ====================
app.post("/processar-pagamento", async (req, res) => {
  try {
    const { valor, descricao, cliente, cartao } = req.body;
    if (!valor || !cartao?.numero || !cartao?.titular) {
      return res.status(400).json({ success: false, error: "Dados incompletos" });
    }

    console.log(`[CARTAO] Processando R$ ${valor.toFixed(2)}`);

    const tokenResponse = await axios.post(
      "https://api.mercadopago.com/v1/card_tokens",
      {
        cardNumber: cartao.numero.replace(/\s/g, ""),
        cardholderName: cartao.titular,
        cardExpirationMonth: parseInt(cartao.vencimiento?.split("/")[0]) || 12,
        cardExpirationYear: parseInt("20" + (cartao.vencimiento?.split("/")[1] || "25")),
        securityCode: cartao.cvc
      },
      {
        headers: {
          Authorization: `Bearer ${mpPublicKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const tokenId = tokenResponse.data.id;

    const paymentResponse = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: parseFloat(valor),
        token: tokenId,
        description: descricao || "Compra Zuca Personalizados",
        payment_method_id: "credit_card",
        payer: {
          email: cliente?.email || "cliente@email.com",
          first_name: cliente?.nome?.split(" ")[0] || "Cliente",
          last_name: cliente?.nome?.split(" ").slice(1).join(" ") || ""
        },
        installments: 1
      },
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const payment = paymentResponse.data;
    console.log(`[CARTAO] Status: ${payment.status}`);

    res.json({
      success: true,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_id: payment.id,
      valor: valor
    });

  } catch (error) {
    console.error("[CARTAO] Erro:", error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: "Erro ao processar pagamento",
      details: error.response?.data?.message || error.message 
    });
  }
});

// ==================== WEBHOOK PIX ====================
app.post("/webhook-pix", async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.json({ received: true });

    console.log(`[WEBHOOK] Pagamento ${data.id} - Status: ${data.status}`);

    if (data.status === "approved" || data.status === "completed") {
      console.log(`✓ PIX CONFIRMADO! ID: ${data.id}`);
    }

    res.json({ received: true, processed: true });
  } catch (error) {
    console.error("[WEBHOOK] Erro:", error.message);
    res.status(500).json({ error: "Erro ao processar webhook" });
  }
});

// ==================== VERIFICAR PAGAMENTO E ATUALIZAR FIRESTORE ====================
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { idPedido } = req.body;
    if (!idPedido || !db) {
      return res.status(400).json({ 
        success: false, 
        error: "ID do pedido inválido ou Firebase não configurado"
      });
    }

    console.log(`[VERIFICAR] Atualizando status de pagamento para pedido: ${idPedido}`);

    // Buscar dados do pedido para decrementar estoque
    const pedidoRef = db.collection("pedidos").doc(idPedido);
    const pedidoSnap = await pedidoRef.get();

    if (!pedidoSnap.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: "Pedido não encontrado"
      });
    }

    const pedidoData = pedidoSnap.data();
    const itens = pedidoData.itens || [];

    // Atualizar status do pedido
    await pedidoRef.update({
      status: "pagto",
      pagamentoVerificadoEm: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✓ Pagamento verificado para pedido ${idPedido}`);

    // Decrementar estoque de cada item
    if (itens.length > 0) {
      console.log(`[ESTOQUE] Decrementando estoque para ${itens.length} itens...`);
      
      for (const item of itens) {
        try {
          const produtoRef = db.collection("produtos").doc(item.id);
          const produtoSnap = await produtoRef.get();

          if (produtoSnap.exists()) {
            const estoqueAtual = produtoSnap.data().estoque || 0;
            const novoEstoque = Math.max(0, estoqueAtual - item.quantidade);

            await produtoRef.update({
              estoque: novoEstoque,
              ultimaAtualizacaoEstoque: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`  ✓ ${item.nome}: ${estoqueAtual} → ${novoEstoque} unidades`);
          }
        } catch (erro) {
          console.error(`  ✗ Erro ao atualizar estoque de ${item.id}:`, erro.message);
        }
      }
    }

    res.json({ 
      success: true, 
      message: "Pagamento verificado e estoque atualizado"
    });
  } catch (error) {
    console.error("[VERIFICAR] Erro:", error.message);
    res.status(500).json({ 
      success: false,
      error: "Erro ao atualizar status de pagamento" 
    });
  }
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 Zuca Personalizados - PIX Server                 ║
╚════════════════════════════════════════════════════════╝

✓ Servidor: http://localhost:${PORT}
✓ Node: ${process.version}

📍 ENDPOINTS:
  GET  /health              → Verificar status
  POST /gerar-pix           → Gerar QR code PIX
  POST /processar-pagamento → Processar cartão

✅ Pronto!

  `);
});

export default app;
