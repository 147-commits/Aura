import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "aura-default-secret-change-in-prod";
  if (secret === "aura-default-secret-change-in-prod" && process.env.NODE_ENV === "production") {
    console.warn("WARNING: Using default encryption secret in production. Set SESSION_SECRET environment variable.");
  }
  return scryptSync(secret, "aura-salt-v1", 32);
}

/**
 * Encrypts plaintext and returns a ciphertext string in format: iv:authTag:data (all hex).
 * The returned string is NOT the original text — it must be decrypted to read.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a ciphertext string (iv:authTag:data format) back to plaintext.
 * Returns null on failure instead of silently returning the encrypted string.
 * Callers MUST handle the null case explicitly.
 */
export function decrypt(ciphertext: string): string | null {
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, dataHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(data).toString("utf8") + decipher.final("utf8");
  } catch {
    console.error("Decryption failed — data may be corrupted or key may have changed");
    return null;
  }
}

/**
 * Safely decrypt a database field.
 * If is_encrypted is true, decrypts. If decryption fails, returns "[Decryption failed]".
 * If is_encrypted is false, returns the value as-is (it's already plaintext).
 */
export function safeDecrypt(value: string | null | undefined, isEncrypted: boolean): string {
  if (!value) return "";
  if (!isEncrypted) return value;
  return decrypt(value) ?? "[Decryption failed]";
}
