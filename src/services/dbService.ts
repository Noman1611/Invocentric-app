import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
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

export interface DbOperationOptions {
  offlineMode?: boolean;
  userId?: string;
  permanent?: boolean;
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
      text = `Invoice #${merged.invoice_number || 'New'} created for ${merged.customer_name || 'Walk-in Customer'} (Total: ₹${merged.total || 0}).`;
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
        text = `Invoice #${merged.invoice_number} status changed to ${String(merged.status).toUpperCase()}.`;
      } else {
        text = `Invoice #${merged.invoice_number} details updated.`;
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
  if (userId) {
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
  async add(collectionName: string, data: any, options: DbOperationOptions) {
    data = sanitizeData(data);
    const { userId } = options;
    if (!userId) throw new Error("User ID is required for database operations");

    const isLocalOnly = options.offlineMode || localStorage.getItem('invocentric_storage_mode') === 'local_pc';
    if (isLocalOnly) {
      const saved = await localDbEngine.saveItem(collectionName, {
        ...data,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (collectionName !== 'notifications') {
        triggerNotification('create', collectionName, saved.id, data, null, options).catch(console.error);
      }
      return { id: saved.id };
    }

    const payload = {
      ...data,
      user_id: userId,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, collectionName), payload);
    
    if (collectionName !== 'notifications') {
      triggerNotification('create', collectionName, docRef.id, data, null, options).catch(console.error);
    }

    return { id: docRef.id };
  },

  async update(collectionName: string, docId: string, data: any, options: DbOperationOptions) {
    data = sanitizeData(data);
    const { userId } = options;
    if (!userId) throw new Error("User ID is required for database operations");

    const isLocalOnly = options.offlineMode || localStorage.getItem('invocentric_storage_mode') === 'local_pc';
    if (isLocalOnly) {
      const saved = await localDbEngine.saveItem(collectionName, {
        ...data,
        id: docId,
        user_id: userId,
        updated_at: new Date().toISOString()
      });
      if (collectionName !== 'notifications') {
        triggerNotification('update', collectionName, docId, data, null, options).catch(console.error);
      }
      return { id: saved.id };
    }

    const docRef = doc(db, collectionName, docId);
    let oldDoc: any = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) oldDoc = { id: snap.id, ...snap.data() };
    } catch (e) {}

    const payload = {
      ...data,
      updated_at: serverTimestamp()
    };

    await updateDoc(docRef, payload);

    if (collectionName !== 'notifications') {
      triggerNotification('update', collectionName, docId, data, oldDoc, options).catch(console.error);
    }

    return { id: docId };
  },

  async delete(collectionName: string, docId: string, options: DbOperationOptions) {
    const { userId } = options;
    if (!userId) return;

    const isLocalOnly = options.offlineMode || localStorage.getItem('invocentric_storage_mode') === 'local_pc';
    if (isLocalOnly) {
      await localDbEngine.deleteItem(collectionName, docId, options.permanent);
      if (collectionName !== 'notifications') {
        triggerNotification('delete', collectionName, docId, null, null, options).catch(console.error);
      }
      return;
    }

    const docRef = doc(db, collectionName, docId);
    let oldDoc: any = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) oldDoc = { id: snap.id, ...snap.data() };
    } catch (e) {}

    if (collectionName === 'invoices' && userId) {
      try {
        const linked = await findLinkedPayments(userId, docId);
        if (linked.length > 0) {
          oldDoc = { ...oldDoc, linked_payments: linked };
        }
      } catch (err) {
        console.warn("Could not fetch linked payments for invoice recycle bin", err);
      }
    }

    // Move to Recycle Bin if NOT permanent
    if (collectionName !== 'recycle_bin' && collectionName !== 'notifications' && !options.permanent && userId) {
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

    if (collectionName !== 'notifications') {
      triggerNotification('delete', collectionName, docId, null, oldDoc, options).catch(console.error);
    }
  },

  async restore(recycleBinDocId: string, options: DbOperationOptions) {
    const { userId } = options;
    if (!userId) return;

    const binRef = doc(db, 'recycle_bin', recycleBinDocId);
    const binSnap = await getDoc(binRef);
    if (!binSnap.exists()) return;

    const recycleDoc = binSnap.data();
    const { original_collection, original_id, item_data } = recycleDoc;
    if (!original_collection || !item_data) return;

    const targetDocId = original_id || item_data.id || recycleBinDocId.replace(`${original_collection}_`, '');
    const restoredItem = { 
      ...item_data, 
      id: targetDocId, 
      user_id: userId, 
      updated_at: serverTimestamp() 
    };
    delete (restoredItem as any).deleted_at;
    delete (restoredItem as any).is_deleted;

    await setDoc(doc(db, original_collection, targetDocId), restoredItem);

    if (original_collection === 'invoices' && item_data.linked_payments && Array.isArray(item_data.linked_payments)) {
      for (const p of item_data.linked_payments) {
        if (p.id) {
          const restoredP = { ...p, user_id: userId, invoice_id: targetDocId, updated_at: serverTimestamp() };
          delete (restoredP as any).deleted_at;
          delete (restoredP as any).is_deleted;
          await setDoc(doc(db, 'payments', p.id), restoredP);
        }
      }
    }

    await deleteDoc(binRef);
  },

  async emptyRecycleBin(options: DbOperationOptions) {
    const { userId } = options;
    if (!userId) return;

    const q = query(collection(db, 'recycle_bin'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    const batchDeletes = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(batchDeletes);
  },

  async syncOfflineData(userId: string) {
    return { success: true, processed: 0 };
  }
};
