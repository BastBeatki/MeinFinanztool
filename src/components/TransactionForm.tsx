
import React, { useState } from 'react';
// IMPORTANT: Extension .ts added for No-Build compatibility
import { TransactionType, Transaction, PaymentMethod, RecurrenceInterval } from '../types.ts';
import { PlusCircle, Loader2, Repeat, Banknote, CreditCard } from 'lucide-react';

interface TransactionFormProps {
    onSubmit: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
    onCancel: () => void;
}

const CATEGORIES = [
    'Lebensmittel', 'Gehalt', 'Miete', 'Transport', 'Freizeit', 'Shopping', 
    'Gesundheit', 'Bildung', 'Freelance', 'Investition', 'Versicherung', 'Sonstiges'
];

const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, onCancel }) => {
    // Basic
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('expense');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    
    // Advanced
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('digital');
    const [recurrence, setRecurrence] = useState<RecurrenceInterval>('none');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

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
                note,
                paymentMethod,
                recurrence,
                recurrenceEndDate: recurrence !== 'none' ? recurrenceEndDate : undefined
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto pb-20 md:pb-0">
             <h1 className="text-2xl font-bold text-white mb-6">Neuer Eintrag</h1>
             
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Kategorie</label>
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
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Payment Method */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Zahlungsmethode</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${paymentMethod === 'cash' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                            <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="hidden" />
                            <Banknote className="w-5 h-5" />
                            <span>Bar</span>
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${paymentMethod === 'digital' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                            <input type="radio" name="payment" value="digital" checked={paymentMethod === 'digital'} onChange={() => setPaymentMethod('digital')} className="hidden" />
                            <CreditCard className="w-5 h-5" />
                            <span>Digital / Karte</span>
                        </label>
                    </div>
                </div>

                {/* Recurrence */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                        <Repeat className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-medium text-white">Wiederholung</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Rhythmus</label>
                            <select
                                value={recurrence}
                                onChange={(e) => setRecurrence(e.target.value as RecurrenceInterval)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="none">Einmalig</option>
                                <option value="daily">Täglich</option>
                                <option value="weekly">Wöchentlich</option>
                                <option value="monthly">Monatlich</option>
                                <option value="yearly">Jährlich</option>
                            </select>
                        </div>
                        
                        {recurrence !== 'none' && (
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Endet am (Optional)</label>
                                <input
                                    type="date"
                                    value={recurrenceEndDate}
                                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}
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
                        placeholder="Wofür war das?"
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
                                Eintrag speichern
                            </>
                        )}
                    </button>
                </div>
             </form>
        </div>
    );
};

export default TransactionForm;
