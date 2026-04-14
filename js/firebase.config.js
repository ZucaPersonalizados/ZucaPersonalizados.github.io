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
  apiKey: "AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw",
  authDomain: "zuca-personalizados.firebaseapp.com",
  databaseURL: "https://zuca-personalizados-default-rtdb.firebaseio.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:c24d2011fe047863d14aaa",
  measurementId: "G-464H4KJF8P"
};

console.log("✅ Firebase configurado com sucesso");
