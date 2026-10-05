import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile, sanitizeFirestorePayload } from '../utils/settingsStorage';
import { syncAllUserDataFromFirestore, fetchCollectionRest } from '../utils/firestoreRestFallback';
import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function getCandidateUids(user: { uid: string; email?: string | null }): string[] {
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const uids = new Set<string>();
  if (user.uid) uids.add(user.uid);
  if (cleanEmail) {
    uids.add('user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
    uids.add('google_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
  }
  return Array.from(uids);
}

function mergeOfflineQueue(data: any[], collectionName: string, userId: string) {
  const upserts = getSecureStorage(`offline_upserts_${userId}`, []);
  const collectionUpserts = upserts.filter((u: any) => u.collection === collectionName).map((u: any) => u.item);
  
  const mergedData = [...data];
  collectionUpserts.forEach((upsertItem: any) => {
     const index = mergedData.findIndex(d => d.id === upsertItem.id);
     if (index >= 0) {
        mergedData[index] = upsertItem;
     } else {
        mergedData.unshift(upsertItem);
     }
  });
  
  const deletions = getSecureStorage(`offline_deletions_${userId}`, []);
  const collectionDeletions = deletions.filter((d: any) => d.collection === collectionName);
  
  return mergedData.filter(d => {
    if (!d) return false;
    if (collectionDeletions.some((del: any) => (typeof del === 'string' ? del : del.id) === d.id)) return false;
    if (collectionName === 'recycle_bin') {
      const knownPrefixRegex = /^(invoices|customers|items|payments|expenses|purchases|quotations)_/;
      const matchD = (d.id || '').match(knownPrefixRegex);
      const prefixD = matchD ? matchD[1] : null;
      const cleanId = matchD ? (d.id || '').slice(matchD[0].length) : (d.id || '');
      const colD = d.original_collection || d._original_collection || prefixD;

      if (collectionDeletions.some((del: any) => {
        const delId = typeof del === 'string' ? del : del.id;
        if (!delId) return false;
        if (delId === d.id) return true;
        const matchDel = delId.match(knownPrefixRegex);
        const prefixDel = matchDel ? matchDel[1] : null;
        const cleanDelId = matchDel ? delId.slice(matchDel[0].length) : delId;
        const colDel = (typeof del === 'object' && del.original_collection) ? del.original_collection : prefixDel;

        // Prevent aliases from matching or deleting records from another collection
        if (colDel && colD && colDel !== colD) return false;

        if (cleanDelId === cleanId) {
          if (colDel && colD && colDel !== colD) return false;
          if (!colDel && !colD) return true;
          return colDel === colD;
        }
        if (d.original_id && (delId === d.original_id || cleanDelId === d.original_id)) {
          if (colDel && colD && colDel !== colD) return false;
          return true;
        }
        if (d._original_id && (delId === d._original_id || cleanDelId === d._original_id)) {
          if (colDel && colD && colDel !== colD) return false;
          return true;
        }
        return false;
      })) {
        return false;
      }
    }
    return true;
  });
}

function getResilientLocalData(colName: string, userId: string, userEmail?: string | null): any[] {
  const currentKey = `offline_${colName}_${userId}`;
  const currentData = getSecureStorage(currentKey, []);
  if (Array.isArray(currentData) && currentData.length > 0) {
    return currentData;
  }

  if (typeof window === 'undefined' || !userEmail) return [];
  const cleanEmail = userEmail.trim().toLowerCase();

  // Search localStorage for any legacy collection key belonging to this email
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`offline_${colName}_`)) {
      const otherUid = key.replace(`offline_${colName}_`, '');
      if (otherUid && otherUid !== userId) {
        const otherProfile = getSecureStorage(`user_profile_${otherUid}`, null);
        const emailMatches = otherProfile && (otherProfile.email || '').toLowerCase() === cleanEmail;
        const patternMatches = otherUid.includes(cleanEmail.split('@')[0]) || otherUid.startsWith('google_') || otherUid.startsWith('user_');

        if (emailMatches || patternMatches) {
          const legacyList = getSecureStorage(key, []);
          if (Array.isArray(legacyList) && legacyList.length > 0) {
            const remapped = legacyList.map((item: any) => ({ ...item, user_id: userId }));
            setSecureStorage(currentKey, remapped);
            console.log(`[useData] Instantly recovered ${remapped.length} ${colName} from ${key} for user ${userId}`);
            return remapped;
          }
        }
      }
    }
  }

  return [];
}

