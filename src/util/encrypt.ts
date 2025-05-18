import fs from "node:fs";

import { encrypt } from "./crypto.ts";

for (const srcFile of process.argv.slice(2)) {
  const destFile = srcFile + ".encrypted";
  console.log(`Encrypting ${srcFile} to ${destFile}`);
  const plainText = fs.readFileSync(srcFile, { encoding: "utf8" }).trim();
  const cipherText = encrypt(plainText);
  fs.writeFileSync(destFile, cipherText, { encoding: "utf8" });
}
