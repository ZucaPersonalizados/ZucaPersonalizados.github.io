const el = (id) => document.getElementById(id);

const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23e8dbcb'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23b59273'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23b59273'/%3E%3C/svg%3E";

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

/* ========== Toast Notification System ========== */
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  const toast = document.createElement("div");
  toast.className = `toast is-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Fechar">✕</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
  `;

  const close = () => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector(".toast-close").addEventListener("click", close);
  container.appendChild(toast);
  const timer = setTimeout(close, duration);
  toast.addEventListener("mouseenter", () => clearTimeout(timer));
  toast.addEventListener("mouseleave", () => setTimeout(close, 1500));
}

function obterAvatarHeader() {
  return localStorage.getItem("zuca_avatar_url") || DEFAULT_AVATAR;
}

function getUsuarioLogado() {
  try {
    const perfil = JSON.parse(localStorage.getItem("zuca_perfil") || "{}");
    const checkout = JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}");
    const nome = (perfil.nome || checkout.nome || "").trim();
    const email = (perfil.email || checkout.email || "").trim().toLowerCase();
    if (!nome && !email) return null;
    return {
      nome,
      email,
      primeiroNome: nome.split(" ")[0] || "Olá",
      avatar: localStorage.getItem("zuca_avatar_url") || DEFAULT_AVATAR,
    };
  } catch { return null; }
}

function limparSessaoUsuario() {
  ["zuca_checkout_cliente", "zuca_perfil", "zuca_avatar_url", "zuca_checkout_cliente_nome"].forEach(
    (k) => localStorage.removeItem(k)
  );
}

