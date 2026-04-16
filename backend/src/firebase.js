import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const firebaseKeyPath = process.env.FIREBASE_KEY_PATH || "./src/config/firebase-key.json";
const resolvedFirebaseKeyPath = path.isAbsolute(firebaseKeyPath)
  ? firebaseKeyPath
  : path.resolve(process.cwd(), firebaseKeyPath);

let firebaseInitSource = "none";
let firebaseInitError = "Nenhuma credencial Firebase encontrada";

function normalizeServiceAccount(raw, sourceLabel) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = { ...raw };
  if (parsed.private_key && parsed.private_key.includes("\\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }

  const hasFields =
    parsed.type === "service_account" &&
    !!parsed.project_id &&
    !!parsed.client_email &&
    !!parsed.private_key;

  if (!hasFields) {
    firebaseInitError = `Credencial incompleta em ${sourceLabel}`;
    console.error(`[FIREBASE] ${firebaseInitError}`);
    return null;
  }

  if (!String(parsed.private_key).includes("BEGIN PRIVATE KEY")) {
    firebaseInitError = `private_key invalida em ${sourceLabel}`;
    console.error("[FIREBASE] private_key invalida em", sourceLabel, ". Use a chave da Service Account do Firebase.");
    return null;
  }

  return parsed;
}

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return normalizeServiceAccount(parsed, "FIREBASE_SERVICE_ACCOUNT_JSON");
  } catch (error) {
    firebaseInitError = `FIREBASE_SERVICE_ACCOUNT_JSON invalido: ${error.message}`;
    console.error("[FIREBASE] FIREBASE_SERVICE_ACCOUNT_JSON invalido:", error.message);
    return null;
  }
}

function getServiceAccountFromBase64() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!raw) return null;

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return normalizeServiceAccount(parsed, "FIREBASE_SERVICE_ACCOUNT_BASE64");
  } catch (error) {
    firebaseInitError = `FIREBASE_SERVICE_ACCOUNT_BASE64 invalido: ${error.message}`;
    console.error("[FIREBASE] FIREBASE_SERVICE_ACCOUNT_BASE64 invalido:", error.message);
    return null;
  }
}

function getServiceAccountFromParts() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  const privateKey = privateKeyRaw.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;

  return normalizeServiceAccount({
    type: "service_account",
    project_id: projectId,
    private_key: privateKey,
    client_email: clientEmail,
  }, "FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY");
}

const serviceAccountFromEnv =
  getServiceAccountFromEnv() ||
  getServiceAccountFromBase64() ||
  getServiceAccountFromParts();

if (serviceAccountFromEnv && admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountFromEnv),
      storageBucket: "zuca-personalizados.firebasestorage.app",
    });
    firebaseInitSource = "env";
    firebaseInitError = null;
  } catch (error) {
    firebaseInitError = `Falha ao inicializar Firebase por env: ${error.message}`;
    console.error("[FIREBASE]", firebaseInitError);
  }
} else if (fs.existsSync(resolvedFirebaseKeyPath) && admin.apps.length === 0) {
  try {
    const fileContent = fs.readFileSync(resolvedFirebaseKeyPath, "utf8");
    if (fileContent.includes("BEGIN PGP PUBLIC KEY BLOCK")) {
      firebaseInitError = "FIREBASE_KEY_PATH aponta para chave PGP (.asc)";
      console.error("[FIREBASE] FIREBASE_KEY_PATH aponta para chave PGP (.asc). Use o JSON da Service Account do Firebase.");
    } else {
      const serviceAccount = normalizeServiceAccount(
        JSON.parse(fileContent),
        `arquivo ${resolvedFirebaseKeyPath}`
      );

      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: "zuca-personalizados.firebasestorage.app",
        });
        firebaseInitSource = "file";
        firebaseInitError = null;
      }
    }
  } catch (error) {
    firebaseInitError = `Nao foi possivel carregar FIREBASE_KEY_PATH: ${error.message}`;
    console.error("[FIREBASE] Nao foi possivel carregar FIREBASE_KEY_PATH:", error.message);
  }
}

export const db = admin.apps.length > 0 ? admin.firestore() : null;
export const bucket = admin.apps.length > 0 ? admin.storage().bucket("zuca-personalizados.firebasestorage.app") : null;
export const firebaseDebug = {
  active: admin.apps.length > 0,
  source: firebaseInitSource,
  error: firebaseInitError,
  env: {
    hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    hasServiceAccountBase64: !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    hasKeyPath: !!process.env.FIREBASE_KEY_PATH,
  },
};