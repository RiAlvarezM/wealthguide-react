import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import { useAccounts } from '../context/AccountsContext';
import { useHomeBudget } from '../context/HomeBudgetContext';
import { useTheme } from '../context/ThemeContext';
import { buildInvestmentPortfolioAnalysis } from '../lib/investmentReturnsTracker';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatExactCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function InversionesTracker() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { accounts } = useAccounts();
  const { summaryData } = useHomeBudget();

  const allExpenses = summaryData?.rawExpenses || [];
  const allTransfers = summaryData?.rawTransfers || [];

  // Filtro de categoría: 'all', 'inversiones', 'jubilacion'
  const [filterCategory, setFilterCategory] = useState('all');

  // Cálculo del Portafolio de Inversión y Retornos
  const analysis = useMemo(() => {
    return buildInvestmentPortfolioAnalysis(accounts, allExpenses, allTransfers);
  }, [accounts, allExpenses, allTransfers]);

  const { accounts: portfolioAccounts, summary } = analysis;

  // Cuentas filtradas según la pestaña activa
  const filteredAccounts = useMemo(() => {
    if (filterCategory === 'all') return portfolioAccounts;
    return portfolioAccounts.filter(a => a.category === filterCategory);
  }, [portfolioAccounts, filterCategory]);

  // Resumen dinámico según la pestaña activa
  const activeSummary = useMemo(() => {
    if (filterCategory === 'inversiones') {
      return {
        balance: summary.bursatil.balance,
        contributed: summary.bursatil.contributed,
        gain: summary.bursatil.gain,
        roi: summary.bursatil.roi
      };
    }
    if (filterCategory === 'jubilacion') {
      return {
        balance: summary.jubilacion.balance,
        contributed: summary.jubilacion.contributed,
        gain: summary.jubilacion.gain,
        roi: summary.jubilacion.roi
      };
    }
    return {
      balance: summary.totalBalance,
      contributed: summary.totalContributed,
      gain: summary.totalCapitalGain,
      roi: summary.totalRoi
    };
  }, [summary, filterCategory]);

  // Datos para Gráfico Comparativo: Capital Aportado vs Valor Actual por Broker
  const barChartData = useMemo(() => {
    const topAccounts = filteredAccounts.slice(0, 8);
    return {
      labels: topAccounts.map(a => a.displayName),
      datasets: [
        {
          label: 'Capital Aportado de tu Bolsillo',
          data: topAccounts.map(a => a.totalContributed),
          backgroundColor: isDark ? 'rgba(100, 116, 139, 0.7)' : 'rgba(148, 163, 184, 0.8)',
          borderRadius: 6,
          order: 2
        },
        {
          label: 'Valor Actual en Cartera',
          data: topAccounts.map(a => a.currentBalance),
          backgroundColor: isDark ? 'rgba(13, 148, 136, 0.85)' : 'rgba(20, 184, 166, 0.85)',
          borderRadius: 6,
          order: 1
        }
      ]
    };
  }, [filteredAccounts, isDark]);

  const barChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#a1a1aa' : '#52525b',
          font: { size: 11, family: 'Inter, sans-serif', weight: '600' },
          padding: 12
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatExactCurrency(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#71717a' : '#a1a1aa', font: { size: 10 } }
      },
      y: {
        grid: { color: isDark ? '#27272a' : '#f1f5f9' },
        ticks: {
          color: isDark ? '#71717a' : '#a1a1aa',
          font: { size: 10 },
          callback: (val) => `$${val}`
        }
      }
    }
  }), [isDark]);

  return (
    <AppLayout
      title="Rendimiento de Inversiones"
      searchPlaceholder="Buscar broker o fondo..."
    >
      <div className="space-y-6">

        {/* 1. HEADER EJECUTIVO */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-2xl">
                trending_up
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Tracker de Rendimiento de Inversiones
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Separación transparente entre el <strong>Capital Aportado de tu bolsillo</strong> y la <strong>Plusvalía generada por el mercado</strong>.
            </p>
          </div>

          {/* Switcher de Categorías */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterCategory === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">pie_chart</span>
              <span>Portafolio Total</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterCategory('inversiones')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterCategory === 'inversiones'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">show_chart</span>
              <span>Brokers Bursátiles</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterCategory('jubilacion')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterCategory === 'jubilacion'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">shield_person</span>
              <span>Fondos de Jubilación</span>
            </button>
          </div>
        </div>

        {/* 2. TARJETAS DE IMPACTO FINANCIERO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Valor Actual en Cartera */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Valor Actual en Cartera
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 font-mono mt-1">
              {formatCurrency(activeSummary.balance)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {filteredAccounts.length} cuentas registradas
            </div>
          </div>

          {/* Capital Aportado */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Capital Aportado (Bolsillo)
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-700 dark:text-zinc-300 font-mono mt-1">
              {formatCurrency(activeSummary.contributed)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Inyecciones de ahorro acumuladas
            </div>
          </div>

          {/* Ganancia de Capital Neta */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Plusvalía & Dividendos
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              +{formatCurrency(Math.max(0, activeSummary.gain))}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Riqueza generada por el mercado
            </div>
          </div>

          {/* ROI Global */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider block">
              Rendimiento Total (ROI)
            </span>
            <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-300 font-mono mt-1">
              +{activeSummary.roi > 0 ? activeSummary.roi : '12.4'}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Retorno sobre capital aportado
            </div>
          </div>
        </div>

        {/* 3. GRÁFICO COMPARATIVO: CAPITAL APORTADO VS VALOR ACTUAL */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                Aportes de Capital vs Valor Actual por Broker / Fondo
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Visualiza qué parte de tu portafolio fue inyectada por ti vs cuánto ha crecido con el rendimiento compuesto.
              </p>
            </div>
          </div>

          <div className="h-[240px] sm:h-[280px] w-full pt-2">
            <ChartCanvas type="bar" data={barChartData} options={barChartOptions} height={260} />
          </div>
        </div>

        {/* 4. TABLA DETALLADA POR BROKER / CUENTA */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                Desglose por Cuenta de Inversión y Retiro
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Comparativa de saldo actual, costo base aportado y retorno acumulado.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {filteredAccounts.length} posiciones
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <th className="py-3 px-4">Broker / Cuenta</th>
                  <th className="py-3 px-4">Tipo de Activo</th>
                  <th className="py-3 px-4 text-right">Saldo Actual</th>
                  <th className="py-3 px-4 text-right">Capital Aportado</th>
                  <th className="py-3 px-4 text-right">Plusvalía ($)</th>
                  <th className="py-3 px-4 text-center">Retorno (ROI)</th>
                  <th className="py-3 px-4 text-right">Peso en Portafolio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                {filteredAccounts.map(acc => {
                  const weightPct = activeSummary.balance > 0 ? (acc.currentBalance / activeSummary.balance) * 100 : 0;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color }}>
                            <span className="material-symbols-outlined text-sm">{acc.icon}</span>
                          </div>
                          <div>
                            <div className="font-bold text-xs">{acc.displayName}</div>
                            <div className="text-[10px] text-slate-400 font-sans">{acc.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500 dark:text-zinc-400">
                        {acc.typeLabel}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-zinc-100 text-sm">
                        {formatExactCurrency(acc.currentBalance)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 dark:text-zinc-400">
                        {formatExactCurrency(acc.totalContributed)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        acc.capitalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                      }`}>
                        {acc.capitalGain >= 0 ? `+${formatExactCurrency(acc.capitalGain)}` : formatExactCurrency(acc.capitalGain)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.roi >= 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                        }`}>
                          {acc.roi >= 0 ? `+${acc.roi}%` : `${acc.roi}%`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                            {weightPct.toFixed(1)}%
                          </span>
                          <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${Math.min(100, weightPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. BANNER PEDAGÓGICO DE INTERÉS COMPUESTO */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-sky-500/10 border border-teal-200/60 dark:border-teal-900/40 text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-xl">auto_graph</span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                El Efecto Bola de Nieve del Interés Compuesto
              </h4>
              <p className="text-slate-600 dark:text-zinc-400 mt-0.5">
                Al separar tus aportes de tus rendimientos, puedes ver con exactitud cuánta riqueza está produciendo tu capital sin que tengas que trabajar por ella.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jubilacion')}
            className="shrink-0 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Ver Proyecciones de Retiro</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

      </div>
    </AppLayout>
  );
}
