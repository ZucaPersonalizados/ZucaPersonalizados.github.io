const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

const ORIGIN_BASE = window.location.origin.replace(/\/$/, "");
const API_BASES = [...new Set([API_BASE, ORIGIN_BASE].filter(Boolean))];

function getApiUrl(path, base = API_BASE) {
  return `${base}${path}`;
}

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23e8dbcb'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23b59273'/%3E%3Cpath d='M12 56c3-11 12-17 20-17s17 6 20 17' fill='%23b59273'/%3E%3C/svg%3E";

/* ========== Toast Notification System ========== */
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

/** Retorna dados do usuário logado ou null se não logado */
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
  } catch {
    return null;
  }
}

/** Limpa todos os dados de sessão do usuário */
function limparSessaoUsuario() {
  ["zuca_checkout_cliente", "zuca_perfil", "zuca_avatar_url", "zuca_checkout_cliente_nome"].forEach(
    (k) => localStorage.removeItem(k)
  );
}

/** Constrói e injeta o conteúdo do dropdown com base no estado de login */
function atualizarMenuUsuario() {
  const btnAvatar = document.getElementById("btn-avatar");
  const dropdown = document.getElementById("avatar-dropdown");
  const avatarImg = document.getElementById("avatar-image");
  if (!btnAvatar || !dropdown) return;

  const usuario = getUsuarioLogado();

  // ── Botão avatar ──
  if (usuario) {
    btnAvatar.classList.remove("nao-logado");
    const label = btnAvatar.querySelector(".avatar-btn-label");
    if (label) label.remove();
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

  // ── Conteúdo do dropdown (apenas HTML, sem event listeners) ──
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
        <a class="avatar-dd-item" href="/minha-conta" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Minha conta
        </a>
        <a class="avatar-dd-item" href="/minha-conta#pedidos" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
          Meus pedidos
        </a>
        <div class="avatar-dd-divider"></div>
        <button class="avatar-dd-item sair" type="button" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </div>`;
  } else {
    dropdown.innerHTML = `
      <div class="avatar-dd-promo">
        <p>Faça login para ver seus pedidos e salvar seus dados.</p>
        <a class="avatar-dd-btn-entrar" href="/minha-conta" role="menuitem">Entrar</a>
      </div>
      <div class="avatar-dd-lista">
        <a class="avatar-dd-item" href="/minha-conta#pedidos" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
          Meus pedidos
        </a>
      </div>`;
  }
}

/** @deprecated use atualizarMenuUsuario() */
function atualizarAvatarHeader() {
  atualizarMenuUsuario();
}

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

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error("Falha ao conectar com a API");
}

let filtros = {
  categoria: "todos",
  tipo: "todos",
  tamanho: "todos",
  gramatura: "todos"
};

let categoriasDisponiveis = [];
let todosProdutos = [];
let searchQuery = "";
let sortMode = "relevancia";
let currentPage = 1;
const ITEMS_PER_PAGE = 12;

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
  atualizarBotoesWishlist();
}

function isWishlisted(id) {
  return getWishlist().includes(id);
}

function atualizarBotoesWishlist() {
  document.querySelectorAll(".wishlist-btn-card").forEach((btn) => {
    const id = btn.dataset.produtoId;
    btn.classList.toggle("active", isWishlisted(id));
    btn.textContent = isWishlisted(id) ? "♥" : "♡";
  });
}

function normalizarSlug(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function escapeForInline(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatar(texto = "") {
  const chave = normalizarSlug(texto);
  const mapa = {
    crianca: "Criança",
    receituario: "Receituário",
    "bloco-receituario": "Bloco Receituário",
    planner: "Planner",
    agendas: "Agendas",
    agenda: "Agenda",
    miolo: "Miolo",
    "miolo-agenda": "Miolo de Agenda",
    refil: "Refil",
    refis: "Refis",
    "caderno-disco": "Caderno de Disco",
    "cadernos-de-disco": "Cadernos de Disco",
    "refil-caderno-disco": "Refil de Caderno de Disco",
    "wire-o": "Wire-o",
    "caderno-wire-o": "Caderno Wire-o",
    "apostila-espiral": "Apostila de Espiral",
    calendario: "Calendário",
    calendarios: "Calendários",
    minimalista: "Minimalista"
  };

  if (mapa[chave]) {
    return mapa[chave];
  }

  const limpo = String(texto).replace(/[-_]+/g, " ").trim();
  if (!limpo) {
    return "";
  }

  return limpo
    .split(" ")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

function normalizarLink(url = "") {
  const valor = String(url).trim();

  if (!valor) {
    return "#";
  }

  if (/^(https?:\/\/|\/|#)/i.test(valor)) {
    return valor;
  }

  return "#";
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

  return false;
}

function obterImagensProduto(produto = {}) {
  if (Array.isArray(produto.imagens)) {
    const lista = produto.imagens.map((img) => String(img || "").trim()).filter(Boolean);
    if (lista.length) return lista;
  }

  if (typeof produto.imagens === "string") {
    const lista = produto.imagens.split(",").map((img) => img.trim()).filter(Boolean);
    if (lista.length) return lista;
  }

  const candidatas = [produto.imagem, produto.imagemUrl, produto.foto]
    .map((img) => String(img || "").trim())
    .filter(Boolean);

  if (candidatas.length) return candidatas;
  return ["img/logo/logo.png"];
}

function renderizarCategoriasDesktop() {
  const lista = document.getElementById("filtro-categorias");

  if (!lista) {
    return;
  }

  lista.innerHTML = `
    <li class="${filtros.categoria === "todos" ? "ativo" : ""}" data-categoria="todos" onclick="filtrarCategoria('todos', event)">Todos</li>
    ${categoriasDisponiveis.map((categoria) => `
      <li
        class="${filtros.categoria === categoria ? "ativo" : ""}"
        data-categoria="${escapeHtml(categoria)}"
        onclick="filtrarCategoria('${escapeForInline(categoria)}', event)">
        ${escapeHtml(formatar(categoria))}
      </li>
    `).join("")}
  `;
}

function aplicarFiltro() {
  currentPage = 1;
  renderProdutosFiltrados();
}

function gerarFiltros(categoria) {
  const container = document.getElementById("filtros-dinamicos");

  if (!container) {
    return;
  }

  if (categoria === "todos") {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";

  const produtos = document.querySelectorAll(".produto");
  const tipos = new Set();
  const tamanhos = new Set();
  const gramaturas = new Set();

  produtos.forEach((produto) => {
    if (produto.dataset.categoria !== categoria) {
      return;
    }

    if (produto.dataset.subcategoria) tipos.add(produto.dataset.subcategoria);
    if (produto.dataset.tamanho) tamanhos.add(produto.dataset.tamanho);
    if (produto.dataset.gramatura) gramaturas.add(produto.dataset.gramatura);
  });

  if (tipos.size > 0) {
    container.innerHTML += `
      <h3 class="filtro-titulo">Tipo</h3>
      <ul class="filtro-lista">
        <li class="${filtros.tipo === "todos" ? "ativo" : ""}" onclick="setFiltro('tipo','todos', event)">Todos</li>
        ${[...tipos].sort((a, b) => a.localeCompare(b, "pt-BR")).map((t) => `
          <li class="${filtros.tipo === t ? "ativo" : ""}" onclick="setFiltro('tipo','${escapeForInline(t)}', event)">${escapeHtml(formatar(t))}</li>
        `).join("")}
      </ul>
    `;
  }

  if (tamanhos.size > 0) {
    container.innerHTML += `
      <h3 class="filtro-titulo">Tamanho</h3>
      <ul class="filtro-lista">
        <li class="${filtros.tamanho === "todos" ? "ativo" : ""}" onclick="setFiltro('tamanho','todos', event)">Todos</li>
        ${[...tamanhos].sort((a, b) => a.localeCompare(b, "pt-BR")).map((t) => `
          <li class="${filtros.tamanho === t ? "ativo" : ""}" onclick="setFiltro('tamanho','${escapeForInline(t)}', event)">${escapeHtml(formatar(t))}</li>
        `).join("")}
      </ul>
    `;
  }

  if (gramaturas.size > 0) {
    container.innerHTML += `
      <h3 class="filtro-titulo">Gramatura</h3>
      <ul class="filtro-lista">
        <li class="${filtros.gramatura === "todos" ? "ativo" : ""}" onclick="setFiltro('gramatura','todos', event)">Todos</li>
        ${[...gramaturas].sort((a, b) => a.localeCompare(b, "pt-BR")).map((g) => `
          <li class="${filtros.gramatura === g ? "ativo" : ""}" onclick="setFiltro('gramatura','${escapeForInline(g)}', event)">${escapeHtml(formatar(g))}</li>
        `).join("")}
      </ul>
    `;
  }
}

function filtrarCategoria(cat, e) {
  filtros = {
    categoria: cat,
    tipo: "todos",
    tamanho: "todos",
    gramatura: "todos"
  };

  document.querySelectorAll("#filtro-categorias li").forEach((li) => li.classList.remove("ativo"));
  document.querySelectorAll("#filtros-dinamicos li").forEach((li) => li.classList.remove("ativo"));

  if (e?.target) {
    e.target.classList.add("ativo");
  } else {
    const selecionado = document.querySelector(`#filtro-categorias li[data-categoria="${cat}"]`);
    selecionado?.classList.add("ativo");
  }

  gerarFiltros(cat);
  aplicarFiltro();
}

