import { db, auth } from "./firebase.js";
import { GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Helpers
const el = (id) => document.getElementById(id);

// API URL Configuration
const API_URL = (() => {
  const env = localStorage.getItem("zuca_api_env") || "local";
  const urls = {
    local: "http://localhost:3000",
    staging: "https://pix-staging-zuca.example.com",
    production: "https://pix-zuca.example.com"
  };
  return urls[env] || urls.local;
})();

// State
let usuarioAtual = null;
let descontoAtual = 0;

// ==================== CARRINHO ====================
const getCarrinho = () => {
  try {
    const dados = localStorage.getItem("zuca_carrinho");
    return JSON.parse(dados || "[]");
  } catch (e) {
    console.error("[CARRINHO] Erro:", e);
    return [];
  }
};

const formatarMoeda = (v) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const precoNumero = (p) => Number(String(p || "0").replace("R$", "").replace(".", "").replace(",", ".")) || 0;

const renderCarrinho = () => {
  const itens = getCarrinho();
  const container = el("lista-carrinho");
  const totalEl = el("total-carrinho");
  
  if (!container) return;

  container.innerHTML = "";

  if (itens.length === 0) {
    container.innerHTML = "<p style='color:#999;font-size:14px;'>Seu carrinho está vazio.</p>";
    if (totalEl) totalEl.textContent = "R$ 0,00";
    return;
  }

  let subtotal = 0;
  itens.forEach((item) => {
    const precoUnitario = precoNumero(item.preco);
    const quantidade = item.quantidade || 1;
    const subtotalItem = precoUnitario * quantidade;
    subtotal += subtotalItem;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>
        <strong>${item.nome}</strong><br/>
        <small>x${quantidade}</small>
      </span>
      <strong>${formatarMoeda(subtotalItem)}</strong>
    `;
    container.appendChild(div);
  });

  const total = Math.max(0, subtotal - descontoAtual);
  if (totalEl) totalEl.textContent = formatarMoeda(total);
  if (el("subtotal")) el("subtotal").textContent = formatarMoeda(subtotal);
  if (el("desconto")) el("desconto").textContent = formatarMoeda(descontoAtual);
  if (el("total-final")) el("total-final").textContent = formatarMoeda(total);
};

// ==================== PERFIL ====================
const carregarPerfil = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "clientes", uid));
    if (!snap.exists()) return;
    
    const c = snap.data();
    const campos = ["nome", "cpfCnpj", "email", "telefone", "cep", "endereco", "numero", "bairro", "cidade", "estado"];
    campos.forEach((id) => {
      const f = el(id);
      if (f) f.value = c[id] || "";
    });
  } catch (e) {
    console.error("[PERFIL] Erro:", e);
  }
};

const salvarPerfil = async (uid) => {
  const dados = {
    nome: el("nome")?.value.trim() || "",
    cpfCnpj: el("cpfCnpj")?.value.trim() || "",
    email: el("email")?.value.trim() || "",
    telefone: el("telefone")?.value.trim() || "",
    cep: el("cep")?.value.trim() || "",
    endereco: el("endereco")?.value.trim() || "",
    numero: el("numero")?.value.trim() || "",
    bairro: el("bairro")?.value.trim() || "",
    cidade: el("cidade")?.value.trim() || "",
    estado: el("estado")?.value.trim() || "",
    atualizadoEm: serverTimestamp()
  };

  await setDoc(doc(db, "clientes", uid), dados, { merge: true });
  return dados;
};

// ==================== CUPOM ====================
const aplicarCupom = async () => {
  const cupom = el("cupom");
  if (!cupom) return;

  const codigo = cupom.value.trim().toUpperCase();
  if (!codigo) {
    if (el("checkout-status")) el("checkout-status").textContent = "Informe um cupom.";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "cupons", codigo));
    if (!snap.exists()) {
      descontoAtual = 0;
      if (el("checkout-status")) el("checkout-status").textContent = "Cupom inválido.";
      renderCarrinho();
      return;
    }

    const c = snap.data();
    const subtotal = getCarrinho().reduce((a, i) => a + (precoNumero(i.preco) * (i.quantidade || 1)), 0);
    descontoAtual = c.tipo === "percentual" ? subtotal * (Number(c.valor || 0) / 100) : Number(c.valor || 0);
    if (el("checkout-status")) el("checkout-status").textContent = `✓ Cupom aplicado: -${formatarMoeda(descontoAtual)}`;
    renderCarrinho();
  } catch (e) {
    console.error("[CUPOM] Erro:", e);
    if (el("checkout-status")) el("checkout-status").textContent = "Erro ao validar cupom.";
  }
};

// ==================== PEDIDOS ====================
const listarPedidos = async (uid) => {
  const container = el("lista-pedidos");
  if (!container) return;

  container.innerHTML = "";

  try {
    const q = query(collection(db, "pedidos"), where("uid", "==", uid));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = "<p>Nenhum pedido ainda.</p>";
      return;
    }

    snap.forEach((doc) => {
      const item = document.createElement("div");
      item.className = "cart-item";
      item.innerHTML = `
        <span>#${doc.id.slice(0, 8)} • ${doc.data().status || "recebido"}</span>
        <strong>${formatarMoeda(doc.data().total || 0)}</strong>
      `;
      container.appendChild(item);
    });
  } catch (e) {
    console.error("[PEDIDOS] Erro:", e);
  }
};

// ==================== VERIFICAR PAGAMENTO ====================
const verificarPagamento = async (idPedido) => {
  try {
    const res = await fetch(`${API_URL}/verificar-pagamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idPedido })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success) {
      console.log(`[VERIFICAÇÃO] ✓ Pagamento verificado para pedido ${idPedido}`);
      return true;
    } else {
      throw new Error(data.error || "Falha ao verificar pagamento");
    }
  } catch (e) {
    console.error("[VERIFICAÇÃO] Erro:", e);
    return false;
  }
};

