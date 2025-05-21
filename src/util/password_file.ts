import crypto from "node:crypto";
import fs from "node:fs";

export async function loadPasswordFromFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sha512Hash = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath);

    stream.on("data", chunk => {
      sha512Hash.update(chunk);
    });

    stream.on("end", () => {
      resolve(sha512Hash.digest("hex"));
    });

    stream.on("error", err => {
      reject(err);
    });
  });
}
