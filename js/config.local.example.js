/**
 * TEMPLATE DE CONFIGURAÇÃO DO FIREBASE
 * 
 * 📝 INSTRUÇÕES:
 * 1. Copie este arquivo e salve como: config.local.js
 * 2. Coloque suas credenciais reais (do Firebase Console)
 * 3. NÃO commite config.local.js no Git (está no .gitignore)
 * 4. Cada desenvolvedor terá seu próprio config.local.js
 * 
 * ⚠️ SEGURANÇA:
 * - NUNCA commite chaves de API no repositório
 * - Use variáveis de ambiente em produção
 * - Restrinja as chaves de API no Firebase Console
 */

export const firebaseConfig = {
  apiKey: "SUA_CHAVE_DE_API_AQUI", // ← Substitua com sua chave real do Firebase
  authDomain: "zuca-personalizados.firebaseapp.com",
  databaseURL: "https://zuca-personalizados-default-rtdb.firebaseio.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:c24d2011fe047863d14aaa",
  measurementId: "G-464H4KJF8P"
};

console.log("✅ Configuração do Firebase carregada de config.local.js");
