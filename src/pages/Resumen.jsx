import { useState, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import { filterHistoryByRange, formatHistoryLabel } from '../data/networthHistory';
import { useProperties } from '../context/PropertiesContext';
import { useVehicles, estimateCurrentValue } from '../context/VehiclesContext';
import { useNetworthHistory } from '../context/NetworthHistoryContext';

const RANGE_OPTIONS = ['Últimos 5 Años', 'Últimos 10 Años', 'Todo el Tiempo'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const KPI_CARDS = [
  {
    label: 'Efectivo Disponible',
    value: '$8,250,000',
    trend: '+5.2% vs año pasado',
    trendIcon: 'trending_up',
    trendColor: 'text-secondary-fixed-dim',
  },
  {
    label: 'Ratio Deuda-Capital',
    value: '0.18',
    trend: 'Estable vs año pasado',
    trendIcon: 'trending_flat',
    trendColor: 'text-on-surface-variant',
  },
];

// Finds the history row whose date is closest to `targetDate`.
function closestEntry(history, targetDate) {
  return history.reduce((best, row) => {
    const diff = Math.abs(new Date(row.date) - targetDate);
    return !best || diff < best.diff ? { row, diff } : best;
  }, null)?.row;
}

// Overlays Propiedades (held at avalúo value from their appraisal/purchase date onward) and
// Automóviles (depreciated estimate, counted from their purchase year onward) onto the
// accounts-only CSV history — mirrors the equation used on the Patrimonio Neto page.
function applyPropertiesAndVehicles(history, properties, vehicles) {
  return history.map((row) => {
    const rowYear = Number(row.date.slice(0, 4));
    const propiedadesAtDate = properties
      .filter((p) => p.appraisalDate <= row.date)
      .reduce((sum, p) => sum + p.value, 0);
    const vehiculosAtDate = vehicles
      .filter((v) => rowYear >= v.purchaseYear)
      .reduce((sum, v) => sum + estimateCurrentValue(v, rowYear), 0);

    const totalActivos = row.totalActivos + propiedadesAtDate + vehiculosAtDate;
    const netWorth = totalActivos - row.totalPasivos;
    const debtRatio = totalActivos > 0 ? row.totalPasivos / totalActivos : 0;

    return { ...row, totalActivos, netWorth, debtRatio };
  });
}

function computeNetWorthTrend(history) {
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const latestDate = new Date(latest.date);

  const oneMonthAgo = new Date(latestDate);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneYearAgo = new Date(latestDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const monthAgoEntry = closestEntry(history, oneMonthAgo);
  const yearAgoEntry = closestEntry(history, oneYearAgo);

  const pctChange = (from, to) => (from === 0 ? 0 : ((to - from) / Math.abs(from)) * 100);

  return {
    latest,
    vsLastMonth: pctChange(monthAgoEntry.netWorth, latest.netWorth),
    vsLastYear: pctChange(yearAgoEntry.netWorth, latest.netWorth),
  };
}

const netWorthOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (value) => `$${(value / 1000).toFixed(0)}k` } },
    x: { grid: { display: false } },
  },
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
};

const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: { display: false }, y: { display: false } },
};

