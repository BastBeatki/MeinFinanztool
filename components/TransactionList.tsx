
import React, { useState } from 'react';
import { Transaction } from '../types';
import { Trash2, ArrowUpRight, ArrowDownLeft, Search, Landmark, Coins, CheckSquare, Square, Edit2, X, Check } from 'lucide-react';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
    onUpdate: (tx: Transaction) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onUpdate }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
    };

    const toggleStatus = (tx: Transaction) => {
        const newStatus = tx.status === 'completed' ? 'pending' : 'completed';
        onUpdate({ ...tx, status: newStatus });
    };

    const startEdit = (tx: Transaction) => {
        setEditingId(tx.id);
        setEditAmount(tx.amount.toString());
        setEditDate(tx.date);
    };

    const saveEdit = (tx: Transaction) => {
        const num = parseFloat(editAmount);
        if (!isNaN(num) && editDate) {
            onUpdate({ ...tx, amount: num, date: editDate });
        }
        setEditingId(null);
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
                        const isEditing = editingId === tx.id;
                        
                        return (
                            <div 
                                key={tx.id} 
                                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all ${
                                    isPending 
                                        ? 'bg-slate-900/50 border-slate-800 opacity-80 hover:opacity-100' 
                                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Status Toggle (The "X") */}
                                    <button 
                                        onClick={() => toggleStatus(tx)}
                                        className={`p-1 rounded transition-colors ${
                                            isPending ? 'text-slate-500 hover:text-blue-400' : 'text-blue-500'
                                        }`}
                                        title={isPending ? "Noch offen (X entfernen)" : "Erledigt (X setzen)"}
                                    >
                                        {isPending ? <Square className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
                                    </button>

                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center relative ${
                                        tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                        
                                        {/* Account Badge */}
                                        <div className="absolute -bottom-1 -right-1 bg-slate-800 rounded-full p-0.5 border border-slate-700">
                                            {tx.account === 'cash' 
                                                ? <Coins className="w-3 h-3 text-emerald-400" /> 
                                                : <Landmark className="w-3 h-3 text-blue-400" />
                                            }
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium ${isPending ? 'text-slate-400' : 'text-white'}`}>
                                                {tx.category}
                                            </p>
                                            {isPending && (
                                                <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-bold">
                                                    OFFEN (X)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isEditing ? (
                                                <input 
                                                    type="date"
                                                    value={editDate}
                                                    onChange={(e) => setEditDate(e.target.value)}
                                                    className="bg-slate-950 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-300"
                                                />
                                            ) : (
                                                <span className="text-xs text-slate-400">{formatDate(tx.date)}</span>
                                            )}
                                            {tx.note && <span className="text-xs text-slate-500 hidden md:inline">• {tx.note}</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={editAmount}
                                                onChange={(e) => setEditAmount(e.target.value)}
                                                className="w-20 bg-slate-950 border border-slate-600 rounded px-2 py-1 text-sm text-right text-white"
                                            />
                                            <button onClick={() => saveEdit(tx)} className="text-green-400 hover:bg-slate-700 p-1 rounded"><Check className="w-4 h-4"/></button>
                                            <button onClick={() => setEditingId(null)} className="text-red-400 hover:bg-slate-700 p-1 rounded"><X className="w-4 h-4"/></button>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <span className={`font-semibold block ${
                                                isPending 
                                                    ? 'text-slate-500' 
                                                    : (tx.type === 'income' ? 'text-green-400' : 'text-slate-100')
                                            }`}>
                                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Action Menu */}
                                    <div className={`flex gap-1 ${isEditing ? 'hidden' : ''}`}>
                                        <button 
                                            onClick={() => startEdit(tx)}
                                            className="text-slate-500 hover:text-blue-400 p-2 rounded hover:bg-slate-700 transition-colors"
                                            title="Betrag/Datum anpassen"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={() => onDelete(tx.id)}
                                            className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-slate-700 transition-colors"
                                            title="Löschen"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
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