export function useInvoices() {
  const { user, isOfflineMode } = useAuth();
  const [invoices, setInvoices] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getResilientLocalData("invoices", user.uid, user.email);
      return mergeOfflineQueue(cached, "invoices", user.uid);
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cached = getResilientLocalData("invoices", user.uid, user.email);
      return cached === null;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const localInvoices = getResilientLocalData("invoices", user.uid, user.email);
      const finalData = mergeOfflineQueue(localInvoices, "invoices", user.uid);
      const uniqueLocal = finalData.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); 
      setInvoices(uniqueLocal);
      setLoading(false);
      if (uniqueLocal.length === 0) {
        syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
      }
    };

    const handleLocalEvent = () => loadLocal();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `offline_invoices_${user.uid}`) {
        loadLocal();
      }
    };

    window.addEventListener('invoices_updated', handleLocalEvent);
    window.addEventListener('invocentric_data_updated', handleLocalEvent);
    window.addEventListener('storage', handleStorageChange);

    if (isOfflineMode) {
      loadLocal();
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('invoices_updated', handleLocalEvent);
        window.removeEventListener('invocentric_data_updated', handleLocalEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'invoices'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'invoices'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.due_date?.toDate) d.due_date = d.due_date.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        if (d.last_reminded_at?.toDate) d.last_reminded_at = d.last_reminded_at.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a, b) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime());
      const finalData = mergeOfflineQueue(data, "invoices", user.uid); 
      setInvoices(finalData);
      setSecureStorage(`offline_invoices_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      } catch (err) {
        console.error("Error fetching invoices (handled):", err);
      }
      loadLocal();
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('invoices_updated', handleLocalEvent);
      window.removeEventListener('invocentric_data_updated', handleLocalEvent);
    };
  }, [user, isOfflineMode]);

  return { invoices, loading };
}

export function useCustomers() {
  const { user, isOfflineMode } = useAuth();
  const [customers, setCustomers] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getResilientLocalData("customers", user.uid, user.email);
      const merged = mergeOfflineQueue(cached, "customers", user.uid);
      return merged.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cached = getResilientLocalData("customers", user.uid, user.email);
      return cached === null;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const local = getResilientLocalData("customers", user.uid, user.email);
      const finalData = mergeOfflineQueue(local, "customers", user.uid);
      const uniqueLocal = finalData.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); 
      setCustomers(uniqueLocal.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
      if (uniqueLocal.length === 0) {
        syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
      }
    };

    const handleLocalEvent = () => loadLocal();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `offline_customers_${user.uid}`) loadLocal();
    };

    window.addEventListener('customers_updated', handleLocalEvent);
    window.addEventListener('invocentric_data_updated', handleLocalEvent);
    window.addEventListener('storage', handleStorage);

    if (isOfflineMode) {
      loadLocal();
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('customers_updated', handleLocalEvent);
        window.removeEventListener('invocentric_data_updated', handleLocalEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'customers'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'customers'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const finalData = mergeOfflineQueue(data, "customers", user.uid); 
      setCustomers(finalData);
      setSecureStorage(`offline_customers_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      } catch (err) {
        console.error("Error fetching customers (handled):", err);
      }
      loadLocal();
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('customers_updated', handleLocalEvent);
      window.removeEventListener('invocentric_data_updated', handleLocalEvent);
    };
  }, [user, isOfflineMode]);

  return { customers, loading };
}

