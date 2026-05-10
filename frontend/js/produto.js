import {
  auth,
  sairDoFirebase,
  onAuthStateChanged,
  salvarUsuarioNoStorage,
} from "./firebase-auth.js";
import RECEITUARIO_MODELOS from "./receituario-modelos.js";

const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23e8dbcb'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23b59273'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23b59273'/%3E%3C/svg%3E";

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

/* ========== Wishlist ========== */
function getWishlist() {
  try { return JSON.parse(localStorage.getItem("zuca_wishlist") || "[]"); } catch { return []; }
}

function toggleWishlist(id) {
  let list = getWishlist();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
    showToast("Removido dos favoritos.", "info");
  } else {
    list.push(id);
    showToast("Adicionado aos favoritos!", "success");
  }
  localStorage.setItem("zuca_wishlist", JSON.stringify(list));
  atualizarBotaoWishlist(id);
}

function atualizarBotaoWishlist(id) {
  const btn = document.getElementById("btn-wishlist");
  if (!btn) return;
  const ativo = getWishlist().includes(id);
  btn.classList.toggle("active", ativo);
  btn.textContent = ativo ? "♥ Favoritado" : "♡ Favoritar";
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
  const dropdown  = document.getElementById("avatar-dropdown");
  const avatarImg = document.getElementById("avatar-image");
  if (!btnAvatar || !dropdown) return;

  const usuario = getUsuarioLogado();

  if (usuario) {
    btnAvatar.classList.remove("nao-logado");
    btnAvatar.querySelector(".avatar-btn-label")?.remove();
    if (avatarImg) { avatarImg.src = usuario.avatar; avatarImg.style.display = ""; }
  } else {
    btnAvatar.classList.add("nao-logado");
    if (avatarImg) avatarImg.style.display = "none";
    if (!btnAvatar.querySelector(".avatar-btn-label")) {
      const span = document.createElement("span");
      span.className = "avatar-btn-label";
      span.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg><span>Entrar</span>`;
      btnAvatar.appendChild(span);
    }
  }

  if (usuario) {
    dropdown.innerHTML = `
      <div class="add-header">
        <img class="add-foto" src="${escapeHtml(usuario.avatar)}" alt="" onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="add-info">
          <div class="add-nome">${escapeHtml(usuario.primeiroNome)}</div>
          ${usuario.email ? `<div class="add-email">${escapeHtml(usuario.email)}</div>` : ""}
        </div>
      </div>
      <nav class="add-lista">
        <a class="add-item" href="/minha-conta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Minha conta
        </a>
        <a class="add-item" href="/minha-conta#pedidos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
          Meus pedidos
        </a>
        <div class="add-divider"></div>
        <button class="add-item sair" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair da conta
        </button>
      </nav>`;
  } else {
    dropdown.innerHTML = `
      <div class="add-login-header">
        <strong>Entre na sua conta</strong>
        <span>Veja seus pedidos e dados salvos</span>
      </div>
      <div class="add-login-body">
        <button class="add-oauth-btn add-oauth-google" type="button" data-provider="google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.59-13.46-8.83l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar com Google
        </button>
        <button class="add-oauth-btn add-oauth-apple" type="button" data-provider="apple">
          <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.8-155.5-127.4C46 790.5 0 665.1 0 546c0-201.3 131.2-307.4 260.5-307.4 70 0 127.9 46.5 168.3 46.5 39.3 0 107-49.3 184.6-49.3zm-194.1-24.9c3.2-16.7 4.5-33.4 4.5-50.1 0-51.7-19.2-107-55.4-148.4-35-40.8-91.7-70.1-147.9-70.1-1.3 0-2.6 0-3.8.1 1.2 52.4 16.8 109.9 48.3 150 29.3 37.2 81 64.8 154.3 118.5z"/></svg>
          Continuar com Apple
        </button>
        <button class="add-oauth-btn add-oauth-ms" type="button" data-provider="microsoft">
          <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="#f25022"/><rect x="12" y="1" width="10" height="10" fill="#7fba00"/><rect x="1" y="12" width="10" height="10" fill="#00a4ef"/><rect x="12" y="12" width="10" height="10" fill="#ffb900"/></svg>
          Continuar com Microsoft
        </button>
        <p class="add-login-status" aria-live="polite"></p>
      </div>`;
  }
}

/** @deprecated */
function atualizarAvatarHeader() { atualizarMenuUsuario(); }


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

function precoParaNumero(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  const textoLimpo = String(valor ?? "")
    .replace(/[^\d.,-]/g, "")
    .trim();

  if (!textoLimpo) return 0;

  let texto = textoLimpo;
  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if ((texto.match(/\./g) || []).length > 1) {
    const partes = texto.split(".");
    const decimal = partes.pop();
    texto = `${partes.join("")}.${decimal}`;
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function isProdutoPersonalizado(produto = {}) {
  const valor = produto.personalizado;

  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor === 1;
  if (typeof valor === "string") {
    const v = valor.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "personalizado"].includes(v)) return true;
    if (["false", "0", "nao", "não", "no"].includes(v)) return false;
  }

  // Regra oficial: quando o campo nao vier, considera nao personalizado.
  return false;
}

function arquivoPersonalizacaoValido(arquivo) {
  if (!arquivo) {
    return { ok: false, mensagem: "Selecione um arquivo para personalizacao." };
  }

  const nome = String(arquivo.name || "").toLowerCase();
  const mime = String(arquivo.type || "").toLowerCase();
  const extensaoValida = /\.(pdf|jpe?g|png)$/.test(nome);
  const mimeValido = ["application/pdf", "image/jpeg", "image/png"].includes(mime);

  if (!extensaoValida || !mimeValido) {
    return { ok: false, mensagem: "Formato invalido. Envie apenas PDF, JPG ou PNG." };
  }

  return { ok: true, mensagem: "" };
}

function obterImagensProduto(produto) {
  if (Array.isArray(produto?.imagens)) {
    const lista = produto.imagens.map((img) => String(img || "").trim()).filter(Boolean);
    if (lista.length) return lista;
  }

  if (typeof produto?.imagens === "string") {
    const lista = produto.imagens.split(",").map((img) => img.trim()).filter(Boolean);
    if (lista.length) return lista;
  }

  const candidatas = [produto?.imagem, produto?.imagemUrl, produto?.foto]
    .map((img) => String(img || "").trim())
    .filter(Boolean);

  if (candidatas.length) return candidatas;
  return ["img/logo/logo.png"];
}

const IMG_FALLBACK_SRC = "img/logo/logo.png";

function aplicarFallbackImagem(imgEl) {
  if (!imgEl) return;
  imgEl.onerror = () => {
    if (imgEl.src.includes(IMG_FALLBACK_SRC)) return;
    imgEl.onerror = null;
    imgEl.src = IMG_FALLBACK_SRC;
  };
}

function mostrarBlocoPersonalizacao(personalizado) {
  const bloco = document.getElementById("bloco-personalizacao");
  if (!bloco) return;
  bloco.hidden = !personalizado;
}

async function enviarArquivoPersonalizacao(arquivo) {
  const formData = new FormData();
  formData.append("arquivo", arquivo);

  const response = await fetch(getApiUrl("/upload"), {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.erro || payload?.error || "Falha ao enviar arquivo");
  }

  return payload.url;
}

function getCarrinho() {
  try {
    return JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  } catch {
    return [];
  }
}

function atualizarContadorCarrinho() {
  const count = getCarrinho().reduce((acc, item) => acc + Number(item.quantidade || 1), 0);
  const cartCount = document.getElementById("cart-count");
  if (cartCount) cartCount.textContent = String(count);
}

function renderizarCarrinhoSidebar() {
  const container = document.getElementById("cart-sidebar-items");
  const totalEl = document.getElementById("cart-sidebar-total");
  if (!container || !totalEl) return;

  const itens = getCarrinho();
  if (!itens.length) {
    container.innerHTML = "<p style='text-align:center; color: var(--muted); padding: 20px;'>Seu carrinho está vazio.</p>";
    totalEl.textContent = "R$ 0,00";
    return;
  }

  let total = 0;
  container.innerHTML = itens.map((item) => {
    const subtotal = precoParaNumero(item.preco) * Number(item.quantidade || 1);
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

function configurarHeaderProduto() {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("cart-overlay");
  const btnCart = document.getElementById("btn-cart");
  const btnClose = document.getElementById("btn-close-cart");
  const btnAvatar = document.getElementById("btn-avatar");
  const dropdown = document.getElementById("avatar-dropdown");

  const abrirCarrinho = () => {
    sidebar?.classList.add("ativo");
    overlay?.classList.add("ativo");
  };

  const fecharCarrinho = () => {
    sidebar?.classList.remove("ativo");
    overlay?.classList.remove("ativo");
  };

  btnCart?.addEventListener("click", abrirCarrinho);
  btnClose?.addEventListener("click", fecharCarrinho);
  overlay?.addEventListener("click", fecharCarrinho);

  btnAvatar?.addEventListener("click", () => {
    const ativo = dropdown?.classList.toggle("ativo");
    btnAvatar.setAttribute("aria-expanded", ativo ? "true" : "false");
  });

  // Listener de logout + login OAuth no dropdown (elemento estável)
  dropdown?.addEventListener("click", async (e) => {
    if (e.target.closest(".sair")) {
      e.stopPropagation();
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
      try { await sairDoFirebase(); } catch (_) {}
      limparSessaoUsuario();
      atualizarMenuUsuario();
      showToast("Até logo! Você saiu da sua conta.", "success");
      return;
    }
    const oauthBtn = e.target.closest("[data-provider]");
    if (!oauthBtn) return;
    e.stopPropagation();
    const provider = oauthBtn.getAttribute("data-provider");
    const status = dropdown.querySelector(".add-login-status");
    const allBtns = dropdown.querySelectorAll(".add-oauth-btn");
    allBtns.forEach(b => { b.disabled = true; b.style.opacity = "0.55"; });
    if (status) status.textContent = "Aguarde…";
    try {
      const { loginComGoogle, loginComApple, loginComMicrosoft, salvarUsuarioNoStorage } = await import("./firebase-auth.js");
      const fn = provider === "google" ? loginComGoogle : provider === "apple" ? loginComApple : loginComMicrosoft;
      const result = await fn();
      salvarUsuarioNoStorage(result.user);
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
      atualizarMenuUsuario();
      showToast(`Bem-vindo, ${result.user.displayName || result.user.email}!`, "success");
    } catch (err) {
      const msgs = {
        "auth/popup-closed-by-user": "Login cancelado.",
        "auth/popup-blocked": "Popup bloqueado. Permita popups para este site.",
        "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
      };
      const msg = msgs[err.code] || "Erro ao entrar. Tente novamente.";
      if (status) status.textContent = msg;
      allBtns.forEach(b => { b.disabled = false; b.style.opacity = ""; });
    }
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

  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();

  // Firebase é a fonte de verdade do login
  onAuthStateChanged(auth, (user) => {
    if (user) {
      salvarUsuarioNoStorage(user);
    } else {
      limparSessaoUsuario();
    }
    atualizarMenuUsuario();
  });
}

function formatarMoeda(valor) {
  const numero = Number(valor);
  const seguro = Number.isFinite(numero) ? numero : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(seguro);
}

function atualizarEstoqueUI(estoque) {
  const container = document.getElementById("estoque-container");
  const icon = document.getElementById("estoque-icon");
  const status = document.getElementById("estoque-status");
  const mensagem = document.getElementById("estoque-mensagem");
  const botaoCarrinho = document.getElementById("btn-adicionar-carrinho");

  if (!container || !icon || !status || !mensagem || !botaoCarrinho) {
    return;
  }

  if (estoque > 0) {
    container.style.borderColor = "#27ae60";
    container.style.background = "rgba(39, 174, 96, 0.05)";
    icon.textContent = "✓";
    icon.style.color = "#27ae60";
    status.textContent = "Em Estoque";
    status.style.color = "#27ae60";

    if (estoque <= 3) {
      mensagem.textContent = `⚠️ Apenas ${estoque} unidade${estoque !== 1 ? "s" : ""} disponível${estoque !== 1 ? "s" : ""}`;
      mensagem.style.color = "#e67e22";
    } else {
      mensagem.textContent = `${estoque} unidades disponíveis`;
      mensagem.style.color = "var(--muted)";
    }

    botaoCarrinho.textContent = "🛒 Adicionar ao carrinho";
    botaoCarrinho.disabled = false;
    botaoCarrinho.style.opacity = "1";
    botaoCarrinho.style.cursor = "pointer";
  } else {
    container.style.borderColor = "#e74c3c";
    container.style.background = "rgba(231, 76, 60, 0.05)";
    icon.textContent = "✗";
    icon.style.color = "#e74c3c";
    status.textContent = "Fora de Estoque";
    status.style.color = "#e74c3c";
    mensagem.textContent = "Produto indisponível no momento";
    mensagem.style.color = "var(--muted)";

    botaoCarrinho.textContent = "❌ Fora de Estoque";
    botaoCarrinho.disabled = true;
    botaoCarrinho.style.opacity = "0.5";
    botaoCarrinho.style.cursor = "not-allowed";
    botaoCarrinho.style.background = "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)";
  }
}

function adicionarAoCarrinhoComEstoque(produto, estoqueDisponivel, quantidade = 1) {
  const carrinho = JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  const produtoPersonalizado = isProdutoPersonalizado(produto);
  const existente = produtoPersonalizado
    ? null
    : carrinho.find((item) => item.id === produto.id && !item.arquivoPersonalizacaoUrl);
  const quantidadeNoCarrinho = existente ? Number(existente.quantidade || 0) : 0;

  if (quantidadeNoCarrinho + quantidade > estoqueDisponivel) {
    showToast(`Máximo de ${estoqueDisponivel} unidade(s) disponível(is). Você já tem ${quantidadeNoCarrinho} no carrinho.`, "error");
    return;
  }

  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: obterImagensProduto(produto)[0] || "",
      personalizado: !!produto.personalizado,
      arquivoPersonalizacaoUrl: produto.arquivoPersonalizacaoUrl || "",
      arquivoPersonalizacaoNome: produto.arquivoPersonalizacaoNome || "",
      quantidade: quantidade,
    });
  }

  localStorage.setItem("zuca_carrinho", JSON.stringify(carrinho));
  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();
  showToast(`${produto.nome || "Produto"} adicionado ao carrinho!`, "success");

  const btn = document.getElementById("btn-adicionar-carrinho");
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = "✓ Adicionado!";
  btn.style.background = "linear-gradient(135deg, #27ae60 0%, #229954 100%)";

  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = "";
  }, 2000);
}

/* ========== Calcular Parcelas ========== */
function calcularParcelas(preco) {
  if (preco < 100) return null;
  const parcelas = Math.min(12, Math.floor(preco / 50));
  const valor = preco / parcelas;
  return { parcelas, valor, valorFormatado: formatarMoeda(valor) };
}

/* ========== Compartilhar Produto ========== */
function compartilharWhatsApp(nome) {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(`Olha esse produto: ${nome} - `);
  window.open(`https://wa.me/?text=${text}${url}`, "_blank");
}

function copiarLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    showToast("Link copiado!", "success");
  }).catch(() => {
    showToast("Não foi possível copiar o link.", "error");
  });
}

