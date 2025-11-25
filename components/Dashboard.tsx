import React, { useMemo } from 'react';
import { Transaction, DashboardStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface DashboardProps {
    transactions: Transaction[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
    
    const stats: DashboardStats = useMemo(() => {
        return transactions.reduce((acc, curr) => {
            if (curr.type === 'income') {
                acc.income += curr.amount;
                acc.totalBalance += curr.amount;
            } else {
                acc.expense += curr.amount;
                acc.totalBalance -= curr.amount;
            }
            return acc;
        }, { totalBalance: 0, income: 0, expense: 0 });
    }, [transactions]);

    const chartData = useMemo(() => {
        // Group by last 7 unique dates or just take recent transactions
        const grouped = transactions.reduce((acc, curr) => {
            const date = new Date(curr.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
            if (!acc[date]) {
                acc[date] = { date, income: 0, expense: 0 };
            }
            if (curr.type === 'income') acc[date].income += curr.amount;
            else acc[date].expense += curr.amount;
            return acc;
        }, {} as Record<string, { date: string, income: number, expense: number }>);

        return Object.values(grouped).reverse().slice(-7); // Last 7 days with activity
    }, [transactions]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            <h1 className="text-2xl font-bold text-white">Übersicht</h1>
            
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-medium">Gesamtsaldo</h3>
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Wallet className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white">{formatCurrency(stats.totalBalance)}</p>
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
                    <p className="text-3xl font-bold text-red-400">-{formatCurrency(stats.expense)}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-6">Finanzüberblick</h3>
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
                                labelStyle={{ color: '#94a3b8' }}
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