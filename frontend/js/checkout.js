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

function obterAvatarHeader() {
  return localStorage.getItem("zuca_avatar_url") || DEFAULT_AVATAR;
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

function setActionFeedback(message, type = "info") {
  setCheckoutStatus(message, type);
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

function isCepValido(value = "") {
  return digitsOnly(value).length === 8;
}

function atualizarResumo(subtotal) {
  const total = Math.max(0, subtotal - descontoAtual + Number(freteAtual.valor || 0));
  if (el("subtotal")) el("subtotal").textContent = formatarMoeda(subtotal);
  if (el("desconto")) el("desconto").textContent = formatarMoeda(descontoAtual);
  if (el("frete")) el("frete").textContent = formatarMoeda(freteAtual.valor || 0);
  if (el("total-final")) el("total-final").textContent = formatarMoeda(total);
  if (el("total-carrinho")) el("total-carrinho").textContent = formatarMoeda(total);
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
        <strong>${item.nome}</strong><br/>
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
  if (!isCepValido(cep)) {
    freteAtual = { valor: 0, servico: "", prazoDias: null };
    atualizarResumo(obterSubtotal());
    return;
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

    const melhor = [...payload.options].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
    freteAtual = {
      valor: Number(melhor.price || 0),
      servico: String(melhor.service || "Entrega"),
      prazoDias: Number(melhor.delivery_time || 0) || null,
    };

    atualizarResumo(obterSubtotal());
    setActionFeedback(
      `Frete atualizado: ${freteAtual.servico} (${formatarMoeda(freteAtual.valor)}${freteAtual.prazoDias ? `, ${freteAtual.prazoDias} dias` : ""}).`,
      "info"
    );
  } catch {
    freteAtual = { valor: 0, servico: "", prazoDias: null };
    atualizarResumo(obterSubtotal());
  }
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
        pagarPedidoPendente(pedidoId, pagamento, email);
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
          verificacao.aprovado ? "success" : "info"
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
  if (qrContainer) qrContainer.innerHTML = `<img src="${data.qr_code}" alt="QR PIX" style="max-width:220px;">`;
  if (brCodeInput) brCodeInput.value = data.brcode || "";

  return data;
}

function mostrarPixNaTela(data = {}) {
  const qrContainer = el("pix-qrcode");
  const brCodeInput = el("pix-brcode");
  if (qrContainer && data.qr_code) {
    qrContainer.innerHTML = `<img src="${data.qr_code}" alt="QR PIX" style="max-width:220px;">`;
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
      setCheckoutStatus(`PIX atualizado para o pedido #${idPedido.slice(0, 8)}.`, "success");
      iniciarMonitoramentoPagamento(idPedido, email);
      return;
    }

    if (payload.action === "checkout_pro" && payload.checkoutUrl) {
      setCheckoutStatus("Redirecionando para pagamento seguro do Mercado Pago...", "info");
      window.location.href = payload.checkoutUrl;
      return;
    }

    throw new Error("Resposta de pagamento invalida");
  } catch (error) {
    setCheckoutStatus(`Erro: ${error.message}`, "error");
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
  const itens = getCarrinho();
  if (itens.length === 0) {
    setCheckoutStatus("Carrinho vazio.", "error");
    return;
  }

  const itemPersonalizadoSemArquivo = itens.find((item) =>
    isItemPersonalizado(item) && !String(item.arquivoPersonalizacaoUrl || "").trim()
  );

  if (itemPersonalizadoSemArquivo) {
    setCheckoutStatus(
      `O item "${itemPersonalizadoSemArquivo.nome || "personalizado"}" precisa de um arquivo anexado antes da compra.`,
      "error"
    );
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
      setCheckoutStatus(
        `PIX gerado para o pedido #${pedidoId.slice(0, 8)}. Aguardando confirmacao do pagamento.`,
        "success"
      );
      iniciarMonitoramentoPagamento(pedidoId, cliente.email);
    } else if (metodo === "cartao") {
      setCheckoutStatus("Redirecionando para pagamento seguro do Mercado Pago...", "info");
      await iniciarCheckoutCartao(pedidoId, cliente.email);
    } else if (metodo === "boleto") {
      setCheckoutStatus(`Pedido #${pedidoId.slice(0, 8)} criado. Boleto sera enviado por e-mail.`, "success");
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

  cep?.addEventListener("blur", async (event) => {
    const value = String(event.target.value || "");
    await preencherEnderecoPorCep(value);
    await recalcularFrete();
  });

  estado?.addEventListener("input", (event) => {
    event.target.value = String(event.target.value || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  });
}

function configurarAcoesPagamento() {
  el("btn-pagar-cartao")?.addEventListener("click", () => {
    setCheckoutStatus("Para pagar com cartao, finalize o pedido com a forma Cartao selecionada.", "info");
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

if (el("email")?.value) {
  listarPedidosPorEmail(el("email").value.trim().toLowerCase());
}

if (isCepValido(el("cep")?.value || "")) {
  recalcularFrete();
}
