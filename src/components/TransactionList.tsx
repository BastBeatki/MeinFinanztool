import React from 'react';
// IMPORTANT: Extension .ts added for No-Build compatibility
import { Transaction } from '../types.ts';
import { Trash2, ArrowUpRight, ArrowDownLeft, Search } from 'lucide-react';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete }) => {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Transactions</h1>
                <span className="text-slate-400 text-sm">{transactions.length} entries</span>
            </div>

            {transactions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p>No transactions found.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                    {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="font-medium text-white">{tx.category}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400">{formatDate(tx.date)}</span>
                                        {tx.note && <span className="text-xs text-slate-500">• {tx.note}</span>}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <span className={`font-semibold ${tx.type === 'income' ? 'text-green-400' : 'text-slate-100'}`}>
                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </span>
                                <button 
                                    onClick={() => onDelete(tx.id)}
                                    className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                                    aria-label="Delete transaction"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TransactionList;