function atualizarMenuUsuario() {
  const btnAvatar = document.getElementById("btn-avatar");
  const dropdown = document.getElementById("avatar-dropdown");
  const avatarImg = document.getElementById("avatar-image");
  if (!btnAvatar || !dropdown) return;

  const usuario = getUsuarioLogado();

  if (usuario) {
    btnAvatar.classList.remove("nao-logado");
    const labelEl = btnAvatar.querySelector(".avatar-btn-label");
    if (labelEl) labelEl.remove();
    if (avatarImg) { avatarImg.src = usuario.avatar; avatarImg.style.display = ""; }
  } else {
    btnAvatar.classList.add("nao-logado");
    if (avatarImg) avatarImg.style.display = "none";
    if (!btnAvatar.querySelector(".avatar-btn-label")) {
      const span = document.createElement("span");
      span.className = "avatar-btn-label";
      span.style.cssText = "display:flex;align-items:center;gap:6px;pointer-events:none;";
      span.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg><span style="font-size:.875rem;font-weight:700;">Entrar</span>`;
      btnAvatar.appendChild(span);
    }
  }

  if (usuario) {
    dropdown.innerHTML = `
      <div class="avatar-dd-header">
        <img class="avatar-dd-foto" src="${escapeHtml(usuario.avatar)}" alt="" onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="avatar-dd-info">
          <div class="avatar-dd-nome">${escapeHtml(usuario.primeiroNome)}</div>
          ${usuario.email ? `<div class="avatar-dd-email">${escapeHtml(usuario.email)}</div>` : ""}
        </div>
      </div>
      <div class="avatar-dd-lista">
        <a class="avatar-dd-item" href="/minha-conta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Minha conta
        </a>
        <a class="avatar-dd-item" href="/minha-conta#pedidos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
          Meus pedidos
        </a>
        <div class="avatar-dd-divider"></div>
        <button class="avatar-dd-item sair" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </div>`;

  } else {
    dropdown.innerHTML = `
      <div class="avatar-dd-promo">
        <p>Faça login para ver seus pedidos e salvar seus dados.</p>
        <a class="avatar-dd-btn-entrar" href="/minha-conta">Entrar</a>
      </div>
      <div class="avatar-dd-lista">
        <a class="avatar-dd-item" href="/minha-conta#pedidos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
          Meus pedidos
        </a>
      </div>`;
  }
}

function normalizarUrlSemExtensao() {
  const path = window.location.pathname;
  const map = {
    "/index.html": "/",
    "/produto.html": "/produto",
    "/checkout.html": "/checkout",
    "/minha-conta.html": "/minha-conta",
    "/admin.html": "/admin",
  };

  const normalized = map[path];
  if (normalized) {
    window.history.replaceState({}, "", `${normalized}${window.location.search}${window.location.hash}`);
  }
}

let descontoAtual = 0;
let cupomAplicado = null;
let mpConfigCache = null;
let monitorPagamentoTimer = null;
let freteAtual = {
  valor: 0,
  servico: "",
  prazoDias: null,
};
let freteOpcoes = [];

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatarCpfCnpj(value = "") {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(value = "") {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function formatarCep(value = "") {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function setCheckoutStatus(message, type = "info") {
  const box = el("checkout-status");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("is-info", "is-success", "is-error");
  if (type === "success") box.classList.add("is-success");
  else if (type === "error") box.classList.add("is-error");
  else box.classList.add("is-info");
}

function showInlineActionStatus(anchorEl, message, type = "info") {
  if (!(anchorEl instanceof Element)) return;

  let feedback = anchorEl.nextElementSibling;
  if (!(feedback instanceof HTMLElement) || !feedback.classList.contains("action-feedback")) {
    feedback = document.createElement("div");
    feedback.className = "action-feedback";
    anchorEl.insertAdjacentElement("afterend", feedback);
  }

  feedback.textContent = message;
  feedback.classList.remove("is-info", "is-success", "is-error");
  feedback.classList.add(type === "success" ? "is-success" : type === "error" ? "is-error" : "is-info");
}

function setActionFeedback(message, type = "info", anchorEl = null) {
  setCheckoutStatus(message, type);
  if (anchorEl) showInlineActionStatus(anchorEl, message, type);
}

async function obterConfigMercadoPago(forceRefresh = false) {
  if (!forceRefresh && mpConfigCache) {
    return mpConfigCache;
  }

  try {
    const response = await fetch(getApiUrl("/config-mercadopago"));
    const payload = await response.json();
    mpConfigCache = {
      configured: !!payload?.configured,
      pixConfigured: !!payload?.pixConfigured,
      cardConfigured: !!payload?.cardConfigured,
      publicKey: payload?.publicKey || null,
    };
    return mpConfigCache;
  } catch {
    return null;
  }
}

const getCarrinho = () => {
  try {
    return JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  } catch {
    return [];
  }
};

const formatarMoeda = (v) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const precoNumero = (p) => {
  const raw = String(p ?? "0").replace(/\s/g, "").replace("R$", "").trim();
  if (!raw) return 0;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  if (hasComma) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  if (hasDot) {
    const parts = raw.split(".");
    const isDecimal = parts.length === 2 && parts[1].length <= 2;
    const normalized = isDecimal ? raw : raw.replace(/\./g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
};

function isCepValido(value = "") {
  return digitsOnly(value).length === 8;
}

function atualizarResumo(subtotal) {
  const total = Math.max(0, subtotal - descontoAtual + Number(freteAtual.valor || 0));
  if (el("subtotal")) el("subtotal").textContent = formatarMoeda(subtotal);
  if (el("desconto")) el("desconto").textContent = formatarMoeda(descontoAtual);
  if (el("frete")) el("frete").textContent = freteAtual.valor === 0 && freteAtual.servico ? "GRÁTIS" : formatarMoeda(freteAtual.valor || 0);
  if (el("frete-prazo-resumo")) {
    el("frete-prazo-resumo").textContent = freteAtual.prazoDias ? `(${freteAtual.prazoDias} dias úteis)` : "";
  }
  if (el("total-final")) el("total-final").textContent = formatarMoeda(total);
  if (el("total-carrinho")) el("total-carrinho").textContent = formatarMoeda(total);

  // Installments info
  const parcelasEl = el("parcelas-resumo");
  if (parcelasEl) {
    if (total >= 100) {
      const parcelas = Math.min(12, Math.floor(total / 50));
      const valorParcela = (total / parcelas).toFixed(2).replace(".", ",");
      parcelasEl.textContent = `ou até ${parcelas}x de R$ ${valorParcela} sem juros no cartão`;
    } else {
      parcelasEl.textContent = "";
    }
  }
}

function salvarDadosClienteLocal() {
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
  };

  localStorage.setItem("zuca_checkout_cliente", JSON.stringify(dados));
  if (dados.nome) {
    localStorage.setItem("zuca_checkout_cliente_nome", dados.nome.split(" ")[0]);
  }

  return dados;
}

function carregarDadosClienteLocal() {
  try {
    const raw = localStorage.getItem("zuca_checkout_cliente");
    if (raw) {
      const dados = JSON.parse(raw);
      Object.entries(dados).forEach(([key, value]) => {
        if (el(key)) el(key).value = value || "";
      });
    }
    // Also load saved address
    const endRaw = localStorage.getItem("zuca_endereco");
    if (endRaw) {
      const end = JSON.parse(endRaw);
      if (end.cep && el("cep") && !el("cep").value) el("cep").value = end.cep;
      if (end.endereco && el("endereco") && !el("endereco").value) el("endereco").value = end.endereco;
      if (end.numero && el("numero") && !el("numero").value) el("numero").value = end.numero;
      if (end.bairro && el("bairro") && !el("bairro").value) el("bairro").value = end.bairro;
      if (end.cidade && el("cidade") && !el("cidade").value) el("cidade").value = end.cidade;
      if (end.estado && el("estado") && !el("estado").value) el("estado").value = end.estado;
    }
  } catch {
    // noop
  }
}

function obterSubtotal() {
  return getCarrinho().reduce((acc, item) => acc + precoNumero(item.preco) * Number(item.quantidade || 1), 0);
}

function renderCarrinho() {
  const itens = getCarrinho();
  const container = el("lista-carrinho");
  const totalEl = el("total-carrinho");

  if (!container || !totalEl) return;

  if (itens.length === 0) {
    container.innerHTML = "<p style='color:#999;font-size:14px;'>Seu carrinho está vazio.</p>";
    freteAtual = { valor: 0, servico: "", prazoDias: null };
    atualizarResumo(0);
    return;
  }

  let subtotal = 0;
  container.innerHTML = "";

  itens.forEach((item) => {
    const subtotalItem = precoNumero(item.preco) * Number(item.quantidade || 1);
    subtotal += subtotalItem;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>
        <strong>${escapeHtml(item.nome)}</strong><br/>
        <small>x${item.quantidade || 1}</small>
      </span>
      <strong>${formatarMoeda(subtotalItem)}</strong>
    `;
    container.appendChild(div);
  });

  atualizarResumo(subtotal);

  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();
}

async function preencherEnderecoPorCep(cep) {
  const cepLimpo = digitsOnly(cep).slice(0, 8);
  if (cepLimpo.length !== 8) return;

  try {
    const response = await fetch(getApiUrl(`/api/cep/${cepLimpo}`));
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "CEP nao encontrado");
    }

    if (el("endereco") && !el("endereco").value.trim()) el("endereco").value = payload.logradouro || "";
    if (el("bairro") && !el("bairro").value.trim()) el("bairro").value = payload.bairro || "";
    if (el("cidade") && !el("cidade").value.trim()) el("cidade").value = payload.localidade || "";
    if (el("estado") && !el("estado").value.trim()) el("estado").value = payload.uf || "";
    salvarDadosClienteLocal();
  } catch {
    // Nao bloqueia checkout quando o CEP falhar.
  }
}

