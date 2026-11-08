import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import { useHomeBudget } from '../context/HomeBudgetContext';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';
import { useTheme } from '../context/ThemeContext';
import { computeFireMetrics, SWR_RATES } from '../lib/fireCalculations';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

export default function FireDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { currentMonthData, summaryData } = useHomeBudget();
  const { accounts } = useAccounts();
  const { properties } = useProperties();

  // Estados interactivos para simulaciones
  const [swrMode, setSwrMode] = useState('traditional'); // 'traditional', 'conservative', 'ultraSafe'
  const [customMonthlyExpense, setCustomMonthlyExpense] = useState('');
  const [customSavingsRate, setCustomSavingsRate] = useState(35);
  const [customReturnRate, setCustomReturnRate] = useState(7);

  // Costo de vida mensual real de HomeBudget (excluyendo ahorro e inversiones del modelo 2 bolsas)
  const baseMonthlyExpenses = useMemo(() => {
    // Si el usuario especificó un costo manual en el simulador:
    if (customMonthlyExpense && Number(customMonthlyExpense) > 0) {
      return Number(customMonthlyExpense);
    }
    // Si no, tomar el gasto real de vida del mes o promedio anual (~$5,000/mes)
    const living = currentMonthData.livingExpenses;
    return living > 0 ? living : 5000;
  }, [customMonthlyExpense, currentMonthData]);

  // Capital líquido e inversiones en cartera
  const liquidInvestments = useMemo(() => {
    let sum = 0;
    for (const acc of accounts) {
      if ((acc.category === 'inversiones' || acc.category === 'jubilacion') && acc.active !== false) {
        sum += Number(acc.amount) || 0;
      }
    }
    return sum > 0 ? sum : 65000;
  }, [accounts]);

  // Ingreso pasivo por alquileres de 4 Islas y Park Avenue ($650 + $1,150 = $1,800/mes)
  const monthlyPassiveRentalIncome = 1800;

  // Patrimonio Neto Consolidado
  const netWorthTotal = useMemo(() => {
    let act = 0;
    let pas = 0;
    for (const acc of accounts) {
      if (acc.active === false) continue;
      const amt = Number(acc.amount) || 0;
      if (acc.category === 'consumo' || acc.category === 'prestamos') pas += amt;
      else act += amt;
    }
    const propVal = properties.reduce((s, p) => s + (Number(p.value) || 0), 0);
    return act + propVal - pas;
  }, [accounts, properties]);

  // Métricas computadas de FIRE
  const fire = useMemo(() => {
    return computeFireMetrics({
      annualLivingExpenses: baseMonthlyExpenses * 12,
      monthlyLivingExpenses: baseMonthlyExpenses,
      totalLiquidInvestments: liquidInvestments,
      totalNetWorth: netWorthTotal,
      monthlyPassiveIncome: monthlyPassiveRentalIncome,
      annualSavingsRatePct: Number(customSavingsRate) || 35,
      annualReturnRate: (Number(customReturnRate) || 7) / 100,
      swrMode
    });
  }, [baseMonthlyExpenses, liquidInvestments, netWorthTotal, monthlyPassiveRentalIncome, customSavingsRate, customReturnRate, swrMode]);

  // Datos para Gráfico Comparativo de Niveles FIRE
  const fireLevelsChartData = useMemo(() => {
    return {
      labels: ['Coast FIRE', 'Lean FIRE (75%)', 'Regular FIRE (100%)', 'Fat FIRE (150%)'],
      datasets: [
        {
          label: 'Meta de Capital Necesaria',
          data: [fire.coastFireCapitalNeeded, fire.leanFireNumber, fire.grossFireNumber, fire.fatFireNumber],
          backgroundColor: isDark ? 'rgba(100, 116, 139, 0.7)' : 'rgba(148, 163, 184, 0.8)',
          borderRadius: 8,
          order: 2
        },
        {
          label: 'Capital Invertido Actual',
          data: [fire.currentInvestments, fire.currentInvestments, fire.currentInvestments, fire.currentInvestments],
          backgroundColor: isDark ? 'rgba(13, 148, 136, 0.85)' : 'rgba(20, 184, 166, 0.85)',
          borderRadius: 8,
          order: 1
        }
      ]
    };
  }, [fire, isDark]);

  const fireLevelsChartOptions = useMemo(() => ({
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
          label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
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
          callback: (val) => `$${(val / 1000).toFixed(0)}k`
        }
      }
    }
  }), [isDark]);

  return (
    <AppLayout
      title="Independencia Financiera (FIRE Live)"
      searchPlaceholder="Buscar en tablero FIRE..."
    >
      <div className="space-y-6">

        {/* 1. HEADER EJECUTIVO */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-2xl">
                local_fire_department
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Tablero Unificado de Independencia Financiera (FIRE Live)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Calcula con precisión cuándo puedes dejar de depender de un salario, combinando tu costo de vida de <strong>HomeBudget</strong> con tus <strong>Inmuebles en Renta</strong> e <strong>Inversiones</strong>.
            </p>
          </div>

          {/* Selector de Regla SWR */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
            {Object.entries(SWR_RATES).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSwrMode(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  swrMode === key
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title={cfg.label}
              >
                {(cfg.rate * 100).toFixed(1)}% ({cfg.multiplier}x)
              </button>
            ))}
          </div>
        </div>

        {/* 2. TARJETAS DE IMPACTO MAESTRAS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Número FIRE Neto */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider block">
              Número FIRE Neto Meta
            </span>
            <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-300 font-mono mt-1">
              {formatCurrency(fire.netFireNumber)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Descontando tus $1,800/mes de alquileres
            </div>
          </div>

          {/* Progreso hacia FIRE */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Progreso hacia FIRE
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {fire.progressPct}%
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden my-1 flex">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, fire.progressPct)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              {formatCurrency(fire.currentInvestments)} acumulados
            </div>
          </div>

          {/* Cobertura Pasiva Actual */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">
              Cobertura Pasiva Actual
            </span>
            <div className="text-xl sm:text-2xl font-black text-sky-700 dark:text-sky-300 font-mono mt-1">
              {fire.totalCoveragePct}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              ${fire.totalPassiveMonthly}/m pasivos vs ${fire.monthlyLivingExpenses}/m gasto
            </div>
          </div>

          {/* Tiempo Estimado Restante */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Años hacia la Libertad
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 font-mono mt-1">
              {fire.projectedYearsToFire > 0 ? `${fire.projectedYearsToFire} años` : '¡FIRE Alcanzado!'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Runway actual: {fire.financialRunwayYears} años sin ingresos
            </div>
          </div>
        </div>

        {/* 3. EL SUPERPODER DE TUS ALQUILERES (COMPARATIVA SIN VS CON ALQUILERES) */}
        <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 border border-teal-200 dark:border-teal-900/60 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                <span className="material-symbols-outlined text-2xl">domain</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  El Impacto Acelerador de tus Inmuebles en Renta
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Gracias a los <strong>$1,800/mes ($21,600/año)</strong> que generan <em>4 Islas</em> y <em>Park Avenue</em>, tu meta de libertad financiera se reduce drásticamente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/inmuebles')}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>Ver Hub Inmobiliario</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* Sin Alquileres */}
            <div className="p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
              <span className="font-sans text-[11px] text-slate-400 font-semibold block uppercase">
                Camino FIRE Tradicional (Solo Bursátil)
              </span>
              <div className="text-lg font-bold text-slate-700 dark:text-zinc-300 mt-1">
                {formatCurrency(fire.grossFireNumber)}
              </div>
              <p className="font-sans text-[11px] text-slate-500 mt-1">
                Meta necesaria si tuvieras que cubrir tus ${fire.monthlyLivingExpenses}/mes únicamente con retiros de acciones.
              </p>
            </div>

            {/* Con Alquileres */}
            <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800">
              <span className="font-sans text-[11px] text-teal-800 dark:text-teal-300 font-semibold block uppercase">
                Tu Meta Real (Con Rentas Activas)
              </span>
              <div className="text-xl font-black text-teal-700 dark:text-teal-300 mt-1">
                {formatCurrency(fire.netFireNumber)}
              </div>
              <p className="font-sans text-[11px] text-teal-900/80 dark:text-teal-300/80 mt-1">
                Meta reducida en <strong>{formatCurrency(fire.grossFireNumber - fire.netFireNumber)}</strong> gracias al flujo mensual de alquileres.
              </p>
            </div>

            {/* Cobertura de Costo de Vida */}
            <div className="p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
              <span className="font-sans text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block uppercase">
                Costo de Vida ya Cubierto
              </span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {fire.passiveCoveragePct}% Cubierto Hoy
              </div>
              <p className="font-sans text-[11px] text-slate-500 mt-1">
                Tus alquileres ya cubren casi un tercio de todo el estilo de vida de tu familia de forma 100% pasiva.
              </p>
            </div>
          </div>
        </div>

        {/* 4. NIVELES FIRE & SIMULADOR DE ACELERACIÓN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Gráfico de Niveles FIRE */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div className="mb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                Escalera de Niveles de Independencia Financiera
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Compara tu capital actual con los 4 hitos FIRE más reconocidos mundialmente.
              </p>
            </div>

            <div className="h-[250px] sm:h-[280px] w-full pt-2">
              <ChartCanvas type="bar" data={fireLevelsChartData} options={fireLevelsChartOptions} height={260} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] font-mono">
              <div>
                <span className="text-slate-400 font-sans block">Coast FIRE</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{formatCurrency(fire.coastFireCapitalNeeded)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block">Lean FIRE</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{formatCurrency(fire.leanFireNumber)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block">Regular FIRE</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{formatCurrency(fire.grossFireNumber)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block">Fat FIRE</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{formatCurrency(fire.fatFireNumber)}</span>
              </div>
            </div>
          </div>

          {/* Simulador Interactivo de Parámetros */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-teal-600 text-xl">tune</span>
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  Simulador de Sensibilidad & Aceleración
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Ajusta los supuestos para ver en tiempo real cómo cambia tu fecha de libertad.
              </p>

              <div className="space-y-4 text-xs font-sans">
                {/* Costo de Vida Mensual */}
                <div>
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    <span>Gasto Mensual Objetivo</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-zinc-100">{formatCurrency(baseMonthlyExpenses)}/m</span>
                  </div>
                  <input
                    type="number"
                    step="100"
                    placeholder={`Por defecto HomeBudget: $${currentMonthData.livingExpenses || 5000}`}
                    value={customMonthlyExpense}
                    onChange={(e) => setCustomMonthlyExpense(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 font-mono text-xs text-slate-900 dark:text-zinc-100 outline-none"
                  />
                </div>

                {/* Tasa de Ahorro e Inversión */}
                <div>
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    <span>Tasa de Ahorro / Inversión Mensual</span>
                    <span className="font-bold font-mono text-teal-600 dark:text-teal-400">{customSavingsRate}% de tus ingresos</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="70"
                    step="5"
                    value={customSavingsRate}
                    onChange={(e) => setCustomSavingsRate(Number(e.target.value))}
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>10% (Lento)</span>
                    <span>35% (Actual)</span>
                    <span>70% (Hiper-acelerado)</span>
                  </div>
                </div>

                {/* Retorno Esperado */}
                <div>
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    <span>Retorno Indexado Anual</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-zinc-100">{customReturnRate}% anual</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="12"
                    step="0.5"
                    value={customReturnRate}
                    onChange={(e) => setCustomReturnRate(Number(e.target.value))}
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>4% (Defensivo)</span>
                    <span>7% (S&P 500 Real)</span>
                    <span>12% (Agresivo)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 text-xs">
              <div className="font-bold text-slate-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-teal-600">bolt</span>
                <span>Proyección Resultante:</span>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 text-[11px]">
                Con un aporte anual estimado de <strong>{formatCurrency(fire.annualSavingsDollars)}</strong> y tus alquileres activos, alcanzarías tu independencia en <strong>{fire.projectedYearsToFire} años</strong>.
              </p>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
}
