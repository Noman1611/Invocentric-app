import { db } from '../lib/firebase';
import { 
  collection, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { sanitizeData } from '../utils/sanitizeUtils';
import { localDbEngine } from './localDbEngine';
import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';

export interface DbOperationOptions {
  offlineMode?: boolean;
  userId?: string;
  permanent?: boolean;
}

export function isLocalOnlyMode(options?: DbOperationOptions): boolean {
  if (options?.offlineMode) return true;
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem('is_offline_mode') === 'true') return true;
    if (localStorage.getItem('invocentric_storage_mode') === 'local_pc') return true;
  }
  return false;
}

function toFirestoreTimestamp(val?: any) {
  if (!val) return serverTimestamp();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? serverTimestamp() : d;
  }
  return serverTimestamp();
}

function notifyLocalChange(collectionName: string, userId: string, recordId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = `offline_${collectionName}_${userId}`;
    window.dispatchEvent(new CustomEvent('local_db_updated', { detail: { collection: collectionName } }));
    window.dispatchEvent(new CustomEvent(`${collectionName}_updated`, { detail: { id: recordId, collection: collectionName } }));
    window.dispatchEvent(new CustomEvent('invocentric_data_updated', { detail: { id: recordId, collection: collectionName } }));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  } catch (e) {
    // Non-browser environment or detached window
  }
}

function saveToLocalCache(collectionName: string, userId: string, record: any) {
  if (!userId) return;
  try {
    const cacheKey = `offline_${collectionName}_${userId}`;
    const list = getSecureStorage(cacheKey, []);
    const index = list.findIndex((item: any) => item.id === record.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...record };
    } else {
      list.unshift(record);
    }
    setSecureStorage(cacheKey, list);

    // Also queue into offline_upserts for seamless mergeOfflineQueue support in hooks
    const upsertsKey = `offline_upserts_${userId}`;
    const upserts = getSecureStorage(upsertsKey, []);
    const upIndex = upserts.findIndex((u: any) => u.collection === collectionName && u.item?.id === record.id);
    if (upIndex >= 0) {
      upserts[upIndex] = { collection: collectionName, item: record };
    } else {
      upserts.unshift({ collection: collectionName, item: record });
    }
    setSecureStorage(upsertsKey, upserts);

    // If item was previously queued for deletion, remove it from deletions
    const delKey = `offline_deletions_${userId}`;
    const dels = getSecureStorage(delKey, []);
    const filteredDels = dels.filter((d: any) => !(d.collection === collectionName && d.id === record.id));
    setSecureStorage(delKey, filteredDels);

    // Keep localDbEngine in sync for Desktop Electron JSON files & in-memory cache
    localDbEngine.saveItem(collectionName, record).catch(() => {});

    notifyLocalChange(collectionName, userId, record.id);
  } catch (err) {
    console.warn(`[dbService] Failed to save ${collectionName} to local cache:`, err);
  }
}

function removeFromLocalCache(collectionName: string, userId: string, docId: string, permanent: boolean = false, oldRecord?: any) {
  if (!userId) return;
  try {
    const cacheKey = `offline_${collectionName}_${userId}`;
    const list = getSecureStorage(cacheKey, []);
    const target = oldRecord || list.find((item: any) => item.id === docId);
    const remaining = list.filter((item: any) => item.id !== docId);
    setSecureStorage(cacheKey, remaining);

    // Remove from offline_upserts
    const upsertsKey = `offline_upserts_${userId}`;
    const upserts = getSecureStorage(upsertsKey, []);
    setSecureStorage(upsertsKey, upserts.filter((u: any) => !(u.collection === collectionName && u.item?.id === docId)));

    // Queue into offline_deletions for cloud sync
    const delKey = `offline_deletions_${userId}`;
    const dels = getSecureStorage(delKey, []);
    if (!dels.some((d: any) => d.collection === collectionName && d.id === docId)) {
      dels.push({ collection: collectionName, id: docId });
      setSecureStorage(delKey, dels);
    }

    // Move to local recycle bin if not permanent
    if (!permanent && collectionName !== 'recycle_bin' && collectionName !== 'notifications') {
      const binDocId = `${collectionName}_${docId}`;
      const recycleItem = {
        id: binDocId,
        original_collection: collectionName,
        original_id: docId,
        item_data: target ? { ...target, id: docId } : { id: docId },
        deleted_at: new Date().toISOString(),
        user_id: userId,
        title: getRecycleTitle(collectionName, target, docId)
      };
      saveToLocalCache('recycle_bin', userId, recycleItem);
    }

    // Call localDbEngine deleteItem
    localDbEngine.deleteItem(collectionName, docId, permanent).catch(() => {});

    notifyLocalChange(collectionName, userId, docId);
  } catch (err) {
    console.warn(`[dbService] Failed to remove ${collectionName} from local cache:`, err);
  }
}

