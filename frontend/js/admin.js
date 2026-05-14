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

// Garantir estado inicial da seção de modelo (por segurança contra cache de HTML antigo)
{
  const secao = document.getElementById("secao-modelo");
  if (secao) secao.style.display = "none";
  setTipoProdutoVisual("nenhum");
}

// ─── Helpers de tipo de produto ────────────────────────────────────────────
function getTipoProduto() {
  const radio = document.querySelector('input[name="tipoProduto"]:checked');
  return radio ? radio.value : "nenhum";
}

function setTipoProdutoVisual(valor) {
  document.querySelectorAll(".tipo-produto-opcao").forEach((el) => {
    const radio = el.querySelector("input[type=radio]");
    el.classList.toggle("selecionado", radio?.value === valor);
  });
  const radio = document.querySelector(`input[name="tipoProduto"][value="${valor}"]`);
  if (radio) radio.checked = true;
  const secaoPersonalizado = document.getElementById("secao-personalizado");
  if (secaoPersonalizado) secaoPersonalizado.style.display = valor === "personalizado" ? "flex" : "none";
  const secaoModelo = document.getElementById("secao-modelo");
  if (secaoModelo) secaoModelo.style.display = valor === "modelo" ? "flex" : "none";
}

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

function isPossivelUrlArquivo(value = "") {
  const texto = String(value || "").trim();
  if (!texto) return false;
  return /^https?:\/\//i.test(texto) || texto.startsWith("/upload") || texto.includes("storage.googleapis.com");
}

