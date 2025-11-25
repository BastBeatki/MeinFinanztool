import React from 'react';
import { Transaction } from '../types';
import { Trash2, ArrowUpRight, ArrowDownLeft, Search, CreditCard, Banknote, Repeat, CheckSquare, Square } from 'lucide-react';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
    onUpdate: (tx: Transaction) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onUpdate }) => {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('de-DE', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const toggleStatus = (tx: Transaction) => {
        const newStatus = tx.status === 'completed' ? 'pending' : 'completed';
        onUpdate({ ...tx, status: newStatus });
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Transaktionen</h1>
                <span className="text-slate-400 text-sm">{transactions.length} Einträge</span>
            </div>

            {transactions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p>Keine Transaktionen gefunden.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {transactions.map((tx) => {
                        const isPending = tx.status === 'pending';
                        
                        return (
                            <div 
                                key={tx.id} 
                                className={`p-4 rounded-xl border flex items-center justify-between group transition-all ${
                                    isPending 
                                        ? 'bg-slate-900/50 border-slate-800 opacity-75 hover:opacity-100' 
                                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Status Toggle for Recurring items */}
                                    <button 
                                        onClick={() => toggleStatus(tx)}
                                        className={`p-1 rounded transition-colors ${
                                            isPending ? 'text-slate-600 hover:text-blue-400' : 'text-blue-500'
                                        }`}
                                        title={isPending ? "Als bezahlt markieren" : "Als offen markieren"}
                                    >
                                        {isPending ? <Square className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
                                    </button>

                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center relative ${
                                        tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                        
                                        {/* Method Icon Badge */}
                                        <div className="absolute -bottom-1 -right-1 bg-slate-800 rounded-full p-0.5 border border-slate-700">
                                            {tx.method === 'cash' 
                                                ? <Banknote className="w-3 h-3 text-slate-400" /> 
                                                : <CreditCard className="w-3 h-3 text-slate-400" />
                                            }
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium ${isPending ? 'text-slate-400' : 'text-white'}`}>
                                                {tx.category}
                                            </p>
                                            {tx.isRecurring && (
                                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                                    Fix
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">{formatDate(tx.date)}</span>
                                            {tx.note && <span className="text-xs text-slate-500 hidden md:inline">• {tx.note}</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <span className={`font-semibold ${
                                        isPending 
                                            ? 'text-slate-500' 
                                            : (tx.type === 'income' ? 'text-green-400' : 'text-slate-100')
                                    }`}>
                                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </span>
                                    <button 
                                        onClick={() => onDelete(tx.id)}
                                        className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                                        aria-label="Transaktion löschen"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TransactionList;