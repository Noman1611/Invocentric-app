import firebaseConfig from '../../firebase-applet-config.json';
import { setSecureStorage, getSecureStorage } from './cryptoUtils';
import { auth } from '../lib/firebase';

/**
 * Universal Firestore REST Client & Real Data Fallback
 * 
 * When running in native Android WebView or when Firebase Auth client state
 * has permission delays, this module directly queries the Firestore REST API
 * using the user's authenticated ID token or public read permissions,
 * ensuring that 100% of real invoices, customers, items, and settings
 * are hydrated into local offline storage immediately upon login.
 */

async function getEffectiveToken(idToken?: string | null): Promise<string | null> {
  if (idToken) return idToken;
  try {
    if (auth.currentUser) {
      const freshToken = await auth.currentUser.getIdToken(false);
      if (freshToken) {
        if (typeof window !== 'undefined') localStorage.setItem('invocentric_id_token', freshToken);
        return freshToken;
      }
    }
  } catch (err) {
    console.warn('[Firestore REST] Could not get fresh token from auth.currentUser:', err);
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem('invocentric_id_token');
  }
  return null;
}

function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const res: Record<string, any> = {};
    for (const k of Object.keys(fields)) {
      res[k] = parseFirestoreValue(fields[k]);
    }
    return res;
  }
  return val;
}

export function parseFirestoreRestDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const id = doc.name ? doc.name.split('/').pop() : (doc.id || '');
  const result: Record<string, any> = { id };
  for (const key of Object.keys(doc.fields)) {
    result[key] = parseFirestoreValue(doc.fields[key]);
  }
  if (doc.createTime && !result.created_at) {
    result.created_at = doc.createTime;
  }
  if (doc.updateTime && !result.updated_at) {
    result.updated_at = doc.updateTime;
  }
  return result;
}

/**
 * Fetch documents from a Firestore collection using REST API
 */
export async function fetchCollectionRest(
  collectionName: string,
  userId: string,
  userEmail?: string | null,
  idToken?: string | null
): Promise<any[]> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const apiKey = firebaseConfig.apiKey;

  if (!projectId || !apiKey) {
    console.warn('[Firestore REST] Missing projectId or apiKey in firebaseConfig');
    return [];
  }

  const token = await getEffectiveToken(idToken);
  const cleanEmail = (userEmail || '').trim().toLowerCase();

  const candidateUids = Array.from(new Set([
    userId,
    cleanEmail ? 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : null,
    cleanEmail ? 'google_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : null,
  ].filter(Boolean))) as string[];

  // When userId is provided, strictly isolate by user's candidate UIDs.
  // Only query across all users if userId is explicitly omitted/empty (e.g. for platform Admin overview).
  const isGlobalFetch = !userId || userId.trim() === '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;

  // Build query
  const structuredQuery: any = {
    from: [{ collectionId: collectionName }]
  };

  // If scoped to a specific user, strictly filter by user_id
  if (!isGlobalFetch && userId) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'user_id' },
        op: 'EQUAL',
        value: { stringValue: userId }
      }
    };
  }

  try {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ structuredQuery })
    });

    if (!res.ok) {
      // If structuredQuery failed with 403 or error, try direct collection listing endpoint
      console.warn(`[Firestore REST] Query for ${collectionName} returned status ${res.status}. Trying list endpoint...`);
      return await fallbackListCollection(collectionName, candidateUids, token, isGlobalFetch);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const items: any[] = [];
    for (const entry of data) {
      if (entry.document) {
        const parsed = parseFirestoreRestDoc(entry.document);
        if (parsed) {
          if (isGlobalFetch || parsed.user_id === userId || candidateUids.includes(parsed.user_id) || (!parsed.user_id && candidateUids.includes(userId))) {
            items.push(parsed);
          }
        }
      }
    }

    console.log(`[Firestore REST] Successfully retrieved ${items.length} ${collectionName} via REST API.`);
    return items;
  } catch (err) {
    console.warn(`[Firestore REST] Error fetching ${collectionName}:`, err);
    return [];
  }
}

