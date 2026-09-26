import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly enforce permanent local persistence (IndexedDB + localStorage).
// This guarantees that the user stays logged in across app restarts, browser closes, APK restarts, and PWA sessions.
if (typeof window !== 'undefined') {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    return setPersistence(auth, browserLocalPersistence);
  }).catch((err) => {
    console.warn("Failed to set auth persistence:", err);
  });
}

// Initialize Firestore with multi-tab persistent offline cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

// Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = 
    errMessage.toLowerCase().includes('quota') || 
    errMessage.toLowerCase().includes('resource-exhausted') || 
    errMessage.toLowerCase().includes('resource_exhausted');

  if (isQuotaError) {
    try {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      localStorage.setItem('firestore_quota_exceeded_timestamp', String(Date.now()));
      // Auto-toggle to offline mode to keep app fully functional
      localStorage.setItem('is_offline_mode', 'true');
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', { detail: { error: errMessage } }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'is_offline_mode', newValue: 'true' }));
    } catch (e) {
      console.warn("Storage write failed in error handler:", e);
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;
