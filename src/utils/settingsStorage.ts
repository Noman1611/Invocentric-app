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
 * Purges global temporary profile cache to ensure clean isolation between account switches.
 */
export function clearGlobalProfileBackup(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GLOBAL_LAST_KNOWN_PROFILE_KEY);
  } catch (e) {}
}

/**
 * Retrieves the user profile from local storage layers strictly isolated by userId.
 * Checks primary secure storage -> unencrypted raw backup -> permanent backup.
 * Cross-account profile sharing is strictly blocked.
 */
export function getStoredUserProfile(userId?: string | null): UserProfileData {
  let profile: any = {};

  if (typeof window === 'undefined') {
    return { ...DEFAULT_PROFILE_DATA };
  }

  const isRealUser = Boolean(userId && userId !== 'guest' && userId !== 'offline_guest');

  if (isRealUser && userId) {
    // 1. Layer 1: Encrypted secure storage for this specific user ID
    try {
      const secureCache = getSecureStorage(`user_profile_${userId}`, null);
      if (secureCache && typeof secureCache === 'object') {
        profile = mergeProfileData(profile, secureCache);
      }
    } catch (e) {}

    // 2. Layer 2: Raw cache for this specific user ID
    try {
      const rawCache = localStorage.getItem(`user_profile_${userId}`);
      if (rawCache && (rawCache.startsWith('{') || rawCache.startsWith('['))) {
        const parsed = JSON.parse(rawCache);
        if (parsed && typeof parsed === 'object') {
          profile = mergeProfileData(profile, parsed);
        }
      }
    } catch (e) {}

    // 3. Layer 3: Permanent backup for this specific user ID
    try {
      const permanentRaw = localStorage.getItem(`user_profile_permanent_backup_${userId}`);
      if (permanentRaw) {
        const parsed = JSON.parse(permanentRaw);
        if (parsed && typeof parsed === 'object') {
          profile = mergeProfileData(profile, parsed);
        }
      }
    } catch (e) {}

    // Return strictly user-scoped profile (never fall back to previous user's global profile)
    return { ...DEFAULT_PROFILE_DATA, ...profile, id: userId };
  }

  // Only for guest / unauthenticated mode:
  try {
    const globalRaw = localStorage.getItem(GLOBAL_LAST_KNOWN_PROFILE_KEY);
    if (globalRaw) {
      const parsed = JSON.parse(globalRaw);
      if (parsed && typeof parsed === 'object') {
        // Strip any accidental admin or sensitive privileges from guest cache
        delete parsed.is_admin;
        delete parsed.role;
        profile = mergeProfileData(profile, parsed);
      }
    }
  } catch (e) {}

  return { ...DEFAULT_PROFILE_DATA, ...profile };
}

/**
 * Persists the user profile across isolated storage layers for this user ID.
 * 1. user_profile_${userId} (both secure & raw localStorage)
 * 2. user_profile_permanent_backup_${userId}
 */
export function saveStoredUserProfile(userId: string | null | undefined, data: any): UserProfileData {
  if (typeof window === 'undefined') return data;

  const existing = getStoredUserProfile(userId);
  const toSave = mergeProfileData(existing, data);
  const isRealUser = Boolean(userId && userId !== 'guest' && userId !== 'offline_guest');

  if (isRealUser && userId) {
    toSave.id = userId;
  }

  const serialized = JSON.stringify(toSave);

  if (isRealUser && userId) {
    // 1. Permanent user backup layer
    try {
      localStorage.setItem(`user_profile_permanent_backup_${userId}`, serialized);
    } catch (e) {}

    // 2. Raw localStorage cache (for instant sync across tabs)
    try {
      localStorage.setItem(`user_profile_${userId}`, serialized);
    } catch (e) {}

    // 3. Encrypted secure storage
    try {
      setSecureStorage(`user_profile_${userId}`, toSave, true);
    } catch (e) {}
  } else {
    // Guest-only backup layer
    try {
      localStorage.setItem(GLOBAL_LAST_KNOWN_PROFILE_KEY, serialized);
    } catch (e) {}
  }

  // Broadcast update event so all listening components update immediately
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
