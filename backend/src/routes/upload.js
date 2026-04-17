import express from "express";
import multer from "multer";
import { uploadArquivo } from "../controllers/uploadController.js";

const router = express.Router();

const MIME_TYPES_PERMITIDOS = new Set([
	"application/pdf",
	"image/jpeg",
	"image/png",
]);

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 8 * 1024 * 1024,
	},
	fileFilter: (req, file, cb) => {
		const ext = String(file?.originalname || "").toLowerCase();
		const extensaoValida = /\.(pdf|jpe?g|png)$/.test(ext);
		const mimeValido = MIME_TYPES_PERMITIDOS.has(String(file?.mimetype || "").toLowerCase());

		if (!extensaoValida || !mimeValido) {
			const error = new Error("Formato invalido. Envie apenas PDF, JPG, JPEG ou PNG.");
			error.code = "INVALID_FILE_TYPE";
			return cb(error);
		}

		return cb(null, true);
	},
});

router.post("/", upload.single("arquivo"), uploadArquivo);

export default router;