async function recalcularFrete() {
  const cep = el("cep")?.value || "";
  const freteContainer = el("frete-options");

  if (!isCepValido(cep)) {
    freteAtual = { valor: 0, servico: "", prazoDias: null };
    if (freteContainer) freteContainer.innerHTML = "";
    atualizarResumo(obterSubtotal());
    return;
  }

  if (freteContainer) {
    freteContainer.innerHTML = `<div class="frete-loading"><div class="spinner"></div>Calculando frete...</div>`;
  }

  try {
    const itens = getCarrinho().map((item) => ({
      id: item.id,
      nome: item.nome,
      preco: precoNumero(item.preco),
      quantidade: Number(item.quantidade || 1),
    }));

    const url = new URL(getApiUrl("/api/frete/calcular"));
    url.searchParams.set("cep", digitsOnly(cep));
    url.searchParams.set("itens", JSON.stringify(itens));

    const response = await fetch(url.toString());
    const payload = await response.json();
    if (!response.ok || !payload.success || !Array.isArray(payload.options) || !payload.options.length) {
      throw new Error(payload.error || "Nao foi possivel calcular o frete");
    }

    freteOpcoes = payload.options;

    // Pre-select cheapest
    const maisBarata = [...freteOpcoes].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
    freteAtual = {
      valor: Number(maisBarata.price || 0),
      servico: String(`${maisBarata.service || "Entrega"} - ${maisBarata.company || "Transportadora"}`),
      prazoDias: Number(maisBarata.delivery_time || 0) || null,
    };

    renderFreteOptions(freteOpcoes, maisBarata.id || 0);
    atualizarResumo(obterSubtotal());
    showToast("Frete calculado com sucesso!", "success");
  } catch {
    freteAtual = { valor: 0, servico: "", prazoDias: null };
    freteOpcoes = [];
    if (freteContainer) freteContainer.innerHTML = `<p style="color: var(--accent-rose); font-size: 0.85rem;">Não foi possível calcular o frete. Verifique o CEP.</p>`;
    atualizarResumo(obterSubtotal());
  }
}

function renderFreteOptions(opcoes, selectedId) {
  const container = el("frete-options");
  if (!container) return;

  container.innerHTML = opcoes.map((opcao, i) => {
    const isSelected = opcao.id === selectedId || (i === 0 && !selectedId);
    const precoDisplay = opcao.freteGratis
      ? `<span class="frete-option-price gratis">GRÁTIS</span>`
      : `<span class="frete-option-price">R$ ${Number(opcao.price || 0).toFixed(2).replace(".", ",")}</span>`;

    return `
      <label class="frete-option ${isSelected ? "selected" : ""}" data-frete-idx="${i}">
        <input type="radio" name="frete-radio" value="${i}" ${isSelected ? "checked" : ""}>
        <div class="frete-option-info">
          <div class="frete-option-name">
            ${escapeHtml(opcao.company || "Transportadora")}
            ${opcao.freteGratis ? ' <span class="frete-badge-gratis">Frete Grátis</span>' : ""}
          </div>
          <div class="frete-option-prazo">Serviço: ${escapeHtml(opcao.service || "Entrega")}</div>
          <div class="frete-option-prazo">Receba em até ${Number(opcao.delivery_time) || "?"} dias úteis</div>
        </div>
        ${precoDisplay}
      </label>
    `;
  }).join("");

  container.querySelectorAll("input[name='frete-radio']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const idx = Number(radio.value);
      const opcao = freteOpcoes[idx];
      if (!opcao) return;

      freteAtual = {
        valor: Number(opcao.price || 0),
        servico: String(`${opcao.service || "Entrega"} - ${opcao.company || "Transportadora"}`),
        prazoDias: Number(opcao.delivery_time || 0) || null,
      };

      container.querySelectorAll(".frete-option").forEach((el) => el.classList.remove("selected"));
      radio.closest(".frete-option")?.classList.add("selected");
      atualizarResumo(obterSubtotal());
    });
  });
}

function atualizarContadorCarrinho() {
  const count = getCarrinho().reduce((acc, item) => acc + Number(item.quantidade || 1), 0);
  const cartCount = el("cart-count");
  if (cartCount) cartCount.textContent = String(count);
}

function renderizarCarrinhoSidebar() {
  const container = el("cart-sidebar-items");
  const totalEl = el("cart-sidebar-total");
  if (!container || !totalEl) return;

  const itens = getCarrinho();
  if (!itens.length) {
    container.innerHTML = "<p style='text-align:center; color: var(--muted); padding: 20px;'>Seu carrinho está vazio.</p>";
    totalEl.textContent = "R$ 0,00";
    return;
  }

  let total = 0;
  container.innerHTML = itens.map((item) => {
    const subtotal = precoNumero(item.preco) * Number(item.quantidade || 1);
    total += subtotal;
    return `
      <div class="cart-item">
        <div>
          <p class="cart-item-name">${escapeHtml(item.nome || "Produto")}</p>
          <p class="cart-item-price">x${item.quantidade || 1}</p>
        </div>
        <strong>${formatarMoeda(subtotal)}</strong>
      </div>
    `;
  }).join("");

  totalEl.textContent = formatarMoeda(total);
}

function abrirCarrinhoSidebar() {
  el("cart-sidebar")?.classList.add("ativo");
  el("cart-overlay")?.classList.add("ativo");
}

function fecharCarrinhoSidebar() {
  el("cart-sidebar")?.classList.remove("ativo");
  el("cart-overlay")?.classList.remove("ativo");
}

