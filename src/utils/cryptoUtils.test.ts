import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptData, decryptData, setSecureStorage, getSecureStorage } from './cryptoUtils';
import CryptoJS from 'crypto-js';

describe('cryptoUtils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('encryptData', () => {
    it('should encrypt string data', () => {
      const data = 'test data';
      const encrypted = encryptData(data);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(data);
      expect(encrypted).not.toBe(JSON.stringify(data));
    });

    it('should encrypt object data', () => {
      const data = { id: 1, name: 'John Doe' };
      const encrypted = encryptData(data);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(JSON.stringify(data));
    });

    it('should encrypt null/undefined data', () => {
      expect(typeof encryptData(null)).toBe('string');
      expect(typeof encryptData(undefined)).toBe('string');
    });

    it('should handle encryption errors gracefully', () => {
      // JSON.stringify throws on circular references, triggering the catch block in encryptData
      const circularRef: any = {};
      circularRef.self = circularRef;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = encryptData(circularRef);

      expect(result).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('Encryption error:', expect.any(Error));
    });
  });

  describe('decryptData', () => {
    it('should decrypt correctly encrypted string data', () => {
      const data = 'test data';
      const encrypted = encryptData(data);
      const decrypted = decryptData(encrypted);
      expect(decrypted).toBe(data);
    });

    it('should decrypt correctly encrypted object data', () => {
      const data = { id: 1, name: 'John Doe' };
      const encrypted = encryptData(data);
      const decrypted = decryptData(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should return fallback value for null or empty cipherText', () => {
      expect(decryptData(null, 'fallback')).toBe('fallback');
      expect(decryptData('', 'fallback')).toBe('fallback');
    });

    it('should return fallback value for invalid encrypted string that does not throw but yields empty decryptedString', () => {
      const result = decryptData('invalid-encrypted-string', 'fallback');
      // CryptoJS does not throw here but returns an empty word array which toString() converts to empty string
      // so it hits `if (!decryptedString) return fallbackValue;`
      expect(result).toBe('fallback');
    });

    it('should catch errors when JSON.parse fails and return fallback', () => {
      // Mock CryptoJS to return a valid string that is NOT valid JSON
      vi.spyOn(CryptoJS.AES, 'decrypt').mockReturnValue({
        toString: () => 'not-json'
      } as any);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = decryptData('some-encrypted-stuff', 'fallback');

      expect(result).toBe('fallback');
      expect(consoleSpy).toHaveBeenCalledWith(
        "Decryption error (might be unencrypted old data or wrong key). Falling back.",
        expect.any(Error)
      );
    });

    it('should handle unencrypted legacy JSON data (fallback mechanism) by catching error in parsing decryptedString and falling back to parsing cipherText', () => {
      // We will mock CryptoJS to return empty string (as it naturally does for JSON string cipher text)
      // Wait, if it returns empty string, `if (!decryptedString) return fallbackValue;` is hit, and NO ERROR is thrown.
      // We need it to throw an error so it hits the catch block.
      // So we mock CryptoJS.AES.decrypt to throw.
      vi.spyOn(CryptoJS.AES, 'decrypt').mockImplementation(() => {
        throw new Error('decryption failed');
      });

      const legacyData = JSON.stringify({ old: 'data' });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = decryptData(legacyData, 'fallback');

      expect(result).toEqual({ old: 'data' });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('setSecureStorage', () => {
    it('should encrypt data and save it to localStorage', () => {
      const key = 'test_key';
      const data = { foo: 'bar' };

      setSecureStorage(key, data, true);

      const storedItem = localStorage.getItem(key);
      expect(storedItem).not.toBeNull();
      expect(storedItem).not.toBe(JSON.stringify(data)); // ensure it is encrypted

      // Decrypt to verify it matches original
      const decrypted = decryptData(storedItem!);
      expect(decrypted).toEqual(data);
    });

    it('should dispatch local_db_write event when not silent', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      const key = 'test_key';
      const data = { foo: 'bar' };

      setSecureStorage(key, data, false);

      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('local_db_write');
      expect(event.detail).toEqual({ key, data });
    });
  });

  describe('getSecureStorage', () => {
    it('should return fallback value if key does not exist', () => {
      expect(getSecureStorage('non_existent_key', 'fallback')).toBe('fallback');
    });

    it('should return decrypted data if key exists and is valid encrypted data', () => {
      const key = 'test_key';
      const data = { foo: 'bar' };
      setSecureStorage(key, data, true);

      const result = getSecureStorage(key);
      expect(result).toEqual(data);
    });

    it('should handle raw unencrypted JSON array data', () => {
      const key = 'test_key';
      const data = [1, 2, 3];
      localStorage.setItem(key, JSON.stringify(data));

      const result = getSecureStorage(key);
      expect(result).toEqual(data);

      // It should also re-encrypt the data
      const storedItem = localStorage.getItem(key);
      expect(storedItem).not.toBe(JSON.stringify(data));
      expect(decryptData(storedItem!)).toEqual(data);
    });

    it('should handle raw unencrypted JSON object data', () => {
      const key = 'test_key';
      const data = { old: 'data' };
      localStorage.setItem(key, JSON.stringify(data));

      const result = getSecureStorage(key);
      expect(result).toEqual(data);

      // It should also re-encrypt the data
      const storedItem = localStorage.getItem(key);
      expect(storedItem).not.toBe(JSON.stringify(data));
      expect(decryptData(storedItem!)).toEqual(data);
    });
  });
});
