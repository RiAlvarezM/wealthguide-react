import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import { useAccounts } from '../context/AccountsContext';

function formatCurrency(value, maximumFractionDigits = 0) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits });
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

// Standard future-value-of-an-annuity projection: starting balance compounds monthly,
// plus a level monthly contribution compounding alongside it.
function projectBalance(startingBalance, monthlyContribution, annualReturnPct, months) {
  const r = annualReturnPct / 100 / 12;
  if (r === 0) return startingBalance + monthlyContribution * months;
  const growth = Math.pow(1 + r, months);
  return startingBalance * growth + monthlyContribution * ((growth - 1) / r);
}

const DEFAULTS = {
  currentAge: 35,
  retirementAge: 65,
  monthlyContribution: 2500,
  expectedReturn: 7,
  goal: 500000,
};

export default function Jubilacion() {
  const { accounts } = useAccounts();

  const startingBalance = useMemo(
    () => accounts
      .filter((acc) => acc.category === 'jubilacion' && acc.active !== false)
      .reduce((sum, acc) => sum + acc.amount, 0),
    [accounts]
  );

  const [currentAge, setCurrentAge] = useState(DEFAULTS.currentAge);
  const [retirementAge, setRetirementAge] = useState(DEFAULTS.retirementAge);
  const [monthlyContribution, setMonthlyContribution] = useState(DEFAULTS.monthlyContribution);
  const [expectedReturn, setExpectedReturn] = useState(DEFAULTS.expectedReturn);
  const [goal, setGoal] = useState(DEFAULTS.goal);
  const [chartScale, setChartScale] = useState('linear');

  const handleReset = () => {
    setCurrentAge(DEFAULTS.currentAge);
    setRetirementAge(DEFAULTS.retirementAge);
    setMonthlyContribution(DEFAULTS.monthlyContribution);
    setExpectedReturn(DEFAULTS.expectedReturn);
    setGoal(DEFAULTS.goal);
  };

  const projection = useMemo(() => {
    const ages = [];
    for (let age = currentAge; age <= retirementAge; age += 1) ages.push(age);
    if (ages[ages.length - 1] !== retirementAge) ages.push(retirementAge);

    return ages.map((age) => {
      const months = (age - currentAge) * 12;
      const balance = projectBalance(startingBalance, monthlyContribution, expectedReturn, months);
      const capitalInvested = startingBalance + monthlyContribution * months;
      return { age, balance, capitalInvested, interest: balance - capitalInvested };
    });
  }, [currentAge, retirementAge, monthlyContribution, expectedReturn, startingBalance]);

  const projectedAtRetirement = projection[projection.length - 1]?.balance ?? startingBalance;
  const progressPct = goal > 0 ? Math.min(150, (projectedAtRetirement / goal) * 100) : 0;
  const onTrack = projectedAtRetirement >= goal;

  // Milestones every 10 years, plus the final retirement age.
  const milestones = useMemo(() => {
    const rows = projection.filter((row) => row.age !== currentAge && row.age % 10 === 0);
    const last = projection[projection.length - 1];
    if (last && !rows.some((row) => row.age === last.age)) rows.push(last);
    return rows;
  }, [projection, currentAge]);

  const chartData = useMemo(() => ({
    labels: projection.map((row) => `Edad ${row.age}`),
    datasets: [
      {
        label: 'Riqueza Proyectada',
        data: projection.map((row) => row.balance),
        borderColor: '#006a61',
        backgroundColor: 'rgba(0, 106, 97, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: `Meta de Objetivo (${formatCurrency(goal)})`,
        data: projection.map(() => goal),
        borderColor: '#3980f4',
        borderDash: [6, 6],
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
      },
    ],
  }), [projection, goal]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      y: {
        type: chartScale,
        beginAtZero: chartScale === 'linear',
        ticks: { callback: (value) => `$${formatCompact(value)}` },
      },
      x: { grid: { display: false } },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  }), [chartScale]);

  return (
    <AppLayout title="Jubilación" searchPlaceholder="Buscar escenarios de jubilación...">
      <div className="mb-lg flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface">Simulador de Jubilación</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl">
            Proyecte su trayectoria patrimonial e identifique brechas en su estrategia a largo plazo.
          </p>
        </div>
        <div className="flex items-center gap-2 text-secondary-fixed-dim bg-secondary-fixed-dim/10 px-3 py-1.5 rounded-full border border-secondary-fixed-dim/20">
          <span className="material-symbols-outlined text-[18px]">sync</span>
          <span className="font-label-md text-label-md">Conectado a Configuración → Cuentas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Controls Panel */}
        <div className="lg:col-span-4 flex flex-col gap-sm">
          {/* Status Card */}
          <div className="bg-white border border-outline-variant rounded-xl p-md shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/20 rounded-bl-full -z-10" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Estado de la Trayectoria</h3>
              <div className={`flex items-center gap-1 ${onTrack ? 'text-secondary' : 'text-error'}`}>
                <span className="material-symbols-outlined text-[16px]">{onTrack ? 'trending_up' : 'trending_down'}</span>
                <span className="font-label-md text-label-md font-bold">{onTrack ? 'En Camino' : 'Necesita Ajustes'}</span>
              </div>
            </div>
            <div className="mb-1">
              <span className="font-headline-lg text-headline-lg text-on-surface">{formatCurrency(projectedAtRetirement)}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant ml-1">proyectado</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
              {onTrack
                ? `Se proyecta que superará su meta de ${formatCurrency(goal)} a los ${retirementAge} años.`
                : `Se proyecta que no alcanzará su meta de ${formatCurrency(goal)} a los ${retirementAge} años.`}
            </p>
            <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${onTrack ? 'bg-secondary' : 'bg-error'}`}
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 font-label-sm text-label-sm text-outline">
              <span>Actual: {formatCurrency(startingBalance)}</span>
              <span>Meta: {formatCurrency(goal)}</span>
            </div>
          </div>

          {/* Simulator Controls */}
          <div className="bg-white border border-outline-variant rounded-xl p-md shadow-sm flex-1">
            <div className="flex items-center gap-2 mb-6 border-b border-outline-variant pb-4">
              <span className="material-symbols-outlined text-on-surface-variant">tune</span>
              <h3 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-widest">
                Variables de Simulación
              </h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Edad Actual</label>
                  <span className="font-label-md text-label-md bg-surface-container-low px-2 py-1 rounded text-on-surface border border-outline-variant">
                    {currentAge}
                  </span>
                </div>
                <input
                  className="w-full"
                  max={60}
                  min={20}
                  type="range"
                  value={currentAge}
                  onChange={(e) => setCurrentAge(Math.min(Number(e.target.value), retirementAge - 1))}
                />
                <div className="flex justify-between text-[10px] font-label-sm text-outline">
                  <span>20</span><span>60</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Edad de Jubilación</label>
                  <span className="font-label-md text-label-md bg-surface-container-low px-2 py-1 rounded text-on-surface border border-outline-variant">
                    {retirementAge}
                  </span>
                </div>
                <input
                  className="w-full"
                  max={80}
                  min={50}
                  type="range"
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Math.max(Number(e.target.value), currentAge + 1))}
                />
                <div className="flex justify-between text-[10px] font-label-sm text-outline">
                  <span>50</span><span>80</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Contribución Mensual</label>
                  <span className="font-label-md text-label-md bg-surface-container-low px-2 py-1 rounded text-on-surface border border-outline-variant">
                    {formatCurrency(monthlyContribution)}
                  </span>
                </div>
                <input
                  className="w-full"
                  max={10000}
                  min={0}
                  step={100}
                  type="range"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-label-sm text-outline">
                  <span>$0</span><span>$10k</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Rendimiento Esperado del Mercado</label>
                  <span className="font-label-md text-label-md bg-surface-container-low px-2 py-1 rounded text-on-surface border border-outline-variant">
                    {expectedReturn.toFixed(1)}%
                  </span>
                </div>
                <input
                  className="w-full"
                  max={12}
                  min={1}
                  step={0.5}
                  type="range"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(Number(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-label-sm text-outline">
                  <span>Conservador (1%)</span><span>Agresivo (12%)</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Meta de Jubilación</label>
                  <span className="font-label-md text-label-md bg-surface-container-low px-2 py-1 rounded text-on-surface border border-outline-variant">
                    {formatCurrency(goal)}
                  </span>
                </div>
                <input
                  className="w-full"
                  max={5000000}
                  min={50000}
                  step={50000}
                  type="range"
                  value={goal}
                  onChange={(e) => setGoal(Number(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-label-sm text-outline">
                  <span>$50k</span><span>$5M</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="w-full mt-8 bg-surface-container-low text-on-surface font-label-md text-label-md h-10 rounded border border-outline-variant hover:bg-surface-container transition-colors"
            >
              Restablecer Valores
            </button>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="lg:col-span-8 flex flex-col gap-sm">
          <div className="bg-white border border-outline-variant rounded-xl p-md shadow-sm flex-1 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Proyección de Riqueza</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Crecimiento del fondo de jubilación a lo largo del tiempo frente a la meta.
                </p>
              </div>
              <div className="flex bg-surface-container-low rounded p-1 border border-outline-variant">
                <button
                  type="button"
                  onClick={() => setChartScale('linear')}
                  className={`px-3 py-1 font-label-sm text-label-sm rounded transition-colors ${
                    chartScale === 'linear' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Lineal
                </button>
                <button
                  type="button"
                  onClick={() => setChartScale('logarithmic')}
                  className={`px-3 py-1 font-label-sm text-label-sm rounded transition-colors ${
                    chartScale === 'logarithmic' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
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

          {/* Breakdown Table */}
          <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-md border-b border-outline-variant">
              <h3 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-widest">Desglose de Hitos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-bright font-label-sm text-label-sm text-outline uppercase tracking-wider border-b border-outline-variant">
                    <th className="p-4 font-medium">Edad</th>
                    <th className="p-4 font-medium">Capital Invertido</th>
                    <th className="p-4 font-medium">Interés Compuesto</th>
                    <th className="p-4 font-medium text-right">Saldo Total</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant">
                  {milestones.map((row) => {
                    const isRetirement = row.age === retirementAge;
                    return (
                      <tr
                        key={row.age}
                        className={`hover:bg-surface-container-low transition-colors ${isRetirement ? 'bg-secondary-fixed/5 font-bold' : ''}`}
                      >
                        <td className={`p-4 ${isRetirement ? 'text-secondary' : ''}`}>
                          {row.age}{isRetirement ? ' (Jubilación)' : ''}
                        </td>
                        <td className="p-4">{formatCurrency(row.capitalInvested)}</td>
                        <td className={`p-4 font-medium ${isRetirement ? 'text-secondary' : 'text-secondary-container-dark'}`}>
                          +{formatCurrency(row.interest)}
                        </td>
                        <td className={`p-4 text-right font-label-md ${isRetirement ? 'text-secondary' : ''}`}>
                          {formatCurrency(row.balance)}
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