async function aplicarCupom() {
  const anchorEl = el("btn-aplicar-cupom");
  const cupom = el("cupom")?.value.trim().toUpperCase();
  if (!cupom) {
    setActionFeedback("Informe um cupom.", "info", anchorEl);
    return;
  }

  try {
    const response = await fetch(getApiUrl("/api/cupons/aplicar"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: cupom, subtotal: obterSubtotal() }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      descontoAtual = 0;
      cupomAplicado = null;
      renderCarrinho();
      setActionFeedback(payload.error || "Cupom invalido.", "error", anchorEl);
      return;
    }

    descontoAtual = Number(payload.desconto || 0);
    cupomAplicado = cupom;
    renderCarrinho();
    setActionFeedback(`Cupom aplicado: -${formatarMoeda(descontoAtual)}`, "success", anchorEl);
  } catch (error) {
    setActionFeedback(`Erro ao validar cupom: ${error.message}`, "error", anchorEl);
  }
}

async function listarPedidosPorEmail(email) {
  const container = el("lista-pedidos");
  if (!container || !email) return;

  try {
    const response = await fetch(getApiUrl(`/api/pedidos?email=${encodeURIComponent(email)}`));
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      container.innerHTML = "<p>Não foi possível carregar seus pedidos.</p>";
      return;
    }

    if (!payload.pedidos?.length) {
      container.innerHTML = "<p>Nenhum pedido ainda.</p>";
      return;
    }

    container.innerHTML = payload.pedidos.map((pedido) => {
      const status = String(pedido.status || "pendente");
      const statusLabel = status === "pagto" ? "Pago" : "Pendente";
      const statusClass = status === "pagto" ? "is-paid" : "is-pending";
      const pagamento = String(pedido.pagamento || "pix").toLowerCase();
      const pagamentoLabel = pagamento === "cartao"
        ? "Cartao"
        : pagamento === "boleto"
          ? "Boleto"
          : "PIX";

      return `
      <div class="pedido-item ${statusClass}">
        <div class="pedido-top">
          <span class="pedido-id">#${pedido.id.slice(0, 8)}</span>
          <span class="pedido-status">${statusLabel}</span>
        </div>
        <small>Pagamento: ${pagamentoLabel}</small>
        <div class="pedido-total">${formatarMoeda(pedido.total || 0)}</div>
        ${status !== "pagto" ? `
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="checkout-btn secondary btn-pagar-pendente" data-pedido-id="${pedido.id}" data-pagamento="${pagamento}">Pagar agora</button>
            <button type="button" class="checkout-btn secondary btn-verificar-pendente" data-pedido-id="${pedido.id}">Verificar pagamento</button>
          </div>
        ` : ""}
      </div>
    `;
    }).join("");

    container.querySelectorAll(".btn-pagar-pendente").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pedidoId = btn.getAttribute("data-pedido-id") || "";
        const pagamento = btn.getAttribute("data-pagamento") || "pix";
        pagarPedidoPendente(pedidoId, pagamento, email, btn);
      });
    });

    container.querySelectorAll(".btn-verificar-pendente").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pedidoId = btn.getAttribute("data-pedido-id") || "";
        if (!pedidoId) return;
        const verificacao = await verificarPagamento(pedidoId);
        setActionFeedback(
          verificacao.aprovado
            ? `Pagamento confirmado para o pedido #${pedidoId.slice(0, 8)}.`
            : (verificacao.payload?.message || "Pagamento ainda pendente."),
          verificacao.aprovado ? "success" : "info",
          btn
        );
        if (verificacao.aprovado) {
          await listarPedidosPorEmail(email);
        }
      });
    });
  } catch {
    container.innerHTML = "<p>Não foi possível carregar seus pedidos.</p>";
  }
}

async function verificarPagamento(idPedido) {
  const response = await fetch(getApiUrl("/verificar-pagamento"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idPedido }),
  });
  const payload = await response.json();
  return {
    ok: response.ok,
    success: !!payload?.success,
    aprovado: !!payload?.aprovado,
    payload,
  };
}

async function gerarPixDinamico(total, idPedido, cliente) {
  const response = await fetch(getApiUrl("/gerar-pix"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valor: total,
      descricao: `Pedido #${idPedido.slice(0, 8)} - Zuca`,
      cliente: {
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        cpf: String(cliente.cpfCnpj || "").replace(/\D/g, ""),
      },
      idPedido,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.details || data.error || "Falha ao gerar PIX");
  }

  const qrContainer = el("pix-qrcode");
  const brCodeInput = el("pix-brcode");
  if (qrContainer) qrContainer.innerHTML = `<img src="${escapeHtml(data.qr_code)}" alt="QR PIX" style="max-width:220px;">`;
  if (brCodeInput) brCodeInput.value = data.brcode || "";

  return data;
}

function mostrarPixNaTela(data = {}) {
  const qrContainer = el("pix-qrcode");
  const brCodeInput = el("pix-brcode");
  if (qrContainer && data.qr_code) {
    qrContainer.innerHTML = `<img src="${escapeHtml(data.qr_code)}" alt="QR PIX" style="max-width:220px;">`;
  }
  if (brCodeInput) {
    brCodeInput.value = data.brcode || "";
  }

  if (el("pagamento")) {
    el("pagamento").value = "pix";
    onPagamentoChange();
  }
}

function pararMonitoramentoPagamento() {
  if (monitorPagamentoTimer) {
    clearInterval(monitorPagamentoTimer);
    monitorPagamentoTimer = null;
  }
}

