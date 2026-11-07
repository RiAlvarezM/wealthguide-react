import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import QuickExpenseModal from '../components/gastos/QuickExpenseModal';
import { useHomeBudget } from '../context/HomeBudgetContext';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const INCOME_ICONS = {
  'ACP': 'work',
  'Salario ACP': 'work',
  'Copa': 'flight_takeoff',
  'Salario Copa': 'flight_takeoff',
  'Alquiler': 'apartment',
  'Fortesza': 'trending_up',
  'Intereses': 'percent',
  'Dividendos': 'pie_chart',
  'Smartcash': 'savings',
  'Cashback': 'redeem',
  'Plazo Fijo': 'lock_clock',
  'Puntos Banesco': 'stars',
  'Puntos Link': 'stars',
  'Otros': 'payments'
};

function getIncomeIcon(source = '') {
  for (const [key, icon] of Object.entries(INCOME_ICONS)) {
    if (source.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return 'payments';
}

/**
 * SCR_INCOME_LIST: Detalle de Ingresos por Categoría / Fuente
 * Especificación de UI/UX:
 *  1. Barra Superior con retroceso, selector temporal < nov 2026 >, total ingresos, botón '+'
 *  2. Lista Desplegable de Fuentes de Ingreso (Accordion):
 *     Fuente, monto acumulado, chevron expandir.
 *     Hijos: Transacción individual con concepto, fecha, cuenta y monto.
 *  3. Barra Inferior con selector 'Por Fuente' vs 'Por Fecha' y acceso a gráfico.
 */
export default function IngresosList() {
  const navigate = useNavigate();
  const {
    allMonths,
    selectedMonth,
    setSelectedMonth,
    monthIndex,
    handlePrevMonth,
    handleNextMonth,
    allCurrentMonthTransactions,
    openQuickAdd,
    isQuickAddOpen,
    quickAddType,
    closeQuickAdd,
    handleSaveTransaction,
    summaryData
  } = useHomeBudget();

  // Modo de visualización: 'source' (Por Fuente) | 'date' (Por Fecha)
  const [viewGrouping, setViewGrouping] = useState('source');
  // Fuentes expandidas
  const [expandedSources, setExpandedSources] = useState({});

  const toggleSource = (srcName) => {
    setExpandedSources(prev => ({
      ...prev,
      [srcName]: !prev[srcName]
    }));
  };

  // Filtrar solo transacciones de ingreso
  const incomeTransactions = useMemo(() => {
    return allCurrentMonthTransactions.filter(t => t.type === 'income');
  }, [allCurrentMonthTransactions]);

  // Total ingresos del periodo
  const totalPeriodIncome = useMemo(() => {
    return incomeTransactions.reduce((s, t) => s + t.amount, 0);
  }, [incomeTransactions]);

  // Agrupación por Fuente de Ingreso (Accordion)
  const groupedBySource = useMemo(() => {
    const map = {};
    for (const tx of incomeTransactions) {
      const src = tx.payee || tx.description || 'Otros';
      if (!map[src]) {
        map[src] = {
          name: src,
          total: 0,
          items: []
        };
      }
      map[src].total = Math.round((map[src].total + tx.amount) * 100) / 100;
      map[src].items.push(tx);
    }

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [incomeTransactions]);

  // Agrupación por Fecha (Día a Día)
  const groupedByDate = useMemo(() => {
    const map = {};
    for (const tx of incomeTransactions) {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [incomeTransactions]);

  return (
    <AppLayout title="Detalle de Ingresos">
      {/* 1. BARRA SUPERIOR DE NAVEGACIÓN */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/presupuesto')}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Volver al Home"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Ingresos del Periodo
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{formatCurrency(totalPeriodIncome)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Selector de Periodo */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={monthIndex <= 0}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Mes anterior"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 px-2 py-1 outline-none cursor-pointer"
            >
              {allMonths.map((m) => (
                <option key={m} value={m} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={monthIndex >= allMonths.length - 1}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Mes siguiente"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>

          {/* Botón '+' Nuevo Ingreso */}
          <button
            type="button"
            onClick={() => openQuickAdd('income')}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">Nuevo Ingreso</span>
          </button>
        </div>
      </div>

      {/* 2. MODO: POR FUENTE DE INGRESO (ACCORDION) */}
      {viewGrouping === 'source' && (
        <div className="space-y-3">
          {groupedBySource.map((src) => {
            const isExpanded = !!expandedSources[src.name];
            const icon = getIncomeIcon(src.name);

            return (
              <div
                key={src.name}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Elemento Fuente de Ingreso (Header) */}
                <div
                  onClick={() => toggleSource(src.name)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-xl">{icon}</span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100 truncate">
                        {src.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {src.items.length} {src.items.length === 1 ? 'abono registrado' : 'abonos registrados'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(src.total)}
                    </span>
                    <span className={`material-symbols-outlined text-slate-400 text-lg transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-emerald-500' : ''
                    }`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Elementos Transacción de Ingreso (Expandido) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-zinc-800/80 divide-y divide-slate-100 dark:divide-zinc-800/60 bg-slate-50/40 dark:bg-zinc-950/20">
                    {src.items.map((tx) => (
                      <div
                        key={tx.id}
                        className="px-4 py-3 sm:px-6 flex items-center justify-between gap-3 hover:bg-white dark:hover:bg-zinc-800/60 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                                {tx.description || tx.payee || 'Abono'}
                              </span>
                              {tx.device === 'Web App' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                  Nuevo
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{tx.date}</span>
                              {tx.account && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 dark:text-zinc-300 font-medium">{tx.account}</span>
                                </>
                              )}
                              {tx.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{tx.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(tx.amount)}
                          </span>
                          <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-sm group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-all">
                            chevron_right
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {groupedBySource.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-zinc-600 mb-2">
                payments
              </span>
              <p className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">
                No hay ingresos registrados en {formatMonthLabel(selectedMonth)}
              </p>
              <button
                type="button"
                onClick={() => openQuickAdd('income')}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                + Registrar Primer Ingreso
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2B. MODO: POR FECHA (DIARIO CRONOLÓGICO) */}
      {viewGrouping === 'date' && (
        <div className="space-y-4">
          {groupedByDate.map(([dayDate, txs]) => {
            const dayTotal = txs.reduce((s, t) => s + t.amount, 0);

            return (
              <div
                key={dayDate}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs"
              >
                <div className="bg-slate-50 dark:bg-zinc-800/60 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                    {dayDate}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(dayTotal)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {txs.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                          {tx.payee || tx.description || 'Ingreso'}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{tx.account}</span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="truncate">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                        +{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. BARRA INFERIOR DE CONTROLES */}
      <div className="mt-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Selector Segmentado: Por Fuente vs Por Fecha */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewGrouping('source')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewGrouping === 'source'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-sm">view_list</span>
            <span>Por Fuente</span>
          </button>

          <button
            type="button"
            onClick={() => setViewGrouping('date')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewGrouping === 'date'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            <span>Por Fecha</span>
          </button>
        </div>

        {/* Acceso a Vista Gráfica */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => navigate('/tendencia')}
            className="w-full sm:w-auto px-4 py-1.5 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-teal-600 dark:text-teal-400">bar_chart</span>
            <span>Resumen Gráfico</span>
          </button>
        </div>
      </div>

      {/* Modal de Registro Rápido */}
      <QuickExpenseModal
        isOpen={isQuickAddOpen}
        initialType={quickAddType}
        onClose={closeQuickAdd}
        onSave={handleSaveTransaction}
        categories={summaryData.categories || []}
        accounts={summaryData.accounts || []}
      />
    </AppLayout>
  );
}