export default function Resumen() {
  const [range, setRange] = useState('Todo el Tiempo');
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const { properties } = useProperties();
  const { vehicles } = useVehicles();
  const { history, deleteEntry, restoreAll, deletedCount } = useNetworthHistory();

  const fullHistory = useMemo(
    () => applyPropertiesAndVehicles(history, properties, vehicles),
    [history, properties, vehicles]
  );

  const filteredHistory = useMemo(
    () => filterHistoryByRange(fullHistory, range),
    [fullHistory, range]
  );

  const netWorthTrend = useMemo(() => computeNetWorthTrend(fullHistory), [fullHistory]);

  const netWorthData = useMemo(() => ({
    labels: filteredHistory.map((row) => formatHistoryLabel(row.date)),
    datasets: [
      {
        label: 'Patrimonio Neto',
        data: filteredHistory.map((row) => row.netWorth),
        borderColor: '#006a61',
        backgroundColor: 'rgba(0, 106, 97, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'Préstamos',
        data: filteredHistory.map((row) => row.prestamo),
        borderColor: '#ba1a1a',
        backgroundColor: 'rgba(186, 26, 26, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  }), [filteredHistory]);

  const evolutionData = useMemo(() => ({
    labels: filteredHistory.map((row) => formatHistoryLabel(row.date)),
    datasets: [{
      data: filteredHistory.map((row) => row.totalActivos),
      borderColor: '#3980f4',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
    }],
  }), [filteredHistory]);

  const debtRatioData = useMemo(() => ({
    labels: filteredHistory.map((row) => formatHistoryLabel(row.date)),
    datasets: [{
      data: filteredHistory.map((row) => row.debtRatio),
      borderColor: '#005049',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
    }],
  }), [filteredHistory]);

  return (
    <AppLayout title="Resumen" searchPlaceholder="Buscar cuentas, transacciones...">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Análisis Histórico</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Resumen integral de la evolución del patrimonio neto y los ratios de deuda a lo largo del tiempo.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="border border-outline-variant rounded bg-white text-body-sm px-3 py-2 outline-none focus:border-tertiary-container"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {netWorthTrend && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-sm shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)]">
            <div className="font-label-md text-label-md text-on-surface-variant uppercase mb-2">Patrimonio Neto Total</div>
            <div className="font-display-lg text-display-lg text-on-surface mb-1">
              {formatCurrency(netWorthTrend.latest.netWorth)}
            </div>
            <div className="flex flex-col gap-1">
              {[
                { label: 'vs mes anterior', pct: netWorthTrend.vsLastMonth },
                { label: 'vs año anterior', pct: netWorthTrend.vsLastYear },
              ].map((item) => {
                const icon = item.pct > 0.05 ? 'trending_up' : item.pct < -0.05 ? 'trending_down' : 'trending_flat';
                const color = item.pct > 0.05 ? 'text-secondary-fixed-dim' : item.pct < -0.05 ? 'text-error' : 'text-on-surface-variant';
                return (
                  <div key={item.label} className={`flex items-center gap-1 ${color} font-label-sm text-label-sm`}>
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    <span>{item.pct >= 0 ? '+' : ''}{item.pct.toFixed(1)}% {item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {KPI_CARDS.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-surface-container-lowest border border-outline-variant rounded p-sm shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)]"
          >
            <div className="font-label-md text-label-md text-on-surface-variant uppercase mb-2">{kpi.label}</div>
            <div className="font-display-lg text-display-lg text-on-surface mb-1">{kpi.value}</div>
            <div className={`flex items-center gap-1 ${kpi.trendColor} font-label-sm text-label-sm`}>
              <span className="material-symbols-outlined text-[16px]">{kpi.trendIcon}</span>
              <span>{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded p-sm shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)]">
          <div className="flex justify-between items-center mb-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">Patrimonio Neto vs Préstamos</h2>
            <button type="button" className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
          </div>
          <ChartCanvas type="line" data={netWorthData} options={netWorthOptions} height={400} />
        </div>

        <div className="space-y-gutter flex flex-col">
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded p-sm shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)]">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-md">Evolución Financiera</h2>
            <ChartCanvas type="line" data={evolutionData} options={sparklineOptions} height={150} />
          </div>
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded p-sm shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)]">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-md">Tendencia Ratio de Deuda</h2>
            <ChartCanvas type="line" data={debtRatioData} options={sparklineOptions} height={150} />
          </div>
        </div>
      </div>

      {/* Historical Net Worth Data (raw source for the charts above, collapsed by default) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHistoryTable((v) => !v)}
          className="w-full flex items-center justify-between p-sm border-b border-outline-variant bg-surface-container-low text-left"
        >
          <h2 className="font-label-md text-label-md uppercase text-on-surface-variant">
            Datos Históricos de Patrimonio Neto ({fullHistory.length} registros)
          </h2>
          <span className="material-symbols-outlined text-on-surface-variant">
            {showHistoryTable ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {showHistoryTable && (
          <>
            {deletedCount > 0 && (
              <div className="flex items-center justify-between gap-sm px-3 py-2 border-b border-outline-variant bg-surface-container-low text-body-sm font-body-sm text-on-surface-variant">
                <span>{deletedCount} registro{deletedCount !== 1 ? 's' : ''} eliminado{deletedCount !== 1 ? 's' : ''}.</span>
                <button
                  type="button"
                  onClick={restoreAll}
                  className="text-secondary hover:underline font-label-sm text-label-sm"
                >
                  Restaurar todos
                </button>
              </div>
            )}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0">
                  <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm uppercase">
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-right">Ahorro</th>
                    <th className="p-3 text-right">Inversión</th>
                    <th className="p-3 text-right">Jubilación</th>
                    <th className="p-3 text-right">Deuda</th>
                    <th className="p-3 text-right">Préstamo</th>
                    <th className="p-3 text-right">Patrimonio Neto</th>
                    <th className="p-3 text-right w-16">Acciones</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant">
                  {fullHistory.map((row) => (
                    <tr key={row.date} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3">{row.date}</td>
                      <td className="p-3 text-right">{formatCurrency(row.ahorro)}</td>
                      <td className="p-3 text-right">{formatCurrency(row.inversion)}</td>
                      <td className="p-3 text-right">{formatCurrency(row.jubilacion)}</td>
                      <td className="p-3 text-right text-error">{formatCurrency(row.deuda)}</td>
                      <td className="p-3 text-right text-error">{formatCurrency(row.prestamo)}</td>
                      <td className="p-3 text-right font-bold text-secondary">{formatCurrency(row.netWorth)}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteEntry(row.date)}
                          title="Eliminar registro"
                          className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
