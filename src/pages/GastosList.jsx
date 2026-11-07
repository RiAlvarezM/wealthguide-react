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

const CATEGORY_COLORS = {
  'Alimentos': '#10b981',
  'Casa/Alquiler': '#3b82f6',
  'Coche': '#f59e0b',
  'Compras': '#8b5cf6',
  'Cuidado Personal': '#ec4899',
  'Educacion/cursos': '#06b6d4',
  'Entretenimiento': '#f97316',
  'Impuestos': '#ef4444',
  'Inversion': '#14b8a6',
  'Seguro/Médico': '#6366f1',
  'Suscripciones': '#a855f7',
  'Utilidades': '#84cc16',
  'Varias': '#64748b',
  'Viajes': '#0ea5e9'
};

const CATEGORY_ICONS = {
  'Alimentos': 'restaurant',
  'Casa/Alquiler': 'home',
  'Coche': 'directions_car',
  'Compras': 'shopping_bag',
  'Cuidado Personal': 'spa',
  'Educacion/cursos': 'school',
  'Entretenimiento': 'movie',
  'Impuestos': 'account_balance',
  'Inversion': 'trending_up',
  'Seguro/Médico': 'health_and_safety',
  'Suscripciones': 'subscriptions',
  'Utilidades': 'bolt',
  'Varias': 'category',
  'Viajes': 'flight'
};

function isRecurringExpense(subcategory = '', category = '') {
  const text = (subcategory + ' ' + category).toLowerCase();
  return (
    text.includes('hipoteca') ||
    text.includes('alquiler') ||
    text.includes('mantenimiento') ||
    text.includes('seguro') ||
    text.includes('suscrip') ||
    text.includes('teléfono') ||
    text.includes('internet') ||
    text.includes('electricidad') ||
    text.includes('agua') ||
    text.includes('spotify') ||
    text.includes('netflix') ||
    text.includes('escuela')
  );
}

/**
 * SCR_EXPENSES_LIST: Detalle de Gastos por Categoría
 * Especificación de UI/UX:
 *  1. Barra Superior con botón atrás, selector paginado < nov 2026 >, sub-indicador total gastado, botón '+'
 *  2. Lista Desplegable de Categorías (Accordion): Icono, nombre, total, flecha expandir/colapsar.
 *     Hijos: Transacciones individuales con concepto, fecha, etiqueta 'Gasto recurrente', monto, '>'
 *  3. Barra Inferior con selector 'Por Categoría' vs 'Por Fecha' y acceso a gráfica.
 */