async function carregarProduto() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    document.body.innerHTML = "<div style='text-align:center; padding: 100px;'><h2>Produto não encontrado</h2><p><a href='/'>Voltar para início</a></p></div>";
    return;
  }

  try {
    const response = await fetch(getApiUrl(`/api/produtos/${encodeURIComponent(id)}`));
    if (!response.ok) {
      document.body.innerHTML = "<div style='text-align:center; padding: 100px;'><h2>Produto não encontrado</h2><p><a href='/'>Voltar para início</a></p></div>";
      return;
    }

    const payload = await response.json();
    const produto = payload?.produto;
    if (!produto) {
      document.body.innerHTML = "<div style='text-align:center; padding: 100px;'><h2>Produto não encontrado</h2><p><a href='/'>Voltar para início</a></p></div>";
      return;
    }

    document.getElementById("nome").textContent = produto.nome || "Sem nome";
    document.getElementById("breadcrumb-produto").textContent = produto.nome || "Produto";
    const precoBase = produto.preco ?? produto.valor ?? 0;
    const precoCalculado = precoParaNumero(precoBase);
    const personalizado = isProdutoPersonalizado(produto);
    const produtoParaCarrinho = { ...produto, preco: precoCalculado, personalizado };
    document.getElementById("preco").textContent = formatarMoeda(precoCalculado);
    document.getElementById("descricao").textContent = produto.descricaoCurta || "Descrição não disponível";
    mostrarBlocoPersonalizacao(personalizado);

    const estoque = Number(produto.estoque || 0);
    atualizarEstoqueUI(estoque);

    const imagens = obterImagensProduto(produto);
    const imgPrincipal = document.getElementById("imagem-principal");
    const miniaturas = document.getElementById("miniaturas");
    const inputArquivo = document.getElementById("arquivo-personalizacao");
    const statusArquivo = document.getElementById("arquivo-personalizacao-status");

    if (miniaturas) miniaturas.innerHTML = "";

    if (imagens.length > 0 && imgPrincipal) {
      imgPrincipal.src = imagens[0];
      aplicarFallbackImagem(imgPrincipal);
    }

    imagens.forEach((img, index) => {
      if (!miniaturas) return;
      const thumb = document.createElement("img");
      thumb.src = img;
      aplicarFallbackImagem(thumb);
      if (index === 0) thumb.classList.add("ativa");
      thumb.addEventListener("click", () => {
        if (imgPrincipal) {
          imgPrincipal.src = img;
          aplicarFallbackImagem(imgPrincipal);
        }
        document.querySelectorAll("#miniaturas img").forEach((item) => item.classList.remove("ativa"));
        thumb.classList.add("ativa");
      });
      miniaturas.appendChild(thumb);
    });

    /* ========== Installments Badge ========== */
    const parcelasInfo = calcularParcelas(precoCalculado);
    const precoEl = document.getElementById("preco");
    if (parcelasInfo && precoEl) {
      const badge = document.createElement("span");
      badge.className = "parcelas-badge";
      badge.textContent = `ou ${parcelasInfo.parcelas}x de ${parcelasInfo.valorFormatado} sem juros`;
      precoEl.insertAdjacentElement("afterend", badge);
    }

    /* ========== Quantity Selector ========== */
    const btnCarrinho = document.getElementById("btn-adicionar-carrinho");
    if (btnCarrinho) {
      const qtyHtml = `
        <div class="qty-selector" style="display: flex; align-items: center; gap: 8px; margin: 12px 0;">
          <button type="button" id="qty-minus" class="qty-btn">−</button>
          <input type="number" id="qty-input" value="1" min="1" max="${estoque}" readonly
            style="width: 50px; text-align: center; border: 1px solid var(--border); border-radius: 6px; padding: 6px; font-size: 16px;">
          <button type="button" id="qty-plus" class="qty-btn">+</button>
        </div>
      `;
      btnCarrinho.insertAdjacentHTML("beforebegin", qtyHtml);

      document.getElementById("qty-minus")?.addEventListener("click", () => {
        const input = document.getElementById("qty-input");
        if (input && Number(input.value) > 1) input.value = Number(input.value) - 1;
      });
      document.getElementById("qty-plus")?.addEventListener("click", () => {
        const input = document.getElementById("qty-input");
        if (input && Number(input.value) < estoque) input.value = Number(input.value) + 1;
      });
    }

    /* ========== Wishlist + Share ========== */
    const actionsHtml = `
      <div class="produto-actions" style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <button id="btn-wishlist" class="btn-secondary-action">♡ Favoritar</button>
        <button id="btn-share-whatsapp" class="btn-secondary-action">📱 WhatsApp</button>
        <button id="btn-share-link" class="btn-secondary-action">🔗 Copiar Link</button>
      </div>
    `;
    btnCarrinho?.insertAdjacentHTML("afterend", actionsHtml);
    atualizarBotaoWishlist(id);

    document.getElementById("btn-wishlist")?.addEventListener("click", () => toggleWishlist(id));
    document.getElementById("btn-share-whatsapp")?.addEventListener("click", () => compartilharWhatsApp(produto.nome || ""));
    document.getElementById("btn-share-link")?.addEventListener("click", copiarLink);

    document.getElementById("btn-adicionar-carrinho")?.addEventListener("click", async () => {
      if (estoque <= 0) {
        showToast("Este produto está fora de estoque.", "error");
        return;
      }

      const quantidade = Number(document.getElementById("qty-input")?.value || 1);
      const botao = document.getElementById("btn-adicionar-carrinho");

      if (personalizado) {
        const arquivo = inputArquivo?.files?.[0];

        const validacaoArquivo = arquivoPersonalizacaoValido(arquivo);
        if (!validacaoArquivo.ok) {
          showToast(validacaoArquivo.mensagem, "error");
          if (statusArquivo) statusArquivo.textContent = validacaoArquivo.mensagem;
          return;
        }

        try {
          if (statusArquivo) statusArquivo.textContent = "Enviando arquivo...";
          if (botao) {
            botao.disabled = true;
            botao.textContent = "Enviando...";
          }

          const urlArquivo = await enviarArquivoPersonalizacao(arquivo);
          adicionarAoCarrinhoComEstoque({
            ...produtoParaCarrinho,
            arquivoPersonalizacaoUrl: urlArquivo,
            arquivoPersonalizacaoNome: arquivo.name,
          }, estoque, quantidade);

          if (statusArquivo) statusArquivo.textContent = `Arquivo enviado: ${arquivo.name}`;
        } catch (error) {
          showToast(`Erro ao enviar arquivo: ${error.message}`, "error");
          if (statusArquivo) statusArquivo.textContent = "Não foi possível enviar o arquivo.";
        } finally {
          if (botao) {
            botao.disabled = false;
            botao.textContent = "🛒 Adicionar ao carrinho";
          }
        }

        return;
      }

      adicionarAoCarrinhoComEstoque(produtoParaCarrinho, estoque, quantidade);
    });

    // Populate tabs
    popularAbas(produto);
    configurarAbas();

    // Load related products
    carregarRelacionados(produto.categoria, id);

    // Zoom, sticky bar, vistos recentemente
    configurarZoom();
    configurarStickyBar(precoCalculado);
    salvarVistoRecentemente(id);

  } catch (error) {
    console.error("Erro ao carregar produto:", error);
    document.body.innerHTML = "<div style='text-align:center; padding: 100px;'><h2>Erro ao carregar produto</h2><p><a href='/'>Voltar para início</a></p></div>";
  }
}