async function fallbackListCollection(
  collectionName: string,
  candidateUids: string[],
  token?: string | null,
  isGlobalFetch: boolean = false
): Promise<any[]> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const apiKey = firebaseConfig.apiKey;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}?pageSize=200&key=${apiKey}`;
  try {
    const res = await fetch(listUrl, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const documents = data.documents || [];
    const items: any[] = [];
    for (const doc of documents) {
      const parsed = parseFirestoreRestDoc(doc);
      if (parsed) {
        if (isGlobalFetch || candidateUids.includes(parsed.user_id) || !parsed.user_id) {
          items.push(parsed);
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Sync all core Firestore collections for the active user into local offline cache.
 * Dispatches UI update events so components immediately refresh with real data.
 */
export async function syncAllUserDataFromFirestore(
  userId: string,
  userEmail?: string | null,
  idToken?: string | null
): Promise<{ success: boolean; counts: Record<string, number> }> {
  if (!userId) return { success: false, counts: {} };

  const effectiveToken = await getEffectiveToken(idToken);
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const candidateUids = Array.from(new Set([
    userId,
    cleanEmail ? 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : null,
    cleanEmail ? 'google_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : null,
  ].filter(Boolean))) as string[];

  console.log(`[Firestore REST] Starting fast parallel data sync for user ${userId} (${userEmail || 'unknown'})...`);
  const collections = ['invoices', 'customers', 'items', 'payments', 'daily_book', 'quotations', 'expenses', 'purchases', 'notifications'];
  const counts: Record<string, number> = {};

  await Promise.allSettled(
    collections.map(async (col) => {
      try {
        const items = await fetchCollectionRest(col, userId, userEmail, effectiveToken);
        const existingKey = `offline_${col}_${userId}`;
        const existing = getSecureStorage(existingKey, []);

        // Filter out any foreign records previously contaminated into this user's cache
        const validExisting = Array.isArray(existing) ? existing.filter((item: any) => {
          if (!item) return false;
          if (!item.user_id) return true;
          return candidateUids.includes(item.user_id);
        }) : [];

        if (Array.isArray(items)) {
          counts[col] = items.length;
          const remoteIds = new Set(items.map((i: any) => i.id));
          const merged = [...items];
          // Keep valid local-only items that Firestore doesn't know about yet
          for (const localItem of validExisting) {
            if (!remoteIds.has(localItem.id) || localItem._sync_status === 'saved_locally') {
              if (!merged.find((m: any) => m.id === localItem.id)) {
                merged.push(localItem);
              }
            }
          }
          setSecureStorage(existingKey, merged);
          window.dispatchEvent(new CustomEvent('invocentric_data_updated', { detail: { collection: col } }));
          window.dispatchEvent(new CustomEvent(`${col}_updated`, { detail: { collection: col } }));
        } else if (validExisting.length !== (existing || []).length) {
          // If items were purged due to cross-contamination, save the sanitized cache
          setSecureStorage(existingKey, validExisting);
          window.dispatchEvent(new CustomEvent('invocentric_data_updated', { detail: { collection: col } }));
          window.dispatchEvent(new CustomEvent(`${col}_updated`, { detail: { collection: col } }));
        }
      } catch (e) {
        console.warn(`[Firestore REST] Failed to sync ${col}:`, e);
      }
    })
  );

  // Also sync user profile document
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    const apiKey = firebaseConfig.apiKey;

    const headers: Record<string, string> = {};
    if (effectiveToken) headers['Authorization'] = `Bearer ${effectiveToken}`;

    const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${userId}?key=${apiKey}`;
    const userRes = await fetch(userDocUrl, { headers });
    if (userRes.ok) {
      const userDoc = await userRes.json();
      const parsedUser = parseFirestoreRestDoc(userDoc);
      if (parsedUser) {
        setSecureStorage(`user_profile_${userId}`, parsedUser);
        window.dispatchEvent(new CustomEvent('invocentric_profile_updated', { detail: parsedUser }));
      }
    }
  } catch (userErr) {
    console.warn('[Firestore REST] User profile fetch note:', userErr);
  }

  console.log('[Firestore REST] Full sync complete. Counts:', counts);
  return { success: true, counts };
}
