const ORIGIN_BASE = window.location.origin.replace(/\/$/, "");

function normalizarUrlSemExtensao() {
  const path = window.location.pathname;
  const map = {
    "/index.html": "/",
    "/produto.html": "/produto",
    "/checkout.html": "/checkout",
    "/admin.html": "/admin",
  };

  const normalized = map[path];
  if (normalized) {
    window.history.replaceState({}, "", `${normalized}${window.location.search}${window.location.hash}`);
  }
}

normalizarUrlSemExtensao();

// Admin depende de cookie HttpOnly de sessao: manter sempre same-origin evita 401 por cross-domain.
const API_BASE = ORIGIN_BASE;
const API_BASES = [ORIGIN_BASE];

// Limpa override legado que possa forcar chamadas para outro dominio.
localStorage.removeItem("zuca_api_base_url");

function getApiUrl(path, base = API_BASE) {
  return `${base}${path}`;
}

async function fetchApi(path, options) {
  let lastResponse = null;
  let lastError = null;

  for (const base of API_BASES) {
    try {
      const response = await fetch(getApiUrl(path, base), options);
      if (response.ok) {
        if (base === ORIGIN_BASE && API_BASE !== ORIGIN_BASE) {
          localStorage.removeItem("zuca_api_base_url");
        }
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("Falha ao conectar com a API");
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

const formProduto = document.getElementById("form-produto");
const produtoStatusEl = document.getElementById("status");
const listaProdutosEl = document.getElementById("lista-produtos");
const btnNovoProduto = document.getElementById("btn-novo");
const btnExcluirProduto = document.getElementById("btn-excluir");
const inputProdutoId = document.getElementById("id");

const formCupom = document.getElementById("form-cupom");
const listaCuponsEl = document.getElementById("lista-cupons-admin");

let allOrders = [];
let allProducts = [];
let allCoupons = [];
let selectedProductId = null;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showLogin() {
  loginWrapper.style.display = "flex";
  adminWrapper.style.display = "none";
}

function showAdmin() {
  loginWrapper.style.display = "none";
  adminWrapper.style.display = "block";
}

function setLoginStatus(message, type = "") {
  loginStatusEl.className = type ? `status-box ${type}` : "status-box";
  loginStatusEl.textContent = message;
  loginStatusEl.style.display = message ? "block" : "none";
}

function setProdutoStatus(message, type = "") {
  if (!produtoStatusEl) return;
  produtoStatusEl.textContent = message;
  produtoStatusEl.style.color = type === "error" ? "#e74c3c" : type === "ok" ? "#1f8f4f" : "var(--text-secondary)";
}

function formatarData(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function resolveArquivoUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function detectarNomeArquivoPorUrl(url = "") {
  const semQuery = String(url).split("?")[0];
  const partes = semQuery.split("/").filter(Boolean);
  return partes[partes.length - 1] || "arquivo";
}

function getPedidoAnexos(pedido = {}) {
  const anexos = [];
  const vistos = new Set();

  const adicionar = (url, nome = "") => {
    const resolvida = resolveArquivoUrl(url);
    if (!resolvida) return;
    if (vistos.has(resolvida)) return;
    vistos.add(resolvida);
    anexos.push({
      url: resolvida,
      nome: String(nome || "").trim() || detectarNomeArquivoPorUrl(resolvida),
    });
  };

  const extrairRecursivo = (valor, nomeChave = "") => {
    if (!valor) return;

    if (typeof valor === "string") {
      const texto = valor.trim();
      if (!texto) return;
      if (/^https?:\/\//i.test(texto) || texto.startsWith("/upload") || texto.includes("storage.googleapis.com")) {
        adicionar(texto);
      }
      return;
    }

    if (Array.isArray(valor)) {
      valor.forEach((item) => extrairRecursivo(item, nomeChave));
      return;
    }

    if (typeof valor === "object") {
      Object.entries(valor).forEach(([chave, interno]) => {
        const chaveLower = String(chave || "").toLowerCase();
        const ehCampoArquivo = /(arquivo|anexo|upload|personaliz)/.test(chaveLower);

        if (typeof interno === "string" && ehCampoArquivo) {
          adicionar(interno, chaveLower.includes("nome") ? interno : "");
          return;
        }

        extrairRecursivo(interno, chaveLower);
      });
    }
  };

  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  itens.forEach((item) => {
    adicionar(item?.arquivoPersonalizacaoUrl, item?.arquivoPersonalizacaoNome);
    adicionar(item?.arquivoUrl, item?.arquivoNome);
    adicionar(item?.anexoUrl, item?.anexoNome);
    adicionar(item?.urlArquivo, item?.nomeArquivo);
    adicionar(item?.personalizacaoUrl, item?.personalizacaoNome);
    extrairRecursivo(item, "item");
  });

  extrairRecursivo(pedido, "pedido");
  return anexos;
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
    em_producao: "Em producao",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };
  return map[status] || status;
}

function getPaymentMethodLabel(method) {
  const map = {
    pix: "PIX",
    cartao: "Cartao",
    boleto: "Boleto",
    transferencia: "Transferencia",
    outro: "Outro",
  };
  return map[method] || method;
}

function parsePreco(preco = "") {
  const raw = String(preco).replace("R$", "").trim();
  const number = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function obterProdutoDoFormulario() {
  return {
    id: String(document.getElementById("id")?.value || "").trim(),
    nome: String(document.getElementById("nome")?.value || "").trim(),
    preco: String(document.getElementById("preco")?.value || "").trim(),
    estoque: Number(document.getElementById("estoque")?.value || 0),
    categoria: String(document.getElementById("categoria")?.value || "").trim(),
    tipo: String(document.getElementById("tipo")?.value || "").trim(),
    tamanho: String(document.getElementById("tamanho")?.value || "").trim(),
    gramatura: String(document.getElementById("gramatura")?.value || "").trim(),
    link: String(document.getElementById("link")?.value || "").trim(),
    imagens: String(document.getElementById("imagens")?.value || "")
      .split(",")
      .map((img) => img.trim())
      .filter(Boolean),
    descricaoCurta: String(document.getElementById("descricaoCurta")?.value || "").trim(),
    descricaoLonga: String(document.getElementById("descricaoLonga")?.value || "").trim(),
    personalizado: !!document.getElementById("personalizado")?.checked,
  };
}

function limparFormularioProduto() {
  if (!formProduto) return;
  formProduto.reset();
  selectedProductId = null;
  if (inputProdutoId) inputProdutoId.disabled = false;
  if (btnExcluirProduto) btnExcluirProduto.style.display = "none";
  setProdutoStatus("Pronto para cadastrar.");
}

function preencherFormularioProduto(produto) {
  document.getElementById("id").value = produto.id || "";
  document.getElementById("nome").value = produto.nome || "";
  document.getElementById("preco").value = produto.preco || "";
  document.getElementById("estoque").value = Number(produto.estoque || 0);
  document.getElementById("categoria").value = produto.categoria || "";
  document.getElementById("tipo").value = produto.tipo || "";
  document.getElementById("tamanho").value = produto.tamanho || "";
  document.getElementById("gramatura").value = produto.gramatura || "";
  document.getElementById("link").value = produto.link || "";
  document.getElementById("imagens").value = Array.isArray(produto.imagens) ? produto.imagens.join(", ") : "";
  document.getElementById("descricaoCurta").value = produto.descricaoCurta || "";
  document.getElementById("descricaoLonga").value = produto.descricaoLonga || "";
  document.getElementById("personalizado").checked = !!produto.personalizado;

  selectedProductId = produto.id;
  if (inputProdutoId) inputProdutoId.disabled = true;
  if (btnExcluirProduto) btnExcluirProduto.style.display = "inline-flex";
  setProdutoStatus(`Editando produto ${produto.id}.`);
}

function renderProdutos() {
  if (!listaProdutosEl) return;

  if (!allProducts.length) {
    listaProdutosEl.innerHTML = "<p>Nenhum produto cadastrado.</p>";
    return;
  }

  listaProdutosEl.innerHTML = allProducts.map((produto) => {
    const preco = parsePreco(produto.preco);
    return `
      <div class="item-card" data-produto-id="${escapeHtml(produto.id)}">
        <div class="item-title">${escapeHtml(produto.nome || "Produto")}</div>
        <div class="item-meta">ID: ${escapeHtml(produto.id)} | Preco: ${formatarMoeda(preco)} | Estoque: ${Number(produto.estoque || 0)}</div>
        <div class="item-meta">Categoria: ${escapeHtml(produto.categoria || "-")} | Tipo: ${escapeHtml(produto.tipo || "-")}</div>
        <div class="table-actions">
          <button class="btn btn-small btn-secondary" type="button" data-action="editar-produto">Editar</button>
          <button class="btn btn-small btn-danger" type="button" data-action="excluir-produto">Excluir</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderCupons() {
  if (!listaCuponsEl) return;

  if (!allCoupons.length) {
    listaCuponsEl.innerHTML = "<p>Nenhum cupom cadastrado.</p>";
    return;
  }

  listaCuponsEl.innerHTML = allCoupons.map((cupom) => {
    const sufixo = cupom.tipo === "percentual" ? "%" : "R$";
    return `
      <div class="item-card" data-cupom-codigo="${escapeHtml(cupom.codigo)}">
        <div class="item-title">${escapeHtml(cupom.codigo)}</div>
        <div class="item-meta">Tipo: ${escapeHtml(cupom.tipo || "-")} | Valor: ${escapeHtml(String(cupom.valor ?? 0))} ${sufixo}</div>
        <div class="table-actions">
          <button class="btn btn-small btn-danger" type="button" data-action="excluir-cupom">Excluir</button>
        </div>
      </div>
    `;
  }).join("");
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
    <div class="stat-card"><h3>Em Producao</h3><div class="value" style="color: #3498db;">${emProducao}</div></div>
    <div class="stat-card"><h3>Entregues</h3><div class="value" style="color: #1f8f4f;">${entregues}</div></div>
    <div class="stat-card"><h3>Renda Total</h3><div class="value">${formatarMoeda(totalRenda)}</div></div>
  `;
}

function exibirPedidos() {
  if (!pedidosList) return;

  const statusFiltro = filtroStatus?.value || "";
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
      <td>${escapeHtml(pedido.cliente?.nome || pedido.cliente?.email || "-")}</td>
      <td><strong>${formatarMoeda(pedido.total)}</strong></td>
      <td><span class="status-pill ${getStatusClass(pedido.statusPedido || pedido.status)}">${getStatusLabel(pedido.statusPedido || pedido.status)}</span></td>
      <td><span class="status-pill ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "Verificado" : "Pendente"}</span></td>
      <td>${formatarData(pedido.criadoEmISO)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-small btn-secondary" type="button" onclick="exibirDetalhes('${pedido.id}')">Ver</button>
          <button class="btn btn-small btn-secondary" type="button" onclick="editarStatus('${pedido.id}')">Editar</button>
          <button class="btn btn-small btn-primary" type="button" onclick="baixarAnexosPedido('${pedido.id}')" title="Abrir anexos do pedido">📎 Anexos</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function carregarPedidos() {
  const response = await fetchApi("/api/admin/pedidos", { credentials: "include" });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha ao carregar pedidos");
  }

  allOrders = payload.pedidos || [];

  // Debug: log pedidos com itens personalizados para diagnosticar anexos
  allOrders.forEach((p) => {
    const itensP = (p.itens || []).filter((i) => i.personalizado || i.arquivoPersonalizacaoUrl);
    if (itensP.length) {
      console.log(`[Admin] Pedido #${p.id.slice(0, 8)} — itens personalizados:`, itensP.map((i) => ({
        nome: i.nome,
        personalizado: i.personalizado,
        arquivoUrl: i.arquivoPersonalizacaoUrl || '(vazio)',
        arquivoNome: i.arquivoPersonalizacaoNome || '(vazio)',
      })));
    }
  });

  renderDashboard(payload.dashboard, allOrders);
  exibirPedidos();
}

async function carregarProdutos() {
  const response = await fetchApi("/api/admin/produtos", { credentials: "include" });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha ao carregar produtos");
  }

  allProducts = Array.isArray(payload.produtos) ? payload.produtos : [];
  renderProdutos();
}

async function carregarCupons() {
  const response = await fetchApi("/api/admin/cupons", { credentials: "include" });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha ao carregar cupons");
  }

  allCoupons = Array.isArray(payload.cupons) ? payload.cupons : [];
  renderCupons();
}

function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
}

function buildAnexosHtml(pedido) {
  const anexos = getPedidoAnexos(pedido);
  if (!anexos.length) {
    return `
      <div class="detail-item">
        <div class="detail-label">📎 Anexos de Personalização</div>
        <div style="font-size:13px; color: var(--muted);">Nenhum anexo identificado neste pedido.</div>
      </div>`;
  }

  const cards = anexos.map((anexo) => {
    const url = anexo.url;
    const nome = anexo.nome || "arquivo";
    const ehImagem = url && isImageUrl(url);

    return `
      <div class="anexo-card">
        ${ehImagem
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="anexo-preview">
               <img src="${escapeHtml(url)}" alt="Preview - ${escapeHtml(nome)}" />
             </a>`
          : `<div class="anexo-preview anexo-preview-pdf">
               <span style="font-size:32px;">📄</span>
               <span style="font-size:11px;color:var(--muted);">PDF</span>
             </div>`}
        <div class="anexo-info">
          <span class="anexo-produto">Arquivo do pedido</span>
          <span class="anexo-nome">${escapeHtml(nome)}</span>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" download="${escapeHtml(nome)}" class="btn btn-small btn-primary anexo-btn-download">⬇ Baixar arquivo</a>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="detail-item">
      <div class="detail-label">📎 Anexos de Personalização</div>
      <div class="anexos-grid">${cards}</div>
    </div>`;
}

window.exibirDetalhes = async (pedidoId) => {
  const pedido = allOrders.find((item) => item.id === pedidoId);
  if (!pedido) {
    alert("Pedido nao encontrado");
    return;
  }

  const itensHtml = (pedido.itens || []).map((item) => `
    <div class="item-row">
      <div>${escapeHtml(item.nome || "Produto")}</div>
      <div>${item.quantidade || 1}x</div>
      <div style="text-align:right;">${formatarMoeda(item.preco)}</div>
    </div>
  `).join("");

  const anexosHtml = buildAnexosHtml(pedido);

  modalBody.innerHTML = `
    <div class="detail-item"><div class="detail-label">ID Pedido</div><div>#${pedido.id.slice(0, 8)}</div></div>
    <div class="detail-item"><div class="detail-label">Cliente</div><div>${escapeHtml(pedido.cliente?.nome || "-")}<br/>${escapeHtml(pedido.cliente?.email || "")}<br/>${escapeHtml(pedido.cliente?.telefone || "")}</div></div>
    <div class="detail-item"><div class="detail-label">Metodo de pagto</div><div>${getPaymentMethodLabel(pedido.pagamento)}</div></div>
    <div class="detail-item"><div class="detail-label">Status Pag.</div><div><span class="status-pill ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "Verificado" : "Pendente"}</span></div></div>
    <div class="detail-item"><div class="detail-label">Itens</div><div><div class="items-list">${itensHtml || "<p>Sem itens</p>"}</div></div></div>
    ${anexosHtml}
    <div class="detail-item"><div class="detail-label">Total</div><div style="font-size:18px; font-weight:700;">${formatarMoeda(pedido.total)}</div></div>
    <div class="detail-item"><div class="detail-label">Criado em</div><div>${formatarData(pedido.criadoEmISO)}</div></div>
  `;

  document.getElementById("modal-title").textContent = `Pedido #${pedido.id.slice(0, 8)}`;
  detailsModal.classList.add("active");
};

window.baixarAnexosPedido = (pedidoId) => {
  const pedido = allOrders.find((item) => item.id === pedidoId);
  if (!pedido) {
    alert("Pedido nao encontrado");
    return;
  }

  const anexos = getPedidoAnexos(pedido);

  if (!anexos.length) {
    alert("Nao encontramos anexos para este pedido. Vou abrir os detalhes para verificacao.");
    exibirDetalhes(pedidoId);
    return;
  }

  anexos.forEach((anexo) => {
    const a = document.createElement("a");
    a.href = anexo.url;
    a.download = anexo.nome;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
};

window.editarStatus = async (pedidoId) => {
  const pedido = allOrders.find((item) => item.id === pedidoId);
  if (!pedido) {
    alert("Pedido nao encontrado");
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
          <option value="em_producao" ${pedido.statusPedido === "em_producao" ? "selected" : ""}>Em producao</option>
          <option value="enviado" ${pedido.statusPedido === "enviado" ? "selected" : ""}>Enviado</option>
          <option value="entregue" ${pedido.statusPedido === "entregue" ? "selected" : ""}>Entregue</option>
          <option value="cancelado" ${pedido.statusPedido === "cancelado" ? "selected" : ""}>Cancelado</option>
        </select>
      </div>
      <button id="btn-salvar-status" class="btn btn-primary" style="width:100%; margin-top:8px;" type="button">Salvar Mudancas</button>
    </div>
  `;

  document.getElementById("modal-title").textContent = `Editar #${pedido.id.slice(0, 8)}`;
  detailsModal.classList.add("active");

  document.getElementById("btn-salvar-status")?.addEventListener("click", async () => {
    try {
      const status = document.getElementById("select-status-pagto").value;
      const statusPedido = document.getElementById("select-status-pedido").value;

      const response = await fetchApi(`/api/admin/pedidos/${pedidoId}/status`, {
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

detailsModal?.addEventListener("click", (event) => {
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

filtroStatus?.addEventListener("change", exibirPedidos);
btnRecarregar?.addEventListener("click", async () => {
  try {
    btnRecarregar.disabled = true;
    btnRecarregar.textContent = "Carregando...";
    await carregarPedidos();
  } catch (error) {
    alert(`Erro: ${error.message}`);
  } finally {
    btnRecarregar.disabled = false;
    btnRecarregar.textContent = "Recarregar";
  }
});

btnEsqueciSenha?.addEventListener("click", () => {
  setLoginStatus("No modo backend-only, redefina a senha do admin via variavel ADMIN_PASSWORD no servidor.", "ok");
});

btnLogin?.addEventListener("click", async () => {
  try {
    const email = loginEmail.value.trim();
    const senha = loginSenha.value;

    if (!email || !senha) {
      setLoginStatus("Informe e-mail e senha.", "error");
      return;
    }

    const response = await fetchApi("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Credenciais invalidas");
    }

    showAdmin();
    userInfoEl.textContent = payload.user?.email || email;
    setLoginStatus("");

    await Promise.all([carregarPedidos(), carregarProdutos(), carregarCupons()]);
    limparFormularioProduto();
  } catch (error) {
    showLogin();
    setLoginStatus(error.message, "error");
  }
});

btnLogout?.addEventListener("click", async () => {
  await fetchApi("/api/admin/logout", { method: "POST", credentials: "include" });
  showLogin();
  setLoginStatus("Sessao encerrada.", "ok");
});

formProduto?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const produto = obterProdutoDoFormulario();
    if (!produto.id || !produto.nome) {
      setProdutoStatus("ID e nome sao obrigatorios.", "error");
      return;
    }

    const isEdicao = !!selectedProductId;
    const url = isEdicao ? `/api/admin/produtos/${encodeURIComponent(selectedProductId)}` : "/api/admin/produtos";
    const method = isEdicao ? "PUT" : "POST";

    const response = await fetchApi(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produto),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Falha ao salvar produto");
    }

    await carregarProdutos();
    if (isEdicao) {
      setProdutoStatus("Produto atualizado com sucesso.", "ok");
    } else {
      limparFormularioProduto();
      setProdutoStatus("Produto cadastrado com sucesso.", "ok");
    }
  } catch (error) {
    setProdutoStatus(error.message, "error");
  }
});

btnNovoProduto?.addEventListener("click", () => {
  limparFormularioProduto();
});

btnExcluirProduto?.addEventListener("click", async () => {
  if (!selectedProductId) return;

  const confirma = window.confirm(`Excluir produto ${selectedProductId}?`);
  if (!confirma) return;

  try {
    const response = await fetchApi(`/api/admin/produtos/${encodeURIComponent(selectedProductId)}`, {
      method: "DELETE",
      credentials: "include",
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Falha ao excluir produto");
    }

    await carregarProdutos();
    limparFormularioProduto();
    setProdutoStatus("Produto excluido com sucesso.", "ok");
  } catch (error) {
    setProdutoStatus(error.message, "error");
  }
});

listaProdutosEl?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const card = target.closest("[data-produto-id]");
  if (!card) return;

  const produtoId = card.getAttribute("data-produto-id");
  if (!produtoId) return;

  const produto = allProducts.find((item) => item.id === produtoId);
  if (!produto) return;

  if (target.dataset.action === "editar-produto") {
    preencherFormularioProduto(produto);
    return;
  }

  if (target.dataset.action === "excluir-produto") {
    selectedProductId = produto.id;
    if (btnExcluirProduto) btnExcluirProduto.style.display = "inline-flex";
    btnExcluirProduto?.click();
  }
});

formCupom?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const codigo = String(document.getElementById("cupom-codigo")?.value || "").trim().toUpperCase();
    const tipo = String(document.getElementById("cupom-tipo")?.value || "percentual");
    const valor = Number(document.getElementById("cupom-valor")?.value || 0);

    if (!codigo || !(valor > 0)) {
      alert("Informe codigo e valor valido para o cupom.");
      return;
    }

    const response = await fetchApi("/api/admin/cupons", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, tipo, valor }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Falha ao salvar cupom");
    }

    formCupom.reset();
    await carregarCupons();
    alert("Cupom salvo com sucesso.");
  } catch (error) {
    alert(`Erro ao salvar cupom: ${error.message}`);
  }
});

listaCuponsEl?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "excluir-cupom") return;

  const card = target.closest("[data-cupom-codigo]");
  const codigo = card?.getAttribute("data-cupom-codigo");
  if (!codigo) return;

  const confirma = window.confirm(`Excluir cupom ${codigo}?`);
  if (!confirma) return;

  try {
    const response = await fetchApi(`/api/admin/cupons/${encodeURIComponent(codigo)}`, {
      method: "DELETE",
      credentials: "include",
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Falha ao excluir cupom");
    }

    await carregarCupons();
  } catch (error) {
    alert(`Erro ao excluir cupom: ${error.message}`);
  }
});

async function bootstrap() {
  try {
    const response = await fetchApi("/api/admin/me", { credentials: "include" });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      showLogin();
      setLoginStatus("Faca login para acessar o painel.");
      return;
    }

    showAdmin();
    userInfoEl.textContent = payload.user?.email || "Admin";
    await Promise.all([carregarPedidos(), carregarProdutos(), carregarCupons()]);
    limparFormularioProduto();
  } catch {
    showLogin();
    setLoginStatus("Faca login para acessar o painel.");
  }
}

bootstrap();
