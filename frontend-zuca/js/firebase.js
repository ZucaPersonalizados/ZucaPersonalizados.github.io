// IMPORTS FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// CONFIG DO SEU FIREBASE
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "zuca-personalizados.firebaseapp.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.appspot.com",
  messagingSenderId: "SEU_ID",
  appId: "SEU_APP_ID"
};

// INICIALIZA
const app = initializeApp(firebaseConfig);

// EXPORTA
export const db = getFirestore(app);