function gerarFiltrosMobile() {
  const container = document.getElementById("mobile-filtros-extra");

  if (!container) {
    return;
  }

  gerarFiltros(filtros.categoria);
  container.innerHTML = document.getElementById("filtros-dinamicos")?.innerHTML || "";
}

function selecionarCategoriaMobile(cat, e) {
  filtros.categoria = cat;
  filtros.tipo = "todos";
  filtros.tamanho = "todos";
  filtros.gramatura = "todos";

  if (e?.target?.parentElement) {
    e.target.parentElement.querySelectorAll("li").forEach((li) => li.classList.remove("ativo"));
    e.target.classList.add("ativo");
  }

  gerarFiltrosMobile();
  aplicarFiltro();
}

function abrirFiltro() {
  const modal = document.getElementById("filtro-mobile");
  const container = document.getElementById("filtros-dinamicos-mobile");

  if (!modal || !container) {
    return;
  }

  modal.classList.add("ativo");

  container.innerHTML = `
    <h3 class="filtro-titulo">Categoria</h3>
    <ul class="filtro-lista">
      <li class="${filtros.categoria === "todos" ? "ativo" : ""}" onclick="selecionarCategoriaMobile('todos', event)">Todos</li>
      ${categoriasDisponiveis.map((categoria) => `
        <li class="${filtros.categoria === categoria ? "ativo" : ""}" onclick="selecionarCategoriaMobile('${escapeForInline(categoria)}', event)">${escapeHtml(formatar(categoria))}</li>
      `).join("")}
    </ul>
    <div id="mobile-filtros-extra"></div>
  `;

  if (filtros.categoria !== "todos") {
    gerarFiltrosMobile();
  }
}

