import React, { useMemo } from 'react';
import { Transaction, DashboardStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Calendar, Clock } from 'lucide-react';

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

        let totalBalance = 0;
        let income = 0;
        let expense = 0;

        // Base calculation for 'All time' total balance before this month? 
        // For simplicity in this personal finance app, we sum everything relevant.
        
        // Filter logic
        const relevantTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            
            // For both modes, we generally want to calculate the global balance,
            // but the "Projected" vs "Actual" difference matters for the current month.
            
            // Logic:
            // 1. Past months: Always count everything (assuming they happened).
            // 2. Future months: Ignore for "Current Status", include for "Forecast" maybe? 
            //    Let's stick to "Current Month View" vs "Today View".
            
            if (txDate.getMonth() !== currentMonth || txDate.getFullYear() !== currentYear) {
                // Transactions outside current month:
                // If they are in the past, they contribute to the base balance.
                // If future, ignore.
                return txDate < now;
            }
            
            // We are in the Current Month:
            if (mode === 'daily') {
                // DAILY VIEW (Tagesansicht): 
                // Only count transactions UP TO today AND (if recurring) they must be completed.
                // If it's a future dated transaction in this month, ignore it.
                // If it's a pending recurring transaction (even if date is past/today), ignore it until checked?
                // User requirement: "erst wenn Haken gesetzt... wird abgebucht".
                
                if (tx.date > todayStr) return false; // Future days in this month
                if (tx.status === 'pending') return false; // Not checked off yet
                return true;
            } else {
                // MONTHLY VIEW (Monatsansicht / Forecast):
                // Count EVERYTHING in this month, pending or not, checked or not.
                // This shows "End of Month" state.
                return true;
            }
        });

        // Calculate generic Total Balance (History + Current View Selection)
        // Note: For a proper finance app, we'd need a "Starting Balance". 
        // Here we assume 0 start + history.
        
        // To get the "Forecast", we take the 'daily' balance and add the remaining items?
        // No, simpler: Just sum up the filtered list.
        
        relevantTransactions.forEach(tx => {
             if (tx.type === 'income') {
                income += tx.amount;
                totalBalance += tx.amount;
            } else {
                expense += tx.amount;
                totalBalance -= tx.amount;
            }
        });

        // If we need to capture "History" (previous months) accurately for Total Balance:
        // The above loop filters strictly. Let's fix:
        // We need: Global Balance = (All Past Months) + (Current Month Filtered).
        // Let's re-run a full reduce.
        
        return transactions.reduce((acc, curr) => {
            const txDate = new Date(curr.date);
            const isPastMonth = txDate.getMonth() < currentMonth || txDate.getFullYear() < currentYear;
            const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const isFuture = txDate > now && !isCurrentMonth; // Real future

            if (isFuture) return acc; // Ignore next months completely for now

            let shouldCount = false;

            if (isPastMonth) {
                shouldCount = true; // Always count past
            } else if (isCurrentMonth) {
                if (mode === 'monthly') {
                    shouldCount = true; // Count all for forecast
                } else {
                    // Daily mode
                    const isFutureDay = curr.date > todayStr;
                    const isPending = curr.status === 'pending';
                    if (!isFutureDay && !isPending) {
                        shouldCount = true;
                    }
                }
            }

            if (shouldCount) {
                 if (curr.type === 'income') {
                    acc.income += curr.amount; // Note: This accumulates 'income' stat for ALL time, might want just month?
                    // Usually Dashboard "Income/Expense" cards show CURRENT MONTH stats.
                    // Let's separate "Total Balance" from "Monthly Stats".
                    acc.totalBalance += curr.amount;
                } else {
                    acc.expense += curr.amount;
                    acc.totalBalance -= curr.amount;
                }
            }
            return acc;

        }, { totalBalance: 0, income: 0, expense: 0 });

    }, [transactions, mode]);

    // Recalculate just Income/Expense for the specific displayed month for the Cards
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        return transactions.reduce((acc, curr) => {
            const txDate = new Date(curr.date);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
                 // For the cards, we follow the same View Logic (Forecast vs Actual)
                 let include = false;
                 if (mode === 'monthly') include = true;
                 else {
                     // Daily
                     if (curr.date <= now.toISOString().split('T')[0] && curr.status === 'completed') include = true;
                 }

                 if (include) {
                     if (curr.type === 'income') acc.income += curr.amount;
                     else acc.expense += curr.amount;
                 }
            }
            return acc;
        }, { income: 0, expense: 0 });
    }, [transactions, mode]);

    const chartData = useMemo(() => {
        const grouped = transactions.reduce((acc, curr) => {
            // Last 7 days? Or Current Month days?
            // Let's show last 7 active days for simplicity
            const date = new Date(curr.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
            if (!acc[date]) {
                acc[date] = { date, income: 0, expense: 0 };
            }
            if (curr.type === 'income') acc[date].income += curr.amount;
            else acc[date].expense += curr.amount;
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
                    {mode === 'daily' ? 'Aktueller Status (Heute)' : 'Monatsvorschau'}
                </h1>
                
                {/* Mode Switcher */}
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
                        Tagesansicht
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
                        Monatsansicht
                    </button>
                </div>
            </div>
            
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">
                            {mode === 'daily' ? 'Aktueller Kontostand' : 'Prognose am Monatsende'}
                        </h3>
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Wallet className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    <p className={`text-3xl font-bold ${stats.totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {formatCurrency(stats.totalBalance)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                        {mode === 'daily' ? 'Ohne offene Fixkosten' : 'Inklusive geplanter Buchungen'}
                    </p>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Einnahmen (Monat)</h3>
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-green-400">+{formatCurrency(monthlyStats.income)}</p>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Ausgaben (Monat)</h3>
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <TrendingDown className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-red-400">-{formatCurrency(monthlyStats.expense)}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-6">Trend (Letzte 7 Tage)</h3>
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