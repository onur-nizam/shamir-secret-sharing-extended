import { split } from "../core/split.js";
import { combine } from "../core/combine.js";
import { defaultRng } from "../core/rng.js";
import { encodeShare, decodeShare, ShareFormat } from "./format.js";
import { encryptBytes, decryptBytes } from "./encryption.js";

export interface SplitOptions {
  threshold?: number;
  shares?: number;
  format?: ShareFormat;
  key?: Uint8Array; // optional AES-256-GCM key
}

/**
 * Split a secret string into shares, with optional encryption.
 */
export async function splitString(
  secret: string,
  opts: SplitOptions = {}
): Promise<(string | Uint8Array)[]> {
  const enc = new TextEncoder();
  const secretBytes = enc.encode(secret);

  const shares = split(secretBytes, {
    threshold: opts.threshold ?? 2,
    shares: opts.shares ?? 3,
    rng: defaultRng,
  });

  // Optionally encrypt each share's bytes
  const encryptedShares = await Promise.all(
    shares.map(async (s) => ({
      index: s.index,
      bytes: await encryptBytes(s.bytes, opts.key),
    }))
  );

  return encryptedShares.map((s) => encodeShare(s, opts.format ?? "json"));
}

/**
 * Combine shares back into the original string, with optional decryption.
 */
export async function combineStrings(
  parts: (string | Uint8Array)[],
  format: ShareFormat,
  key?: Uint8Array
): Promise<string> {
  const dec = new TextDecoder();
  const shares = await Promise.all(
    parts.map(async (p) => {
      const decoded = decodeShare(p, format);
      return {
        index: decoded.index,
        bytes: await decryptBytes(decoded.bytes, key),
      };
    })
  );
  const secretBytes = combine(shares);
  return dec.decode(secretBytes);
}
