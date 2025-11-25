
import React, { useMemo, useState } from 'react';
// IMPORTANT: Extension .ts added for No-Build compatibility
import { Transaction, DashboardStats } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight, Calendar, Clock, Repeat } from 'lucide-react';

interface DashboardProps {
    transactions: Transaction[];
}

type ViewMode = 'MONTH' | 'DAY';

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- Navigation Logic ---

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'MONTH') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setDate(newDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'MONTH') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        setCurrentDate(newDate);
    };

    const formattedDateLabel = useMemo(() => {
        if (viewMode === 'MONTH') {
            return currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        }
        return currentDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    }, [currentDate, viewMode]);

    // --- Recurrence & Filtering Logic ---

    const filteredTransactions = useMemo(() => {
        // Helper to check if a date is within the current view
        const isInCurrentView = (d: Date) => {
            if (viewMode === 'MONTH') {
                return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
            } else {
                return d.toDateString() === currentDate.toDateString();
            }
        };

        const result: Transaction[] = [];

        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            
            // 1. Normal Transactions (Non-recurring)
            if (!tx.recurrence || tx.recurrence === 'none') {
                if (isInCurrentView(txDate)) {
                    result.push(tx);
                }
                return;
            }

            // 2. Recurring Transactions Logic
            // We check if this recurrence *hits* the current view window
            
            // Check End Date
            if (tx.recurrenceEndDate) {
                const endDate = new Date(tx.recurrenceEndDate);
                if (viewMode === 'MONTH') {
                     // If view start is after end date, ignore
                     const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                     if (viewStart > endDate) return;
                } else {
                    if (currentDate > endDate) return;
                }
            }

            // Calculate occurrence
            let hits = false;
            
            if (viewMode === 'MONTH') {
                // Monthly view: Check if recurrence happens this month
                if (tx.recurrence === 'daily') hits = true; // Always hits a month
                if (tx.recurrence === 'weekly') hits = true; // Almost always hits
                if (tx.recurrence === 'monthly') {
                    // Start date must be before or in current month
                    const viewEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                    if (txDate <= viewEnd) hits = true;
                }
                if (tx.recurrence === 'yearly') {
                    if (txDate.getMonth() === currentDate.getMonth() && txDate.getFullYear() <= currentDate.getFullYear()) hits = true;
                }
            } else {
                // Day View: Check specific day match
                if (txDate > currentDate) return; // Started in future

                if (tx.recurrence === 'daily') hits = true;
                if (tx.recurrence === 'weekly') {
                    if (txDate.getDay() === currentDate.getDay()) hits = true;
                }
                if (tx.recurrence === 'monthly') {
                    if (txDate.getDate() === currentDate.getDate()) hits = true;
                }
                if (tx.recurrence === 'yearly') {
                    if (txDate.getDate() === currentDate.getDate() && txDate.getMonth() === currentDate.getMonth()) hits = true;
                }
            }

            if (hits) {
                // Add a "virtual" transaction instance for display
                // Note: For 'daily' in 'month' view, this adds ONE entry with the sum of all days? 
                // To keep it simple for the chart, we treat it as one aggregate or single instance per match logic.
                // Better approach for stats: Multiply amount if daily/weekly in month view.
                
                let multiplier = 1;
                if (viewMode === 'MONTH') {
                    if (tx.recurrence === 'daily') {
                        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                        multiplier = daysInMonth; 
                        // Adjust if start date is inside this month
                        if (txDate.getMonth() === currentDate.getMonth() && txDate.getFullYear() === currentDate.getFullYear()) {
                            multiplier = daysInMonth - txDate.getDate() + 1;
                        }
                    }
                    if (tx.recurrence === 'weekly') multiplier = 4; // Approx
                }

                result.push({
                    ...tx,
                    amount: tx.amount * multiplier,
                    id: `virtual-${tx.id}-${currentDate.getTime()}`, // Unique ID for React Key
                    note: `(Wiederkehrend: ${tx.recurrence}) ${tx.note}`,
                    date: viewMode === 'MONTH' ? new Date(currentDate.getFullYear(), currentDate.getMonth(), txDate.getDate()).toISOString() : currentDate.toISOString() // Project date to current view
                });
            }
        });

        return result;
    }, [transactions, viewMode, currentDate]);
    
    // --- Stats Calculation ---

    const stats: DashboardStats = useMemo(() => {
        return filteredTransactions.reduce((acc, curr) => {
            if (curr.type === 'income') {
                acc.income += curr.amount;
                acc.totalBalance += curr.amount;
            } else {
                acc.expense += curr.amount;
                acc.totalBalance -= curr.amount;
            }
            return acc;
        }, { totalBalance: 0, income: 0, expense: 0 });
    }, [filteredTransactions]);

    // --- Chart Data Preparation ---

    const chartData = useMemo(() => {
        if (viewMode === 'MONTH') {
            // Group by Day of Month
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const data = Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                return { name: `${day}.`, income: 0, expense: 0 };
            });

            filteredTransactions.forEach(tx => {
                const d = new Date(tx.date);
                // Handle virtual projection dates correctly
                const day = d.getDate();
                if (day >= 1 && day <= daysInMonth) {
                    if (tx.type === 'income') data[day - 1].income += tx.amount;
                    else data[day - 1].expense += tx.amount;
                }
            });
            return data;
        } else {
            // Group by Category
            const grouped = filteredTransactions.reduce((acc, curr) => {
                if (!acc[curr.category]) acc[curr.category] = { name: curr.category, income: 0, expense: 0 };
                if (curr.type === 'income') acc[curr.category].income += curr.amount;
                else acc[curr.category].expense += curr.amount;
                return acc;
            }, {} as Record<string, { name: string, income: number, expense: number }>);
            return Object.values(grouped);
        }
    }, [filteredTransactions, viewMode, currentDate]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            {/* Header / Navigation */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                
                <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button 
                        onClick={() => setViewMode('MONTH')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'MONTH' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Calendar className="w-4 h-4" /> Monat
                    </button>
                    <button 
                        onClick={() => setViewMode('DAY')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'DAY' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Clock className="w-4 h-4" /> Tag
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button onClick={handlePrev} className="p-2 hover:bg-slate-700 rounded-md text-slate-300">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="w-40 text-center font-medium text-white select-none">
                        {formattedDateLabel}
                    </span>
                    <button onClick={handleNext} className="p-2 hover:bg-slate-700 rounded-md text-slate-300">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-slate-400 text-sm font-medium">Saldo ({viewMode === 'MONTH' ? 'Monat' : 'Tag'})</h3>
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Wallet className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    <p className={`text-3xl font-bold relative z-10 ${stats.totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {formatCurrency(stats.totalBalance)}
                    </p>
                    {/* Background accent */}
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Einnahmen</h3>
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-green-400">+{formatCurrency(stats.income)}</p>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Ausgaben</h3>
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <TrendingDown className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{formatCurrency(stats.expense * -1)}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-6">
                    {viewMode === 'MONTH' ? 'Finanzverlauf' : 'Kategorien-Übersicht'}
                </h3>
                <div className="h-64 w-full">
                    {filteredTransactions.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis 
                                    dataKey="name" 
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
                                    formatter={(value: number) => [`${value.toFixed(2)} €`, '']}
                                />
                                <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} name="Einnahmen" />
                                <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} name="Ausgaben" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                            <Calendar className="w-8 h-8 opacity-20" />
                            <p>Keine Daten für diesen Zeitraum</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
