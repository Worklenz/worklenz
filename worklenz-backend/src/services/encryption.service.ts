import crypto from "crypto";
import { log_error } from "../shared/utils";

/**
 * Encryption service for securing sensitive data like API tokens
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;

  /**
   * Get encryption key from environment
   * In production, this should come from a secure key management service (AWS KMS, HashiCorp Vault, etc.)
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is not set. This is required for secure token storage.");
    }

    // Key should be 32 bytes (256 bits) for AES-256
    // If key is a hex string, convert it
    if (key.length === 64) {
      return Buffer.from(key, "hex");
    }

    // Otherwise, derive a key using PBKDF2
    const salt = process.env.ENCRYPTION_SALT || "worklenz-default-salt-change-in-production";
    return crypto.pbkdf2Sync(key, salt, 100000, 32, "sha256");
  }

  /**
   * Encrypt sensitive data (like access tokens)
   * @param plaintext - The data to encrypt
   * @returns Encrypted data in format: iv:authTag:encryptedData (all hex encoded)
   */
  public static encrypt(plaintext: string): string {
    try {
      if (!plaintext) {
        throw new Error("Cannot encrypt empty value");
      }

      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encryptedData (all hex encoded)
      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      log_error(error);
      throw new Error("Encryption failed");
    }
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData - The encrypted data in format: iv:authTag:encryptedData
   * @returns Decrypted plaintext
   */
  public static decrypt(encryptedData: string): string {
    try {
      if (!encryptedData) {
        throw new Error("Cannot decrypt empty value");
      }

      const parts = encryptedData.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted data format");
      }

      const [ivHex, authTagHex, encrypted] = parts;

      const key = this.getEncryptionKey();
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      log_error(error);
      throw new Error("Decryption failed - data may be corrupted or key is incorrect");
    }
  }

  /**
   * Hash sensitive data for comparison (one-way)
   * Useful for things like verifying tokens without storing them
   */
  public static hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Generate a secure random token
   * @param length - Length in bytes (default 32)
   * @returns Hex-encoded random token
   */
  public static generateToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  public static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}
