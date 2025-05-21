export function base64StringFromUint8Array(array: Uint8Array): string {
  return Buffer.from(array).toString("base64");
}

export function uint8ArrayFromBase64String(base64String: string): Uint8Array {
  return Buffer.from(base64String, "base64");
}

export function base64StringFromObject(object: unknown): string {
  const objectJson = JSON.stringify(object);
  return Buffer.from(objectJson, "utf8").toString("base64");
}

export function objectFromBase64String<T>(base64String: string): T {
  const objectJson = Buffer.from(base64String, "base64").toString("utf8");
  return JSON.parse(objectJson);
}
