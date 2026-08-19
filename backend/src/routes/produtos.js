import express from "express";
import { listarProdutos, validarEstoque } from "../controllers/produtosController.js";

const router = express.Router();

router.get("/", listarProdutos);
router.get("/validar-estoque/:id", validarEstoque);

export default router;