normalizarUrlSemExtensao();
carregarProduto();
configurarHeaderProduto();

/* ========== Tabs ========== */
function configurarAbas() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(`tab-${btn.dataset.tab}`);
      if (target) target.classList.add("active");
    });
  });
}

function popularAbas(produto) {
  // Description tab
  const descEl = document.getElementById("descricao-longa-texto");
  if (descEl) {
    descEl.textContent = produto.descricaoLonga || produto.descricaoCurta || "Descrição não disponível.";
  }

  // Specs tab
  const specsGrid = document.getElementById("specs-grid");
  if (specsGrid) {
    const specs = [
      ["Categoria", produto.categoria],
      ["Tipo", produto.tipo],
      ["Material", produto.material],
      ["Tamanho", produto.tamanho],
      ["Gramatura", produto.gramatura],
      ["Personalizado", produto.personalizado ? "Sim" : "Não"],
    ].filter(([, v]) => v !== undefined && v !== null && v !== "");

    if (specs.length) {
      specsGrid.innerHTML = specs.map(([label, value]) =>
        `<div class="spec-row"><span class="spec-label">${escapeHtml(label)}</span><span class="spec-value">${escapeHtml(String(value))}</span></div>`
      ).join("");
    } else {
      specsGrid.innerHTML = '<p style="color: var(--muted); padding: 12px;">Nenhuma especificação disponível.</p>';
    }
  }

  // Reviews tab
  carregarAvaliacoes(produto.id || new URLSearchParams(window.location.search).get("id"));
}

