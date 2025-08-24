import { Share } from "../core/split.js";

export type ShareFormat = "json" | "string" | "binary" | "base64";

/**
 * Encode a share into the requested format.
 */
export function encodeShare(
  share: Share,
  format: ShareFormat
): string | Uint8Array {
  switch (format) {
    case "json":
      return JSON.stringify({
        x: share.index,
        y: Buffer.from(share.bytes).toString("hex"),
      });

    case "string":
      return `${share.index}-${Buffer.from(share.bytes).toString("hex")}`;

    case "binary": {
      const buf = new Uint8Array(1 + share.bytes.length);
      buf[0] = share.index;
      buf.set(share.bytes, 1);
      return buf;
    }

    case "base64":
      return `x${share.index}:${Buffer.from(share.bytes).toString("base64")}`;

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Decode from given format back to Share object.
 */
export function decodeShare(
  input: string | Uint8Array,
  format: ShareFormat
): Share {
  switch (format) {
    case "json": {
      const obj = JSON.parse(input as string);
      return {
        index: obj.x,
        bytes: new Uint8Array(Buffer.from(obj.y, "hex")),
      };
    }

    case "string": {
      const [xStr, hex] = (input as string).split("-");
      return {
        index: parseInt(xStr, 10),
        bytes: new Uint8Array(Buffer.from(hex, "hex")),
      };
    }

    case "binary": {
      const buf = input as Uint8Array;
      return {
        index: buf[0],
        bytes: buf.slice(1),
      };
    }

    case "base64": {
      const [xStr, b64] = (input as string).split(":");
      return {
        index: parseInt(xStr.slice(1), 10),
        bytes: new Uint8Array(Buffer.from(b64, "base64")),
      };
    }

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
