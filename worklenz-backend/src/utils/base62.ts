/**
 * Base62 Encoding Utility
 *
 * Base62 uses alphanumeric characters (0-9, A-Z, a-z) to encode data.
 * Perfect for URL-safe short tokens without special characters.
 *
 * Benefits:
 * - URL-safe (no special characters like +, /, =)
 * - Compact representation
 * - Human-readable and copyable
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(62);

/**
 * Encode a Buffer to Base62 string
 * @param buffer - The buffer to encode
 * @returns Base62 encoded string
 */
export function base62Encode(buffer: Buffer): string {
  if (buffer.length === 0) return '0';

  // Convert buffer to BigInt
  let num = BigInt('0x' + buffer.toString('hex'));

  if (num === BigInt(0)) return '0';

  let result = '';

  while (num > BigInt(0)) {
    const remainder = Number(num % BASE);
    result = BASE62_CHARS[remainder] + result;
    num = num / BASE;
  }

  return result;
}

/**
 * Decode a Base62 string to Buffer
 * @param str - The Base62 string to decode
 * @returns Decoded buffer
 */
export function base62Decode(str: string): Buffer {
  if (!str || str === '0') return Buffer.alloc(0);

  let num = BigInt(0);

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = BASE62_CHARS.indexOf(char);

    if (index === -1) {
      throw new Error(`Invalid base62 character: ${char}`);
    }

    num = num * BASE + BigInt(index);
  }

  // Convert BigInt to hex string
  let hex = num.toString(16);

  // Ensure even length for Buffer.from
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }

  return Buffer.from(hex, 'hex');
}

/**
 * Generate a random Base62 token of specified length
 * @param byteLength - Number of random bytes to generate (default: 8)
 * @returns Base62 encoded random token
 */
export function generateBase62Token(byteLength: number = 8): string {
  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(byteLength);
  return base62Encode(randomBytes);
}

/**
 * Validate if a string is valid Base62
 * @param str - String to validate
 * @returns true if valid Base62
 */
export function isValidBase62(str: string): boolean {
  if (!str) return false;

  for (let i = 0; i < str.length; i++) {
    if (BASE62_CHARS.indexOf(str[i]) === -1) {
      return false;
    }
  }

  return true;
}

/**
 * Generate a prefixed token (e.g., "wli_aB3xK9pL")
 * @param prefix - Token prefix (e.g., "wli" for Worklenz Invite)
 * @param byteLength - Number of random bytes (default: 8)
 * @returns Prefixed Base62 token
 */
export function generatePrefixedToken(prefix: string, byteLength: number = 8): string {
  const token = generateBase62Token(byteLength);
  return `${prefix}_${token}`;
}
