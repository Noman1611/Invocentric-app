import { describe, it, expect, vi } from 'vitest';
import { encryptData, decryptData } from './cryptoUtils';

describe('cryptoUtils', () => {
  describe('encryptData', () => {
    it('should correctly encrypt valid data', () => {
      const data = { id: 1, name: 'Test' };
      const encrypted = encryptData(data);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);

      // Verify we can decrypt it back
      const decrypted = decryptData(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should return an empty string when encryption fails (e.g., circular reference)', () => {
      // Mock console.error to avoid cluttering test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a circular object to force JSON.stringify to throw an error
      const circularData: any = { id: 1 };
      circularData.self = circularData;

      const encrypted = encryptData(circularData);

      expect(encrypted).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith("Encryption error:", expect.any(TypeError));

      consoleSpy.mockRestore();
    });
  });
});
