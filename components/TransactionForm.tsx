import React, { useState } from 'react';
import { TransactionType, Transaction } from '../types';
import { PlusCircle, Loader2 } from 'lucide-react';

interface TransactionFormProps {
    onSubmit: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
    onCancel: () => void;
}

const CATEGORIES = [
    'Food', 'Groceries', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 
    'Health', 'Education', 'Salary', 'Freelance', 'Investment', 'Other'
];

const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, onCancel }) => {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('expense');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount))) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                amount: parseFloat(amount),
                type,
                category,
                date,
                note
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto pb-20 md:pb-0">
             <h1 className="text-2xl font-bold text-white mb-6">Add Transaction</h1>
             
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
                        Expense
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('income')}
                        className={`py-2 rounded-md text-sm font-medium transition-colors ${
                            type === 'income' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Income
                    </button>
                </div>

                {/* Amount */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Amount ($)</label>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
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
                        <label className="block text-sm font-medium text-slate-400 mb-2">Date</label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Note */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Note (Optional)</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="What was this for?"
                    />
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <PlusCircle className="w-4 h-4" />
                                Add Transaction
                            </>
                        )}
                    </button>
                </div>
             </form>
        </div>
    );
};

export default TransactionForm;