/* ========== Reviews / Avaliações ========== */
async function carregarAvaliacoes(produtoId) {
  const container = document.getElementById("avaliacoes-container");
  if (!container || !produtoId) return;

  try {
    const response = await fetch(getApiUrl(`/api/avaliacoes/${encodeURIComponent(produtoId)}`));
    const data = response.ok ? await response.json() : { avaliacoes: [], media: 0, total: 0 };
    const { avaliacoes = [], media = 0, total = 0 } = data;

    const perfil = JSON.parse(localStorage.getItem("zuca_perfil") || "{}");
    const emailUser = perfil.email || "";

    let html = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
        <div style="font-size: 36px; font-weight: 700; color: var(--accent);">${media.toFixed(1)}</div>
        <div>
          <div class="stars-display">${renderStars(media)}</div>
          <p style="color: var(--muted); font-size: 13px; margin: 4px 0 0;">${total} avaliação(ões)</p>
        </div>
      </div>
    `;

    // Review form
    html += `
      <div class="review-form" style="border: 1px solid var(--line); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px;">Deixe sua avaliação</h4>
        <div class="star-picker" id="star-picker" style="font-size: 28px; cursor: pointer; margin-bottom: 12px;">
          ${'<span class="star-pick" data-nota="1">☆</span><span class="star-pick" data-nota="2">☆</span><span class="star-pick" data-nota="3">☆</span><span class="star-pick" data-nota="4">☆</span><span class="star-pick" data-nota="5">☆</span>'}
        </div>
        <textarea id="review-comentario" rows="3" placeholder="Conte o que achou do produto..." style="width: 100%; border: 1px solid var(--line); border-radius: var(--radius-md); padding: 10px; font: inherit; resize: vertical;"></textarea>
        <button id="btn-enviar-review" class="btn-primary" style="margin-top: 10px; padding: 10px 24px;">Enviar avaliação</button>
      </div>
    `;

    // List reviews
    if (avaliacoes.length) {
      html += avaliacoes.map((a) => `
        <div style="border-bottom: 1px solid var(--line); padding: 12px 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 14px;">${escapeHtml(a.nome || "Anônimo")}</strong>
            <span style="font-size: 14px;">${renderStars(a.nota)}</span>
          </div>
          ${a.comentario ? `<p style="margin: 6px 0 0; font-size: 14px; color: var(--text);">${escapeHtml(a.comentario)}</p>` : ""}
          <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">${new Date(a.criadoEm).toLocaleDateString("pt-BR")}</p>
        </div>
      `).join("");
    }

    container.innerHTML = html;

    // Star picker interaction
    let notaSelecionada = 0;
    container.querySelectorAll(".star-pick").forEach((star) => {
      star.addEventListener("click", () => {
        notaSelecionada = Number(star.dataset.nota);
        container.querySelectorAll(".star-pick").forEach((s, i) => {
          s.textContent = i < notaSelecionada ? "★" : "☆";
          s.style.color = i < notaSelecionada ? "#f5a623" : "#ccc";
        });
      });
      star.addEventListener("mouseenter", () => {
        const n = Number(star.dataset.nota);
        container.querySelectorAll(".star-pick").forEach((s, i) => {
          s.style.color = i < n ? "#f5a623" : "#ccc";
        });
      });
    });
    container.querySelector(".star-picker")?.addEventListener("mouseleave", () => {
      container.querySelectorAll(".star-pick").forEach((s, i) => {
        s.style.color = i < notaSelecionada ? "#f5a623" : "#ccc";
      });
    });

    // Submit review
    document.getElementById("btn-enviar-review")?.addEventListener("click", async () => {
      if (!notaSelecionada) { showToast("Selecione uma nota de 1 a 5 estrelas.", "error"); return; }
      if (!emailUser) { showToast("Preencha seu perfil em Minha Conta antes de avaliar.", "error"); return; }

      const btn = document.getElementById("btn-enviar-review");
      btn.disabled = true;
      btn.textContent = "Enviando...";

      try {
        const resp = await fetch(getApiUrl("/api/avaliacoes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            email: emailUser,
            nome: perfil.nome || "Anônimo",
            nota: notaSelecionada,
            comentario: document.getElementById("review-comentario")?.value?.trim() || "",
          }),
        });
        const result = await resp.json();
        if (resp.ok && result.success) {
          showToast("Avaliação enviada com sucesso!", "success");
          carregarAvaliacoes(produtoId);
        } else {
          showToast(result.error || "Erro ao enviar avaliação.", "error");
        }
      } catch {
        showToast("Erro de conexão ao enviar avaliação.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Enviar avaliação";
      }
    });
  } catch {
    container.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 24px;">Erro ao carregar avaliações.</p>';
  }
}

function renderStars(nota) {
  const full = Math.round(nota);
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color: ${i < full ? '#f5a623' : '#ddd'}; font-size: 16px;">${i < full ? '★' : '☆'}</span>`
  ).join("");
}

/* ========== Related Products ========== */
async function carregarRelacionados(categoria, idAtual) {
  const container = document.getElementById("produtos-relacionados");
  if (!container) return;

  try {
    const response = await fetch(getApiUrl("/api/produtos"));
    if (!response.ok) return;
    const data = await response.json();
    const produtos = Array.isArray(data) ? data : (data?.produtos || []);

    let relacionados = produtos
      .filter((p) => p.id !== idAtual && p.categoria && p.categoria === categoria)
      .slice(0, 4);

    // Fallback: if less than 2 from same category, fill with random
    if (relacionados.length < 2) {
      const outros = produtos.filter((p) => p.id !== idAtual && !relacionados.find((r) => r.id === p.id));
      relacionados = [...relacionados, ...outros.slice(0, 4 - relacionados.length)];
    }

    if (!relacionados.length) {
      container.closest("section")?.remove();
      return;
    }

    container.innerHTML = relacionados.map((p) => {
      const preco = precoParaNumero(p.preco ?? p.valor ?? 0);
      const img = obterImagensProduto(p)[0] || "img/logo/logo.png";
      return `
        <a href="/produto?id=${encodeURIComponent(p.id)}" class="produto" style="text-decoration: none; color: inherit; text-align: center;">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.nome || '')}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-md);" loading="lazy" onerror="this.onerror=null;this.src='img/logo/logo.png';">
          <h3 style="font-size: 14px; margin: 8px 0 4px; font-weight: 600; text-align: center;">${escapeHtml(p.nome || "Produto")}</h3>
          <p style="font-weight: 700; color: var(--accent); margin: 0; text-align: center;">${formatarMoeda(preco)}</p>
        </a>
      `;
    }).join("");
  } catch {
    container.closest("section")?.remove();
  }
}

