// src/pages/Jubilacion.jsx
//
// Centro de Independencia Financiera & Jubilación Patrimonial para la familia Álvarez Gamboa.
// Integra:
//   • Portafolio Productivo Real (Cuentas de Jubilación + Cuentas de Inversión)
//   • Renta Pasiva Inmobiliaria (Propiedades y alquileres que reducen el capital necesario)
//   • Regla del 4% (Monto FIRE / Safe Withdrawal Rate) para estimar renta vitalicia mensual
//   • 3 Escenarios de Mercado: Conservador (5%), Moderado (7%), Dinámico (9%)
//   • Simulación interactiva con soporte completo Dark Mode.

import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';

function formatCurrency(value, maximumFractionDigits = 0) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits });
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

// Interés compuesto con aportes mensuales nivelados
function projectBalance(startingBalance, monthlyContribution, annualReturnPct, months) {
  const r = annualReturnPct / 100 / 12;
  if (r === 0) return startingBalance + monthlyContribution * months;
  const growth = Math.pow(1 + r, months);
  return startingBalance * growth + monthlyContribution * ((growth - 1) / r);
}

const MARKET_SCENARIOS = {
  conservador: { label: 'Conservador (5%)', rate: 5.0, color: '#64748b', desc: 'Mercado defensivo / Bonos y Renta Fija' },
  moderado:    { label: 'Moderado (7%)',    rate: 7.0, color: '#059669', desc: 'Rendimiento histórico de índices bursátiles (S&P 500 real)' },
  dinamico:    { label: 'Dinámico (9%)',    rate: 9.0, color: '#2563eb', desc: 'Crecimiento accionario optimista / reinversión agresiva' },
};

