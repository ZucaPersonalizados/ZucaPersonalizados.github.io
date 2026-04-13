import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw",
  authDomain: "zuca-personalizados.firebaseapp.com",
  databaseURL: "https://zuca-personalizados-default-rtdb.firebaseio.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:0a0bb2c2047e7558d14aaa",
  measurementId: "G-PR8E6LTS9K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const el = (id) => document.getElementById(id);

// ==================== CONFIGURAÇÃO DE ENDPOINTS ====================
// Mude para a URL do seu servidor quando fizer deploy
const API_URL = (() => {
  const env = localStorage.getItem("zuca_api_env") || "local";
  const urls = {
    local: "http://localhost:3000",
    staging: "https://pix-staging-zuca.example.com",
    production: "https://pix-zuca.example.com"
  };
  return urls[env] || urls.local;
})();

let usuarioAtual = null;
let descontoAtual = 0;

function getCarrinho() {
  try {
    return JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  } catch {
    return [];
  }
}

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

function precoNumero(preco) {
  return Number(String(preco || "0").replace("R$", "").replace(".", "").replace(",", ".")) || 0;
}

function renderCarrinho() {
  const itens = getCarrinho();
  const container = el("lista-carrinho");
  container.innerHTML = "";

  if (itens.length === 0) {
    container.innerHTML = "<p style='color: #999; font-size: 14px;'>Seu carrinho está vazio.</p>";
    el("total-carrinho").textContent = "R$ 0,00";
    if (el("subtotal")) el("subtotal").textContent = "R$ 0,00";
    if (el("desconto")) el("desconto").textContent = "R$ 0,00";
    if (el("total-final")) el("total-final").textContent = "R$ 0,00";
    return;
  }

  const subtotal = itens.reduce((acc, item) => acc + (precoNumero(item.preco) * (item.quantidade || 1)), 0);
  const total = Math.max(0, subtotal - descontoAtual);

  itens.forEach((item) => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `<span><strong>${item.nome}</strong><br/><small>x${item.quantidade || 1}</small></span><strong>${formatarMoeda(precoNumero(item.preco) * (item.quantidade || 1))}</strong>`;
    container.appendChild(div);
  });

  el("total-carrinho").textContent = formatarMoeda(total);
  if (el("subtotal")) el("subtotal").textContent = formatarMoeda(subtotal);
  if (el("desconto")) el("desconto").textContent = formatarMoeda(descontoAtual);
  if (el("total-final")) el("total-final").textContent = formatarMoeda(total);
}

async function carregarPerfil(uid) {
  const ref = doc(db, "clientes", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return;
  }

  const c = snap.data();
  ["nome", "cpfCnpj", "email", "telefone", "cep", "endereco", "numero", "bairro", "cidade", "estado"].forEach((id) => {
    el(id).value = c[id] || "";
  });
}

async function salvarPerfil(uid) {
  const dados = {
    nome: el("nome").value.trim(),
    cpfCnpj: el("cpfCnpj").value.trim(),
    email: el("email").value.trim(),
    telefone: el("telefone").value.trim(),
    cep: el("cep").value.trim(),
    endereco: el("endereco").value.trim(),
    numero: el("numero").value.trim(),
    bairro: el("bairro").value.trim(),
    cidade: el("cidade").value.trim(),
    estado: el("estado").value.trim(),
    atualizadoEm: serverTimestamp()
  };

  await setDoc(doc(db, "clientes", uid), dados, { merge: true });
  return dados;
}

async function aplicarCupom() {
  const codigo = el("cupom").value.trim().toUpperCase();
  if (!codigo) {
    el("checkout-status").textContent = "Informe um cupom.";
    return;
  }

  const snap = await getDoc(doc(db, "cupons", codigo));
  if (!snap.exists()) {
    descontoAtual = 0;
    el("checkout-status").textContent = "Cupom inválido.";
    renderCarrinho();
    return;
  }

  const cupom = snap.data();
  const subtotal = getCarrinho().reduce((acc, item) => acc + (precoNumero(item.preco) * (item.quantidade || 1)), 0);

  if (cupom.tipo === "percentual") {
    descontoAtual = subtotal * (Number(cupom.valor || 0) / 100);
  } else {
    descontoAtual = Number(cupom.valor || 0);
  }

  el("checkout-status").textContent = `Cupom aplicado: - ${formatarMoeda(descontoAtual)}`;
  renderCarrinho();
}