// ==================== PIX ====================
const gerarPixDinamico = async (total, idPedido, cliente) => {
  try {
    if (el("checkout-status")) el("checkout-status").textContent = "Gerando PIX...";

    const res = await fetch(`${API_URL}/gerar-pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: total,
        descricao: `Pedido #${idPedido.slice(0, 8)} - Zuca`,
        cliente: {
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          cpf: cliente.cpfCnpj.replace(/\D/g, "")
        },
        idPedido
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success && data.qr_code && data.brcode) {
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;";
      modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:12px;text-align:center;max-width:400px;">
          <h3 style="color:#c98d59;">✓ PIX Gerado!</h3>
          <img src="${data.qr_code}" alt="QR" style="width:240px;height:240px;border-radius:8px;margin:20px 0;" />
          <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin:10px 0;word-break:break-all;font-family:monospace;font-size:0.75em;max-height:100px;overflow-y:auto;">${data.brcode}</div>
          <button id="copy-pix" style="background:#c98d59;color:white;border:none;padding:12px 24px;border-radius:999px;cursor:pointer;margin:15px 5px;">📋 Copiar</button>
          <button onclick="this.parentElement.parentElement.remove();" style="background:#ddd;border:none;padding:12px 24px;border-radius:999px;cursor:pointer;">Fechar</button>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("copy-pix")?.addEventListener("click", () => {
        navigator.clipboard.writeText(data.brcode);
        alert("Copiado!");
      });

      // Verificar pagamento após PIX gerado
      const verified = await verificarPagamento(idPedido);
      if (verified) {
        if (el("checkout-status")) el("checkout-status").textContent = `✓ PIX: ${formatarMoeda(total)} - Verificado`;
      } else {
        if (el("checkout-status")) el("checkout-status").textContent = `✓ PIX: ${formatarMoeda(total)}`;
      }
    } else {
      throw new Error(data.error || "Falha ao gerar PIX");
    }
  } catch (e) {
    console.error("[PIX] Erro:", e);
    if (el("checkout-status")) el("checkout-status").textContent = `Erro PIX: ${e.message}`;
  }
};