function getRecycleTitle(collectionName: string, item: any, docId: string): string {
  if (!item) return `${collectionName.slice(0, -1).toUpperCase()} #${docId.slice(0, 8)}`;
  if (collectionName === 'invoices') {
    const num = item.invoice_number || docId.slice(0, 8).toUpperCase();
    const cName = item.customer_name || 'Walk-in Customer';
    const amt = item.total || item.amount || 0;
    return `Invoice #${num} • ${cName} (₹${amt})`;
  }
  if (collectionName === 'customers') {
    return `Customer: ${item.name || item.company_name || 'Unknown Customer'}`;
  }
  if (collectionName === 'items') {
    return `Product: ${item.name || item.title || 'Inventory Item'} (Stock: ${item.stock || 0})`;
  }
  if (collectionName === 'expenses') {
    return `Expense: ${item.title || item.category || 'Expense'} (₹${item.amount || 0})`;
  }
  if (collectionName === 'purchases') {
    return `Purchase: ${item.supplier_name || 'Supplier'} (₹${item.amount || item.total || 0})`;
  }
  if (collectionName === 'payments') {
    return `Payment: ${item.customer_name || 'Customer'} (₹${item.amount || 0})`;
  }
  if (collectionName === 'quotations') {
    return `Quotation: #${item.quotation_number || docId.slice(0, 8)} • ${item.customer_name || 'Client'}`;
  }
  return `${collectionName.toUpperCase()}: ${item.name || item.title || docId.slice(0, 8)}`;
}

