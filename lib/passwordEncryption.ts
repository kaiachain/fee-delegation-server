/**
 * Simple password encoding utility for hiding passwords from network inspection
 * Uses base64 + simple character transformation for 100% reliable encoding/decoding
 */

/**
 * Simple encode password (base64 + character shift)
 * @param password - Plain text password to encode
 * @returns Encoded password
 */
export function encodePassword(password: string): string {
  try {
    // Simple character shift by 3 positions
    const shifted = password
      .split('')
      .map(char => String.fromCharCode(char.charCodeAt(0) + 3))
      .join('');
    
    // Base64 encode
    return Buffer.from(shifted, 'utf8').toString('base64');
  } catch (error) {
    console.error('Password encoding error:', error);
    throw new Error('Failed to encode password');
  }
}

/**
 * Simple decode password (reverse base64 + character shift)
 * @param encodedPassword - Base64 encoded password
 * @returns Decoded plain text password
 */
export function decodePassword(encodedPassword: string): string {
  try {
    // Base64 decode
    const shifted = Buffer.from(encodedPassword, 'base64').toString('utf8');
    
    // Reverse character shift by 3 positions
    const original = shifted
      .split('')
      .map(char => String.fromCharCode(char.charCodeAt(0) - 3))
      .join('');
    
    return original;
  } catch (error) {
    console.error('Password decoding error:', error);
    throw new Error('Failed to decode password');
  }
}

/**
 * Check if a string looks like an encoded password
 * @param value - String to check
 * @returns True if looks encoded
 */
export function isEncodedPassword(value: string): boolean {
  try {
    // Basic checks: base64 format and minimum length
    if (!value || typeof value !== 'string') return false;
    
    // Check if it's valid base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(value)) return false;
    
    // Try to decode and check if it makes sense
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    
    // Should have reasonable length (not empty, not too long)
    if (decoded.length === 0 || decoded.length > 200) return false;
    
    return true;
  } catch {
    return false;
  }
}