import { useState, useMemo, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import QuickExpenseModal from '../components/gastos/QuickExpenseModal';
import { useTheme } from '../context/ThemeContext';
import summaryData from '../data/homebudgetSummary.json';
import {
  POOL_LIQUIDITY,
  POOL_INVESTMENT,
  getAccountPool,
  isInvestmentAccount,
  classifyTransfer,
  classifyTransaction,
  groupAccountsByPool,
  KNOWN_INVESTMENT_ACCOUNTS
} from '../lib/accountClassification';

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
  'Inversion': '#14b8a6',        // teal (Ahorro Real)
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

  // Modo de vista: 'pools' (2 Bolsas: Liquidez vs Ahorro Real / Inversión) | 'classic' (HomeBudget Histórico)
  const [viewMode, setViewMode] = useState('pools');

  // Transacciones manuales en LocalStorage
  const [customTransactions, setCustomTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('wealthguide_custom_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Base completa de transacciones bajo demanda (19.7k gastos, 1.9k ingresos, 2.8k transferencias)
  const [fullTransactions, setFullTransactions] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/data/homebudgetTransactions.json')
      .then(res => res.json())
      .then(data => {
        if (isMounted) setFullTransactions(data);
      })
      .catch(err => console.log('Using pre-indexed summary transactions', err));
    return () => { isMounted = false; };
  }, []);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('expense');

  const handleOpenAddExpense = () => {
    setQuickAddType('expense');
    setIsQuickAddOpen(true);
  };

  const handleOpenAddIncome = () => {
    setQuickAddType('income');
    setIsQuickAddOpen(true);
  };

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
  // Sub-tabs: 'diario' | 'cuentas' | 'resumen' | 'categorias' | 'presupuesto'
  const [activeTab, setActiveTab] = useState('diario');
  const [txTypeFilter, setTxTypeFilter] = useState('all'); // 'all' | 'living' | 'investment' | 'income' | 'internal'
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

  // Datos del mes actual consolidando histórico y manuales
  const currentMonthData = useMemo(() => {
    const base = monthlySummaries.find(m => m.month === selectedMonth) || {
      month: selectedMonth,
      totalExpenses: 0,
      livingExpenses: 0,
      investmentSavings: 0,
      totalIncome: 0,
      netSavings: 0,
      realNetSavings: 0,
      freeCashFlow: 0,
      savingsRate: 0,
      realSavingsRate: 0,
      expensesByCategory: {},
      livingExpensesByCategory: {},
      investmentBySubcategory: {},
      expensesCount: 0,
      incomesCount: 0,
      transfersCount: 0,
      internalTransfersAmount: 0
    };

    const monthManualTxs = customTransactions.filter(t => t.date.startsWith(selectedMonth));
    let extraExpenses = 0;
    let extraLivingExpenses = 0;
    let extraInvestmentSavings = 0;
    let extraIncomes = 0;
    const catMap = { ...(base.expensesByCategory || {}) };
    const livingCatMap = { ...(base.livingExpensesByCategory || {}) };
    const invMap = { ...(base.investmentBySubcategory || {}) };

    monthManualTxs.forEach(t => {
      if (t.type === 'expense') {
        extraExpenses += t.amount;
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        const isInv = t.category?.toLowerCase() === 'inversion' || isInvestmentAccount(t.account);
        if (isInv) {
          extraInvestmentSavings += t.amount;
          const target = t.subcategory || t.account || 'Inversión';
          invMap[target] = (invMap[target] || 0) + t.amount;
        } else {
          extraLivingExpenses += t.amount;
          livingCatMap[t.category] = (livingCatMap[t.category] || 0) + t.amount;
        }
      } else if (t.type === 'income') {
        extraIncomes += t.amount;
      } else if (t.type === 'transfer') {
        const kind = classifyTransfer(t.fromAccount || t.account, t.toAccount);
        if (kind === 'investment_contribution') {
          extraInvestmentSavings += t.amount;
          const target = t.toAccount || 'Inversión';
          invMap[target] = (invMap[target] || 0) + t.amount;
        } else if (kind === 'investment_withdrawal') {
          extraInvestmentSavings -= t.amount;
        }
      }
    });

    const totalExp = Math.round((base.totalExpenses + extraExpenses) * 100) / 100;
    const livingExp = Math.round(((base.livingExpenses !== undefined ? base.livingExpenses : base.totalExpenses) + extraLivingExpenses) * 100) / 100;
    const invSavings = Math.round(((base.investmentSavings || 0) + extraInvestmentSavings) * 100) / 100;
    const totalInc = Math.round((base.totalIncome + extraIncomes) * 100) / 100;
    const net = Math.round((totalInc - totalExp) * 100) / 100;
    const realNet = Math.round((totalInc - livingExp) * 100) / 100;
    const freeCash = Math.round((totalInc - livingExp - invSavings) * 100) / 100;
    const rate = totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 1000) / 10 : 0;
    const realRate = totalInc > 0 ? Math.round((invSavings / totalInc) * 1000) / 10 : 0;

    return {
      ...base,
      totalExpenses: totalExp,
      livingExpenses: livingExp,
      investmentSavings: invSavings,
      totalIncome: totalInc,
      netSavings: net,
      realNetSavings: realNet,
      freeCashFlow: freeCash,
      savingsRate: rate,
      realSavingsRate: realRate,
      expensesByCategory: catMap,
      livingExpensesByCategory: livingCatMap,
      investmentBySubcategory: invMap,
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

  // Proyección de Fin de Mes (Run-Rate)
  const projection = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const now = new Date();
    const isCurrentCalendarMonth = (now.getFullYear() === year && (now.getMonth() + 1) === month);
    
    const dayPassed = isCurrentCalendarMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const targetExpenses = viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses;
    
    const dailyPace = dayPassed > 0 ? (targetExpenses / dayPassed) : 0;
    const projectedTotal = isCurrentCalendarMonth ? (dailyPace * daysInMonth) : targetExpenses;

    const prev3 = [];
    for (let i = monthIndex - 1; i >= 0 && prev3.length < 3; i--) {
      if (monthlySummaries[i]) {
        const val = viewMode === 'pools' ? (monthlySummaries[i].livingExpenses || monthlySummaries[i].totalExpenses) : monthlySummaries[i].totalExpenses;
        if (val > 0) prev3.push(val);
      }
    }
    const avg3Months = prev3.length > 0 ? (prev3.reduce((s, v) => s + v, 0) / prev3.length) : targetExpenses;

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
  }, [selectedMonth, currentMonthData, monthIndex, monthlySummaries, viewMode]);

  // Ranking de categorías según la vista seleccionada
  const categoryRanking = useMemo(() => {
    const sourceMap = viewMode === 'pools'
      ? (currentMonthData.livingExpensesByCategory || {})
      : (currentMonthData.expensesByCategory || {});

    const totalBase = viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses;

    const cats = Object.entries(sourceMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalBase > 0 ? (amount / totalBase) * 100 : 0,
        subcategories: currentMonthData.expensesBySubcategory?.[name] || {}
      }))
      .sort((a, b) => b.amount - a.amount);
    return cats;
  }, [currentMonthData, viewMode]);

  // Chart 1: Ingresos vs Costo de Vida vs Inversión
  const cashFlowChartData = useMemo(() => {
    const endIdx = monthIndex >= 0 ? monthIndex + 1 : monthlySummaries.length;
    const startIdx = Math.max(0, endIdx - 12);
    const slice = monthlySummaries.slice(startIdx, endIdx);

    const labels = slice.map(m => {
      const [y, mm] = m.month.split('-');
      return `${MONTH_NAMES[parseInt(mm, 10) - 1].substring(0, 3)} ${y.slice(2)}`;
    });

    if (viewMode === 'pools') {
      return {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Ingresos',
            data: slice.map(m => m.totalIncome),
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.75)' : 'rgba(16, 185, 129, 0.85)',
            borderRadius: 4,
            barPercentage: 0.65,
            categoryPercentage: 0.8
          },
          {
            type: 'bar',
            label: 'Costo de Vida',
            data: slice.map(m => m.livingExpenses !== undefined ? m.livingExpenses : m.totalExpenses),
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.75)' : 'rgba(239, 68, 68, 0.85)',
            borderRadius: 4,
            barPercentage: 0.65,
            categoryPercentage: 0.8
          },
          {
            type: 'bar',
            label: 'Aporte Inversión (Ahorro)',
            data: slice.map(m => m.investmentSavings || 0),
            backgroundColor: isDark ? 'rgba(20, 184, 166, 0.85)' : 'rgba(20, 184, 166, 0.9)',
            borderRadius: 4,
            barPercentage: 0.65,
            categoryPercentage: 0.8
          },
          {
            type: 'line',
            label: 'Superávit Real',
            data: slice.map(m => m.realNetSavings !== undefined ? m.realNetSavings : m.netSavings),
            borderColor: isDark ? '#38bdf8' : '#0284c7',
            backgroundColor: isDark ? '#38bdf8' : '#0284c7',
            borderWidth: 2.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            tension: 0.2
          }
        ]
      };
    }

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
          label: 'Gastos Totales',
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
          tension: 0.2
        }
      ]
    };
  }, [monthlySummaries, monthIndex, isDark, viewMode]);

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

  // Chart 2: Donut de Gastos
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

  const categoryDonutOptions = useMemo(() => {
    const totalBase = viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses;
    return {
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
              const pct = totalBase > 0 ? ((val / totalBase) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    };
  }, [isDark, currentMonthData.livingExpenses, currentMonthData.totalExpenses, viewMode]);

  // Transacciones del mes actual (Gastos, Ingresos, Transferencias e Inversiones)
  const allCurrentMonthTransactions = useMemo(() => {
    let histExp = [];
    let histInc = [];
    let histTrn = [];

    if (fullTransactions) {
      histExp = (fullTransactions.expenses || []).filter(e => e.date.startsWith(selectedMonth));
      histInc = (fullTransactions.incomes || []).filter(i => i.date.startsWith(selectedMonth));
      histTrn = (fullTransactions.transfers || []).filter(t => t.date.startsWith(selectedMonth));
    } else {
      histExp = (summaryData.recentExpenses || []).filter(e => e.date.startsWith(selectedMonth));
      histInc = (summaryData.recentIncomes || []).filter(i => i.date.startsWith(selectedMonth));
      histTrn = (summaryData.recentTransfers || []).filter(t => t.date.startsWith(selectedMonth));
    }

    const manual = customTransactions.filter(t => t.date.startsWith(selectedMonth));

    // Clasificar cada transacción con el modelo de 2 bolsas
    const processedHistoricalExpenses = histExp.map(h => {
      const isInv = (h.category || '').toLowerCase() === 'inversion' || isInvestmentAccount(h.account);
      return {
        ...h,
        type: 'expense',
        poolKind: isInv ? 'investment' : 'living',
        displayCategory: isInv ? 'Aporte Inversión' : h.category
      };
    });

    const processedHistoricalIncomes = histInc.map(h => ({
      ...h,
      type: 'income',
      poolKind: 'income',
      displayCategory: 'Ingreso',
      payee: h.description || h.payee || 'Ingreso'
    }));

    const processedHistoricalTransfers = histTrn.map(t => {
      const transferKind = classifyTransfer(t.fromAccount, t.toAccount);
      return {
        ...t,
        type: 'transfer',
        poolKind: transferKind === 'investment_contribution' ? 'investment' : (transferKind === 'investment_withdrawal' ? 'investment_withdrawal' : 'internal'),
        account: t.fromAccount,
        displayCategory: transferKind === 'investment_contribution' ? 'Aporte Inversión' : 'Traspaso Interno'
      };
    });

    const processedManual = manual.map(m => {
      if (m.type === 'transfer') {
        const transferKind = classifyTransfer(m.fromAccount || m.account, m.toAccount);
        return {
          ...m,
          poolKind: transferKind === 'investment_contribution' ? 'investment' : (transferKind === 'investment_withdrawal' ? 'investment_withdrawal' : 'internal'),
          displayCategory: transferKind === 'investment_contribution' ? 'Aporte Inversión' : 'Traspaso Interno'
        };
      }
      if (m.type === 'income') {
        return {
          ...m,
          poolKind: 'income',
          displayCategory: 'Ingreso'
        };
      }
      const isInv = (m.category || '').toLowerCase() === 'inversion' || isInvestmentAccount(m.account);
      return {
        ...m,
        poolKind: isInv ? 'investment' : 'living',
        displayCategory: isInv ? 'Aporte Inversión' : m.category
      };
    });

    const combined = [
      ...processedManual,
      ...processedHistoricalExpenses,
      ...processedHistoricalIncomes,
      ...processedHistoricalTransfers
    ];

    // Ordenar de más reciente a más antiguo
    return combined.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedMonth, customTransactions, fullTransactions]);

  // Transacciones filtradas para el Diario
  const filteredTransactions = useMemo(() => {
    return allCurrentMonthTransactions.filter(tx => {
      // Filtro por tipo de movimiento (Bolsas)
      if (txTypeFilter === 'living' && tx.poolKind !== 'living') return false;
      if (txTypeFilter === 'investment' && tx.poolKind !== 'investment') return false;
      if (txTypeFilter === 'income' && tx.poolKind !== 'income') return false;
      if (txTypeFilter === 'internal' && tx.poolKind !== 'internal') return false;

      // Filtro por categoría (solo si está en 'all' o coincide)
      if (selectedCategoryFilter !== 'all') {
        if (tx.category !== selectedCategoryFilter && tx.displayCategory !== selectedCategoryFilter) {
          return false;
        }
      }

      // Filtro de texto
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return (
          tx.category?.toLowerCase().includes(q) ||
          tx.subcategory?.toLowerCase().includes(q) ||
          tx.notes?.toLowerCase().includes(q) ||
          tx.account?.toLowerCase().includes(q) ||
          tx.fromAccount?.toLowerCase().includes(q) ||
          tx.toAccount?.toLowerCase().includes(q) ||
          tx.payee?.toLowerCase().includes(q) ||
          tx.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allCurrentMonthTransactions, txTypeFilter, selectedCategoryFilter, searchFilter]);

  // Agrupación por días para el "Diario de Gastos" (HomeBudget Experience)
  const groupedByDay = useMemo(() => {
    const groups = {};
    for (const tx of filteredTransactions) {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  // Cuentas agrupadas
  const groupedAccounts = useMemo(() => {
    return groupAccountsByPool(summaryData.accounts || []);
  }, []);

  return (
    <AppLayout
      title="Gastos, Ahorro & Presupuesto"
      searchPlaceholder="Buscar transacciones, comercio, notas..."
    >
      {/* Barra Superior con Selector de Mes, Switch de Modelo 2 Bolsas y Botón de Registro Rápido */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <span className="material-symbols-outlined text-lg">account_balance</span>
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Flujo Diario: Costo de Vida & Ahorro
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Modelo de 2 Bolsas: <span className="font-semibold text-slate-700 dark:text-zinc-300">Liquidez</span> (Bancos/Ahorros/Tarjetas) y <span className="font-semibold text-teal-600 dark:text-teal-400">Inversión</span> (Tu Ahorro Real)
          </p>
        </div>

        {/* Acciones: Selector de Vista + Navegación de Mes + Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          
          {/* Switch de Modo de Vista */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('pools')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                viewMode === 'pools'
                  ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
              title="Separa el Costo de Vida de tu Ahorro Real en Inversión"
            >
              <span>⭐ 2 Bolsas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'classic'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
              title="Vista bruta tal como se exportó de HomeBudget"
            >
              <span>Clásico</span>
            </button>
          </div>

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

          {/* Botones de Registro Rápido */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenAddExpense}
              className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3 py-2 rounded-xl shadow-xs active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">remove</span>
              <span className="whitespace-nowrap">Gasto</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddIncome}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3 py-2 rounded-xl shadow-xs active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span className="whitespace-nowrap">Ingreso</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickAddType('transfer');
                setIsQuickAddOpen(true);
              }}
              className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3 py-2 rounded-xl shadow-xs active:scale-95 transition-all"
              title="Registrar Aporte a Inversión o Traspaso"
            >
              <span className="material-symbols-outlined text-base">swap_horiz</span>
              <span className="whitespace-nowrap">Transferir</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Ejecutivas según Vista */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Card 1: Ingresos */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ingresos Totales</span>
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-xs sm:text-sm">arrow_downward</span>
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100">
            {formatCurrency(currentMonthData.totalIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Entradas netas a la bolsa de liquidez
          </div>
        </div>

        {/* Card 2: Costo de Vida (2 Bolsas) vs Gastos Totales (Clásico) */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {viewMode === 'pools' ? 'Costo de Vida Real' : 'Gastos Totales'}
            </span>
            <span className="p-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <span className="material-symbols-outlined text-xs sm:text-sm">shopping_bag</span>
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100">
            {formatCurrency(viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
            {viewMode === 'pools' ? 'Sin distorsión de aportes de inversión' : 'Incluye compras de inversión'}
          </div>
        </div>

        {/* Card 3: Tu Ahorro Real (Inversión) en 2 Bolsas vs Flujo Neto en Clásico */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {viewMode === 'pools' ? 'Tu Ahorro Real (Inversión)' : 'Flujo Neto'}
            </span>
            <span className={`p-1 rounded-md ${viewMode === 'pools' ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : (currentMonthData.netSavings >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')}`}>
              <span className="material-symbols-outlined text-xs sm:text-sm">
                {viewMode === 'pools' ? 'trending_up' : 'account_balance_wallet'}
              </span>
            </span>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${viewMode === 'pools' ? 'text-teal-600 dark:text-teal-400' : (currentMonthData.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}`}>
            {formatCurrency(viewMode === 'pools' ? currentMonthData.investmentSavings : currentMonthData.netSavings)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
            {viewMode === 'pools'
              ? `Aportado a Schwab, Jubilación, etc.`
              : (currentMonthData.netSavings >= 0 ? 'Superávit del mes' : 'Déficit del mes')}
          </div>
        </div>

        {/* Card 4: Tasa de Ahorro Real (Inversión / Ingresos) */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 md:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {viewMode === 'pools' ? 'Tasa de Ahorro Real' : 'Tasa Histórica'}
            </span>
            <span className="p-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <span className="material-symbols-outlined text-xs sm:text-sm">savings</span>
            </span>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${
            (viewMode === 'pools' ? currentMonthData.realSavingsRate : currentMonthData.savingsRate) >= 15
              ? 'text-teal-600 dark:text-teal-400'
              : (viewMode === 'pools' ? currentMonthData.realSavingsRate : currentMonthData.savingsRate) >= 0
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            {(viewMode === 'pools' ? currentMonthData.realSavingsRate : currentMonthData.savingsRate).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {viewMode === 'pools' ? 'Aportes a Inversión / Ingresos' : 'Cálculo tradicional de HomeBudget'}
          </div>
        </div>
      </div>

      {/* Proyección Predictiva (Run-Rate) del Costo de Vida */}
      <div className="bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-transparent border border-teal-500/20 rounded-xl p-3.5 sm:p-4 mb-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">insights</span>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
              Ritmo Diario de Costo de Vida ({formatMonthLabel(selectedMonth)})
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              Paso actual: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatCurrency(projection.dailyPace)} / día</span>
              {viewMode === 'pools' && <span className="ml-1 text-teal-600 dark:text-teal-400 font-medium">(excluye inversiones)</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-400">Cierre proyectado:</span>{' '}
            <span className="font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(projection.projectedTotal)}</span>
          </div>
          <div>
            <span className="text-slate-400">Promedio histórico 3m:</span>{' '}
            <span className="font-semibold text-slate-600 dark:text-zinc-400">{formatCurrency(projection.avg3Months)}</span>
          </div>
        </div>
      </div>

      {/* Sub-Pestañas: Diario | Cuentas & 2 Bolsas | Flujo 12m | Categorías | Presupuesto */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('diario')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'diario'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          Diario de Movimientos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cuentas')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'cuentas'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">account_balance</span>
          Cuentas & 2 Bolsas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resumen')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'resumen'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
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
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
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
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">checklist</span>
          Presupuesto vs Real
        </button>
      </div>

      {/* TAB 1: DIARIO DE MOVIMIENTOS */}
      {activeTab === 'diario' && (
        <div className="space-y-4">
          {/* Barra de Filtros del Diario */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Filtros Rápidos por Bolsas */}
            <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-thin">
              <button
                type="button"
                onClick={() => setTxTypeFilter('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  txTypeFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                Todos ({allCurrentMonthTransactions.length})
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('living')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  txTypeFilter === 'living'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                Costo de Vida
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('investment')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
                  txTypeFilter === 'investment'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                <span>📈 Mi Ahorro / Inversión</span>
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('income')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  txTypeFilter === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                Ingresos
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('internal')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  txTypeFilter === 'internal'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                Traspasos Caja
              </button>
            </div>

            {/* Búsqueda y Categoría */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
                <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 outline-none cursor-pointer"
              >
                <option value="all">Categorías</option>
                {(summaryData.categories || []).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista agrupada día a día */}
          <div className="space-y-4">
            {groupedByDay.map(([dayDate, txs]) => {
              const dayLivingTotal = txs
                .filter(t => t.poolKind === 'living')
                .reduce((s, t) => s + t.amount, 0);

              const dayInvestTotal = txs
                .filter(t => t.poolKind === 'investment')
                .reduce((s, t) => s + t.amount, 0);

              return (
                <div key={dayDate} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  {/* Header del Día */}
                  <div className="bg-slate-50 dark:bg-zinc-800/60 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                      {dayDate}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px] sm:text-xs">
                      {dayLivingTotal > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          Vida: {formatCurrency(dayLivingTotal)}
                        </span>
                      )}
                      {dayInvestTotal > 0 && (
                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                          Ahorro: {formatCurrency(dayInvestTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Transacciones del día */}
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {txs.map((tx) => {
                      const isIncome = tx.poolKind === 'income';
                      const isInvest = tx.poolKind === 'investment';
                      const isInternal = tx.poolKind === 'internal';

                      return (
                        <div key={tx.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Icono según tipo de movimiento */}
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                              style={{
                                backgroundColor: isIncome
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : isInvest
                                  ? 'rgba(20, 184, 166, 0.18)'
                                  : isInternal
                                  ? 'rgba(14, 165, 233, 0.15)'
                                  : `${getCategoryColor(tx.category)}20`,
                                color: isIncome
                                  ? '#10b981'
                                  : isInvest
                                  ? '#0d9488'
                                  : isInternal
                                  ? '#0284c7'
                                  : getCategoryColor(tx.category)
                              }}
                            >
                              <span className="material-symbols-outlined text-base">
                                {isIncome ? 'arrow_downward' : isInvest ? 'trending_up' : isInternal ? 'swap_horiz' : 'shopping_bag'}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                                  {isInvest
                                    ? `Ahorro / Inversión • ${tx.subcategory || tx.toAccount || 'Broker'}`
                                    : isInternal
                                    ? `Traspaso: ${tx.fromAccount || tx.account} ➔ ${tx.toAccount}`
                                    : (tx.subcategory ? `${tx.category} • ${tx.subcategory}` : tx.category || tx.displayCategory)}
                                </span>

                                {isInvest && (
                                  <span className="text-[10px] bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800">
                                    📈 Mi Ahorro
                                  </span>
                                )}

                                {isInternal && (
                                  <span className="text-[10px] bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-medium px-1.5 py-0.2 rounded">
                                    Traspaso Interno
                                  </span>
                                )}

                                {tx.device && tx.device === 'Web App' && (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded">
                                    Nuevo
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                {(tx.account || tx.fromAccount) && (
                                  <span className="font-medium text-slate-700 dark:text-zinc-300">
                                    {tx.fromAccount || tx.account}
                                  </span>
                                )}
                                {(tx.payee || tx.notes || tx.description) && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{tx.payee || tx.description || tx.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Monto */}
                          <div className="text-right shrink-0">
                            <div className={`font-mono font-bold text-sm sm:text-base ${
                              isIncome ? 'text-emerald-600 dark:text-emerald-400' :
                              isInvest ? 'text-teal-600 dark:text-teal-400' :
                              isInternal ? 'text-sky-600 dark:text-sky-400' :
                              'text-slate-900 dark:text-zinc-100'
                            }`}>
                              {isIncome ? `+${formatCurrency(tx.amount)}` :
                               isInvest ? `${formatCurrency(tx.amount)}` :
                               isInternal ? `${formatCurrency(tx.amount)}` :
                               `-${formatCurrency(tx.amount)}`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {isIncome ? 'Ingreso' : isInvest ? 'Aporte Patrimonial' : isInternal ? 'Caja Interna' : 'Costo Vida'}
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
                  No hay transacciones que coincidan en {formatMonthLabel(selectedMonth)}
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Prueba cambiando el filtro de movimiento o registra un nuevo gasto/aporte
                </p>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  + Registrar Movimiento Ahora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CUENTAS & 2 BOLSAS (NUEVO) */}
      {activeTab === 'cuentas' && (
        <div className="space-y-6">
          {/* Bolsa 2: Inversión (Tu Ahorro Real) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
                    <span className="material-symbols-outlined text-lg">trending_up</span>
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Bolsa de Inversión (Tu Ahorro Real / Patrimonio)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Dinero acumulado en brokers, jubilación y activos a lo largo del tiempo
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Total Histórico Aportado</div>
                <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">
                  {formatCurrency(summaryData.stats?.totalInvestmentSavings || 84684.22)}
                </div>
              </div>
            </div>

            {/* Grid de Destinos / Brokers de Inversión */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(summaryData.cumulativeInvestmentByTarget || {})
                .filter(([, amt]) => amt > 100)
                .sort((a, b) => b[1] - a[1])
                .map(([target, amount]) => {
                  const thisMonthAmount = currentMonthData.investmentBySubcategory?.[target] || 0;

                  return (
                    <div
                      key={target}
                      className="bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-3.5 hover:border-teal-400/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                          {target}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50">
                          Inversión
                        </span>
                      </div>

                      <div className="text-lg font-black text-slate-900 dark:text-zinc-100 mb-1">
                        {formatCurrency(amount)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-200/60 dark:border-zinc-700/60">
                        <span>Aporte en {formatMonthLabel(selectedMonth)}:</span>
                        <span className={`font-semibold ${thisMonthAmount > 0 ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-400'}`}>
                          {thisMonthAmount > 0 ? `+${formatCurrency(thisMonthAmount)}` : '$0.00'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Bolsa 1: Liquidez & Operaciones (Bancos, Ahorros, Tarjetas) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                    <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Bolsa de Liquidez (Operativas + Ahorros Bancarios)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Cuentas de caja común: traspasos entre ellas son transferencias internas neutras
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Traspasos Internos ({formatMonthLabel(selectedMonth)})</div>
                <div className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400">
                  {formatCurrency(currentMonthData.internalTransfersAmount || 0)}
                </div>
              </div>
            </div>

            {/* Listado de cuentas de liquidez */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {groupedAccounts.liquidity.map((acc) => {
                const isSavings = acc.toLowerCase().includes('ahorro') || acc.toLowerCase().includes('emergencia') || acc.toLowerCase().includes('nequi');

                return (
                  <div
                    key={acc}
                    className="bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-3 flex items-center gap-2.5"
                  >
                    <span className={`material-symbols-outlined text-base ${isSavings ? 'text-sky-500' : 'text-slate-400'}`}>
                      {isSavings ? 'savings' : 'credit_card'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate">
                        {acc}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isSavings ? 'Ahorro Bancario' : 'Corriente / Tarjeta'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FLUJO DE CAJA HISTÓRICO */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              {viewMode === 'pools' ? 'Ingresos vs Costo de Vida vs Inversión (Últimos 12 Meses)' : 'Ingresos vs Gastos Mensuales (Últimos 12 Meses)'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              {viewMode === 'pools'
                ? 'Barras verdes = Ingresos • Barras rojas = Costo de Vida • Barras teal = Aporte a Inversión (Ahorro)'
                : 'Barras verdes = Ingresos • Barras rojas = Gastos Totales • Línea azul = Ahorro Neto'}
            </p>
            <ChartCanvas type="bar" data={cashFlowChartData} options={cashFlowChartOptions} height={320} />
          </div>

          {/* Histórico Anual Consolidado */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-3">
              Histórico Anual Consolidado ({yearlySummaries[0]?.year} - {yearlySummaries[yearlySummaries.length - 1]?.year})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                    <th className="py-2.5 px-3 font-semibold">Año</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Ingresos</th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      {viewMode === 'pools' ? 'Costo de Vida' : 'Gastos Totales'}
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      {viewMode === 'pools' ? 'Aporte Inversión (Ahorro)' : 'Ahorro Neto'}
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      {viewMode === 'pools' ? 'Tasa Ahorro Real' : 'Tasa Histórica'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {yearlySummaries.slice().reverse().map((yr) => {
                    const living = yr.livingExpenses !== undefined ? yr.livingExpenses : yr.totalExpenses;
                    const inv = yr.investmentSavings || 0;
                    const rate = viewMode === 'pools' ? (yr.realSavingsRate || 0) : yr.savingsRate;

                    return (
                      <tr key={yr.year} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-zinc-100">{yr.year}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(yr.totalIncome)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          {formatCurrency(viewMode === 'pools' ? living : yr.totalExpenses)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${viewMode === 'pools' ? 'text-teal-600 dark:text-teal-400' : (yr.netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                          {formatCurrency(viewMode === 'pools' ? inv : yr.netSavings)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${rate >= 15 ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 font-bold' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CATEGORÍAS */}
      {activeTab === 'categorias' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 shadow-xs flex flex-col">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              Distribución del {viewMode === 'pools' ? 'Costo de Vida' : 'Gasto'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              {formatMonthLabel(selectedMonth)} • {formatCurrency(viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses)}
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

      {/* TAB 5: PRESUPUESTO VS REAL */}
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

      {/* Floating Action Buttons (FAB) en Móvil */}
      <div className="fixed bottom-20 right-4 z-40 sm:hidden flex flex-col gap-2 items-end">
        <button
          type="button"
          onClick={() => {
            setQuickAddType('transfer');
            setIsQuickAddOpen(true);
          }}
          className="h-10 px-3.5 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-600/30 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">swap_horiz</span>
          <span>Transferir</span>
        </button>
        <button
          type="button"
          onClick={handleOpenAddIncome}
          className="h-10 px-3.5 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>+ Ingreso</span>
        </button>
        <button
          type="button"
          onClick={handleOpenAddExpense}
          className="h-11 px-4 rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/40 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">remove</span>
          <span>+ Gasto</span>
        </button>
      </div>

      {/* Modal de Registro Rápido estilo HomeBudget */}
      <QuickExpenseModal
        isOpen={isQuickAddOpen}
        initialType={quickAddType}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={handleSaveTransaction}
        categories={summaryData.categories || []}
        accounts={summaryData.accounts || []}
      />
    </AppLayout>
  );
}
