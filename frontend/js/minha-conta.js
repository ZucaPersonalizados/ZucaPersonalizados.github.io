const el = (id) => document.getElementById(id);

const API_BASE = (() => {
  const custom = localStorage.getItem("zuca_api_base_url");
  if (custom) return custom.replace(/\/$/, "");
  return window.location.origin;
})();

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

const AVATARS = [
  "https://api.dicebear.com/8.x/fun-emoji/svg?seed=Zuca1",
  "https://api.dicebear.com/8.x/fun-emoji/svg?seed=Zuca2",
  "https://api.dicebear.com/8.x/fun-emoji/svg?seed=Zuca3",
  "https://api.dicebear.com/8.x/pixel-art/svg?seed=Zuca4",
  "https://api.dicebear.com/8.x/pixel-art/svg?seed=Zuca5",
  "https://api.dicebear.com/8.x/pixel-art/svg?seed=Zuca6",
];

let avatarSelecionado = localStorage.getItem("zuca_avatar_url") || AVATARS[0];

function setStatus(message, type = "info") {
  const box = el("conta-status");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("is-success", "is-error");
  if (type === "success") box.classList.add("is-success");
  if (type === "error") box.classList.add("is-error");
}

function salvarPerfil() {
  const perfil = {
    nome: String(el("nome")?.value || "").trim(),
    email: String(el("email")?.value || "").trim().toLowerCase(),
    telefone: String(el("telefone")?.value || "").trim(),
    avatar: avatarSelecionado,
  };

  localStorage.setItem("zuca_perfil", JSON.stringify(perfil));
  localStorage.setItem("zuca_avatar_url", avatarSelecionado);

  const checkoutCliente = {
    ...(JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}")),
    nome: perfil.nome,
    email: perfil.email,
    telefone: perfil.telefone,
  };
  localStorage.setItem("zuca_checkout_cliente", JSON.stringify(checkoutCliente));

  if (perfil.nome) {
    localStorage.setItem("zuca_checkout_cliente_nome", perfil.nome.split(" ")[0]);
  }

  setStatus("Perfil salvo com sucesso.", "success");
  if (perfil.email) {
    listarPedidos(perfil.email);
  }
}

function carregarPerfil() {
  const perfil = JSON.parse(localStorage.getItem("zuca_perfil") || "{}");
  const checkout = JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}");

  const nome = perfil.nome || checkout.nome || "";
  const email = perfil.email || checkout.email || "";
  const telefone = perfil.telefone || checkout.telefone || "";
  avatarSelecionado = perfil.avatar || avatarSelecionado;

  if (el("nome")) el("nome").value = nome;
  if (el("email")) el("email").value = email;
  if (el("telefone")) el("telefone").value = telefone;
  if (el("avatar-preview")) el("avatar-preview").src = avatarSelecionado;

  if (email) {
    listarPedidos(email);
  }
}

function renderAvatarOptions() {
  const grid = el("avatar-grid");
  if (!grid) return;

  grid.innerHTML = AVATARS.map((url) => {
    const active = url === avatarSelecionado ? "active" : "";
    return `
      <button type="button" class="avatar-option ${active}" data-avatar="${url}">
        <img src="${url}" alt="Avatar" loading="lazy" />
      </button>
    `;
  }).join("");

  grid.querySelectorAll(".avatar-option").forEach((button) => {
    button.addEventListener("click", () => {
      avatarSelecionado = button.getAttribute("data-avatar") || AVATARS[0];
      if (el("avatar-preview")) el("avatar-preview").src = avatarSelecionado;
      renderAvatarOptions();
    });
  });
}

async function verificarPagamento(idPedido) {
  const response = await fetch(getApiUrl("/verificar-pagamento"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idPedido }),
  });

  const payload = await response.json();
  return { ok: response.ok, payload, aprovado: !!payload.aprovado };
}

async function pagarAgora(idPedido, email, metodo) {
  const response = await fetch(getApiUrl(`/api/pedidos/${encodeURIComponent(idPedido)}/pagar-agora`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, metodo }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha ao preparar pagamento");
  }

  if (payload.action === "checkout_pro" && payload.checkoutUrl) {
    window.location.href = payload.checkoutUrl;
    return;
  }

  if (payload.action === "pix") {
    setStatus("PIX atualizado. Abra o checkout para copiar o codigo e concluir.", "success");
    return;
  }
}

async function listarPedidos(email) {
  const list = el("pedido-list");
  if (!list) return;

  if (!email) {
    list.innerHTML = "<p>Informe seu e-mail para ver os pedidos.</p>";
    return;
  }

  try {
    const response = await fetch(getApiUrl(`/api/pedidos?email=${encodeURIComponent(email)}`));
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      list.innerHTML = "<p>Nao foi possivel carregar seus pedidos.</p>";
      return;
    }

    const pedidos = Array.isArray(payload.pedidos) ? payload.pedidos : [];
    if (!pedidos.length) {
      list.innerHTML = "<p>Nenhum pedido encontrado para este e-mail.</p>";
      return;
    }

    list.innerHTML = pedidos.map((pedido) => {
      const status = String(pedido.status || "pendente").toLowerCase();
      const paid = status === "pagto";
      return `
        <article class="pedido-item ${paid ? "is-paid" : "is-pending"}">
          <div class="pedido-top">
            <strong>#${pedido.id.slice(0, 8)}</strong>
            <span class="pedido-status">${paid ? "Pago" : "Pendente"}</span>
          </div>
          <div>Total: R$ ${Number(pedido.total || 0).toFixed(2).replace(".", ",")}</div>
          <div>Pagamento: ${String(pedido.pagamento || "pix").toUpperCase()}</div>
          ${paid ? "" : `<div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="checkout-btn secondary btn-verificar" data-id="${pedido.id}">Verificar pagamento</button>
            <button type="button" class="checkout-btn secondary btn-pagar" data-id="${pedido.id}" data-pag="${String(pedido.pagamento || "pix").toLowerCase()}">Pagar agora</button>
          </div>`}
        </article>
      `;
    }).join("");

    list.querySelectorAll(".btn-verificar").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-id") || "";
        if (!id) return;
        const result = await verificarPagamento(id);
        if (result.aprovado) {
          setStatus(`Pedido #${id.slice(0, 8)} confirmado como pago.`, "success");
          listarPedidos(email);
        } else {
          setStatus(result.payload?.message || "Pagamento ainda pendente.");
        }
      });
    });

    list.querySelectorAll(".btn-pagar").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-id") || "";
        const metodo = button.getAttribute("data-pag") || "pix";
        if (!id) return;

        try {
          setStatus(`Preparando pagamento do pedido #${id.slice(0, 8)}...`);
          await pagarAgora(id, email, metodo);
        } catch (error) {
          setStatus(`Erro: ${error.message}`, "error");
        }
      });
    });
  } catch {
    list.innerHTML = "<p>Nao foi possivel carregar seus pedidos.</p>";
  }
}

el("btn-salvar")?.addEventListener("click", salvarPerfil);
el("btn-ir-checkout")?.addEventListener("click", () => {
  window.location.href = "/checkout";
});
el("email")?.addEventListener("blur", (event) => {
  const value = String(event.target.value || "").trim().toLowerCase();
  if (value) listarPedidos(value);
});

renderAvatarOptions();
carregarPerfil();