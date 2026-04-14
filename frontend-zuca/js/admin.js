import { db, auth } from "./firebase.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ADMIN_EMAILS = ["willianzucareli@gmail.com"];

// === DOM ELEMENTS ===
const loginWrapper = document.getElementById("login-wrapper");
const adminWrapper = document.getElementById("admin-wrapper");
const btnLogin = document.getElementById("btn-login");
const btnEsqueciSenha = document.getElementById("btn-esqueci-senha");
const btnLogout = document.getElementById("btn-logout");
const loginEmail = document.getElementById("login-email");
const loginSenha = document.getElementById("login-senha");
const loginStatusEl = document.getElementById("login-status");
const userInfoEl = document.getElementById("user-info");
const detailsModal = document.getElementById("details-modal");
const modalBody = document.getElementById("modal-body");
const dashboardStats = document.getElementById("dashboard-stats");
const pedidosList = document.getElementById("pedidos-list");
const filtroStatus = document.getElementById("filtro-status");
const btnRecarregar = document.getElementById("btn-recarregar-pedidos");

// === STATE ===
let currentUser = null;
let isAdminUser = false;
let allOrders = [];

// === AUTH HELPERS ===
function showLogin() {
  loginWrapper.style.display = "flex";
  adminWrapper.style.display = "none";
}

function showAdmin() {
  loginWrapper.style.display = "none";
  adminWrapper.style.display = "flex";
  adminWrapper.style.flexDirection = "column";
}

function setLoginStatus(message, type = "") {
  loginStatusEl.className = type ? `status-box ${type}` : "status-box";
  loginStatusEl.textContent = message;
  loginStatusEl.style.display = message ? "block" : "none";
}

