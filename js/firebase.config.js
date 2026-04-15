/**
 * CONFIGURAÇÃO DO FIREBASE PARA PRODUÇÃO
 * 
 * 🔒 SEGURANÇA:
 * - Chave com RESTRIÇÕES de domínio no Firebase Console
 * - Restringe a: zucapersonalizados.com.br
 * - Acesso apenas a Firestore + Auth
 * - Não acessa Admin SDK ou dados sensíveis
 */

export const firebaseConfig = {
  apiKey: "",
  authDomain: "zuca-personalizados.firebaseapp.com",
  databaseURL: "https://zuca-personalizados-default-rtdb.firebaseio.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:cdd83d5f8d9e5813d14aaa",
  measurementId: "G-75MRV5TBTL"
};

console.warn("⚠️ firebase.config.js está sem apiKey por segurança. Use js/config.local.js");