export default function GastosList() {
  const navigate = useNavigate();
  const {
    allMonths,
    selectedMonth,
    setSelectedMonth,
    monthIndex,
    handlePrevMonth,
    handleNextMonth,
    viewMode,
    currentMonthData,
    allCurrentMonthTransactions,
    openQuickAdd,
    isQuickAddOpen,
    quickAddType,
    closeQuickAdd,
    handleSaveTransaction,
    summaryData
  } = useHomeBudget();

  // Modo de visualización: 'category' (Accordion) | 'date' (Por Fecha)
  const [viewGrouping, setViewGrouping] = useState('category');
  // Filtro de bolsa: 'living' (Costo de Vida) | 'investment' (Mi Ahorro Real) | 'all' (Todos)
  const [subFilter, setSubFilter] = useState('living');
  // Categorías expandidas
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  // Filtrar transacciones según subFilter y viewMode
  const rawExpenseTxs = useMemo(() => {
    return allCurrentMonthTransactions.filter(t => t.type === 'expense' || t.poolKind === 'investment');
  }, [allCurrentMonthTransactions]);

  const livingTxs = useMemo(() => rawExpenseTxs.filter(t => t.poolKind === 'living'), [rawExpenseTxs]);
  const investmentTxs = useMemo(() => rawExpenseTxs.filter(t => t.poolKind === 'investment'), [rawExpenseTxs]);

  const livingTotal = useMemo(() => livingTxs.reduce((s, t) => s + t.amount, 0), [livingTxs]);
  const investmentTotal = useMemo(() => investmentTxs.reduce((s, t) => s + t.amount, 0), [investmentTxs]);
  const allTotal = useMemo(() => rawExpenseTxs.reduce((s, t) => s + t.amount, 0), [rawExpenseTxs]);

  const expenseTransactions = useMemo(() => {
    if (subFilter === 'living') return livingTxs;
    if (subFilter === 'investment') return investmentTxs;
    return rawExpenseTxs;
  }, [subFilter, livingTxs, investmentTxs, rawExpenseTxs]);

  // Total mostrado en el encabezado
  const totalPeriodExpenses = useMemo(() => {
    if (subFilter === 'living') return livingTotal;
    if (subFilter === 'investment') return investmentTotal;
    return allTotal;
  }, [subFilter, livingTotal, investmentTotal, allTotal]);

  // Agrupación por Categoría para Accordion
  const groupedByCategory = useMemo(() => {
    const map = {};
    for (const tx of expenseTransactions) {
      const cat = tx.category || 'Varias';
      if (!map[cat]) {
        map[cat] = {
          name: cat,
          total: 0,
          items: []
        };
      }
      map[cat].total = Math.round((map[cat].total + tx.amount) * 100) / 100;
      map[cat].items.push(tx);
    }

    // Ordenar categorías por mayor gasto
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenseTransactions]);

  // Agrupación por Fecha (Día a Día)
  const groupedByDate = useMemo(() => {
    const map = {};
    for (const tx of expenseTransactions) {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenseTransactions]);

  return (
    <AppLayout title="Detalle de Gastos">
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
              Gasto Acumulado del Periodo
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {formatCurrency(totalPeriodExpenses)}
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

          {/* Botón '+' Nuevo Gasto */}
          <button
            type="button"
            onClick={() => openQuickAdd('expense')}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">Nuevo Gasto</span>
          </button>
        </div>
      </div>

      {/* Selector de Bolsa: Costo de Vida vs Mi Ahorro / Inversión */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => setSubFilter('living')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
            subFilter === 'living'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">shopping_bag</span>
          <span>Costo de Vida Real ({formatCurrency(livingTotal)})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubFilter('investment')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
            subFilter === 'investment'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">trending_up</span>
          <span>Mi Ahorro / Inversión ({formatCurrency(investmentTotal)})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubFilter('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
            subFilter === 'all'
              ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50'
          }`}
        >
          <span>Todos ({formatCurrency(allTotal)})</span>
        </button>
      </div>

      {/* 2. MODO DE VISUALIZACIÓN: POR CATEGORÍA (ACCORDION) */}
      {viewGrouping === 'category' && (
        <div className="space-y-3">
          {groupedByCategory.map((cat) => {
            const isExpanded = !!expandedCategories[cat.name];
            const color = CATEGORY_COLORS[cat.name] || '#94a3b8';
            const icon = CATEGORY_ICONS[cat.name] || 'category';

            return (
              <div
                key={cat.name}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Elemento Categoría (Accordion Header) */}
                <div
                  onClick={() => toggleCategory(cat.name)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      <span className="material-symbols-outlined text-xl">{icon}</span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100 truncate">
                        {cat.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {cat.items.length} {cat.items.length === 1 ? 'transacción' : 'transacciones'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100">
                      {formatCurrency(cat.total)}
                    </span>
                    <span className={`material-symbols-outlined text-slate-400 text-lg transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-rose-500' : ''
                    }`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Elementos Transacción Individual (Expandido) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-zinc-800/80 divide-y divide-slate-100 dark:divide-zinc-800/60 bg-slate-50/40 dark:bg-zinc-950/20">
                    {cat.items.map((tx) => {
                      const isRec = isRecurringExpense(tx.subcategory, tx.category);

                      return (
                        <div
                          key={tx.id}
                          className="px-4 py-3 sm:px-6 flex items-center justify-between gap-3 hover:bg-white dark:hover:bg-zinc-800/60 transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                                  {tx.subcategory || tx.payee || tx.notes || 'Detalle'}
                                </span>

                                {isRec && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                                    Gasto recurrente
                                  </span>
                                )}

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
                                {tx.payee && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{tx.payee}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                              -{formatCurrency(tx.amount)}
                            </span>
                            <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-sm group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-all">
                              chevron_right
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {groupedByCategory.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-zinc-600 mb-2">
                shopping_bag
              </span>
              <p className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">
                No hay gastos registrados en {formatMonthLabel(selectedMonth)}
              </p>
              <button
                type="button"
                onClick={() => openQuickAdd('expense')}
                className="mt-4 px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                + Registrar Primer Gasto
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2B. MODO DE VISUALIZACIÓN: POR FECHA (DIARIO CRONOLÓGICO) */}
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
                  <span className="font-mono text-rose-600 dark:text-rose-400">
                    -{formatCurrency(dayTotal)}
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
                          {tx.category} • {tx.subcategory || tx.payee || 'Gasto'}
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

                      <div className="font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400 shrink-0">
                        -{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. BARRA INFERIOR DE CONTROLES Y FILTROS */}
      <div className="mt-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Selector Segmentado: Por Categoría vs Por Fecha */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewGrouping('category')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewGrouping === 'category'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-sm">view_list</span>
            <span>Por Categoría</span>
          </button>

          <button
            type="button"
            onClick={() => setViewGrouping('date')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewGrouping === 'date'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            <span>Por Fecha</span>
          </button>
        </div>

        {/* Acceso a Vista Gráfica / Estadísticas */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => navigate('/tendencia')}
            className="w-full sm:w-auto px-4 py-1.5 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-teal-600 dark:text-teal-400">pie_chart</span>
            <span>Estadísticas & Gráfica</span>
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