export default function Jubilacion() {
  const { accounts } = useAccounts();
  const { properties } = useProperties();

  // 1. Desglose del capital productivo actual en Firestore
  const balanceJubilacion = useMemo(
    () =>
      accounts
        .filter((acc) => acc.category === 'jubilacion' && acc.active !== false)
        .reduce((sum, acc) => sum + acc.amount, 0),
    [accounts]
  );

  const balanceInversiones = useMemo(
    () =>
      accounts
        .filter((acc) => acc.category === 'inversiones' && acc.active !== false)
        .reduce((sum, acc) => sum + acc.amount, 0),
    [accounts]
  );

  // Selector: ¿Proyectar solo jubilación formal o todo el capital productivo (Jubilación + Inversiones)?
  const [includeInversiones, setIncludeInversiones] = useState(true);

  const startingBalance = useMemo(
    () => (includeInversiones ? balanceJubilacion + balanceInversiones : balanceJubilacion),
    [includeInversiones, balanceJubilacion, balanceInversiones]
  );

  // 2. Variables de Simulación
  const [currentAge, setCurrentAge] = useState(38);
  const [retirementAge, setRetirementAge] = useState(60);
  const [monthlyContribution, setMonthlyContribution] = useState(2000);
  const [desiredMonthlyExpense, setDesiredMonthlyExpense] = useState(4000);
  const [monthlyPassiveRealEstate, setMonthlyPassiveRealEstate] = useState(1200); // Renta pasiva estimada de propiedades
  const [scenarioKey, setScenarioKey] = useState('moderado');
  const [chartScale, setChartScale] = useState('linear');

  const activeReturn = MARKET_SCENARIOS[scenarioKey].rate;

  // 3. Cálculo de la Meta según la Regla del 4% (Trinity Study)
  // Gasto no cubierto por bienes raíces = Desired - Alquileres
  const netMonthlyNeededFromPortfolio = Math.max(0, desiredMonthlyExpense - monthlyPassiveRealEstate);
  const annualNeededFromPortfolio = netMonthlyNeededFromPortfolio * 12;

  // Meta de Capital Líquido FIRE (Regla del 4% anual = multiplicar por 25 años de gasto)
  const calculatedGoal = annualNeededFromPortfolio * 25;

  // Proyecciones a lo largo del tiempo
  const projection = useMemo(() => {
    const ages = [];
    for (let age = currentAge; age <= retirementAge; age += 1) ages.push(age);
    if (ages[ages.length - 1] !== retirementAge) ages.push(retirementAge);

    return ages.map((age) => {
      const months = (age - currentAge) * 12;
      const balance = projectBalance(startingBalance, monthlyContribution, activeReturn, months);
      const capitalInvested = startingBalance + monthlyContribution * months;
      const compoundGrowth = balance - capitalInvested;
      const monthlySafeWithdrawal = (balance * 0.04) / 12; // Regla del 4% mensual

      return {
        age,
        balance,
        capitalInvested,
        compoundGrowth,
        monthlySafeWithdrawal,
      };
    });
  }, [currentAge, retirementAge, startingBalance, monthlyContribution, activeReturn]);

  const projectedAtRetirement = projection[projection.length - 1]?.balance ?? startingBalance;
  const projectedMonthlySafeIncome = (projectedAtRetirement * 0.04) / 12;
  const totalRetirementMonthlyIncome = projectedMonthlySafeIncome + monthlyPassiveRealEstate;

  const coveragePct = desiredMonthlyExpense > 0 ? (totalRetirementMonthlyIncome / desiredMonthlyExpense) * 100 : 0;
  const onTrack = totalRetirementMonthlyIncome >= desiredMonthlyExpense;

  // Hitos cada 5 o 10 años
  const milestones = useMemo(() => {
    const rows = projection.filter((row) => row.age !== currentAge && (row.age % 5 === 0 || row.age === retirementAge));
    const last = projection[projection.length - 1];
    if (last && !rows.some((row) => row.age === last.age)) rows.push(last);
    return rows;
  }, [projection, currentAge, retirementAge]);

  // Datos de la Gráfica
  const chartData = useMemo(() => ({
    labels: projection.map((row) => `Edad ${row.age}`),
    datasets: [
      {
        label: `Patrimonio Proyectado (${MARKET_SCENARIOS[scenarioKey].label})`,
        data: projection.map((row) => row.balance),
        borderColor: MARKET_SCENARIOS[scenarioKey].color,
        backgroundColor: `${MARKET_SCENARIOS[scenarioKey].color}18`,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: `Meta de Capital Líquido (${formatCurrency(calculatedGoal)})`,
        data: projection.map(() => calculatedGoal),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
      },
      {
        label: 'Aporte de Capital Propio (Sin Interés)',
        data: projection.map((row) => row.capitalInvested),
        borderColor: '#94a3b8',
        borderWidth: 1.5,
        fill: false,
        tension: 0.2,
        pointRadius: 0,
      },
    ],
  }), [projection, calculatedGoal, scenarioKey]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 12 },
          color: '#64748b',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      y: {
        type: chartScale,
        beginAtZero: chartScale === 'linear',
        ticks: {
          callback: (value) => `$${formatCompact(value)}`,
          color: '#94a3b8',
          font: { size: 11 },
        },
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
      },
      x: {
        grid: { display: false },
        ticks: {
          maxTicksLimit: 12,
          color: '#94a3b8',
          font: { size: 11 },
        },
      },
    },
  }), [chartScale]);

  return (
    <AppLayout title="Independencia Financiera" searchPlaceholder="Simular escenarios de retiro...">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Plan de Independencia Financiera & Retiro
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Proyección patrimonial integrada: conecta tu portafolio líquido con rentas inmobiliarias y la regla del 4%.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3.5 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold self-start sm:self-auto">
          <span className="material-symbols-outlined text-[16px]">verified</span>
          <span>Sincronizado con Cuentas y Propiedades</span>
        </div>
      </div>

      {/* Strategic Retirement KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Capital Total Proyectado */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
              <span className="text-xs uppercase font-semibold tracking-wider">Patrimonio Líquido a los {retirementAge}</span>
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">account_balance</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
              {formatCurrency(projectedAtRetirement)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
            Aporte acumulado: <strong>{formatCurrency(startingBalance + monthlyContribution * (retirementAge - currentAge) * 12)}</strong>
          </div>
        </div>

        {/* 2. Renta Mensual Vitalicia (Regla del 4%) */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl p-5 shadow-md shadow-emerald-600/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-100 mb-1">
              <span className="text-xs uppercase font-semibold tracking-wider">Renta Mensual Total Retiro</span>
              <span className="material-symbols-outlined text-white text-[18px]">payments</span>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {formatCurrency(totalRetirementMonthlyIncome)}/mes
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/20 text-xs text-emerald-100">
            {formatCurrency(projectedMonthlySafeIncome)} (Bolsa 4%) + {formatCurrency(monthlyPassiveRealEstate)} (Alquileres)
          </div>
        </div>

        {/* 3. Meta FIRE de Capital Necesario */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
              <span className="text-xs uppercase font-semibold tracking-wider">Meta FIRE (Regla del 4%)</span>
              <span className="material-symbols-outlined text-amber-500 text-[18px]">flag</span>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatCurrency(calculatedGoal)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
            Para cubrir {formatCurrency(desiredMonthlyExpense)}/mes sin agotar capital
          </div>
        </div>

        {/* 4. Cobertura del Estilo de Vida */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
              <span className="text-xs uppercase font-semibold tracking-wider">Cobertura del Gasto</span>
              <span className={`material-symbols-outlined text-[18px] ${onTrack ? 'text-emerald-600' : 'text-rose-500'}`}>
                {onTrack ? 'check_circle' : 'warning'}
              </span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${onTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {coveragePct.toFixed(0)}%
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
            {onTrack ? '¡Objetivo superado con holgura!' : 'Requiere ajustar ahorro o renta pasiva'}
          </div>
        </div>
      </section>

      {/* Main Grid: Controls Left (4 cols) + Chart & Milestones Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Base Capital Selector (Patrimonio Real) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              Capital Productivo Inicial
            </h3>

            <div className="space-y-2 mb-3">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 text-xs cursor-pointer border border-transparent hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    className="w-3.5 h-3.5 accent-emerald-600 rounded"
                  />
                  <span className="font-medium text-slate-700 dark:text-zinc-300">Cuentas de Jubilación</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                  {formatCurrency(balanceJubilacion)}
                </span>
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 text-xs cursor-pointer border border-transparent hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeInversiones}
                    onChange={(e) => setIncludeInversiones(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="font-medium text-slate-700 dark:text-zinc-300 block">Cuentas de Inversión</span>
                    <span className="text-[10px] text-slate-400">Fondos y corretaje</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                  {formatCurrency(balanceInversiones)}
                </span>
              </label>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs">
              <span className="text-emerald-800 dark:text-emerald-300 font-semibold">Total Productivo:</span>
              <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatCurrency(startingBalance)}
              </span>
            </div>
          </div>

          {/* Variables & Sliders */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-5">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800 pb-2">
              Variables del Simulador
            </h3>

            {/* Escenario de Mercado */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                Escenario de Rendimiento Anual
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                {Object.entries(MARKET_SCENARIOS).map(([key, s]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScenarioKey(key)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      scenarioKey === key
                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    {s.rate}%
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                {MARKET_SCENARIOS[scenarioKey].desc}
              </p>
            </div>

            {/* Edades */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">Edad Actual</span>
                  <span className="font-bold text-emerald-600">{currentAge}</span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={60}
                  value={currentAge}
                  onChange={(e) => setCurrentAge(Math.min(Number(e.target.value), retirementAge - 1))}
                  className="w-full accent-emerald-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">Edad Retiro</span>
                  <span className="font-bold text-emerald-600">{retirementAge}</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={75}
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Math.max(Number(e.target.value), currentAge + 1))}
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>

            {/* Aporte Mensual */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Aporte Mensual al Fondo</span>
                <span className="font-bold text-emerald-600 font-mono">{formatCurrency(monthlyContribution)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={6000}
                step={100}
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>$0</span>
                <span>$3,000</span>
                <span>$6,000/mes</span>
              </div>
            </div>

            {/* Gasto Deseado de Vida */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Gasto Mensual Deseado en Retiro</span>
                <span className="font-bold text-amber-600 font-mono">{formatCurrency(desiredMonthlyExpense)}</span>
              </div>
              <input
                type="range"
                min={1500}
                max={10000}
                step={250}
                value={desiredMonthlyExpense}
                onChange={(e) => setDesiredMonthlyExpense(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Renta Pasiva Inmobiliaria */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Alquileres Netos en Retiro</span>
                <span className="font-bold text-teal-600 font-mono">+{formatCurrency(monthlyPassiveRealEstate)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={4000}
                step={100}
                value={monthlyPassiveRealEstate}
                onChange={(e) => setMonthlyPassiveRealEstate(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Ingresos netos por alquiler que no requerirán desinvertir de la bolsa.
              </p>
            </div>
          </div>
        </div>

        {/* Main Chart and Milestones Column */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Chart Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col min-h-[420px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Curva de Acumulación y Cruce de Independencia
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Proyección en tiempo real a los {activeReturn}% anual vs Meta FIRE de {formatCurrency(calculatedGoal)}.
                </p>
              </div>

              {/* Linear / Log Toggle */}
              <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartScale('linear')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartScale === 'linear'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  Lineal
                </button>
                <button
                  type="button"
                  onClick={() => setChartScale('logarithmic')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartScale === 'logarithmic'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  Log
                </button>
              </div>
            </div>

            <div className="flex-1">
              <ChartCanvas type="line" data={chartData} options={chartOptions} height={340} />
            </div>
          </div>

          {/* Breakdown Milestones Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Hitos de Riqueza & Renta Mensual Vitalicia
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proyección por edad con la regla del 4% (Retiro Seguro) + Alquileres
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/60 font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                    <th className="p-3.5">Edad</th>
                    <th className="p-3.5">Aporte Propio</th>
                    <th className="p-3.5">Interés Compuesto</th>
                    <th className="p-3.5 text-right">Patrimonio Líquido</th>
                    <th className="p-3.5 text-right text-emerald-600 dark:text-emerald-400">Renta Mensual Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono tabular-nums">
                  {milestones.map((row) => {
                    const isRetirement = row.age === retirementAge;
                    const totalMonthly = row.monthlySafeWithdrawal + monthlyPassiveRealEstate;

                    return (
                      <tr
                        key={row.age}
                        className={`transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40 ${
                          isRetirement ? 'bg-emerald-50/70 dark:bg-emerald-950/30 font-bold' : ''
                        }`}
                      >
                        <td className={`p-3.5 font-sans font-semibold ${isRetirement ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-zinc-200'}`}>
                          {row.age} años {isRetirement ? '🏁 (Jubilación)' : ''}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-zinc-400">
                          {formatCurrency(row.capitalInvested)}
                        </td>
                        <td className="p-3.5 text-teal-600 dark:text-teal-400">
                          +{formatCurrency(row.compoundGrowth)}
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-900 dark:text-zinc-100">
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(totalMonthly)}/mo
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