function iniciarMonitoramentoPagamento(idPedido, email = "") {
  pararMonitoramentoPagamento();
  let tentativas = 0;
  monitorPagamentoTimer = setInterval(async () => {
    tentativas += 1;
    const verificacao = await verificarPagamento(idPedido);
    if (verificacao.aprovado) {
      pararMonitoramentoPagamento();
      setActionFeedback(`Pagamento confirmado para o pedido #${idPedido.slice(0, 8)}.`, "success");
      if (email) {
        await listarPedidosPorEmail(email);
      }
      return;
    }

    if (tentativas >= 24) {
      pararMonitoramentoPagamento();
    }
  }, 10000);
}

async function iniciarCheckoutCartao(pedidoId, email) {
  const response = await fetch(getApiUrl(`/api/pedidos/${encodeURIComponent(pedidoId)}/checkout-cartao`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json();

  if (!response.ok || !payload.success || !payload.checkoutUrl) {
    throw new Error(payload.error || "Nao foi possivel iniciar pagamento por cartao");
  }

  window.location.href = payload.checkoutUrl;
}

async function pagarPedidoPendente(idPedido, metodoOriginal, email) {
  if (!idPedido) return;

  try {
    setCheckoutStatus(`Preparando pagamento do pedido #${idPedido.slice(0, 8)}...`, "info");
    showToast(`Preparando pagamento do pedido #${idPedido.slice(0, 8)}...`, "info");
    const metodo = metodoOriginal === "cartao" ? "cartao" : "pix";
    const response = await fetch(getApiUrl(`/api/pedidos/${encodeURIComponent(idPedido)}/pagar-agora`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, metodo }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Nao foi possivel gerar nova cobranca");
    }

    if (payload.action === "pix") {
      mostrarPixNaTela(payload);
      showToast(`PIX atualizado para o pedido #${idPedido.slice(0, 8)}.`, "success");
      iniciarMonitoramentoPagamento(idPedido, email);
      return;
    }

    if (payload.action === "checkout_pro" && payload.checkoutUrl) {
      showToast("Redirecionando para pagamento seguro do Mercado Pago...", "info");
      window.location.href = payload.checkoutUrl;
      return;
    }

    throw new Error("Resposta de pagamento invalida");
  } catch (error) {
    showToast(`Erro: ${error.message}`, "error");
  }
}

function validarCamposCliente(cliente) {
  if (!cliente.nome) return "Informe seu nome.";
  if (!cliente.cpfCnpj) return "Informe seu CPF ou CNPJ para pagamento.";
  if (!cliente.email) return "Informe seu e-mail.";
  if (!cliente.telefone) return "Informe seu telefone.";
  if (!cliente.endereco) return "Informe seu endereço.";
  if (!cliente.numero) return "Informe o número.";
  if (!cliente.cidade) return "Informe sua cidade.";
  if (!cliente.estado) return "Informe seu estado.";
  if (!isCepValido(cliente.cep)) return "Informe um CEP valido para calcular o frete.";
  return "";
}

function isItemPersonalizado(item = {}) {
  const valor = item.personalizado;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor === 1;
  if (typeof valor === "string") {
    const v = valor.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "personalizado"].includes(v)) return true;
    if (["false", "0", "nao", "não", "no"].includes(v)) return false;
  }
  return false;
}

