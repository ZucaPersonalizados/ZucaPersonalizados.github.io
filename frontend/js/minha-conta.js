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

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

let avatarSelecionado = localStorage.getItem("zuca_avatar_url") || AVATARS[0];

function setStatus(message, type = "info") {
  const box = el("conta-status");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("is-success", "is-error");
  if (type === "success") box.classList.add("is-success");
  if (type === "error") box.classList.add("is-error");
}

function showToast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) { setStatus(msg, type); return; }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.remove(); }, 3500);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

function persistirAvatar(url) {
  avatarSelecionado = url;
  localStorage.setItem("zuca_avatar_url", avatarSelecionado);
  if (el("avatar-preview")) el("avatar-preview").src = avatarSelecionado;
}

function lerArquivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem"));
    reader.readAsDataURL(file);
  });
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
      persistirAvatar(button.getAttribute("data-avatar") || AVATARS[0]);
      renderAvatarOptions();
    });
  });
}

async function onUploadAvatar(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!String(file.type || "").startsWith("image/")) {
    setStatus("Selecione um arquivo de imagem valido.", "error");
    event.target.value = "";
    return;
  }

  if (file.size > MAX_AVATAR_BYTES) {
    setStatus("A foto deve ter no maximo 2MB.", "error");
    event.target.value = "";
    return;
  }

  try {
    const dataUrl = await lerArquivoComoDataUrl(file);
    persistirAvatar(dataUrl);
    renderAvatarOptions();
    setStatus("Foto de perfil atualizada. Clique em salvar para persistir os demais dados.", "success");
  } catch (error) {
    setStatus(`Erro ao carregar foto: ${error.message}`, "error");
  } finally {
    event.target.value = "";
  }
}

function removerFotoPersonalizada() {
  persistirAvatar(AVATARS[0]);
  renderAvatarOptions();
  setStatus("Foto personalizada removida.", "success");
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

async function cancelarPedido(idPedido, email) {
  const response = await fetch(getApiUrl(`/api/pedidos/${encodeURIComponent(idPedido)}/cancelar`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha ao cancelar pedido");
  }
  return payload;
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
      const canceled = status === "cancelado";
      const timeline = renderTimeline(status);
      return `
        <article class="pedido-item ${paid ? "is-paid" : "is-pending"}">
          <div class="pedido-top">
            <strong>#${escapeHtml(pedido.id.slice(0, 8))}</strong>
            <span class="pedido-status">${paid ? "Pago" : canceled ? "Cancelado" : "Pendente"}</span>
          </div>
          <div>Total: R$ ${Number(pedido.total || 0).toFixed(2).replace(".", ",")}</div>
          <div>Pagamento: ${escapeHtml(String(pedido.pagamento || "pix").toUpperCase())}</div>
          ${timeline}
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${paid || canceled ? "" : `<button type="button" class="checkout-btn secondary btn-verificar" data-id="${escapeHtml(pedido.id)}">Verificar pagamento</button>
            <button type="button" class="checkout-btn secondary btn-pagar" data-id="${escapeHtml(pedido.id)}" data-pag="${escapeHtml(String(pedido.pagamento || "pix").toLowerCase())}">Pagar agora</button>`}
            ${!paid && !canceled ? `<button type="button" class="checkout-btn secondary btn-cancelar" data-id="${escapeHtml(pedido.id)}">Cancelar pedido</button>` : ""}
            ${paid ? `<button type="button" class="checkout-btn secondary btn-recomprar" data-itens='${escapeHtml(JSON.stringify(pedido.itens || []))}'>🔁 Comprar novamente</button>` : ""}
          </div>
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

    list.querySelectorAll(".btn-recomprar").forEach((button) => {
      button.addEventListener("click", () => {
        try {
          const itens = JSON.parse(button.getAttribute("data-itens") || "[]");
          if (!itens.length) { showToast("Nenhum item encontrado neste pedido.", "error"); return; }
          const carrinho = JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
          for (const item of itens) {
            const exists = carrinho.find((c) => c.id === item.id);
            if (exists) { exists.quantidade = (exists.quantidade || 1) + (item.quantidade || 1); }
            else { carrinho.push({ ...item, quantidade: item.quantidade || 1 }); }
          }
          localStorage.setItem("zuca_carrinho", JSON.stringify(carrinho));
          showToast("Itens adicionados ao carrinho!", "success");
          setTimeout(() => { window.location.href = "/checkout"; }, 1200);
        } catch {
          showToast("Erro ao adicionar itens ao carrinho.", "error");
        }
      });
    });

    list.querySelectorAll(".btn-cancelar").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-id") || "";
        if (!id) return;

        const ok = window.confirm(`Deseja cancelar o pedido #${id.slice(0, 8)}?`);
        if (!ok) return;

        try {
          setStatus(`Cancelando pedido #${id.slice(0, 8)}...`);
          await cancelarPedido(id, email);
          showToast("Pedido cancelado com sucesso.", "success");
          listarPedidos(email);
        } catch (error) {
          showToast(`Erro ao cancelar: ${error.message}`, "error");
        }
      });
    });
  } catch {
    list.innerHTML = "<p>Nao foi possivel carregar seus pedidos.</p>";
  }
}

