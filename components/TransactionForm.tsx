
import React, { useState } from 'react';
import { TransactionType, Transaction, AccountType, RecurringRule } from '../types';
import { PlusCircle, Loader2, Repeat, Landmark, Coins, CalendarDays } from 'lucide-react';

interface TransactionFormProps {
    onSubmit: (
        tx: Omit<Transaction, 'id' | 'createdAt'>, 
        rule?: Omit<RecurringRule, 'id' | 'createdAt' | 'active'>
    ) => Promise<void>;
    onCancel: () => void;
}

// Updated Categories based on Money Pots + Fixed Costs
const CATEGORIES = [
    // Money Pots
    '420', 
    'Wochenende', 
    'Wochentage', 
    'Rauchen', 
    
    // Fixed / Recurring
    'Miete', 
    'Essen', 
    'Lebensmittel', 
    'Abgabe Mama',
    'O2 Vertrag',
    'Spotify',
    'Joyn',
    'RTL PLUS',
    'iPhone Rate',
    
    // Income
    'Bürgergeld', 
    'Gehalt Reporter', 
    'Gehalt TEDi', 
    'Sonstiges'
];

const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, onCancel }) => {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('expense');
    const [category, setCategory] = useState(CATEGORIES[0]);
    // Date defaults to Today
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    
    const [account, setAccount] = useState<AccountType>('bank');
    const [isRecurring, setIsRecurring] = useState(false);
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount))) return;

        setIsSubmitting(true);
        try {
            const txData: Omit<Transaction, 'id' | 'createdAt'> = {
                amount: parseFloat(amount),
                type,
                category,
                date,
                note,
                method: account === 'cash' ? 'cash' : 'digital',
                account,
                // New entries are usually completed immediately unless explicitly recurring plan
                status: 'completed', 
                isRecurring,
            };

            let ruleData: Omit<RecurringRule, 'id' | 'createdAt' | 'active'> | undefined;

            if (isRecurring) {
                ruleData = {
                    type,
                    category,
                    amount: parseFloat(amount),
                    note,
                    method: account === 'cash' ? 'cash' : 'digital',
                    account,
                    frequency: 'monthly',
                    dayOfMonth: new Date(date).getDate(),
                };
            }

            await onSubmit(txData, ruleData);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper to set quick dates
    const setDateOffset = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        setDate(d.toISOString().split('T')[0]);
    };

    return (
        <div className="max-w-2xl mx-auto pb-20 md:pb-0">
             <h1 className="text-2xl font-bold text-white mb-6">Transaktion hinzufügen</h1>
             
             <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
                
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-4 p-1 bg-slate-900 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setType('expense')}
                        className={`py-2 rounded-md text-sm font-medium transition-colors ${
                            type === 'expense' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Ausgabe
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('income')}
                        className={`py-2 rounded-md text-sm font-medium transition-colors ${
                            type === 'income' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Einnahme
                    </button>
                </div>

                {/* Amount */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Betrag (€)</label>
                    <input
                        type="number"
                        step="0.01"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Account & Recurring Toggle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                         <label className="block text-sm font-medium text-slate-400 mb-2">Konto / Geldbörse</label>
                         <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setAccount('bank')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all ${
                                    account === 'bank' 
                                        ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <Landmark className="w-4 h-4" />
                                <span className="text-sm">Girokonto</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAccount('cash')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all ${
                                    account === 'cash' 
                                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <Coins className="w-4 h-4" />
                                <span className="text-sm">Bargeld</span>
                            </button>
                         </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Wiederholung</label>
                        <button
                            type="button"
                            onClick={() => setIsRecurring(!isRecurring)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                                isRecurring 
                                    ? 'bg-purple-600/20 border-purple-500 text-purple-400' 
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Repeat className="w-4 h-4" />
                                <span className="text-sm font-medium">Monatlich Fix</span>
                            </div>
                            <div className={`w-4 h-4 rounded-full border ${isRecurring ? 'bg-purple-500 border-purple-500' : 'border-slate-500'}`} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Kategorie / Topf</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Datum</label>
                        <div className="space-y-2">
                            <div className="relative">
                                <CalendarDays className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setDateOffset(-1)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded py-1 hover:bg-slate-800 text-slate-400">Gestern</button>
                                <button type="button" onClick={() => setDateOffset(0)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded py-1 hover:bg-slate-800 text-slate-400">Heute</button>
                                <button type="button" onClick={() => setDateOffset(1)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded py-1 hover:bg-slate-800 text-slate-400">Morgen</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Note */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Notiz (Optional)</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="Zusätzliche Infos..."
                    />
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Speichern...
                            </>
                        ) : (
                            <>
                                <PlusCircle className="w-4 h-4" />
                                Hinzufügen
                            </>
                        )}
                    </button>
                </div>
             </form>
        </div>
    );
};

export default TransactionForm;
