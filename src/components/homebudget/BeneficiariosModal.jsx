import { useState, useMemo } from 'react';
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

export default function BeneficiariosModal({ isOpen, onClose }) {
  const { allCurrentMonthTransactions } = useHomeBudget();
  const [searchTerm, setSearchTerm] = useState('');

  // Agrupar beneficiarios a partir de las transacciones
  const payeesList = useMemo(() => {
    const map = {};

    allCurrentMonthTransactions.forEach(t => {
      const name = (t.payee || t.description || t.subcategory || '').trim();
      if (!name || name === 'Ingreso' || name === 'Transferencia') return;

      if (!map[name]) {
        map[name] = {
          name,
          total: 0,
          count: 0,
          category: t.category || 'Varios',
          lastDate: t.date
        };
      }
      map[name].total = Math.round((map[name].total + t.amount) * 100) / 100;
      map[name].count++;
      if (t.date > map[name].lastDate) map[name].lastDate = t.date;
    });

    const list = Object.values(map).sort((a, b) => b.total - a.total);
    return list;
  }, [allCurrentMonthTransactions]);

  const filtered = useMemo(() => {
    if (!searchTerm) return payeesList;
    const q = searchTerm.toLowerCase();
    return payeesList.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [payeesList, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
              <span className="material-symbols-outlined text-lg">group</span>
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100">
                Directorio de Beneficiarios & Comercios
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {payeesList.length} comercios registrados en este mes
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

        {/* Buscador */}
        <div className="p-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Buscar comercio o beneficiario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 outline-none"
            />
          </div>
        </div>

        {/* Lista con Scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 p-2">
          {filtered.map((item, idx) => (
            <div key={idx} className="p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 rounded-xl transition-colors flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {item.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.count} {item.count === 1 ? 'movimiento' : 'movimientos'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                  {formatCurrency(item.total)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {item.lastDate}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No se encontraron beneficiarios con "{searchTerm}"
            </div>
          )}
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
