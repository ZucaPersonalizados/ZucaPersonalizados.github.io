import express from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { uploadArquivo } from "../controllers/uploadController.js";

const router = express.Router();

const uploadRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 20,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: { success: false, erro: "Limite de uploads atingido. Tente novamente mais tarde." },
});

const MIME_TYPES_PERMITIDOS = new Set([
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/svg+xml",
]);

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024,
		fields: 10,
		parts: 12,
	},
	fileFilter: (req, file, cb) => {
		const ext = String(file?.originalname || "").toLowerCase();
		const extensaoValida = /\.(pdf|jpe?g|png|svg)$/.test(ext);
		const mimeValido = MIME_TYPES_PERMITIDOS.has(String(file?.mimetype || "").toLowerCase());

		if (!extensaoValida || !mimeValido) {
			const error = new Error("Formato invalido. Envie apenas PDF, JPG, JPEG, PNG ou SVG.");
			error.code = "INVALID_FILE_TYPE";
			return cb(error);
		}

		return cb(null, true);
	},
});

router.post("/", uploadRateLimit, upload.single("arquivo"), uploadArquivo);

export default router;