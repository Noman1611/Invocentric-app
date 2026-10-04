import firebaseConfig from '../../firebase-applet-config.json';
import { setSecureStorage, getSecureStorage } from './cryptoUtils';

/**
 * Universal Firestore REST Client & Real Data Fallback
 * 
 * When running in native Android WebView or when Firebase Auth client state
 * has permission delays, this module directly queries the Firestore REST API
 * using the user's authenticated ID token or public read permissions,
 * ensuring that 100% of real invoices, customers, items, and settings
 * are hydrated into local offline storage immediately upon login.
 */

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

  const token = idToken || (typeof window !== 'undefined' ? localStorage.getItem('invocentric_id_token') : null);
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const isAdmin = cleanEmail === 'nomanshaikh1999@gmail.com';

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

  // If not admin, filter by user_id
  if (!isAdmin && userId) {
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
      return await fallbackListCollection(collectionName, userId, token, isAdmin);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const items: any[] = [];
    for (const entry of data) {
      if (entry.document) {
        const parsed = parseFirestoreRestDoc(entry.document);
        if (parsed) {
          // Double-check user_id filter if not admin
          if (isAdmin || parsed.user_id === userId || !parsed.user_id) {
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
  userId: string,
  token?: string | null,
  isAdmin: boolean = false
): Promise<any[]> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const apiKey = firebaseConfig.apiKey;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}?pageSize=100&key=${apiKey}`;
  try {
    const res = await fetch(listUrl, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const documents = data.documents || [];
    const items: any[] = [];
    for (const doc of documents) {
      const parsed = parseFirestoreRestDoc(doc);
      if (parsed) {
        if (isAdmin || parsed.user_id === userId) {
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

  console.log(`[Firestore REST] Starting full real data sync for user ${userId} (${userEmail || 'unknown'})...`);
  const collections = ['invoices', 'customers', 'items', 'daily_book', 'quotations', 'expenses', 'purchases'];
  const counts: Record<string, number> = {};

  for (const col of collections) {
    try {
      const items = await fetchCollectionRest(col, userId, userEmail, idToken);
      if (Array.isArray(items) && items.length > 0) {
        counts[col] = items.length;
        setSecureStorage(`offline_${col}_${userId}`, items);
        window.dispatchEvent(new CustomEvent('invocentric_data_updated', { detail: { collection: col } }));
        window.dispatchEvent(new CustomEvent(`${col}_updated`, { detail: { collection: col } }));
      }
    } catch (e) {
      console.warn(`[Firestore REST] Failed to sync ${col}:`, e);
    }
  }

  // Also sync user profile document
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    const apiKey = firebaseConfig.apiKey;
    const token = idToken || (typeof window !== 'undefined' ? localStorage.getItem('invocentric_id_token') : null);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

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
