import { bucket } from "../firebase.js";
import path from "path";
import crypto from "crypto";

function mensagemErroStorage(error) {
  const texto = JSON.stringify(error || "").toLowerCase();
  if (texto.includes("accountdisabled") || texto.includes("billing account") || texto.includes("billingaccount")) {
    return "O armazenamento de imagens esta bloqueado porque o faturamento do projeto Firebase esta desativado. Reative o faturamento no Google Cloud/Firebase e tente novamente.";
  }

  if (String(error?.code || "") === "403" || Number(error?.code) === 403) {
    return "O Firebase recusou o armazenamento. Verifique as permissoes e o faturamento do projeto.";
  }

  return "Falha ao salvar arquivo no armazenamento";
}

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
    const nome = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}-${nomeOriginal}`;

    const file = bucket.file(nome);

    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
        contentDisposition: "attachment",
      }
    });

    stream.on("error", (err) => {
      console.error("[UPLOAD] Falha ao salvar arquivo:", err.message);
      if (!res.headersSent) {
        const billingBlocked = JSON.stringify(err || "").toLowerCase().includes("billing account")
          || JSON.stringify(err || "").toLowerCase().includes("accountdisabled");
        res.status(billingBlocked ? 503 : 500).json({ erro: mensagemErroStorage(err) });
      }
    });

    stream.on("finish", async () => {
      try {
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60,
        });

        if (!res.headersSent) res.json({ url });
      } catch (error) {
        console.error("[UPLOAD] Falha ao criar URL de acesso:", error.message);
        if (!res.headersSent) {
          res.status(503).json({ erro: mensagemErroStorage(error) });
        }
      }
    });

    stream.end(req.file.buffer);

  } catch (error) {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ erro: "Arquivo muito grande. Limite de 5MB." });
    }

    if (error?.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ erro: error.message || "Formato invalido. Use PDF, JPG, PNG, WEBP ou SVG." });
    }

    console.error("[UPLOAD] Erro inesperado:", error.message);
    res.status(500).json({ erro: "Falha ao processar upload" });
  }
};