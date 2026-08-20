import CryptoJS from 'crypto-js';

// We use an environment variable for the encryption key, 
// or fallback to a hardcoded key only if not present (not recommended for production).
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default_secure_fallback_key_2026';

export const encryptData = (data: any): string => {
  try {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Encryption error:", error);
    return "";
  }
};

export const decryptData = (cipherText: string | null, fallbackValue: any = null): any => {
  if (!cipherText) return fallbackValue;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) return fallbackValue; // Decryption failed or empty
    return JSON.parse(decryptedString);
  } catch (error) {
    console.warn("Decryption error (might be unencrypted old data or wrong key). Falling back.", error);
    try {
      // Fallback for unencrypted legacy data during migration
      return JSON.parse(cipherText);
    } catch {
      return fallbackValue;
    }
  }
};

export const setSecureStorage = (key: string, data: any, silent = false) => {
  const encrypted = encryptData(data);
  localStorage.setItem(key, encrypted);
  if (!silent && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('local_db_write', { detail: { key, data } }));
  }
};

export const getSecureStorage = (key: string, fallbackValue: any = null): any => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallbackValue;
  
  // Try to parse it directly in case it's unencrypted legacy JSON data
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
       const parsed = JSON.parse(raw);
       // Optional: automatically encrypt old data to migrate it
       setSecureStorage(key, parsed);
       return parsed;
    } catch {
       // Ignore, it's probably encrypted
    }
  }

  return decryptData(raw, fallbackValue);
};
