import crypto from "node:crypto";

export class Crypter {

  #key: Uint8Array;

  constructor(key: Uint8Array) {
    this.#key = new Uint8Array(key);
  }

  encrypt(data: unknown): Promise<string> {
    const dataJsonString = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(dataJsonString);
    const iv = generateRandomInitializationVector();

    const cipher = crypto.createCipheriv("aes-256-gcm", this.#key, iv);
    const cipherText1: string = cipher.update(dataBytes, undefined, "base64");
    const cipherText2: string = cipher.final("base64");
    const cipherText: string = cipherText1 + cipherText2;

    const encryptedBlob = {
      cipherTextBase64: cipherText,
      authTagBase64: cipher.getAuthTag().toString("base64"),
      initializationVectorBase64: iv.toString("base64"),
    } satisfies EncryptedBlob;
  }

  static fromPassword(password: string): CrypterFromPasswordResult {
    const salt = generateRandomSalt();
    const crypter = Crypter.fromPasswordAndSalt(password, salt);
    return {crypter, salt};
  }

  static fromPasswordAndSalt(password: string, salt: Uint8Array): Crypter {
    const key = encryptionKeyFromPasswordAndSalt(password, salt);
    return new Crypter(key);
  }

}

/**
 * The type returned from `Crypter.fromPassword()`.
 */
export interface CrypterFromPasswordResult {
  /** The newly-created `Crypter` instance whose encryption key is derived from the given password
   * and randomly-generated salt.
   */
  crypter: Crypter;

  /**
   * The salt used when deriving the encryption key from the given password.
   */
  salt: Uint8Array;
}

export function encryptionKeyFromPasswordAndSalt(password: string, salt: Uint8Array): Uint8Array {
  const passwordBytes = new TextEncoder().encode(password);
  const iterations = 100000;
  const keyLength = 32;
  return crypto.pbkdf2Sync(passwordBytes, salt, iterations, keyLength, "sha512");
}

function generateRandomSalt() {
  return crypto.randomBytes(32);
}

function generateRandomInitializationVector() {
  return crypto.randomBytes(12);
}

function base64StringFromObject(object: unknown): string {
  const objectJson = JSON.stringify(object);
  return Buffer.from(objectJson, "utf8").toString("base64");
}

function objectFromBase64String(base64String: string): unknown {
  const objectJson = Buffer.from(base64String, "base64").toString("utf8");
  return JSON.parse(objectJson);
}

interface EncryptedBlob {
  cipherTextBase64: string;
  authTagBase64: string;
  initializationVectorBase64: string;
}
