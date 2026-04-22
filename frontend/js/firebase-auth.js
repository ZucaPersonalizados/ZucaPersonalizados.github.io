/**
 * firebase-auth.js — Firebase Authentication
 * Google, Apple (iCloud) e Microsoft (Outlook) via popup OAuth.
 * Exporta helpers usados em todas as páginas.
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// ── Config do projeto Firebase (client SDK — não é segredo) ──
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSChfGxVmDd1knT69By5A7xOGdJunaDPY",
  authDomain: "zuca-personalizados.firebaseapp.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:cdd83d5f8d9e5813d14aaa",
};

// Evita dupla inicialização quando o módulo é importado por múltiplas páginas
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);

// ── Providers ──
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.setCustomParameters({ prompt: "select_account" });

// ── Login ──
export async function loginComGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function loginComApple() {
  return signInWithPopup(auth, appleProvider);
}

export async function loginComMicrosoft() {
  return signInWithPopup(auth, microsoftProvider);
}

// ── Logout ──
export async function sairDoFirebase() {
  return signOut(auth);
}

// ── onAuthStateChanged re-exportado ──
export { onAuthStateChanged };

// ── Helpers de localStorage ──

/** Salva o usuário Firebase no localStorage (mantém o resto do sistema compatível) */
export function salvarUsuarioNoStorage(user) {
  if (!user) return;
  const nome = user.displayName || user.email?.split("@")[0] || "Usuário";
  const email = (user.email || "").toLowerCase();
  const avatar = user.photoURL || "";

  localStorage.setItem("zuca_perfil", JSON.stringify({ nome, email, avatar }));
  if (avatar) localStorage.setItem("zuca_avatar_url", avatar);

  const checkout = JSON.parse(localStorage.getItem("zuca_checkout_cliente") || "{}");
  checkout.nome = nome;
  checkout.email = email;
  localStorage.setItem("zuca_checkout_cliente", JSON.stringify(checkout));
  localStorage.setItem("zuca_checkout_cliente_nome", nome.split(" ")[0]);
}

/** Remove todos os dados de sessão do localStorage */
export function limparStorageUsuario() {
  ["zuca_checkout_cliente", "zuca_perfil", "zuca_avatar_url", "zuca_checkout_cliente_nome", "zuca_endereco"].forEach(
    (k) => localStorage.removeItem(k)
  );
}
