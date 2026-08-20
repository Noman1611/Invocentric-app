import { getSecureStorage, setSecureStorage } from './cryptoUtils';

export interface LocalDbBackup {
  invoices?: any[];
  customers?: any[];
  items?: any[];
  expenses?: any[];
  purchases?: any[];
  payments?: any[];
  user_profile?: any;
}

// Check if File System Access API is supported
export function isFileSystemApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

// Persistence of file handle in IndexedDB so we don't ask the user to select the file every single time
export function saveFileHandleToIndexedDB(userId: string, handle: FileSystemFileHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`InvoCentricFileStorage_${userId}`, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("handles", "readwrite");
      const store = tx.objectStore("handles");
      const putReq = store.put(handle, "db_file_handle");
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export function getFileHandleFromIndexedDB(userId: string): Promise<FileSystemFileHandle | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(`InvoCentricFileStorage_${userId}`, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("handles", "readonly");
      const store = tx.objectStore("handles");
      const getReq = store.get("db_file_handle");
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

export function removeFileHandleFromIndexedDB(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`InvoCentricFileStorage_${userId}`, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("handles", "readwrite");
      const store = tx.objectStore("handles");
      const delReq = store.delete("db_file_handle");
      delReq.onsuccess = () => {
        // Also remove path cache
        localStorage.removeItem(`pc_file_path_${userId}`);
        localStorage.removeItem(`pc_drive_enabled_${userId}`);
        resolve();
      };
      delReq.onerror = () => reject(delReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Verify or request read/write permissions for a stored file handle
export async function verifyFilePermission(fileHandle: FileSystemFileHandle, readWrite: boolean): Promise<boolean> {
  const handleAny = fileHandle as any;
  const options = { mode: (readWrite ? 'readwrite' : 'read') };
  
  // Check if we already have permission
  if (typeof handleAny.queryPermission === 'function') {
    if ((await handleAny.queryPermission(options)) === 'granted') {
      return true;
    }
  }
  
  // Request permission
  if (typeof handleAny.requestPermission === 'function') {
    if ((await handleAny.requestPermission(options)) === 'granted') {
      return true;
    }
  }
  
  return false;
}

// Gather all local database states to pack into JSON
export function packageAllLocalData(userId: string): LocalDbBackup {
  return {
    invoices: getSecureStorage(`offline_invoices_${userId}`, []),
    customers: getSecureStorage(`offline_customers_${userId}`, []),
    items: getSecureStorage(`offline_items_${userId}`, []),
    expenses: getSecureStorage(`offline_expenses_${userId}`, []),
    purchases: getSecureStorage(`offline_purchases_${userId}`, []),
    payments: getSecureStorage(`offline_payments_${userId}`, []),
    user_profile: getSecureStorage(`user_profile_${userId}`, null),
  };
}

// Save complete packed database directly to local PC file
export async function writeAllDataToPcFile(userId: string, handle: FileSystemFileHandle): Promise<void> {
  try {
    const isPermitted = await verifyFilePermission(handle, true);
    if (!isPermitted) {
      throw new Error("Write permission not granted by user.");
    }
    const data = packageAllLocalData(userId);
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Create a writable stream to write to the file
    const writable = await handle.createWritable();
    await writable.write(jsonStr);
    await writable.close();
    
    console.log("Successfully synchronized and saved database to PC hard drive file.");
  } catch (error) {
    console.error("Failed writing data to PC drive file:", error);
    throw error;
  }
}

// Read and parse database file from local PC
export async function readAllDataFromPcFile(handle: FileSystemFileHandle): Promise<LocalDbBackup> {
  try {
    const isPermitted = await verifyFilePermission(handle, false);
    if (!isPermitted) {
      throw new Error("Read permission not granted by user.");
    }
    const file = await handle.getFile();
    const contents = await file.text();
    if (!contents.trim()) {
      return {};
    }
    return JSON.parse(contents) as LocalDbBackup;
  } catch (error) {
    console.error("Failed reading data from PC drive file:", error);
    throw error;
  }
}

// Sync values read from the PC file back into the browser's local state cache
export function applyDataToLocalCache(userId: string, data: LocalDbBackup) {
  if (data.invoices) {
    setSecureStorage(`offline_invoices_${userId}`, data.invoices);
    window.dispatchEvent(new StorageEvent('storage', { key: `offline_invoices_${userId}`, newValue: JSON.stringify(data.invoices) }));
  }
  if (data.customers) {
    setSecureStorage(`offline_customers_${userId}`, data.customers);
    window.dispatchEvent(new StorageEvent('storage', { key: `offline_customers_${userId}`, newValue: JSON.stringify(data.customers) }));
  }
  if (data.items) {
    setSecureStorage(`offline_items_${userId}`, data.items);
    window.dispatchEvent(new StorageEvent('storage', { key: `offline_items_${userId}`, newValue: JSON.stringify(data.items) }));
  }
  if (data.expenses) {
    setSecureStorage(`offline_expenses_${userId}`, data.expenses);
    window.dispatchEvent(new StorageEvent('storage', { key: `offline_expenses_${userId}`, newValue: JSON.stringify(data.expenses) }));
  }
  if (data.purchases) {
    setSecureStorage(`offline_purchases_${userId}`, data.purchases);
    window.dispatchEvent(new StorageEvent('storage', { key: `offline_purchases_${userId}`, newValue: JSON.stringify(data.purchases) }));
  }
  if (data.payments) {
    setSecureStorage(`offline_payments_${userId}`, data.payments);
    window.dispatchEvent(new StorageEvent('storage', { key: `offline_payments_${userId}`, newValue: JSON.stringify(data.payments) }));
  }
  if (data.user_profile) {
    setSecureStorage(`user_profile_${userId}`, data.user_profile);
    window.dispatchEvent(new StorageEvent('storage', { key: `user_profile_${userId}`, newValue: JSON.stringify(data.user_profile) }));
  }

  // Mark database as initialized
  if (typeof window !== 'undefined') {
    localStorage.setItem(`invocentric_db_initialized_${userId}`, 'true');
  }
  
  // Custom global event to let context loaders refresh instantly
  window.dispatchEvent(new Event('pc_data_synchronized'));

  // Also update automatic local backup mirror
  updateAutomaticLocalBackup(userId).catch(console.error);
}

// Save backup copy to IndexedDB (survives localStorage clears)
export function saveAutomaticBackupToIndexedDB(userId: string, data: LocalDbBackup): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(`InvoCentricBackupDB_${userId}`, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("backups")) {
          db.createObjectStore("backups");
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("backups", "readwrite");
        const store = tx.objectStore("backups");
        const payload = {
          data,
          timestamp: new Date().toISOString(),
          metadata: {
            invoice_count: data.invoices?.length || 0,
            item_count: data.items?.length || 0,
            customer_count: data.customers?.length || 0,
            expense_count: data.expenses?.length || 0,
            purchase_count: data.purchases?.length || 0,
            payment_count: data.payments?.length || 0,
          }
        };
        store.put(payload, "invocentric_backup_db");
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch (e) {
      console.warn("Error saving automatic IndexedDB backup:", e);
      resolve();
    }
  });
}

// Retrieve automatic backup copy from IndexedDB
export function getAutomaticBackupFromIndexedDB(userId: string): Promise<{ data: LocalDbBackup; timestamp: string; metadata: any } | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(`InvoCentricBackupDB_${userId}`, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("backups")) {
          db.createObjectStore("backups");
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("backups")) {
          return resolve(null);
        }
        const tx = db.transaction("backups", "readonly");
        const store = tx.objectStore("backups");
        const getReq = store.get("invocentric_backup_db");
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Update automatic local backup mirror (invocentric_backup_db)
export async function updateAutomaticLocalBackup(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const data = packageAllLocalData(userId);
    const totalRecords = (data.invoices?.length || 0) + (data.customers?.length || 0) + (data.items?.length || 0) + (data.expenses?.length || 0) + (data.purchases?.length || 0) + (data.payments?.length || 0);

    // If records or profile exist, tag DB as initialized
    if (totalRecords > 0 || data.user_profile) {
      localStorage.setItem(`invocentric_db_initialized_${userId}`, 'true');
    }

    // Save in secondary localStorage mirror key: invocentric_backup_db_${userId}
    setSecureStorage(`invocentric_backup_db_${userId}`, data, true);

    const metadata = {
      last_updated: new Date().toISOString(),
      invoice_count: data.invoices?.length || 0,
      customer_count: data.customers?.length || 0,
      item_count: data.items?.length || 0,
      expense_count: data.expenses?.length || 0,
      purchase_count: data.purchases?.length || 0,
      payment_count: data.payments?.length || 0,
      total_records: totalRecords
    };
    setSecureStorage(`invocentric_backup_metadata_${userId}`, metadata, true);

    // Save to IndexedDB backup store
    await saveAutomaticBackupToIndexedDB(userId, data);
  } catch (e) {
    console.warn("Failed updating automatic local backup mirror:", e);
  }
}

// Get latest snapshot from either IndexedDB or secondary localStorage
export async function getAutomaticBackupSnapshot(userId: string): Promise<{ data: LocalDbBackup; timestamp?: string; metadata?: any } | null> {
  if (!userId) return null;
  
  // 1. Check IndexedDB first (most reliable)
  const idbResult = await getAutomaticBackupFromIndexedDB(userId);
  if (idbResult && idbResult.data) {
    const totalInIdb = (idbResult.data.invoices?.length || 0) + (idbResult.data.customers?.length || 0) + (idbResult.data.items?.length || 0);
    if (totalInIdb > 0 || idbResult.data.user_profile) {
      return idbResult;
    }
  }

  // 2. Check secondary localStorage mirror
  const lsBackup = getSecureStorage(`invocentric_backup_db_${userId}`, null);
  const lsMeta = getSecureStorage(`invocentric_backup_metadata_${userId}`, null);
  if (lsBackup) {
    const totalInLs = (lsBackup.invoices?.length || 0) + (lsBackup.customers?.length || 0) + (lsBackup.items?.length || 0);
    if (totalInLs > 0 || lsBackup.user_profile) {
      return {
        data: lsBackup,
        timestamp: lsMeta?.last_updated || new Date().toISOString(),
        metadata: lsMeta || {
          invoice_count: lsBackup.invoices?.length || 0,
          customer_count: lsBackup.customers?.length || 0,
          item_count: lsBackup.items?.length || 0
        }
      };
    }
  }

  return null;
}

// Export / download backup file directly as invocentric_backup_db.json
export function downloadBackupFile(userId: string, filename = 'invocentric_backup_db.json') {
  const data = packageAllLocalData(userId);
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Debounce helper to prevent multiple rapid file writes
let writeDebounceTimer: any = null;
export function triggerPcFileSyncDebounced(userId: string, handle: FileSystemFileHandle) {
  if (writeDebounceTimer) {
    clearTimeout(writeDebounceTimer);
  }
  writeDebounceTimer = setTimeout(async () => {
    try {
      await writeAllDataToPcFile(userId, handle);
      window.dispatchEvent(new Event('pc_file_write_success'));
      // Update automatic backup mirror
      updateAutomaticLocalBackup(userId).catch(console.error);
    } catch (e) {
      console.error("Background PC file sync failed:", e);
      window.dispatchEvent(new CustomEvent('pc_file_write_error', { detail: e }));
    }
  }, 1000); // 1-second debounce window
}