async function triggerNotification(
  actionType: 'create' | 'update' | 'delete',
  collectionName: string,
  docId: string | undefined,
  data: any,
  oldData: any,
  options: DbOperationOptions
) {
  const { userId, offlineMode } = options;
  if (!userId || collectionName === 'notifications') return;

  let text = '';
  const merged = { ...oldData, ...data };

  if (actionType === 'create') {
    if (collectionName === 'invoices') {
      text = `Invoice #${merged.invoice_number || 'New'} created for ${merged.customer_name || 'Walk-in Customer'} (Total: ₹${merged.total || merged.amount || 0}).`;
    } else if (collectionName === 'payments') {
      text = `Payment of ₹${merged.amount || 0} received via ${merged.method || 'cash'}.`;
    } else if (collectionName === 'expenses') {
      text = `Expense of ₹${merged.amount || 0} recorded under '${merged.category || 'General'}'.`;
    } else if (collectionName === 'purchases') {
      text = `Purchase of ₹${merged.amount || 0} recorded from ${merged.supplier_name || 'Supplier'}.`;
    } else if (collectionName === 'items') {
      text = `New product '${merged.name}' added to inventory.`;
    } else if (collectionName === 'customers') {
      text = `New customer '${merged.name}' registered.`;
    }
  } else if (actionType === 'update') {
    if (collectionName === 'invoices') {
      if (merged.status !== oldData?.status) {
        text = `Invoice #${merged.invoice_number || docId} status changed to ${String(merged.status).toUpperCase()}.`;
      } else {
        text = `Invoice #${merged.invoice_number || docId} details updated.`;
      }
    } else if (collectionName === 'items') {
      if (merged.stock !== undefined) {
        const threshold = merged.low_stock_threshold !== undefined ? merged.low_stock_threshold : 5;
        if (merged.stock <= threshold) {
          text = `Stock warning: Product '${merged.name}' is low on stock (${merged.stock} remaining).`;
        } else {
          text = `Product '${merged.name}' stock updated to ${merged.stock}.`;
        }
      } else {
        text = `Product '${merged.name}' details updated.`;
      }
    } else if (collectionName === 'users') {
      text = `Profile and business settings updated.`;
    }
  } else if (actionType === 'delete') {
    if (collectionName === 'invoices') {
      text = `Invoice #${oldData?.invoice_number || 'Deleted'} removed from database.`;
    } else if (collectionName === 'customers') {
      text = `Customer '${oldData?.name || 'Deleted'}' removed.`;
    } else if (collectionName === 'items') {
      text = `Product '${oldData?.name || 'Deleted'}' removed from inventory.`;
    } else if (collectionName === 'payments') {
      text = `Payment record of ₹${oldData?.amount || 0} deleted.`;
    } else if (collectionName === 'expenses') {
      text = `Expense record of ₹${oldData?.amount || 0} deleted.`;
    } else if (collectionName === 'purchases') {
      text = `Purchase record of ₹${oldData?.amount || 0} deleted.`;
    }
  }

  if (text) {
    let category = 'other';
    let target_id: string | undefined = docId;
    let target_collection: string | undefined = collectionName;

    if (collectionName === 'invoices') {
      category = 'invoices';
    } else if (collectionName === 'payments') {
      category = 'invoices';
      target_id = merged.invoice_id || docId;
      target_collection = 'invoices';
    } else if (collectionName === 'items') {
      category = 'inventory';
    } else if (collectionName === 'customers') {
      category = 'customers';
    } else if (collectionName === 'expenses') {
      category = 'expenses';
    } else if (collectionName === 'purchases') {
      category = 'expenses';
    } else if (collectionName === 'users') {
      category = 'settings';
    }

    if (actionType === 'delete') {
      target_id = undefined;
      target_collection = undefined;
    }

    try {
      await dbService.add(
        'notifications',
        {
          text,
          read: false,
          category,
          ...(target_id ? { target_id } : {}),
          ...(target_collection ? { target_collection } : {}),
          created_at: new Date().toISOString()
        },
        { userId, offlineMode }
      );
    } catch (e) {
      console.error('Failed to trigger notification:', e);
    }
  }
}

