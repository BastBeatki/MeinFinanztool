export type TransactionType = 'income' | 'expense';

export interface Transaction {
    id: string;
    date: string; // ISO string YYYY-MM-DD
    amount: number;
    type: TransactionType;
    category: string;
    note: string;
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
}