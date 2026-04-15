import express from "express";
import { 
  listarProdutos, 
  validarEstoque,
  decrementarEstoque,
  incrementarEstoque 
} from "../controllers/produtosController.js";

const router = express.Router();

router.get("/", listarProdutos);
router.get("/validar-estoque/:id", validarEstoque);
router.post("/decrementar-estoque", decrementarEstoque);
router.post("/incrementar-estoque", incrementarEstoque);

export default router;