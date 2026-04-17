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

function obterAvatarHeader() {
  return localStorage.getItem("zuca_avatar_url") || DEFAULT_AVATAR;
}

function atualizarAvatarHeader() {
  const avatarImage = document.getElementById("avatar-image");
  if (!avatarImage) return;
  avatarImage.src = obterAvatarHeader();
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

  const composto = `${produto.tipo || ""} ${produto.categoria || ""}`.toLowerCase();
  if (composto.includes("nao personalizado") || composto.includes("não personalizado")) return false;
  return /(^|\s)personalizado(s)?(\s|$)/i.test(composto);
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
  const produtos = document.querySelectorAll(".produto");

  produtos.forEach((produto) => {
    const cat = produto.dataset.categoria || "";
    const tipo = produto.dataset.subcategoria || "";
    const tamanho = produto.dataset.tamanho || "";
    const gramatura = produto.dataset.gramatura || "";

    const matchCategoria = filtros.categoria === "todos" || cat === filtros.categoria;
    const matchTipo = filtros.tipo === "todos" || tipo === filtros.tipo || !tipo;
    const matchTamanho = filtros.tamanho === "todos" || tamanho === filtros.tamanho || !tamanho;
    const matchGramatura = filtros.gramatura === "todos" || gramatura === filtros.gramatura || !gramatura;

    produto.style.display = matchCategoria && matchTipo && matchTamanho && matchGramatura
      ? ""
      : "none";
  });
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
    alert("Este item e personalizado. Abra o produto e anexe o arquivo antes de adicionar ao carrinho.");
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
        if (confirm("Remover este produto do carrinho?")) {
          removerDoCarrinho(produtoId);
        }
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
      if (produtoId && confirm(`Remover "${nomeItem}" do carrinho?`)) {
        removerDoCarrinho(produtoId);
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
  const btnLoginGoogle = document.getElementById("btn-login-google");
  const btnLogout = document.getElementById("btn-logout-user");

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

  document.addEventListener("click", (event) => {
    if (!dropdown || !btnAvatar) {
      return;
    }

    const alvo = event.target;

    if (alvo instanceof Node && !dropdown.contains(alvo) && !btnAvatar.contains(alvo)) {
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
    }
  });

  btnLoginGoogle?.addEventListener("click", async () => {
    window.location.href = "/checkout";
    dropdown?.classList.remove("ativo");
    btnAvatar?.setAttribute("aria-expanded", "false");
  });

  btnLogout?.addEventListener("click", async () => {
    localStorage.removeItem("zuca_checkout_cliente");
    atualizarAvatarHeader();
    dropdown?.classList.remove("ativo");
    btnAvatar?.setAttribute("aria-expanded", "false");
  });

  atualizarAvatarHeader();

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

  container.innerHTML = "";

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

    const produtos = lista.map((p) => {

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

    categoriasDisponiveis = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))]
      .sort((a, b) => formatar(a).localeCompare(formatar(b), "pt-BR"));

    if (filtros.categoria !== "todos" && !categoriasDisponiveis.includes(filtros.categoria)) {
      filtros.categoria = "todos";
      filtros.tipo = "todos";
      filtros.tamanho = "todos";
      filtros.gramatura = "todos";
    }

    renderizarCategoriasDesktop();

    produtos.forEach((produto) => {
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

      div.innerHTML = `
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

        <div class="product-buttons-container"></div>
      `;

      div.addEventListener("click", () => {
        abrirProduto(produto.id);
      });

      container.appendChild(div);
    });

    gerarFiltros(filtros.categoria);
    ativarSliders();
    aplicarFiltro();
    atualizarBotoesCarrinho();
  } catch (error) {
    console.error(error);
    renderizarCategoriasDesktop();
    const detalhe = error?.message ? ` (${escapeHtml(error.message)})` : "";
    container.innerHTML = `<p>Não foi possível carregar os produtos no momento${detalhe}.</p>`;
  }
}

window.filtrarCategoria = filtrarCategoria;
window.abrirFiltro = abrirFiltro;
window.fecharFiltro = fecharFiltro;
window.selecionarCategoriaMobile = selecionarCategoriaMobile;
window.setFiltro = setFiltro;

normalizarUrlSemExtensao();
renderizarProdutos();
configurarHeaderUX();
atualizarBotoesCarrinho();
atualizarContadorCarrinho();
