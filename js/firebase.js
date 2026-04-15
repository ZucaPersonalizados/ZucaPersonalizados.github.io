/**
 * ⚠️ ARQUIVO DE CONFIGURAÇÃO SEGURA PARA FIREBASE
 *
 * Fontes de configuração (ordem de prioridade):
 * 1) localStorage["firebase.web.config"] (JSON) - útil para setup rápido local
 * 2) js/config.local.js (não versionado)
 * 3) js/firebase.config.js (produção)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const FIREBASE_CONFIG_STORAGE_KEY = "firebase.web.config";
const FIREBASE_CONFIG_LEGACY_KEY = "zuca_firebase_config";
const FIREBASE_EMULATOR_FLAG_KEY = "firebase.useEmulator";
const FIREBASE_EMULATOR_LEGACY_FLAG_KEY = "zuca_use_firebase_emulator";

function getConfigFromLocalStorage() {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY)
      || localStorage.getItem(FIREBASE_CONFIG_LEGACY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const required = ["apiKey", "authDomain", "projectId"];
    const hasRequiredFields = required.every((key) => Boolean(parsed[key]));

    return hasRequiredFields ? parsed : null;
  } catch (error) {
    console.warn("Configuração Firebase inválida no localStorage.", error);
    return null;
  }
}

async function loadFirebaseConfig() {
  const configFromStorage = getConfigFromLocalStorage();
  if (configFromStorage) {
    console.log(`Firebase configurado via localStorage (${FIREBASE_CONFIG_STORAGE_KEY}).`);
    return configFromStorage;
  }

  try {
    const { firebaseConfig } = await import("./config.local.js");
    console.log("✅ Firebase configurado com credenciais locais (config.local.js)");
    return firebaseConfig;
  } catch (localError) {
    try {
      const { firebaseConfig } = await import("./firebase.config.js");
      console.log("✅ Firebase configurado com credenciais de produção (firebase.config.js)");
      return firebaseConfig;
    } catch (productionError) {
      console.error("❌ ERRO: Firebase não está configurado corretamente.");
      console.error("📝 Crie js/config.local.js (veja js/firebase.config.example.js).");
      throw new Error("Configuração de Firebase não encontrada.");
    }
  }
}

function shouldUseEmulators() {
  const emulatorFlag = localStorage.getItem(FIREBASE_EMULATOR_FLAG_KEY)
    || localStorage.getItem(FIREBASE_EMULATOR_LEGACY_FLAG_KEY);
  return emulatorFlag === "true";
}

const firebaseConfig = await loadFirebaseConfig();
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseRuntimeConfig = firebaseConfig;

if (shouldUseEmulators()) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  console.log("🧪 Firebase conectado aos emuladores locais (127.0.0.1:8080 / 9099)");
}
