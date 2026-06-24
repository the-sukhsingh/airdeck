import * as Crypto from "expo-crypto";
import { p256 } from "@noble/curves/nist.js";
import { gcm } from "@noble/ciphers/aes.js";

// Base64 helper functions
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = "";
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface ECDHKeyPair {
  privateKey: Uint8Array;
  publicKeyBase64: string;
}

// Generate P-256 ECDH Keypair using noble curves and expo-crypto for secure random bytes
export async function generateKeyPair(): Promise<ECDHKeyPair> {
  const privateKey = Crypto.getRandomBytes(32);
  // Get uncompressed public key (65 bytes, starts with 0x04)
  const publicKey = p256.getPublicKey(privateKey, false);
  const publicKeyBase64 = arrayBufferToBase64(publicKey);

  return {
    privateKey,
    publicKeyBase64,
  };
}

// Compute AES-256 key from our private key and peer's public key
export async function deriveSharedKey(
  ourPrivateKey: Uint8Array,
  peerPublicKeyBase64: string
): Promise<Uint8Array> {
  const peerPubKeyBuffer = base64ToArrayBuffer(peerPublicKeyBase64);
  const peerPublicKey = new Uint8Array(peerPubKeyBuffer);

  // Compute shared secret point
  const sharedSecretPoint = p256.getSharedSecret(ourPrivateKey, peerPublicKey);
  // Strip the leading parity byte to get the raw 32-byte X-coordinate
  const sharedSecret = sharedSecretPoint.slice(1);

  // Hash the shared secret bits using SHA-256 to get 32-byte key (matching Go's sha256.Sum256)
  const hashedKeyBuffer = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    sharedSecret
  );

  return new Uint8Array(hashedKeyBuffer);
}

// Encrypt payload using AES-256-GCM
// Returns base64 of (nonce + ciphertext)
export async function encryptData(plaintext: string, aesKey: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Generate 12-byte random nonce using expo-crypto
  const nonce = Crypto.getRandomBytes(12);

  const cipher = gcm(aesKey, nonce);
  const ciphertextBytes = cipher.encrypt(plaintextBytes);

  // Concat nonce + ciphertext (matching Go's Seal implementation)
  const combined = new Uint8Array(nonce.length + ciphertextBytes.length);
  combined.set(nonce, 0);
  combined.set(ciphertextBytes, nonce.length);

  return arrayBufferToBase64(combined);
}

// Decrypt ciphertext using AES-256-GCM
// Ciphertext is base64 of (nonce + ciphertext)
export async function decryptData(ciphertextBase64: string, aesKey: Uint8Array): Promise<string> {
  const combinedBuffer = base64ToArrayBuffer(ciphertextBase64);
  const combinedBytes = new Uint8Array(combinedBuffer);

  const nonceSize = 12; // AES-GCM standard nonce size
  if (combinedBytes.length < nonceSize) {
    throw new Error("ciphertext too short");
  }

  const nonce = combinedBytes.slice(0, nonceSize);
  const ciphertextBytes = combinedBytes.slice(nonceSize);

  const cipher = gcm(aesKey, nonce);
  const decryptedBytes = cipher.decrypt(ciphertextBytes);

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}

// Helper to compute a safety fingerprint for presentation pairing
export async function getFingerprint(aesKey: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const labelBytes = encoder.encode("fingerprint");

  // Concat aesKey + labelBytes (matching Go's fingerprint derivation)
  const combined = new Uint8Array(aesKey.length + labelBytes.length);
  combined.set(aesKey, 0);
  combined.set(labelBytes, aesKey.length);

  const hashBuffer = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  const hashBytes = new Uint8Array(hashBuffer);
  return Array.from(hashBytes.slice(0, 4))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
