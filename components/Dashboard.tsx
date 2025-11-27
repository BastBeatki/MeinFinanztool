
import React, { useMemo, useState } from 'react';
import { Transaction, RecurringRule, AccountType } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Landmark, Coins, TrendingUp, AlertCircle, Plus, Calendar, X } from 'lucide-react';

interface DashboardProps {
    transactions: Transaction[];
    recurringRules: RecurringRule[];
    mode: 'monthly' | 'daily';
    setMode: (mode: 'monthly' | 'daily') => void;
    onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
}

// Fixed Budget Configurations
const BUDGET_POTS = [
    { id: 'pot_420', name: '420 (Gras)', limit: 150, category: '420' },
    { id: 'pot_we', name: 'Wochenende', limit: 120, category: 'Wochenende' },
    { id: 'pot_week', name: 'Unter der Woche', limit: 120, category: 'Wochentage' },
    { id: 'pot_smoke', name: 'Rauchen', limit: 40, category: 'Rauchen' },
];

const Dashboard: React.FC<DashboardProps> = ({ transactions, recurringRules, mode, setMode, onAddTransaction }) => {
    
    // Pot Modal State
    const [selectedPot, setSelectedPot] = useState<typeof BUDGET_POTS[0] | null>(null);
    const [potAmount, setPotAmount] = useState('');
    const [potDate, setPotDate] = useState(new Date().toISOString().split('T')[0]);
    const [potAccount, setPotAccount] = useState<AccountType>('cash'); // Default Cash, but changeable
    
    // Forecast Date State (Default: End of Current Month)
    const [forecastDate, setForecastDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    // 1. Calculate Stats
    const stats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let bankBalance = 0;
        let cashBalance = 0;
        
        // Calculate Actual Balances (Completed transactions up to today)
        transactions.forEach(tx => {
            if (tx.status === 'completed') {
                const amt = tx.type === 'income' ? tx.amount : -tx.amount;
                if (tx.account === 'bank') bankBalance += amt;
                else cashBalance += amt;
            }
        });

        // Calculate Pot Usage (Current Month)
        const potStats = BUDGET_POTS.map(pot => {
            const spent = transactions
                .filter(tx => 
                    tx.category === pot.category && 
                    tx.type === 'expense' &&
                    new Date(tx.date).getMonth() === currentMonth &&
                    new Date(tx.date).getFullYear() === currentYear
                )
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            return { ...pot, spent, remaining: pot.limit - spent };
        });

        return { 
            bankBalance, 
            cashBalance, 
            potStats
        };
    }, [transactions]);

    // 2. Chart Data: Account Balance Trend (Real + Simulation)
    const chartData = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const endDate = new Date(forecastDate);
        const data = [];

        // --- PART 1: Historical Data (Real Transactions) ---
        // Find rough start date for chart (Start of this month or earliest visible relevant date)
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Sort transactions
        const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Calculate running balance up to "yesterday"
        let runningBalance = 0;
        
        // We need to calculate the balance BEFORE the start date of the chart to have a correct starting point
        sortedTx.forEach(tx => {
            if (tx.status === 'completed' && tx.account === 'bank' && new Date(tx.date) < startDate) {
                 if (tx.type === 'income') runningBalance += tx.amount;
                 else runningBalance -= tx.amount;
            }
        });

        // Loop Day by Day from StartDate until EndDate
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isFuture = d > now;

            if (!isFuture) {
                // REALITY: Use actual transactions
                const dailyTxs = sortedTx.filter(tx => tx.date === dateStr && tx.account === 'bank' && tx.status === 'completed');
                dailyTxs.forEach(tx => {
                    if (tx.type === 'income') runningBalance += tx.amount;
                    else runningBalance -= tx.amount;
                });
            } else {
                // FUTURE: Simulate based on Recurring Rules
                const dayOfMonth = d.getDate();
                
                // Find rules that trigger on this day
                recurringRules.forEach(rule => {
                    if (rule.active && rule.account === 'bank' && rule.dayOfMonth === dayOfMonth) {
                        if (rule.type === 'income') runningBalance += rule.amount;
                        else runningBalance -= rule.amount;
                    }
                });
            }

            data.push({
                day: d.getDate(),
                fullDate: dateStr,
                balance: runningBalance,
                isFuture
            });
        }
        return data;
    }, [transactions, recurringRules, forecastDate]);

    // Derived Projected Balance from Chart
    const projectedBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : stats.bankBalance;

    const handlePotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPot || !potAmount) return;

        await onAddTransaction({
            amount: parseFloat(potAmount),
            category: selectedPot.category,
            date: potDate,
            type: 'expense',
            account: potAccount, // Use user selection
            method: potAccount === 'cash' ? 'cash' : 'digital',
            note: `Abbuchung aus Topf: ${selectedPot.name}`,
            status: 'completed',
            isRecurring: false
        });

        setSelectedPot(null);
        setPotAmount('');
        setPotDate(new Date().toISOString().split('T')[0]);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            {/* Header / Forecast Control */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white">
                    {mode === 'daily' ? 'Finanzstatus: Heute' : 'Prognose & Verlauf'}
                </h1>
                
                <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit">
                    <div className="flex bg-slate-950 rounded-md overflow-hidden">
                        <button
                            onClick={() => setMode('daily')}
                            className={`px-4 py-2 text-sm font-medium transition-all ${
                                mode === 'daily' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Ist-Stand
                        </button>
                        <button
                            onClick={() => setMode('monthly')}
                            className={`px-4 py-2 text-sm font-medium transition-all ${
                                mode === 'monthly' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Vorschau
                        </button>
                    </div>

                    {mode === 'monthly' && (
                        <div className="flex items-center gap-2 px-2 border-l border-slate-800">
                             <Calendar className="w-4 h-4 text-slate-500" />
                             <input 
                                type="date"
                                value={forecastDate}
                                onChange={(e) => setForecastDate(e.target.value)}
                                className="bg-transparent text-sm text-white focus:outline-none w-32"
                             />
                        </div>
                    )}
                </div>
            </div>
            
            {/* 1. Main Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Account */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Landmark className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="text-slate-300 font-medium">Girokonto</h3>
                        </div>
                    </div>
                    {mode === 'daily' ? (
                        <>
                             <p className={`text-4xl font-bold tracking-tight ${stats.bankBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatCurrency(stats.bankBalance)}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">Aktuell verfügbar</p>
                        </>
                    ) : (
                        <>
                             <p className={`text-4xl font-bold tracking-tight ${projectedBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatCurrency(projectedBalance)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-slate-500">Stand am {new Date(forecastDate).toLocaleDateString('de-DE')} (Simuliert)</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Cash */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <Coins className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-slate-300 font-medium">Bargeld</h3>
                        </div>
                    </div>
                    <p className="text-4xl font-bold tracking-tight text-white">{formatCurrency(stats.cashBalance)}</p>
                    <p className="text-sm text-slate-500 mt-1">Im Portemonnaie</p>
                </div>
            </div>

            {/* 2. Interactive Money Pots */}
            <h2 className="text-lg font-semibold text-white mt-4">Geldtöpfe (Monatsbudget)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.potStats.map(pot => {
                    const percentage = Math.min(100, (pot.spent / pot.limit) * 100);
                    let colorClass = 'bg-emerald-500';
                    if (percentage > 75) colorClass = 'bg-yellow-500';
                    if (percentage >= 100) colorClass = 'bg-red-500';

                    return (
                        <div 
                            key={pot.id} 
                            onClick={() => {
                                setSelectedPot(pot);
                                setPotAccount('cash'); // Reset to default when opening
                            }}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between cursor-pointer hover:border-blue-500 transition-all group relative"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-blue-600 p-1 rounded-full"><Plus className="w-3 h-3 text-white" /></div>
                            </div>

                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium text-slate-200">{pot.name}</span>
                                    {percentage >= 100 && <AlertCircle className="w-4 h-4 text-red-500" />}
                                </div>
                                <div className="flex items-baseline gap-1 mb-3">
                                    <span className="text-2xl font-bold text-white">
                                        {formatCurrency(pot.remaining)}
                                    </span>
                                    <span className="text-xs text-slate-500">übrig</span>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${colorClass}`} 
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-500 uppercase font-medium">
                                    <span>{formatCurrency(pot.spent)} Ausg.</span>
                                    <span>Limit: {formatCurrency(pot.limit)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 3. Line Chart (Balance History) */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">
                        {mode === 'daily' ? 'Kontoverlauf (Ist)' : 'Zukunftssimulation'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <TrendingUp className="w-4 h-4" />
                        <span>Bis {new Date(forecastDate).toLocaleDateString('de-DE')}</span>
                    </div>
                </div>
                
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey="day" 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `${val}.`}
                            />
                            <YAxis 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(val) => `€${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => [formatCurrency(value), 'Kontostand']}
                                labelFormatter={(label) => `${label}.`}
                            />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                            <Area 
                                type="monotone" 
                                dataKey="balance" 
                                stroke="#3b82f6" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorBalance)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 text-xs text-slate-500 text-center">
                    {mode === 'daily' 
                        ? 'Zeigt tatsächliche Buchungen auf dem Girokonto.' 
                        : 'Zeigt eine Simulation basierend auf wiederkehrenden Einnahmen und Fixkosten.'}
                </div>
            </div>

            {/* MODAL: Spend from Pot */}
            {selectedPot && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-bold text-white">Ausgabe: {selectedPot.name}</h3>
                            <button onClick={() => setSelectedPot(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handlePotSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Betrag abziehen (€)</label>
                                <input 
                                    type="number" 
                                    autoFocus
                                    step="0.01" 
                                    required
                                    value={potAmount}
                                    onChange={(e) => setPotAmount(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
                                    placeholder="0.00"
                                />
                            </div>
                            
                            {/* Account Selector */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Zahlungsquelle</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPotAccount('cash')}
                                        className={`flex items-center justify-center gap-2 py-2 rounded border transition-all ${
                                            potAccount === 'cash' 
                                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400'
                                        }`}
                                    >
                                        <Coins className="w-3 h-3" /> Bargeld
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPotAccount('bank')}
                                        className={`flex items-center justify-center gap-2 py-2 rounded border transition-all ${
                                            potAccount === 'bank' 
                                                ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400'
                                        }`}
                                    >
                                        <Landmark className="w-3 h-3" /> Girokonto
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Datum der Ausgabe</label>
                                <input 
                                    type="date" 
                                    required
                                    value={potDate}
                                    onChange={(e) => setPotDate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all">
                                    Bestätigen
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