function setFiltro(tipo, valor, e) {
  filtros[tipo] = valor;
  aplicarFiltro();

  if (document.getElementById("filtro-mobile")?.classList.contains("ativo")) {
    gerarFiltrosMobile();
  }

  if (e?.target) {
    const lista = e.target.parentElement;
    if (lista) {
      lista.querySelectorAll("li").forEach((li) => li.classList.remove("ativo"));
    }
    e.target.classList.add("ativo");
  }
}

function fecharFiltro() {
  document.getElementById("filtro-mobile")?.classList.remove("ativo");
}

function abrirProduto(id) {
  const idSeguro = encodeURIComponent(String(id || ""));
  window.location.href = `/produto?id=${idSeguro}`;
}

function obterCarrinho() {
  try {
    return JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  } catch {
    return [];
  }
}

function salvarCarrinho(itens) {
  localStorage.setItem("zuca_carrinho", JSON.stringify(itens));
  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();
  atualizarBotoesCarrinho();
}

function encontrarProdutoNoCarrinho(produtoId) {
  return obterCarrinho().find((item) => item.id === produtoId);
}

function adicionarAoCarrinho(produto) {
  if (produto?.personalizado) {
    showToast("Este item é personalizado. Abra o produto e anexe o arquivo antes de adicionar ao carrinho.", "warning", 5000);
    abrirProduto(produto.id);
    return;
  }

  const carrinho = obterCarrinho();
  const existente = encontrarProdutoNoCarrinho(produto.id);

  if (existente) {
    existente.quantidade += 1;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: produto.imagens?.[0] || "",
      quantidade: 1
    });
  }

  salvarCarrinho(carrinho);
  showToast(`"${produto.nome}" adicionado ao carrinho!`, "success");
}

