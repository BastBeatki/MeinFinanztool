import { Transaction, RecurringRule } from '../types';

const DB_NAME = 'FinanceFlowDB';
const DB_VERSION = 2; // Incremented for schema changes
const STORE_TRANSACTIONS = 'transactions';
const STORE_RULES = 'recurring_rules';

export class DBService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event);
                reject("Could not open database");
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                // Transactions Store
                if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
                    const txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
                    txStore.createIndex('date', 'date', { unique: false });
                } else {
                    // Migration logic for V2 if needed (simple app: we assume fresh or compatible)
                    const txStore = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_TRANSACTIONS);
                    // Ensure indexes exist if upgrading
                    if (txStore && !txStore.indexNames.contains('date')) {
                        txStore.createIndex('date', 'date', { unique: false });
                    }
                }

                // Recurring Rules Store
                if (!db.objectStoreNames.contains(STORE_RULES)) {
                    const ruleStore = db.createObjectStore(STORE_RULES, { keyPath: 'id' });
                    ruleStore.createIndex('active', 'active', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                await this.processRecurringRules(); // Check and generate monthly items
                resolve();
            };
        });
    }

    // Checks recurring rules and creates transactions for the current month if they don't exist
    private async processRecurringRules(): Promise<void> {
        if (!this.db) return;
        
        const rules = await this.getAllRules();
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        
        // Get all transactions for this month to check against
        // Optimized: just get all and filter in memory for this simple app
        const allTx = await this.getAllTransactions();
        
        for (const rule of rules) {
            if (!rule.active) continue;

            // Check if a transaction for this rule exists in the current month
            const exists = allTx.some(tx => 
                tx.recurringId === rule.id && 
                tx.date.startsWith(currentMonthStr)
            );

            if (!exists) {
                // Create the pending transaction
                // Handle day of month overflow (e.g. Feb 30th -> Feb 28th)
                const targetDay = Math.min(rule.dayOfMonth, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
                const dateStr = `${currentMonthStr}-${String(targetDay).padStart(2, '0')}`;

                const newTx: Transaction = {
                    id: crypto.randomUUID(),
                    date: dateStr,
                    amount: rule.amount,
                    type: rule.type,
                    category: rule.category,
                    note: rule.note + ' (Automatisch erstellt)',
                    method: rule.method,
                    status: 'pending', // Default to pending so user has to check it
                    isRecurring: true,
                    recurringId: rule.id,
                    createdAt: Date.now()
                };
                await this.addTransaction(newTx);
            }
        }
    }

    async getAllRules(): Promise<RecurringRule[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_RULES], 'readonly');
            const store = transaction.objectStore(STORE_RULES);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addRule(rule: RecurringRule): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_RULES], 'readwrite');
            const store = transaction.objectStore(STORE_RULES);
            const request = store.add(rule);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllTransactions(): Promise<Transaction[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_TRANSACTIONS], 'readonly');
            const store = transaction.objectStore(STORE_TRANSACTIONS);
            const request = store.getAll();

            request.onsuccess = () => {
                const result = request.result as Transaction[];
                // Sort by date desc
                result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                resolve(result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async addTransaction(tx: Transaction): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_TRANSACTIONS], 'readwrite');
            const store = transaction.objectStore(STORE_TRANSACTIONS);
            const request = store.add(tx);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async updateTransaction(tx: Transaction): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_TRANSACTIONS], 'readwrite');
            const store = transaction.objectStore(STORE_TRANSACTIONS);
            const request = store.put(tx);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTransaction(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_TRANSACTIONS], 'readwrite');
            const store = transaction.objectStore(STORE_TRANSACTIONS);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll(): Promise<void> {
         return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_TRANSACTIONS, STORE_RULES], 'readwrite');
            transaction.objectStore(STORE_TRANSACTIONS).clear();
            transaction.objectStore(STORE_RULES).clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async importData(data: Transaction[]): Promise<void> {
        // Simple import for transactions only right now
        const transaction = this.db!.transaction([STORE_TRANSACTIONS], 'readwrite');
        const store = transaction.objectStore(STORE_TRANSACTIONS);
        store.clear();
        for (const item of data) {
            store.add(item);
        }
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

export const dbService = new DBService();