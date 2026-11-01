// src/components/prestamos/LoanChart.jsx
//
// Gráficas interactivas para el análisis de amortización del préstamo:
// 1. Curva de reducción de saldo (Balance Real vs Teórico).
// 2. Composición de pagos anuales (Capital ordinario, Abonos extra e Intereses).

import { useState, useMemo } from 'react';
import ChartCanvas from '../ChartCanvas';
import { useAmortizacion } from '../../context/AmortizacionContext';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function LoanChart() {
  const { schedule } = useAmortizacion();
  const [activeChart, setActiveChart] = useState('balance'); // 'balance' | 'annual'

  // Prepara datos de la curva de balance (muestra cada 3 o 6 meses para no saturar)
  const balanceChartData = useMemo(() => {
    if (!schedule || !schedule.length) return null;

    // Filtramos puntos: primer mes de cada trimestre o cuotas con abonos extra
    const sample = schedule.filter((r, idx) => idx % 3 === 0 || r.extra > 0 || idx === schedule.length - 1);

    const labels = sample.map((r) => r.mesLabel || r.date);
    const realBalances = sample.map((r) => Math.max(0, r.balance));
    const theoBalances = sample.map((r) => Math.max(0, r.theoreticalBalance ?? r.balance));

    return {
      labels,
      datasets: [
        {
          label: 'Saldo Real (con abonos)',
          data: realBalances,
          borderColor: '#0d9488', // teal-600
          backgroundColor: 'rgba(13, 148, 136, 0.1)',
          fill: true,
          tension: 0.2,
          pointRadius: sample.map((r) => (r.extra > 0 ? 4 : 0)),
          pointBackgroundColor: '#0d9488',
          borderWidth: 2.5,
        },
        {
          label: 'Saldo Teórico (Original)',
          data: theoBalances,
          borderColor: '#94a3b8', // slate-400
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [schedule]);

  // Prepara datos agregados por año
  const annualChartData = useMemo(() => {
    if (!schedule || !schedule.length) return null;

    const byYear = {};
    for (const r of schedule) {
      const year = r.date ? r.date.substring(0, 4) : '2016';
      if (!byYear[year]) {
        byYear[year] = { principal: 0, extra: 0, interest: 0 };
      }
      byYear[year].principal += r.principal || 0;
      byYear[year].extra += r.extra || 0;
      byYear[year].interest += Math.max(0, r.interest || 0);
    }

    const years = Object.keys(byYear).sort();
    return {
      labels: years,
      datasets: [
        {
          label: 'Capital Ordinario',
          data: years.map((y) => Math.round(byYear[y].principal)),
          backgroundColor: '#0d9488', // teal-600
          borderRadius: 4,
          stack: 'pagos',
        },
        {
          label: 'Abonos Extra',
          data: years.map((y) => Math.round(byYear[y].extra)),
          backgroundColor: '#10b981', // emerald-500
          borderRadius: 4,
          stack: 'pagos',
        },
        {
          label: 'Intereses',
          data: years.map((y) => Math.round(byYear[y].interest)),
          backgroundColor: '#f59e0b', // amber-500
          borderRadius: 4,
          stack: 'pagos',
        },
      ],
    };
  }, [schedule]);

  const balanceOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 12,
            font: { size: 12, family: 'sans-serif' },
            color: '#64748b',
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt.format(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 12,
            color: '#94a3b8',
            font: { size: 11 },
          },
        },
        y: {
          ticks: {
            callback: (v) => fmt.format(v),
            color: '#94a3b8',
            font: { size: 11 },
          },
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
        },
      },
    }),
    []
  );

  const annualOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 12,
            font: { size: 12 },
            color: '#64748b',
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt.format(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
        y: {
          stacked: true,
          ticks: {
            callback: (v) => fmt.format(v),
            color: '#94a3b8',
            font: { size: 11 },
          },
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
        },
      },
    }),
    []
  );

  if (!schedule || !schedule.length) return null;

  return (
    <div className="bg-white border border-outline-variant rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm mb-6">
      {/* Chart Selector Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            {activeChart === 'balance' ? 'Evolución del Saldo y Ahorro' : 'Distribución Anual de Pagos'}
          </h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {activeChart === 'balance'
              ? 'Comparativa entre el saldo real tras abonos extraordinarios y la trayectoria teórica.'
              : 'Evolución del capital regular, abonos extraordinarios e intereses pagados año tras año.'}
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/50">
          <button
            type="button"
            onClick={() => setActiveChart('balance')}
            className={`px-3 py-1.5 rounded-md font-label-sm text-label-sm transition-all ${
              activeChart === 'balance'
                ? 'bg-white text-secondary shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Curva de Saldo
          </button>
          <button
            type="button"
            onClick={() => setActiveChart('annual')}
            className={`px-3 py-1.5 rounded-md font-label-sm text-label-sm transition-all ${
              activeChart === 'annual'
                ? 'bg-white text-secondary shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Pagos por Año
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="pt-2">
        {activeChart === 'balance' && balanceChartData && (
          <ChartCanvas type="line" data={balanceChartData} options={balanceOptions} height={300} />
        )}
        {activeChart === 'annual' && annualChartData && (
          <ChartCanvas type="bar" data={annualChartData} options={annualOptions} height={300} />
        )}
      </div>
    </div>
  );
}