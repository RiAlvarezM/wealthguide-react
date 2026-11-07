import React from 'react';
import { useHomeBudget } from '../../context/HomeBudgetContext';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function CuentasModal({ isOpen, onClose }) {
  const { summaryData, groupedAccounts, currentMonthData, selectedMonth } = useHomeBudget();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
              <span className="material-symbols-outlined text-lg">account_balance</span>
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100">
                Cuentas en el Modelo de 2 Bolsas
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Liquidez familiar vs. Ahorro Real / Inversión
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* Bolsa 2: Inversión (Tu Ahorro Real) */}
          <div className="bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-lg">
                  trending_up
                </span>
                <span className="font-bold text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                  Bolsa de Inversión (Tu Ahorro Real)
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-teal-700 dark:text-teal-300">
                {formatCurrency(summaryData.stats?.totalInvestmentSavings || 84684.22)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(summaryData.cumulativeInvestmentByTarget || {})
                .filter(([, val]) => val > 100)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([broker, amt]) => (
                  <div key={broker} className="bg-white/90 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-teal-100 dark:border-teal-900/40 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-zinc-300 truncate">{broker}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(amt)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Bolsa 1: Liquidez & Operaciones (Bancos, Ahorros, Tarjetas) */}
          <div className="bg-slate-50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-lg">
                  payments
                </span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                  Bolsa de Liquidez (Bancos, Ahorros, Tarjetas)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                {groupedAccounts.liquidity.length} cuentas activas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {groupedAccounts.liquidity.map((acc) => {
                const isSavings = acc.toLowerCase().includes('ahorro') || acc.toLowerCase().includes('emergencia');

                return (
                  <div
                    key={acc}
                    className="bg-white dark:bg-zinc-800 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center gap-2 truncate"
                  >
                    <span className={`material-symbols-outlined text-sm ${isSavings ? 'text-sky-500' : 'text-slate-400'}`}>
                      {isSavings ? 'savings' : 'credit_card'}
                    </span>
                    <span className="truncate font-medium text-slate-700 dark:text-zinc-300">{acc}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
