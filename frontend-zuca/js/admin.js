import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw",
  authDomain: "zuca-personalizados.firebaseapp.com",
  databaseURL: "https://zuca-personalizados-default-rtdb.firebaseio.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:0a0bb2c2047e7558d14aaa",
  measurementId: "G-PR8E6LTS9K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Para fallback rápido: informe e-mails permitidos em minúsculo.
// Se vazio, usa somente claim admin.
const ADMIN_EMAILS = [
  "willianzucareli@gmail.com"
];

const loginWrapper = document.getElementById("login-wrapper");
const adminWrapper = document.getElementById("admin-wrapper");
const loginEmail = document.getElementById("login-email");
const loginSenha = document.getElementById("login-senha");
const btnLogin = document.getElementById("btn-login");
const btnEsqueciSenha = document.getElementById("btn-esqueci-senha");
const btnLogout = document.getElementById("btn-logout");
const loginStatusEl = document.getElementById("login-status");

const form = document.getElementById("form-produto");
const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista-produtos");
const btnExcluir = document.getElementById("btn-excluir");
const btnNovo = document.getElementById("btn-novo");
const btnSubmit = document.getElementById("btn-submit");
const listaPedidosAdminEl = document.getElementById("lista-pedidos-admin");
const listaCuponsAdminEl = document.getElementById("lista-cupons-admin");
const formCupom = document.getElementById("form-cupom");

let produtoEditandoId = null;
let currentUser = null;
let isAdminUser = false;

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function setLoginStatus(message, type = "") {
  loginStatusEl.textContent = message;
  loginStatusEl.className = `status ${type}`.trim();
}

function showLogin() {
  loginWrapper.hidden = false;
  adminWrapper.hidden = true;
}

function showAdmin() {
  loginWrapper.hidden = true;
  adminWrapper.hidden = false;
}

function isPermissionDenied(error) {
  return error?.code === "permission-denied";
}

function isEmailAdmin(user) {
  if (!user?.email || ADMIN_EMAILS.length === 0) {
    return false;
  }

  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

async function isClaimAdmin(user) {
  const tokenResult = await user.getIdTokenResult(true);
  return tokenResult?.claims?.admin === true;
}

async function validarPermissaoAdmin(user) {
  const byClaim = await isClaimAdmin(user);
  return byClaim || isEmailAdmin(user);
}

function handleFirebaseError(error, fallbackMessage) {
  console.error(error);

  if (isPermissionDenied(error)) {
    setStatus(
      "Sem permissão no Firestore. Verifique as regras e claim admin do usuário.",
      "error"
    );
    return;
  }

  setStatus(error?.message || fallbackMessage, "error");
}

function limparFormulario(resetStatus = true) {
  form.reset();
  produtoEditandoId = null;
  btnSubmit.textContent = "Salvar produto";
  btnExcluir.style.display = "none";
  document.getElementById("id").readOnly = false;
  if (resetStatus) {
    setStatus("Pronto para cadastrar.");
  }
}

function obterProdutoDoFormulario() {
  const id = document.getElementById("id").value.trim();

  if (!id) {
    throw new Error("Informe um ID de produto válido.");
  }

  return {
    id,
    nome: document.getElementById("nome").value.trim(),
    preco: document.getElementById("preco").value.trim(),
    categoria: document.getElementById("categoria").value.trim(),
    tipo: document.getElementById("tipo").value.trim(),
    tamanho: document.getElementById("tamanho").value.trim(),
    gramatura: document.getElementById("gramatura").value.trim(),
    descricaoCurta: document.getElementById("descricaoCurta").value.trim(),
    descricaoLonga: document.getElementById("descricaoLonga").value.trim(),
    link: document.getElementById("link").value.trim(),
    imagens: (document.getElementById("imagens").value || "")
      .split(",")
      .map((img) => img.trim())
      .filter(Boolean),
    personalizado: document.getElementById("personalizado").checked,
    atualizadoEm: new Date().toISOString()
  };
}

function preencherFormulario(produto) {
  document.getElementById("id").value = produto.id || "";
  document.getElementById("nome").value = produto.nome || "";
  document.getElementById("preco").value = produto.preco || "";
  document.getElementById("categoria").value = produto.categoria || "";
  document.getElementById("tipo").value = produto.tipo || "";
  document.getElementById("tamanho").value = produto.tamanho || "";
  document.getElementById("gramatura").value = produto.gramatura || "";
  document.getElementById("descricaoCurta").value = produto.descricaoCurta || "";
  document.getElementById("descricaoLonga").value = produto.descricaoLonga || "";
  document.getElementById("link").value = produto.link || "";
  document.getElementById("imagens").value = Array.isArray(produto.imagens)
    ? produto.imagens.join(", ")
    : "";
  document.getElementById("personalizado").checked = Boolean(produto.personalizado);
}

async function listarProdutos() {
  listaEl.innerHTML = "<p class='product-meta'>Carregando produtos...</p>";

  try {
    const snapshot = await getDocs(collection(db, "produtos"));

    if (snapshot.empty) {
      listaEl.innerHTML = "<p class='product-meta'>Nenhum produto cadastrado ainda.</p>";
      return;
    }

    const produtos = snapshot.docs.map((item) => {
      const data = item.data();
      const resolvedId = data.id || item.id;
      return { ...data, id: resolvedId };
    });

    produtos.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    listaEl.innerHTML = produtos
      .map(
        (produto) => `
          <article class="product-item" data-id="${produto.id}">
            <h3>${produto.nome || "Sem nome"}</h3>
            <p class="product-meta">ID: ${produto.id || "-"}</p>
            <p class="product-meta">Categoria: ${produto.categoria || "-"} • Preço: ${produto.preco || "-"}</p>
            <div class="item-actions">
              <button type="button" class="btn-secondary" data-action="editar" data-id="${produto.id}">Editar</button>
            </div>
          </article>
        `
      )
      .join("");
  } catch (error) {
    listaEl.innerHTML = "<p class='product-meta'>Erro ao carregar produtos.</p>";
    handleFirebaseError(error, "Erro ao carregar lista de produtos.");
  }
}

async function carregarProdutoPorId(id) {
  const referencia = doc(db, "produtos", id);
  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error("Produto não encontrado para edição.");
  }

  const data = snapshot.data();
  return {
    ...data,
    id: data.id || snapshot.id
  };
}