/* ========== Image Zoom (desktop) ========== */
function configurarZoom() {
  const container = document.getElementById("zoom-container");
  const lens = document.getElementById("zoom-lens");
  const result = document.getElementById("zoom-result");
  const img = document.getElementById("imagem-principal");
  if (!container || !lens || !result || !img) return;

  const ZOOM = 2.5;

  container.addEventListener("mousemove", (e) => {
    const rect = container.getBoundingClientRect();
    let x = e.clientX - rect.left - lens.offsetWidth / 2;
    let y = e.clientY - rect.top - lens.offsetHeight / 2;
    x = Math.max(0, Math.min(x, rect.width - lens.offsetWidth));
    y = Math.max(0, Math.min(y, rect.height - lens.offsetHeight));
    lens.style.left = x + "px";
    lens.style.top = y + "px";

    result.style.backgroundImage = `url('${img.src}')`;
    result.style.backgroundSize = `${rect.width * ZOOM}px ${rect.height * ZOOM}px`;
    result.style.backgroundPosition = `-${x * ZOOM}px -${y * ZOOM}px`;
  });

  container.addEventListener("mouseleave", () => {
    lens.style.display = "none";
    result.style.display = "none";
  });

  container.addEventListener("mouseenter", () => {
    if (window.innerWidth <= 768) return;
    lens.style.display = "block";
    result.style.display = "block";
  });

  // Mobile: tap to fullscreen
  container.addEventListener("click", () => {
    if (window.innerWidth > 768) return;
    const fs = document.getElementById("zoom-fullscreen");
    const fsImg = document.getElementById("zoom-fullscreen-img");
    if (fs && fsImg) {
      fsImg.src = img.src;
      fs.classList.add("active");
    }
  });

  document.getElementById("zoom-close")?.addEventListener("click", () => {
    document.getElementById("zoom-fullscreen")?.classList.remove("active");
  });

  document.getElementById("zoom-fullscreen")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove("active");
    }
  });
}

/* ========== Sticky Add-to-Cart (mobile) ========== */
function configurarStickyBar(preco) {
  const bar = document.getElementById("sticky-add-bar");
  const precoEl = document.getElementById("sticky-preco");
  const btnOrig = document.getElementById("btn-adicionar-carrinho");
  if (!bar || !btnOrig) return;

  if (precoEl) precoEl.textContent = formatarMoeda(preco);

  const observer = new IntersectionObserver(
    ([entry]) => {
      bar.classList.toggle("visible", !entry.isIntersecting);
    },
    { threshold: 0 }
  );
  observer.observe(btnOrig);

  document.getElementById("sticky-btn-add")?.addEventListener("click", () => {
    btnOrig.click();
  });
}

/* ========== Vistos Recentemente ========== */
function salvarVistoRecentemente(id) {
  if (!id) return;
  const KEY = "zuca_vistos";
  let vistos = JSON.parse(localStorage.getItem(KEY) || "[]");
  vistos = vistos.filter((v) => v !== id);
  vistos.unshift(id);
  if (vistos.length > 8) vistos = vistos.slice(0, 8);
  localStorage.setItem(KEY, JSON.stringify(vistos));
}

// Search bar redirect to index
document.getElementById("btn-search")?.addEventListener("click", () => {
  const q = document.getElementById("search-input")?.value.trim();
  if (q) window.location.href = `/?q=${encodeURIComponent(q)}`;
});
document.getElementById("search-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = e.target.value.trim();
    if (q) window.location.href = `/?q=${encodeURIComponent(q)}`;
  }
});

/* ========== Vistos Recentemente (render) ========== */
async function renderVistosRecentemente() {
  const section = document.getElementById("vistos-recentemente");
  const grid = document.getElementById("vistos-grid");
  if (!section || !grid) return;

  const currentId = new URLSearchParams(window.location.search).get("id");
  const vistos = JSON.parse(localStorage.getItem("zuca_vistos") || "[]").filter((v) => v !== currentId);
  if (!vistos.length) return;

  try {
    const response = await fetch(getApiUrl("/api/produtos"));
    if (!response.ok) return;
    const data = await response.json();
    const produtos = Array.isArray(data) ? data : (data?.produtos || []);

    const itens = vistos
      .map((id) => produtos.find((p) => p.id === id))
      .filter(Boolean)
      .slice(0, 6);

    if (!itens.length) return;

    grid.innerHTML = itens.map((p) => {
      const preco = precoParaNumero(p.preco ?? p.valor ?? 0);
      const img = obterImagensProduto(p)[0] || "img/logo/logo.png";
      return `
        <a href="/produto?id=${encodeURIComponent(p.id)}" class="produto" style="text-decoration: none; color: inherit; text-align: center;">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.nome || '')}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-md);" loading="lazy" onerror="this.onerror=null;this.src='img/logo/logo.png';">
          <h3 style="font-size: 13px; margin: 6px 0 4px; font-weight: 600; text-align: center;">${escapeHtml(p.nome || "Produto")}</h3>
          <p style="font-weight: 700; color: var(--accent); margin: 0; font-size: 14px;">${formatarMoeda(preco)}</p>
        </a>
      `;
    }).join("");
    section.style.display = "";
  } catch { /* silent */ }
}

renderVistosRecentemente();

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

