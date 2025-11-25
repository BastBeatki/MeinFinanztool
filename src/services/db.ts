
// IMPORTANT: Extension .ts added for No-Build compatibility
import { Transaction } from '../types.ts';

const DB_NAME = 'FinanceFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

// Seed data
const SEED_DATA: Omit<Transaction, 'id'>[] = [
    { date: new Date().toISOString().split('T')[0], amount: 2500, type: 'income', category: 'Gehalt', note: 'Monatsgehalt', createdAt: Date.now() - 100000, paymentMethod: 'digital', recurrence: 'monthly' },
    { date: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0], amount: 45.50, type: 'expense', category: 'Lebensmittel', note: 'Wocheneinkauf', createdAt: Date.now() - 200000, paymentMethod: 'cash', recurrence: 'none' },
    { date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString().split('T')[0], amount: 35.00, type: 'expense', category: 'Tanken', note: 'Benzin', createdAt: Date.now() - 300000, paymentMethod: 'digital', recurrence: 'none' },
    { date: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString().split('T')[0], amount: 15.00, type: 'expense', category: 'Transport', note: 'Uber', createdAt: Date.now() - 400000, paymentMethod: 'digital', recurrence: 'none' },
    { date: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString().split('T')[0], amount: 300, type: 'income', category: 'Freelance', note: 'Logo Design', createdAt: Date.now() - 500000, paymentMethod: 'digital', recurrence: 'none' },
];

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
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    objectStore.createIndex('date', 'date', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                await this.checkAndSeed();
                resolve();
            };
        });
    }

    private async checkAndSeed(): Promise<void> {
        const count = await this.getCount();
        if (count === 0) {
            console.log("Database empty. Seeding initial data...");
            for (const item of SEED_DATA) {
                await this.addTransaction({
                    ...item,
                    id: crypto.randomUUID()
                } as Transaction);
            }
        }
    }

    private getCount(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllTransactions(): Promise<Transaction[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by date desc in memory for simplicity
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
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(tx);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTransaction(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll(): Promise<void> {
         return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async importData(data: Transaction[]): Promise<void> {
        await this.clearAll();
        for (const item of data) {
            await this.addTransaction(item);
        }
    }
}

export const dbService = new DBService();