function obterUrlAnexoItem(item = {}) {
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

  const valor = candidatas
    .map((v) => String(v || "").trim())
    .find((v) => v && (/^https?:\/\//i.test(v) || v.startsWith("/upload") || v.includes("storage.googleapis.com")));

  return valor || "";
}

function obterNomeAnexoItem(item = {}) {
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

  const url = obterUrlAnexoItem(item);
  if (!url) return "";
  const semQuery = url.split("?")[0];
  const partes = semQuery.split("/").filter(Boolean);
  return partes[partes.length - 1] || "arquivo";
}

function normalizarItemParaPedido(item = {}) {
  return {
    ...item,
    id: String(item.id || "").trim(),
    nome: String(item.nome || "Produto").trim(),
    preco: precoNumero(item.preco),
    quantidade: Number(item.quantidade || 1),
    imagem: String(item.imagem || "").trim(),
    personalizado: isItemPersonalizado(item),
    arquivoPersonalizacaoUrl: obterUrlAnexoItem(item),
    arquivoPersonalizacaoNome: obterNomeAnexoItem(item),
  };
}

async function tratarRetornoPagamento() {
  const params = new URLSearchParams(window.location.search);
  const pedidoId = String(params.get("pedido") || "").trim();
  const retorno = String(params.get("retorno") || "").trim().toLowerCase();

  if (!pedidoId) return;

  const msgBase = `Pedido #${pedidoId.slice(0, 8)}`;
  if (retorno === "failure") {
    setActionFeedback(`${msgBase}: pagamento nao aprovado. Voce pode tentar novamente abaixo.`, "error");
    return;
  }

  setActionFeedback(`${msgBase}: verificando status do pagamento...`, "info");
  const verificacao = await verificarPagamento(pedidoId);
  if (verificacao.aprovado) {
    localStorage.removeItem("zuca_carrinho");
    descontoAtual = 0;
    renderCarrinho();
    setActionFeedback(`${msgBase}: pagamento confirmado com sucesso.`, "success");
  } else if (retorno === "success") {
    setActionFeedback(
      verificacao.payload?.message || `${msgBase}: ainda aguardando confirmacao do pagamento.`,
      "info"
    );
    const email = String(el("email")?.value || "").trim().toLowerCase();
    iniciarMonitoramentoPagamento(pedidoId, email);
  }
}

async function finalizarPedido() {
  const itens = getCarrinho().map(normalizarItemParaPedido);
  if (itens.length === 0) {
    showToast("Carrinho vazio.", "error");
    return;
  }

  const itemPersonalizadoSemArquivo = itens.find((item) =>
    isItemPersonalizado(item) && !String(item.arquivoPersonalizacaoUrl || "").trim()
  );

  if (itemPersonalizadoSemArquivo) {
    showToast(
      `O item "${itemPersonalizadoSemArquivo.nome || "personalizado"}" precisa de um arquivo anexado antes da compra.`,
      "error", 6000
    );
    return;
  }

  const cliente = salvarDadosClienteLocal();
  const erro = validarCamposCliente(cliente);
  if (erro) {
    showToast(erro, "error");
    return;
  }

  const metodo = el("pagamento")?.value || "pix";
  const observacoes = el("observacoes")?.value.trim() || "";
  const btn = el("btn-finalizar");

  try {
    const configMP = await obterConfigMercadoPago(true);

    if (metodo === "pix" && configMP && !configMP.pixConfigured) {
      throw new Error("PIX indisponível no momento. Tente boleto.");
    }

    if (metodo === "cartao" && configMP && !configMP.cardConfigured) {
      throw new Error("Cartão indisponível no momento. Tente PIX ou boleto.");
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processando...";
    }

    const criarPedidoRes = await fetch(getApiUrl("/api/pedidos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente,
        itens,
        pagamento: metodo,
        frete: {
          valor: Number(freteAtual.valor || 0),
          servico: freteAtual.servico,
          prazoDias: freteAtual.prazoDias,
        },
        cupom: cupomAplicado,
        observacoes,
      }),
    });

    const pedidoPayload = await criarPedidoRes.json();
    if (!criarPedidoRes.ok || !pedidoPayload.success) {
      throw new Error(pedidoPayload.error || "Não foi possível criar o pedido");
    }

    const pedidoId = pedidoPayload.pedidoId;
    const total = Number(pedidoPayload.total || 0);

    if (metodo === "pix") {
      const pix = await gerarPixDinamico(total, pedidoId, cliente);
      mostrarPixNaTela(pix);
      showToast(
        `PIX gerado para o pedido #${pedidoId.slice(0, 8)}. Aguardando confirmação.`,
        "success", 8000
      );
      iniciarMonitoramentoPagamento(pedidoId, cliente.email);
    } else if (metodo === "cartao") {
      showToast("Redirecionando para pagamento seguro do Mercado Pago...", "info");
      await iniciarCheckoutCartao(pedidoId, cliente.email);
    } else if (metodo === "boleto") {
      showToast(`Pedido #${pedidoId.slice(0, 8)} criado. Boleto será enviado por e-mail.`, "success", 8000);
    }

    if (metodo !== "cartao") {
      localStorage.removeItem("zuca_carrinho");
      descontoAtual = 0;
      cupomAplicado = null;
      renderCarrinho();
    }
    await listarPedidosPorEmail(cliente.email);
  } catch (error) {
    setCheckoutStatus(`Erro: ${error.message}`, "error");
    showToast(`Erro: ${error.message}`, "error", 6000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✓ Finalizar Compra";
    }
  }
}

function onPagamentoChange() {
  const metodo = el("pagamento")?.value;
  document.querySelectorAll(".payment-option").forEach((node) => node.classList.remove("active"));
  if (metodo && el(`${metodo}-section`)) {
    el(`${metodo}-section`).classList.add("active");
  }
}

function atualizarAvatarCheckout() {
  const avatarImage = el("avatar-image");
  if (!avatarImage) return;
  avatarImage.src = obterAvatarHeader();
}

function setAuthStatus(message, type = "info") {
  const status = el("auth-status");
  if (!status) return;

  status.textContent = message;
  status.style.borderColor = "#ece3da";
  status.style.background = "#faf7f3";
  status.style.color = "#555";

  if (type === "ok") {
    status.style.borderColor = "#d7eadc";
    status.style.background = "#eef8f1";
    status.style.color = "#1f8f4f";
  }

  if (type === "error") {
    status.style.borderColor = "#f1d2d2";
    status.style.background = "#fdf1f1";
    status.style.color = "#b02a37";
  }
}

function aplicarLoginLocal(email, providerLabel) {
  const emailNormalizado = String(email || "").trim().toLowerCase();
  if (!emailNormalizado) {
    setAuthStatus("Nao foi possivel identificar o e-mail para login.", "error");
    return;
  }

  const nomeAtual = String(el("nome")?.value || "").trim();
  const nomeSugerido = emailNormalizado.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const nomeFinal = nomeAtual || nomeSugerido;

  if (el("nome") && !nomeAtual) el("nome").value = nomeFinal;
  if (el("email")) el("email").value = emailNormalizado;

  salvarDadosClienteLocal();
  atualizarAvatarCheckout();
  setAuthStatus(`Conectado localmente com ${providerLabel}: ${emailNormalizado}`, "ok");
  listarPedidosPorEmail(emailNormalizado);
}

function solicitarEmail(providerLabel) {
  const atual = String(el("email")?.value || "").trim();
  const informado = window.prompt(`Informe seu e-mail ${providerLabel}:`, atual);
  return String(informado || "").trim().toLowerCase();
}