async function listarPedidos(uid) {
  const container = el("lista-pedidos");
  container.innerHTML = "";

  const q = query(collection(db, "pedidos"), where("uid", "==", uid));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    container.innerHTML = "<p>Nenhum pedido ainda.</p>";
    return;
  }

  snapshot.forEach((docItem) => {
    const pedido = docItem.data();
    const item = document.createElement("div");
    item.className = "cart-item";
    item.innerHTML = `<span>#${docItem.id.slice(0, 8)} • ${pedido.status || "recebido"}</span><strong>${formatarMoeda(pedido.total || 0)}</strong>`;
    container.appendChild(item);
  });
}

async function finalizarPedido() {
  if (!usuarioAtual) {
    el("checkout-status").textContent = "Faça login antes de finalizar.";
    return;
  }

  const itens = getCarrinho();
  if (itens.length === 0) {
    el("checkout-status").textContent = "Carrinho vazio.";
    return;
  }

  const perfil = await salvarPerfil(usuarioAtual.uid);
  const subtotal = itens.reduce((acc, item) => acc + (precoNumero(item.preco) * (item.quantidade || 1)), 0);
  const total = Math.max(0, subtotal - descontoAtual);
  const metodoPagamento = el("pagamento")?.value || "pix";

  try {
    el("btn-finalizar").disabled = true;
    el("btn-finalizar").textContent = "Processando...";

    // Salvar pedido no Firestore
    const docRef = await addDoc(collection(db, "pedidos"), {
      uid: usuarioAtual.uid,
      cliente: perfil,
      itens,
      subtotal,
      desconto: descontoAtual,
      total,
      pagamento: metodoPagamento,
      cupom: el("cupom").value.trim().toUpperCase() || null,
      status: "pendente",
      criadoEm: serverTimestamp()
    });

    // Processar pagamento conforme método
    if (metodoPagamento === "pix") {
      await gerarPixDinamico(total, docRef.id, perfil);
    } else if (metodoPagamento === "cartao") {
      await pagarComMercadoPago(total, docRef.id, perfil);
    } else if (metodoPagamento === "boleto") {
      el("checkout-status").textContent = `✓ Pedido #${docRef.id.slice(0, 8)} criado! Boleto enviado para ${perfil.email}`;
    } else if (metodoPagamento === "transferencia") {
      el("checkout-status").textContent = `✓ Pedido #${docRef.id.slice(0, 8)} criado! Dados bancários enviados para ${perfil.email}`;
    }

    localStorage.removeItem("zuca_carrinho");
    descontoAtual = 0;
    renderCarrinho();
    await listarPedidos(usuarioAtual.uid);

  } catch (error) {
    console.error("Erro ao finalizar pedido:", error);
    el("checkout-status").textContent = "Erro ao processar pedido. Tente novamente.";
  } finally {
    el("btn-finalizar").disabled = false;
    el("btn-finalizar").textContent = "Finalizar Compra";
  }
}

