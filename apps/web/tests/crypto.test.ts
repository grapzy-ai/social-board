import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "@/lib/crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("token crypto", () => {
  it("round-trips a token", () => {
    const enc = encryptToken("THQ.secret-token");
    expect(decryptToken(enc)).toBe("THQ.secret-token");
  });
  it("produces different ciphertexts for the same plaintext (random iv)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });
  it("throws on a tampered ciphertext", () => {
    const enc = encryptToken("abc");
    const parts = enc.split(".");
    parts[2] = Buffer.from("xx" + Buffer.from(parts[2], "base64").toString("binary").slice(2), "binary").toString("base64");
    expect(() => decryptToken(parts.join("."))).toThrow();
  });
});
