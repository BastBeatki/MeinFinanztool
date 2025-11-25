export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'digital';
export type TransactionStatus = 'pending' | 'completed';
export type RecurrenceFrequency = 'monthly'; // Extendable later

export interface Transaction {
    id: string;
    date: string; // ISO string YYYY-MM-DD
    amount: number;
    type: TransactionType;
    category: string;
    note: string;
    method: PaymentMethod;
    status: TransactionStatus;
    isRecurring: boolean;
    recurringId?: string; // Links specific instance to the rule
    createdAt: number;
}

export interface RecurringRule {
    id: string;
    type: TransactionType;
    category: string;
    amount: number;
    note: string;
    method: PaymentMethod;
    frequency: RecurrenceFrequency;
    dayOfMonth: number; // 1-31
    active: boolean;
    createdAt: number;
}

export enum AppView {
    DASHBOARD = 'DASHBOARD',
    TRANSACTIONS = 'TRANSACTIONS',
    ADD = 'ADD',
    SETTINGS = 'SETTINGS'
}

export interface DashboardStats {
    totalBalance: number;
    income: number;
    expense: number;
    projectedBalance?: number; // For monthly view
}