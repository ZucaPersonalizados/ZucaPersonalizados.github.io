import express from "express";
import multer from "multer";
import { uploadArquivo } from "../controllers/uploadController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("arquivo"), uploadArquivo);

export default router;