import { readKey, rotateSecrets } from "@fxbot/sdk";
import { readFileSync } from "node:fs";

// Seals every stored key and token again under a new key. Stop the server first, run this with the new key file,
// then point FXBOT_SECRET_KEY_FILE at that file and start the server.
const [newKeyFile] = process.argv.slice(2);
const { FXBOT_DATABASE_URL: databaseUrl, FXBOT_SECRET_KEY_FILE: keyFile } = process.env;
if (!newKeyFile || !databaseUrl || !keyFile) {
  console.error("usage: npm run rotate-key -- <new key file>, with FXBOT_DATABASE_URL and FXBOT_SECRET_KEY_FILE (the old key) set");
  process.exit(1);
}
const from = readKey(readFileSync(keyFile, "utf8"));
const to = readKey(readFileSync(newKeyFile, "utf8"));
const count = await rotateSecrets({ databaseUrl, from, to });
console.log(`Sealed ${count} secret${count === 1 ? "" : "s"} with the new key. Now point FXBOT_SECRET_KEY_FILE at ${newKeyFile}.`);
