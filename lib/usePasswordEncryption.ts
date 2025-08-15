import { useCallback } from 'react';
import { encodePassword as baseEncodePassword } from './passwordEncryption';

/**
 * React hook for simple password encoding
 * Provides client-side encoding to hide passwords from network inspection
 */

export function usePasswordEncoding() {
  /**
   * Simple encode password (uses base utility)
   */
  const encodePassword = useCallback((password: string): string => {
    try {
      return baseEncodePassword(password);
    } catch (error) {
      console.error('Password encoding error:', error);
      console.warn('Falling back to plain text password');
      return password; // Fallback to plain text if encoding fails
    }
  }, []);

  /**
   * Encode multiple password fields in an object
   */
  const encodePasswordFields = useCallback((
    data: Record<string, any>, 
    fields: string[] = ['password', 'newPassword', 'oldPassword']
  ): Record<string, any> => {
    const result = { ...data };
    
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = encodePassword(result[field]);
      }
    }
    
    return result;
  }, [encodePassword]);

  return {
    encodePassword,
    encodePasswordFields
  };
}