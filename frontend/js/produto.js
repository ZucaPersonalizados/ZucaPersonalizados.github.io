const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

function getApiUrl(path) {
  return `${API_BASE}${path}`;
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

  const composto = `${produto.tipo || ""} ${produto.categoria || ""}`.toLowerCase();
  return composto.includes("personalizado");
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
          <p class="cart-item-name">${item.nome || "Produto"}</p>
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
  const avatarLabel = document.getElementById("avatar-label");

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
    if (avatarLabel) avatarLabel.textContent = "Entrar";
    dropdown?.classList.remove("ativo");
  });

  if (avatarLabel) {
    const salvo = localStorage.getItem("zuca_checkout_cliente_nome");
    avatarLabel.textContent = salvo || "Entrar";
  }

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

function adicionarAoCarrinhoComEstoque(produto, estoqueDisponivel) {
  const carrinho = JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  const produtoPersonalizado = isProdutoPersonalizado(produto);
  const existente = produtoPersonalizado
    ? null
    : carrinho.find((item) => item.id === produto.id && !item.arquivoPersonalizacaoUrl);
  const quantidadeNoCarrinho = existente ? Number(existente.quantidade || 0) : 0;

  if (quantidadeNoCarrinho + 1 > estoqueDisponivel) {
    alert(`❌ Máximo de ${estoqueDisponivel} unidade(s) disponível(is). Você já tem ${quantidadeNoCarrinho} no carrinho.`);
    return;
  }

  if (existente) {
    existente.quantidade += 1;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: obterImagensProduto(produto)[0] || "",
      arquivoPersonalizacaoUrl: produto.arquivoPersonalizacaoUrl || "",
      arquivoPersonalizacaoNome: produto.arquivoPersonalizacaoNome || "",
      quantidade: 1,
    });
  }

  localStorage.setItem("zuca_carrinho", JSON.stringify(carrinho));
  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();

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

    document.getElementById("btn-adicionar-carrinho")?.addEventListener("click", async () => {
      if (estoque <= 0) {
        alert("❌ Este produto está fora de estoque");
        return;
      }

      const botao = document.getElementById("btn-adicionar-carrinho");

      if (personalizado) {
        const arquivo = inputArquivo?.files?.[0];

        if (!arquivo) {
          alert("Selecione um arquivo para personalizacao antes de adicionar ao carrinho.");
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
          }, estoque);

          if (statusArquivo) statusArquivo.textContent = `Arquivo enviado: ${arquivo.name}`;
        } catch (error) {
          alert(`Erro ao enviar arquivo: ${error.message}`);
          if (statusArquivo) statusArquivo.textContent = "Nao foi possivel enviar o arquivo.";
        } finally {
          if (botao) {
            botao.disabled = false;
            botao.textContent = "🛒 Adicionar ao carrinho";
          }
        }

        return;
      }

      adicionarAoCarrinhoComEstoque(produtoParaCarrinho, estoque);
    });
  } catch (error) {
    console.error("Erro ao carregar produto:", error);
    document.body.innerHTML = "<div style='text-align:center; padding: 100px;'><h2>Erro ao carregar produto</h2><p><a href='/'>Voltar para início</a></p></div>";
  }
}

normalizarUrlSemExtensao();
carregarProduto();
configurarHeaderProduto();