function aumentarQuantidadeCarrinho(produtoId) {
  const carrinho = obterCarrinho();
  const existente = carrinho.find((item) => item.id === produtoId);
  
  if (existente) {
    existente.quantidade += 1;
    salvarCarrinho(carrinho);
  }
}

function diminuirQuantidadeCarrinho(produtoId) {
  const carrinho = obterCarrinho();
  const existente = carrinho.find((item) => item.id === produtoId);
  
  if (existente) {
    if (existente.quantidade > 1) {
      existente.quantidade -= 1;
      salvarCarrinho(carrinho);
    } else {
      removerDoCarrinho(produtoId);
    }
  }
}

function removerDoCarrinho(produtoId) {
  const carrinho = obterCarrinho().filter((item) => item.id !== produtoId);
  salvarCarrinho(carrinho);
}

function atualizarBotoesCarrinho() {
  const produtos = document.querySelectorAll(".produto");
  const carrinho = obterCarrinho();
  
  produtos.forEach((produtoEl) => {
    const produtoId = produtoEl.dataset.id;
    const produtoPersonalizado = produtoEl.dataset.personalizado === "true";
    const itemNoCarrinho = carrinho.find((item) => item.id === produtoId);
    const containerBotoes = produtoEl.querySelector(".product-buttons-container");
    
    if (!containerBotoes) return;
    
    containerBotoes.innerHTML = "";
    
    if (produtoPersonalizado) {
      containerBotoes.innerHTML = `
        <button class="btn-carrinho" type="button">
          Personalizar e anexar arquivo
        </button>
      `;

      const btnPersonalizar = containerBotoes.querySelector(".btn-carrinho");
      btnPersonalizar?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirProduto(produtoId);
      });
    } else if (itemNoCarrinho) {
      containerBotoes.innerHTML = `
        <div class="cart-quantity-control">
          <button class="btn-qty-decrease" type="button" aria-label="Diminuir quantidade">−</button>
          <span class="qty-display">${itemNoCarrinho.quantidade}</span>
          <button class="btn-qty-increase" type="button" aria-label="Aumentar quantidade">+</button>
          <button class="btn-remover" type="button" aria-label="Remover do carrinho">🗑️</button>
        </div>
      `;
      
      const btnDecrease = containerBotoes.querySelector(".btn-qty-decrease");
      const btnIncrease = containerBotoes.querySelector(".btn-qty-increase");
      const btnRemover = containerBotoes.querySelector(".btn-remover");
      
      btnDecrease?.addEventListener("click", (e) => {
        e.stopPropagation();
        diminuirQuantidadeCarrinho(produtoId);
      });
      
      btnIncrease?.addEventListener("click", (e) => {
        e.stopPropagation();
        aumentarQuantidadeCarrinho(produtoId);
      });
      
      btnRemover?.addEventListener("click", (e) => {
        e.stopPropagation();
        removerDoCarrinho(produtoId);
        showToast("Produto removido do carrinho.", "info");
      });
    } else {
      containerBotoes.innerHTML = `
        <button class="btn-carrinho" type="button">
          Adicionar ao carrinho
        </button>
      `;
      
      const btnCarrinho = containerBotoes.querySelector(".btn-carrinho");
      btnCarrinho?.addEventListener("click", (e) => {
        e.stopPropagation();
        const nomeElem = produtoEl.querySelector("h3");
        const precoElem = produtoEl.querySelector(".preco");
        const imagemElem = produtoEl.querySelector(".slides img");
        
        const novoProduto = {
          id: produtoId,
          nome: nomeElem?.textContent || "Produto",
          preco: precoElem?.textContent?.replace("R$ ", "") || "0,00",
          imagem: imagemElem?.src || "",
          personalizado: produtoPersonalizado,
        };
        
        adicionarAoCarrinho(novoProduto);
      });
    }
  });
}

