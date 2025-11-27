
import React, { useEffect, useState, isValidElement } from 'react';
import { dbService } from './services/db';
import { Transaction, AppView, RecurringRule } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import Settings from './components/Settings';
import { LayoutDashboard, List, PlusCircle, Settings as SettingsIcon, Loader2, Undo2 } from 'lucide-react';

const App: React.FC = () => {
    const [view, setView] = useState<AppView>(AppView.DASHBOARD);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [dashboardMode, setDashboardMode] = useState<'monthly' | 'daily'>('daily');
    
    // Undo Stack
    const [undoStack, setUndoStack] = useState<{ label: string, action: () => Promise<void> }[]>([]);

    useEffect(() => {
        const init = async () => {
            try {
                await dbService.init();
                await refreshData();
            } catch (error) {
                console.error("Initialization failed", error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const refreshData = async () => {
        const [txData, rulesData] = await Promise.all([
            dbService.getAllTransactions(),
            dbService.getAllRules()
        ]);
        setTransactions(txData);
        setRecurringRules(rulesData);
    };

    // --- Undo Logic Wrapper ---
    const addUndoStep = (label: string, undoAction: () => Promise<void>) => {
        setUndoStack(prev => [...prev, { label, action: undoAction }]);
    };

    const handleUndo = async () => {
        if (undoStack.length === 0) return;
        const lastStep = undoStack[undoStack.length - 1];
        
        try {
            await lastStep.action();
            setUndoStack(prev => prev.slice(0, -1));
            await refreshData();
        } catch (error) {
            console.error("Undo failed", error);
            alert("Rückgängig machen fehlgeschlagen.");
        }
    };

    // --- Action Handlers ---

    const handleAddTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>, ruleData?: Omit<RecurringRule, 'id' | 'createdAt' | 'active'>) => {
        const newTx: Transaction = {
            ...txData,
            id: crypto.randomUUID(),
            createdAt: Date.now()
        };

        let newRule: RecurringRule | undefined;
        if (txData.isRecurring && ruleData) {
            const ruleId = crypto.randomUUID();
            newRule = {
                ...ruleData,
                id: ruleId,
                active: true,
                createdAt: Date.now()
            };
            newTx.recurringId = ruleId;
            await dbService.addRule(newRule);
        }

        await dbService.addTransaction(newTx);
        await refreshData();

        // Undo Logic
        addUndoStep('Hinzufügen rückgängig', async () => {
            await dbService.deleteTransaction(newTx.id);
            if (newRule) {
                await dbService.updateRule({ ...newRule, active: false });
            }
        });
    };

    const handleUpdateTransaction = async (updatedTx: Transaction, updateRule: boolean = false) => {
        const oldTx = transactions.find(t => t.id === updatedTx.id);
        if (!oldTx) return;

        await dbService.updateTransaction(updatedTx);
        
        let oldRule: RecurringRule | undefined;
        let ruleUpdated = false;

        // If requested, also update the master rule
        if (updateRule && updatedTx.recurringId) {
            const ruleToUpdate = recurringRules.find(r => r.id === updatedTx.recurringId);
            if (ruleToUpdate) {
                oldRule = { ...ruleToUpdate };
                const newRule = { 
                    ...ruleToUpdate, 
                    amount: updatedTx.amount,
                    note: updatedTx.note, // Optional: sync note
                    dayOfMonth: new Date(updatedTx.date).getDate() // Sync day
                };
                await dbService.updateRule(newRule);
                ruleUpdated = true;
            }
        }

        await refreshData();

        addUndoStep('Änderung rückgängig', async () => {
            await dbService.updateTransaction(oldTx);
            if (ruleUpdated && oldRule) {
                await dbService.updateRule(oldRule);
            }
        });
    };

    const handleDeleteTransaction = async (id: string) => {
        const txToDelete = transactions.find(t => t.id === id);
        if (!txToDelete) return;

        if (confirm('Möchten Sie diese Transaktion wirklich löschen?')) {
            await dbService.deleteTransaction(id);
            await refreshData();

            addUndoStep('Löschen rückgängig', async () => {
                await dbService.addTransaction(txToDelete);
            });
        }
    };

    const handleUpdateRule = async (updatedRule: RecurringRule) => {
        const oldRule = recurringRules.find(r => r.id === updatedRule.id);
        if (!oldRule) return;

        await dbService.updateRule(updatedRule);
        await refreshData();

        addUndoStep('Regeländerung rückgängig', async () => {
            await dbService.updateRule(oldRule);
        });
    };

    const handleImport = async (data: Transaction[]) => {
        await dbService.importData(data);
        await refreshData();
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400 flex-col gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p>Lade FinanceFlow...</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
            
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-center gap-3 px-4 py-4 mb-8">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <span className="font-bold text-white text-xl">€</span>
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        FinanceFlow
                    </span>
                </div>

                <nav className="flex-1 space-y-2">
                    <NavButton 
                        active={view === AppView.DASHBOARD} 
                        onClick={() => setView(AppView.DASHBOARD)} 
                        icon={<LayoutDashboard />} 
                        label="Übersicht" 
                    />
                    <NavButton 
                        active={view === AppView.TRANSACTIONS} 
                        onClick={() => setView(AppView.TRANSACTIONS)} 
                        icon={<List />} 
                        label="Transaktionen" 
                    />
                    <NavButton 
                        active={view === AppView.ADD} 
                        onClick={() => setView(AppView.ADD)} 
                        icon={<PlusCircle />} 
                        label="Neu Hinzufügen" 
                    />
                    <NavButton 
                        active={view === AppView.SETTINGS} 
                        onClick={() => setView(AppView.SETTINGS)} 
                        icon={<SettingsIcon />} 
                        label="Einstellungen" 
                    />
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto relative">
                <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-full">
                    {view === AppView.DASHBOARD && (
                        <Dashboard 
                            transactions={transactions} 
                            recurringRules={recurringRules}
                            mode={dashboardMode} 
                            setMode={setDashboardMode}
                            onAddTransaction={handleAddTransaction}
                            onUpdateRule={handleUpdateRule}
                        />
                    )}
                    {view === AppView.TRANSACTIONS && (
                        <TransactionList 
                            transactions={transactions} 
                            onDelete={handleDeleteTransaction} 
                            onUpdate={handleUpdateTransaction}
                        />
                    )}
                    {view === AppView.ADD && (
                        <TransactionForm 
                            onSubmit={async (tx, rule) => {
                                await handleAddTransaction(tx, rule);
                                setView(AppView.DASHBOARD);
                            }} 
                            onCancel={() => setView(AppView.DASHBOARD)} 
                        />
                    )}
                    {view === AppView.SETTINGS && (
                        <Settings 
                            transactions={transactions} 
                            onImport={handleImport} 
                        />
                    )}
                </div>
            </main>

            {/* FLOATING UNDO BUTTON (Global) */}
            {undoStack.length > 0 && (
                <div className="fixed bottom-20 left-6 md:bottom-8 md:left-auto md:right-8 z-[60]">
                    <button
                        onClick={handleUndo}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-800/90 backdrop-blur-md text-white rounded-full shadow-2xl border border-slate-600 hover:bg-slate-700 hover:scale-105 transition-all group"
                    >
                        <Undo2 className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
                        <span className="font-medium text-sm">Schritt zurück</span>
                    </button>
                </div>
            )}

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-3 flex justify-between items-center z-50 safe-area-bottom">
                <MobileNavIcon 
                    active={view === AppView.DASHBOARD} 
                    onClick={() => setView(AppView.DASHBOARD)} 
                    icon={<LayoutDashboard />} 
                />
                <MobileNavIcon 
                    active={view === AppView.TRANSACTIONS} 
                    onClick={() => setView(AppView.TRANSACTIONS)} 
                    icon={<List />} 
                />
                <div className="-mt-8">
                    <button 
                        onClick={() => setView(AppView.ADD)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                            view === AppView.ADD ? 'bg-blue-500 ring-4 ring-slate-900' : 'bg-blue-600'
                        }`}
                    >
                        <PlusCircle className="w-8 h-8 text-white" />
                    </button>
                </div>
                <MobileNavIcon 
                    active={view === AppView.SETTINGS} 
                    onClick={() => setView(AppView.SETTINGS)} 
                    icon={<SettingsIcon />} 
                />
            </nav>
        </div>
    );
};

// UI Helper Components
const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            active 
                ? 'bg-blue-600/10 text-blue-400 font-medium' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
    >
        {isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 20 }) : icon}
        {label}
    </button>
);

const MobileNavIcon = ({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) => (
    <button
        onClick={onClick}
        className={`p-2 rounded-lg transition-colors ${
            active ? 'text-blue-400' : 'text-slate-500'
        }`}
    >
        {isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 24 }) : icon}
    </button>
);

export default App;
