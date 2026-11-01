// src/pages/Resumen.jsx
//
// Dashboard principal: Análisis histórico, KPIs de patrimonio neto,
// evolución de activos vs pasivos, y distribución por tipo.

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

// Finds the history row whose date is closest to `targetDate`.
function closestEntry(history, targetDate) {
  return history.reduce((best, row) => {
    const diff = Math.abs(new Date(row.date) - targetDate);
    return !best || diff < best.diff ? { row, diff } : best;
  }, null)?.row;
}

// Overlays Propiedades and Automóviles onto accounts-only CSV history
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

function computeMetricTrend(history, getValue) {
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const latestDate = new Date(latest.date);
  const latestValue = getValue(latest);

  const oneMonthAgo = new Date(latestDate);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneYearAgo = new Date(latestDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const monthAgoEntry = closestEntry(history, oneMonthAgo);
  const yearAgoEntry = closestEntry(history, oneYearAgo);

  const pctChange = (from, to) => (from === 0 ? 0 : ((to - from) / Math.abs(from)) * 100);

  return {
    value: latestValue,
    vsLastMonth: pctChange(getValue(monthAgoEntry), latestValue),
    vsLastYear: pctChange(getValue(yearAgoEntry), latestValue),
  };
}

const TYPE_CONFIG = {
  liquidez:    { label: 'Liquidez',           icon: 'savings',             color: '#64748b', bg: 'bg-slate-100',   text: 'text-slate-700' },
  inversiones: { label: 'Inversiones',         icon: 'trending_up',         color: '#0f172a', bg: 'bg-slate-900',   text: 'text-white' },
  jubilacion:  { label: 'Jubilación',          icon: 'account_balance',     color: '#006a61', bg: 'bg-teal-700',    text: 'text-white' },
  propiedades: { label: 'Propiedades',         icon: 'home',                color: '#d97706', bg: 'bg-amber-600',   text: 'text-white' },
  vehiculos:   { label: 'Automóviles',         icon: 'directions_car',      color: '#7c3aed', bg: 'bg-purple-600',  text: 'text-white' },
  prestamos:   { label: 'Préstamos',           icon: 'receipt_long',        color: '#dc2626', bg: 'bg-rose-100',    text: 'text-rose-700' },
  consumo:     { label: 'Deudas de Consumo',   icon: 'credit_card',         color: '#b91c1c', bg: 'bg-red-600',     text: 'text-white' },
};

function TypeAmountCard({ typeKey, amount, sharePct }) {
  const conf = TYPE_CONFIG[typeKey] || { label: typeKey, icon: 'circle', color: '#64748b' };
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-3.5 shadow-sm hover:border-outline transition-all flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
          style={{ backgroundColor: conf.color }}
        >
          <span className="material-symbols-outlined text-[20px]">{conf.icon}</span>
        </div>
        <div>
          <span className="font-body-sm text-body-sm text-on-surface font-semibold block leading-tight">
            {conf.label}
          </span>
          {sharePct !== undefined && (
            <span className="font-label-sm text-[11px] text-on-surface-variant">
              {sharePct.toFixed(1)}% del total
            </span>
          )}
        </div>
      </div>
      <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function KpiTrendCard({ label, trend, icon, accentColor = 'secondary' }) {
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-28 h-28 bg-secondary-fixed/15 rounded-bl-full -mr-12 -mt-12 blur-xl pointer-events-none" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium tracking-wider">
            {label}
          </span>
          {icon && (
            <span className="material-symbols-outlined text-secondary text-[20px] bg-secondary-fixed/20 p-1 rounded-md">
              {icon}
            </span>
          )}
        </div>
        <div className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mb-2">
          {formatCurrency(trend.value)}
        </div>
      </div>

      <div className="pt-2 border-t border-outline-variant/40 flex items-center gap-3">
        {[
          { label: 'mes', pct: trend.vsLastMonth },
          { label: 'año', pct: trend.vsLastYear },
        ].map((item) => {
          const isUp = item.pct > 0.05;
          const isDown = item.pct < -0.05;
          const iconName = isUp ? 'trending_up' : isDown ? 'trending_down' : 'trending_flat';
          const badgeClass = isUp
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : isDown
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-slate-50 text-slate-600 border-slate-200';

          return (
            <div
              key={item.label}
              className={`flex items-center gap-1 font-label-sm text-[11px] px-2 py-0.5 rounded-full border ${badgeClass} font-medium`}
            >
              <span className="material-symbols-outlined text-[13px]">{iconName}</span>
              <span>{item.pct >= 0 ? '+' : ''}{item.pct.toFixed(1)}% vs {item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const netWorthOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
      beginAtZero: true,
      ticks: {
        callback: (value) => `$${(value / 1000).toFixed(0)}k`,
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
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
};

const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => formatCurrency(ctx.raw),
      },
    },
  },
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

  const netWorthTrend = useMemo(() => computeMetricTrend(fullHistory, (row) => row.netWorth), [fullHistory]);
  const jubilacionTrend = useMemo(() => computeMetricTrend(fullHistory, (row) => row.jubilacion), [fullHistory]);
  const liquidezInversionesTrend = useMemo(
    () => computeMetricTrend(fullHistory, (row) => row.ahorro + row.inversion),
    [fullHistory]
  );

  const propiedadesTotal = useMemo(
    () => properties.reduce((sum, p) => sum + p.value, 0),
    [properties]
  );
  const vehiculosTotal = useMemo(
    () => vehicles.reduce((sum, v) => sum + estimateCurrentValue(v), 0),
    [vehicles]
  );

  const latestRow = fullHistory[fullHistory.length - 1] || null;

  const typeAmounts = useMemo(() => {
    if (!latestRow) return null;
    return {
      liquidez: latestRow.ahorro,
      inversiones: latestRow.inversion,
      jubilacion: latestRow.jubilacion,
      propiedades: propiedadesTotal,
      vehiculos: vehiculosTotal,
      prestamos: latestRow.prestamo,
      consumo: latestRow.deuda,
    };
  }, [latestRow, propiedadesTotal, vehiculosTotal]);

  const grandTotal = useMemo(() => {
    if (!typeAmounts) return 0;
    return (
      typeAmounts.liquidez +
      typeAmounts.inversiones +
      typeAmounts.jubilacion +
      typeAmounts.propiedades +
      typeAmounts.vehiculos
    );
  }, [typeAmounts]);

  const netWorthData = useMemo(() => ({
    labels: filteredHistory.map((row) => formatHistoryLabel(row.date)),
    datasets: [
      {
        label: 'Patrimonio Neto',
        data: filteredHistory.map((row) => row.netWorth),
        borderColor: '#0d9488', // Teal-600
        backgroundColor: 'rgba(13, 148, 136, 0.12)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: 'Préstamos y Deudas',
        data: filteredHistory.map((row) => row.prestamo + row.deuda),
        borderColor: '#e11d48', // Rose-600
        backgroundColor: 'rgba(225, 29, 72, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  }), [filteredHistory]);

  const evolutionData = useMemo(() => ({
    labels: filteredHistory.map((row) => formatHistoryLabel(row.date)),
    datasets: [{
      data: filteredHistory.map((row) => row.totalActivos),
      borderColor: '#2563eb',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
    }],
  }), [filteredHistory]);

  const debtRatioData = useMemo(() => ({
    labels: filteredHistory.map((row) => formatHistoryLabel(row.date)),
    datasets: [{
      data: filteredHistory.map((row) => row.debtRatio),
      borderColor: '#0d9488',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
    }],
  }), [filteredHistory]);

  return (
    <AppLayout title="Resumen" searchPlaceholder="Buscar cuentas, transacciones...">
      {/* Header with pill range controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-1">
            Análisis Histórico y Resumen
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Evolución consolidada de activos, pasivos y patrimonio neto a lo largo del tiempo.
          </p>
        </div>

        {/* Segmented Pill Selector for Range */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/60 shadow-xs">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRange(opt)}
              className={`px-3.5 py-1.5 rounded-lg font-label-sm text-label-sm transition-all ${
                range === opt
                  ? 'bg-white text-secondary shadow-sm font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {netWorthTrend && (
          <KpiTrendCard
            label="Patrimonio Neto Total"
            trend={netWorthTrend}
            icon="query_stats"
          />
        )}
        {jubilacionTrend && (
          <KpiTrendCard
            label="Fondo de Jubilación"
            trend={jubilacionTrend}
            icon="account_balance"
          />
        )}
        {liquidezInversionesTrend && (
          <KpiTrendCard
            label="Inversiones + Liquidez"
            trend={liquidezInversionesTrend}
            icon="show_chart"
          />
        )}
      </div>

      {/* Montos Totales por Tipo */}
      {typeAmounts && (
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Composición de Activos y Pasivos
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Montos consolidados al registro más reciente.
              </p>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full">
              Activos Totales: <strong className="text-secondary">{formatCurrency(grandTotal)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <TypeAmountCard
              typeKey="liquidez"
              amount={typeAmounts.liquidez}
              sharePct={grandTotal > 0 ? (typeAmounts.liquidez / grandTotal) * 100 : 0}
            />
            <TypeAmountCard
              typeKey="inversiones"
              amount={typeAmounts.inversiones}
              sharePct={grandTotal > 0 ? (typeAmounts.inversiones / grandTotal) * 100 : 0}
            />
            <TypeAmountCard
              typeKey="jubilacion"
              amount={typeAmounts.jubilacion}
              sharePct={grandTotal > 0 ? (typeAmounts.jubilacion / grandTotal) * 100 : 0}
            />
            <TypeAmountCard
              typeKey="propiedades"
              amount={typeAmounts.propiedades}
              sharePct={grandTotal > 0 ? (typeAmounts.propiedades / grandTotal) * 100 : 0}
            />
            <TypeAmountCard
              typeKey="vehiculos"
              amount={typeAmounts.vehiculos}
              sharePct={grandTotal > 0 ? (typeAmounts.vehiculos / grandTotal) * 100 : 0}
            />
            <TypeAmountCard
              typeKey="prestamos"
              amount={typeAmounts.prestamos}
            />
            <TypeAmountCard
              typeKey="consumo"
              amount={typeAmounts.consumo}
            />
          </div>
        </div>
      )}

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Patrimonio Neto vs Deuda Total
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Curva de acumulación neta comparada con el total de pasivos.
              </p>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed/20 px-2.5 py-1 rounded-md font-semibold">
              {range}
            </span>
          </div>
          <div className="flex-1">
            <ChartCanvas type="line" data={netWorthData} options={netWorthOptions} height={360} />
          </div>
        </div>

        {/* Sparklines Column */}
        <div className="flex flex-col gap-4">
          {/* Activos Totales */}
          <div className="flex-1 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                  Evolución de Activos Totales
                </span>
                <span className="material-symbols-outlined text-blue-600 text-[18px]">account_balance_wallet</span>
              </div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                {latestRow ? formatCurrency(latestRow.totalActivos) : '—'}
              </h3>
            </div>
            <div className="pt-2">
              <ChartCanvas type="line" data={evolutionData} options={sparklineOptions} height={120} />
            </div>
          </div>

          {/* Ratio de Deuda */}
          <div className="flex-1 bg-white border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                  Ratio de Deuda / Activos
                </span>
                <span className="material-symbols-outlined text-teal-600 text-[18px]">percent</span>
              </div>
              <h3 className="font-headline-md text-headline-md font-bold text-teal-700">
                {latestRow ? `${(latestRow.debtRatio * 100).toFixed(1)}%` : '—'}
              </h3>
            </div>
            <div className="pt-2">
              <ChartCanvas type="line" data={debtRatioData} options={sparklineOptions} height={120} />
            </div>
          </div>
        </div>
      </div>

      {/* Historical Net Worth Data Table (Collapsible) */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setShowHistoryTable((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-surface-container-low/50 hover:bg-surface-container-low transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">table_chart</span>
            <h2 className="font-label-md text-label-md uppercase font-semibold text-on-surface">
              Datos Históricos Registrados ({fullHistory.length} meses)
            </h2>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">
            {showHistoryTable ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showHistoryTable && (
          <>
            {deletedCount > 0 && (
              <div className="flex items-center justify-between gap-sm px-4 py-2 border-b border-outline-variant bg-amber-50 text-body-sm font-body-sm text-amber-900">
                <span>{deletedCount} registro{deletedCount !== 1 ? 's' : ''} en papelera.</span>
                <button
                  type="button"
                  onClick={restoreAll}
                  className="text-secondary hover:underline font-label-sm text-label-sm font-semibold"
                >
                  Restaurar todos
                </button>
              </div>
            )}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-low border-b border-outline-variant z-10">
                  <tr className="text-on-surface-variant font-label-sm text-label-sm uppercase">
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-right">Ahorro</th>
                    <th className="p-3 text-right">Inversión</th>
                    <th className="p-3 text-right">Jubilación</th>
                    <th className="p-3 text-right">Deuda</th>
                    <th className="p-3 text-right">Préstamo</th>
                    <th className="p-3 text-right">Patrimonio Neto</th>
                    <th className="p-3 text-center w-16">Acción</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant/40">
                  {fullHistory.map((row) => (
                    <tr key={row.date} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3 font-medium">{row.date}</td>
                      <td className="p-3 text-right">{formatCurrency(row.ahorro)}</td>
                      <td className="p-3 text-right">{formatCurrency(row.inversion)}</td>
                      <td className="p-3 text-right">{formatCurrency(row.jubilacion)}</td>
                      <td className="p-3 text-right text-rose-600">{formatCurrency(row.deuda)}</td>
                      <td className="p-3 text-right text-rose-600">{formatCurrency(row.prestamo)}</td>
                      <td className="p-3 text-right font-bold text-secondary">{formatCurrency(row.netWorth)}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => deleteEntry(row.date)}
                          title="Eliminar registro"
                          className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors"
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