// ==================== CARTÃO ====================
const pagarComMercadoPago = async (total, idPedido, cliente) => {
  try {
    if (el("checkout-status")) el("checkout-status").textContent = "Processando cartão...";

    const res = await fetch(`${API_URL}/processar-pagamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: total,
        descricao: `Pedido #${idPedido.slice(0, 8)}`,
        cliente: { nome: cliente.nome, email: cliente.email, telefone: cliente.telefone },
        idPedido
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success && data.status === "approved") {
      // Verificar pagamento após aprovação do cartão
      const verified = await verificarPagamento(idPedido);
      if (verified) {
        if (el("checkout-status")) el("checkout-status").textContent = `✓ Aprovado! #${idPedido.slice(0, 8)} - Pagamento verificado`;
      } else {
        if (el("checkout-status")) el("checkout-status").textContent = `✓ Aprovado! #${idPedido.slice(0, 8)}`;
      }
    } else if (data.status === "pending") {
      if (el("checkout-status")) el("checkout-status").textContent = "⏳ Análise em progresso...";
    } else {
      throw new Error(data.error || "Erro ao processar cartão");
    }
  } catch (e) {
    console.error("[CARTÃO] Erro:", e);
    if (el("checkout-status")) el("checkout-status").textContent = `Erro: ${e.message}`;
  }
};

// ==================== VALIDAR ESTOQUE ====================
const validarEstoque = async (itens) => {
  try {
    const produtosInvalidos = [];

    for (const item of itens) {
      try {
        const snap = await getDoc(doc(db, "produtos", item.id));
        
        if (!snap.exists()) {
          produtosInvalidos.push({
            nome: item.nome,
            motivo: "Produto não existe mais"
          });
          continue;
        }

        const produto = snap.data();
        const estoqueDisponivel = produto.estoque || 0;

        if (estoqueDisponivel < item.quantidade) {
          produtosInvalidos.push({
            nome: item.nome,
            motivo: `Apenas ${estoqueDisponivel} disponível(is). Você solicitou ${item.quantidade}.`
          });
        }
      } catch (erro) {
        console.error(`[ESTOQUE] Erro ao validar ${item.id}:`, erro);
        produtosInvalidos.push({
          nome: item.nome,
          motivo: "Erro ao validar disponibilidade"
        });
      }
    }

    return produtosInvalidos;
  } catch (erro) {
    console.error("[ESTOQUE] Erro na validação:", erro);
    throw new Error("Erro ao validar estoque dos produtos");
  }
};

