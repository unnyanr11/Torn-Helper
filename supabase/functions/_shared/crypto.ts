// AES-GCM payloads: base64(iv):base64(ciphertext), with read compatibility for combined legacy payloads.
function bytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function base64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}
async function key(secret: string) {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = bytes(secret);
  } catch {
    raw = new Uint8Array();
  }
  if (raw.length !== 32)
    raw = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    );
  if (!secret) throw new Error("Encryption is not configured");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encrypt(value: string, secret: string): Promise<string> {
  if (bytes(secret).length !== 32)
    throw new Error("Encryption secret must be base64-encoded 32 bytes");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(secret),
    new TextEncoder().encode(value),
  );
  return `${base64(iv)}:${base64(new Uint8Array(result))}`;
}
export async function decrypt(value: string, secret: string): Promise<string> {
  const parts = value.split(":");
  const combined = parts.length === 1 ? bytes(value) : null;
  const iv = combined ? combined.slice(0, 12) : bytes(parts[0]);
  const ciphertext = combined ? combined.slice(12) : bytes(parts[1]);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await key(secret),
      ciphertext,
    ),
  );
}
