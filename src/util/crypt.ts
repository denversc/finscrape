import crypto from "node:crypto";

import { base64StringFromObject, objectFromBase64String } from "./base64.ts";

export class Crypter {
  readonly #key: Uint8Array;

  constructor(key: Uint8Array) {
    this.#key = new Uint8Array(key);
  }

  encryptToBase64(data: unknown): string {
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

    return base64StringFromObject(encryptedBlob);
  }

  decryptFromBase64<T>(encryptedData: string): T {
    const { cipherTextBase64, authTagBase64, initializationVectorBase64 } =
      objectFromBase64String<EncryptedBlob>(encryptedData);
    const authTag = Buffer.from(authTagBase64, "base64");
    const iv = Buffer.from(initializationVectorBase64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", this.#key, iv);
    decipher.setAuthTag(authTag);
    const plainText1: Buffer = decipher.update(cipherTextBase64, "base64");
    const plainText2: Buffer = decipher.final();
    const plainText: Buffer = Buffer.concat([plainText1, plainText2]);

    const decryptedObjectJson = new TextDecoder().decode(plainText);
    return JSON.parse(decryptedObjectJson);
  }

  static fromPassword(password: string): CrypterFromPasswordResult {
    const salt = generateRandomSalt();
    const crypter = Crypter.fromPasswordAndSalt(password, salt);
    return { crypter, salt };
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

function encryptionKeyFromPasswordAndSalt(password: string, salt: Uint8Array): Uint8Array {
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

interface EncryptedBlob {
  cipherTextBase64: string;
  authTagBase64: string;
  initializationVectorBase64: string;
}
