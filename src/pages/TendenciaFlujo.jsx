import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
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

function formatMonthShort(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1].substring(0, 3).toLowerCase()} ${y.slice(2)}`;
}

/**
 * SCR_TREND_CHART_VIEW & SCR_TREND_DATA_TABLE
 * Especificación de UI/UX:
 *  1. Barra Superior con selector segmentado: Tendencia vs Análisis Histórica + Botón conmutador '1_2_3'
 *  2. Tarjeta de Ritmo y Promedio Diario (Presupuesto total/día vs Gastos ejecutados/día)
 *  3. Área Gráfica Principal (12 Month Trend) con curvas Budget, Expense, Income
 *  4. Data Grid (Tabla de datos con Mes, Ingreso, Gastos, Saldo) al alternar '1_2_3'
 *  5. Botón 'Exporta' a CSV
 */
export default function TendenciaFlujo() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    monthlySummaries,
    yearlySummaries,
    selectedMonth,
    currentMonthData,
    viewMode
  } = useHomeBudget();

  // Vista principal: 'trend' (Tendencia 12m) | 'historical_analysis' (Análisis Histórico Anual)
  const [mainView, setMainView] = useState('trend');
  // Formato: 'chart' (Gráfica) | 'table' (Tabular 1_2_3)
  const [formatMode, setFormatMode] = useState('chart');

  // Presupuesto mensual de referencia
  const monthlyBudget = 11500;

  // Cálculo de ritmo diario del mes activo
  const dailyPaceData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    const isCurrentCalendarMonth = (now.getFullYear() === year && (now.getMonth() + 1) === month);
    const dayPassed = isCurrentCalendarMonth ? Math.max(1, now.getDate()) : daysInMonth;

    const currentExpenses = viewMode === 'pools' ? currentMonthData.livingExpenses : currentMonthData.totalExpenses;

    const budgetDaily = monthlyBudget / daysInMonth;
    const expenseDaily = dayPassed > 0 ? (currentExpenses / dayPassed) : 0;

    return {
      todayStr: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      daysInMonth,
      dayPassed,
      monthlyBudget,
      budgetDaily,
      currentExpenses,
      expenseDaily
    };
  }, [selectedMonth, currentMonthData, monthlyBudget, viewMode]);

  // Datos para 12 Month Trend
  const trend12Months = useMemo(() => {
    const endIdx = monthlySummaries.findIndex(m => m.month === selectedMonth);
    const targetIdx = endIdx >= 0 ? endIdx + 1 : monthlySummaries.length;
    const startIdx = Math.max(0, targetIdx - 12);
    return monthlySummaries.slice(startIdx, targetIdx);
  }, [monthlySummaries, selectedMonth]);

  // Chart Data para 12 Month Trend
  const trendChartData = useMemo(() => {
    const labels = trend12Months.map(m => {
      const [y, mm] = m.month.split('-');
      return `${MONTH_NAMES[parseInt(mm, 10) - 1].substring(0, 3)} ${y.slice(2)}`;
    });

    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Presupuesto',
          data: trend12Months.map(() => monthlyBudget),
          borderColor: isDark ? '#94a3b8' : '#64748b',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0
        },
        {
          type: 'line',
          label: 'Gastos',
          data: trend12Months.map(m => viewMode === 'pools' ? (m.livingExpenses !== undefined ? m.livingExpenses : m.totalExpenses) : m.totalExpenses),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.25
        },
        {
          type: 'line',
          label: 'Ingresos',
          data: trend12Months.map(m => m.totalIncome),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.25
        }
      ]
    };
  }, [trend12Months, monthlyBudget, viewMode, isDark]);

  const trendChartOptions = useMemo(() => ({
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
          padding: 16
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

  // Exportar a CSV
  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (mainView === 'trend') {
      csvContent += 'Mes,Ingresos,Gastos,Saldo Neto,Tasa Ahorro %\n';
      trend12Months.forEach(m => {
        const expenses = viewMode === 'pools' ? (m.livingExpenses || m.totalExpenses) : m.totalExpenses;
        const net = Math.round((m.totalIncome - expenses) * 100) / 100;
        const rate = m.totalIncome > 0 ? ((net / m.totalIncome) * 100).toFixed(1) : '0';
        csvContent += `"${m.month}",${m.totalIncome},${expenses},${net},${rate}%\n`;
      });
    } else {
      csvContent += 'Año,Ingresos,Gastos,Saldo Neto,Tasa Ahorro %\n';
      yearlySummaries.forEach(y => {
        const expenses = viewMode === 'pools' ? (y.livingExpenses || y.totalExpenses) : y.totalExpenses;
        const net = Math.round((y.totalIncome - expenses) * 100) / 100;
        const rate = y.totalIncome > 0 ? ((net / y.totalIncome) * 100).toFixed(1) : '0';
        csvContent += `"${y.year}",${y.totalIncome},${expenses},${net},${rate}%\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tendencia_flujo_${mainView}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout title="Tendencia & Análisis de Flujo">
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

          {/* Selector Segmentado: Tendencia vs Análisis Histórico */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMainView('trend')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mainView === 'trend'
                  ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Tendencia (12m)
            </button>
            <button
              type="button"
              onClick={() => setMainView('historical_analysis')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mainView === 'historical_analysis'
                  ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Análisis Histórico
            </button>
          </div>
        </div>

        {/* Conmutador de Formato (1_2_3 para Gráfica vs Tabla) */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFormatMode('chart')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                formatMode === 'chart'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
              title="Vista Gráfica"
            >
              <span className="material-symbols-outlined text-base">show_chart</span>
              <span className="hidden sm:inline text-[11px]">Gráfica</span>
            </button>

            <button
              type="button"
              onClick={() => setFormatMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                formatMode === 'table'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
              title="Vista Tabular (1_2_3)"
            >
              <span className="material-symbols-outlined text-base">format_list_numbered</span>
              <span className="text-[11px] font-mono">1_2_3</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TARJETA DE RITMO Y PROMEDIO DIARIO */}
      {mainView === 'trend' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-teal-600 dark:text-teal-400">speed</span>
            <span>A la fecha de {dailyPaceData.todayStr} ({formatMonthLabel(selectedMonth)})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Fila Presupuesto */}
            <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/60 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Presupuesto Ciclo
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 font-mono">
                  {formatCurrency(dailyPaceData.monthlyBudget)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Tasa Diaria</div>
                <div className="text-sm sm:text-base font-bold text-slate-700 dark:text-zinc-300 font-mono">
                  {formatCurrency(dailyPaceData.budgetDaily)} / día
                </div>
              </div>
            </div>

            {/* Fila Gastos Ejecutados */}
            <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/60 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {viewMode === 'pools' ? 'Gastos Vida Ejecutados' : 'Gastos Totales'}
                </div>
                <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                  {formatCurrency(dailyPaceData.currentExpenses)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Ritmo Diario Real</div>
                <div className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {formatCurrency(dailyPaceData.expenseDaily)} / día
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ÁREA PRINCIPAL: GRÁFICA O TABULAR */}
      {formatMode === 'chart' ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-zinc-100">
                {mainView === 'trend' ? '12 Month Trend' : 'Tendencia Histórica Plurianual'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Evolución de Presupuesto, Gastos e Ingresos a lo largo del tiempo
              </p>
            </div>
          </div>

          <div className="h-[340px] sm:h-[380px] w-full pt-2">
            <ChartCanvas type="line" data={trendChartData} options={trendChartOptions} height={350} />
          </div>
        </div>
      ) : (
        /* 4. TABLA DE DATOS (DATA GRID) */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-zinc-100">
                Tendencia Ingreso & Gastos
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Matriz de datos cronológica continua
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 uppercase text-[11px] font-semibold">
                  <th className="py-3 px-3">Mes</th>
                  <th className="py-3 px-3 text-right">Ingreso</th>
                  <th className="py-3 px-3 text-right">Gastos</th>
                  <th className="py-3 px-3 text-right">Saldo</th>
                  <th className="py-3 px-3 text-right">% Ahorro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                {(mainView === 'trend' ? trend12Months.slice().reverse() : yearlySummaries.slice().reverse()).map((row, idx) => {
                  const label = row.month ? formatMonthShort(row.month) : row.year;
                  const income = row.totalIncome || 0;
                  const expense = viewMode === 'pools'
                    ? (row.livingExpenses !== undefined ? row.livingExpenses : row.totalExpenses)
                    : row.totalExpenses;
                  const saldo = Math.round((income - expense) * 100) / 100;
                  const isNegative = saldo < 0;
                  const rate = income > 0 ? ((saldo / income) * 100).toFixed(1) : 0;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-zinc-100 font-sans">
                        {label}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(income)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 font-bold">
                        {formatCurrency(expense)}
                      </td>
                      <td className={`py-3 px-3 text-right font-black ${
                        isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isNegative ? formatCurrency(saldo) : `+${formatCurrency(saldo)}`}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          Number(rate) >= 15
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                        }`}>
                          {rate}%
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

      {/* 5. ZONA DE ACCIONES INFERIOR (BOTÓN EXPORTA) */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base text-teal-600 dark:text-teal-400">download</span>
          <span>Exporta</span>
        </button>
      </div>
    </AppLayout>
  );
}
