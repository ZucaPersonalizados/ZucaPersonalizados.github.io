import { bucket } from "../firebase.js";

export const uploadArquivo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado" });
    }

    const nome = Date.now() + "-" + req.file.originalname;

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
    res.status(500).json({ erro: error.message });
  }
};