// ==================== PIX DINÂMICO ====================
async function gerarPixDinamico(total, idPedido, cliente) {
  try {
    el("checkout-status").textContent = "Gerando PIX...";

    // Chamada ao backend para gerar PIX dinâmico
    const response = await fetch(`${API_URL}/gerar-pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: total,
        descricao: `Pedido #${idPedido.slice(0, 8)} - Zuca Personalizados`,
        cliente: {
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          cpf: cliente.cpfCnpj.replace(/\D/g, "")
        },
        idPedido
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.success && data.qr_code && data.brcode) {
      // Mostrar Modal PIX
      const modalPix = document.createElement("div");
      modalPix.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      modalPix.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          <h3 style="margin: 0 0 10px 0; color: #c98d59;">✓ PIX Gerado!</h3>
          <p style="color: #666; margin: 0 0 20px 0;">Escaneie o código com seu banco</p>
          <img src="${data.qr_code}" alt="QR Code PIX" style="width: 240px; height: 240px; margin: 0; border-radius: 8px;">
          <p style="color: #999; font-size: 12px; margin: 15px 0 10px 0;">Ou copie a chave dinâmica:</p>
          <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 10px 0; word-break: break-all; font-family: monospace; font-size: 0.75em; color: #333; max-height: 100px; overflow-y: auto;">
            ${data.brcode}
          </div>
          <button id="btn-copiar-pix-modal" style="background: #c98d59; color: white; border: none; padding: 12px 24px; border-radius: 999px; cursor: pointer; margin: 15px 5px; font-weight: bold;">
            📋 Copiar Chave
          </button>
          <button onclick="this.parentElement.parentElement.remove();" style="background: #ddd; border: none; padding: 12px 24px; border-radius: 999px; cursor: pointer; margin: 15px 5px; font-weight: bold;">
            Fechar
          </button>
          <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">Pedido: #${idPedido.slice(0, 8)} | Valor: ${formatarMoeda(total)}</p>
        </div>
      `;
      document.body.appendChild(modalPix);

      // Botão copiar
      document.getElementById("btn-copiar-pix-modal").addEventListener("click", () => {
        navigator.clipboard.writeText(data.brcode);
        alert("Chave PIX copiada para a área de transferência! 📋");
      });

      el("checkout-status").textContent = `✓ PIX gerado! Pedido #${idPedido.slice(0, 8)} - Valor: ${formatarMoeda(total)}. Você receberá confirmação por e-mail.`;
    } else {
      throw new Error(data.error || "Falha ao gerar PIX");
    }

  } catch (error) {
    console.error("Erro ao gerar PIX:", error);
    el("checkout-status").textContent = `Erro ao gerar PIX: ${error.message}. Verifique se o servidor está rodando em ${API_URL}`;
  }
}

// ==================== MERCADO PAGO ====================
async function pagarComMercadoPago(total, idPedido, cliente) {
  try {
    el("checkout-status").textContent = "Processando pagamento...";

    // Se usando Mercado Pago Brick.js, a tokenização acontece aqui
    // Por enquanto, fazemos requisição simples
    const response = await fetch(`${API_URL}/processar-pagamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: total,
        descricao: `Pedido #${idPedido.slice(0, 8)} - Zuca Personalizados`,
        cliente: {
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone
        },
        // NOTA: Em produção, use MP Brick.js para tokenização segura
        // Não envie números de cartão diretamente ao backend
        idPedido
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.success && data.status === "approved") {
      el("checkout-status").textContent = `✓ Pagamento aprovado! Pedido #${idPedido.slice(0, 8)} processado. Você receberá a confirmação por e-mail.`;
    } else if (data.status === "pending" || data.status === "in_process") {
      el("checkout-status").textContent = `⏳ Pagamento em análise. Pedido #${idPedido.slice(0, 8)}. Você receberá atualização em breve.`;
    } else {
      throw new Error(data.error || "Erro ao processar pagamento");
    }

  } catch (error) {
    console.error("Erro ao processar cartão:", error);
    el("checkout-status").textContent = `Erro ao processar cartão: ${error.message}`;
  }
}

// ==================== SELETOR DE MÉTODOS ====================
const seletorPagamento = el("pagamento");
if (seletorPagamento) {
  seletorPagamento.addEventListener("change", (e) => {
    document.querySelectorAll(".payment-option").forEach(el => el.classList.remove("active"));
    const secao = document.getElementById(e.target.value + "-section");
    if (secao) secao.classList.add("active");
  });
}

// Copiar PIX
el("btn-copiar-pix")?.addEventListener("click", () => {
  const brcode = el("pix-brcode").value;
  if (brcode) {
    navigator.clipboard.writeText(brcode);
    alert("Chave PIX copiada! 📋");
  }
});

// ==================== SELETOR DE AMBIENTE (DEV) ====================
const envSeletor = document.createElement("div");
envSeletor.style.cssText = "position: fixed; bottom: 10px; left: 10px; background: #f0f0f0; padding: 8px 12px; border-radius: 6px; font-size: 11px; z-index: 999; border: 1px solid #ddd;";
envSeletor.innerHTML = `
  <label>🔧 API: 
    <select id="api-env-select" style="font-size: 11px; padding: 3px;">
      <option value="local">Local (3000)</option>
      <option value="staging">Staging</option>
      <option value="production">Production</option>
    </select>
  </label>
`;
document.body.appendChild(envSeletor);

