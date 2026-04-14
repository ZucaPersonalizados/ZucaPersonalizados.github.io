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

// ⚠️ Carrega credenciais: primeiro tenta config.local.js (dev), depois firebase.config.js (produção)
let firebaseConfig = {};

try {
  // Tenta importar do arquivo local de desenvolvimento (não commitado)
  try {
    const { firebaseConfig: config } = await import('./config.local.js');
    firebaseConfig = config;
    console.log("✅ Firebase configurado com credenciais de DESENVOLVIMENTO (config.local.js)");
  } catch (localError) {
    // Se não encontrou, tenta o arquivo de produção (commitado e restrito)
    const { firebaseConfig: config } = await import('./firebase.config.js');
    firebaseConfig = config;
    console.log("✅ Firebase configurado com credenciais de PRODUÇÃO (firebase.config.js)");
  }
} catch (error) {
  console.error('❌ ERRO: Firebase não está configurado corretamente');
  console.error('📝 Solução: Crie o arquivo js/config.local.js com suas credenciais');
  throw new Error('Configuração de Firebase não encontrada.');
}

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta instâncias
export const db = getFirestore(app);
export const auth = getAuth(app);