function getAdminDownloadUrl(url = "", nome = "") {
  const query = new URLSearchParams({
    url: String(url || ""),
    nome: String(nome || "arquivo"),
  });
  return getApiUrl(`/api/admin/anexos/download?${query.toString()}`);
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
    if (!isPossivelUrlArquivo(url)) return;
    const resolvida = resolveArquivoUrl(url);
    if (!resolvida) return;
    const chave = String(resolvida).split("?")[0].split("#")[0];
    if (vistos.has(chave)) return;
    vistos.add(chave);
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

        if (typeof interno === "string" && ehCampoArquivo && isPossivelUrlArquivo(interno)) {
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

function parseNumeroDecimal(value, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
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
    larguraCm: parseNumeroDecimal(document.getElementById("larguraCm")?.value, 15),
    comprimentoCm: parseNumeroDecimal(document.getElementById("comprimentoCm")?.value, 20),
    alturaCm: parseNumeroDecimal(document.getElementById("alturaCm")?.value, 2),
    pesoKg: parseNumeroDecimal(document.getElementById("pesoKg")?.value, 0.3),
    link: String(document.getElementById("link")?.value || "").trim(),
    imagens: String(document.getElementById("imagens")?.value || "")
      .split(",")
      .map((img) => img.trim())
      .filter(Boolean),
    descricaoCurta: String(document.getElementById("descricaoCurta")?.value || "").trim(),
    descricaoLonga: String(document.getElementById("descricaoLonga")?.value || "").trim(),
    personalizado: getTipoProduto() === "personalizado",
    instrucoesPersonalizacao: getTipoProduto() === "personalizado"
      ? String(document.getElementById("instrucoesPersonalizacao")?.value || "").trim() || undefined
      : undefined,
    ncm: String(document.getElementById("ncm")?.value || "").replace(/\D/g, "").slice(0, 8) || "48201010",
    ehModelo: getTipoProduto() === "modelo",
    modeloNome: String(document.getElementById("modeloNome")?.value || "").trim(),
    modeloConfig: (() => {
      if (getTipoProduto() !== "modelo") return undefined;
      const logoX = Number(document.getElementById("logoX")?.value || 0);
      const logoY = Number(document.getElementById("logoY")?.value || 0);
      const logoW = Number(document.getElementById("logoW")?.value || 0);
      const logoH = Number(document.getElementById("logoH")?.value || 0);
      if (logoX + logoW > 420 || logoY + logoH > 594) {
        setProdutoStatus("A zona da logo ultrapassa os limites do canvas (420×594 px). Ajuste os valores antes de salvar.", "error");
        return null;
      }
      const rawJson = String(document.getElementById("modeloCamposJson")?.value || "").trim();
      let campos = {};
      if (rawJson) {
        try { campos = JSON.parse(rawJson); } catch { campos = {}; }
      }
      const rawElementosJson = String(document.getElementById("modeloElementosJson")?.value || "").trim();
      let elementos = [];
      if (rawElementosJson) {
        try { elementos = JSON.parse(rawElementosJson); } catch { elementos = []; }
      }
      const fundoUrl = String(document.getElementById("modeloFundoUrl")?.value || "").trim();
      return { logoZone: { x: logoX, y: logoY, w: logoW, h: logoH }, campos, elementos, fundoUrl };
    })(),
  };
}

function limparFormularioProduto() {
  if (!formProduto) return;
  formProduto.reset();
  selectedProductId = null;
  if (inputProdutoId) inputProdutoId.disabled = false;
  if (btnExcluirProduto) btnExcluirProduto.style.display = "none";
  setTipoProdutoVisual("nenhum");
  // Limpeza explícita dos campos de tipo para garantir estado correto entre edições
  const camposModelo = ["modeloNome", "modeloFundoUrl", "logoX", "logoY", "logoW", "logoH", "modeloCamposJson", "modeloElementosJson"];
  camposModelo.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const prevFundo = document.getElementById("preview-fundo-modelo");
  if (prevFundo) { prevFundo.src = ""; prevFundo.style.display = "none"; }
  const instrucoesEl = document.getElementById("instrucoesPersonalizacao");
  if (instrucoesEl) instrucoesEl.value = "";
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
  document.getElementById("larguraCm").value = Number(produto.larguraCm || 15);
  document.getElementById("comprimentoCm").value = Number(produto.comprimentoCm || 20);
  document.getElementById("alturaCm").value = Number(produto.alturaCm || 2);
  document.getElementById("pesoKg").value = Number(produto.pesoKg || 0.3);
  document.getElementById("link").value = produto.link || "";
  document.getElementById("imagens").value = Array.isArray(produto.imagens) ? produto.imagens.join(", ") : "";
  document.getElementById("imagens")?.dispatchEvent(new Event("input"));
  document.getElementById("descricaoCurta").value = produto.descricaoCurta || "";
  document.getElementById("descricaoLonga").value = produto.descricaoLonga || "";
  const ncmEl = document.getElementById("ncm");
  if (ncmEl) ncmEl.value = produto.ncm || "";

  // Tipo do produto (radio buttons)
  const tipo = produto.ehModelo ? "modelo" : (produto.personalizado ? "personalizado" : "nenhum");
  setTipoProdutoVisual(tipo);
  if (produto.personalizado) {
    const instrucoesEl = document.getElementById("instrucoesPersonalizacao");
    if (instrucoesEl) instrucoesEl.value = produto.instrucoesPersonalizacao || "";
  }
  if (produto.ehModelo && produto.modeloConfig) {
    const { logoZone, campos } = produto.modeloConfig;
    if (document.getElementById("modeloNome")) document.getElementById("modeloNome").value = produto.modeloNome || "";
    if (logoZone) {
      if (document.getElementById("logoX")) document.getElementById("logoX").value = logoZone.x ?? "";
      if (document.getElementById("logoY")) document.getElementById("logoY").value = logoZone.y ?? "";
      if (document.getElementById("logoW")) document.getElementById("logoW").value = logoZone.w ?? "";
      if (document.getElementById("logoH")) document.getElementById("logoH").value = logoZone.h ?? "";
    }
    const jsonEl = document.getElementById("modeloCamposJson");
    if (jsonEl) jsonEl.value = campos ? JSON.stringify(campos, null, 2) : "";
    const elementosEl = document.getElementById("modeloElementosJson");
    if (elementosEl) {
      const elems = produto.modeloConfig.elementos;
      elementosEl.value = Array.isArray(elems) && elems.length ? JSON.stringify(elems, null, 2) : "";
    }
    const fundoUrlEl = document.getElementById("modeloFundoUrl");
    if (fundoUrlEl) fundoUrlEl.value = produto.modeloConfig.fundoUrl || "";
    const prevFundo = document.getElementById("preview-fundo-modelo");
    if (prevFundo && produto.modeloConfig.fundoUrl) {
      prevFundo.src = produto.modeloConfig.fundoUrl;
      prevFundo.style.display = "block";
    }
  }

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
    const tipoBadge = produto.ehModelo
      ? '<span style="background:#f5e9c0;color:#8a6a00;border:1px solid #c8a020;border-radius:4px;padding:1px 7px;font-size:0.75rem;font-weight:600;">📋 Modelo</span>'
      : produto.personalizado
        ? '<span style="background:#dbeafe;color:#1e40af;border:1px solid #3b82f6;border-radius:4px;padding:1px 7px;font-size:0.75rem;font-weight:600;">✏️ Personalizado</span>'
        : '<span style="background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;padding:1px 7px;font-size:0.75rem;font-weight:600;">🛍️ Simples</span>';
    const semImagem = !produto.imagens || !Array.isArray(produto.imagens) || produto.imagens.length === 0;
    const avisoImagem = (semImagem && produto.ehModelo)
      ? '<span style="color:#c0392b;font-size:0.78rem;margin-left:8px;">⚠️ sem imagem (não aparecerá na galeria)</span>'
      : '';
    return `
      <div class="item-card" data-produto-id="${escapeHtml(produto.id)}">
        <div class="item-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${escapeHtml(produto.nome || "Produto")} ${tipoBadge}${avisoImagem}</div>
        <div class="item-meta">ID: ${escapeHtml(produto.id)} | Preco: ${formatarMoeda(preco)} | Estoque: ${Number(produto.estoque || 0)}</div>
        <div class="item-meta">Categoria: ${escapeHtml(produto.categoria || "-")} | Tipo: ${escapeHtml(produto.tipo || "-")}</div>
        <div class="item-meta">Dimensões: ${Number(produto.larguraCm || 15)}x${Number(produto.comprimentoCm || 20)}x${Number(produto.alturaCm || 2)} cm | Peso: ${Number(produto.pesoKg || 0.3)} kg</div>
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
    pedidosList.innerHTML = "<tr><td colspan='8' style='text-align:center; padding:20px;'>Nenhum pedido encontrado</td></tr>";
    return;
  }

  pedidosList.innerHTML = pedidosFiltrados.map((pedido) => {
    const nf = pedido.notaFiscal;
    const nfStatus = nf?.status || "";
    let nfeBadge = "<span style='color:#9ca3af;font-size:11px;'>—</span>";
    if (nfStatus === "aprovado") {
      nfeBadge = `<span class="status-pill pagto" title="Chave: ${escapeHtml(nf.chaveAcesso || "")}">✔ Emitida</span>`;
    } else if (nfStatus === "processando") {
      nfeBadge = `<span class="status-pill pendente">⏳ Processando</span>`;
    } else if (nfStatus === "rejeitado" || nfStatus === "erro") {
      nfeBadge = `<span class="status-pill cancelado" title="${escapeHtml((nf.erros || []).join(" | "))}">✘ Rejeitada</span>`;
    }

    let nfeAcoes = "";
    if (pedido.status === "pagto" && nfStatus !== "aprovado" && nfStatus !== "processando") {
      nfeAcoes = `<button class="btn btn-small btn-primary" type="button" onclick="gerarNotaFiscal('${pedido.id}')" title="Emitir NF-e e enviar DANFE por e-mail">🧾 Gerar NF-e</button>`;
    }
    if (nfStatus === "aprovado") {
      nfeAcoes += nf.danfeUrl ? `<button class="btn btn-small btn-secondary" type="button" onclick="window.open('${escapeHtml(nf.danfeUrl)}','_blank')" title="Abrir DANFE">📄 DANFE</button>` : "";
      nfeAcoes += `<button class="btn btn-small btn-secondary" type="button" onclick="reenviarEmailNfe('${pedido.id}')" title="Reenviar DANFE por e-mail">📧 E-mail</button>`;
    }

    return `
    <tr>
      <td><strong>#${pedido.id.slice(0, 8)}</strong></td>
      <td>${escapeHtml(pedido.cliente?.nome || pedido.cliente?.email || "-")}</td>
      <td><strong>${formatarMoeda(pedido.total)}</strong></td>
      <td><span class="status-pill ${getStatusClass(pedido.statusPedido || pedido.status)}">${getStatusLabel(pedido.statusPedido || pedido.status)}</span></td>
      <td><span class="status-pill ${pedido.status === "pagto" ? "pagto" : "pendente"}">${pedido.status === "pagto" ? "Verificado" : "Pendente"}</span></td>
      <td>${nfeBadge}${nfeAcoes ? `<div style="margin-top:4px;">${nfeAcoes}</div>` : ""}</td>
      <td>${formatarData(pedido.criadoEmISO)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-small btn-secondary" type="button" onclick="exibirDetalhes('${pedido.id}')">Ver</button>
          <button class="btn btn-small btn-secondary" type="button" onclick="editarStatus('${pedido.id}')">Editar</button>
          <button class="btn btn-small btn-secondary" type="button" onclick="editarRastreio('${pedido.id}')" title="Código de rastreio">🚚 Rastreio</button>
          <button class="btn btn-small btn-primary" type="button" onclick="baixarAnexosPedido('${pedido.id}')" title="Abrir anexos do pedido">📎 Anexos</button>
        </div>
      </td>
    </tr>
    `;
  }).join("");
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
          <a href="${escapeHtml(getAdminDownloadUrl(url, nome))}" class="btn btn-small btn-primary anexo-btn-download">⬇ Baixar arquivo</a>
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
    a.href = getAdminDownloadUrl(anexo.url, anexo.nome);
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

      <div style="border:1px solid var(--border-color); border-radius:10px; padding:14px; background:var(--bg-primary);">
        <p style="margin:0 0 12px; font-weight:700; font-size:14px;">📦 Código de Rastreio</p>
        <div style="display:grid; gap:10px;">
          <div>
            <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:600;">Código de Rastreio</label>
            <input id="input-rastreio" type="text" value="${escapeHtml(pedido.codigoRastreio || "")}"
              placeholder="Ex: AA123456789BR ou ID Melhor Envio"
              style="padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; width:100%; text-transform:uppercase; font-family:monospace; letter-spacing:1px;" />
          </div>
          <div>
            <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:600;">Transportadora</label>
            <select id="select-transportadora" style="padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; width:100%;">
              <option value="">— Selecione —</option>
              <option value="Correios" ${(pedido.transportadora || "") === "Correios" ? "selected" : ""}>Correios</option>
              <option value="Jadlog" ${(pedido.transportadora || "") === "Jadlog" ? "selected" : ""}>Jadlog</option>
              <option value="Total Express" ${(pedido.transportadora || "") === "Total Express" ? "selected" : ""}>Total Express</option>
              <option value="Azul Cargo" ${(pedido.transportadora || "") === "Azul Cargo" ? "selected" : ""}>Azul Cargo</option>
              <option value="Loggi" ${(pedido.transportadora || "") === "Loggi" ? "selected" : ""}>Loggi</option>
              <option value="Melhor Envio" ${(pedido.transportadora || "") === "Melhor Envio" ? "selected" : ""}>Melhor Envio</option>
              <option value="Outro" ${(pedido.transportadora || "") === "Outro" ? "selected" : ""}>Outro</option>
            </select>
          </div>
          <p style="margin:0; font-size:12px; color:var(--text-secondary);">
            💡 Ao salvar com código preenchido, o status do pedido avança para <strong>Enviado</strong> automaticamente
            e o cliente poderá acompanhar em <em>Minha Conta</em>.
          </p>
        </div>
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
      const codigoRastreio = String(document.getElementById("input-rastreio")?.value || "").trim().toUpperCase();
      const transportadora = String(document.getElementById("select-transportadora")?.value || "").trim();

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

      // Salva código de rastreio se informado (ou limpa se apagado)
      if (codigoRastreio || pedido.codigoRastreio) {
        const rastreioResp = await fetchApi(`/api/admin/pedidos/${pedidoId}/rastreio`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigoRastreio, transportadora }),
        });
        const rastreioPayload = await rastreioResp.json();
        if (!rastreioResp.ok || !rastreioPayload.success) {
          throw new Error(rastreioPayload.error || "Falha ao salvar rastreio");
        }
      }

      detailsModal.classList.remove("active");
      await carregarPedidos();
      alert("Status atualizado com sucesso");
    } catch (error) {
      alert(`Erro ao atualizar: ${error.message}`);
    }
  });
};

window.editarRastreio = async (pedidoId) => {
  const pedido = allOrders.find((item) => item.id === pedidoId);
  if (!pedido) {
    alert("Pedido nao encontrado");
    return;
  }

  modalBody.innerHTML = `
    <div style="display:grid; gap:16px;">
      <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text-secondary);">
        Pedido <strong>#${escapeHtml(pedido.id.slice(0, 8))}</strong> ·
        ${escapeHtml(pedido.cliente?.nome || pedido.cliente?.email || "-")} ·
        <span class="status-pill ${getStatusClass(pedido.statusPedido || pedido.status)}" style="font-size:11px;">${getStatusLabel(pedido.statusPedido || pedido.status)}</span>
      </div>

      <div>
        <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:700;">Código de Rastreio</label>
        <input id="rastreio-codigo" type="text" value="${escapeHtml(pedido.codigoRastreio || "")}"
          placeholder="Ex: AA123456789BR ou ID Melhor Envio"
          style="padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; width:100%; box-sizing:border-box; text-transform:uppercase; font-family:monospace; letter-spacing:1px; font-size:14px;" />
      </div>

      <div>
        <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:700;">Transportadora</label>
        <select id="rastreio-transportadora" style="padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; width:100%; box-sizing:border-box;">
          <option value="">— Selecione —</option>
          <option value="Correios" ${(pedido.transportadora || "") === "Correios" ? "selected" : ""}>Correios</option>
          <option value="Jadlog" ${(pedido.transportadora || "") === "Jadlog" ? "selected" : ""}>Jadlog</option>
          <option value="Total Express" ${(pedido.transportadora || "") === "Total Express" ? "selected" : ""}>Total Express</option>
          <option value="Azul Cargo" ${(pedido.transportadora || "") === "Azul Cargo" ? "selected" : ""}>Azul Cargo</option>
          <option value="Loggi" ${(pedido.transportadora || "") === "Loggi" ? "selected" : ""}>Loggi</option>
          <option value="Melhor Envio" ${(pedido.transportadora || "") === "Melhor Envio" ? "selected" : ""}>Melhor Envio</option>
          <option value="Outro" ${(pedido.transportadora || "") === "Outro" ? "selected" : ""}>Outro</option>
        </select>
      </div>

      <p style="margin:0; font-size:12px; color:var(--text-secondary);">
        💡 Ao salvar com código preenchido, o status avança para <strong>Enviado</strong> automaticamente e o cliente verá o rastreio em <em>Minha Conta</em>.
      </p>

      <button id="btn-salvar-rastreio" class="btn btn-primary" style="width:100%;" type="button">💾 Salvar Rastreio</button>
    </div>
  `;

  document.getElementById("modal-title").textContent = `🚚 Rastreio · #${pedido.id.slice(0, 8)}`;
  detailsModal.classList.add("active");

  document.getElementById("btn-salvar-rastreio")?.addEventListener("click", async () => {
    try {
      const codigoRastreio = String(document.getElementById("rastreio-codigo")?.value || "").trim().toUpperCase();
      const transportadora = String(document.getElementById("rastreio-transportadora")?.value || "").trim();

      const resp = await fetchApi(`/api/admin/pedidos/${pedidoId}/rastreio`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoRastreio, transportadora }),
      });
      const payload = await resp.json();
      if (!resp.ok || !payload.success) {
        throw new Error(payload.error || "Falha ao salvar rastreio");
      }

      detailsModal.classList.remove("active");
      await carregarPedidos();
      alert(`Rastreio salvo! ${codigoRastreio ? `Código: ${codigoRastreio}` : "Código removido."}`);
    } catch (error) {
      alert(`Erro: ${error.message}`);
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

// Radio buttons do tipo de produto — usa apenas o evento change (nativo e confiável)
document.querySelectorAll('input[name="tipoProduto"]').forEach((radio) => {
  radio.addEventListener("change", () => setTipoProdutoVisual(radio.value));
});

// Upload de imagem do produto
(function () {
  const inputUpload = document.getElementById("upload-imagem-produto");
  const inputImagens = document.getElementById("imagens");
  const statusEl = document.getElementById("upload-imagem-status");
  const previewEl = document.getElementById("upload-imagem-preview");

  function atualizarPreview() {
    if (!previewEl || !inputImagens) return;
    const urls = String(inputImagens.value || "").split(",").map((u) => u.trim()).filter(Boolean);
    previewEl.innerHTML = urls.map((url) => `
      <div style="position:relative; display:inline-block;">
        <img src="${escapeHtml(url)}" alt="preview" style="width:72px; height:72px; object-fit:cover; border-radius:6px; border:1px solid #ddd;"
          onerror="this.style.opacity='0.3';" />
      </div>`).join("");
  }

  inputImagens?.addEventListener("input", atualizarPreview);

  inputUpload?.addEventListener("change", async () => {
    const file = inputUpload.files[0];
    if (!file) return;
    statusEl.textContent = "⏳ Enviando...";
    statusEl.style.color = "#666";
    try {
      const formData = new FormData();
      formData.append("arquivo", file);
      const resp = await fetch(getApiUrl("/upload"), { method: "POST", body: formData });
      const payload = await resp.json();
      if (!resp.ok || !payload.url) throw new Error(payload.erro || "Falha no upload");
      const atual = String(inputImagens.value || "").trim();
      inputImagens.value = atual ? atual + ", " + payload.url : payload.url;
      statusEl.textContent = "✅ Imagem adicionada!";
      statusEl.style.color = "#1f8f4f";
      atualizarPreview();
    } catch (err) {
      statusEl.textContent = "❌ Erro: " + err.message;
      statusEl.style.color = "#e74c3c";
    } finally {
      inputUpload.value = "";
    }
  });

  // Atualizar preview ao carregar produto existente
  const obs = new MutationObserver(atualizarPreview);
  if (inputImagens) obs.observe(inputImagens, { attributes: false, childList: false, characterData: true, subtree: true });
})();

// Upload de imagem de fundo do modelo
(function () {
  const inputFundo = document.getElementById("upload-fundo-modelo");
  const inputUrl   = document.getElementById("modeloFundoUrl");
  const statusEl   = document.getElementById("upload-fundo-status");
  const preview    = document.getElementById("preview-fundo-modelo");

  inputUrl?.addEventListener("input", () => {
    const url = String(inputUrl.value || "").trim();
    if (preview) { preview.src = url; preview.style.display = url ? "block" : "none"; }
  });

  inputFundo?.addEventListener("change", async () => {
    const file = inputFundo.files[0];
    if (!file) return;
    statusEl.textContent = "⏳ Enviando...";
    statusEl.style.color = "#666";
    try {
      const formData = new FormData();
      formData.append("arquivo", file);
      const resp = await fetch(getApiUrl("/upload"), { method: "POST", body: formData });
      const payload = await resp.json();
      if (!resp.ok || !payload.url) throw new Error(payload.erro || "Falha no upload");
      if (inputUrl) inputUrl.value = payload.url;
      if (preview) { preview.src = payload.url; preview.style.display = "block"; }
      statusEl.textContent = "✅ Fundo enviado!";
      statusEl.style.color = "#1f8f4f";
    } catch (err) {
      statusEl.textContent = "❌ Erro: " + err.message;
      statusEl.style.color = "#e74c3c";
    } finally {
      inputFundo.value = "";
    }
  });
})();

// Inserir template JSON de campos de modelo
document.getElementById("btn-modelo-template")?.addEventListener("click", () => {
  const jsonEl = document.getElementById("modeloCamposJson");
  if (!jsonEl) return;
  const template = {
    nome:          { x: 210, y: 120, fontSize: 11, color: "#c8a020", align: "center", maxWidth: 290, fontWeight: "700", fontFamily: "Playfair Display" },
    especialidade: { x: 210, y: 135, fontSize:  9, color: "#b09020", align: "center", maxWidth: 290, fontWeight: "400", fontFamily: "Montserrat" },
    telefone:      { x: 156, y: 504, fontSize:  9, color: "#c8a020", align: "center", maxWidth: 115, fontWeight: "400", fontFamily: "Montserrat" },
    email:         { x: 280, y: 504, fontSize:  9, color: "#c8a020", align: "center", maxWidth: 135, fontWeight: "400", fontFamily: "Montserrat" },
    endereco:      { x: 225, y: 548, fontSize:  9, color: "#c8a020", align: "center", maxWidth: 255, fontWeight: "400", fontFamily: "Montserrat" },
    instagram:     { x: 210, y: 573, fontSize:  9, color: "#c8a020", align: "center", maxWidth: 255, fontWeight: "400", fontFamily: "Montserrat" },
  };
  jsonEl.value = JSON.stringify(template, null, 2);
});

// Inserir exemplo JSON de elementos decorativos
document.getElementById("btn-modelo-elementos-template")?.addEventListener("click", () => {
  const el = document.getElementById("modeloElementosJson");
  if (!el) return;
  const exemplo = [
    { tipo: "faixa", x: 0, y: 478, largura: 420, altura: 28, cor: "#c8a020", editavelPeloCliente: true, labelCliente: "Cor do destaque" },
    { tipo: "icone", icone: "telefone", x: 50,  y: 492, tamanho: 14, cor: "#ffffff" },
    { tipo: "icone", icone: "email",    x: 175, y: 492, tamanho: 14, cor: "#ffffff" },
    { tipo: "icone", icone: "localizacao", x: 300, y: 492, tamanho: 14, cor: "#ffffff" },
    { tipo: "linha", x: 20, y: 540, comprimento: 380, espessura: 0.5, cor: "#c8a020", editavelPeloCliente: true, labelCliente: "Cor da linha" },
  ];
  el.value = JSON.stringify(exemplo, null, 2);
});

// ─── Paths SVG dos ícones (mesmos de produto.js) ──────────────────────────────
const ICONE_PATHS_ADMIN = {
  whatsapp:    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  instagram:   "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  email:       "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  localizacao: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  telefone:    "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
};

// ─── Pré-visualização do modelo no admin ──────────────────────────────────────
document.getElementById("btn-admin-preview-modelo")?.addEventListener("click", async () => {
  const canvas = document.getElementById("admin-modelo-canvas");
  const msg    = document.getElementById("admin-preview-msg");
  if (!canvas) return;

  const W = 420, H = 594;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  canvas.style.display = "block";
  msg.textContent = "Carregando...";

  // 1. Imagem de fundo
  const fundoUrl = String(document.getElementById("modeloFundoUrl")?.value || "").trim();
  if (fundoUrl) {
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = fundoUrl;
      });
      ctx.drawImage(img, 0, 0, W, H);
    } catch {
      msg.textContent = "⚠️ Não foi possível carregar a imagem de fundo.";
    }
  }

  // 2. Elementos decorativos
  const rawElem = String(document.getElementById("modeloElementosJson")?.value || "").trim();
  let elementos = [];
  if (rawElem) {
    try {
      const parsed = JSON.parse(rawElem);
      elementos = Array.isArray(parsed) ? parsed : [];
    } catch {
      msg.textContent = "⚠️ JSON de elementos inválido — corrija os colchetes [ ].";
      return;
    }
  }

  elementos.forEach((el) => {
    ctx.save();
    ctx.globalAlpha = el.opacidade ?? 1;
    if (el.tipo === "faixa") {
      ctx.fillStyle = el.cor || "#c8a020";
      ctx.fillRect(el.x ?? 0, el.y ?? 0, el.largura ?? W, el.altura ?? 20);
    } else if (el.tipo === "linha") {
      ctx.strokeStyle = el.cor || "#c8a020";
      ctx.lineWidth = el.espessura ?? 1;
      ctx.beginPath();
      if ((el.orientacao || "h") === "v") {
        ctx.moveTo(el.x ?? 0, el.y ?? 0);
        ctx.lineTo(el.x ?? 0, (el.y ?? 0) + (el.comprimento ?? H));
      } else {
        ctx.moveTo(el.x ?? 0, el.y ?? 0);
        ctx.lineTo((el.x ?? 0) + (el.comprimento ?? W), el.y ?? 0);
      }
      ctx.stroke();
    } else if (el.tipo === "circulo") {
      ctx.fillStyle = el.cor || "#c8a020";
      ctx.beginPath();
      ctx.arc(el.x ?? 0, el.y ?? 0, el.raio ?? 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (el.tipo === "icone") {
      const pathData = ICONE_PATHS_ADMIN[el.icone];
      if (pathData) {
        const s = (el.tamanho ?? 12) / 24;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate((el.x ?? 0) - (el.tamanho ?? 12) / 2, (el.y ?? 0) - (el.tamanho ?? 12) / 2);
        ctx.scale(s, s);
        ctx.fillStyle = el.cor || "#333";
        ctx.fill(new Path2D(pathData));
        ctx.restore();
      }
    }
    ctx.restore();
  });

  // 3. Posições dos campos como texto dimmed
  const rawCampos = String(document.getElementById("modeloCamposJson")?.value || "").trim();
  if (rawCampos) {
    try {
      const campos = JSON.parse(rawCampos);
      Object.entries(campos).forEach(([key, cfg]) => {
        if (cfg.x == null || cfg.y == null) return;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.font = `${cfg.fontWeight === "700" ? "bold" : "normal"} ${cfg.fontSize || 10}px ${cfg.fontFamily || "sans-serif"}`;
        ctx.fillStyle = cfg.color || "#888";
        ctx.textAlign = cfg.align || "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`[${key}]`, cfg.x, cfg.y);
        ctx.restore();
      });
    } catch { /* ignora erro no preview */ }
  }

  // 4. Logo zone como retângulo tracejado azul
  const logoX = Number(document.getElementById("logoX")?.value || 0);
  const logoY = Number(document.getElementById("logoY")?.value || 0);
  const logoW = Number(document.getElementById("logoW")?.value || 0);
  const logoH = Number(document.getElementById("logoH")?.value || 0);
  if (logoW > 0 && logoH > 0) {
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(logoX, logoY, logoW, logoH);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(logoX, logoY, logoW, logoH);
    ctx.restore();
  }

  msg.textContent = `✅ ${elementos.length} elemento(s) — canvas 420×594 lógico`;
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
    // modeloConfig retorna null quando os limites do canvas são inválidos
    if (produto.ehModelo && produto.modeloConfig === null) return;

    // Validar JSON dos campos de modelo
    if (produto.ehModelo) {
      const rawJson = String(document.getElementById("modeloCamposJson")?.value || "").trim();
      if (rawJson) {
        try { JSON.parse(rawJson); } catch {
          setProdutoStatus("JSON dos campos do modelo é inválido. Corrija antes de salvar.", "error");
          return;
        }
      }
      // Validar JSON dos elementos decorativos
      const rawElemJson = String(document.getElementById("modeloElementosJson")?.value || "").trim();
      if (rawElemJson) {
        try {
          const parsed = JSON.parse(rawElemJson);
          if (!Array.isArray(parsed)) {
            setProdutoStatus("Elementos decorativos: deve ser um array JSON (começa com [ e termina com ]).", "error");
            return;
          }
        } catch {
          setProdutoStatus("JSON dos elementos decorativos é inválido. Verifique se o array está envolvido em [ ].", "error");
          return;
        }
      }
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

// ─── NF-e ────────────────────────────────────────────────────────────────────

function abrirModalNfe(html) {
  const modal = document.getElementById("nfe-modal");
  const body = document.getElementById("nfe-modal-body");
  if (!modal || !body) return;
  body.innerHTML = html;
  modal.style.display = "flex";
  modal.classList.add("active");
}

window.fecharModalNfe = function () {
  const modal = document.getElementById("nfe-modal");
  if (!modal) return;
  modal.style.display = "none";
  modal.classList.remove("active");
};

window.gerarNotaFiscal = async function (pedidoId) {
  abrirModalNfe(`
    <div style="text-align:center;padding:32px 0;">
      <div style="font-size:32px;margin-bottom:16px;">⏳</div>
      <p style="font-size:15px;color:#374151;font-weight:600;">Emitindo Nota Fiscal...</p>
      <p style="font-size:13px;color:#6b7280;">Aguarde enquanto a SEFAZ processa a emissão.<br>Isso pode levar até 40 segundos.</p>
    </div>
  `);

  try {
    const resp = await fetchApi(`/api/admin/pedidos/${pedidoId}/nota-fiscal`, {
      method: "POST",
      credentials: "include",
    });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.success) {
      const msg = escapeHtml(data.error || "Erro desconhecido");
      abrirModalNfe(`
        <div style="text-align:center;padding:32px 0;">
          <div style="font-size:36px;margin-bottom:16px;">❌</div>
          <p style="font-size:15px;color:#dc2626;font-weight:600;">Falha na emissão</p>
          <p style="font-size:13px;color:#374151;margin:12px 0;">${msg}</p>
          ${(data.erros || []).map((e) => `<p style="font-size:12px;color:#6b7280;">${escapeHtml(e)}</p>`).join("")}
          <button class="btn btn-secondary" style="margin-top:16px;" onclick="fecharModalNfe()">Fechar</button>
        </div>
      `);
      return;
    }

    const chave = escapeHtml(data.chaveAcesso || "");
    const numero = escapeHtml(data.numero || "");
    const emailMsg = data.emailEnviado
      ? `<p style="font-size:13px;color:#16a34a;margin-top:8px;">✅ DANFE enviada por e-mail ao cliente.</p>`
      : `<p style="font-size:13px;color:#f59e0b;margin-top:8px;">⚠️ E-mail não enviado: ${escapeHtml(data.emailErro || "verifique as configurações SMTP")}.</p>`;

    abrirModalNfe(`
      <div style="text-align:center;padding:24px 0 8px;">
        <div style="font-size:36px;margin-bottom:12px;">✅</div>
        <p style="font-size:16px;color:#16a34a;font-weight:700;">NF-e emitida com sucesso!</p>
      </div>
      <table style="width:100%;font-size:13px;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Número / Série</td><td style="color:#111827;font-weight:600;">${numero} / ${escapeHtml(data.serie || "1")}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Chave de Acesso</td><td style="color:#374151;font-family:monospace;word-break:break-all;font-size:11px;">${chave}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td><span class="status-pill pagto">Aprovada</span></td></tr>
      </table>
      ${emailMsg}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap;">
        ${data.danfeUrl ? `<a href="${escapeHtml(data.danfeUrl)}" target="_blank" class="btn btn-secondary">📄 Abrir DANFE</a>` : ""}
        <button class="btn btn-secondary" onclick="reenviarEmailNfe('${pedidoId}')">📧 Reenviar E-mail</button>
        <button class="btn btn-primary" onclick="fecharModalNfe();carregarPedidos();">Fechar</button>
      </div>
    `);
  } catch (err) {
    abrirModalNfe(`
      <div style="text-align:center;padding:32px 0;">
        <div style="font-size:36px;margin-bottom:16px;">❌</div>
        <p style="font-size:15px;color:#dc2626;font-weight:600;">Erro de conexão</p>
        <p style="font-size:13px;color:#374151;">${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary" style="margin-top:16px;" onclick="fecharModalNfe()">Fechar</button>
      </div>
    `);
  }
};

window.reenviarEmailNfe = async function (pedidoId) {
  const body = document.getElementById("nfe-modal-body");
  const prevHtml = body?.innerHTML || "";

  if (body) {
    body.innerHTML += `<p id="msg-reenvio" style="font-size:13px;color:#6b7280;margin-top:8px;">⏳ Reenviando e-mail...</p>`;
  }

  try {
    const resp = await fetchApi(`/api/admin/pedidos/${pedidoId}/nota-fiscal/reenviar-email`, {
      method: "POST",
      credentials: "include",
    });
    const data = await resp.json().catch(() => ({}));

    const msgEl = document.getElementById("msg-reenvio");
    if (msgEl) {
      if (data.success) {
        msgEl.style.color = "#16a34a";
        msgEl.textContent = "✅ E-mail reenviado com sucesso!";
      } else {
        msgEl.style.color = "#dc2626";
        msgEl.textContent = `❌ ${data.error || "Falha ao reenviar"}`;
      }
    }
  } catch (err) {
    const msgEl = document.getElementById("msg-reenvio");
    if (msgEl) { msgEl.style.color = "#dc2626"; msgEl.textContent = `❌ ${err.message}`; }
  }
};

// Fecha modal NF-e ao clicar fora
document.getElementById("nfe-modal")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("nfe-modal")) fecharModalNfe();
});

// ─────────────────────────────────────────────────────────────────────────────
