
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, RecurringRule, AccountType, PotConfig } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Landmark, Coins, TrendingUp, AlertCircle, Plus, Calendar, X, Rocket, Wallet, HeartHandshake, Pencil, Save, Check } from 'lucide-react';
import { dbService } from '../services/db';

interface DashboardProps {
    transactions: Transaction[];
    recurringRules: RecurringRule[];
    mode: 'monthly' | 'daily';
    setMode: (mode: 'monthly' | 'daily') => void;
    onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateRule?: (rule: RecurringRule) => Promise<void>;
}

// Fixed Budget Configurations (DEFAULTS)
// Note: 420 is now 50€ default.
const DEFAULT_BUDGET_POTS = [
    { id: 'pot_420', name: '420 (Gras)', limit: 50, category: '420' },
    { id: 'pot_we', name: 'Wochenende', limit: 120, category: 'Wochenende' },
    { id: 'pot_week', name: 'Unter der Woche', limit: 120, category: 'Wochentage' },
    { id: 'pot_smoke', name: 'Rauchen', limit: 40, category: 'Rauchen' },
];

const DEBT_TOTAL_MAMA = 1000;

const Dashboard: React.FC<DashboardProps> = ({ transactions, recurringRules, mode, setMode, onAddTransaction, onUpdateRule }) => {
    
    // Pot Modal State
    const [selectedPot, setSelectedPot] = useState<typeof DEFAULT_BUDGET_POTS[0] | null>(null);
    const [potAmount, setPotAmount] = useState('');
    const [potDate, setPotDate] = useState(new Date().toISOString().split('T')[0]);
    const [potAccount, setPotAccount] = useState<AccountType>('cash'); 
    
    // Pot EDIT Config State
    const [editingPotId, setEditingPotId] = useState<string | null>(null);
    const [editPotLimit, setEditPotLimit] = useState('');
    const [savePotFuture, setSavePotFuture] = useState(false);
    const [potConfigs, setPotConfigs] = useState<PotConfig[]>([]);

    // Debt Config State
    const [showDebtConfig, setShowDebtConfig] = useState(false);
    const [debtInstallment, setDebtInstallment] = useState('50');

    // Forecast Date State (Default: End of Current Month relative to Real NOW)
    const [forecastDate, setForecastDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    // Load Pot Settings
    useEffect(() => {
        dbService.getPotConfigs().then(setPotConfigs);
    }, []);

    // Helper: Get active limit for a pot based on month
    const getPotLimit = (potId: string, dateObj: Date) => {
        const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        // 1. Check specific month override
        const specific = potConfigs.find(c => c.potId === potId && c.month === monthStr);
        if (specific) return specific.limit;
        
        // 2. Check default override
        const def = potConfigs.find(c => c.potId === potId && !c.month);
        if (def) return def.limit;

        // 3. Fallback to hardcoded default
        return DEFAULT_BUDGET_POTS.find(p => p.id === potId)?.limit || 0;
    };

    // Helper: Count occurrences of a specific weekday in a month (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)
    const countWeekdaysInMonth = (year: number, month: number, dayIndex: number) => {
        let count = 0;
        const d = new Date(year, month, 1);
        while (d.getMonth() === month) {
            if (d.getDay() === dayIndex) count++;
            d.setDate(d.getDate() + 1);
        }
        return count > 0 ? count : 1; 
    };

    // 1. Calculate Stats
    const stats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let bankBalance = 0;
        let cashBalance = 0;
        let debtRepaid = 0;
        
        // Calculate Actual Balances
        transactions.forEach(tx => {
            if (tx.status === 'completed') {
                const amt = tx.type === 'income' ? tx.amount : -tx.amount;
                if (tx.account === 'bank') bankBalance += amt;
                else cashBalance += amt;

                // Track Repayment
                if (tx.category === 'Rückzahlung Mama' && tx.type === 'expense') {
                    debtRepaid += tx.amount;
                }
            }
        });

        // Calculate Pot Usage (Current Month)
        const potStats = DEFAULT_BUDGET_POTS.map(pot => {
            const spent = transactions
                .filter(tx => 
                    tx.category === pot.category && 
                    tx.type === 'expense' &&
                    new Date(tx.date).getMonth() === currentMonth &&
                    new Date(tx.date).getFullYear() === currentYear
                )
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            const activeLimit = getPotLimit(pot.id, now);
            
            return { ...pot, limit: activeLimit, spent, remaining: activeLimit - spent };
        });

        const remainingDebt = DEBT_TOTAL_MAMA - debtRepaid;
        const totalNetWorth = bankBalance + cashBalance - remainingDebt;

        return { 
            bankBalance, 
            cashBalance, 
            potStats,
            remainingDebt,
            totalNetWorth
        };
    }, [transactions, forecastDate, potConfigs]);

    // 2. "Permanently Positive" Forecast Calculation
    const permanentPositiveForecast = useMemo(() => {
        const SIMULATION_YEARS = 5;
        const SIM_DAYS = 365 * SIMULATION_YEARS;
        
        let simBalance = stats.bankBalance;
        const now = new Date();
        let lastNegativeDate: Date | null = simBalance < 0 ? new Date(now) : null;

        const startSim = new Date(now);
        startSim.setDate(startSim.getDate() + 1);
        startSim.setHours(0,0,0,0);

        const futureOneTimeMap = new Map<string, Transaction[]>();
        transactions.forEach(tx => {
            if (!tx.isRecurring && new Date(tx.date) > now && tx.account === 'bank') {
                const list = futureOneTimeMap.get(tx.date) || [];
                list.push(tx);
                futureOneTimeMap.set(tx.date, list);
            }
        });

        for (let i = 0; i < SIM_DAYS; i++) {
            const d = new Date(startSim);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            
            const day = d.getDate();
            const month = d.getMonth(); 
            const year = d.getFullYear();
            const dayOfWeek = d.getDay(); 

            // A. Apply Fixed Recurring Rules
            recurringRules.forEach(rule => {
                if (rule.active && rule.account === 'bank' && rule.dayOfMonth === day) {
                    // Logic for specific skips
                    if (rule.category === 'Gehalt TEDi' && year === 2025 && month === 10) return;

                    if (rule.type === 'income') simBalance += rule.amount;
                    else simBalance -= rule.amount;
                }
            });

            // B. Apply One-time Future Transactions
            const oneTimeTxs = futureOneTimeMap.get(dateStr);
            if (oneTimeTxs) {
                oneTimeTxs.forEach(tx => {
                    if (tx.type === 'income') simBalance += tx.amount;
                    else simBalance -= tx.amount;
                });
            }

            // C. Apply Pot Simulation
            // We use default pot limits for future unless specific logic needed
            // Pot 420 (Split 1st and 15th)
            const limit420 = getPotLimit('pot_420', d);
            if (day === 1 || day === 15) {
                simBalance -= (limit420 / 2);
            }

            // Weekend (Fridays)
            if (dayOfWeek === 5) {
                const fridays = countWeekdaysInMonth(year, month, 5);
                simBalance -= (getPotLimit('pot_we', d) / fridays);
            }

            // Weekdays (Mondays)
            if (dayOfWeek === 1) {
                const mondays = countWeekdaysInMonth(year, month, 1);
                simBalance -= (getPotLimit('pot_week', d) / mondays);
            }

            // Smoking (1, 8, 15, 22)
            if ([1, 8, 15, 22].includes(day)) {
                simBalance -= (getPotLimit('pot_smoke', d) / 4); 
            }

            if (simBalance < 0) {
                lastNegativeDate = new Date(d);
            }
        }

        if (!lastNegativeDate) {
            return { status: 'positive', date: 'Sofort' };
        }
        
        const lastSimDay = new Date(startSim);
        lastSimDay.setDate(lastSimDay.getDate() + SIM_DAYS - 1);
        
        if (lastNegativeDate.getTime() >= lastSimDay.getTime()) {
             return { status: 'impossible', date: '> 5 Jahre' };
        }

        const stableDate = new Date(lastNegativeDate);
        stableDate.setDate(stableDate.getDate() + 1);
        
        const formatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
        return { status: 'future', date: formatter.format(stableDate) };

    }, [stats.bankBalance, recurringRules, transactions, potConfigs]);

    // 3. Chart Data
    const chartData = useMemo(() => {
        const now = new Date();
        const endDate = new Date(forecastDate);
        const data = [];

        // --- PART 1: Historical Data ---
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        
        sortedTx.forEach(tx => {
            if (tx.status === 'completed' && tx.account === 'bank' && new Date(tx.date) < startDate) {
                 if (tx.type === 'income') runningBalance += tx.amount;
                 else runningBalance -= tx.amount;
            }
        });

        // Loop Day by Day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isFuture = d > now;

            if (!isFuture) {
                const dailyTxs = sortedTx.filter(tx => tx.date === dateStr && tx.account === 'bank' && tx.status === 'completed');
                dailyTxs.forEach(tx => {
                    if (tx.type === 'income') runningBalance += tx.amount;
                    else runningBalance -= tx.amount;
                });
            } else {
                const dayOfMonth = d.getDate();
                const dayOfWeek = d.getDay(); 
                const currentMonth = d.getMonth();
                const currentYear = d.getFullYear();

                recurringRules.forEach(rule => {
                    if (rule.active && rule.account === 'bank' && rule.dayOfMonth === dayOfMonth) {
                        if (rule.category === 'Gehalt TEDi' && currentYear === 2025 && currentMonth === 10) return;
                        if (rule.type === 'income') runningBalance += rule.amount;
                        else runningBalance -= rule.amount;
                    }
                });

                const futureOneTimeTxs = transactions.filter(tx => 
                    tx.date === dateStr && 
                    tx.account === 'bank' && 
                    !tx.isRecurring
                );
                futureOneTimeTxs.forEach(tx => {
                    if (tx.type === 'income') runningBalance += tx.amount;
                    else runningBalance -= tx.amount;
                });

                // Pot Simulation
                const limit420 = getPotLimit('pot_420', d);
                if (dayOfMonth === 1 || dayOfMonth === 15) {
                    runningBalance -= (limit420 / 2);
                }

                const fridaysInMonth = countWeekdaysInMonth(currentYear, currentMonth, 5);
                if (dayOfWeek === 5) {
                    runningBalance -= (getPotLimit('pot_we', d) / fridaysInMonth);
                }

                const mondaysInMonth = countWeekdaysInMonth(currentYear, currentMonth, 1);
                if (dayOfWeek === 1) {
                    runningBalance -= (getPotLimit('pot_week', d) / mondaysInMonth);
                }

                if ([1, 8, 15, 22].includes(dayOfMonth)) {
                    runningBalance -= (getPotLimit('pot_smoke', d) / 4);
                }
            }

            const shortDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(d);
            const tooltipDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);

            data.push({
                day: d.getDate(),
                fullDate: dateStr,
                shortDate,
                tooltipDate,
                balance: runningBalance,
                isFuture
            });
        }
        return data;
    }, [transactions, recurringRules, forecastDate, potConfigs]);

    // Derived Projected Balance
    const projectedBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : stats.bankBalance;
    const mamaDebtRule = recurringRules.find(r => r.category === 'Rückzahlung Mama');

    // -- HANDLERS --

    const handlePotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPot || !potAmount) return;

        await onAddTransaction({
            amount: parseFloat(potAmount),
            category: selectedPot.category,
            date: potDate,
            type: 'expense',
            account: potAccount, 
            method: potAccount === 'cash' ? 'cash' : 'digital',
            note: `Abbuchung aus Topf: ${selectedPot.name}`,
            status: 'completed',
            isRecurring: false
        });

        setSelectedPot(null);
        setPotAmount('');
        setPotDate(new Date().toISOString().split('T')[0]);
    };

    const handlePotLimitEdit = (pot: any) => {
        setEditingPotId(pot.id);
        setEditPotLimit(pot.limit.toString());
        setSavePotFuture(false);
    };

    const savePotLimit = async () => {
        if (!editingPotId || !editPotLimit) return;
        
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const newLimit = parseFloat(editPotLimit);

        // 1. Save specific month override
        await dbService.savePotConfig({
            id: `${editingPotId}_${monthStr}`,
            potId: editingPotId,
            limit: newLimit,
            month: monthStr
        });

        // 2. If Future checked, save default override
        if (savePotFuture) {
             await dbService.savePotConfig({
                id: `${editingPotId}_default`,
                potId: editingPotId,
                limit: newLimit
            });
        }

        // Refresh configs
        const configs = await dbService.getPotConfigs();
        setPotConfigs(configs);
        setEditingPotId(null);
    };

    const toggleDebtRule = async (active: boolean) => {
        if (!mamaDebtRule || !onUpdateRule) return;
        await onUpdateRule({
            ...mamaDebtRule,
            active,
            amount: parseFloat(debtInstallment) || mamaDebtRule.amount
        });
        setShowDebtConfig(false);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const todayDisplay = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            {/* Header / Forecast Control */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {mode === 'daily' ? 'Finanzstatus' : 'Prognose & Verlauf'}
                    </h1>
                    <div className="flex items-center gap-4 mt-1">
                        <span className="text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded text-sm border border-blue-500/20">
                            {todayDisplay}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Wallet className="w-4 h-4" />
                            <span>Gesamt: <span className={stats.totalNetWorth >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{formatCurrency(stats.totalNetWorth)}</span></span>
                        </div>
                    </div>
                </div>
                
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                         <p className={`text-4xl font-bold tracking-tight ${stats.bankBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatCurrency(stats.bankBalance)}
                        </p>
                    ) : (
                         <p className={`text-4xl font-bold tracking-tight ${projectedBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatCurrency(projectedBalance)}
                        </p>
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
                </div>

                {/* Debt */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                <HeartHandshake className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-slate-300 font-medium">Schulden (Mama)</h3>
                        </div>
                        {mamaDebtRule && (
                            <button 
                                onClick={() => setShowDebtConfig(true)}
                                className={`text-xs px-2 py-1 rounded border ${
                                    mamaDebtRule.active 
                                        ? 'border-green-500 text-green-400 bg-green-500/10' 
                                        : 'border-slate-600 text-slate-500 bg-slate-900'
                                }`}
                            >
                                {mamaDebtRule.active ? 'Wird getilgt' : 'Pausiert'}
                            </button>
                        )}
                    </div>
                    <p className="text-3xl font-bold tracking-tight text-red-400">-{formatCurrency(stats.remainingDebt)}</p>
                    <p className="text-xs text-slate-500 mt-2">
                        {mamaDebtRule?.active ? `Monatl. Rate: ${formatCurrency(mamaDebtRule.amount)}` : 'Aktuell keine feste Rückzahlung.'}
                    </p>
                </div>

                {/* Permanent Positive Forecast */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                     <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-purple-400" />
                            </div>
                            <h3 className="text-slate-300 font-medium">Dauerhaft im Plus</h3>
                        </div>
                    </div>
                    <div className="flex flex-col h-full justify-between pb-2">
                        <p className="text-2xl font-bold text-purple-100">{permanentPositiveForecast.date}</p>
                        <p className="text-xs text-slate-500 mt-1">
                             {permanentPositiveForecast.status === 'positive' 
                                ? 'Konto gedeckt.' 
                                : 'Datum, ab dem das Konto nicht mehr ins Minus fällt.'}
                        </p>
                    </div>
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
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between hover:border-blue-500 transition-all group relative"
                        >
                            <div className="absolute top-2 right-2 flex gap-1">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePotLimitEdit(pot);
                                    }}
                                    className="p-1.5 rounded-full bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Budget ändern"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedPot(pot);
                                        setPotAccount('cash'); 
                                    }}
                                    className="p-1.5 rounded-full bg-blue-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                                    title="Ausgabe hinzufügen"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>

                            <div 
                                onClick={() => {
                                    setSelectedPot(pot);
                                    setPotAccount('cash'); 
                                }}
                                className="cursor-pointer"
                            >
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
                        </div>
                    );
                })}
            </div>

            {/* 3. Line Chart */}
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
                                dataKey="shortDate" 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={30} 
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
                                labelFormatter={(label, payload) => payload[0]?.payload.tooltipDate || label}
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

            {/* MODAL: Edit Pot Limit */}
            {editingPotId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-bold text-white">Budget anpassen</h3>
                            <button onClick={() => setEditingPotId(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-400">
                                Ändere das Limit für diesen Monat.
                            </p>
                             <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Neues Limit (€)</label>
                                <input 
                                    type="number" 
                                    autoFocus
                                    step="1" 
                                    required
                                    value={editPotLimit}
                                    onChange={(e) => setEditPotLimit(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-700/50">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox"
                                        id="saveFuture"
                                        checked={savePotFuture}
                                        onChange={(e) => setSavePotFuture(e.target.checked)}
                                        className="w-5 h-5 border-slate-600 rounded bg-slate-800 text-blue-500 focus:ring-offset-0 focus:ring-0"
                                    />
                                </div>
                                <label htmlFor="saveFuture" className="text-sm text-slate-300 select-none">
                                    Auch als neuen Standard speichern? <br/>
                                    <span className="text-[10px] text-slate-500">Gilt für alle künftigen Monate</span>
                                </label>
                            </div>

                            <button 
                                onClick={savePotLimit} 
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Debt Config */}
            {showDebtConfig && mamaDebtRule && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-bold text-white">Rückzahlung Konfigurieren</h3>
                            <button onClick={() => setShowDebtConfig(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <p className="text-sm text-slate-400">
                                Möchtest du die Rückzahlung der 1000€ an Mama in deine monatlichen Fixkosten (Girokonto) aufnehmen?
                            </p>
                            
                            {mamaDebtRule.active && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Monatliche Rate (€)</label>
                                    <input 
                                        type="number"
                                        value={debtInstallment}
                                        onChange={(e) => setDebtInstallment(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => toggleDebtRule(false)}
                                    className={`py-3 rounded-lg border font-medium transition-all ${
                                        !mamaDebtRule.active 
                                            ? 'bg-slate-700 border-slate-500 text-white' 
                                            : 'bg-transparent border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Pausieren
                                </button>
                                <button 
                                    onClick={() => toggleDebtRule(true)}
                                    className={`py-3 rounded-lg border font-medium transition-all ${
                                        mamaDebtRule.active 
                                            ? 'bg-green-600 border-green-500 text-white' 
                                            : 'bg-transparent border-green-800 text-green-500 hover:bg-green-900/20'
                                    }`}
                                >
                                    Aktivieren
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
