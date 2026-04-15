import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function carregarProduto() {

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    document.body.innerHTML = "Produto não encontrado";
    return;
  }

  const docRef = doc(db, "produtos", id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    document.body.innerHTML = "Produto não encontrado";
    return;
  }

  const produto = docSnap.data();

  // 🔥 TEXTO
  document.getElementById("nome").innerText = produto.nome || "";
  document.getElementById("preco").innerText = "R$ " + (produto.preco || "0,00");
  document.getElementById("descricao").innerText = produto.descricaoCurta || "";
  document.getElementById("descricao-completa").innerText = produto.descricaoLonga || "";

  // 🔥 BOTÃO - Adicionar ao carrinho
  const btnAdicionar = document.getElementById("btn-adicionar-carrinho");
  btnAdicionar.addEventListener("click", () => {
    adicionarAoCarrinho(produto);
  });

  // 🔥 IMAGENS (CORRETO)
  const imagens = Array.isArray(produto.imagens)
    ? produto.imagens
    : [];

  const imgPrincipal = document.getElementById("imagem-principal");
  const miniaturas = document.querySelector(".miniaturas");

  miniaturas.innerHTML = "";

  if (imagens.length > 0) {
    imgPrincipal.src = imagens[0];
  }

  imagens.forEach((img, index) => {

    const el = document.createElement("img");
    el.src = img;

    // 🔥 seleção ativa
    if (index === 0) el.classList.add("ativa");

    el.addEventListener("click", () => {
      imgPrincipal.src = img;

      // troca ativo
      document.querySelectorAll(".miniaturas img")
        .forEach(i => i.classList.remove("ativa"));

      el.classList.add("ativa");
    });

    miniaturas.appendChild(el);
  });

}

function adicionarAoCarrinho(produto) {
  const carrinho = JSON.parse(localStorage.getItem("zuca_carrinho") || "[]");
  
  const produtoExistente = carrinho.find(item => item.id === produto.id);
  
  if (produtoExistente) {
    produtoExistente.quantidade += 1;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: Array.isArray(produto.imagens) ? produto.imagens[0] : "",
      quantidade: 1
    });
  }
  
  localStorage.setItem("zuca_carrinho", JSON.stringify(carrinho));
  
  // Feedback visual
  const btn = document.getElementById("btn-adicionar-carrinho");
  const textoOriginal = btn.textContent;
  btn.textContent = "Adicionado! ✓";
  btn.style.background = "#e9836d";
  
  setTimeout(() => {
    btn.textContent = textoOriginal;
    btn.style.background = "";
  }, 2000);
}

carregarProduto();
