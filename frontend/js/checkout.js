const el = (id) => document.getElementById(id);

const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

let descontoAtual = 0;
let cupomAplicado = null;
let mpConfigCache = null;

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
const precoNumero = (p) => Number(String(p || "0").replace("R$", "").replace(/\./g, "").replace(",", ".")) || 0;

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
    if (!raw) return;
    const dados = JSON.parse(raw);
    Object.entries(dados).forEach(([key, value]) => {
      if (el(key)) el(key).value = value || "";
    });
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
    totalEl.textContent = "R$ 0,00";
    if (el("subtotal")) el("subtotal").textContent = "R$ 0,00";
    if (el("desconto")) el("desconto").textContent = "R$ 0,00";
    if (el("total-final")) el("total-final").textContent = "R$ 0,00";
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
        <strong>${item.nome}</strong><br/>
        <small>x${item.quantidade || 1}</small>
      </span>
      <strong>${formatarMoeda(subtotalItem)}</strong>
    `;
    container.appendChild(div);
  });

  const total = Math.max(0, subtotal - descontoAtual);
  totalEl.textContent = formatarMoeda(total);
  if (el("subtotal")) el("subtotal").textContent = formatarMoeda(subtotal);
  if (el("desconto")) el("desconto").textContent = formatarMoeda(descontoAtual);
  if (el("total-final")) el("total-final").textContent = formatarMoeda(total);

  atualizarContadorCarrinho();
  renderizarCarrinhoSidebar();
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
          <p class="cart-item-name">${item.nome || "Produto"}</p>
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
  const cupom = el("cupom")?.value.trim().toUpperCase();
  if (!cupom) {
    setCheckoutStatus("Informe um cupom.", "info");
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
      setCheckoutStatus(payload.error || "Cupom invalido.", "error");
      return;
    }

    descontoAtual = Number(payload.desconto || 0);
    cupomAplicado = cupom;
    renderCarrinho();
    setCheckoutStatus(`Cupom aplicado: -${formatarMoeda(descontoAtual)}`, "success");
  } catch (error) {
    setCheckoutStatus(`Erro ao validar cupom: ${error.message}`, "error");
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

      return `
      <div class="pedido-item ${statusClass}">
        <div class="pedido-top">
          <span class="pedido-id">#${pedido.id.slice(0, 8)}</span>
          <span class="pedido-status">${statusLabel}</span>
        </div>
        <div class="pedido-total">${formatarMoeda(pedido.total || 0)}</div>
      </div>
    `;
    }).join("");
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
  if (qrContainer) qrContainer.innerHTML = `<img src="${data.qr_code}" alt="QR PIX" style="max-width:220px;">`;
  if (brCodeInput) brCodeInput.value = data.brcode || "";

  return data;
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
  return "";
}

async function finalizarPedido() {
  const itens = getCarrinho();
  if (itens.length === 0) {
    setCheckoutStatus("Carrinho vazio.", "error");
    return;
  }

  const cliente = salvarDadosClienteLocal();
  const erro = validarCamposCliente(cliente);
  if (erro) {
    setCheckoutStatus(erro, "error");
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
      await gerarPixDinamico(total, pedidoId, cliente);
      const verificacao = await verificarPagamento(pedidoId);
      setCheckoutStatus(
        verificacao.aprovado
          ? `Pagamento confirmado. Pedido #${pedidoId.slice(0, 8)}`
          : `PIX gerado para o pedido #${pedidoId.slice(0, 8)}. Aguardando confirmacao do pagamento.`,
        verificacao.aprovado ? "success" : "info"
      );
    } else if (metodo === "cartao") {
      setCheckoutStatus("Cartao requer formulario seguro do Mercado Pago. Use PIX temporariamente.", "info");
    } else if (metodo === "boleto") {
      setCheckoutStatus(`Pedido #${pedidoId.slice(0, 8)} criado. Boleto sera enviado por e-mail.`, "success");
    }

    localStorage.removeItem("zuca_carrinho");
    descontoAtual = 0;
    cupomAplicado = null;
    renderCarrinho();
    await listarPedidosPorEmail(cliente.email);
  } catch (error) {
    setCheckoutStatus(`Erro: ${error.message}`, "error");
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

function atualizarAvatarCheckout(nome = "") {
  const avatarLabel = el("avatar-label");
  if (!avatarLabel) return;
  avatarLabel.textContent = nome || "Entrar";
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
  atualizarAvatarCheckout(nomeFinal.split(" ")[0]);
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
    atualizarAvatarCheckout("");
    setAuthStatus("Dados locais removidos.", "ok");
    el("lista-pedidos") && (el("lista-pedidos").innerHTML = "<p>Nenhum pedido ainda.</p>");
  };

  el("btn-logout")?.addEventListener("click", executarLogout);
  el("btn-logout-user")?.addEventListener("click", () => {
    executarLogout();
    el("avatar-dropdown")?.classList.remove("ativo");
  });

  el("btn-login-google")?.addEventListener("click", () => {
    el("btn-google")?.click();
    el("avatar-dropdown")?.classList.remove("ativo");
  });
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

  document.addEventListener("click", (event) => {
    if (!dropdown || !btnAvatar) return;
    const target = event.target;
    if (target instanceof Node && !dropdown.contains(target) && !btnAvatar.contains(target)) {
      dropdown.classList.remove("ativo");
      btnAvatar.setAttribute("aria-expanded", "false");
    }
  });
}

function configurarCopiarPix() {
  el("btn-copiar-pix")?.addEventListener("click", async () => {
    const value = el("pix-brcode")?.value || "";
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCheckoutStatus("Chave PIX copiada.", "success");
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

  estado?.addEventListener("input", (event) => {
    event.target.value = String(event.target.value || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  });
}

function configurarAcoesPagamento() {
  el("btn-pagar-cartao")?.addEventListener("click", () => {
    setCheckoutStatus("O pagamento por cartao sera liberado em breve. No momento use PIX para concluir o pedido.", "info");
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

carregarDadosClienteLocal();
atualizarAvatarCheckout(localStorage.getItem("zuca_checkout_cliente_nome") || "");
renderCarrinho();
onPagamentoChange();
configurarBotoesLoginPlaceholder();
configurarHeaderCheckout();
configurarCopiarPix();
configurarMascarasFormulario();
configurarAcoesPagamento();
renderizarCarrinhoSidebar();

if (el("email")?.value) {
  listarPedidosPorEmail(el("email").value.trim().toLowerCase());
}
