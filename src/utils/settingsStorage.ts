import { getSecureStorage, setSecureStorage } from './cryptoUtils';

export interface UserProfileData {
  business_name?: string;
  owner_name?: string;
  display_name?: string;
  currency?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  upi_id?: string;
  bank_name?: string;
  bank_branch?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder?: string;
  invoice_prefix?: string;
  logo_url?: string;
  backup_enabled?: boolean;
  email_reminders_enabled?: boolean;
  instagram?: string;
  facebook?: string;
  website?: string;
  social_qr_url?: string;
  social_qr_label?: string;
  invoice_template?: string;
  signature_url?: string;
  letterhead_enabled?: boolean;
  letterhead_url?: string;
  letterhead_top_margin?: number;
  letterhead_bottom_margin?: number;
  letterhead_hide_header?: boolean;
  default_terms?: string;
  default_notes?: string;
  wizard_completed?: boolean;
  app_mode?: 'shop' | 'freelancer';
  [key: string]: any;
}

export const DEFAULT_PROFILE_DATA: UserProfileData = {
  business_name: '',
  owner_name: '',
  currency: 'INR',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  pan: '',
  upi_id: '',
  bank_name: '',
  bank_branch: '',
  account_number: '',
  ifsc_code: '',
  account_holder: '',
  invoice_prefix: 'INV',
  logo_url: '',
  backup_enabled: false,
  email_reminders_enabled: true,
  instagram: '',
  facebook: '',
  website: '',
  social_qr_url: '',
  social_qr_label: '@business_handle',
  invoice_template: 'template_01',
  signature_url: '',
  letterhead_enabled: false,
  letterhead_url: '',
  letterhead_top_margin: 45,
  letterhead_bottom_margin: 20,
  letterhead_hide_header: true,
  default_terms: '',
  default_notes: ''
};

/**
 * Intelligent non-destructive merge:
 * NEVER allows missing, undefined, or empty values from an incoming object
 * to overwrite existing populated values in the target object.
 */
export function mergeProfileData(current: any, incoming: any): UserProfileData {
  const base = { ...DEFAULT_PROFILE_DATA };
  const currentObj = (current && typeof current === 'object') ? current : {};
  const incomingObj = (incoming && typeof incoming === 'object') ? incoming : {};

  const merged: any = { ...base, ...currentObj };

  for (const [key, value] of Object.entries(incomingObj)) {
    // Skip undefined or null values
    if (value === undefined || value === null) {
      continue;
    }

    // For string fields, do NOT overwrite an existing non-empty value with an empty string
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        const existingVal = merged[key];
        if (typeof existingVal === 'string' && existingVal.trim() !== '') {
          // Retain existing populated string
          continue;
        }
      }
      merged[key] = value;
      continue;
    }

    // For boolean or numbers or objects, accept incoming if valid
    merged[key] = value;
  }

  return merged;
}

const GLOBAL_LAST_KNOWN_PROFILE_KEY = 'invocentric_last_known_business_profile';

/**
 * Retrieves the user profile from multiple redundant local storage layers.
 * Checks primary secure storage -> unencrypted raw backup -> permanent backup -> global browser backup.
 */
export function getStoredUserProfile(userId?: string | null): UserProfileData {
  let profile: any = {};

  if (typeof window === 'undefined') {
    return { ...DEFAULT_PROFILE_DATA };
  }

  // 1. Layer 1: Universal global last known profile
  try {
    const globalRaw = localStorage.getItem(GLOBAL_LAST_KNOWN_PROFILE_KEY);
    if (globalRaw) {
      const parsed = JSON.parse(globalRaw);
      if (parsed && typeof parsed === 'object') {
        profile = mergeProfileData(profile, parsed);
      }
    }
  } catch (e) {
    // ignore parse error
  }

  if (userId) {
    // 2. Layer 2: Permanent backup key for this specific user ID
    try {
      const permanentRaw = localStorage.getItem(`user_profile_permanent_backup_${userId}`);
      if (permanentRaw) {
        const parsed = JSON.parse(permanentRaw);
        if (parsed && typeof parsed === 'object') {
          profile = mergeProfileData(profile, parsed);
        }
      }
    } catch (e) {}

    // 3. Layer 3: Unencrypted raw cache for this user ID
    try {
      const rawCache = localStorage.getItem(`user_profile_${userId}`);
      if (rawCache && (rawCache.startsWith('{') || rawCache.startsWith('['))) {
        const parsed = JSON.parse(rawCache);
        if (parsed && typeof parsed === 'object') {
          profile = mergeProfileData(profile, parsed);
        }
      }
    } catch (e) {}

    // 4. Layer 4: Encrypted secure storage
    try {
      const secureCache = getSecureStorage(`user_profile_${userId}`, null);
      if (secureCache && typeof secureCache === 'object') {
        profile = mergeProfileData(profile, secureCache);
      }
    } catch (e) {}
  }

  return { ...DEFAULT_PROFILE_DATA, ...profile };
}

/**
 * Persists the user profile across all redundant local storage layers.
 * 1. user_profile_${userId} (both secure & raw localStorage)
 * 2. user_profile_permanent_backup_${userId}
 * 3. invocentric_last_known_business_profile (global cross-session backup)
 */
export function saveStoredUserProfile(userId: string | null | undefined, data: any): UserProfileData {
  if (typeof window === 'undefined') return data;

  const existing = getStoredUserProfile(userId);
  const toSave = mergeProfileData(existing, data);

  const serialized = JSON.stringify(toSave);

  // 1. Global browser layer
  try {
    localStorage.setItem(GLOBAL_LAST_KNOWN_PROFILE_KEY, serialized);
  } catch (e) {
    console.warn("Failed saving global profile backup:", e);
  }

  if (userId) {
    // 2. Permanent user backup layer
    try {
      localStorage.setItem(`user_profile_permanent_backup_${userId}`, serialized);
    } catch (e) {}

    // 3. Raw localStorage cache (for instant sync across tabs)
    try {
      localStorage.setItem(`user_profile_${userId}`, serialized);
    } catch (e) {}

    // 4. Encrypted secure storage
    try {
      setSecureStorage(`user_profile_${userId}`, toSave, true);
    } catch (e) {}
  }

  // 5. Broadcast update event so all listening components update immediately
  try {
    window.dispatchEvent(new CustomEvent('invocentric_profile_updated', { detail: toSave }));
    window.dispatchEvent(new StorageEvent('storage', { 
      key: userId ? `user_profile_${userId}` : GLOBAL_LAST_KNOWN_PROFILE_KEY, 
      newValue: serialized 
    }));
  } catch (e) {}

  return toSave;
}

/**
 * Strips undefined values, functions, and dangerous payloads
 * to prevent Firestore setDoc/updateDoc from crashing.
 */
export function sanitizeFirestorePayload(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // Firestore throws on undefined
    if (value === undefined) continue;
    if (typeof value === 'function') continue;

    // Safety check for massive base64 payloads: if string is > 750KB, truncate or skip
    // to prevent crashing Firestore's 1MB hard document limit
    if (typeof value === 'string' && value.length > 800000) {
      console.warn(`Field ${key} exceeds 800KB, skipping from cloud sync to protect Firestore document size.`);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}
