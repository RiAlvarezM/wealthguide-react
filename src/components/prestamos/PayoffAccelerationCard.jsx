import { useState, useMemo } from 'react';
import { calculateLoanProjections, LOAN_DEFAULTS } from '../../lib/loanProjections';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function accountSlug(name = '') {
  return name.toLowerCase().replace(/\s+/g, '');
}

export default function PayoffAccelerationCard({ loan, totalExtraPaid = 0 }) {
  const [customExtra, setCustomExtra] = useState(200);

  const slug = accountSlug(loan?.name || '');
  const defaults = LOAN_DEFAULTS[slug] || LOAN_DEFAULTS['4islas'];

  const projections = useMemo(() => {
    return calculateLoanProjections({
      ...defaults,
      currentBalance: loan?.amount || defaults.initialPrincipal,
      customExtraMonthly: customExtra
    });
  }, [defaults, loan?.amount, customExtra]);

  if (!loan) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 shadow-xs space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">speed</span>
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Aceleración de Plazo por Abonos Extraordinarios
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Impacto de los abonos a capital en la reducción de años de hipoteca para <strong className="text-slate-700 dark:text-zinc-300">{loan.name}</strong>
            </p>
          </div>
        </div>

        {totalExtraPaid > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold self-start sm:self-auto">
            <span className="material-symbols-outlined text-sm">savings</span>
            <span>{formatCurrency(totalExtraPaid)} abonados extra a la fecha</span>
          </div>
        )}
      </div>

      {/* Tarjetas Comparativas de los 3 Escenarios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Escenario 1: Contractual Original */}
        <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                1. Plazo Contractual
              </span>
              <span className="text-[10px] bg-slate-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded font-semibold text-slate-700 dark:text-zinc-300">
                Original
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-1">
              {projections.originalTermYears} Años
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              Vencimiento: <strong className="text-slate-800 dark:text-zinc-200">{projections.originalEndDate}</strong>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-zinc-700/60 text-[11px] text-slate-500 dark:text-zinc-400">
            360 cuotas pactadas sin prepagos
          </div>
        </div>

        {/* Escenario 2: Plazo Actual Base (Solo con lo ya abonado) */}
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                2. Plazo Actual Base
              </span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-bold text-emerald-800 dark:text-emerald-200">
                Ya Ganado
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mb-1">
              ~{projections.base.effectiveTermYears} Años
            </div>
            <div className="text-xs text-slate-600 dark:text-zinc-300">
              Nueva Liquidación: <strong className="text-emerald-700 dark:text-emerald-300">{projections.base.projectedEndDate}</strong>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-500/20 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>Reducción lograda:</span>
            <span>-{projections.base.yearsSaved} Años de hipoteca</span>
          </div>
        </div>

        {/* Escenario 3: Plazo Acelerado (Con abonos continuos) */}
        <div className="bg-teal-50/60 dark:bg-teal-950/30 border border-teal-500/40 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                3. Ritmo Activo (+${customExtra}/m)
              </span>
              <span className="text-[10px] bg-teal-100 dark:bg-teal-900/60 px-1.5 py-0.5 rounded font-bold text-teal-800 dark:text-teal-200">
                Proyectado
              </span>
            </div>
            <div className="text-2xl font-black text-teal-700 dark:text-teal-300 mb-1">
              ~{projections.active.effectiveTermYears} Años
            </div>
            <div className="text-xs text-slate-600 dark:text-zinc-300">
              Liquidación en: <strong className="text-teal-700 dark:text-teal-300">{projections.active.projectedEndDate}</strong>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-teal-500/20 text-[11px] font-semibold text-teal-700 dark:text-teal-300 flex items-center justify-between">
            <span>Ahorro total:</span>
            <span>-{projections.active.yearsSaved} Años de deuda</span>
          </div>
        </div>
      </div>

      {/* Visualización de Línea de Tiempo (Timeline Bar) */}
      <div className="bg-slate-50 dark:bg-zinc-800/40 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-zinc-300">
            Comparativa de Tiempo de Pago
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            Te ahorras ~{projections.active.yearsSaved} Años de cuotas bancarias
          </span>
        </div>

        {/* Barra 1: Trayectoria Original (30 años) */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Plan Original: 30 Años</span>
            <span>Liquidación en {projections.originalEndDate}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-slate-400 dark:bg-zinc-500 h-full rounded-full"
              style={{ width: `${projections.progressOriginalPct}%` }}
              title={`Progreso: ${projections.progressOriginalPct}%`}
            />
          </div>
        </div>

        {/* Barra 2: Trayectoria Proyectada con Abonos */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span>Tu Ritmo Acelerado: ~{projections.active.effectiveTermYears} Años</span>
            <span>Liquidación en {projections.active.projectedEndDate}</span>
          </div>
          <div className="w-full bg-emerald-100 dark:bg-emerald-950/60 h-3 rounded-full overflow-hidden flex">
            {/* Porción ya pagada */}
            <div
              className="bg-emerald-600 h-full"
              style={{ width: `${Math.round((projections.elapsedMonths / projections.active.effectiveTermMonths) * 100)}%` }}
            />
            {/* Porción restante reducida */}
            <div className="bg-emerald-400/50 dark:bg-emerald-500/30 flex-1" />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500">
            <span>{projections.elapsedYears} años transcurridos ({projections.elapsedMonths} cuotas)</span>
            <span>Solo {projections.active.remainingYears} años restantes ({projections.active.remainingMonths} cuotas)</span>
          </div>
        </div>
      </div>

      {/* Simulador Interactivo de Abono Extra Mensual */}
      <div className="bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-xl p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
              Simulador: ¿Cuánto deseas abonar extra a capital al mes?
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Prueba diferentes montos para ver en tiempo real cómo adelantas tu fecha de libertad financiera
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(customExtra)}/mes
            </span>
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={customExtra}
          onChange={(e) => setCustomExtra(Number(e.target.value))}
          className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg"
        />

        {/* Botones de Selección Rápida */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mr-1">Rápido:</span>
          {[0, 100, 200, 300, 500, 750].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setCustomExtra(amt)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                customExtra === amt
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
              }`}
            >
              {amt === 0 ? 'Sin extra' : `+$${amt}`}
            </button>
          ))}
        </div>

        {/* Resumen del impacto de la simulación */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-slate-400 text-[11px]">Plazo Total:</div>
            <div className="font-bold text-slate-900 dark:text-zinc-100">
              ~{projections.active.effectiveTermYears} Años
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">Última Cuota en:</div>
            <div className="font-bold text-emerald-600 dark:text-emerald-400">
              {projections.active.projectedEndDate}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">Ahorro de Intereses:</div>
            <div className="font-bold text-teal-600 dark:text-teal-400">
              ~{formatCurrency(projections.active.interestSavedVsBase)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
