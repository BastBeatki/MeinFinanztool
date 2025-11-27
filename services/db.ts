
import { Transaction, RecurringRule } from '../types';

const DB_NAME = 'FinanceFlowDB';
const DB_VERSION = 9; // Incremented to trigger re-seed with new specific pot data
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
                    const txStore = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_TRANSACTIONS);
                    txStore?.clear();
                }

                // Recurring Rules Store
                if (!db.objectStoreNames.contains(STORE_RULES)) {
                    const ruleStore = db.createObjectStore(STORE_RULES, { keyPath: 'id' });
                    ruleStore.createIndex('active', 'active', { unique: false });
                } else {
                     const ruleStore = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_RULES);
                     ruleStore?.clear();
                }
            };

            request.onsuccess = async (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                await this.seedInitialRules();
                await this.processRecurringRules();
                resolve();
            };
        });
    }

    private async seedInitialRules(): Promise<void> {
        if (!this.db) return;
        
        const rulesCount = await this.countRules();
        if (rulesCount > 0) return; // Already seeded

        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // 1. Initial Balances 
        // BANK CALCULATION LOGIC:
        // Target Current Balance: -1499.61
        // Already Paid Items in DB (deducted by processRecurringRules or manually below):
        // - Mama: 227.00
        // - iPhone 13: 26.25
        // - iPhone 16: 37.00
        // Total Paid fixed costs: 290.25
        // Start Balance = -1499.61 + 290.25 = -1209.36
        
        await this.addTransaction({
            id: crypto.randomUUID(),
            date: `${currentMonthPrefix}-01`,
            amount: 1209.36, 
            type: 'expense', 
            category: 'Startsaldo',
            note: 'Übertrag aus Vormonat (Soll)',
            method: 'digital',
            account: 'bank',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });

        // CASH CALCULATION LOGIC:
        // Target Remaining Cash: 200.00
        // Pot Expenses to be added below:
        // - Wochenende: 95.00
        // - Wochentage: 120.00
        // - Rauchen: 35.00
        // Total Expenses = 250.00
        // Start Cash needed = 200.00 + 250.00 = 450.00

        await this.addTransaction({
            id: crypto.randomUUID(),
            date: `${currentMonthPrefix}-01`,
            amount: 450.00,
            type: 'income',
            category: 'Bargeld-Start',
            note: 'Initiale Einlage (berechnet)',
            method: 'cash',
            account: 'cash',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });

        // 2. Specific Pot Spending (User Request)
        // Wochenende: Limit 120 -> Remaining 25 -> Spent 95
        await this.addTransaction({
            id: crypto.randomUUID(),
            date: `${currentMonthPrefix}-02`,
            amount: 95.00,
            type: 'expense',
            category: 'Wochenende',
            note: 'Bisherige Ausgaben',
            method: 'cash',
            account: 'cash',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });

        // Wochentage: Limit 120 -> Remaining 0 -> Spent 120
        await this.addTransaction({
            id: crypto.randomUUID(),
            date: `${currentMonthPrefix}-03`,
            amount: 120.00,
            type: 'expense',
            category: 'Wochentage',
            note: 'Bisherige Ausgaben',
            method: 'cash',
            account: 'cash',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });

        // Rauchen: Limit 40 -> Remaining 5 -> Spent 35
        await this.addTransaction({
            id: crypto.randomUUID(),
            date: `${currentMonthPrefix}-04`,
            amount: 35.00,
            type: 'expense',
            category: 'Rauchen',
            note: 'Bisherige Ausgaben',
            method: 'cash',
            account: 'cash',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });

        // 3. Define Recurring Rules (Fixed Costs Only)
        const initialRules: Omit<RecurringRule, 'id' | 'createdAt'>[] = [
            // Income
            { type: 'income', category: 'Bürgergeld', amount: 363.00, note: 'Ende des Monats', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'income', category: 'Gehalt Reporter', amount: 170.89, note: 'Variabel', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'income', category: 'Gehalt TEDi', amount: 350.00, note: 'Mitte des Monats', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 15, active: true },
            
            // Fixed Expenses (Bank)
            { type: 'expense', category: 'Abgabe Mama', amount: 227.00, note: 'Miete/Essen', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'O2 Vertrag', amount: 59.00, note: 'Ende des Monats', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'expense', category: 'iPhone 13 Pro', amount: 26.25, note: 'Rate bis 28.8.2026', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'iPhone 16 Pro', amount: 37.00, note: 'Rate bis 28.7.2028', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 1, active: true },
            { type: 'expense', category: 'Spotify', amount: 10.99, note: 'Ende des Monats', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'expense', category: 'Entgeltabrechnung', amount: 9.95, note: 'Ende des Monats', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 28, active: true },
            { type: 'expense', category: 'Joyn', amount: 6.99, note: 'Mitte des Monats', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 15, active: true },
            { type: 'expense', category: 'RTL PLUS', amount: 7.99, note: 'Ca. 20.-23.', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 21, active: true },
            { type: 'expense', category: 'Versicherung', amount: 40.00, note: 'Signal IDUNA (Januar)', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 15, active: false }, 
            
            // Special Annual/One-offs
            { type: 'expense', category: 'Geschenke', amount: 25.00, note: 'Weihnachten/Geburtstag', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 1, active: true },
        ];

        for (const rule of initialRules) {
            await this.addRule({
                ...rule,
                id: crypto.randomUUID(),
                createdAt: Date.now()
            } as RecurringRule);
        }
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

    private async processRecurringRules(): Promise<void> {
        if (!this.db) return;
        
        const rules = await this.getAllRules();
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const allTx = await this.getAllTransactions();
        
        for (const rule of rules) {
            if (!rule.active) continue;

            // SPECIAL LOGIC: SKIP TEDi Gehalt for November 2025 (already received)
            if (rule.category === 'Gehalt TEDi' && currentMonthStr === '2025-11') {
                continue;
            }

            const exists = allTx.some(tx => 
                tx.recurringId === rule.id && 
                tx.date.startsWith(currentMonthStr)
            );

            if (!exists) {
                const targetDay = Math.min(rule.dayOfMonth, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
                const dateStr = `${currentMonthStr}-${String(targetDay).padStart(2, '0')}`;

                // Specific Logic for user request:
                // Mama, iPhone 13, iPhone 16 are ALREADY PAID (Completed)
                const isPrePaid = ['Abgabe Mama', 'iPhone 13 Pro', 'iPhone 16 Pro'].includes(rule.category);

                const newTx: Transaction = {
                    id: crypto.randomUUID(),
                    date: dateStr,
                    amount: rule.amount,
                    type: rule.type,
                    category: rule.category,
                    note: rule.note,
                    method: rule.method,
                    account: rule.account,
                    status: isPrePaid ? 'completed' : 'pending', 
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

    async importData(data: Transaction[]): Promise<void> {
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
