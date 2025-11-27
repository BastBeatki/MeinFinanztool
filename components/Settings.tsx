
import React, { useRef, useState } from 'react';
import { Transaction } from '../types';
import { Download, Upload, AlertTriangle, CheckCircle, Database } from 'lucide-react';

interface SettingsProps {
    transactions: Transaction[];
    onImport: (data: Transaction[]) => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({ transactions, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

    const handleExport = () => {
        const dataStr = JSON.stringify(transactions, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finance-flow-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!Array.isArray(json)) throw new Error("Ungültiges Format: Root muss ein Array sein");
                
                await onImport(json);
                setStatus({ type: 'success', msg: 'Daten erfolgreich importiert!' });
                setTimeout(() => setStatus(null), 3000);
            } catch (err) {
                console.error(err);
                setStatus({ type: 'error', msg: 'Import fehlgeschlagen. Überprüfen Sie das JSON-Format.' });
            }
        };
        reader.readAsText(file);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-2xl mx-auto pb-20 md:pb-0 space-y-6">
            <h1 className="text-2xl font-bold text-white">Einstellungen</h1>

            {status && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {status.msg}
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Database className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Datenverwaltung</h2>
                    </div>
                    <p className="text-slate-400 text-sm">Exportieren Sie Ihre Daten als Backup oder übertragen Sie sie auf ein anderes Gerät.</p>
                </div>

                <div className="p-6 grid gap-6">
                    {/* Export */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-medium">Daten exportieren</h3>
                            <p className="text-slate-500 text-sm">Als JSON-Datei herunterladen ({transactions.length} Einträge)</p>
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Exportieren
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50"></div>

                    {/* Import */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-medium">Daten importieren</h3>
                            <p className="text-slate-500 text-sm">Aus Backup wiederherstellen (Überschreibt aktuelle Daten)</p>
                        </div>
                        <div>
                            <input
                                type="file"
                                accept=".json"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                            >
                                <Upload className="w-4 h-4" />
                                Importieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
             <div className="text-center text-slate-600 text-xs mt-10">
                <p>FinanceFlow v1.0.0</p>
                <p>Läuft lokal mit IndexedDB</p>
            </div>
        </div>
    );
};

export default Settings;
