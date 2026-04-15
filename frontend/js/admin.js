const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

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

let allOrders = [];

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

function formatarData(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
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
    cancelado: "cancelado",
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
    cancelado: "Cancelado",
  };
  return map[status] || status;
}

function getPaymentMethodLabel(method) {
  const map = {
    pix: "PIX",
    cartao: "Cartão",
    boleto: "Boleto",
    transferencia: "Transferência",
    outro: "Outro",
  };
  return map[method] || method;
}

function renderDashboard(dashboard, pedidos) {
  const total = dashboard?.total ?? pedidos.length;
  const pendentes = dashboard?.pendente ?? pedidos.filter((p) => p.status === "pendente").length;
  const emProducao = dashboard?.em_producao ?? pedidos.filter((p) => p.statusPedido === "em_producao").length;
  const entregues = dashboard?.entregue ?? pedidos.filter((p) => p.statusPedido === "entregue").length;
  const totalRenda = dashboard?.totalRenda ?? pedidos.reduce((sum, p) => sum + Number(p.total || 0), 0);

  dashboardStats.innerHTML = `
    <div class="stat-card"><h3>Total de Pedidos</h3><div class="value">${total}</div></div>
    <div class="stat-card"><h3>Pendentes</h3><div class="value" style="color: #f39c12;">${pendentes}</div></div>
    <div class="stat-card"><h3>Em Produção</h3><div class="value" style="color: #3498db;">${emProducao}</div></div>
    <div class="stat-card"><h3>Entregues</h3><div class="value" style="color: #1f8f4f;">${entregues}</div></div>
    <div class="stat-card"><h3>Renda Total</h3><div class="value">${formatarMoeda(totalRenda)}</div></div>
  `;
}