async function listarPedidosAdmin() {
  if (!listaPedidosAdminEl) {
    return;
  }

  listaPedidosAdminEl.innerHTML = "<p class='product-meta'>Carregando pedidos...</p>";

  try {
    const pedidosQuery = query(collection(db, "pedidos"), orderBy("criadoEm", "desc"), limit(30));
    const snapshot = await getDocs(pedidosQuery);

    if (snapshot.empty) {
      listaPedidosAdminEl.innerHTML = "<p class='product-meta'>Nenhum pedido encontrado.</p>";
      return;
    }

    listaPedidosAdminEl.innerHTML = snapshot.docs.map((docItem) => {
      const pedido = docItem.data();
      return `
        <article class="product-item">
          <h3>Pedido #${docItem.id.slice(0, 8)}</h3>
          <p class="product-meta">Cliente: ${pedido?.cliente?.nome || pedido?.cliente?.email || "Não informado"}</p>
          <p class="product-meta">Total: R$ ${Number(pedido.total || 0).toFixed(2).replace(".", ",")}</p>
          <div class="item-actions">
            <select data-status-id="${docItem.id}">
              ${["recebido", "em_producao", "enviado", "entregue"].map((status) => `
                <option value="${status}" ${pedido.status === status ? "selected" : ""}>${status.replace("_", " ")}</option>
              `).join("")}
            </select>
            <button type="button" class="btn-secondary" data-action="salvar-status" data-id="${docItem.id}">Salvar status</button>
          </div>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    listaPedidosAdminEl.innerHTML = "<p class='product-meta'>Erro ao carregar pedidos.</p>";
  }
}

async function listarCuponsAdmin() {
  if (!listaCuponsAdminEl) {
    return;
  }

  listaCuponsAdminEl.innerHTML = "<p class='product-meta'>Carregando cupons...</p>";

  try {
    const snapshot = await getDocs(collection(db, "cupons"));
    if (snapshot.empty) {
      listaCuponsAdminEl.innerHTML = "<p class='product-meta'>Nenhum cupom cadastrado.</p>";
      return;
    }

    listaCuponsAdminEl.innerHTML = snapshot.docs.map((docItem) => {
      const cupom = docItem.data();
      return `
        <article class="product-item">
          <h3>${docItem.id}</h3>
          <p class="product-meta">Tipo: ${cupom.tipo || "percentual"} • Valor: ${cupom.valor || 0}</p>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    listaCuponsAdminEl.innerHTML = "<p class='product-meta'>Erro ao carregar cupons.</p>";
  }
}

btnLogin?.addEventListener("click", async () => {
  try {
    const email = loginEmail.value.trim();
    const senha = loginSenha.value;

    if (!email || !senha) {
      setLoginStatus("Informe e-mail e senha.", "error");
      return;
    }

    await signInWithEmailAndPassword(auth, email, senha);
    setLoginStatus("Login realizado com sucesso.", "ok");
  } catch (error) {
    console.error(error);
    setLoginStatus("Falha no login. Verifique e-mail e senha.", "error");
  }
});

btnEsqueciSenha?.addEventListener("click", async () => {
  try {
    const email = loginEmail.value.trim();

    if (!email) {
      setLoginStatus("Digite seu e-mail para enviar o link de redefinição.", "error");
      return;
    }

    await sendPasswordResetEmail(auth, email);
    setLoginStatus("Link de redefinição enviado para seu e-mail.", "ok");
  } catch (error) {
    console.error(error);
    setLoginStatus("Não foi possível enviar o link de redefinição.", "error");
  }
});

btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || !isAdminUser) {
    setStatus("Sessão inválida. Faça login como admin.", "error");
    return;
  }

  try {
    const produto = obterProdutoDoFormulario();
    const referencia = doc(db, "produtos", produto.id);

    await setDoc(referencia, produto, { merge: true });

    produtoEditandoId = produto.id;
    document.getElementById("id").readOnly = true;
    btnExcluir.style.display = "inline-block";
    btnSubmit.textContent = "Atualizar produto";

    setStatus(`Produto "${produto.nome || produto.id}" salvo com sucesso.`, "ok");
    await listarProdutos();
    limparFormulario(false);
  } catch (error) {
    handleFirebaseError(error, "Erro ao salvar produto.");
  }
});

