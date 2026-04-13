import express from "express";
import cors from "cors";

import produtosRoutes from "./routes/produtos.js";
import uploadRoutes from "./routes/upload.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/produtos", produtosRoutes);
app.use("/upload", uploadRoutes);

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});