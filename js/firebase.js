/**
 * ⚠️ ARQUIVO DE CONFIGURAÇÃO SEGURA PARA FIREBASE
 * 
 * Este arquivo carrega as credenciais do Firebase de um arquivo local (config.local.js)
 * que NÃO deve ser commitado no repositório.
 * 
 * INSTRUÇÃO DE SETUP:
 * 1. Crie o arquivo 'config.local.js' na mesma pasta
 * 2. Não commite 'config.local.js' (está no .gitignore)
 * 3. Coloque suas credenciais reais em config.local.js
 * 4. Veja firebase.config.example.js para o template
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let firebaseConfig = {};

try {
  const { firebaseConfig: config } = await import('./config.local.js');
  firebaseConfig = config;
  console.log("✅ Firebase configurado com credenciais locais seguras (config.local.js)");
} catch (error) {
  console.error('❌ ERRO: js/config.local.js não encontrado ou inválido.');
  throw new Error('Configuração de Firebase local não encontrada.');
}

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta instâncias
export const db = getFirestore(app);
export const auth = getAuth(app);