/* ========== Gerador de Receituário por Modelos Prontos ========== */
(async function modelosReceituario() {

  // ─── Mapeamento de fontes disponíveis ──────────────────────────────────
  // Para o canvas (preview): usa a família CSS do Google Fonts (carregada no <head>)
  // Para o PDF (pdf-lib): usa os arquivos TTF em /fonts/
  const FONTES = [
    { label: "Montserrat",       css: "'Montserrat', sans-serif",       ttfRegular: "fonts/Montserrat-Regular.ttf",     ttfBold: "fonts/Montserrat-Bold.ttf" },
    { label: "Lato",             css: "'Lato', sans-serif",             ttfRegular: "fonts/Lato-Regular.ttf",           ttfBold: "fonts/Lato-Bold.ttf" },
    { label: "Poppins",          css: "'Poppins', sans-serif",          ttfRegular: "fonts/Poppins-Regular.ttf",        ttfBold: "fonts/Poppins-Bold.ttf" },
    { label: "Playfair Display", css: "'Playfair Display', serif",      ttfRegular: "fonts/PlayfairDisplay-Regular.ttf", ttfBold: "fonts/PlayfairDisplay-Bold.ttf" },
    { label: "Great Vibes",      css: "'Great Vibes', cursive",         ttfRegular: "fonts/GreatVibes-Regular.ttf",     ttfBold: "fonts/GreatVibes-Regular.ttf" },
  ];

  const btnAbrir     = document.getElementById("btn-abrir-modelos");
  const modal        = document.getElementById("modal-modelos");
  const btnFechar    = document.getElementById("btn-fechar-modelos");
  const backdrop     = modal?.querySelector(".arte-modal-backdrop");
  const etapa1       = document.getElementById("modelos-etapa-1");
  const etapa2       = document.getElementById("modelos-etapa-2");
  const galeria      = document.getElementById("modelos-galeria");
  const btnVoltar    = document.getElementById("btn-modelos-voltar");
  const canvas       = document.getElementById("modelos-canvas");
  const btnPdf       = document.getElementById("btn-mod-pdf");
  const btnUsar      = document.getElementById("btn-mod-usar");
  const semImagem    = document.getElementById("modelos-sem-imagem");
  const camposContainer = document.getElementById("modelos-campos-container");

  if (!btnAbrir || !modal || !canvas) return;

  const ctx = canvas.getContext("2d");

  // ─── Estado global ─────────────────────────────────────────────────────
  let modeloAtual   = null;  // objeto do modelo selecionado
  let logoDataUrl   = null;  // data URL da logo carregada pelo usuário
  let logoImg       = null;  // HTMLImageElement da logo
  let templateImg   = null;  // HTMLImageElement do template atual
  let campos        = [];    // array de objetos de campo editáveis
  let campoSelecionado = -1; // índice do campo sendo arrastado (-1 = nenhum)
  let logoZone      = null;  // cópia editável de modeloAtual.logoZone { x,y,w,h }
  let logoSelecionada = false;
  let logoAcao      = null;  // null | 'mover' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br'
  let dragOffset    = { x: 0, y: 0 };
  let dragStart     = { x: 0, y: 0, lx: 0, ly: 0, lw: 0, lh: 0 }; // snapshot no início do resize
  let isDragging    = false;
  let modelos       = [...RECEITUARIO_MODELOS]; // começa com fallback estático; substituído pelo fetch

  // ─── Abrir / Fechar modal ───────────────────────────────────────────────
  function abrirModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function fecharModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  btnAbrir.addEventListener("click", abrirModal);
  btnFechar.addEventListener("click", fecharModal);
  backdrop?.addEventListener("click", fecharModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) fecharModal();
  });

  // ─── Etapa 1: Galeria ──────────────────────────────────────────────────
  function renderizarGaleria() {
    galeria.innerHTML = "";
    if (!modelos.length) {
      galeria.innerHTML = "<p style='color:#888;text-align:center'>Nenhum modelo disponível no momento.</p>";
      return;
    }
    modelos.forEach((modelo) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "modelos-card";
      card.dataset.id = modelo.id;
      card.innerHTML = `
        <img src="${modelo.thumbnail}" alt="${modelo.nome}" class="modelos-card-thumb"
             onerror="this.style.background='#e8e0d8';this.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='">
        <span class="modelos-card-nome">${modelo.nome}</span>
      `;
      card.addEventListener("click", () => selecionarModelo(modelo));
      galeria.appendChild(card);
    });
  }
  // ─── Carregar modelos dinamicamente da API ────────────────────────────
  try {
    const resp = await fetch(getApiUrl("/api/produtos"));
    if (resp.ok) {
      const data = await resp.json();
      const lista = (Array.isArray(data) ? data : data.produtos ?? []).filter((p) => p.ehModelo);
      if (lista.length > 0) {
        modelos = lista.map((p) => ({
          id:        p.id,
          nome:      p.modeloNome || p.nome,
          thumbnail: Array.isArray(p.imagens) && p.imagens[0] ? p.imagens[0] : (p.modeloConfig?.imagem || ""),
          imagem:    Array.isArray(p.imagens) && p.imagens[0] ? p.imagens[0] : (p.modeloConfig?.imagem || ""),
          logoZone:  p.modeloConfig?.logoZone || { x: 0, y: 0, w: 100, h: 100 },
          campos:    p.modeloConfig?.campos   || {},
        }));
      }
    }
  } catch { /* ignora falha — usa fallback estático */ }

  renderizarGaleria();

  // ─── Etapa 2: Seleção de modelo ────────────────────────────────────────
  async function selecionarModelo(modelo) {
    modeloAtual = modelo;
    templateImg = null;
    campoSelecionado = -1;
    logoZone = modelo.logoZone ? { ...modelo.logoZone } : null;
    logoSelecionada = false;
    logoAcao = null;

    // Converter campos do modelo em array de estado editável
    campos = Object.entries(modelo.campos).map(([key, cfg]) => ({
      key,
      label: { nome: "Nome do profissional", especialidade: "Especialidade / Profissão",
               telefone: "Telefone / WhatsApp", email: "E-mail", endereco: "Endereço / Cidade" }[key] || key,
      placeholder: { nome: "Ex: Dra. Ana Paula Silva", especialidade: "Ex: Biomédica Esteta · CRBM 1234",
                     telefone: "Ex: (67) 99999-0000", email: "Ex: contato@clinica.com.br",
                     endereco: "Ex: Rua das Flores, 100 – Campo Grande/MS" }[key] || "",
      maxlength: { nome: 80, especialidade: 100, telefone: 20, email: 100, endereco: 120 }[key] || 100,
      inputType: { email: "email", telefone: "tel" }[key] || "text",
      text: "",
      x: cfg.x,
      y: cfg.y,
      fontSize: cfg.fontSize,
      fontFamily: cfg.fontFamily || "Montserrat",
      color: cfg.color,
      align: cfg.align || "center",
      maxWidth: cfg.maxWidth,
      fontWeight: cfg.fontWeight || "400",
    }));

    galeria.querySelectorAll(".modelos-card").forEach((c) => {
      c.classList.toggle("modelos-card--ativo", c.dataset.id === modelo.id);
    });

    etapa1.hidden = true;
    etapa2.hidden = false;

    // Renderizar cards de campo no formulário
    renderizarCamposForm();

    // Carregar template
    try {
      templateImg = await carregarImagem(modelo.imagem);
      if (semImagem) semImagem.style.display = "none";
    } catch {
      if (semImagem) {
        semImagem.style.display = "";
        semImagem.textContent = "⚠️ Imagem do modelo não encontrada. Adicione o arquivo em img/modelos/.";
      }
      limparCanvas();
      return;
    }

    renderizarPreview();
  }

  btnVoltar?.addEventListener("click", () => {
    etapa1.hidden = false;
    etapa2.hidden = true;
    campoSelecionado = -1;
  });

  // ─── Renderizar cards de campo no formulário ───────────────────────────
  function renderizarCamposForm() {
    // Remover cards antigos (manter os elementos estáticos logo+acoes)
    camposContainer.querySelectorAll(".campo-card:not(.campo-card--logo)").forEach((el) => el.remove());

    // Inserir antes do card de logo
    const logoCard = camposContainer.querySelector(".campo-card--logo");

    campos.forEach((campo, idx) => {
      const card = document.createElement("div");
      card.className = "campo-card";
      card.dataset.idx = idx;

      const fonteOptions = FONTES.map((f) =>
        `<option value="${f.label}" ${f.label === campo.fontFamily ? "selected" : ""}>${f.label}</option>`
      ).join("");

      card.innerHTML = `
        <div class="campo-card-topo">
          <span class="campo-card-label">${campo.label}</span>
          <div class="campo-card-badge" id="campo-badge-${idx}"></div>
        </div>
        <input
          class="campo-card-input"
          type="${campo.inputType}"
          placeholder="${campo.placeholder}"
          maxlength="${campo.maxlength}"
          value="${campo.text}"
          data-idx="${idx}"
        >
        <div class="campo-card-controles">
          <div class="campo-ctrl-grupo">
            <label class="campo-ctrl-label">Fonte</label>
            <select class="campo-card-fonte" data-idx="${idx}">${fonteOptions}</select>
          </div>
          <div class="campo-ctrl-grupo">
            <label class="campo-ctrl-label">X</label>
            <input class="campo-card-xy" type="number" min="0" max="420" value="${Math.round(campo.x)}" data-axis="x" data-idx="${idx}">
          </div>
          <div class="campo-ctrl-grupo">
            <label class="campo-ctrl-label">Y</label>
            <input class="campo-card-xy" type="number" min="0" max="594" value="${Math.round(campo.y)}" data-axis="y" data-idx="${idx}">
          </div>
        </div>
      `;

      camposContainer.insertBefore(card, logoCard);

      // Eventos
      card.querySelector(".campo-card-input").addEventListener("input", (e) => {
        campos[idx].text = e.target.value;
        renderizarPreview();
      });

      card.querySelector(".campo-card-fonte").addEventListener("change", (e) => {
        campos[idx].fontFamily = e.target.value;
        renderizarPreview();
      });

      card.querySelectorAll(".campo-card-xy").forEach((input) => {
        input.addEventListener("input", (e) => {
          const axis = e.target.dataset.axis;
          const val = parseFloat(e.target.value) || 0;
          campos[idx][axis] = val;
          renderizarPreview();
        });
      });
    });
  }

  // ─── Atualizar inputs X/Y após arrastar ────────────────────────────────
  function sincronizarInputsXY(idx) {
    const card = camposContainer.querySelector(`.campo-card[data-idx="${idx}"]`);
    if (!card) return;
    card.querySelector("[data-axis='x']").value = Math.round(campos[idx].x);
    card.querySelector("[data-axis='y']").value = Math.round(campos[idx].y);
  }

  // ─── Logo ───────────────────────────────────────────────────────────────
  document.getElementById("mod-logo")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) { logoDataUrl = null; logoImg = null; renderizarPreview(); return; }
    if (file.size > 2 * 1024 * 1024) {
      alert("A logo deve ter no máximo 2 MB.");
      e.target.value = "";
      return;
    }
    logoDataUrl = await lerArquivoComoDataUrl(file);
    logoImg = await carregarImagem(logoDataUrl);
    renderizarPreview();
  });

  // ─── Renderização no canvas de preview (420×594) ───────────────────────
  function renderizarPreview() {
    if (!modeloAtual || !templateImg) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Template de fundo
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

    // 2. Logo
    if (logoImg && logoZone) {
      const { x, y, w, h } = logoZone;
      const scale = Math.min(w / logoImg.width, h / logoImg.height);
      const lw = logoImg.width * scale;
      const lh = logoImg.height * scale;
      ctx.drawImage(logoImg, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);

      // Moldura + alças de resize quando selecionada
      if (logoSelecionada) {
        const ALCA = 8;
        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        // 4 alças nos cantos
        ctx.fillStyle = "#2563eb";
        [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => {
          ctx.fillRect(cx - ALCA / 2, cy - ALCA / 2, ALCA, ALCA);
        });
        ctx.restore();
      }
    }

    // 3. Textos
    campos.forEach((campo, idx) => {
      if (!campo.text) return;
      const fonte = FONTES.find((f) => f.label === campo.fontFamily) || FONTES[0];
      const peso = campo.fontWeight === "700" ? "bold" : "normal";
      ctx.font = `${peso} ${campo.fontSize}px ${fonte.css}`;
      ctx.fillStyle = campo.color;
      ctx.textAlign = campo.align;
      ctx.textBaseline = "middle";

      let textoFinal = campo.text;
      if (ctx.measureText(textoFinal).width > campo.maxWidth) {
        while (textoFinal.length > 1 && ctx.measureText(textoFinal + "…").width > campo.maxWidth) {
          textoFinal = textoFinal.slice(0, -1);
        }
        textoFinal += "…";
      }

      ctx.fillText(textoFinal, campo.x, campo.y);

      // Destaque do campo selecionado
      if (idx === campoSelecionado) {
        const w = Math.min(ctx.measureText(textoFinal).width, campo.maxWidth);
        let rx = campo.x;
        if (campo.align === "center")     rx -= w / 2;
        else if (campo.align === "right") rx -= w;
        const pad = 4;
        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx - pad, campo.y - campo.fontSize / 2 - pad, w + pad * 2, campo.fontSize + pad * 2);
        ctx.setLineDash([]);
        ctx.restore();
      }
    });
  }

  function limparCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5f0ea";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#bbb";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Selecione um modelo para visualizar", canvas.width / 2, canvas.height / 2);
  }
  limparCanvas();

  // ─── Drag & Drop no canvas ─────────────────────────────────────────────
  function canvasCoordenadas(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  function encontrarCampoNoClick(cx, cy) {
    // Percorre de trás para frente (último campo fica por cima visualmente)
    for (let i = campos.length - 1; i >= 0; i--) {
      const c = campos[i];
      if (!c.text) continue;
      ctx.font = `${c.fontWeight === "700" ? "bold" : "normal"} ${c.fontSize}px ${(FONTES.find((f) => f.label === c.fontFamily) || FONTES[0]).css}`;
      const tw = Math.min(ctx.measureText(c.text).width, c.maxWidth);
      let rx = c.x;
      if (c.align === "center")     rx -= tw / 2;
      else if (c.align === "right") rx -= tw;
      const pad = 8;
      if (cx >= rx - pad && cx <= rx + tw + pad &&
          cy >= c.y - c.fontSize / 2 - pad && cy <= c.y + c.fontSize / 2 + pad) {
        return i;
      }
    }
    return -1;
  }

  const ALCA = 8; // tamanho da alça de resize em px

  function detectarAcaoLogo(cx, cy) {
    if (!logoZone || !logoImg) return null;
    const { x, y, w, h } = logoZone;
    // Verificar cantos primeiro (prioridade sobre mover)
    const cantos = [
      { nome: "resize-tl", px: x,     py: y     },
      { nome: "resize-tr", px: x + w, py: y     },
      { nome: "resize-bl", px: x,     py: y + h },
      { nome: "resize-br", px: x + w, py: y + h },
    ];
    for (const c of cantos) {
      if (Math.abs(cx - c.px) <= ALCA && Math.abs(cy - c.py) <= ALCA) return c.nome;
    }
    // Mover: dentro do retângulo
    if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) return "mover";
    return null;
  }

  function onMouseDown(e) {
    const { x, y } = canvasCoordenadas(e);

    // Verificar logo primeiro (drag/resize)
    if (logoImg && logoZone) {
      const acao = logoSelecionada ? detectarAcaoLogo(x, y) : (x >= logoZone.x && x <= logoZone.x + logoZone.w && y >= logoZone.y && y <= logoZone.y + logoZone.h ? "mover" : null);
      if (acao) {
        logoSelecionada = true;
        logoAcao = acao;
        isDragging = true;
        campoSelecionado = -1;
        dragOffset = { x: x - logoZone.x, y: y - logoZone.y };
        dragStart  = { x, y, lx: logoZone.x, ly: logoZone.y, lw: logoZone.w, lh: logoZone.h };
        canvas.classList.add("modelos-canvas-arrastando");
        renderizarPreview();
        e.preventDefault();
        return;
      }
    }

    // Verificar campos de texto
    const idx = encontrarCampoNoClick(x, y);
    campoSelecionado = idx;
    logoSelecionada = false;
    if (idx >= 0) {
      isDragging = true;
      dragOffset = { x: x - campos[idx].x, y: y - campos[idx].y };
      canvas.classList.add("modelos-canvas-arrastando");
      camposContainer.querySelectorAll(".campo-card[data-idx]").forEach((el) => {
        el.classList.toggle("campo-card--ativo", parseInt(el.dataset.idx) === idx);
      });
    } else {
      // Clicou em área vazia — deselecionar logo
      logoSelecionada = false;
    }
    renderizarPreview();
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const { x, y } = canvasCoordenadas(e);

    if (logoAcao && logoZone) {
      const MIN = 20;
      if (logoAcao === "mover") {
        logoZone.x = Math.max(0, Math.min(canvas.width  - logoZone.w, x - dragOffset.x));
        logoZone.y = Math.max(0, Math.min(canvas.height - logoZone.h, y - dragOffset.y));
      } else {
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        if (logoAcao === "resize-br") {
          logoZone.w = Math.max(MIN, dragStart.lw + dx);
          logoZone.h = Math.max(MIN, dragStart.lh + dy);
        } else if (logoAcao === "resize-bl") {
          const nw = Math.max(MIN, dragStart.lw - dx);
          logoZone.x = dragStart.lx + (dragStart.lw - nw);
          logoZone.w = nw;
          logoZone.h = Math.max(MIN, dragStart.lh + dy);
        } else if (logoAcao === "resize-tr") {
          logoZone.w = Math.max(MIN, dragStart.lw + dx);
          const nh = Math.max(MIN, dragStart.lh - dy);
          logoZone.y = dragStart.ly + (dragStart.lh - nh);
          logoZone.h = nh;
        } else if (logoAcao === "resize-tl") {
          const nw = Math.max(MIN, dragStart.lw - dx);
          const nh = Math.max(MIN, dragStart.lh - dy);
          logoZone.x = dragStart.lx + (dragStart.lw - nw);
          logoZone.y = dragStart.ly + (dragStart.lh - nh);
          logoZone.w = nw;
          logoZone.h = nh;
        }
      }
      renderizarPreview();
      e.preventDefault();
      return;
    }

    if (campoSelecionado < 0) return;
    campos[campoSelecionado].x = Math.max(0, Math.min(canvas.width,  x - dragOffset.x));
    campos[campoSelecionado].y = Math.max(0, Math.min(canvas.height, y - dragOffset.y));
    sincronizarInputsXY(campoSelecionado);
    renderizarPreview();
    e.preventDefault();
  }

  function onMouseUp() {
    isDragging = false;
    logoAcao = null;
    canvas.classList.remove("modelos-canvas-arrastando");
  }

  canvas.addEventListener("mousedown",  onMouseDown, { passive: false });
  canvas.addEventListener("mousemove",  onMouseMove, { passive: false });
  canvas.addEventListener("mouseup",    onMouseUp);
  canvas.addEventListener("mouseleave", onMouseUp);
  canvas.addEventListener("touchstart", onMouseDown, { passive: false });
  canvas.addEventListener("touchmove",  onMouseMove, { passive: false });
  canvas.addEventListener("touchend",   onMouseUp);

  // ─── Exportar PDF via pdf-lib (texto vetorial, fontes incorporadas) ────
  btnPdf?.addEventListener("click", async () => {
    if (!modeloAtual || !templateImg) {
      alert("Selecione e preencha um modelo antes de gerar o PDF.");
      return;
    }
    const PDFLib = window.PDFLib;
    if (!PDFLib) {
      alert("Erro: biblioteca de PDF não carregada. Recarregue a página.");
      return;
    }

    btnPdf.disabled = true;
    btnPdf.textContent = "⏳ Gerando…";

    try {
      const { PDFDocument, rgb } = PDFLib;

      // A4 em pontos
      const PDF_W = 595.28, PDF_H = 841.89;
      const SCALE = PDF_W / canvas.width;
      const toPdfX = (cx) => cx * SCALE;
      const toPdfY = (cy) => PDF_H - cy * SCALE;

      const pdfDoc = await PDFDocument.create();
      const page   = pdfDoc.addPage([PDF_W, PDF_H]);

      // Template de fundo
      const templateBytes = await (await fetch(modeloAtual.imagem)).arrayBuffer();
      const isTemplatePng = modeloAtual.imagem.toLowerCase().endsWith(".png");
      const templatePdfImg = isTemplatePng
        ? await pdfDoc.embedPng(templateBytes)
        : await pdfDoc.embedJpg(templateBytes);
      page.drawImage(templatePdfImg, { x: 0, y: 0, width: PDF_W, height: PDF_H });

      // Logo
      if (logoDataUrl && logoZone) {
        const logoBytes = dataUrlParaUint8Array(logoDataUrl);
        const logoIspng = logoDataUrl.startsWith("data:image/png");
        const logoPdfImg = logoIspng ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
        const { x: lx, y: ly, w: lw, h: lh } = logoZone;
        const pdfLW = lw * SCALE, pdfLH = lh * SCALE;
        const s = Math.min(pdfLW / logoPdfImg.width, pdfLH / logoPdfImg.height);
        const fw = logoPdfImg.width * s, fh = logoPdfImg.height * s;
        page.drawImage(logoPdfImg, {
          x: toPdfX(lx) + (pdfLW - fw) / 2,
          y: toPdfY(ly + lh) + (pdfLH - fh) / 2,
          width: fw, height: fh,
        });
      }

      // Cache de fontes PDF já carregadas nesta sessão
      const fontCache = {};
      async function getPdfFont(fontLabel, bold) {
        const fonte = FONTES.find((f) => f.label === fontLabel) || FONTES[0];
        const cacheKey = fontLabel + (bold ? "_bold" : "_reg");
        if (fontCache[cacheKey]) return fontCache[cacheKey];
        const ttfUrl  = bold ? fonte.ttfBold : fonte.ttfRegular;
        const bytes   = await (await fetch(ttfUrl)).arrayBuffer();
        const embedded = await pdfDoc.embedFont(new Uint8Array(bytes));
        fontCache[cacheKey] = embedded;
        return embedded;
      }

      function hexParaRgb(hex) {
        return rgb(
          parseInt(hex.slice(1, 3), 16) / 255,
          parseInt(hex.slice(3, 5), 16) / 255,
          parseInt(hex.slice(5, 7), 16) / 255,
        );
      }

      for (const campo of campos) {
        if (!campo.text) continue;
        const bold    = campo.fontWeight === "700";
        const font    = await getPdfFont(campo.fontFamily, bold);
        const fsz     = Math.round(campo.fontSize * SCALE);
        const maxW    = campo.maxWidth * SCALE;
        const color   = hexParaRgb(campo.color);

        let texto = campo.text;
        if (font.widthOfTextAtSize(texto, fsz) > maxW) {
          while (texto.length > 1 && font.widthOfTextAtSize(texto + "…", fsz) > maxW) {
            texto = texto.slice(0, -1);
          }
          texto += "…";
        }

        const tw = font.widthOfTextAtSize(texto, fsz);
        let drawX = toPdfX(campo.x);
        if (campo.align === "center")     drawX -= tw / 2;
        else if (campo.align === "right") drawX -= tw;

        page.drawText(texto, {
          x: drawX,
          y: toPdfY(campo.y) - fsz / 2,
          font, size: fsz, color,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement("a"), { href: url });
      const nome = campos.find((c) => c.key === "nome")?.text?.trim() || "receituario";
      a.download = `receituario-${nome.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
      console.error(err);
    } finally {
      btnPdf.disabled = false;
      btnPdf.textContent = "⬇️ Baixar PDF";
    }
  });

  // ─── Usar como Arte ────────────────────────────────────────────────────
  btnUsar?.addEventListener("click", () => {
    if (!modeloAtual || !templateImg) {
      alert("Selecione e preencha um modelo antes de usar como arte.");
      return;
    }
    canvas.toBlob((blob) => {
      const file = new File([blob], `receituario-${modeloAtual.id}.png`, { type: "image/png" });
      const dt   = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById("arquivo-personalizacao");
      if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      fecharModal();
      showToast?.("Arte adicionada! Clique em 'Adicionar ao carrinho' para continuar.", "success");
    }, "image/png");
  });

  // ─── Utilitários ───────────────────────────────────────────────────────
  function carregarImagem(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
      img.src = src;
    });
  }

  function lerArquivoComoDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.readAsDataURL(file);
    });
  }

  function dataUrlParaUint8Array(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
})();