function atualizarContadorCarrinho() {
  const contador = document.getElementById("cart-count");

  if (!contador) {
    return;
  }

  const quantidade = obterCarrinho().reduce((acc, item) => acc + (item.quantidade || 1), 0);
  contador.textContent = String(quantidade);
}

function renderizarCarrinhoSidebar() {
  const lista = document.getElementById("cart-sidebar-items");
  const totalEl = document.getElementById("cart-sidebar-total");

  if (!lista || !totalEl) {
    return;
  }

  const carrinho = obterCarrinho();

  if (carrinho.length === 0) {
    lista.innerHTML = "<p style='text-align: center; color: var(--muted); padding: 20px;'>Seu carrinho está vazio.</p>";
    totalEl.textContent = "R$ 0,00";
    return;
  }

  let total = 0;

  lista.innerHTML = carrinho.map((item) => {
    const subtotal = (Number(String(item.preco).replace(",", ".")) || 0) * (item.quantidade || 1);
    total += subtotal;

    return `
      <div class="cart-item" data-product-id="${escapeHtml(item.id)}">
        <div class="cart-item-info">
          <p class="cart-item-name">${escapeHtml(item.nome)}</p>
          <p class="cart-item-price">R$ ${subtotal.toFixed(2).replace(".", ",")}</p>
        </div>
        <div class="cart-item-controls">
          <button class="cart-btn-decrease" type="button" title="Diminuir">−</button>
          <span class="cart-qty">${item.quantidade || 1}</span>
          <button class="cart-btn-increase" type="button" title="Aumentar">+</button>
          <button class="cart-btn-remove" type="button" title="Remover">🗑️</button>
        </div>
      </div>
    `;
  }).join("");

  // Adicionar event listeners aos botões do sidebar
  lista.querySelectorAll(".cart-btn-decrease").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const container = btn.closest(".cart-item");
      const produtoId = container?.dataset.productId;
      if (produtoId) diminuirQuantidadeCarrinho(produtoId);
    });
  });

  lista.querySelectorAll(".cart-btn-increase").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const container = btn.closest(".cart-item");
      const produtoId = container?.dataset.productId;
      if (produtoId) aumentarQuantidadeCarrinho(produtoId);
    });
  });

  lista.querySelectorAll(".cart-btn-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const container = btn.closest(".cart-item");
      const produtoId = container?.dataset.productId;
      const nomeItem = container?.querySelector(".cart-item-name")?.textContent;
      if (produtoId) {
        removerDoCarrinho(produtoId);
        showToast(`"${nomeItem}" removido do carrinho.`, "info");
      }
    });
  });

  totalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
}

function configurarHeaderUX() {
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

  // Listener de logout no dropdown (elemento estável — persiste mesmo com innerHTML trocado)
  dropdown?.addEventListener("click", (e) => {
    const sairBtn = e.target.closest(".sair");
    if (!sairBtn) return;
    e.stopPropagation();
    dropdown.classList.remove("ativo");
    btnAvatar.setAttribute("aria-expanded", "false");
    limparSessaoUsuario();
    atualizarMenuUsuario();
    atualizarContadorCarrinho();
    showToast("Até logo! Você saiu da sua conta.", "success");
  });

  // Fecha dropdown ao clicar fora
  document.addEventListener("click", (event) => {
    if (!dropdown || !btnAvatar) return;
    const alvo = event.target;
    if (alvo instanceof Node && !dropdown.contains(alvo) && !btnAvatar.contains(alvo)) {
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
    }
  });

  // Constrói o dropdown com base no estado de login atual
  atualizarMenuUsuario();

  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();
}