// ==================== FINALIZAR PEDIDO ===================="
const finalizarPedido = async () => {
  if (!usuarioAtual) {
    if (el("checkout-status")) el("checkout-status").textContent = "Faça login.";
    return;
  }

  const itens = getCarrinho();
  if (itens.length === 0) {
    if (el("checkout-status")) el("checkout-status").textContent = "Carrinho vazio.";
    return;
  }

  // ✅ VALIDAR ESTOQUE ANTES DE FINALIZAR
  try {
    if (el("checkout-status")) el("checkout-status").textContent = "Validando estoque...";
    const produtosIndisponiveis = await validarEstoque(itens);

    if (produtosIndisponiveis.length > 0) {
      let mensagem = "❌ Produtos indisponíveis:\n\n";
      produtosIndisponiveis.forEach(p => {
        mensagem += `• ${p.nome}\n  ${p.motivo}\n\n`;
      });
      mensagem += "Por favor, atualize seu carrinho e tente novamente.";
      
      alert(mensagem);
      if (el("checkout-status")) el("checkout-status").textContent = "Alguns produtos não estão disponíveis nas quantidades solicitadas.";
      return;
    }
  } catch (erro) {
    console.error("[VALIDAÇÃO] Erro:", erro);
    if (el("checkout-status")) el("checkout-status").textContent = `Erro ao validar estoque: ${erro.message}`;
    return;
  }

  const perfil = await salvarPerfil(usuarioAtual.uid);
  const subtotal = itens.reduce((a, i) => a + (precoNumero(i.preco) * (i.quantidade || 1)), 0);
  const total = Math.max(0, subtotal - descontoAtual);
  const metodo = el("pagamento")?.value || "pix";

  try {
    const btn = el("btn-finalizar");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processando...";
    }

    const docRef = await addDoc(collection(db, "pedidos"), {
      uid: usuarioAtual.uid,
      cliente: perfil,
      itens,
      subtotal,
      desconto: descontoAtual,
      total,
      pagamento: metodo,
      cupom: el("cupom")?.value.trim().toUpperCase() || null,
      status: "pendente",
      criadoEm: serverTimestamp()
    });

    if (metodo === "pix") {
      await gerarPixDinamico(total, docRef.id, perfil);
    } else if (metodo === "cartao") {
      await pagarComMercadoPago(total, docRef.id, perfil);
    } else if (metodo === "boleto") {
      if (el("checkout-status")) el("checkout-status").textContent = `✓ Pedido #${docRef.id.slice(0, 8)} - Boleto enviado`;
    } else if (metodo === "transferencia") {
      if (el("checkout-status")) el("checkout-status").textContent = `✓ Pedido #${docRef.id.slice(0, 8)} - Dados enviados`;
    }

    localStorage.removeItem("zuca_carrinho");
    descontoAtual = 0;
    renderCarrinho();
    await listarPedidos(usuarioAtual.uid);
  } catch (e) {
    console.error("[FINALIZAR] Erro:", e);
    if (el("checkout-status")) el("checkout-status").textContent = "Erro ao processar.";
  } finally {
    const btn = el("btn-finalizar");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✓ Finalizar Compra";
    }
  }
};

// ==================== EVENT LISTENERS ====================
el("pagamento")?.addEventListener("change", (e) => {
  document.querySelectorAll(".payment-option").forEach(x => x.classList.remove("active"));
  const s = document.getElementById(e.target.value + "-section");
  if (s) s.classList.add("active");
});

el("btn-aplicar-cupom")?.addEventListener("click", aplicarCupom);
el("btn-finalizar")?.addEventListener("click", finalizarPedido);

el("btn-google")?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    console.error("[AUTH]", e);
  }
});

el("btn-apple")?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new OAuthProvider("apple.com"));
  } catch (e) {
    console.error("[AUTH]", e);
  }
});

el("btn-logout")?.addEventListener("click", async () => {
  await signOut(auth);
  if (el("checkout-status")) el("checkout-status").textContent = "Desconectado";
});

// ==================== API ENV SELECTOR ====================
const env = document.createElement("div");
env.style.cssText = "position:fixed;bottom:10px;left:10px;background:#f0f0f0;padding:8px 12px;border-radius:6px;font-size:11px;z-index:999;";
env.innerHTML = `<label>🔧 <select id="api-env-select" style="font-size:11px;"><option value="local">Local</option><option value="staging">Staging</option><option value="production">Prod</option></select></label>`;
document.body.appendChild(env);

const apiSel = el("api-env-select");
if (apiSel) {
  apiSel.value = localStorage.getItem("zuca_api_env") || "local";
  apiSel.addEventListener("change", (e) => {
    localStorage.setItem("zuca_api_env", e.target.value);
    location.reload();
  });
}

// ==================== AUTH STATE ====================
onAuthStateChanged(auth, async (user) => {
  usuarioAtual = user;

  if (!user) {
    if (el("auth-status")) el("auth-status").textContent = "Faça login para continuar.";
    renderCarrinho();
    return;
  }

  if (el("auth-status")) el("auth-status").textContent = `Logado: ${user.email || user.displayName}`;

  const ef = el("email");
  if (ef) ef.value = user.email || "";

  await carregarPerfil(user.uid);
  await listarPedidos(user.uid);
  renderCarrinho();
});

// ==================== INICIALIZAÇÃO ====================
renderCarrinho();
