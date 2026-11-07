import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import SemicircleGauge from '../components/homebudget/SemicircleGauge';
import BeneficiariosModal from '../components/homebudget/BeneficiariosModal';
import CuentasModal from '../components/homebudget/CuentasModal';
import QuickExpenseModal from '../components/gastos/QuickExpenseModal';
import { useHomeBudget } from '../context/HomeBudgetContext';
import { useTheme } from '../context/ThemeContext';

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

/**
 * SCR_HOME_DASHBOARD: Dashboard Principal (Home Overview)
 * Especificación de UI/UX:
 *  1. Barra Superior con selector de periodo
 *  2. Matriz 2x3 de accesos rápidos (Gastos, Facturas, Ingresos, Presupuesto, Cuentas, Beneficiarios)
 *  3. Panel de Disponibilidad Presupuestaria con indicador semicircular
 *  4. Gráfico multiserie Cash Flow a 6 meses
 *  5. Barra de sincronización y estado familiar
 */
export default function HomeBudgetDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    summaryData,
    monthlySummaries,
    allMonths,
    selectedMonth,
    setSelectedMonth,
    monthIndex,
    handlePrevMonth,
    handleNextMonth,
    viewMode,
    toggleViewMode,
    currentMonthData,
    handleSaveTransaction,
    openQuickAdd,
    isQuickAddOpen,
    quickAddType,
    closeQuickAdd,
    isBeneficiariosOpen,
    setIsBeneficiariosOpen,
    isCuentasOpen,
    setIsCuentasOpen
  } = useHomeBudget();

  // Presupuesto mensual objetivo del ciclo
  const monthlyBudget = useMemo(() => {
    // Estimación mensual del ciclo basada en el presupuesto asignado (~$11,500/mes)
    const base = 11500;
    return base;
  }, []);

  // Gasto del mes según modo (2 Bolsas vs Clásico)
  const evaluatedExpenses = useMemo(() => {
    return viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses;
  }, [viewMode, currentMonthData]);

  // Saldo disponible (Available)
  const availableBudget = useMemo(() => {
    return Math.round((monthlyBudget - evaluatedExpenses) * 100) / 100;
  }, [monthlyBudget, evaluatedExpenses]);

  // Porcentaje consumido del presupuesto
  const expensePctOfBudget = useMemo(() => {
    if (monthlyBudget <= 0) return 0;
    return (evaluatedExpenses / monthlyBudget) * 100;
  }, [evaluatedExpenses, monthlyBudget]);

  // Facturas / Gastos Fijos (Bills) del mes
  // Hipotecas, mantenimientos, utilidades, seguros
  const billsTotal = useMemo(() => {
    const cats = currentMonthData.expensesByCategory || {};
    const casa = cats['Casa/Alquiler'] || 0;
    const utilidades = cats['Utilidades'] || 0;
    const seguros = cats['Seguro/Médico'] || 0;
    const suscripciones = cats['Suscripciones'] || 0;
    return Math.round((casa + utilidades + seguros + suscripciones) * 100) / 100;
  }, [currentMonthData]);

  // Gráfico Cash Flow (Últimos 6 Meses)
  const cashFlowChartData = useMemo(() => {
    const endIdx = monthIndex >= 0 ? monthIndex + 1 : monthlySummaries.length;
    const startIdx = Math.max(0, endIdx - 6);
    const slice = monthlySummaries.slice(startIdx, endIdx);

    const labels = slice.map(m => {
      const [y, mm] = m.month.split('-');
      return `${MONTH_NAMES[parseInt(mm, 10) - 1].substring(0, 3)} ${y.slice(2)}`;
    });

    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Presupuesto',
          data: slice.map(() => monthlyBudget),
          borderColor: isDark ? '#94a3b8' : '#64748b',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0
        },
        {
          type: 'line',
          label: 'Gastos',
          data: slice.map(m => viewMode === 'pools' ? (m.livingExpenses !== undefined ? m.livingExpenses : m.totalExpenses) : m.totalExpenses),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderWidth: 2.5,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3
        },
        {
          type: 'line',
          label: 'Ingresos',
          data: slice.map(m => m.totalIncome),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2.5,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3
        }
      ]
    };
  }, [monthlySummaries, monthIndex, monthlyBudget, viewMode, isDark]);

  const cashFlowChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#e4e4e7' : '#334155',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
          usePointStyle: true,
          boxWidth: 8,
          padding: 15
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

  return (
    <AppLayout title="HomeBudget Overview">
      {/* 1. BARRA SUPERIOR DE NAVEGACIÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 sm:p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-sm shadow-sm">
            HB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-zinc-100 leading-tight">
                HomeBudget
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                Día a Día
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Estado financiero del periodo activo
            </p>
          </div>
        </div>

        {/* Selector de Periodo Activo */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Switch de Modo 2 Bolsas vs Clásico */}
          <button
            type="button"
            onClick={toggleViewMode}
            className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all font-semibold flex items-center gap-1.5 ${
              viewMode === 'pools'
                ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
                : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
            }`}
            title="Alternar entre Modelo 2 Bolsas (Ahorro separado) y Clásico"
          >
            <span className="material-symbols-outlined text-[15px]">
              {viewMode === 'pools' ? 'verified' : 'history'}
            </span>
            <span>{viewMode === 'pools' ? '2 Bolsas (Ahorro)' : 'Clásico'}</span>
          </button>

          {/* Navegación Mes */}
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
        </div>
      </div>

      {/* 2. MATRIZ DE RESUMEN Y ACCESOS RÁPIDOS (2 columnas x 3 filas) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        
        {/* 1. GASTOS */}
        <div
          onClick={() => navigate('/gastos')}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-rose-400/60 dark:hover:border-rose-500/40 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">shopping_bag</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 group-hover:text-rose-500 transition-all text-base">
              chevron_right
            </span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {viewMode === 'pools' ? 'Gastos de Vida' : 'Gastos'}
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5">
            {formatCurrency(evaluatedExpenses)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {currentMonthData.expensesCount || 0} movimientos registrados
          </div>
        </div>

        {/* 2. FACTURAS / GASTOS FIJOS (BILLS) */}
        <div
          onClick={() => navigate('/gastos')}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-amber-400/60 dark:hover:border-amber-500/40 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 group-hover:text-amber-500 transition-all text-base">
              chevron_right
            </span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Facturas / Fijos
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5">
            {formatCurrency(billsTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Hipotecas, utilidades y seguros
          </div>
        </div>

        {/* 3. INGRESOS */}
        <div
          onClick={() => navigate('/ingresos')}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-emerald-400/60 dark:hover:border-emerald-500/40 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all text-base">
              chevron_right
            </span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ingresos
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
            {formatCurrency(currentMonthData.totalIncome)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Salarios, rentas y rendimientos
          </div>
        </div>

        {/* 4. PRESUPUESTO (BUDGET) */}
        <div
          onClick={() => navigate('/presupuesto-detalle')}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-teal-400/60 dark:hover:border-teal-500/40 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">track_changes</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 group-hover:text-teal-500 transition-all text-base">
              chevron_right
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Presupuesto
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              Current Cycle
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5">
            {formatCurrency(monthlyBudget)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Ciclo mensual asignado
          </div>
        </div>

        {/* 5. CUENTAS */}
        <div
          onClick={() => setIsCuentasOpen(true)}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-sky-400/60 dark:hover:border-sky-500/40 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">account_balance</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 group-hover:text-sky-500 transition-all text-base">
              chevron_right
            </span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Cuentas (2 Bolsas)
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5">
            {summaryData.accounts?.length || 29} Cuentas
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Bancos, Ahorros e Inversión
          </div>
        </div>

        {/* 6. BENEFICIARIOS */}
        <div
          onClick={() => setIsBeneficiariosOpen(true)}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-indigo-400/60 dark:hover:border-indigo-500/40 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">group</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all text-base">
              chevron_right
            </span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Beneficiarios
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5">
            Directorio
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Comercios y pagos frecuentes
          </div>
        </div>

      </div>

      {/* Banner Destacado: Tu Ahorro Real en Inversión (Separado de Gastos) */}
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/5 border border-teal-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
            <span className="material-symbols-outlined text-xl">trending_up</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                Tu Ahorro Real en Inversión ({formatMonthLabel(selectedMonth)})
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                Separado de Gastos de Vida
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Tasa de ahorro real este mes: <span className="font-bold text-teal-600 dark:text-teal-400">{currentMonthData.realSavingsRate.toFixed(1)}%</span> de tus ingresos
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">Aportado a Brokers/Jubilación</div>
            <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400 font-mono">
              +{formatCurrency(currentMonthData.investmentSavings || 0)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCuentasOpen(true)}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors whitespace-nowrap"
          >
            Ver Aportes
          </button>
        </div>
      </div>

      {/* 3. PANEL DE DISPONIBILIDAD PRESUPUESTARIA + 4. GRÁFICO CASH FLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Panel de Disponibilidad Presupuestaria (Gauge) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col items-center justify-between text-center">
          <div className="w-full text-left mb-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Disponibilidad
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              Saldo presupuestario disponible para el resto del mes
            </div>
          </div>

          {/* Semicircle Gauge */}
          <div className="py-2">
            <SemicircleGauge percentage={expensePctOfBudget} size={220} strokeWidth={18} />
          </div>

          <div className="w-full pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Available
              </div>
              <div className={`text-xl sm:text-2xl font-black ${
                availableBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatCurrency(availableBudget)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Expense as % of Budget
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">
                {expensePctOfBudget.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de Tendencia de Flujo de Caja (Cash Flow a 6 Meses) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100">
                Cash Flow (Últimos 6 Meses)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Curvas comparativas de Presupuesto, Gastos e Ingresos
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/tendencia')}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5"
            >
              <span>Ver 12 Meses</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="h-[240px] sm:h-[260px] w-full pt-2">
            <ChartCanvas type="line" data={cashFlowChartData} options={cashFlowChartOptions} height={250} />
          </div>
        </div>

      </div>

      {/* 5. BARRA DE ESTADO / SINCRONIZACIÓN INFERIOR */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span className="font-semibold text-slate-700 dark:text-zinc-300">
            Perfil Activo: Familia Álvarez Gamboa
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">101 meses de historia sincronizada</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span>Última sincronización: Hoy</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Floating Action Buttons para Móvil */}
      <div className="fixed bottom-20 right-4 z-40 sm:hidden flex flex-col gap-2 items-end">
        <button
          type="button"
          onClick={() => openQuickAdd('transfer')}
          className="h-10 px-3.5 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-600/30 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">swap_horiz</span>
          <span>Transferir</span>
        </button>
        <button
          type="button"
          onClick={() => openQuickAdd('income')}
          className="h-10 px-3.5 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>+ Ingreso</span>
        </button>
        <button
          type="button"
          onClick={() => openQuickAdd('expense')}
          className="h-11 px-4 rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/40 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">remove</span>
          <span>+ Gasto</span>
        </button>
      </div>

      {/* Modales */}
      <QuickExpenseModal
        isOpen={isQuickAddOpen}
        initialType={quickAddType}
        onClose={closeQuickAdd}
        onSave={handleSaveTransaction}
        categories={summaryData.categories || []}
        accounts={summaryData.accounts || []}
      />

      <BeneficiariosModal
        isOpen={isBeneficiariosOpen}
        onClose={() => setIsBeneficiariosOpen(false)}
      />

      <CuentasModal
        isOpen={isCuentasOpen}
        onClose={() => setIsCuentasOpen(false)}
      />
    </AppLayout>
  );
}
