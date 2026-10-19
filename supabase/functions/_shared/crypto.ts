import { crypto } from 'jsr:@std/crypto@1';
import { encodeBase64, decodeBase64 } from 'jsr:@std/encoding@1';

function getKeyMaterial(secret: string): Uint8Array {
  // Accepts either raw base64 (32 bytes) or a plain passphrase (hashed to 32 bytes)
  try {
    const decoded = decodeBase64(secret);
    if (decoded.length === 32) return new Uint8Array(decoded);
  } catch {
    // fall through to hashing
  }
  return new Uint8Array(crypto.subtle.digestSync('SHA-256', new TextEncoder().encode(secret)));
}

export async function encrypt(plaintext: string, secret: string): Promise<string> {
  const keyMaterial = getKeyMaterial(secret);
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return encodeBase64(combined);
}

export async function decrypt(encrypted: string, secret: string): Promise<string> {
  const keyMaterial = getKeyMaterial(secret);
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = decodeBase64(encrypted);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
