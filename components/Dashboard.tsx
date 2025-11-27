
import React, { useMemo } from 'react';
import { Transaction, DashboardStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Calendar, Clock, Landmark, Coins } from 'lucide-react';

interface DashboardProps {
    transactions: Transaction[];
    mode: 'monthly' | 'daily';
    setMode: (mode: 'monthly' | 'daily') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, mode, setMode }) => {
    
    const stats: DashboardStats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayStr = now.toISOString().split('T')[0];

        let bankBalance = 0;
        let cashBalance = 0;
        let projectedBalance = 0;
        let income = 0;
        let expense = 0;

        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            const isFuture = txDate > now && (txDate.getMonth() !== currentMonth || txDate.getFullYear() !== currentYear);
            if (isFuture) return; // Skip future months

            // 1. Calculate Actual Current Status (Daily)
            // Bank & Cash Balances are sum of COMPLETED transactions + Initial Seeds
            if (tx.status === 'completed') {
                if (tx.account === 'bank') {
                    if (tx.type === 'income') bankBalance += tx.amount;
                    else bankBalance -= tx.amount;
                } else {
                    if (tx.type === 'income') cashBalance += tx.amount;
                    else cashBalance -= tx.amount;
                }
            }

            // 2. Calculate Projected (End of Month)
            // Includes Pending items for current month
            const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const isPast = txDate < now && !isCurrentMonth;
            
            // For projected, we take the base (Completed Past) + (All Current Month, including pending)
            if (isPast && tx.status === 'completed') {
                if (tx.account === 'bank') {
                    if (tx.type === 'income') projectedBalance += tx.amount;
                    else projectedBalance -= tx.amount;
                }
            } else if (isCurrentMonth) {
                // Include EVERYTHING in current month for projection, regardless of status
                // But only for BANK account usually, unless we want total wealth?
                // Let's stick to Bank Projection as that's the main concern (Overdraft)
                if (tx.account === 'bank') {
                    if (tx.type === 'income') projectedBalance += tx.amount;
                    else projectedBalance -= tx.amount;
                }
            }

            // 3. Monthly Stats (Income/Expense Flow)
            if (isCurrentMonth) {
                // View logic: Daily = only completed, Monthly = everything
                let shouldCount = false;
                if (mode === 'monthly') shouldCount = true;
                else if (tx.status === 'completed') shouldCount = true;

                if (shouldCount) {
                     if (tx.type === 'income') income += tx.amount;
                     else expense += tx.amount;
                }
            }
        });

        return { bankBalance, cashBalance, projectedBalance, income, expense };
    }, [transactions, mode]);

    const chartData = useMemo(() => {
        const grouped = transactions.reduce((acc, curr) => {
            const date = new Date(curr.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
            if (!acc[date]) {
                acc[date] = { date, income: 0, expense: 0 };
            }
            // Only show completed for trend
            if (curr.status === 'completed') {
                if (curr.type === 'income') acc[date].income += curr.amount;
                else acc[date].expense += curr.amount;
            }
            return acc;
        }, {} as Record<string, { date: string, income: number, expense: number }>);

        return Object.values(grouped).reverse().slice(-7); 
    }, [transactions]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white">
                    {mode === 'daily' ? 'Status: Heute (27.11.)' : 'Vorschau: Monatsende'}
                </h1>
                
                <div className="bg-slate-900 p-1 rounded-lg flex border border-slate-800">
                    <button
                        onClick={() => setMode('daily')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            mode === 'daily' 
                                ? 'bg-slate-700 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        Ist-Stand
                    </button>
                    <button
                        onClick={() => setMode('monthly')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            mode === 'monthly' 
                                ? 'bg-slate-700 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Planung
                    </button>
                </div>
            </div>
            
            {/* Balances Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Bank Balance */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-slate-400 text-sm font-medium">Girokonto</h3>
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Landmark className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    {mode === 'daily' ? (
                        <>
                             <p className={`text-3xl font-bold relative z-10 ${stats.bankBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatCurrency(stats.bankBalance)}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 relative z-10">Aktueller Kontostand</p>
                        </>
                    ) : (
                        <>
                             <p className={`text-3xl font-bold relative z-10 ${stats.projectedBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatCurrency(stats.projectedBalance)}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 relative z-10">Prognose inkl. offener Posten</p>
                        </>
                    )}
                </div>

                {/* Cash Balance */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Bargeld</h3>
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Coins className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white">{formatCurrency(stats.cashBalance)}</p>
                    <p className="text-xs text-slate-500 mt-2">Physischer Bestand</p>
                </div>

                {/* Monthly Flow */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Monats-Budget</h3>
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Wallet className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <span className="text-xs text-slate-400 block mb-1">Einnahmen</span>
                            <span className="text-lg font-bold text-green-400">+{formatCurrency(stats.income)}</span>
                        </div>
                        <div className="text-right">
                             <span className="text-xs text-slate-400 block mb-1">Ausgaben</span>
                            <span className="text-lg font-bold text-red-400">-{formatCurrency(stats.expense)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-6">Trend (Getätigte Zahlungen)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(val) => `€${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number, name: string) => [
                                    formatCurrency(value),
                                    name === 'income' ? 'Einnahmen' : 'Ausgaben'
                                ]}
                            />
                            <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} name="Einnahmen" />
                            <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} name="Ausgaben" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
