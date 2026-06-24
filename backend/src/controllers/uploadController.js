import { bucket } from "../firebase.js";
import path from "path";

export const uploadArquivo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado" });
    }

    if (!bucket) {
      return res.status(503).json({ erro: "Storage nao configurado no servidor" });
    }

    const nomeOriginal = path
      .basename(req.file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100) || "arquivo";
    const nome = Date.now() + "-" + nomeOriginal;

    const file = bucket.file(nome);

    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype
      }
    });

    stream.on("error", (err) => {
      res.status(500).json({ erro: err.message });
    });

    stream.on("finish", async () => {
      await file.makePublic();

      const url = `https://storage.googleapis.com/${bucket.name}/${nome}`;

      res.json({ url });
    });

    stream.end(req.file.buffer);

  } catch (error) {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ erro: "Arquivo muito grande. Limite de 8MB." });
    }

    if (error?.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ erro: error.message || "Formato invalido. Use PDF, JPG ou PNG." });
    }

    res.status(500).json({ erro: error.message });
  }
};