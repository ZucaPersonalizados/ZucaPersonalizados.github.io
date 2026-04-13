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