el("api-env-select").value = localStorage.getItem("zuca_api_env") || "local";
el("api-env-select").addEventListener("change", (e) => {
  localStorage.setItem("zuca_api_env", e.target.value);
  alert(`API alternativamente para: ${e.target.value}. Recarregue a página.`);
  location.reload();
});

// ==================== AUTH ====================
el("btn-google").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Erro ao entrar com Google:", error);
    alert("Erro ao fazer login com Google");
  }
});

el("btn-apple").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new OAuthProvider("apple.com"));
  } catch (error) {
    console.error("Erro ao entrar com Apple:", error);
    alert("Erro ao fazer login com Apple");
  }
});

el("btn-logout").addEventListener("click", async () => {
  await signOut(auth);
  el("checkout-status").textContent = "Desconectado com sucesso";
});

el("btn-aplicar-cupom").addEventListener("click", aplicarCupom);
el("btn-finalizar").addEventListener("click", finalizarPedido);

onAuthStateChanged(auth, async (user) => {
  usuarioAtual = user;

  if (!user) {
    el("auth-status").textContent = "Faça login para continuar.";
    return;
  }

  el("auth-status").textContent = `Logado como ${user.email || user.displayName || "cliente"}.`;
  el("email").value = user.email || "";
  await carregarPerfil(user.uid);
  await listarPedidos(user.uid);
});

renderCarrinho();

function getCarrinho() {
  try {
    return JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  } catch {
    return [];
  }
}

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

function precoNumero(preco) {
  return Number(String(preco || "0").replace("R$", "").replace(".", "").replace(",", ".")) || 0;
}

function renderCarrinho() {
  const itens = getCarrinho();
  const container = el("lista-carrinho");
  container.innerHTML = "";

  if (itens.length === 0) {
    container.innerHTML = "<p style='color: #999; font-size: 14px;'>Seu carrinho está vazio.</p>";
    el("total-carrinho").textContent = "R$ 0,00";
    if (el("subtotal")) el("subtotal").textContent = "R$ 0,00";
    if (el("desconto")) el("desconto").textContent = "R$ 0,00";
    if (el("total-final")) el("total-final").textContent = "R$ 0,00";
    return;
  }

  const subtotal = itens.reduce((acc, item) => acc + (precoNumero(item.preco) * (item.quantidade || 1)), 0);
  const total = Math.max(0, subtotal - descontoAtual);

  itens.forEach((item) => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `<span><strong>${item.nome}</strong><br/><small>x${item.quantidade || 1}</small></span><strong>${formatarMoeda(precoNumero(item.preco) * (item.quantidade || 1))}</strong>`;
    container.appendChild(div);
  });

  el("total-carrinho").textContent = formatarMoeda(total);
  if (el("subtotal")) el("subtotal").textContent = formatarMoeda(subtotal);
  if (el("desconto")) el("desconto").textContent = formatarMoeda(descontoAtual);
  if (el("total-final")) el("total-final").textContent = formatarMoeda(total);
}

async function carregarPerfil(uid) {
  const ref = doc(db, "clientes", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return;
  }

  const c = snap.data();
  ["nome", "cpfCnpj", "email", "telefone", "cep", "endereco", "numero", "bairro", "cidade", "estado"].forEach((id) => {
    el(id).value = c[id] || "";
  });
}

async function salvarPerfil(uid) {
  const dados = {
    nome: el("nome").value.trim(),
    cpfCnpj: el("cpfCnpj").value.trim(),
    email: el("email").value.trim(),
    telefone: el("telefone").value.trim(),
    cep: el("cep").value.trim(),
    endereco: el("endereco").value.trim(),
    numero: el("numero").value.trim(),
    bairro: el("bairro").value.trim(),
    cidade: el("cidade").value.trim(),
    estado: el("estado").value.trim(),
    atualizadoEm: serverTimestamp()
  };

  await setDoc(doc(db, "clientes", uid), dados, { merge: true });
  return dados;
}

