
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
                await this.seedInitialRules(); // Load user's CSV logic
                await this.processRecurringRules(); // Check and generate monthly items
                resolve();
            };
        });
    }

    // Seeds the database with the user's specific CSV data structure
    private async seedInitialRules(): Promise<void> {
        if (!this.db) return;
        
        const rulesCount = await this.countRules();
        if (rulesCount > 0) return; // Already seeded

        const initialRules: Omit<RecurringRule, 'id' | 'createdAt'>[] = [
            // Income
            { type: 'income', category: 'Bürgergeld', amount: 363.00, note: 'Ende des Monats (Minijobs)', method: 'digital', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'income', category: 'Gehalt Reporter', amount: 170.89, note: 'Ende des Monats (Variabel)', method: 'digital', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'income', category: 'Gehalt TEDi', amount: 350.00, note: 'Mitte des Monats', method: 'digital', frequency: 'monthly', dayOfMonth: 15, active: true },
            
            // Fixed Expenses
            { type: 'expense', category: 'Miete/Essen', amount: 227.00, note: 'Abgabe an MAMA', method: 'digital', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'O2 Vertrag', amount: 59.00, note: 'Ende des Monats', method: 'digital', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'expense', category: 'iPhone 13 Pro', amount: 26.25, note: 'Rate bis 28.8.2026', method: 'digital', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'iPhone 16 Pro', amount: 37.00, note: 'Rate bis 28.7.2028', method: 'digital', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'Spotify', amount: 10.99, note: 'Ende des Monats', method: 'digital', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'expense', category: 'Entgeltabrechnung', amount: 9.95, note: 'Ende des Monats', method: 'digital', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'expense', category: 'Joyn', amount: 6.99, note: 'Mitte des Monats', method: 'digital', frequency: 'monthly', dayOfMonth: 15, active: true },
            { type: 'expense', category: 'RTL PLUS', amount: 7.99, note: 'Ca. 20.-23.', method: 'digital', frequency: 'monthly', dayOfMonth: 21, active: true },
            
            // Variable Budgets (The "Pots")
            { type: 'expense', category: 'Lebensmittel', amount: 150.00, note: 'Budget (420)', method: 'cash', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'Wochenende', amount: 120.00, note: 'Geld zum Leben für Wochenende', method: 'cash', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'Wochentage', amount: 120.00, note: 'Geld zum Leben (Mo-Fr)', method: 'cash', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'Rauchen', amount: 40.00, note: 'Monatsbudget', method: 'cash', frequency: 'monthly', dayOfMonth: 1, active: true },
            
            // Yearly
             { type: 'expense', category: 'Versicherung', amount: 40.00, note: 'Signal IDUNA (Nur Januar)', method: 'digital', frequency: 'monthly', dayOfMonth: 15, active: false }, // Set active:false initially, logic to enable in Jan could be added
        ];

        for (const rule of initialRules) {
            await this.addRule({
                ...rule,
                id: crypto.randomUUID(),
                createdAt: Date.now()
            } as RecurringRule);
        }

        // Add an initial balance correction transaction to match CSV start
        await this.addTransaction({
            id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            amount: 1399.69,
            type: 'income',
            category: 'Startguthaben',
            note: 'Übertrag aus Vormonat',
            method: 'digital',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });
    }

    private async countRules(): Promise<number> {
        return new Promise((resolve) => {
            if (!this.db) return resolve(0);
            const transaction = this.db.transaction([STORE_RULES], 'readonly');
            const store = transaction.objectStore(STORE_RULES);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
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