btnNovo.addEventListener("click", () => {
  limparFormulario();
});

btnExcluir.addEventListener("click", async () => {
  if (!currentUser || !isAdminUser) {
    setStatus("Sessão inválida. Faça login como admin.", "error");
    return;
  }

  const id = produtoEditandoId || document.getElementById("id").value.trim();

  if (!id) {
    setStatus("Selecione um produto para excluir.", "error");
    return;
  }

  const confirmou = window.confirm(`Tem certeza que deseja excluir o produto "${id}"?`);

  if (!confirmou) {
    return;
  }

  try {
    await deleteDoc(doc(db, "produtos", id));
    setStatus(`Produto "${id}" excluído com sucesso.`, "ok");
    limparFormulario();
    await listarProdutos();
  } catch (error) {
    handleFirebaseError(error, "Não foi possível excluir o produto.");
  }
});

listaEl.addEventListener("click", async (event) => {
  const botao = event.target.closest("button[data-action='editar']");

  if (!botao) {
    return;
  }

  const id = botao.dataset.id;
  if (!id) {
    return;
  }

  try {
    const produto = await carregarProdutoPorId(id);
    preencherFormulario(produto);
    produtoEditandoId = id;
    document.getElementById("id").readOnly = true;
    btnExcluir.style.display = "inline-block";
    btnSubmit.textContent = "Atualizar produto";
    setStatus(`Editando produto "${produto.nome || id}".`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    handleFirebaseError(error, "Não foi possível carregar o produto.");
  }
});

listaPedidosAdminEl?.addEventListener("click", async (event) => {
  const botao = event.target.closest("button[data-action='salvar-status']");
  if (!botao) {
    return;
  }

  const pedidoId = botao.dataset.id;
  const select = document.querySelector(`select[data-status-id='${pedidoId}']`);
  const status = select?.value;

  if (!pedidoId || !status) {
    return;
  }

  try {
    await updateDoc(doc(db, "pedidos", pedidoId), { status });
    setStatus(`Status do pedido #${pedidoId.slice(0, 8)} atualizado para ${status}.`, "ok");
    await listarPedidosAdmin();
  } catch (error) {
    handleFirebaseError(error, "Não foi possível atualizar o status do pedido.");
  }
});

formCupom?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const codigo = document.getElementById("cupom-codigo").value.trim().toUpperCase();
    const tipo = document.getElementById("cupom-tipo").value;
    const valor = Number(document.getElementById("cupom-valor").value || 0);

    if (!codigo || valor <= 0) {
      setStatus("Informe código e valor válido para o cupom.", "error");
      return;
    }

    await setDoc(doc(db, "cupons", codigo), {
      codigo,
      tipo,
      valor,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });

    setStatus(`Cupom ${codigo} salvo com sucesso.`, "ok");
    formCupom.reset();
    await listarCuponsAdmin();
  } catch (error) {
    handleFirebaseError(error, "Não foi possível salvar o cupom.");
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    isAdminUser = false;
    showLogin();
    setLoginStatus("Faça login para acessar o painel.");
    return;
  }

  try {
    isAdminUser = await validarPermissaoAdmin(user);

    if (!isAdminUser) {
      await signOut(auth);
      showLogin();
      setLoginStatus(
        "Login ok, mas sem autorização de admin. Verifique claim admin ou ADMIN_EMAILS.",
        "error"
      );
      return;
    }

    showAdmin();
    limparFormulario();
    await listarProdutos();
    await listarPedidosAdmin();
    await listarCuponsAdmin();
  } catch (error) {
    console.error(error);
    await signOut(auth);
    showLogin();
    setLoginStatus("Erro ao validar permissões de administrador.", "error");
  }
});
