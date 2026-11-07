import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
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

/**
 * SCR_BUDGET_VS_ACTUAL_HISTORICAL: Comparativa Histórica de Presupuesto vs Real
 * Especificación de UI/UX:
 *  1. Barra Superior con botón atrás, rango de fechas evaluado, acceso a reportes
 *  2. Lista de Tarjetas de Rendimiento Presupuestario (Layout 4 cuadrantes + barra de progreso):
 *     - Superior Izq: Icono identificador y nombre de categoría
 *     - Superior Der: Gasto real ejecutado
 *     - Inferior Izq: Presupuesto total asignado
 *     - Inferior Der: Varianza / Saldo diferencial (+ o -)
 *     - Barra de progreso horizontal con indicador de superávit o sobrepasado
 *     - Control '>'
 */
export default function PresupuestoVsReal() {
  const navigate = useNavigate();
  const { summaryData, currentMonthData, selectedMonth, viewMode } = useHomeBudget();

  // Rango evaluado: 'historical' (2018 - 2026) | 'month' (Mes Activo)
  const [evalRange, setEvalRange] = useState('historical');
  const [filterQuery, setFilterQuery] = useState('');

  // Presupuesto por categorías
  // En 'historical', usa los 108 rubros del CSV de HomeBudget
  // En 'month', calcula el desglose del mes activo
  const budgetCards = useMemo(() => {
    if (evalRange === 'historical') {
      const list = (summaryData.budgets || []).map(b => {
        const spent = b.actualExpense || 0;
        const budget = b.budgetAmount || 0;
        const diff = Math.round((budget - spent) * 100) / 100;
        const pct = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
        return {
          category: b.category,
          subcategory: b.subcategory || 'General',
          budget,
          spent,
          diff,
          pct,
          isOver: diff < 0
        };
      });

      return list.sort((a, b) => b.spent - a.spent);
    } else {
      // Mes Activo: cruza las categorías del mes con su presupuesto proporcional
      const catsMap = viewMode === 'pools' ? currentMonthData.livingExpensesByCategory : currentMonthData.expensesByCategory;
      const list = Object.entries(catsMap || {}).map(([cat, spent]) => {
        // Encontrar presupuesto histórico mensualizado
        const catBudgets = (summaryData.budgets || []).filter(b => b.category === cat);
        const totalHistBudget = catBudgets.reduce((s, b) => s + b.budgetAmount, 0);
        const monthlyBudgetEstimated = Math.round((totalHistBudget / (summaryData.monthlySummaries?.length || 101)) * 100) / 100;
        const budget = monthlyBudgetEstimated > 0 ? monthlyBudgetEstimated : Math.round(spent * 1.1);
        const diff = Math.round((budget - spent) * 100) / 100;
        const pct = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);

        return {
          category: cat,
          subcategory: 'Consolidado Mensual',
          budget,
          spent,
          diff,
          pct,
          isOver: diff < 0
        };
      });

      return list.sort((a, b) => b.spent - a.spent);
    }
  }, [evalRange, summaryData, currentMonthData, viewMode]);

  const filteredCards = useMemo(() => {
    if (!filterQuery) return budgetCards;
    const q = filterQuery.toLowerCase();
    return budgetCards.filter(c => c.category.toLowerCase().includes(q) || c.subcategory.toLowerCase().includes(q));
  }, [budgetCards, filterQuery]);

  return (
    <AppLayout title="Presupuesto vs Real">
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
              Rango Evaluado
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{evalRange === 'historical' ? 'Histórico Acumulado (2018 - 2026)' : `Mes Activo (${selectedMonth})`}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50">
                {budgetCards.length} rubros
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Switch de Rango */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setEvalRange('historical')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                evalRange === 'historical'
                  ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Histórico
            </button>
            <button
              type="button"
              onClick={() => setEvalRange('month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                evalRange === 'month'
                  ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Mes Actual
            </button>
          </div>

          {/* Botón Gráfica */}
          <button
            type="button"
            onClick={() => navigate('/tendencia')}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Ver Gráficos y Tendencias"
          >
            <span className="material-symbols-outlined text-lg">trending_up</span>
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-sm">search</span>
          <input
            type="text"
            placeholder="Filtrar por categoría o subcategoría..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-100 outline-none shadow-xs"
          />
        </div>
      </div>

      {/* 2. LISTA DE TARJETAS DE RENDIMIENTO PRESUPUESTARIO (4 CUADRANTES + BARRA PROGRESO) */}
      <div className="space-y-3">
        {filteredCards.map((card, idx) => {
          const color = CATEGORY_COLORS[card.category] || '#94a3b8';
          const icon = CATEGORY_ICONS[card.category] || 'category';
          const visualPct = Math.min(100, Math.max(0, card.pct));

          return (
            <div
              key={idx}
              onClick={() => navigate('/gastos')}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group active:scale-[0.99]"
            >
              {/* Cuadrantes Superiores */}
              <div className="flex items-start justify-between gap-3 mb-3">
                {/* Superior Izquierda: Icono + Categoría / Subcategoría */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: `${color}18`, color }}
                  >
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100 truncate">
                      {card.category}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {card.subcategory}
                    </p>
                  </div>
                </div>

                {/* Superior Derecha: Gasto Real Ejecutado */}
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Gasto Real
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 font-mono">
                    {formatCurrency(card.spent)}
                  </div>
                </div>
              </div>

              {/* Barra de Progreso Horizontal Intermedia */}
              <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden mb-3 relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    card.isOver ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${visualPct}%` }}
                />
              </div>

              {/* Cuadrantes Inferiores */}
              <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                {/* Inferior Izquierda: Monto Presupuestado */}
                <div>
                  <span className="text-slate-400">Presupuesto: </span>
                  <span className="font-semibold text-slate-700 dark:text-zinc-300 font-mono">
                    {formatCurrency(card.budget)}
                  </span>
                </div>

                {/* Inferior Derecha: Varianza / Saldo Diferencial */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-slate-400">Saldo: </span>
                    <span className={`font-mono font-bold ${
                      card.isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {card.diff >= 0 ? `+${formatCurrency(card.diff)}` : formatCurrency(card.diff)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({card.pct.toFixed(0)}%)
                    </span>
                  </div>

                  <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-sm group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-all">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCards.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
            No se encontraron rubros presupuestarios con "{filterQuery}"
          </div>
        )}
      </div>
    </AppLayout>
  );
}
