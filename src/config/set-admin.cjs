const admin = require("firebase-admin");
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function run() {
  const email = "willianzucareli@gmail.com";
  const user = await admin.auth().getUserByEmail(email);

  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  const updated = await admin.auth().getUser(user.uid);
  console.log("uid:", updated.uid);
  console.log("claims:", updated.customClaims);
}

run().catch(console.error);