async function aplicarCupom() {
  const codigo = el("cupom").value.trim().toUpperCase();
  if (!codigo) {
    el("checkout-status").textContent = "Informe um cupom.";
    return;
  }

  const snap = await getDoc(doc(db, "cupons", codigo));
  if (!snap.exists()) {
    descontoAtual = 0;
    el("checkout-status").textContent = "Cupom inválido.";
    renderCarrinho();
    return;
  }

  const cupom = snap.data();
  const subtotal = getCarrinho().reduce((acc, item) => acc + (precoNumero(item.preco) * (item.quantidade || 1)), 0);

  if (cupom.tipo === "percentual") {
    descontoAtual = subtotal * (Number(cupom.valor || 0) / 100);
  } else {
    descontoAtual = Number(cupom.valor || 0);
  }

  el("checkout-status").textContent = `Cupom aplicado: - ${formatarMoeda(descontoAtual)}`;
  renderCarrinho();
}

async function listarPedidos(uid) {
  const container = el("lista-pedidos");
  container.innerHTML = "";

  const q = query(collection(db, "pedidos"), where("uid", "==", uid));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    container.innerHTML = "<p>Nenhum pedido ainda.</p>";
    return;
  }

  snapshot.forEach((docItem) => {
    const pedido = docItem.data();
    const item = document.createElement("div");
    item.className = "cart-item";
    item.innerHTML = `<span>#${docItem.id.slice(0, 8)} • ${pedido.status || "recebido"}</span><strong>${formatarMoeda(pedido.total || 0)}</strong>`;
    container.appendChild(item);
  });
}

async function finalizarPedido() {
  if (!usuarioAtual) {
    el("checkout-status").textContent = "Faça login antes de finalizar.";
    return;
  }

  const itens = getCarrinho();
  if (itens.length === 0) {
    el("checkout-status").textContent = "Carrinho vazio.";
    return;
  }

  const perfil = await salvarPerfil(usuarioAtual.uid);
  const subtotal = itens.reduce((acc, item) => acc + (precoNumero(item.preco) * (item.quantidade || 1)), 0);
  const total = Math.max(0, subtotal - descontoAtual);
  const metodoPagamento = el("pagamento")?.value || "pix";

  try {
    el("btn-finalizar").disabled = true;
    el("btn-finalizar").textContent = "Processando...";

    // Salvar pedido no Firestore
    const docRef = await addDoc(collection(db, "pedidos"), {
      uid: usuarioAtual.uid,
      cliente: perfil,
      itens,
      subtotal,
      desconto: descontoAtual,
      total,
      pagamento: metodoPagamento,
      cupom: el("cupom").value.trim().toUpperCase() || null,
      status: "pendente",
      criadoEm: serverTimestamp()
    });

    // Processar pagamento conforme método
    if (metodoPagamento === "pix") {
      await gerarPixDinamico(total, docRef.id, perfil);
    } else if (metodoPagamento === "cartao") {
      await pagarComMercadoPago(total, docRef.id, perfil);
    } else if (metodoPagamento === "transferencia") {
      el("checkout-status").textContent = `✓ Pedido #${docRef.id.slice(0, 8)} criado! Dados bancários enviados para ${perfil.email}`;
    }

    localStorage.removeItem("zuca_carrinho");
    descontoAtual = 0;
    renderCarrinho();
    await listarPedidos(usuarioAtual.uid);

  } catch (error) {
    console.error("Erro ao finalizar pedido:", error);
    el("checkout-status").textContent = "Erro ao processar pedido. Tente novamente.";
  } finally {
    el("btn-finalizar").disabled = false;
    el("btn-finalizar").textContent = "Finalizar Compra";
  }
}

