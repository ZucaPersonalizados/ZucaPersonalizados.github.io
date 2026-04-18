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
  const btnLoginGoogle = document.getElementById("btn-login-google");
  const btnLogoutUser = document.getElementById("btn-logout-user");

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
    if (!dropdown || !btnAvatar) return;
    const target = event.target;
    if (target instanceof Node && !dropdown.contains(target) && !btnAvatar.contains(target)) {
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
    }
  });

  btnLoginGoogle?.addEventListener("click", () => {
    window.location.href = "/checkout";
  });

  btnLogoutUser?.addEventListener("click", () => {
    localStorage.removeItem("zuca_checkout_cliente");
    localStorage.removeItem("zuca_checkout_cliente_nome");
    atualizarAvatarHeader();
    dropdown?.classList.remove("ativo");
  });

  atualizarAvatarHeader();

  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();
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

/* ========== Calcular Frete no Produto ========== */
async function calcularFreteProduto(cep, produtoId) {
  const freteResultado = document.getElementById("frete-produto-resultado");
  if (!freteResultado) return;

  cep = cep.replace(/\D/g, "");
  if (cep.length !== 8) {
    showToast("CEP inválido. Informe 8 dígitos.", "error");
    return;
  }

  freteResultado.innerHTML = '<p style="color: var(--muted);">Calculando frete...</p>';

  try {
    const qty = Number(document.getElementById("qty-input")?.value || 1);
    const url = new URL(getApiUrl("/api/frete/calcular"));
    url.searchParams.set("cep", cep);
    url.searchParams.set("itens", JSON.stringify([{ id: produtoId, quantidade: qty }]));

    const response = await fetch(url.toString());

    const data = await response.json();
    if (!response.ok || !data.options?.length) {
      freteResultado.innerHTML = '<p style="color: var(--accent-rose);">Nenhuma opção de frete encontrada.</p>';
      return;
    }

    freteResultado.innerHTML = data.options.map((op) => `
      <div class="frete-option-mini">
        <span><strong>${escapeHtml(op.label || op.company)}</strong> - ${Number(op.delivery_time) || "?"} dias úteis</span>
        <span class="frete-price">${op.freteGratis ? '<span style="color: var(--accent);">GRÁTIS</span>' : formatarMoeda(op.price)}</span>
      </div>
    `).join("");
  } catch {
    freteResultado.innerHTML = '<p style="color: var(--error);">Erro ao calcular frete.</p>';
  }
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
    }

    imagens.forEach((img, index) => {
      if (!miniaturas) return;
      const thumb = document.createElement("img");
      thumb.src = img;
      if (index === 0) thumb.classList.add("ativa");
      thumb.addEventListener("click", () => {
        if (imgPrincipal) imgPrincipal.src = img;
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

    /* ========== Frete Calculator ========== */
    const freteHtml = `
      <div class="frete-produto" style="margin-top: 20px; padding: 16px; background: var(--bg-secondary, #f9f7f4); border-radius: 10px;">
        <p style="font-weight: 600; margin: 0 0 8px;">📦 Calcular frete</p>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="cep-produto" placeholder="00000-000" maxlength="9"
            style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px;">
          <button type="button" id="btn-calcular-frete-produto" class="btn btn-sm"
            style="padding: 8px 16px; border-radius: 6px;">Calcular</button>
        </div>
        <div id="frete-produto-resultado" style="margin-top: 10px;"></div>
      </div>
    `;
    const estoqueContainer = document.getElementById("estoque-container");
    if (estoqueContainer) {
      estoqueContainer.insertAdjacentHTML("afterend", freteHtml);
    }

    document.getElementById("cep-produto")?.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5, 8);
      e.target.value = v;
    });

    document.getElementById("btn-calcular-frete-produto")?.addEventListener("click", () => {
      const cep = document.getElementById("cep-produto")?.value || "";
      calcularFreteProduto(cep, id);
    });

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
        <a href="/produto?id=${encodeURIComponent(p.id)}" class="produto" style="text-decoration: none; color: inherit;">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.nome || '')}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-md);" loading="lazy">
          <h3 style="font-size: 14px; margin: 8px 0 4px; font-weight: 600;">${escapeHtml(p.nome || "Produto")}</h3>
          <p style="font-weight: 700; color: var(--accent); margin: 0;">${formatarMoeda(preco)}</p>
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
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.nome || '')}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-md);" loading="lazy">
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
