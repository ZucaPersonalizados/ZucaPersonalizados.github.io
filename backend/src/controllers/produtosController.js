import { db } from "../firebase.js";

export const listarProdutos = async (req, res) => {
  try {
    const snapshot = await db.collection("produtos").get();

    const produtos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(produtos);

  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
};

/**
 * Validar disponibilidade de estoque para um item específico
 * GET /produtos/validar-estoque/:id?quantidade=1
 */
export const validarEstoque = async (req, res) => {
  try {
    const { id } = req.params;
    const quantidade = parseInt(req.query.quantidade) || 1;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: "ID do produto é obrigatório" 
      });
    }

    const docRef = db.collection("produtos").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: "Produto não encontrado",
        disponivel: false 
      });
    }

    const produto = docSnap.data();
    const estoque = produto.estoque || 0;
    const disponivel = estoque >= quantidade;

    res.json({
      success: true,
      disponivel,
      estoque,
      solicitado: quantidade,
      mensagem: disponivel 
        ? `${estoque} unidades disponíveis` 
        : `Somente ${estoque} disponíveis (solicitou ${quantidade})`
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * Decrementar estoque (chamado após pagamento confirmado)
 * POST /produtos/decrementar-estoque
 * Body: { itens: [{ id, quantidade }, ...] }
 */
export const decrementarEstoque = async (req, res) => {
  try {
    const { itens } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Array de itens é obrigatório" 
      });
    }

    const resultados = [];
    let temErro = false;

    for (const item of itens) {
      const { id, quantidade } = item;

      if (!id || !quantidade) {
        resultados.push({ 
          id, 
          sucesso: false, 
          erro: "ID e quantidade são obrigatórios" 
        });
        temErro = true;
        continue;
      }

      try {
        const docRef = db.collection("produtos").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists()) {
          resultados.push({ 
            id, 
            sucesso: false, 
            erro: "Produto não encontrado" 
          });
          temErro = true;
          continue;
        }

        const produto = docSnap.data();
        const estoqueAtual = produto.estoque || 0;

        if (estoqueAtual < quantidade) {
          resultados.push({ 
            id, 
            sucesso: false, 
            erro: `Estoque insuficiente (tem ${estoqueAtual}, solicitou ${quantidade})` 
          });
          temErro = true;
          continue;
        }

        // Atualizar estoque
        await docRef.update({
          estoque: estoqueAtual - quantidade,
          ultimaAtualizacaoEstoque: new Date().toISOString()
        });

        resultados.push({ 
          id, 
          sucesso: true, 
          estoqueAnterior: estoqueAtual, 
          estoqueNovo: estoqueAtual - quantidade 
        });

      } catch (erro) {
        resultados.push({ 
          id, 
          sucesso: false, 
          erro: erro.message 
        });
        temErro = true;
      }
    }

    res.json({
      success: !temErro,
      atualizacoes: resultados,
      mensagem: temErro ? "Algumas atualizações falharam" : "Estoque atualizado com sucesso"
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * Incrementar estoque (chamado se pedido for cancelado)
 * POST /produtos/incrementar-estoque
 * Body: { itens: [{ id, quantidade }, ...] }
 */
export const incrementarEstoque = async (req, res) => {
  try {
    const { itens } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Array de itens é obrigatório" 
      });
    }

    const resultados = [];

    for (const item of itens) {
      const { id, quantidade } = item;

      if (!id || !quantidade) {
        resultados.push({ 
          id, 
          sucesso: false, 
          erro: "ID e quantidade são obrigatórios" 
        });
        continue;
      }

      try {
        const docRef = db.collection("produtos").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists()) {
          resultados.push({ 
            id, 
            sucesso: false, 
            erro: "Produto não encontrado" 
          });
          continue;
        }

        const produto = docSnap.data();
        const estoqueAtual = produto.estoque || 0;

        // Atualizar estoque
        await docRef.update({
          estoque: estoqueAtual + quantidade,
          ultimaAtualizacaoEstoque: new Date().toISOString()
        });

        resultados.push({ 
          id, 
          sucesso: true, 
          estoqueAnterior: estoqueAtual, 
          estoqueNovo: estoqueAtual + quantidade 
        });

      } catch (erro) {
        resultados.push({ 
          id, 
          sucesso: false, 
          erro: erro.message 
        });
      }
    }

    res.json({
      success: true,
      atualizacoes: resultados
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};