el("btn-salvar")?.addEventListener("click", salvarPerfil);
el("foto-avatar")?.addEventListener("change", onUploadAvatar);
el("btn-remover-foto")?.addEventListener("click", removerFotoPersonalizada);
el("btn-ir-checkout")?.addEventListener("click", () => {
  window.location.href = "/checkout";
});
el("email")?.addEventListener("blur", (event) => {
  const value = String(event.target.value || "").trim().toLowerCase();
  if (value) listarPedidos(value);
});

/* ── Login social (simulação local) ── */
function setLoginSocialStatus(msg, ok = true) {
  const s = el("login-social-status");
  if (!s) return;
  s.textContent = msg;
  s.style.color = ok ? "#1f8f4f" : "#b02a37";
}

function aplicarLoginSocial(email, provedor) {
  email = email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    setLoginSocialStatus("E-mail inválido. Tente novamente.", false);
    return;
  }
  const perfil = JSON.parse(localStorage.getItem("zuca_perfil") || "{}");
  perfil.email = email;
  localStorage.setItem("zuca_perfil", JSON.stringify(perfil));

  const checkoutCliente = JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}");
  checkoutCliente.email = email;
  localStorage.setItem("zuca_checkout_cliente", JSON.stringify(checkoutCliente));

  if (el("email")) el("email").value = email;
  setLoginSocialStatus(`Conectado como ${email} via ${provedor}.`);
  showToast(`Bem-vindo! Conectado com ${provedor}.`, "success");

  // Oculta a seção de login social e mostra o perfil
  const sec = el("login-social-section");
  if (sec) sec.style.display = "none";

  listarPedidos(email);
  if (perfil.email) carregarPerfil();
}

el("btn-login-google")?.addEventListener("click", () => {
  const atual = String(el("email")?.value || "").trim();
  const email = window.prompt("Digite seu e-mail do Gmail (Google):", atual);
  if (email) aplicarLoginSocial(email, "Google");
});

el("btn-login-apple")?.addEventListener("click", () => {
  const atual = String(el("email")?.value || "").trim();
  const email = window.prompt("Digite seu e-mail do iCloud (Apple):", atual);
  if (email) aplicarLoginSocial(email, "Apple");
});

el("btn-login-outlook")?.addEventListener("click", () => {
  const atual = String(el("email")?.value || "").trim();
  const email = window.prompt("Digite seu e-mail do Outlook (Microsoft):", atual);
  if (email) aplicarLoginSocial(email, "Outlook");
});

// Se o usuário já tem e-mail salvo, oculta a seção de login social
(function verificarLoginSocialVisivel() {
  const perfil = JSON.parse(localStorage.getItem("zuca_perfil") || "{}");
  const checkout = JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}");
  const email = perfil.email || checkout.email || "";
  if (email) {
    const sec = el("login-social-section");
    if (sec) sec.style.display = "none";
  }
})();

renderAvatarOptions();
carregarPerfil();

/* ========== Saved Address ========== */
function carregarEnderecoSalvo() {
  const end = JSON.parse(localStorage.getItem("zuca_endereco") || "{}");
  if (el("end-cep")) el("end-cep").value = end.cep || "";
  if (el("end-endereco")) el("end-endereco").value = end.endereco || "";
  if (el("end-numero")) el("end-numero").value = end.numero || "";
  if (el("end-bairro")) el("end-bairro").value = end.bairro || "";
  if (el("end-cidade")) el("end-cidade").value = end.cidade || "";
  if (el("end-estado")) el("end-estado").value = end.estado || "";
}

