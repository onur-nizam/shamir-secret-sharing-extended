[![CI](https://github.com/onur-nizam/shamir-secret-sharing-extended/actions/workflows/ci.yml/badge.svg)](https://github.com/onur-nizam/shamir-secret-sharing-extended/actions/workflows/ci.yml)

# shamir-secret-sharing-extended

A **zero-dependency** TypeScript library that implements **Shamir’s Secret Sharing (SSS)** — a cryptographic scheme that splits a secret into multiple pieces (“shares”) so that only a **threshold number of shares** can reconstruct it.  

- **Threshold security**: e.g., split a key into 5 shares, and require any 3 of them to recover the secret.  
- **Zero runtime dependencies**: relies only on the platform’s built-in Web Crypto API.  
- **Lightweight & portable**: works in Node.js (≥16) and modern browsers.  
- **Encryption option**: supports optional AES-256-GCM encryption of shares at rest.  
- **Flexible formats**: `json`, `string`, `binary`, or `base64`.  
- **Dual distribution**: ESM + CJS + TypeScript definitions.  
 
## Why this library?

Managing sensitive data like **wallet keys, API tokens, or environment secrets** is hard. Storing them in one place is risky. Shamir’s Secret Sharing provides **information-theoretic security**:

- With fewer than `t` shares, the secret is **impossible to reconstruct**.  
- With `t` or more, the secret is recovered exactly.  

This library provides a **modern, developer-friendly implementation** of SSS with:  

- **No dependencies** (secure by default, small bundle size).  
- **Simple API** (split / combine with sane defaults).  
- **Encryption support** (AES-GCM) for at-rest protection.  
- **Cross-platform compatibility** (Node & Browser).  
 
## How it works (in simple terms)

1. **Splitting (`split`)**:  
   - The secret (bytes) is encoded as the constant term of a random polynomial over GF(256).  
   - Each share is a point `(x, y)` on that polynomial.  
   - At least `t` points are required to reconstruct the polynomial.  

2. **Combining (`combine`)**:  
   - Given `t` valid shares, Lagrange interpolation recovers the constant term at `x=0`.  
   - The original secret is restored **exactly, without loss**.  

3. **Formats**:  
   - Shares can be serialized as JSON, compact strings, binary buffers, or base64 strings.  

4. **Optional encryption**:  
   - Each share’s bytes can be encrypted with **AES-256-GCM** using a 32-byte key.  
   - This ensures both confidentiality and integrity for each share at rest.  
 
## Example use cases

- **Cryptocurrency & Fintech**  
  - Protect wallet private keys by splitting them among multiple parties.  
  - Require multiple approvals (e.g., 3-of-5) for transactions.  

- **DevOps / Infrastructure**  
  - Share API tokens, JWT secrets, or database passwords across a team with threshold recovery.  
  - Disaster recovery scenarios where multiple people must cooperate.  

- **Individuals**  
  - Backup your recovery seed in multiple forms (QR, paper, USB).  
  - Ensure that no single lost share reveals your secret.  
 
## Security model

- **Confidentiality**: With fewer than `t` shares, the secret is perfectly hidden (information-theoretic security).  
- **Integrity**: Basic SSS does not detect tampering.  
  - With AES-GCM enabled, tampering is detected (decryption fails).  
- **RNG**: Polynomials use a cryptographically secure RNG (`Web Crypto`).  
- **Responsibility**: Share distribution and storage policies (who holds what) remain an operational concern.  
 
## Features at a glance

- ✅ Shamir’s Secret Sharing (t-of-n) over GF(256).  
- ✅ No runtime dependencies (only built-in crypto).  
- ✅ Optional AES-256-GCM per-share encryption.  
- ✅ Multiple serialization formats.  
- ✅ Works in Node ≥16 & modern browsers.  
- ✅ Distributed as ESM + CJS + TypeScript types.  
 