import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const firebaseKeyPath = process.env.FIREBASE_KEY_PATH || "./src/config/firebase-key.json";
const resolvedFirebaseKeyPath = path.isAbsolute(firebaseKeyPath)
  ? firebaseKeyPath
  : path.resolve(process.cwd(), firebaseKeyPath);

if (fs.existsSync(resolvedFirebaseKeyPath) && admin.apps.length === 0) {
  const serviceAccount = JSON.parse(fs.readFileSync(resolvedFirebaseKeyPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "zuca-personalizados.firebasestorage.app",
  });
}

export const db = admin.apps.length > 0 ? admin.firestore() : null;
export const bucket = admin.apps.length > 0 ? admin.storage().bucket("zuca-personalizados.firebasestorage.app") : null;