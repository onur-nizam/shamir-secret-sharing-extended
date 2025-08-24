/**
 * AES-256-GCM encryption/decryption helpers for share bytes.
 * Works in both Node (>=16) and modern browsers.
 * Zero dependency: uses Web Crypto API only.
 */

import { webcrypto as nodeCrypto } from "node:crypto";

// Resolve WebCrypto provider (Node 16/18 + browser)
function getCrypto(): Crypto {
  const g: any = globalThis;
  if (g?.crypto?.subtle) return g.crypto as Crypto;
  if (nodeCrypto?.subtle) return nodeCrypto as unknown as Crypto;
  throw new Error("Web Crypto API not available. Requires Node >=16 or browser.");
}

/** Encrypt bytes with AES-256-GCM. If no key is provided, return input as-is. */
export async function encryptBytes(
  data: Uint8Array,
  key?: Uint8Array
): Promise<Uint8Array> {
  if (!key) return data;

  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (Uint8Array)");
  }

  const crypto = getCrypto();
  const algoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource, // ✅ force cast
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, algoKey, data as BufferSource) // ✅ force cast
  );

  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return out;
}

/** Decrypt bytes with AES-256-GCM. If no key is provided, return input as-is. */
export async function decryptBytes(
  encrypted: Uint8Array,
  key?: Uint8Array
): Promise<Uint8Array> {
  if (!key) return encrypted;

  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error("Decryption key must be 32 bytes (Uint8Array)");
  }

  const crypto = getCrypto();
  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);

  const algoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource, // ✅ force cast
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, algoKey, ciphertext as BufferSource) // ✅ force cast
  );
}