function configurarBotoesLoginPlaceholder() {
  const texto = "Preencha os dados para finalizar. O login nesta tela e local ao navegador.";
  setAuthStatus(texto);

  const btnGoogle = el("btn-google");
  btnGoogle?.addEventListener("click", () => {
    const emailAtual = String(el("email")?.value || "").trim().toLowerCase();
    const email = emailAtual || solicitarEmail("do Gmail");

    if (!email) {
      setAuthStatus("Informe um e-mail para continuar.", "error");
      return;
    }

    if (!/@gmail\.com$/i.test(email)) {
      setAuthStatus("Use um e-mail Gmail valido para este botao.", "error");
      return;
    }

    aplicarLoginLocal(email, "Gmail");
  });

  const btnApple = el("btn-apple");
  btnApple?.addEventListener("click", () => {
    const emailAtual = String(el("email")?.value || "").trim().toLowerCase();
    const email = emailAtual || solicitarEmail("do iCloud");

    if (!email) {
      setAuthStatus("Informe um e-mail para continuar.", "error");
      return;
    }

    if (!/@(icloud\.com|me\.com)$/i.test(email)) {
      setAuthStatus("Use um e-mail iCloud valido para este botao.", "error");
      return;
    }

    aplicarLoginLocal(email, "iCloud");
  });

  const executarLogout = () => {
    localStorage.removeItem("zuca_checkout_cliente");
    localStorage.removeItem("zuca_checkout_cliente_nome");
    if (el("nome")) el("nome").value = "";
    if (el("email")) el("email").value = "";
    atualizarAvatarCheckout();
    setAuthStatus("Dados locais removidos.", "ok");
    el("lista-pedidos") && (el("lista-pedidos").innerHTML = "<p>Nenhum pedido ainda.</p>");
  };

  el("btn-logout")?.addEventListener("click", executarLogout);
  // btn-logout-user (dropdown do header) é gerenciado dinamicamente por atualizarMenuUsuario()

  // btn-login-google no dropdown já é tratado pelo script.js
}

function configurarHeaderCheckout() {
  const btnCart = el("btn-cart");
  const btnClose = el("btn-close-cart");
  const overlay = el("cart-overlay");
  const btnAvatar = el("btn-avatar");
  const dropdown = el("avatar-dropdown");

  btnCart?.addEventListener("click", abrirCarrinhoSidebar);
  btnClose?.addEventListener("click", fecharCarrinhoSidebar);
  overlay?.addEventListener("click", fecharCarrinhoSidebar);

  btnAvatar?.addEventListener("click", () => {
    const ativo = dropdown?.classList.toggle("ativo");
    btnAvatar.setAttribute("aria-expanded", ativo ? "true" : "false");
  });

  // Listener de logout no dropdown (elemento estável — persiste mesmo com innerHTML trocado)
  dropdown?.addEventListener("click", (e) => {
    const sairBtn = e.target.closest(".sair");
    if (!sairBtn) return;
    e.stopPropagation();
    dropdown.classList.remove("ativo");
    btnAvatar.setAttribute("aria-expanded", "false");
    limparSessaoUsuario();
    atualizarMenuUsuario();
    atualizarAvatarCheckout();
    if (el("nome")) el("nome").value = "";
    if (el("email")) el("email").value = "";
    showToast("Até logo! Você saiu da sua conta.", "success");
  });

  // Fecha dropdown ao clicar fora
  document.addEventListener("click", (event) => {
    if (!dropdown || !btnAvatar) return;
    const target = event.target;
    if (target instanceof Node && !dropdown.contains(target) && !btnAvatar.contains(target)) {
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
    }
  });

  // Menu de usuário
  atualizarMenuUsuario();
}

function configurarCopiarPix() {
  el("btn-copiar-pix")?.addEventListener("click", async () => {
    const value = el("pix-brcode")?.value || "";
    if (!value) return;
    await navigator.clipboard.writeText(value);
    showToast("Chave PIX copiada!", "success");
  });
}

function configurarMascarasFormulario() {
  const cpfCnpj = el("cpfCnpj");
  const telefone = el("telefone");
  const cep = el("cep");
  const estado = el("estado");

  cpfCnpj?.addEventListener("input", (event) => {
    event.target.value = formatarCpfCnpj(event.target.value);
  });

  telefone?.addEventListener("input", (event) => {
    event.target.value = formatarTelefone(event.target.value);
  });

  cep?.addEventListener("input", (event) => {
    event.target.value = formatarCep(event.target.value);
  });

  cep?.addEventListener("blur", async (event) => {
    const value = String(event.target.value || "");
    await preencherEnderecoPorCep(value);
    await recalcularFrete();
  });

  // Botão explícito "Calcular Frete"
  el("btn-calcular-frete")?.addEventListener("click", async () => {
    const cepVal = el("cep")?.value || "";
    await preencherEnderecoPorCep(cepVal);
    await recalcularFrete();
  });

  // Enter no campo CEP também calcula
  cep?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const cepVal = el("cep")?.value || "";
      await preencherEnderecoPorCep(cepVal);
      await recalcularFrete();
    }
  });

  estado?.addEventListener("input", (event) => {
    event.target.value = String(event.target.value || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  });
}

function configurarAcoesPagamento() {
  el("btn-pagar-cartao")?.addEventListener("click", () => {
    showToast("Para pagar com cartão, finalize o pedido com a forma Cartão selecionada.", "info");
  });
}

el("btn-aplicar-cupom")?.addEventListener("click", aplicarCupom);
el("btn-finalizar")?.addEventListener("click", finalizarPedido);
el("pagamento")?.addEventListener("change", onPagamentoChange);
el("email")?.addEventListener("blur", (event) => {
  const value = String(event.target.value || "").trim().toLowerCase();
  if (value) listarPedidosPorEmail(value);
});

document.querySelectorAll("#nome, #cpfCnpj, #email, #telefone, #cep, #endereco, #numero, #bairro, #cidade, #estado")
  .forEach((input) => input.addEventListener("change", salvarDadosClienteLocal));

normalizarUrlSemExtensao();
carregarDadosClienteLocal();
atualizarAvatarCheckout();
renderCarrinho();
onPagamentoChange();
configurarBotoesLoginPlaceholder();
configurarHeaderCheckout();
configurarCopiarPix();
configurarMascarasFormulario();
configurarAcoesPagamento();
renderizarCarrinhoSidebar();
tratarRetornoPagamento();
configurarSteps();
configurarValidacao();
configurarTermos();