export function useItems() {
  const { user, isOfflineMode } = useAuth();
  const [items, setItems] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getResilientLocalData("items", user.uid, user.email);
      const merged = mergeOfflineQueue(cached, "items", user.uid);
      return merged.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cached = getResilientLocalData("items", user.uid, user.email);
      return cached === null;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const local = getResilientLocalData("items", user.uid, user.email);
      const finalData = mergeOfflineQueue(local, "items", user.uid);
      const uniqueLocal = finalData.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); 
      setItems(uniqueLocal.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
      if (uniqueLocal.length === 0) {
        syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
      }
    };

    const handleLocalEvent = () => loadLocal();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `offline_items_${user.uid}`) loadLocal();
    };

    window.addEventListener('items_updated', handleLocalEvent);
    window.addEventListener('invocentric_data_updated', handleLocalEvent);
    window.addEventListener('storage', handleStorage);

    if (isOfflineMode) {
      loadLocal();
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('items_updated', handleLocalEvent);
        window.removeEventListener('invocentric_data_updated', handleLocalEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'items'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'items'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const finalData = mergeOfflineQueue(data, "items", user.uid); 
      setItems(finalData);
      setSecureStorage(`offline_items_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'items');
      } catch (err) {
        console.error("Error fetching items (handled):", err);
      }
      loadLocal();
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('items_updated', handleLocalEvent);
      window.removeEventListener('invocentric_data_updated', handleLocalEvent);
    };
  }, [user, isOfflineMode]);

  return { items, loading };
}

export function usePayments(customerId?: string) {
  const { user, isOfflineMode } = useAuth();
  const [payments, setPayments] = useState<any[]>(() => {
    if (!user) return [];
    try {
      let cached = getResilientLocalData("payments", user.uid, user.email);
      let merged = mergeOfflineQueue(cached, "payments", user.uid);
      if (customerId) {
        merged = merged.filter((p: any) => p.customer_id === customerId);
      }
      return merged.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    if (!user) return false;
    try {
      const cached = getResilientLocalData("payments", user.uid, user.email);
      return cached === null;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      let local = getResilientLocalData("payments", user.uid, user.email);
      const finalData = mergeOfflineQueue(local, "payments", user.uid);
      let list = finalData;
      if (customerId) {
        list = list.filter((p: any) => p.customer_id === customerId);
      }
      const uniqueLocal = list.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); 
      setPayments(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      setLoading(false);
    };

    const handleLocalEvent = () => loadLocal();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `offline_payments_${user.uid}`) loadLocal();
    };

    window.addEventListener('payments_updated', handleLocalEvent);
    window.addEventListener('invocentric_data_updated', handleLocalEvent);
    window.addEventListener('storage', handleStorage);

    if (isOfflineMode) {
      loadLocal();
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('payments_updated', handleLocalEvent);
        window.removeEventListener('invocentric_data_updated', handleLocalEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    let q = candidateUids.length > 1
      ? query(collection(db, 'payments'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'payments'), where('user_id', '==', user.uid));

    if (customerId) {
      q = query(q, where('customer_id', '==', customerId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
      const finalData = mergeOfflineQueue(data, "payments", user.uid); 
      setPayments(finalData);
      if (!customerId) {
        setSecureStorage(`offline_payments_${user.uid}`, finalData);
      }
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'payments');
      } catch (err) {
        console.error("Error fetching payments (handled):", err);
      }
      loadLocal();
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('payments_updated', handleLocalEvent);
      window.removeEventListener('invocentric_data_updated', handleLocalEvent);
    };
  }, [user, customerId, isOfflineMode]);

  return { payments, loading };
}

export function useExpenses() {
  const { user, isOfflineMode } = useAuth();
  const [expenses, setExpenses] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getResilientLocalData("expenses", user.uid, user.email);
      const merged = mergeOfflineQueue(cached, "expenses", user.uid);
      return merged.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    if (!user) return false;
    try {
      const cached = getResilientLocalData("expenses", user.uid, user.email);
      return cached === null;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const local = getResilientLocalData("expenses", user.uid, user.email);
      const finalData = mergeOfflineQueue(local, "expenses", user.uid);
      const uniqueLocal = finalData.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); 
      setExpenses(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      setLoading(false);
    };

    const handleLocalEvent = () => loadLocal();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `offline_expenses_${user.uid}`) loadLocal();
    };

    window.addEventListener('expenses_updated', handleLocalEvent);
    window.addEventListener('invocentric_data_updated', handleLocalEvent);
    window.addEventListener('storage', handleStorage);

    if (isOfflineMode) {
      loadLocal();
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('expenses_updated', handleLocalEvent);
        window.removeEventListener('invocentric_data_updated', handleLocalEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'expenses'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'expenses'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
      const finalData = mergeOfflineQueue(data, "expenses", user.uid); 
      setExpenses(finalData);
      setSecureStorage(`offline_expenses_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'expenses');
      } catch (err) {
        console.error("Error fetching expenses (handled):", err);
      }
      loadLocal();
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('expenses_updated', handleLocalEvent);
      window.removeEventListener('invocentric_data_updated', handleLocalEvent);
    };
  }, [user, isOfflineMode]);

  return { expenses, loading };
}

