
export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'digital';
export type TransactionStatus = 'pending' | 'completed';
export type AccountType = 'bank' | 'cash';
export type RecurrenceFrequency = 'monthly';

export interface Transaction {
    id: string;
    date: string; // ISO string YYYY-MM-DD
    amount: number;
    type: TransactionType;
    category: string;
    note: string;
    method: PaymentMethod;
    account: AccountType; // New field
    status: TransactionStatus;
    isRecurring: boolean;
    recurringId?: string;
    createdAt: number;
}

export interface RecurringRule {
    id: string;
    type: TransactionType;
    category: string;
    amount: number;
    note: string;
    method: PaymentMethod;
    account: AccountType; // New field
    frequency: RecurrenceFrequency;
    dayOfMonth: number;
    active: boolean;
    createdAt: number;
}

export interface PotConfig {
    id: string; // e.g., 'pot_420_2025-11' or 'pot_420_default'
    potId: string;
    limit: number;
    month?: string; // YYYY-MM or undefined for default
}

export enum AppView {
    DASHBOARD = 'DASHBOARD',
    TRANSACTIONS = 'TRANSACTIONS',
    ADD = 'ADD',
    SETTINGS = 'SETTINGS'
}

export interface DashboardStats {
    bankBalance: number;
    cashBalance: number;
    projectedBalance: number;
    income: number;
    expense: number;
}
