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
  drug_license_no?: string;
  industry_modules?: {
    electronics_imei?: boolean;
    pharma_batch_expiry?: boolean;
    hardware_decimals?: boolean;
    services_recurring?: boolean;
  };
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
  default_notes: '',
  drug_license_no: '',
  industry_modules: {
    electronics_imei: false,
    pharma_batch_expiry: false,
    hardware_decimals: false,
    services_recurring: false
  }
};

/**
 * Intelligent merge with support for explicit clearing when requested.
 * When allowOverwriteEmpty is false, prevents accidental wipe of existing non-empty values.
 * When allowOverwriteEmpty is true, accepts incoming clean/cleared values.
 */
export function mergeProfileData(current: any, incoming: any, allowOverwriteEmpty: boolean = false): UserProfileData {
  const base = { ...DEFAULT_PROFILE_DATA };
  const currentObj = (current && typeof current === 'object') ? current : {};
  const incomingObj = (incoming && typeof incoming === 'object') ? incoming : {};

  const merged: any = { ...base, ...currentObj };

  for (const [key, value] of Object.entries(incomingObj)) {
    // Skip undefined or null values
    if (value === undefined || value === null) {
      continue;
    }

    // For string fields
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!allowOverwriteEmpty && trimmed === '') {
        const existingVal = merged[key];
        if (typeof existingVal === 'string' && existingVal.trim() !== '') {
          // Retain existing populated string only when not allowing explicit overwrite
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

// Immediately purge any stale global profile key from localStorage on module load
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(GLOBAL_LAST_KNOWN_PROFILE_KEY);
  } catch (e) {}
}

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
 * Sanitizes user profile to guarantee that non-admin accounts never inherit admin privileges,
 * owner roles, or Noman Shaikh's personal contact / business details.
 */
export function sanitizeUserProfile(profile: any, userEmail?: string | null, userDisplayName?: string | null): UserProfileData {
  if (!profile || typeof profile !== 'object') return { ...DEFAULT_PROFILE_DATA };
  const email = (userEmail || profile.email || '').toLowerCase().trim();
  const isOwner = email === 'nomanshaikh1999@gmail.com';

  const clean = { ...DEFAULT_PROFILE_DATA, ...profile };

  if (!isOwner) {
    clean.is_admin = false;
    clean.role = 'user';

    const rawOwner = String(clean.owner_name || '').toLowerCase();
    const rawBusiness = String(clean.business_name || '').toLowerCase().trim();
    const rawPhone = String(clean.phone || '').trim();
    const rawAddress = String(clean.address || '').toLowerCase();
    const rawUpi = String(clean.upi_id || '').toLowerCase();

    // Detect if infected with Noman's profile data
    if (
      rawOwner.includes('noman') ||
      rawOwner.includes('shekh') ||
      rawBusiness.includes('graphic designer') ||
      rawBusiness.includes('noman') ||
      rawBusiness.includes('invocentric main') ||
      rawPhone.includes('9824194869') ||
      rawAddress.includes('patan') ||
      rawUpi.includes('shekhnoman') ||
      rawUpi.includes('noman')
    ) {
      const emailUsername = email ? email.split('@')[0] : '';
      const fallbackName = userDisplayName || (emailUsername ? emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1) : '');
      clean.owner_name = fallbackName;
      clean.display_name = fallbackName;
      clean.business_name = '';
      clean.phone = '';
      clean.address = '';
      clean.city = '';
      clean.state = '';
      clean.pincode = '';
      clean.gstin = '';
      clean.pan = '';
      clean.upi_id = '';
      clean.bank_name = '';
      clean.bank_branch = '';
      clean.account_number = '';
      clean.ifsc_code = '';
      clean.account_holder = '';
      clean.logo_url = '';
      clean.signature_url = '';
    }
  }

  return clean;
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

    const fullProfile = { ...DEFAULT_PROFILE_DATA, ...profile, id: userId };
    return sanitizeUserProfile(fullProfile, fullProfile.email);
  }

  // Pure guest / unauthenticated mode returns clean defaults
  return { ...DEFAULT_PROFILE_DATA };
}

/**
 * Persists the user profile across isolated storage layers for this user ID.
 * 1. user_profile_${userId} (both secure & raw localStorage)
 * 2. user_profile_permanent_backup_${userId}
 */
export function saveStoredUserProfile(userId: string | null | undefined, data: any, userEmail?: string | null): UserProfileData {
  if (typeof window === 'undefined') return data;

  const existing = getStoredUserProfile(userId);
  let toSave = mergeProfileData(existing, data, true);
  const isRealUser = Boolean(userId && userId !== 'guest' && userId !== 'offline_guest');

  if (isRealUser && userId) {
    toSave.id = userId;
    const effectiveEmail = userEmail || toSave.email;
    toSave = sanitizeUserProfile(toSave, effectiveEmail);
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
  }

  // Broadcast update event so all listening components update immediately
  try {
    window.dispatchEvent(new CustomEvent('invocentric_profile_updated', { detail: toSave }));
    window.dispatchEvent(new StorageEvent('storage', { 
      key: userId ? `user_profile_${userId}` : 'user_profile_guest', 
      newValue: serialized 
    }));
  } catch (e) {}

  return toSave;
}
/**
 * Extracts essential business and banking profile fields that MUST ALWAYS
 * be preserved and synced to the cloud. Zero risk of exceeding Firestore limits.
 */
export function getEssentialProfilePayload(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  const essentialKeys = [
    'id', 'user_id', 'email', 'business_name', 'owner_name', 'display_name',
    'phone', 'address', 'city', 'state', 'pincode', 'gstin', 'pan',
    'upi_id', 'bank_name', 'bank_branch', 'account_number', 'ifsc_code', 'account_holder',
    'invoice_prefix', 'currency', 'default_terms', 'default_notes',
    'drug_license_no', 'app_mode', 'wizard_completed', 'industry_modules',
    'updated_at'
  ];
  const payload: Record<string, any> = {};
  for (const k of essentialKeys) {
    if (data[k] !== undefined && data[k] !== null) {
      payload[k] = data[k];
    }
  }
  return payload;
}

/**
 * Strips undefined values, functions, and dangerous payloads
 * to prevent Firestore setDoc/updateDoc from crashing.
 * Guaranteed to prioritize essential business & banking details so they never drop.
 */
export function sanitizeFirestorePayload(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  const sanitized: Record<string, any> = {};

  // First pass: copy non-string or small values, prioritizing essential text
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (typeof value === 'function') continue;

    // Safety check for massive base64 payloads: if string is > 400KB, skip or protect
    // to prevent crashing Firestore's 1MB hard document limit
    if (typeof value === 'string' && value.length > 400000) {
      console.warn(`Field ${key} exceeds 400KB, skipping from cloud sync to protect Firestore document size.`);
      continue;
    }

    sanitized[key] = value;
  }

  // Safety check on total payload size
  try {
    const totalSize = JSON.stringify(sanitized).length;
    if (totalSize > 850000) {
      // If still close to 1MB, drop large optional image strings while preserving essential text
      const heavyImageKeys = ['logo_url', 'signature_url', 'social_qr_url', 'profile_photo_url', 'letterhead_url'];
      for (const imgKey of heavyImageKeys) {
        if (sanitized[imgKey] && typeof sanitized[imgKey] === 'string' && sanitized[imgKey].length > 50000) {
          delete sanitized[imgKey];
        }
      }
    }
  } catch (_) {}

  return sanitized;
}
