import { describe, it, expect } from "vitest";
import { encryptBytes, decryptBytes } from "../src/api/encryption";
import { webcrypto } from "node:crypto";

function generateKey(): Uint8Array {
  return webcrypto.getRandomValues(new Uint8Array(32));
}

describe("AES-256-GCM encryption/decryption", () => {
  it("should encrypt and decrypt back to the original data", async () => {
    const key = generateKey();
    const input = new TextEncoder().encode("hello-secret");

    const encrypted = await encryptBytes(input, key);
    expect(encrypted).not.toEqual(input); // ciphertext farklı olmalı

    const decrypted = await decryptBytes(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe("hello-secret");
  });

  it("should return the same data if no key is provided", async () => {
    const input = new TextEncoder().encode("plain-data");

    const encrypted = await encryptBytes(input); // no key
    const decrypted = await decryptBytes(encrypted); // no key

    expect(new TextDecoder().decode(decrypted)).toBe("plain-data");
  });

  it("should throw if key length is not 32 bytes", async () => {
    const badKey = new Uint8Array(16);
    const input = new TextEncoder().encode("oops");

    await expect(() => encryptBytes(input, badKey)).rejects.toThrow();
    await expect(() => decryptBytes(input, badKey)).rejects.toThrow();
  });
});
