
import { Transaction, RecurringRule } from '../types';

const DB_NAME = 'FinanceFlowDB';
const DB_VERSION = 15; // Bumped for Wankendorfer Refund
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
                }

                // Recurring Rules Store
                if (!db.objectStoreNames.contains(STORE_RULES)) {
                    const ruleStore = db.createObjectStore(STORE_RULES, { keyPath: 'id' });
                    ruleStore.createIndex('active', 'active', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                await this.seedInitialRules();
                await this.processRecurringRules();
                await this.runMigrations(); // Fix specific user requests
                resolve();
            };
        });
    }

    // Migration to fix specific data requests
    private async runMigrations(): Promise<void> {
        if (!this.db) return;
        
        const txs = await this.getAllTransactions();
        const rules = await this.getAllRules();
        const transaction = this.db.transaction([STORE_TRANSACTIONS, STORE_RULES], 'readwrite');
        const txStore = transaction.objectStore(STORE_TRANSACTIONS);
        const ruleStore = transaction.objectStore(STORE_RULES);

        // 1. Fix Joyn & RTL PLUS for Nov 2025 (Set amount to 0, status completed)
        const billsToZero = txs.filter(t => 
            (t.category === 'Joyn' || t.category === 'RTL PLUS') && 
            t.date.startsWith('2025-11') &&
            t.amount > 0 
        );

        billsToZero.forEach(tx => {
            console.log(`Migrating ${tx.category}: Setting amount to 0 and completed.`);
            tx.amount = 0;
            tx.status = 'completed';
            tx.note = (tx.note || '') + ' (Bereits im Startsaldo)';
            txStore.put(tx);
        });

        // 2. Fix "Geschenke": Remove Rule, Ensure One-Time Transaction on 29.11.2025
        const giftRule = rules.find(r => r.category === 'Geschenke');
        if (giftRule) {
            console.log("Deleting recurring rule for Geschenke");
            ruleStore.delete(giftRule.id);
        }

        const giftTx = txs.find(t => t.category === 'Geschenke' && t.date.startsWith('2025-11'));
        if (giftTx) {
            // Update existing generated transaction
            console.log("Updating Geschenke transaction to 29.11.2025");
            giftTx.date = '2025-11-29';
            giftTx.isRecurring = false;
            delete giftTx.recurringId;
            txStore.put(giftTx);
        } else {
            // Only create if we haven't already processed it in a way that implies it exists
            const existingOneTime = txs.find(t => t.category === 'Geschenke' && t.date === '2025-11-29');
            if (!existingOneTime) {
                 const newGiftTx: Transaction = {
                    id: crypto.randomUUID(),
                    date: '2025-11-29',
                    amount: 25.00,
                    type: 'expense',
                    category: 'Geschenke',
                    note: 'Weihnachten/Geburtstag',
                    method: 'digital',
                    account: 'bank',
                    status: 'pending',
                    isRecurring: false,
                    createdAt: Date.now()
                };
                txStore.add(newGiftTx);
                // Important: Push to memory array so subsequent balance checks in this migration see it
                txs.push(newGiftTx);
            }
        }

        // 3. Fix Startsaldo (Correction +100 EUR)
        const startTx = txs.find(t => t.category === 'Startsaldo');
        // Ensure we haven't already applied this specific fix to this transaction
        if (startTx && !startTx.note.includes('KorrV13')) {
            console.log("Migrating Startsaldo: Reducing expense by 100 to correct balance.");
            if (startTx.type === 'expense') {
                startTx.amount = Math.max(0, startTx.amount - 100);
            } else {
                startTx.amount += 100;
            }
            startTx.note = (startTx.note || '') + ' (KorrV13)';
            txStore.put(startTx);
        }

        // 5. Add Wankendorfer Eutin Refund (Apr 2026)
        const refundTx = txs.find(t => t.category === 'Rückzahlung Genossenschaft' && t.date.startsWith('2026-04'));
        if (!refundTx) {
            console.log("Adding Wankendorfer refund transaction");
            const newTx: Transaction = {
                id: crypto.randomUUID(),
                date: '2026-04-01',
                amount: 750.00,
                type: 'income',
                category: 'Rückzahlung Genossenschaft',
                note: 'Wankendorfer Eutin',
                method: 'digital',
                account: 'bank',
                status: 'pending',
                isRecurring: false,
                createdAt: Date.now()
            };
            txStore.add(newTx);
            txs.push(newTx);
        }

        // 4. Force Balance to -1399.61 (User Request V14)
        // We recalculate the balance based on the current state of 'txs' (which includes in-memory updates from steps 1-3)
        // and adjust 'Startsaldo' to perfectly match the target.
        const TARGET_BALANCE = -1399.61;
        let currentBalance = 0;
        
        txs.forEach(t => {
            if (t.status === 'completed' && t.account === 'bank') {
                if (t.type === 'income') currentBalance += t.amount;
                else currentBalance -= t.amount;
            }
        });

        const diff = TARGET_BALANCE - currentBalance;

        // Apply correction if difference is significant
        if (Math.abs(diff) > 0.001 && startTx) {
             console.log(`Migrating Balance V14: Correction from ${currentBalance} to ${TARGET_BALANCE} (Diff: ${diff})`);
             
             // Current contribution of Startsaldo
             const currentStartVal = startTx.type === 'income' ? startTx.amount : -startTx.amount;
             const newStartVal = currentStartVal + diff;
             
             startTx.amount = Math.abs(newStartVal);
             startTx.type = newStartVal >= 0 ? 'income' : 'expense';
             // We do not append a note here to keep it clean as requested, or just a small flag
             // user requested "sonst NICHTS", so we change values only.
             
             txStore.put(startTx);
        }

        return new Promise((resolve) => {
            transaction.oncomplete = () => resolve();
        });
    }

    private async seedInitialRules(): Promise<void> {
        if (!this.db) return;
        
        const rulesCount = await this.countRules();
        if (rulesCount > 0) return; // Already seeded

        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // 1. Initial Balances 
        await this.addTransaction({
            id: crypto.randomUUID(),
            date: `${currentMonthPrefix}-01`,
            amount: 1109.36, // Adjusted from 1209.36 for +100 correction
            type: 'expense', 
            category: 'Startsaldo',
            note: 'Übertrag aus Vormonat (Soll)',
            method: 'digital',
            account: 'bank',
            status: 'completed',
            isRecurring: false,
            createdAt: Date.now()
        });

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

        // 2. Specific Pot Spending
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

        // 3. Define Recurring Rules
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
            
            // Note: Geschenke removed from here, handled in runMigrations/manual add

            // Debt Repayment (Inactive by default)
            { type: 'expense', category: 'Rückzahlung Mama', amount: 50.00, note: 'Schuldenabbau', method: 'digital', account: 'bank', frequency: 'monthly', dayOfMonth: 1, active: false },
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

            // SPECIAL LOGIC: SKIP TEDi Gehalt for November 2025
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

    async updateRule(rule: RecurringRule): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_RULES], 'readwrite');
            const store = transaction.objectStore(STORE_RULES);
            const request = store.put(rule);
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
