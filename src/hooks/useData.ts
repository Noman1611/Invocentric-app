import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { getStoredUserProfile, saveStoredUserProfile, sanitizeFirestorePayload } from '../utils/settingsStorage';
import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
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
  const collectionDeletions = deletions.filter((d: any) => d.collection === collectionName).map((d: any) => d.id);
  
  return mergedData.filter(d => !collectionDeletions.includes(d.id));
}


export function useInvoices() {
  const { user, isOfflineMode } = useAuth();
  const [invoices, setInvoices] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getSecureStorage(`offline_invoices_${user.uid}`, []);
      return mergeOfflineQueue(cached, "invoices", user.uid);
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cached = getSecureStorage(`offline_invoices_${user.uid}`, null);
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

    if (isOfflineMode) {
      const localInvoices = getSecureStorage(`offline_invoices_${user.uid}`, []);
      const uniqueLocal = localInvoices.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); setInvoices(uniqueLocal);
      setLoading(false);
      
      // Listen for local changes (from other tabs of same browser)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === `offline_invoices_${user.uid}`) {
          setInvoices(JSON.parse(e.newValue || '[]'));
        }
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }

    const q = query(
      collection(db, 'invoices'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc')
    );

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
      const finalData = mergeOfflineQueue(data, "invoices", user.uid); setInvoices(finalData);
      setSecureStorage(`offline_invoices_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      } catch (err) {
        console.error("Error fetching invoices (handled):", err);
      }
      // Quota/network fallback
      const localInvoices = getSecureStorage(`offline_invoices_${user.uid}`, []);
      const uniqueLocal = localInvoices.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setInvoices(uniqueLocal);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isOfflineMode]);

  return { invoices, loading };
}

export function useCustomers() {
  const { user, isOfflineMode } = useAuth();
  const [customers, setCustomers] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getSecureStorage(`offline_customers_${user.uid}`, []);
      const merged = mergeOfflineQueue(cached, "customers", user.uid);
      return merged.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cached = getSecureStorage(`offline_customers_${user.uid}`, null);
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

    if (isOfflineMode) {
      const loadLocal = () => {
        const local = getSecureStorage(`offline_customers_${user.uid}`, []);
        const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); setCustomers(uniqueLocal.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
        setLoading(false);
      };
      loadLocal();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_customers_${user.uid}`) loadLocal();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    const q = query(
      collection(db, 'customers'),
      where('user_id', '==', user.uid),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      const finalData = mergeOfflineQueue(data, "customers", user.uid); setCustomers(finalData);
      setSecureStorage(`offline_customers_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      } catch (err) {
        console.error("Error fetching customers (handled):", err);
      }
      // Quota/network fallback
      const local = getSecureStorage(`offline_customers_${user.uid}`, []);
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setCustomers(uniqueLocal.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isOfflineMode]);

  return { customers, loading };
}

export function useItems() {
  const { user, isOfflineMode } = useAuth();
  const [items, setItems] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = getSecureStorage(`offline_items_${user.uid}`, []);
      const merged = mergeOfflineQueue(cached, "items", user.uid);
      return merged.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    try {
      const cached = getSecureStorage(`offline_items_${user.uid}`, null);
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

    if (isOfflineMode) {
      const loadLocal = () => {
        const local = getSecureStorage(`offline_items_${user.uid}`, []);
        const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); setItems(uniqueLocal.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
        setLoading(false);
      };
      loadLocal();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_items_${user.uid}`) loadLocal();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    const q = query(
      collection(db, 'items'),
      where('user_id', '==', user.uid),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      const finalData = mergeOfflineQueue(data, "items", user.uid); setItems(finalData);
      setSecureStorage(`offline_items_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'items');
      } catch (err) {
        console.error("Error fetching items (handled):", err);
      }
      // Quota/network fallback
      const local = getSecureStorage(`offline_items_${user.uid}`, []);
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setItems(uniqueLocal.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isOfflineMode]);

  return { items, loading };
}

export function usePayments(customerId?: string) {
  const { user, isOfflineMode } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    if (isOfflineMode) {
      const loadLocal = () => {
        let local = getSecureStorage(`offline_payments_${user.uid}`, []);
        if (customerId) {
          local = local.filter((p: any) => p.customer_id === customerId);
        }
        const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); setPayments(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
        setLoading(false);
      };
      loadLocal();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_payments_${user.uid}`) loadLocal();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    let q = query(
      collection(db, 'payments'),
      where('user_id', '==', user.uid),
      orderBy('date', 'desc')
    );

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
      const finalData = mergeOfflineQueue(data, "payments", user.uid); setPayments(finalData);
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
      // Quota/network fallback
      let local = getSecureStorage(`offline_payments_${user.uid}`, []);
      if (customerId) {
        local = local.filter((p: any) => p.customer_id === customerId);
      }
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setPayments(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, customerId, isOfflineMode]);

  return { payments, loading };
}

export function useExpenses() {
  const { user, isOfflineMode } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    if (isOfflineMode) {
      const loadLocal = () => {
        const local = getSecureStorage(`offline_expenses_${user.uid}`, []);
        const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); setExpenses(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
        setLoading(false);
      };
      loadLocal();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_expenses_${user.uid}`) loadLocal();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    const q = query(
      collection(db, 'expenses'),
      where('user_id', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      const finalData = mergeOfflineQueue(data, "expenses", user.uid); setExpenses(finalData);
      setSecureStorage(`offline_expenses_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'expenses');
      } catch (err) {
        console.error("Error fetching expenses (handled):", err);
      }
      // Quota/network fallback
      const local = getSecureStorage(`offline_expenses_${user.uid}`, []);
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setExpenses(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isOfflineMode]);

  return { expenses, loading };
}

export function usePurchases() {
  const { user, isOfflineMode } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    if (isOfflineMode) {
      const loadLocal = () => {
        const local = getSecureStorage(`offline_purchases_${user.uid}`, []);
        const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id)); setPurchases(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
        setLoading(false);
      };
      loadLocal();
      const handleStorage = (e: StorageEvent) => {
        if (e.key === `offline_purchases_${user.uid}`) loadLocal();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    const q = query(
      collection(db, 'purchases'),
      where('user_id', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
        if (d.date?.toDate) d.date = d.date.toDate().toISOString();
        return { id: doc.id, ...d };
      });
      const finalData = mergeOfflineQueue(data, "purchases", user.uid); setPurchases(finalData);
      setSecureStorage(`offline_purchases_${user.uid}`, finalData);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'purchases');
      } catch (err) {
        console.error("Error fetching purchases (handled):", err);
      }
      // Quota/network fallback
      const local = getSecureStorage(`offline_purchases_${user.uid}`, []);
      const uniqueLocal = local.filter((item: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === item.id));
      setPurchases(uniqueLocal.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      setLoading(false);
    });

    return () => unsubscribe();
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

      if (!isOfflineMode && navigator.onLine) {
        const userDocRef = doc(db, 'users', user.uid);
        const cleanPayload = sanitizeFirestorePayload({
          ...newData,
          updated_at: serverTimestamp()
        });
        await setDoc(userDocRef, cleanPayload, { merge: true });
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
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

    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data({ serverTimestamps: 'estimate' });
        if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
        return { id: doc.id, ...d };
      });
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

    const q = query(
      collection(db, 'recycle_bin'),
      where('user_id', '==', user.uid)
    );

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

    const q = query(
      collection(db, 'templates'),
      where('user_id', '==', user.uid)
    );

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
