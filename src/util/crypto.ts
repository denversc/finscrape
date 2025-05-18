import crypto from "node:crypto";

const key = "1ErDLz9W8fJCQ+gGiKICBPBfy5TkBL9Dx84nAF6Hkvc=" as const;
const iv = "/PqhiCThqD3Lli1g6ceVqw==" as const;
const cipherType = "aes-256-gcm" as const;

interface EncryptedData {
  cipherText: string;
  authTag: string;
}

export function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(cipherType, fromBase64(key), fromBase64(iv));
  const cipherText1 = cipher.update(text, "utf8", "base64");
  const cipherText2 = cipher.final("base64");
  const cipherText = cipherText1 + cipherText2;
  const authTag = cipher.getAuthTag().toString("base64");

  const encryptedData: EncryptedData = { cipherText, authTag };
  return Buffer.from(new TextEncoder().encode(JSON.stringify(encryptedData))).toString("base64");
}

export function decrypt(encryptedText: string): string {
  const encryptedData: EncryptedData = JSON.parse(
    new TextDecoder().decode(Buffer.from(encryptedText, "base64")),
  );
  const { cipherText, authTag } = encryptedData;
  const decipher = crypto.createDecipheriv(cipherType, fromBase64(key), fromBase64(iv));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plainText1 = decipher.update(cipherText, "base64", "utf8");
  const plainText2 = decipher.final("utf8");
  return plainText1 + plainText2;
}

function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "base64"));
}