function isEmailAdmin(user) {
  return user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

async function isClaimAdmin(user) {
  const tokenResult = await user.getIdTokenResult(true);
  return tokenResult?.claims?.admin === true;
}

async function validarPermissaoAdmin(user) {
  const byClaim = await isClaimAdmin(user);
  return byClaim || isEmailAdmin(user);
}

// === LOGIN HANDLERS ===
btnLogin.addEventListener("click", async () => {
  try {
    const email = loginEmail.value.trim();
    const senha = loginSenha.value;

    if (!email || !senha) {
      setLoginStatus("Informe e-mail e senha.", "error");
      return;
    }

    await signInWithEmailAndPassword(auth, email, senha);
  } catch (error) {
    console.error(error);
    setLoginStatus("Falha no login. Verifique e-mail e senha.", "error");
  }
});

btnEsqueciSenha.addEventListener("click", async () => {
  try {
    const email = loginEmail.value.trim();

    if (!email) {
      setLoginStatus("Digite seu e-mail para redefinir a senha.", "error");
      return;
    }

    await sendPasswordResetEmail(auth, email);
    setLoginStatus("Link de redefinição enviado para seu e-mail.", "ok");
  } catch (error) {
    console.error(error);
    setLoginStatus("Erro ao enviar link de redefinição.", "error");
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// === ORDER HELPERS ===
function formatarData(timestamp) {
  if (!timestamp) return "-";
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return data.toLocaleString("pt-BR");
}

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

function getStatusClass(status) {
  const map = {
    pendente: "pendente",
    pagto: "pagto",
    em_producao: "em_producao",
    enviado: "enviado",
    entregue: "entregue",
    cancelado: "cancelado"
  };
  return map[status] || "pendente";
}

function getStatusLabel(status) {
  const map = {
    pendente: "Pendente",
    pagto: "Pago",
    em_producao: "Em produção",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado"
  };
  return map[status] || status;
}

function getPaymentMethodLabel(method) {
  const map = {
    pix: "PIX",
    cartao: "Cartão",
    boleto: "Boleto",
    transferencia: "Transferência",
    outro: "Outro"
  };
  return map[method] || method;
}

// === DASHBOARD ===
async function atualizarDashboard() {
  try {
    const snapshot = await getDocs(collection(db, "pedidos"));
    const pedidos = snapshot.docs.map(d => d.data());

    const total = pedidos.length;
    const pendentes = pedidos.filter(p => p.status === "pendente").length;
    const emproducao = pedidos.filter(p => p.status === "em_producao").length;
    const entregues = pedidos.filter(p => p.status === "entregue").length;
    const totalRenda = pedidos.reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    dashboardStats.innerHTML = `
      <div class="stat-card"><h3>Total de Pedidos</h3><div class="value">${total}</div></div>
      <div class="stat-card"><h3>Pendentes</h3><div class="value" style="color: #f39c12;">${pendentes}</div></div>
      <div class="stat-card"><h3>Em Produção</h3><div class="value" style="color: #3498db;">${emproducao}</div></div>
      <div class="stat-card"><h3>Entregues</h3><div class="value" style="color: #1f8f4f;">${entregues}</div></div>
      <div class="stat-card"><h3>Renda Total</h3><div class="value">${formatarMoeda(totalRenda)}</div></div>
    `;
  } catch (error) {
    console.error("Erro ao atualizar dashboard:", error);
  }
}

// === ORDERS MANAGEMENT ===
async function carregarPedidos() {
  try {
    const q = query(collection(db, "pedidos"), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);
    allOrders = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    exibirPedidos();
  } catch (error) {
    console.error("Erro ao carregar pedidos:", error);
    pedidosList.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Erro ao carregar pedidos</td></tr>`;
  }
}

function exibirPedidos() {
  const statusFiltro = filtroStatus.value;
  const pedidosFiltrados = statusFiltro ? allOrders.filter(p => p.status === statusFiltro) : allOrders;

  if (pedidosFiltrados.length === 0) {
    pedidosList.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum pedido encontrado</td></tr>`;
    return;
  }

  pedidosList.innerHTML = pedidosFiltrados.map(pedido => `
    <tr>
      <td><strong>#${pedido.id.slice(0, 8)}</strong></td>
      <td>${pedido.cliente?.nome || pedido.cliente?.email || "-"}</td>
      <td><strong>${formatarMoeda(pedido.total)}</strong></td>
      <td><span class="status ${getStatusClass(pedido.status)}">${getStatusLabel(pedido.status)}</span></td>
      <td><span class="status ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "✓ Verificado" : "○ Pendente"}</span></td>
      <td>${formatarData(pedido.criadoEm)}</td>
      <td><div class="table-actions"><button class="btn btn-small btn-secondary" onclick="exibirDetalhes('${pedido.id}')">Ver</button><button class="btn btn-small btn-secondary" onclick="editarStatus('${pedido.id}')">Editar</button></div></td>
    </tr>
  `).join("");
}

window.exibirDetalhes = async (pedidoId) => {
  try {
    const pedido = allOrders.find(p => p.id === pedidoId);
    if (!pedido) { alert("Pedido não encontrado"); return; }

    const itensHtml = (pedido.itens || []).map(item => `<div class="item-row"><div>${item.nome}</div><div>${item.quantidade || 1}x</div><div style="text-align: right;">${formatarMoeda(item.preco)}</div></div>`).join("");

    modalBody.innerHTML = `
      <div class="detail-item"><div class="detail-label">ID Pedido</div><div class="detail-value">#${pedido.id.slice(0, 8)}</div></div>
      <div class="detail-item"><div class="detail-label">Cliente</div><div class="detail-value">${pedido.cliente?.nome || "-"}<br/>${pedido.cliente?.email || ""}<br/>${pedido.cliente?.telefone || ""}</div></div>
      <div class="detail-item"><div class="detail-label">Método de pago</div><div class="detail-value">${getPaymentMethodLabel(pedido.pagamento)}</div></div>
      <div class="detail-item"><div class="detail-label">Status Pag.</div><div class="detail-value"><span class="status ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "✓ Verificado" : "○ Pendente"}</span></div></div>
      <div class="detail-item"><div class="detail-label">Itens</div><div class="detail-value"><div class="items-list">${itensHtml || "<p>Sem itens</p>"}</div></div></div>
      <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-size: 18px; font-weight: 700;">${formatarMoeda(pedido.total)}</div></div>
      <div class="detail-item"><div class="detail-label">Criado em</div><div class="detail-value">${formatarData(pedido.criadoEm)}</div></div>
    `;
    abrirModal(`Pedido #${pedido.id.slice(0, 8)}`);
  } catch (error) {
    console.error("Erro ao exibir detalhes:", error);
    alert("Erro ao carregar detalhes do pedido");
  }
};

window.editarStatus = async (pedidoId) => {
  try {
    const pedido = allOrders.find(p => p.id === pedidoId);
    if (!pedido) { alert("Pedido não encontrado"); return; }

    modalBody.innerHTML = `
      <div style="display: grid; gap: 16px;">
        <div><label style="display: block; margin-bottom: 8px; font-weight: 700;">Status de Pagamento</label><select id="select-status-pagto" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; width: 100%;"><option value="pendente" ${pedido.status === "pendente" ? "selected" : ""}>Pendente</option><option value="pagto" ${pedido.status === "pagto" ? "selected" : ""}>Pagamento Verificado</option><option value="cancelado" ${pedido.status === "cancelado" ? "selected" : ""}>Cancelado</option></select></div>
        <div><label style="display: block; margin-bottom: 8px; font-weight: 700;">Status do Pedido</label><select id="select-status-pedido" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; width: 100%;"><option value="pendente" ${pedido.statusPedido === "pendente" ? "selected" : ""}>Pendente</option><option value="em_producao" ${pedido.statusPedido === "em_producao" ? "selected" : ""}>Em produção</option><option value="enviado" ${pedido.statusPedido === "enviado" ? "selected" : ""}>Enviado</option><option value="entregue" ${pedido.statusPedido === "entregue" ? "selected" : ""}>Entregue</option></select></div>
        <button id="btn-salvar-status" class="btn btn-primary" style="width: 100%; margin-top: 8px;">Salvar Mudanças</button>
      </div>
    `;

    document.getElementById("btn-salvar-status").addEventListener("click", async () => {
      try {
        const novoStatus = document.getElementById("select-status-pagto").value;
        const novoStatusPedido = document.getElementById("select-status-pedido").value;
        await updateDoc(doc(db, "pedidos", pedidoId), { status: novoStatus, statusPedido: novoStatusPedido, atualizadoEm: new Date().toISOString() });
        fecharModal();
        await carregarPedidos();
        await atualizarDashboard();
        alert("Status atualizado com sucesso!");
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Erro ao atualizar status");
      }
    });

    abrirModal(`Editar Status - Pedido #${pedido.id.slice(0, 8)}`);
  } catch (error) {
    console.error("Erro ao editar status:", error);
    alert("Erro ao editar status");
  }
};

// === MODAL FUNCTIONS ===
function abrirModal(titulo) {
  document.getElementById("modal-title").textContent = titulo;
  detailsModal.classList.add("active");
}

window.fecharModal = () => {
  detailsModal.classList.remove("active");
};

detailsModal.addEventListener("click", (e) => {
  if (e.target === detailsModal) window.fecharModal();
});

// === TAB SWITCHING ===
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");
  });
});

// === FILTER & REFRESH ===
filtroStatus.addEventListener("change", exibirPedidos);
btnRecarregar.addEventListener("click", async () => {
  btnRecarregar.disabled = true;
  btnRecarregar.textContent = "🔄 Carregando...";
  await carregarPedidos();
  await atualizarDashboard();
  btnRecarregar.disabled = false;
  btnRecarregar.textContent = "🔄 Recarregar";
});

// === AUTH STATE ===
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    isAdminUser = false;
    showLogin();
    setLoginStatus("Faça login para acessar o painel.");
    return;
  }

  try {
    isAdminUser = await validarPermissaoAdmin(user);
    if (!isAdminUser) {
      await signOut(auth);
      showLogin();
      setLoginStatus("Sem autorização de admin. Verifique ADMIN_EMAILS.", "error");
      return;
    }

    showAdmin();
    userInfoEl.textContent = `Olá, ${user.email}`;
    setLoginStatus("");
    await carregarPedidos();
    await atualizarDashboard();
  } catch (error) {
    console.error(error);
    await signOut(auth);
    showLogin();
    setLoginStatus("Erro ao validar permissões.", "error");
  }
});
