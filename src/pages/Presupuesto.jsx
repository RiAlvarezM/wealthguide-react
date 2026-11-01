import { useState, useMemo, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import QuickExpenseModal from '../components/gastos/QuickExpenseModal';
import { useTheme } from '../context/ThemeContext';
import summaryData from '../data/homebudgetSummary.json';

// Formato de moneda USD
function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCompact(val) {
  const num = Math.abs(Number(val) || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toFixed(0);
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
  'Alimentos': '#10b981',        // emerald
  'Casa/Alquiler': '#3b82f6',    // blue
  'Coche': '#f59e0b',            // amber
  'Compras': '#8b5cf6',          // purple
  'Cuidado Personal': '#ec4899', // pink
  'Educacion/cursos': '#06b6d4', // cyan
  'Entretenimiento': '#f97316',  // orange
  'Impuestos': '#ef4444',        // red
  'Inversion': '#14b8a6',        // teal
  'Seguro/Médico': '#6366f1',    // indigo
  'Suscripciones': '#a855f7',    // violet
  'Utilidades': '#84cc16',       // lime
  'Varias': '#64748b',           // slate
  'Viajes': '#0ea5e9'            // sky
};

function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] || '#94a3b8';
}

export default function Presupuesto() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Transacciones agregadas manualmente por el usuario (en sesión o guardadas localmente)
  const [customTransactions, setCustomTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('wealthguide_custom_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const monthlySummaries = summaryData.monthlySummaries || [];
  const yearlySummaries = summaryData.yearlySummaries || [];
  const allMonths = useMemo(() => monthlySummaries.map(m => m.month), [monthlySummaries]);

  // Mes por defecto: el último con gastos registrados (generalmente Octubre 2026)
  const defaultMonth = useMemo(() => {
    for (let i = monthlySummaries.length - 1; i >= 0; i--) {
      if (monthlySummaries[i].totalExpenses > 0) return monthlySummaries[i].month;
    }
    return monthlySummaries[monthlySummaries.length - 1]?.month || '2026-10';
  }, [monthlySummaries]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  // Sub-tabs: 'diario' (estilo HomeBudget) | 'resumen' | 'categorias' | 'presupuesto'
  const [activeTab, setActiveTab] = useState('diario');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [expandedCategory, setExpandedCategory] = useState(null);

  const monthIndex = useMemo(() => {
    return allMonths.indexOf(selectedMonth);
  }, [allMonths, selectedMonth]);

  // Guardar nueva transacción manual
  const handleSaveTransaction = (newTx) => {
    const updated = [newTx, ...customTransactions];
    setCustomTransactions(updated);
    try {
      localStorage.setItem('wealthguide_custom_expenses', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    const txMonth = newTx.date.substring(0, 7);
    setSelectedMonth(txMonth);
  };

  // Datos base del mes + transacciones manuales
  const currentMonthData = useMemo(() => {
    const base = monthlySummaries.find(m => m.month === selectedMonth) || {
      month: selectedMonth,
      totalExpenses: 0,
      totalIncome: 0,
      netSavings: 0,
      savingsRate: 0,
      expensesByCategory: {},
      expensesBySubcategory: {},
      expensesCount: 0,
      incomesCount: 0
    };

    // Calcular impacto de transacciones manuales en este mes
    const monthManualTxs = customTransactions.filter(t => t.date.startsWith(selectedMonth));
    let extraExpenses = 0;
    let extraIncomes = 0;
    const catMap = { ...base.expensesByCategory };

    monthManualTxs.forEach(t => {
      if (t.type === 'expense') {
        extraExpenses += t.amount;
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      } else if (t.type === 'income') {
        extraIncomes += t.amount;
      }
    });

    const totalExp = Math.round((base.totalExpenses + extraExpenses) * 100) / 100;
    const totalInc = Math.round((base.totalIncome + extraIncomes) * 100) / 100;
    const net = Math.round((totalInc - totalExp) * 100) / 100;
    const rate = totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 1000) / 10 : 0;

    return {
      ...base,
      totalExpenses: totalExp,
      totalIncome: totalInc,
      netSavings: net,
      savingsRate: rate,
      expensesByCategory: catMap,
      expensesCount: (base.expensesCount || 0) + monthManualTxs.filter(t => t.type === 'expense').length,
      incomesCount: (base.incomesCount || 0) + monthManualTxs.filter(t => t.type === 'income').length
    };
  }, [monthlySummaries, selectedMonth, customTransactions]);

  const prevMonthData = useMemo(() => {
    if (monthIndex <= 0) return null;
    return monthlySummaries[monthIndex - 1] || null;
  }, [monthlySummaries, monthIndex]);

  // Navegación de mes
  const handlePrevMonth = () => {
    if (monthIndex > 0) setSelectedMonth(allMonths[monthIndex - 1]);
  };

  const handleNextMonth = () => {
    if (monthIndex < allMonths.length - 1) setSelectedMonth(allMonths[monthIndex + 1]);
  };

  // Cálculo de Proyección de Fin de Mes (Run-Rate)
  const projection = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const now = new Date();
    const isCurrentCalendarMonth = (now.getFullYear() === year && (now.getMonth() + 1) === month);
    
    const dayPassed = isCurrentCalendarMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const currentExpenses = currentMonthData.totalExpenses || 0;
    
    const dailyPace = dayPassed > 0 ? (currentExpenses / dayPassed) : 0;
    const projectedTotal = isCurrentCalendarMonth ? (dailyPace * daysInMonth) : currentExpenses;

    const prev3 = [];
    for (let i = monthIndex - 1; i >= 0 && prev3.length < 3; i--) {
      if (monthlySummaries[i] && monthlySummaries[i].totalExpenses > 0) {
        prev3.push(monthlySummaries[i].totalExpenses);
      }
    }
    const avg3Months = prev3.length > 0 ? (prev3.reduce((s, v) => s + v, 0) / prev3.length) : currentExpenses;

    return {
      daysInMonth,
      dayPassed,
      isCurrentCalendarMonth,
      dailyPace,
      projectedTotal,
      avg3Months,
      diffVsAvg: projectedTotal - avg3Months,
      pctVsAvg: avg3Months > 0 ? ((projectedTotal - avg3Months) / avg3Months) * 100 : 0
    };
  }, [selectedMonth, currentMonthData, monthIndex, monthlySummaries]);

  // Comparativas porcentuales vs mes anterior
  const expenseDeltaPct = useMemo(() => {
    if (!prevMonthData || prevMonthData.totalExpenses === 0) return 0;
    return ((currentMonthData.totalExpenses - prevMonthData.totalExpenses) / prevMonthData.totalExpenses) * 100;
  }, [currentMonthData, prevMonthData]);

  const incomeDeltaPct = useMemo(() => {
    if (!prevMonthData || prevMonthData.totalIncome === 0) return 0;
    return ((currentMonthData.totalIncome - prevMonthData.totalIncome) / prevMonthData.totalIncome) * 100;
  }, [currentMonthData, prevMonthData]);

  // Ranking de categorías del mes
  const categoryRanking = useMemo(() => {
    const cats = Object.entries(currentMonthData.expensesByCategory || {})
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: currentMonthData.totalExpenses > 0 ? (amount / currentMonthData.totalExpenses) * 100 : 0,
        subcategories: currentMonthData.expensesBySubcategory?.[name] || {}
      }))
      .sort((a, b) => b.amount - a.amount);
    return cats;
  }, [currentMonthData]);

  // Chart 1: Ingresos vs Gastos
  const cashFlowChartData = useMemo(() => {
    const endIdx = monthIndex >= 0 ? monthIndex + 1 : monthlySummaries.length;
    const startIdx = Math.max(0, endIdx - 12);
    const slice = monthlySummaries.slice(startIdx, endIdx);

    const labels = slice.map(m => {
      const [y, mm] = m.month.split('-');
      return `${MONTH_NAMES[parseInt(mm, 10) - 1].substring(0, 3)} ${y.slice(2)}`;
    });

    return {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Ingresos',
          data: slice.map(m => m.totalIncome),
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.85)',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          type: 'bar',
          label: 'Gastos',
          data: slice.map(m => m.totalExpenses),
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.85)',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          type: 'line',
          label: 'Ahorro Neto',
          data: slice.map(m => m.netSavings),
          borderColor: isDark ? '#38bdf8' : '#0284c7',
          backgroundColor: isDark ? '#38bdf8' : '#0284c7',
          borderWidth: 2.5,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          tension: 0.2
        }
      ]
    };
  }, [monthlySummaries, monthIndex, isDark]);

  const cashFlowChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDark ? '#e4e4e7' : '#334155',
          font: { family: 'Plus Jakarta Sans', size: 12, weight: '500' },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
      },
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#64748b',
          font: { family: 'Plus Jakarta Sans', size: 11 },
          callback: (v) => '$' + formatCompact(v)
        }
      }
    }
  }), [isDark]);

  // Chart 2: Donut
  const categoryDonutData = useMemo(() => {
    const topCats = categoryRanking.slice(0, 7);
    const otherCats = categoryRanking.slice(7);
    const otherTotal = otherCats.reduce((s, c) => s + c.amount, 0);

    const labels = topCats.map(c => c.name);
    const data = topCats.map(c => c.amount);
    const colors = topCats.map(c => getCategoryColor(c.name));

    if (otherTotal > 0) {
      labels.push('Otros');
      data.push(otherTotal);
      colors.push('#94a3b8');
    }

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: isDark ? 2 : 1.5,
          borderColor: isDark ? '#18181b' : '#ffffff',
          hoverOffset: 6
        }
      ]
    };
  }, [categoryRanking, isDark]);

  const categoryDonutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: isDark ? '#e4e4e7' : '#334155',
          font: { family: 'Plus Jakarta Sans', size: 12 },
          boxWidth: 10,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed || 0;
            const pct = currentMonthData.totalExpenses > 0 ? ((val / currentMonthData.totalExpenses) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
          }
        }
      }
    },
    cutout: '68%'
  }), [isDark, currentMonthData.totalExpenses]);

  // Combinar transacciones de HomeBudget con transacciones manuales
  const allCurrentMonthTransactions = useMemo(() => {
    const historical = (summaryData.recentExpenses || []).filter(e => e.date.startsWith(selectedMonth));
    const manual = customTransactions.filter(t => t.date.startsWith(selectedMonth));

    const combined = [
      ...manual,
      ...historical.map(h => ({ ...h, type: 'expense' }))
    ];

    // Ordenar de más reciente a más antiguo
    return combined.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedMonth, customTransactions]);

  // Transacciones filtradas para el Diario
  const filteredTransactions = useMemo(() => {
    return allCurrentMonthTransactions.filter(tx => {
      if (selectedCategoryFilter !== 'all' && tx.category !== selectedCategoryFilter) {
        return false;
      }
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return (
          tx.category?.toLowerCase().includes(q) ||
          tx.subcategory?.toLowerCase().includes(q) ||
          tx.notes?.toLowerCase().includes(q) ||
          tx.account?.toLowerCase().includes(q) ||
          tx.payee?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allCurrentMonthTransactions, selectedCategoryFilter, searchFilter]);

  // Agrupación por días para el "Diario de Gastos" (HomeBudget Experience)
  const groupedByDay = useMemo(() => {
    const groups = {};
    for (const tx of filteredTransactions) {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  return (
    <AppLayout
      title="Gastos & Presupuesto"
      searchPlaceholder="Buscar transacciones, comercio, notas..."
    >
      {/* Barra Superior con Selector de Mes y Botón de Registro Rápido */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-lg">payments</span>
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Control de Gastos & Presupuesto
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Reemplazo nativo de HomeBudget • 101 meses de historia sincronizada
          </p>
        </div>

        {/* Acciones: Mes + Botón Nuevo Gasto */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* Selector de Mes */}
          <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={monthIndex <= 0}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Mes anterior"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-zinc-100 px-2 py-1 outline-none cursor-pointer"
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
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Mes siguiente"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>

          {/* Botón Principal para Agregar Gasto */}
          <button
            type="button"
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span className="whitespace-nowrap">+ Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ejecutivas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Ingresos */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ingresos</span>
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-xs sm:text-sm">arrow_downward</span>
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100">
            {formatCurrency(currentMonthData.totalIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {currentMonthData.incomesCount || 0} ingresos registrados
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gastos</span>
            <span className="p-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <span className="material-symbols-outlined text-xs sm:text-sm">arrow_upward</span>
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100">
            {formatCurrency(currentMonthData.totalExpenses)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {currentMonthData.expensesCount || 0} gastos registrados
          </div>
        </div>

        {/* Flujo Neto */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Flujo Neto</span>
            <span className={`p-1 rounded-md ${currentMonthData.netSavings >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              <span className="material-symbols-outlined text-xs sm:text-sm">account_balance_wallet</span>
            </span>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${currentMonthData.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(currentMonthData.netSavings)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            <span className={`font-semibold ${currentMonthData.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {currentMonthData.netSavings >= 0 ? 'Superávit' : 'Déficit'}
            </span>
          </div>
        </div>

        {/* Tasa de Ahorro */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Tasa Ahorro</span>
            <span className="p-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <span className="material-symbols-outlined text-xs sm:text-sm">savings</span>
            </span>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${currentMonthData.savingsRate >= 15 ? 'text-emerald-600 dark:text-emerald-400' : currentMonthData.savingsRate >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {currentMonthData.savingsRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {currentMonthData.savingsRate >= 20 ? 'Excelente ritmo (>20%)' : 'Ritmo familiar'}
          </div>
        </div>
      </div>

      {/* Proyección Predictiva (Run-Rate) */}
      <div className="bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-xl p-3.5 sm:p-4 mb-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">trending_up</span>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
              Proyección de Cierre de Mes (Run-Rate)
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              Ritmo de gasto: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatCurrency(projection.dailyPace)} / día</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-400">Cierre estimado:</span>{' '}
            <span className="font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(projection.projectedTotal)}</span>
          </div>
          <div>
            <span className="text-slate-400">Promedio histórico:</span>{' '}
            <span className="font-semibold text-slate-600 dark:text-zinc-400">{formatCurrency(projection.avg3Months)}</span>
          </div>
        </div>
      </div>

      {/* Sub-Pestañas con "Diario de Gastos" al frente */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('diario')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'diario'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          Diario de Gastos (App)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resumen')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'resumen'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">bar_chart</span>
          Flujo de Caja (12m)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categorias')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'categorias'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">pie_chart</span>
          Desglose por Categorías
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presupuesto')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'presupuesto'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">checklist</span>
          Presupuesto vs Real
        </button>
      </div>

      {/* TAB 1: DIARIO DE GASTOS ESTILO HOMEBUDGET */}
      {activeTab === 'diario' && (
        <div className="space-y-4">
          {/* Barra de Filtros del Diario */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Buscar por notas, comercio, cuenta..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 outline-none cursor-pointer flex-1 sm:flex-initial"
              >
                <option value="all">Todas las Categorías</option>
                {(summaryData.categories || []).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsQuickAddOpen(true)}
                className="text-xs font-bold px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nuevo
              </button>
            </div>
          </div>

          {/* Lista agrupada día a día */}
          <div className="space-y-4">
            {groupedByDay.map(([dayDate, txs]) => {
              const dayTotal = txs.reduce((s, t) => s + (t.type === 'income' ? -t.amount : t.amount), 0);

              return (
                <div key={dayDate} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  {/* Header del Día */}
                  <div className="bg-slate-50 dark:bg-zinc-800/60 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                      {dayDate}
                    </span>
                    <span className="font-mono text-slate-900 dark:text-zinc-100">
                      Gasto del día: {formatCurrency(dayTotal)}
                    </span>
                  </div>

                  {/* Transacciones del día */}
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {txs.map((tx) => {
                      const isIncome = tx.type === 'income';

                      return (
                        <div key={tx.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Icono de Categoría */}
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                              style={{
                                backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.15)' : `${getCategoryColor(tx.category)}20`,
                                color: isIncome ? '#10b981' : getCategoryColor(tx.category)
                              }}
                            >
                              <span className="material-symbols-outlined text-base">
                                {isIncome ? 'arrow_downward' : 'local_mall'}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                                  {tx.subcategory ? `${tx.category} • ${tx.subcategory}` : tx.category}
                                </span>
                                {tx.device && tx.device === 'Web App' && (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded">
                                    Nuevo
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                {tx.account && (
                                  <span className="font-medium text-slate-700 dark:text-zinc-300">
                                    {tx.account}
                                  </span>
                                )}
                                {(tx.payee || tx.notes) && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{tx.payee || tx.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Monto */}
                          <div className="text-right shrink-0">
                            <div className={`font-mono font-bold text-sm sm:text-base ${
                              isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-zinc-100'
                            }`}>
                              {isIncome ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {groupedByDay.length === 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-zinc-600 mb-2">
                  receipt_long
                </span>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                  No hay transacciones registradas en {formatMonthLabel(selectedMonth)}
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Usa el botón para registrar tu primer gasto del mes
                </p>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  + Registrar Gasto Ahora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FLUJO DE CAJA HISTÓRICO */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              Ingresos vs Gastos Mensuales (Últimos 12 Meses)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Barras verdes = Ingresos • Barras rojas = Gastos • Línea azul = Superávit Neto
            </p>
            <ChartCanvas type="bar" data={cashFlowChartData} options={cashFlowChartOptions} height={320} />
          </div>

          {/* Histórico Anual Consolidado */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-3">
              Histórico Anual Consolidado (2018 - 2026)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                    <th className="py-2.5 px-3 font-semibold">Año</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Ingresos Totales</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Gastos Totales</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Ahorro Neto</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tasa Ahorro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {yearlySummaries.slice().reverse().map((yr) => (
                    <tr key={yr.year} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-zinc-100">{yr.year}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(yr.totalIncome)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                        {formatCurrency(yr.totalExpenses)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${yr.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(yr.netSavings)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${yr.savingsRate >= 15 ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                          {yr.savingsRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORÍAS */}
      {activeTab === 'categorias' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs flex flex-col">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              Distribución del Gasto
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              {formatMonthLabel(selectedMonth)} • {formatCurrency(currentMonthData.totalExpenses)}
            </p>
            <div className="flex-1 min-h-[280px]">
              <ChartCanvas type="doughnut" data={categoryDonutData} options={categoryDonutOptions} height={280} />
            </div>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              Desglose por Categoría y Subcategoría
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Haz clic en cualquier categoría para expandir sus subcategorías
            </p>

            <div className="space-y-3">
              {categoryRanking.map((cat) => {
                const isExpanded = expandedCategory === cat.name;
                const subEntries = Object.entries(cat.subcategories || {}).sort((a, b) => b[1] - a[1]);

                return (
                  <div
                    key={cat.name}
                    className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: getCategoryColor(cat.name) }}
                        />
                        <span className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                          {cat.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({cat.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span className="material-symbols-outlined text-sm text-slate-400 transition-transform">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, cat.percentage)}%`,
                          backgroundColor: getCategoryColor(cat.name)
                        }}
                      />
                    </div>

                    {isExpanded && subEntries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5 pl-4">
                        {subEntries.map(([subName, subAmount]) => (
                          <div key={subName} className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 py-0.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                              {subName || 'General'}
                            </span>
                            <span className="font-medium text-slate-800 dark:text-zinc-200">
                              {formatCurrency(subAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRESUPUESTO VS REAL */}
      {activeTab === 'presupuesto' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
            Presupuesto Asignado vs Gasto Real
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
            Metas configuradas en HomeBudget por categoría ({summaryData.budgets?.length || 0} rubros)
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                  <th className="py-2.5 px-3 font-semibold">Categoría / Subcategoría</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Presupuesto</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gasto Real</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Saldo</th>
                  <th className="py-2.5 px-3 font-semibold text-center">% Ejecución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {(summaryData.budgets || []).slice(0, 35).map((b, i) => {
                  const pct = b.budgetAmount > 0 ? (b.actualExpense / b.budgetAmount) * 100 : 0;
                  const isOver = b.balance < 0;

                  return (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-zinc-100">{b.category}</div>
                        <div className="text-xs text-slate-400">{b.subcategory || 'General'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-zinc-300">
                        {formatCurrency(b.budgetAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-zinc-100">
                        {formatCurrency(b.actualExpense)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${!isOver ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(b.balance)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${!isOver ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'}`}>
                          {pct > 0 ? `${pct.toFixed(0)}%` : '0%'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) en Móvil */}
      <button
        type="button"
        onClick={() => setIsQuickAddOpen(true)}
        className="fixed bottom-6 right-6 z-40 sm:hidden w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/40 flex items-center justify-center active:scale-90 transition-transform"
        aria-label="Registrar Gasto Rápido"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Modal de Registro Rápido estilo HomeBudget */}
      <QuickExpenseModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={handleSaveTransaction}
        categories={summaryData.categories || []}
        accounts={summaryData.accounts || []}
      />
    </AppLayout>
  );
}