function ativarSliders() {
  document.querySelectorAll(".produto-slider").forEach((slider) => {
    const slides = slider.querySelector(".slides");
    const images = slides?.querySelectorAll("img") || [];
    const dots = slider.querySelectorAll(".dot");

    if (!slides || images.length <= 1) {
      return;
    }

    let index = 0;
    let interval = null;

    const updateSlide = () => {
      slides.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot) => dot.classList.remove("active"));
      if (dots[index]) dots[index].classList.add("active");
    };

    const stopAuto = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const startAuto = () => {
      stopAuto();
      interval = setInterval(() => {
        index = (index + 1) % images.length;
        updateSlide();
      }, 3000);
    };

    dots.forEach((dot) => {
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        index = Number(dot.dataset.index || 0);
        updateSlide();
        startAuto();
      });
    });

    slider.addEventListener("mouseenter", stopAuto);
    slider.addEventListener("mouseleave", startAuto);

    let startX = 0;

    slider.addEventListener("touchstart", (event) => {
      startX = event.touches[0].clientX;
      stopAuto();
    });

    slider.addEventListener("touchend", (event) => {
      const endX = event.changedTouches[0].clientX;
      const diff = startX - endX;

      if (diff > 50) index = (index + 1) % images.length;
      if (diff < -50) index = (index - 1 + images.length) % images.length;

      updateSlide();
      startAuto();
    });

    updateSlide();
    startAuto();
  });
}

