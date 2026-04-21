import {
  auth,
  sairDoFirebase,
  onAuthStateChanged,
  salvarUsuarioNoStorage,
} from "./firebase-auth.js";

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

  // Listener de logout no dropdown (elemento estável — persiste mesmo com innerHTML trocado)
  dropdown?.addEventListener("click", async (e) => {
    const sairBtn = e.target.closest(".sair");
    if (!sairBtn) return;
    e.stopPropagation();
    dropdown.classList.remove("ativo");
    btnAvatar.setAttribute("aria-expanded", "false");
    try { await sairDoFirebase(); } catch (_) {}
    limparSessaoUsuario();
    atualizarMenuUsuario();
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

  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();

  // Sincroniza com Firebase Auth: atualiza dados quando o usuário loga via popup
  onAuthStateChanged(auth, (user) => {
    if (user) {
      salvarUsuarioNoStorage(user);
      atualizarMenuUsuario();
    }
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
