function base64StringFromObject(object: unknown): string {
  const objectJson = JSON.stringify(object);
  return Buffer.from(objectJson, "utf8").toString("base64");
}

function objectFromBase64String(base64String: string): unknown {
  const objectJson = Buffer.from(base64String, "base64").toString("utf8");
  return JSON.parse(objectJson);
}