async function renderizarProdutos() {
  const container = document.getElementById("lista-produtos");

  if (!container) {
    return;
  }

  // Show skeleton loading
  container.innerHTML = Array.from({ length: 6 }, () =>
    `<div class="skeleton skeleton-card"></div>`
  ).join("");

  try {
    const response = await fetchApi("/api/produtos");
    if (!response.ok) {
      let detalhe = `HTTP ${response.status}`;
      try {
        const erroPayload = await response.json();
        detalhe = erroPayload?.error || erroPayload?.message || detalhe;
      } catch {
        // Ignora erro de parse e mantem status HTTP
      }
      throw new Error(detalhe);
    }
    const payload = await response.json();
    const lista = Array.isArray(payload.produtos) ? payload.produtos : [];

    todosProdutos = lista.map((p) => {

      const imagensValidas = obterImagensProduto(p);

      return {
        id: p.id,
        nome: p.nome || "Produto",
        preco: p.preco || "0,00",
        descricaoCurta: p.descricaoCurta || "",
        personalizado: isProdutoPersonalizado(p),
        imagens: imagensValidas,
        categoria: normalizarSlug(p.categoria || ""),
        tipo: normalizarSlug(p.tipo || ""),
        tamanho: normalizarSlug(p.tamanho || ""),
        gramatura: normalizarSlug(p.gramatura || ""),
        link: normalizarLink(p.link || "#")
      };
    });

    categoriasDisponiveis = [...new Set(todosProdutos.map((p) => p.categoria).filter(Boolean))]
      .sort((a, b) => formatar(a).localeCompare(formatar(b), "pt-BR"));

    if (filtros.categoria !== "todos" && !categoriasDisponiveis.includes(filtros.categoria)) {
      filtros.categoria = "todos";
      filtros.tipo = "todos";
      filtros.tamanho = "todos";
      filtros.gramatura = "todos";
    }

    renderizarCategoriasDesktop();
    renderProdutosFiltrados();
  } catch (error) {
    console.error(error);
    renderizarCategoriasDesktop();
    const detalhe = error?.message ? ` (${escapeHtml(error.message)})` : "";
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Erro ao carregar produtos</h3><p>Não foi possível carregar os produtos no momento${detalhe}.</p></div>`;
  }
}

function renderProdutosFiltrados() {
  const container = document.getElementById("lista-produtos");
  if (!container) return;

  // Apply filters
  let filtrados = todosProdutos.filter((p) => {
    const matchCategoria = filtros.categoria === "todos" || p.categoria === filtros.categoria;
    const matchTipo = filtros.tipo === "todos" || p.tipo === filtros.tipo || !p.tipo;
    const matchTamanho = filtros.tamanho === "todos" || p.tamanho === filtros.tamanho || !p.tamanho;
    const matchGramatura = filtros.gramatura === "todos" || p.gramatura === filtros.gramatura || !p.gramatura;
    return matchCategoria && matchTipo && matchTamanho && matchGramatura;
  });

  // Apply search
  if (searchQuery) {
    const q = searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    filtrados = filtrados.filter((p) => {
      const texto = `${p.nome} ${p.descricaoCurta} ${p.categoria} ${p.tipo}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return texto.includes(q);
    });
  }

  // Apply sort
  const precoNum = (p) => Number(String(p.preco).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
  switch (sortMode) {
    case "menor-preco": filtrados.sort((a, b) => precoNum(a) - precoNum(b)); break;
    case "maior-preco": filtrados.sort((a, b) => precoNum(b) - precoNum(a)); break;
    case "a-z": filtrados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")); break;
  }

  // Empty state
  if (filtrados.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Nenhum produto encontrado</h3><p>${searchQuery ? `Nenhum resultado para "${escapeHtml(searchQuery)}".` : "Tente alterar os filtros."}</p><button class="btn" onclick="limparBusca()">Limpar filtros</button></div>`;
    renderPagination(0, 0);
    return;
  }

  // Pagination
  const totalPages = Math.ceil(filtrados.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginados = filtrados.slice(start, start + ITEMS_PER_PAGE);

  container.innerHTML = "";

  paginados.forEach((produto) => {
    const div = document.createElement("div");
    div.classList.add("produto");
    div.dataset.id = String(produto.id);
    div.dataset.categoria = produto.categoria;
    div.dataset.subcategoria = produto.tipo;
    div.dataset.tamanho = produto.tamanho;
    div.dataset.gramatura = produto.gramatura;
    div.dataset.personalizado = produto.personalizado ? "true" : "false";

    const imagens = produto.imagens.length > 0
      ? produto.imagens
      : ["img/logo/logo.png"];

    const nomeSeguro = escapeHtml(produto.nome);
    const descricaoSegura = escapeHtml(produto.descricaoCurta);
    const precoSeguro = escapeHtml(String(produto.preco));
    const precoVal = Number(String(produto.preco).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    const parcelasInfo = calcularParcelas(precoVal);

    div.innerHTML = `
      <button class="wishlist-btn wishlist-btn-card ${isWishlisted(produto.id) ? "active" : ""}" data-produto-id="${escapeHtml(produto.id)}" type="button" aria-label="Favoritar">
        ${isWishlisted(produto.id) ? "♥" : "♡"}
      </button>
      <div class="produto-slider">
        <div class="slides">
          ${imagens.map((img) => `<img src="${escapeHtml(img)}" alt="${nomeSeguro}" onerror="this.onerror=null;this.src='img/logo/logo.png';">`).join("")}
        </div>
        <div class="dots">
          ${imagens.map((_, i) => `<span class="dot ${i === 0 ? "active" : ""}" data-index="${i}"></span>`).join("")}
        </div>
      </div>

      <h3>${nomeSeguro}</h3>
      <p class="descricao">${descricaoSegura}</p>
      <p class="preco">R$ ${precoSeguro}</p>
      ${parcelasInfo.parcelas > 1 ? `<p class="parcelas-badge">até ${parcelasInfo.parcelas}x de R$ ${parcelasInfo.valorFormatado} sem juros</p>` : ""}

      <div class="product-buttons-container"></div>
    `;

    div.addEventListener("click", (e) => {
      if (e.target.closest(".wishlist-btn-card") || e.target.closest(".product-buttons-container")) return;
      abrirProduto(produto.id);
    });

    // Wishlist button
    const wishBtn = div.querySelector(".wishlist-btn-card");
    wishBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWishlist(produto.id);
    });

    container.appendChild(div);
  });

  ativarSliders();
  atualizarBotoesCarrinho();
  renderPagination(filtrados.length, totalPages);
}

function calcularParcelas(preco) {
  if (preco < 100) return { parcelas: 1, valor: preco, valorFormatado: preco.toFixed(2).replace(".", ",") };
  const parcelas = Math.min(12, Math.floor(preco / 50));
  const valor = preco / parcelas;
  return { parcelas, valor, valorFormatado: valor.toFixed(2).replace(".", ",") };
}

function renderPagination(totalItems, totalPages) {
  const container = document.getElementById("pagination-container");
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  let html = `<button ${currentPage <= 1 ? "disabled" : ""} onclick="goToPage(${currentPage - 1})">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
      if (i === 3 || i === totalPages - 2) html += `<button disabled>…</button>`;
      continue;
    }
    html += `<button class="${i === currentPage ? "active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  }
  html += `<button ${currentPage >= totalPages ? "disabled" : ""} onclick="goToPage(${currentPage + 1})">›</button>`;
  container.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderProdutosFiltrados();
  document.getElementById("lista-produtos")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function limparBusca() {
  searchQuery = "";
  filtros = { categoria: "todos", tipo: "todos", tamanho: "todos", gramatura: "todos" };
  currentPage = 1;
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) sortSelect.value = "relevancia";
  sortMode = "relevancia";
  renderizarCategoriasDesktop();
  gerarFiltros("todos");
  renderProdutosFiltrados();
}

window.filtrarCategoria = filtrarCategoria;
window.abrirFiltro = abrirFiltro;
window.fecharFiltro = fecharFiltro;
window.selecionarCategoriaMobile = selecionarCategoriaMobile;
window.setFiltro = setFiltro;
window.goToPage = goToPage;
window.limparBusca = limparBusca;

normalizarUrlSemExtensao();
renderizarProdutos();
configurarHeaderUX();
atualizarBotoesCarrinho();
atualizarContadorCarrinho();

// Search
let searchDebounce = null;
const searchInput = document.getElementById("search-input");

// Pre-fill from URL query param
const urlSearchQ = new URLSearchParams(window.location.search).get("q");
if (urlSearchQ && searchInput) {
  searchInput.value = urlSearchQ;
  searchQuery = urlSearchQ;
}

searchInput?.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    currentPage = 1;
    renderProdutosFiltrados();
  }, 300);
});

document.getElementById("btn-search")?.addEventListener("click", () => {
  searchQuery = searchInput?.value.trim() || "";
  currentPage = 1;
  renderProdutosFiltrados();
});

// Sort
document.getElementById("sort-select")?.addEventListener("change", (e) => {
  sortMode = e.target.value;
  currentPage = 1;
  renderProdutosFiltrados();
});

function parsePrecoSeguro(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const textoLimpo = String(valor ?? "").replace(/[^\d.,-]/g, "").trim();
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

/* ========== Vistos Recentemente (index) ========== */
(async function renderVistosIndex() {
  const section = document.getElementById("vistos-recentemente");
  const grid = document.getElementById("vistos-grid");
  if (!section || !grid) return;

  const vistos = JSON.parse(localStorage.getItem("zuca_vistos") || "[]");
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
      const img = obterImagensProduto(p)[0] || "img/logo/logo.png";
      const preco = parsePrecoSeguro(p.preco ?? p.valor ?? 0);
      const precoStr = preco.toFixed(2).replace(".", ",");
      return `
        <a href="/produto?id=${encodeURIComponent(p.id)}" class="produto" style="text-decoration: none; color: inherit; text-align: center;">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.nome || '')}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-md);" loading="lazy">
          <h3 style="font-size: 13px; margin: 6px 0 4px; font-weight: 600; text-align: center;">${escapeHtml(p.nome || "Produto")}</h3>
          <p style="font-weight: 700; color: var(--accent); margin: 0; font-size: 14px;">R$ ${precoStr}</p>
        </a>
      `;
    }).join("");
    section.style.display = "";
  } catch { /* silent */ }
})();

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