function exibirPedidos() {
  const statusFiltro = filtroStatus.value;
  const pedidosFiltrados = statusFiltro
    ? allOrders.filter((p) => p.status === statusFiltro || p.statusPedido === statusFiltro)
    : allOrders;

  if (!pedidosFiltrados.length) {
    pedidosList.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:20px;'>Nenhum pedido encontrado</td></tr>";
    return;
  }

  pedidosList.innerHTML = pedidosFiltrados.map((pedido) => `
    <tr>
      <td><strong>#${pedido.id.slice(0, 8)}</strong></td>
      <td>${pedido.cliente?.nome || pedido.cliente?.email || "-"}</td>
      <td><strong>${formatarMoeda(pedido.total)}</strong></td>
      <td><span class="status ${getStatusClass(pedido.statusPedido || pedido.status)}">${getStatusLabel(pedido.statusPedido || pedido.status)}</span></td>
      <td><span class="status ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "✓ Verificado" : "○ Pendente"}</span></td>
      <td>${formatarData(pedido.criadoEmISO)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-small btn-secondary" onclick="exibirDetalhes('${pedido.id}')">Ver</button>
          <button class="btn btn-small btn-secondary" onclick="editarStatus('${pedido.id}')">Editar</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function carregarPedidos() {
  const response = await fetch(getApiUrl("/api/admin/pedidos"), { credentials: "include" });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha ao carregar pedidos");
  }

  allOrders = payload.pedidos || [];
  renderDashboard(payload.dashboard, allOrders);
  exibirPedidos();
}

window.exibirDetalhes = async (pedidoId) => {
  const pedido = allOrders.find((item) => item.id === pedidoId);
  if (!pedido) {
    alert("Pedido não encontrado");
    return;
  }

  const itensHtml = (pedido.itens || []).map((item) => `
    <div class="item-row">
      <div>${item.nome}</div>
      <div>${item.quantidade || 1}x</div>
      <div style="text-align:right;">${formatarMoeda(item.preco)}</div>
    </div>
  `).join("");

  modalBody.innerHTML = `
    <div class="detail-item"><div class="detail-label">ID Pedido</div><div class="detail-value">#${pedido.id.slice(0, 8)}</div></div>
    <div class="detail-item"><div class="detail-label">Cliente</div><div class="detail-value">${pedido.cliente?.nome || "-"}<br/>${pedido.cliente?.email || ""}<br/>${pedido.cliente?.telefone || ""}</div></div>
    <div class="detail-item"><div class="detail-label">Método de pago</div><div class="detail-value">${getPaymentMethodLabel(pedido.pagamento)}</div></div>
    <div class="detail-item"><div class="detail-label">Status Pag.</div><div class="detail-value"><span class="status ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "✓ Verificado" : "○ Pendente"}</span></div></div>
    <div class="detail-item"><div class="detail-label">Itens</div><div class="detail-value"><div class="items-list">${itensHtml || "<p>Sem itens</p>"}</div></div></div>
    <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-size:18px; font-weight:700;">${formatarMoeda(pedido.total)}</div></div>
    <div class="detail-item"><div class="detail-label">Criado em</div><div class="detail-value">${formatarData(pedido.criadoEmISO)}</div></div>
  `;

  document.getElementById("modal-title").textContent = `Pedido #${pedido.id.slice(0, 8)}`;
  detailsModal.classList.add("active");
};

window.editarStatus = async (pedidoId) => {
  const pedido = allOrders.find((item) => item.id === pedidoId);
  if (!pedido) {
    alert("Pedido não encontrado");
    return;
  }

  modalBody.innerHTML = `
    <div style="display:grid; gap:16px;">
      <div>
        <label style="display:block; margin-bottom:8px; font-weight:700;">Status de Pagamento</label>
        <select id="select-status-pagto" style="padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; width:100%;">
          <option value="pendente" ${pedido.status === "pendente" ? "selected" : ""}>Pendente</option>
          <option value="pagto" ${pedido.status === "pagto" ? "selected" : ""}>Pagamento Verificado</option>
          <option value="cancelado" ${pedido.status === "cancelado" ? "selected" : ""}>Cancelado</option>
        </select>
      </div>
      <div>
        <label style="display:block; margin-bottom:8px; font-weight:700;">Status do Pedido</label>
        <select id="select-status-pedido" style="padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; width:100%;">
          <option value="pendente" ${(pedido.statusPedido || "pendente") === "pendente" ? "selected" : ""}>Pendente</option>
          <option value="em_producao" ${pedido.statusPedido === "em_producao" ? "selected" : ""}>Em produção</option>
          <option value="enviado" ${pedido.statusPedido === "enviado" ? "selected" : ""}>Enviado</option>
          <option value="entregue" ${pedido.statusPedido === "entregue" ? "selected" : ""}>Entregue</option>
          <option value="cancelado" ${pedido.statusPedido === "cancelado" ? "selected" : ""}>Cancelado</option>
        </select>
      </div>
      <button id="btn-salvar-status" class="btn btn-primary" style="width:100%; margin-top:8px;">Salvar Mudanças</button>
    </div>
  `;

  document.getElementById("modal-title").textContent = `Editar #${pedido.id.slice(0, 8)}`;
  detailsModal.classList.add("active");

  document.getElementById("btn-salvar-status")?.addEventListener("click", async () => {
    try {
      const status = document.getElementById("select-status-pagto").value;
      const statusPedido = document.getElementById("select-status-pedido").value;

      const response = await fetch(getApiUrl(`/api/admin/pedidos/${pedidoId}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, statusPedido }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Falha ao atualizar");
      }

      detailsModal.classList.remove("active");
      await carregarPedidos();
      alert("Status atualizado com sucesso");
    } catch (error) {
      alert(`Erro ao atualizar: ${error.message}`);
    }
  });
};

window.fecharModal = () => {
  detailsModal.classList.remove("active");
};

detailsModal.addEventListener("click", (event) => {
  if (event.target === detailsModal) {
    window.fecharModal();
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tabName}-tab`)?.classList.add("active");
  });
});

filtroStatus.addEventListener("change", exibirPedidos);
btnRecarregar.addEventListener("click", async () => {
  try {
    btnRecarregar.disabled = true;
    btnRecarregar.textContent = "🔄 Carregando...";
    await carregarPedidos();
  } catch (error) {
    alert(`Erro: ${error.message}`);
  } finally {
    btnRecarregar.disabled = false;
    btnRecarregar.textContent = "🔄 Recarregar";
  }
});

btnEsqueciSenha.addEventListener("click", () => {
  setLoginStatus("No modo backend-only, redefina a senha do admin via variável ADMIN_PASSWORD no servidor.", "ok");
});

btnLogin.addEventListener("click", async () => {
  try {
    const email = loginEmail.value.trim();
    const senha = loginSenha.value;

    if (!email || !senha) {
      setLoginStatus("Informe e-mail e senha.", "error");
      return;
    }

    const response = await fetch(getApiUrl("/api/admin/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Credenciais inválidas");
    }

    showAdmin();
    userInfoEl.textContent = payload.user?.email || email;
    setLoginStatus("");
    await carregarPedidos();
  } catch (error) {
    showLogin();
    setLoginStatus(error.message, "error");
  }
});

btnLogout.addEventListener("click", async () => {
  await fetch(getApiUrl("/api/admin/logout"), { method: "POST", credentials: "include" });
  showLogin();
  setLoginStatus("Sessão encerrada.", "ok");
});

async function bootstrap() {
  try {
    const response = await fetch(getApiUrl("/api/admin/me"), { credentials: "include" });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      showLogin();
      setLoginStatus("Faça login para acessar o painel.");
      return;
    }

    showAdmin();
    userInfoEl.textContent = payload.user?.email || "Admin";
    await carregarPedidos();
  } catch {
    showLogin();
    setLoginStatus("Faça login para acessar o painel.");
  }
}

bootstrap();
