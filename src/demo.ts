import { webcrypto as nodeCrypto } from "node:crypto";
import { splitString, combineStrings } from "./api/simple.js";

// cross-platform key generator
function generateKey(): Uint8Array {
  const g: any = globalThis;
  if (g?.crypto?.getRandomValues) {
    return g.crypto.getRandomValues(new Uint8Array(32));
  }
  return nodeCrypto.getRandomValues(new Uint8Array(32));
}

async function demo() {
  const secret = "TFxgABaQi3dSqQd9eEcePCU12RhUSU27ip";
  const key = generateKey();

  const shares = await splitString(secret, {
    threshold: 2,
    shares: 3,
    format: "base64",
    key,
  });
  console.log("Shares:", shares);

  const recovered = await combineStrings([shares[0], shares[2]], "base64", key);
  console.log("Recovered:", recovered);
}

demo();
