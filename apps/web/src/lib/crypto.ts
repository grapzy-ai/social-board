import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!b64) throw new Error("Missing env TOKEN_ENCRYPTION_KEY");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

/** AES-256-GCM. Output: base64(iv).base64(tag).base64(ciphertext) */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}
