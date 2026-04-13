import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./config/firebase-key.json", import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "zuca-personalizados.firebasestorage.app"
});

export const db = admin.firestore();
export const bucket = admin.storage().bucket("zuca-personalizados.firebasestorage.app");