export function usePurchases() {
  const { user, isOfflineMode } = useAuth();
  const [purchases, setPurchases] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getResilientLocalData("purchases", user.uid, user.email);
      const merged = mergeOfflineQueue(cached, "purchases", user.uid);
      return merged.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    if (!user) return false;
    try {
      const cached = getResilientLocalData("purchases", user.uid, user.email);
      return cached === null;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const local = getResilientLocalData("purchases", user.uid, user.email);
      const finalData = mergeOfflineQueue(local, "purchases", user.uid);
      const uniqueLocal = finalData.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); 
      setPurchases(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      setLoading(false);
    };

    const handleLocalEvent = () => loadLocal();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `offline_purchases_${user.uid}`) loadLocal();
    };

    window.addEventListener('purchases_updated', handleLocalEvent);
    window.addEventListener('invocentric_data_updated', handleLocalEvent);
    window.addEventListener('storage', handleStorage);

    if (isOfflineMode) {
      loadLocal();
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('purchases_updated', handleLocalEvent);
        window.removeEventListener('invocentric_data_updated', handleLocalEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'purchases'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'purchases'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
      const finalData = mergeOfflineQueue(data, "purchases", user.uid); 
      setPurchases(finalData);
      setSecureStorage(`offline_purchases_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'purchases');
      } catch (err) {
        console.error("Error fetching purchases (handled):", err);
      }
      loadLocal();
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('purchases_updated', handleLocalEvent);
      window.removeEventListener('invocentric_data_updated', handleLocalEvent);
    };
  }, [user, isOfflineMode]);

  return { purchases, loading };
}

export function useSettings() {
  const { user, isOfflineMode } = useAuth();
  const [settings, setSettings] = useState<any>(() => {
    if (!user) return null;
    try {
      const isLocallyCompleted = localStorage.getItem(`wizard_completed_${user.uid}`) === 'true';
      const cachedProfile = getStoredUserProfile(user.uid);
      if (cachedProfile) {
        return { id: user.uid, ...cachedProfile, ...(isLocallyCompleted ? { wizard_completed: true } : {}) };
      } else if (isLocallyCompleted) {
        return { id: user.uid, wizard_completed: true };
      }
    } catch (_) {}
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cachedProfile = getStoredUserProfile(user.uid);
      return !cachedProfile;
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    // Check local completed flag
    const isLocallyCompleted = localStorage.getItem(`wizard_completed_${user.uid}`) === 'true';

    // Try to pre-populate settings with cached data to avoid visual flicker / loading locks
    const cachedProfile = getStoredUserProfile(user.uid);
    if (cachedProfile) {
      setSettings({ id: user.uid, ...cachedProfile, ...(isLocallyCompleted ? { wizard_completed: true } : {}) });
    } else if (isLocallyCompleted) {
      setSettings({ id: user.uid, wizard_completed: true });
    }

    if (isOfflineMode) {
      setLoading(false);
      return;
    }

    // Safety timeout: if Firestore onSnapshot hangs, resolve loading after 4 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn("Firestore snapshot for settings took too long; resolving with cached settings.");
      setLoading(false);
    }, 4000);

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      clearTimeout(safetyTimeout);
      const isCompletedFlag = localStorage.getItem(`wizard_completed_${user.uid}`) === 'true';
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (isCompletedFlag || data.wizard_completed === true || data.wizard_completed === 'true' || data.business_name) {
          data.wizard_completed = true;
          localStorage.setItem(`wizard_completed_${user.uid}`, 'true');
        }
        const mergedProfile = saveStoredUserProfile(user.uid, data);
        setSettings({ id: docSnap.id, ...mergedProfile });
      } else if (isCompletedFlag) {
        setSettings({ id: user.uid, wizard_completed: true });
      }
      setLoading(false);
    }, (error) => {
      clearTimeout(safetyTimeout);
      try {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } catch (err) {
        console.error("Error fetching settings (handled):", err);
      }
      // Quota/network fallback
      const fallbackProfile = getStoredUserProfile(user.uid);
      const isCompletedFlag = localStorage.getItem(`wizard_completed_${user.uid}`) === 'true';
      if (fallbackProfile || isCompletedFlag) {
        setSettings({ id: user.uid, ...(fallbackProfile || {}), ...(isCompletedFlag ? { wizard_completed: true } : {}) });
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, [user, isOfflineMode]);

  const updateSettings = async (newData: any) => {
    if (!user) return;
    try {
      const merged = saveStoredUserProfile(user.uid, newData);
      setSettings((prev: any) => ({ ...(prev || {}), ...merged }));

      if (!isOfflineMode && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const cleanPayload = sanitizeFirestorePayload({
            ...newData,
            updated_at: serverTimestamp()
          });
          await setDoc(userDocRef, cleanPayload, { merge: true });
        } catch (cloudErr) {
          console.warn("Could not sync settings to cloud (saved locally):", cloudErr);
        }
      }
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  return { settings, loading, updateSettings, setSettings };
}

export function useNotifications() {
  const { user, isOfflineMode } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (isOfflineMode) {
      const loadLocal = () => {
        const local = getSecureStorage(`offline_notifications_${user.uid}`, []);
        const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
        setNotifications(uniqueLocal.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
        setLoading(false);
      };
      loadLocal();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_notifications_${user.uid}`) loadLocal();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'notifications'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'notifications'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      const finalData = mergeOfflineQueue(data, "notifications", user.uid);
      setNotifications(finalData);
      setSecureStorage(`offline_notifications_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      } catch (err) {
        console.error("Error fetching notifications (handled):", err);
      }
      // Quota/network fallback
      const local = getSecureStorage(`offline_notifications_${user.uid}`, []);
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setNotifications(uniqueLocal.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      setLoading(false);
      syncAllUserDataFromFirestore(user.uid, user.email).catch(() => {});
    });

    return () => unsubscribe();
  }, [user, isOfflineMode]);

  return { notifications, loading };
}

export function useRecycleBin() {
  const { user, isOfflineMode } = useAuth();
  const [recycleBinItems, setRecycleBinItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecycleBinItems([]);
      setLoading(false);
      return;
    }

    const purgeExpired = (items: any[]) => {
      const now = Date.now();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const validItems: any[] = [];
      const expiredItems: any[] = [];

      items.forEach((item) => {
        const deletedTime = item.deleted_at ? new Date(item.deleted_at).getTime() : now;
        if (now - deletedTime > THIRTY_DAYS_MS) {
          expiredItems.push(item);
        } else {
          validItems.push(item);
        }
      });

      if (expiredItems.length > 0) {
        import('../services/dbService').then(({ dbService }) => {
          expiredItems.forEach((exp) => {
            dbService.delete('recycle_bin', exp.id, { permanent: true, offlineMode: isOfflineMode, userId: user.uid }).catch(console.error);
          });
        });
      }

      validItems.sort((a, b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime());
      return validItems;
    };

    const refreshLocalRecycleBin = () => {
      const fresh = getSecureStorage(`offline_recycle_bin_${user.uid}`, []);
      const freshMerged = mergeOfflineQueue(fresh, 'recycle_bin', user.uid);
      setRecycleBinItems(purgeExpired(freshMerged));
    };

    if (isOfflineMode) {
      refreshLocalRecycleBin();
      setLoading(false);

      const handleStorageChange = (e: Event) => {
        if ('key' in e) {
          const se = e as StorageEvent;
          if (se.key && se.key !== `offline_recycle_bin_${user.uid}` && se.key !== `offline_upserts_${user.uid}`) {
            return;
          }
        }
        refreshLocalRecycleBin();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('recycle_bin_updated', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('recycle_bin_updated', handleStorageChange);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'recycle_bin'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'recycle_bin'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const finalData = mergeOfflineQueue(data, 'recycle_bin', user.uid);
        const validData = purgeExpired(finalData);
        setRecycleBinItems(validData);
        setSecureStorage(`offline_recycle_bin_${user.uid}`, validData);
        setLoading(false);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'recycle_bin');
        } catch {
          // Handled and logged error
        }
        const fallback = getSecureStorage(`offline_recycle_bin_${user.uid}`, []);
        setRecycleBinItems(purgeExpired(fallback));
        setLoading(false);
      }
    );

    const handleCustomEvent = () => refreshLocalRecycleBin();
    window.addEventListener('recycle_bin_updated', handleCustomEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('recycle_bin_updated', handleCustomEvent);
    };
  }, [user, isOfflineMode]);

  return { recycleBinItems, loading };
}

export function useTemplates() {
  const { user, isOfflineMode } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    const loadLocal = () => {
      const local = getSecureStorage(`offline_templates_${user.uid}`, []);
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      return uniqueLocal;
    };

    if (isOfflineMode) {
      const handleLoad = () => {
        setTemplates(loadLocal());
        setLoading(false);
      };
      handleLoad();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_templates_${user.uid}`) handleLoad();
      };
      const handleCustomEvent = () => handleLoad();
      window.addEventListener('storage', handleStorage);
      window.addEventListener('templates_updated', handleCustomEvent);
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('templates_updated', handleCustomEvent);
      };
    }

    const candidateUids = getCandidateUids(user);
    const q = candidateUids.length > 1
      ? query(collection(db, 'templates'), where('user_id', 'in', candidateUids))
      : query(collection(db, 'templates'), where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      const local = loadLocal();
      const combined = [...data];
      local.forEach((item: any) => {
        if (!combined.some(c => c.id === item.id)) {
          combined.unshift(item);
        }
      });
      const finalData = mergeOfflineQueue(combined, "templates", user.uid);
      setTemplates(finalData);
      setSecureStorage(`offline_templates_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'templates');
      } catch (err) {
        console.error("Error fetching templates (handled):", err);
      }
      setTemplates(loadLocal());
      setLoading(false);
    });

    const handleCustomEvent = () => {
      setTemplates(loadLocal());
    };
    window.addEventListener('templates_updated', handleCustomEvent);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `offline_templates_${user.uid}`) {
        setTemplates(loadLocal());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('templates_updated', handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [user, isOfflineMode]);

  return { templates, loading };
}

export function useData() {
  const invoicesData = useInvoices();
  const customersData = useCustomers();
  const itemsData = useItems();
  const paymentsData = usePayments();
  const expensesData = useExpenses();
  const purchasesData = usePurchases();

  return {
    invoices: invoicesData.invoices,
    customers: customersData.customers,
    items: itemsData.items,
    payments: paymentsData.payments,
    expenses: expensesData.expenses,
    purchases: purchasesData.purchases,
    loading: invoicesData.loading || customersData.loading || itemsData.loading || paymentsData.loading || expensesData.loading || purchasesData.loading
  };
}