// ==================== PIX DINÂMICO ====================
async function gerarPixDinamico(total, idPedido, cliente) {
  try {
    el("checkout-status").textContent = "Gerando PIX...";

    // Chamada ao backend para gerar PIX dinâmico
    const response = await fetch("http://localhost:3000/gerar-pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: total,
        descricao: `Pedido #${idPedido.slice(0, 8)} - Zuca Personalizados`,
        cliente: {
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          cpf: cliente.cpfCnpj.replace(/\D/g, "")
        }
      })
    });

    const data = await response.json();

    if (data.qr_code && data.brcode) {
      // Mostrar QR code
      const modalPix = document.createElement("div");
      modalPix.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      modalPix.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; max-width: 400px;">
          <h3>Escaneie o QR Code para pagar</h3>
          <img src="${data.qr_code}" alt="QR Code PIX" style="width: 240px; height: 240px; margin: 20px 0;">
          <p><strong>Ou copie a chave:</strong></p>
          <div style="background: #f0f0f0; padding: 10px; border-radius: 8px; margin: 10px 0; word-break: break-all; font-size: 0.85em;">
            ${data.brcode}
          </div>
          <button onclick="navigator.clipboard.writeText('${data.brcode}'); alert('Copiado!'); this.textContent = 'Copiado ✓';" style="background: #2f8d78; color: white; border: none; padding: 10px 20px; border-radius: 999px; cursor: pointer; margin: 10px 5px;">
            Copiar chave
          </button>
          <button onclick="this.parentElement.parentElement.remove();" style="background: #ddd; border: none; padding: 10px 20px; border-radius: 999px; cursor: pointer; margin: 10px 5px;">
            Fechar
          </button>
        </div>
      `;
      document.body.appendChild(modalPix);

      el("checkout-status").textContent = `✓ PIX gerado! Pedido #${idPedido.slice(0, 8)} - Valor: ${formatarMoeda(total)}`;
    } else {
      throw new Error("Falha ao gerar PIX");
    }

  } catch (error) {
    console.error("Erro ao gerar PIX:", error);
    el("checkout-status").textContent = "Erro ao gerar PIX. Tente novamente.";
  }
}

// ==================== MERCADO PAGO ====================
async function pagarComMercadoPago(total, idPedido, cliente) {
  try {
    el("checkout-status").textContent = "Processando pagamento...";

    // Chamar seu backend para processar com Mercado Pago
    const response = await fetch("http://localhost:3000/processar-pagamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: total,
        descricao: `Pedido #${idPedido.slice(0, 8)} - Zuca Personalizados`,
        cliente: {
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone
        },
        tarjeta: {
          numero: el("card-number")?.value || "",
          titular: el("card-name")?.value || "",
          vencimiento: el("card-expiry")?.value || "",
          cvc: el("card-cvv")?.value || ""
        }
      })
    });

    const data = await response.json();

    if (data.status === "approved") {
      el("checkout-status").textContent = `✓ Pagamento aprovado! Pedido #${idPedido.slice(0, 8)} processado com sucesso.`;
    } else if (data.status === "pending") {
      el("checkout-status").textContent = `⏳ Pagamento em análise. Você receberá confirmação em breve.`;
    } else {
      throw new Error(data.message || "Erro no pagamento");
    }

  } catch (error) {
    console.error("Erro ao processar cartão:", error);
    el("checkout-status").textContent = "Erro ao processar cartão. Verifique os dados e tente novamente.";
  }
}

// ==================== SELETOR DE MÉTODOS ====================
const seletorPagamento = el("pagamento");
if (seletorPagamento) {
  seletorPagamento.addEventListener("change", (e) => {
    document.querySelectorAll(".payment-option").forEach(el => el.classList.remove("active"));
    const secao = document.getElementById(e.target.value + "-section");
    if (secao) secao.classList.add("active");
  });
}

// Copiar PIX
el("btn-copiar-pix")?.addEventListener("click", () => {
  const brcode = el("pix-brcode").value;
  if (brcode) {
    navigator.clipboard.writeText(brcode);
    alert("Chave PIX copiada! 📋");
  }
});

// ==================== AUTH ====================
el("btn-google").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Erro ao entrar com Google:", error);
    alert("Erro ao fazer login com Google");
  }
});

el("btn-apple").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new OAuthProvider("apple.com"));
  } catch (error) {
    console.error("Erro ao entrar com Apple:", error);
    alert("Erro ao fazer login com Apple");
  }
});

el("btn-logout").addEventListener("click", async () => {
  await signOut(auth);
  el("checkout-status").textContent = "Desconectado com sucesso";
});

el("btn-aplicar-cupom").addEventListener("click", aplicarCupom);
el("btn-finalizar").addEventListener("click", finalizarPedido);

onAuthStateChanged(auth, async (user) => {
  usuarioAtual = user;

  if (!user) {
    el("auth-status").textContent = "Faça login para continuar.";
    return;
  }

  el("auth-status").textContent = `Logado como ${user.email || user.displayName || "cliente"}.`;
  el("email").value = user.email || "";
  await carregarPerfil(user.uid);
  await listarPedidos(user.uid);
});

renderCarrinho();