if (el("email")?.value) {
  listarPedidosPorEmail(el("email").value.trim().toLowerCase());
}

if (isCepValido(el("cep")?.value || "")) {
  recalcularFrete();
}

/* ========== Checkout Steps Navigation ========== */
let currentStep = 1;

function configurarSteps() {
  document.querySelectorAll(".step-next").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.next);
      if (validarStep(currentStep)) {
        goToStep(next);
      }
    });
  });

  document.querySelectorAll(".step-prev").forEach((btn) => {
    btn.addEventListener("click", () => {
      goToStep(Number(btn.dataset.prev));
    });
  });

  // Click on step indicators
  document.querySelectorAll(".checkout-steps .step").forEach((stepEl) => {
    stepEl.addEventListener("click", () => {
      const target = Number(stepEl.dataset.step);
      if (target < currentStep) goToStep(target);
    });
  });
}

/* ========== Sticky Header Auto-hide ========== */
(function stickyHeaderAutoHide() {
  const header = document.querySelector(".header");
  if (!header) return;
  let lastScroll = 0;
  let ticking = false;

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const current = window.scrollY;
      if (current > 80 && current > lastScroll) {
        header.classList.add("header-hidden");
      } else {
        header.classList.remove("header-hidden");
      }
      lastScroll = current;
      ticking = false;
    });
  }, { passive: true });
})();

function goToStep(step) {
  // Hide all
  document.querySelectorAll(".checkout-step-content").forEach((s) => s.style.display = "none");
  // Show target
  const target = document.getElementById(`step-${step}`);
  if (target) target.style.display = "block";

  // Update indicators
  document.querySelectorAll(".checkout-steps .step").forEach((s) => {
    const n = Number(s.dataset.step);
    s.classList.remove("active", "done");
    if (n < step) s.classList.add("done");
    if (n === step) s.classList.add("active");
  });

  // Update lines
  const lines = document.querySelectorAll(".checkout-steps .step-line");
  lines.forEach((line, i) => {
    line.classList.toggle("done", i < step - 1);
  });

  currentStep = step;

  // Auto-update summary when entering step 4
  if (step === 4) {
    atualizarResumo(obterSubtotal());
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validarStep(step) {
  if (step === 1) {
    return validarCampo("nome") & validarCampo("cpfCnpj") & validarCampo("email") & validarCampo("telefone");
  }
  if (step === 2) {
    return validarCampo("cep") & validarCampo("endereco") & validarCampo("numero") & validarCampo("cidade") & validarCampo("estado");
  }
  if (step === 3) {
    return true;
  }
  return true;
}

/* ========== Real-time Validation ========== */
function configurarValidacao() {
  const campos = ["nome", "cpfCnpj", "email", "telefone", "cep", "endereco", "numero", "cidade", "estado"];
  campos.forEach((id) => {
    el(id)?.addEventListener("blur", () => validarCampo(id));
    el(id)?.addEventListener("input", () => {
      const input = el(id);
      if (input?.classList.contains("is-invalid")) {
        validarCampo(id);
      }
    });
  });
}

function validarCampo(id) {
  const input = el(id);
  const errorEl = el(`${id}-error`);
  if (!input) return true;

  const val = input.value.trim();
  let erro = "";

  switch (id) {
    case "nome":
      if (!val) erro = "Informe seu nome completo.";
      else if (val.length < 3) erro = "Nome muito curto.";
      break;
    case "cpfCnpj":
      if (!val) erro = "Informe CPF ou CNPJ.";
      else if (!validarCPF(val) && !validarCNPJ(val)) erro = "CPF/CNPJ inválido.";
      break;
    case "email":
      if (!val) erro = "Informe seu e-mail.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) erro = "E-mail inválido.";
      break;
    case "telefone":
      if (!val) erro = "Informe seu telefone.";
      else if (val.replace(/\D/g, "").length < 10) erro = "Telefone inválido.";
      break;
    case "cep":
      if (!val) erro = "Informe o CEP.";
      else if (val.replace(/\D/g, "").length !== 8) erro = "CEP deve ter 8 dígitos.";
      break;
    case "endereco":
      if (!val) erro = "Informe o endereço.";
      break;
    case "numero":
      if (!val) erro = "Informe o número.";
      break;
    case "cidade":
      if (!val) erro = "Informe a cidade.";
      break;
    case "estado":
      if (!val) erro = "Informe o estado.";
      else if (val.length !== 2) erro = "Use a sigla do estado (ex: MS).";
      break;
  }

  input.classList.toggle("is-invalid", !!erro);
  input.classList.toggle("is-valid", !erro && val.length > 0);
  if (errorEl) errorEl.textContent = erro;
  return !erro;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(cpf[10]);
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const pesos1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const pesos2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(cnpj[i]) * pesos1[i];
  let resto = soma % 11;
  const d1 = resto < 2 ? 0 : 11 - resto;
  if (Number(cnpj[12]) !== d1) return false;
  soma = 0;
  for (let i = 0; i < 13; i++) soma += Number(cnpj[i]) * pesos2[i];
  resto = soma % 11;
  const d2 = resto < 2 ? 0 : 11 - resto;
  return Number(cnpj[13]) === d2;
}

/* ========== Termos & Conditions ========== */
function configurarTermos() {
  const check = el("termos-check");
  const btnFinalizar = el("btn-finalizar");
  if (check && btnFinalizar) {
    check.addEventListener("change", () => {
      btnFinalizar.disabled = !check.checked;
    });
  }
}