function salvarEndereco() {
  const end = {
    cep: String(el("end-cep")?.value || "").trim(),
    endereco: String(el("end-endereco")?.value || "").trim(),
    numero: String(el("end-numero")?.value || "").trim(),
    bairro: String(el("end-bairro")?.value || "").trim(),
    cidade: String(el("end-cidade")?.value || "").trim(),
    estado: String(el("end-estado")?.value || "").trim().toUpperCase(),
  };
  localStorage.setItem("zuca_endereco", JSON.stringify(end));

  // Also update checkout client data
  const cliente = JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}");
  Object.assign(cliente, end);
  localStorage.setItem("zuca_checkout_cliente", JSON.stringify(cliente));

  showToast("Endereço salvo com sucesso!", "success");
}

// CEP auto-fill via ViaCEP
el("end-cep")?.addEventListener("blur", async () => {
  const cep = String(el("end-cep")?.value || "").replace(/\D/g, "");
  if (cep.length !== 8) return;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) return;
    if (data.logradouro && el("end-endereco")) el("end-endereco").value = data.logradouro;
    if (data.bairro && el("end-bairro")) el("end-bairro").value = data.bairro;
    if (data.localidade && el("end-cidade")) el("end-cidade").value = data.localidade;
    if (data.uf && el("end-estado")) el("end-estado").value = data.uf;
  } catch { /* silent */ }
});

el("btn-salvar-endereco")?.addEventListener("click", salvarEndereco);
carregarEnderecoSalvo();

/* ========== Timeline ========== */
const TIMELINE_STEPS = [
  { key: "pendente", label: "Pedido" },
  { key: "pagto", label: "Pago" },
  { key: "producao", label: "Produção" },
  { key: "enviado", label: "Enviado" },
  { key: "entregue", label: "Entregue" },
];

function renderTimeline(currentStatus) {
  const idx = TIMELINE_STEPS.findIndex((s) => s.key === currentStatus);
  const activeIdx = idx >= 0 ? idx : 0;

  let html = '<div class="pedido-timeline">';
  TIMELINE_STEPS.forEach((step, i) => {
    const cls = i < activeIdx ? "done" : i === activeIdx ? "active" : "";
    if (i > 0) {
      html += `<div class="timeline-line ${i <= activeIdx ? "done" : ""}"></div>`;
    }
    html += `<div class="timeline-step ${cls}">
      <div class="timeline-dot">${i < activeIdx ? "✓" : i + 1}</div>
      <span class="timeline-label">${step.label}</span>
    </div>`;
  });
  html += "</div>";
  return html;
}

/* ========== Favoritos ========== */
async function renderFavoritos() {
  const container = document.getElementById("favoritos-container");
  if (!container) return;

  const wishlist = JSON.parse(localStorage.getItem("zuca_wishlist") || "[]");
  if (!wishlist.length) {
    container.innerHTML = '<p style="color: #999;">Você ainda não tem favoritos. Adicione produtos clicando no ♡</p>';
    return;
  }

  try {
    const response = await fetch(getApiUrl("/api/produtos"));
    if (!response.ok) throw new Error();
    const data = await response.json();
    const produtos = Array.isArray(data) ? data : (data?.produtos || []);

    const favoritos = produtos.filter((p) => wishlist.includes(p.id));

    if (!favoritos.length) {
      container.innerHTML = '<p style="color: #999;">Os produtos favoritados não estão mais disponíveis.</p>';
      return;
    }

    container.innerHTML = favoritos.map((p) => {
      const img = p.imagem || p.imagemCapa || (Array.isArray(p.imagens) ? p.imagens[0] : "") || "img/logo/logo.png";
      const preco = Number(p.preco || p.valor || 0);
      return `
        <div class="fav-card">
          <a href="/produto?id=${encodeURIComponent(p.id)}" style="text-decoration:none; color:inherit;">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(p.nome || '')}" loading="lazy">
            <div class="fav-card-info">
              <h4>${escapeHtml(p.nome || "Produto")}</h4>
              <span class="fav-price">R$ ${preco.toFixed(2).replace(".", ",")}</span>
            </div>
          </a>
          <button class="fav-remove-btn" data-id="${escapeHtml(p.id)}">✕ Remover</button>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".fav-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const wl = JSON.parse(localStorage.getItem("zuca_wishlist") || "[]").filter((x) => x !== id);
        localStorage.setItem("zuca_wishlist", JSON.stringify(wl));
        showToast("Removido dos favoritos.", "info");
        renderFavoritos();
      });
    });
  } catch {
    container.innerHTML = '<p style="color: #999;">Não foi possível carregar os favoritos.</p>';
  }
}

renderFavoritos();

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