export async function findLinkedPayments(userId: string, invoiceId: string, isOfflineMode?: boolean): Promise<any[]> {
  const existingPayments: any[] = [];
  if (!userId || !invoiceId) return existingPayments;

  // 1. Check local cache first
  try {
    const cached = getSecureStorage(`offline_payments_${userId}`, []);
    const localMatches = cached.filter((p: any) => p.invoice_id === invoiceId);
    if (localMatches.length > 0) {
      return localMatches;
    }
  } catch (_) {}

  // 2. Query Firestore if online and not local-only
  if (!isOfflineMode && !isLocalOnlyMode() && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const q = query(collection(db, 'payments'), where('user_id', '==', userId), where('invoice_id', '==', invoiceId));
      const snap = await getDocs(q);
      snap.forEach(d => existingPayments.push({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Failed to fetch linked payments from Firestore:", e);
    }
  }
  return existingPayments;
}

export const dbService = {
  async add(collectionName: string, data: any, options: DbOperationOptions): Promise<{ id: string }> {
    data = sanitizeData(data);
    const { userId } = options;
    if (!userId) throw new Error("User ID is required for database operations");

    const nowIso = new Date().toISOString();
    const docId = data.id || `${collectionName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const localRecord = {
      ...data,
      id: docId,
      user_id: userId,
      created_at: data.created_at || nowIso,
      updated_at: nowIso,
      _sync_status: 'saved_locally'
    };

    // 1. ALWAYS SAVE TO LOCAL CACHE FIRST (Zero Data Loss Guarantee)
    saveToLocalCache(collectionName, userId, localRecord);

    if (collectionName !== 'notifications') {
      triggerNotification('create', collectionName, docId, data, null, options).catch(console.error);
    }

    // 2. If online and local-only storage is NOT active, attempt cloud write with consistent Timestamp
    if (!isLocalOnlyMode(options) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const payload = {
          ...data,
          id: docId,
          user_id: userId,
          created_at: toFirestoreTimestamp(data.created_at),
          updated_at: serverTimestamp()
        };
        await setDoc(doc(db, collectionName, docId), payload, { merge: true });

        // Cloud write succeeded: dequeue from offline_upserts (fresh queue read)
        const upsertsKey = `offline_upserts_${userId}`;
        const freshUpserts = getSecureStorage(upsertsKey, []);
        const filtered = freshUpserts.filter((u: any) => !(u.collection === collectionName && u.item?.id === docId));
        setSecureStorage(upsertsKey, filtered);
      } catch (cloudErr: any) {
        console.warn(`[dbService] Cloud write deferred for ${collectionName}/${docId} (${cloudErr?.message || cloudErr}). Saved locally.`);
      }
    }

    return { id: docId };
  },

  async update(collectionName: string, docId: string, data: any, options: DbOperationOptions): Promise<{ id: string }> {
    data = sanitizeData(data);
    const { userId } = options;
    if (!userId) throw new Error("User ID is required for database operations");

    const nowIso = new Date().toISOString();

    let oldDoc: any = null;
    try {
      const cached = getSecureStorage(`offline_${collectionName}_${userId}`, []);
      oldDoc = cached.find((item: any) => item.id === docId);
    } catch (_) {}

    const updatedRecord = {
      ...(oldDoc || {}),
      ...data,
      id: docId,
      user_id: userId,
      updated_at: nowIso
    };

    // 1. ALWAYS UPDATE LOCAL CACHE FIRST
    saveToLocalCache(collectionName, userId, updatedRecord);

    if (collectionName !== 'notifications') {
      triggerNotification('update', collectionName, docId, data, oldDoc, options).catch(console.error);
    }

    // 2. If online and not local-only, attempt cloud update gracefully
    if (!isLocalOnlyMode(options) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const docRef = doc(db, collectionName, docId);
        const payload = {
          ...data,
          user_id: userId,
          updated_at: serverTimestamp()
        };
        await setDoc(docRef, payload, { merge: true });

        // Dequeue from offline upserts if sync succeeded (fresh queue read)
        const upsertsKey = `offline_upserts_${userId}`;
        const freshUpserts = getSecureStorage(upsertsKey, []);
        const filtered = freshUpserts.filter((u: any) => !(u.collection === collectionName && u.item?.id === docId));
        setSecureStorage(upsertsKey, filtered);
      } catch (cloudErr: any) {
        console.warn(`[dbService] Cloud update deferred for ${collectionName}/${docId} (${cloudErr?.message || cloudErr}). Saved locally.`);
      }
    }

    return { id: docId };
  },

  async delete(collectionName: string, docId: string, options: DbOperationOptions): Promise<void> {
    const { userId } = options;
    if (!userId) return;

    let oldDoc: any = null;
    try {
      const cached = getSecureStorage(`offline_${collectionName}_${userId}`, []);
      oldDoc = cached.find((item: any) => item.id === docId);
    } catch (_) {}

    if (collectionName === 'invoices' && userId) {
      try {
        const linked = await findLinkedPayments(userId, docId, options.offlineMode);
        if (linked.length > 0) {
          oldDoc = { ...oldDoc, linked_payments: linked };
        }
      } catch (err) {
        console.warn("Could not fetch linked payments for invoice recycle bin", err);
      }
    }

    // 1. ALWAYS REMOVE FROM LOCAL CACHE FIRST
    removeFromLocalCache(collectionName, userId, docId, options.permanent, oldDoc);

    if (collectionName !== 'notifications') {
      triggerNotification('delete', collectionName, docId, null, oldDoc, options).catch(console.error);
    }

    // 2. If online and not local-only, attempt cloud delete
    if (!isLocalOnlyMode(options) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const docRef = doc(db, collectionName, docId);

        // Move to Recycle Bin if NOT permanent
        if (collectionName !== 'recycle_bin' && collectionName !== 'notifications' && !options.permanent) {
          const binDocId = `${collectionName}_${docId}`;
          const recycleItem = {
            id: binDocId,
            original_collection: collectionName,
            original_id: docId,
            item_data: oldDoc ? { ...oldDoc, id: docId } : { id: docId },
            deleted_at: new Date().toISOString(),
            user_id: userId,
            title: getRecycleTitle(collectionName, oldDoc, docId)
          };

          await setDoc(doc(db, 'recycle_bin', binDocId), {
            ...recycleItem,
            created_at: serverTimestamp()
          });
        }

        await deleteDoc(docRef);

        // Remove from offline deletions queue if cloud delete succeeded
        const delKey = `offline_deletions_${userId}`;
        const freshDels = getSecureStorage(delKey, []);
        setSecureStorage(delKey, freshDels.filter((d: any) => !(d.collection === collectionName && d.id === docId)));
      } catch (cloudErr: any) {
        console.warn(`[dbService] Cloud delete deferred for ${collectionName}/${docId} (${cloudErr?.message || cloudErr}).`);
      }
    }
  },

  async restore(recycleBinDocId: string, options: DbOperationOptions): Promise<void> {
    const { userId } = options;
    if (!userId) return;

    let recycleDoc: any = null;
    // Check local cache first
    try {
      const cached = getSecureStorage(`offline_recycle_bin_${userId}`, []);
      recycleDoc = cached.find((r: any) => r.id === recycleBinDocId);
    } catch (_) {}

    // Check cloud if not in local and not local-only
    if (!recycleDoc && !isLocalOnlyMode(options) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const binRef = doc(db, 'recycle_bin', recycleBinDocId);
        const binSnap = await getDoc(binRef);
        if (binSnap.exists()) recycleDoc = binSnap.data();
      } catch (_) {}
    }

    if (!recycleDoc) return;
    const { original_collection, original_id, item_data } = recycleDoc;
    if (!original_collection || !item_data) return;

    const targetDocId = original_id || item_data.id || recycleBinDocId.replace(`${original_collection}_`, '');
    const restoredItem = { 
      ...item_data, 
      id: targetDocId, 
      user_id: userId, 
      updated_at: new Date().toISOString() 
    };
    delete (restoredItem as any).deleted_at;
    delete (restoredItem as any).is_deleted;

    // 1. Restore to local cache
    saveToLocalCache(original_collection, userId, restoredItem);
    // 2. Remove from recycle bin
    removeFromLocalCache('recycle_bin', userId, recycleBinDocId, true);

    // 3. Clear any queued upserts or deletions for this recycle-bin document
    const upsertsKey = `offline_upserts_${userId}`;
    const currentUpserts = getSecureStorage(upsertsKey, []);
    setSecureStorage(upsertsKey, currentUpserts.filter((u: any) => !(u.collection === 'recycle_bin' && u.item?.id === recycleBinDocId)));

    // 4. Sync to Firestore if online and not local-only
    if (!isLocalOnlyMode(options) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await setDoc(doc(db, original_collection, targetDocId), {
          ...restoredItem,
          created_at: toFirestoreTimestamp(restoredItem.created_at),
          updated_at: serverTimestamp()
        }, { merge: true });

        if (original_collection === 'invoices' && item_data.linked_payments && Array.isArray(item_data.linked_payments)) {
          for (const p of item_data.linked_payments) {
            if (p.id) {
              const restoredP = { 
                ...p, 
                user_id: userId, 
                invoice_id: targetDocId, 
                created_at: toFirestoreTimestamp(p.created_at),
                updated_at: serverTimestamp() 
              };
              delete (restoredP as any).deleted_at;
              delete (restoredP as any).is_deleted;
              await setDoc(doc(db, 'payments', p.id), restoredP, { merge: true });
            }
          }
        }

        await deleteDoc(doc(db, 'recycle_bin', recycleBinDocId));
      } catch (cloudErr) {
        console.warn("Could not sync restored item to cloud:", cloudErr);
      }
    }
  },

  async emptyRecycleBin(options: DbOperationOptions): Promise<void> {
    const { userId } = options;
    if (!userId) return;

    // 1. Clear local recycle bin storage
    setSecureStorage(`offline_recycle_bin_${userId}`, []);

    // 2. Clear queued recycle-bin upserts and deletions to avoid resurrecting deleted items
    const upsertsKey = `offline_upserts_${userId}`;
    const freshUpserts = getSecureStorage(upsertsKey, []);
    setSecureStorage(upsertsKey, freshUpserts.filter((u: any) => u.collection !== 'recycle_bin'));

    const delKey = `offline_deletions_${userId}`;
    const freshDels = getSecureStorage(delKey, []);
    setSecureStorage(delKey, freshDels.filter((d: any) => d.collection !== 'recycle_bin'));

    notifyLocalChange('recycle_bin', userId);

    // 3. If online and not local-only, empty cloud recycle bin
    if (!isLocalOnlyMode(options) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const q = query(collection(db, 'recycle_bin'), where('user_id', '==', userId));
        const snap = await getDocs(q);
        const batchDeletes = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(batchDeletes);
      } catch (cloudErr) {
        console.warn("Could not empty cloud recycle bin:", cloudErr);
      }
    }
  },

  async syncOfflineData(userId: string): Promise<{ success: boolean; processed: number; error?: any }> {
    // Block cloud sync if local-only mode is selected or user is offline
    if (!userId || isLocalOnlyMode() || typeof navigator === 'undefined' || !navigator.onLine) {
      return { success: true, processed: 0 };
    }

    let processedCount = 0;
    try {
      const upsertsKey = `offline_upserts_${userId}`;
      const upserts = getSecureStorage(upsertsKey, []);
      const syncedUpsertKeys = new Set<string>();

      for (const entry of upserts) {
        if (!entry.collection || !entry.item || !entry.item.id) continue;
        try {
          const docRef = doc(db, entry.collection, entry.item.id);
          const cleanItem = {
            ...entry.item,
            user_id: userId,
            created_at: toFirestoreTimestamp(entry.item.created_at),
            updated_at: serverTimestamp()
          };
          delete cleanItem._sync_status;
          delete cleanItem._local_only;

          await setDoc(docRef, cleanItem, { merge: true });
          syncedUpsertKeys.add(`${entry.collection}_${entry.item.id}`);
          processedCount++;
        } catch (err: any) {
          console.warn(`[syncOfflineData] Failed to sync ${entry.collection}/${entry.item.id}:`, err?.message);
        }
      }

      // Re-read fresh queue from storage so items added concurrently during awaits are NOT overwritten
      if (syncedUpsertKeys.size > 0) {
        const latestUpserts = getSecureStorage(upsertsKey, []);
        const remainingUpserts = latestUpserts.filter(
          (u: any) => !syncedUpsertKeys.has(`${u.collection}_${u.item?.id}`)
        );
        setSecureStorage(upsertsKey, remainingUpserts);
      }

      const delKey = `offline_deletions_${userId}`;
      const dels = getSecureStorage(delKey, []);
      const syncedDelKeys = new Set<string>();

      for (const entry of dels) {
        if (!entry.collection || !entry.id) continue;
        try {
          await deleteDoc(doc(db, entry.collection, entry.id));
          syncedDelKeys.add(`${entry.collection}_${entry.id}`);
          processedCount++;
        } catch (err: any) {
          console.warn(`[syncOfflineData] Failed to delete ${entry.collection}/${entry.id}:`, err?.message);
        }
      }

      // Re-read fresh deletions queue to preserve concurrent additions
      if (syncedDelKeys.size > 0) {
        const latestDels = getSecureStorage(delKey, []);
        const remainingDels = latestDels.filter(
          (d: any) => !syncedDelKeys.has(`${d.collection}_${d.id}`)
        );
        setSecureStorage(delKey, remainingDels);
      }

      return { success: true, processed: processedCount };
    } catch (e) {
      console.error("[syncOfflineData] Sync error:", e);
      return { success: false, processed: processedCount, error: e };
    }
  }
};
