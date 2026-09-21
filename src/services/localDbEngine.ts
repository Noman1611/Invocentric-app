import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      getVersion: () => Promise<string>;
      getAppPath: (name: string) => Promise<string>;
      saveLocalFile: (filename: string, content: any) => Promise<{ success: boolean; path?: string; error?: string }>;
      readLocalFile: (filename: string) => Promise<{ success: boolean; data?: string | null; error?: string }>;
      listLocalFiles: (dirName?: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
      printToPdf: (defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      printSilent: (options?: any) => Promise<{ success: boolean; failureReason?: string }>;
    };
  }
}

export interface LocalDbStats {
  invoicesCount: number;
  itemsCount: number;
  customersCount: number;
  expensesCount: number;
  purchasesCount: number;
  lastUpdated: string | null;
}

const COLLECTIONS = ['invoices', 'items', 'customers', 'expenses', 'purchases', 'quotations', 'payments', 'users', 'recycle_bin', 'settings'] as const;
type LocalCollection = typeof COLLECTIONS[number];

class LocalDbEngine {
  private memoryCache: Map<string, any[]> = new Map();
  private initialized: boolean = false;

  public isDesktop(): boolean {
    return Boolean(window.electronAPI?.isElectron);
  }

  // Read data from disk (Electron) or Local Storage
  public async getCollection<T = any>(collection: string): Promise<T[]> {
    if (this.memoryCache.has(collection)) {
      return this.memoryCache.get(collection) || [];
    }

    let records: T[] = [];

    if (this.isDesktop() && window.electronAPI?.readLocalFile) {
      try {
        const res = await window.electronAPI.readLocalFile(`${collection}.json`);
        if (res.success && res.data) {
          records = JSON.parse(res.data);
        }
      } catch (err) {
        console.warn(`[LocalDbEngine] Electron read failed for ${collection}, falling back:`, err);
      }
    }

    if (!records || records.length === 0) {
      records = getSecureStorage(`local_offline_${collection}`, []);
    }

    this.memoryCache.set(collection, records);
    return records;
  }

  // Save full collection to disk and memory
  private async persistCollection(collection: string, items: any[]): Promise<void> {
    this.memoryCache.set(collection, items);
    setSecureStorage(`local_offline_${collection}`, items);

    if (this.isDesktop() && window.electronAPI?.saveLocalFile) {
      try {
        await window.electronAPI.saveLocalFile(`${collection}.json`, items);
      } catch (err) {
        console.warn(`[LocalDbEngine] Electron save failed for ${collection}:`, err);
      }
    }

    // Trigger local storage event for cross-tab sync
    window.dispatchEvent(new CustomEvent('local_db_updated', { detail: { collection, count: items.length } }));
  }

  // Insert or Update an item
  public async saveItem<T extends { id?: string }>(collection: string, item: T): Promise<T & { id: string }> {
    const list = await this.getCollection(collection);
    const now = new Date().toISOString();

    const id = item.id || `${collection}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newItem: any = {
      ...item,
      id,
      updated_at: now,
      created_at: (item as any).created_at || now,
      _local_only: true
    };

    const index = list.findIndex(i => i.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...newItem };
    } else {
      list.unshift(newItem);
    }

    await this.persistCollection(collection, list);
    return newItem;
  }

  // Delete an item
  public async deleteItem(collection: string, id: string, permanent: boolean = false): Promise<boolean> {
    const list = await this.getCollection(collection);
    const itemToDelete = list.find(i => i.id === id);
    if (!itemToDelete) return false;

    const remaining = list.filter(i => i.id !== id);
    await this.persistCollection(collection, remaining);

    // Soft delete: move to recycle bin if not permanent
    if (!permanent && collection !== 'recycle_bin') {
      const binItem = {
        ...itemToDelete,
        _original_collection: collection,
        deleted_at: new Date().toISOString()
      };
      await this.saveItem('recycle_bin', binItem);
    }

    return true;
  }

  // Export full local database to a JSON backup
  public async exportAllData(): Promise<string> {
    const exportBundle: Record<string, any[]> = {};
    for (const col of COLLECTIONS) {
      exportBundle[col] = await this.getCollection(col);
    }
    return JSON.stringify({
      version: '1.0',
      exported_at: new Date().toISOString(),
      app: 'InvoCentric Local Edition',
      data: exportBundle
    }, null, 2);
  }

  // Import full local database from JSON
  public async importAllData(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed.data || parsed;
      for (const col of COLLECTIONS) {
        if (Array.isArray(data[col])) {
          await this.persistCollection(col, data[col]);
        }
      }
      return true;
    } catch (err) {
      console.error('[LocalDbEngine] Import failed:', err);
      return false;
    }
  }

  // Get local statistics
  public async getStats(): Promise<LocalDbStats> {
    const invoices = await this.getCollection('invoices');
    const items = await this.getCollection('items');
    const customers = await this.getCollection('customers');
    const expenses = await this.getCollection('expenses');
    const purchases = await this.getCollection('purchases');

    return {
      invoicesCount: invoices.length,
      itemsCount: items.length,
      customersCount: customers.length,
      expensesCount: expenses.length,
      purchasesCount: purchases.length,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const localDbEngine = new LocalDbEngine();
