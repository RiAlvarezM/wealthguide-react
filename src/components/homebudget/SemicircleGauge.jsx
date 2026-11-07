import React from 'react';

/**
 * SemicircleGauge.jsx
 * Indicador radial / semicírculo para el Panel de Disponibilidad Presupuestaria.
 * Muestra el porcentaje del presupuesto consumido (0 - 100%+).
 */
export default function SemicircleGauge({ percentage = 0, size = 200, strokeWidth = 18 }) {
  const clampedPct = Math.max(0, percentage);
  const visualPct = Math.min(100, clampedPct);

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = Math.PI * radius; // Semicírculo
  const strokeDashoffset = circumference - (visualPct / 100) * circumference;

  // Color dinámico según nivel de consumo
  const getColor = () => {
    if (clampedPct > 100) return '#ef4444'; // Red (Excedido)
    if (clampedPct > 85) return '#f59e0b';  // Amber (Alerta)
    return '#10b981';                      // Emerald (Saludable)
  };

  return (
    <div className="relative flex flex-col items-center justify-center select-none" style={{ width: size, height: size / 2 + 30 }}>
      <svg width={size} height={size / 2 + 10} className="overflow-visible">
        {/* Fondo del arco */}
        <path
          d={`M ${strokeWidth} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-slate-100 dark:text-zinc-800/80"
        />
        {/* Arco de progreso */}
        <path
          d={`M ${strokeWidth} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${size / 2}`}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Valores numéricos en el centro inferior del semicírculo */}
      <div className="absolute top-[38%] flex flex-col items-center text-center">
        <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight leading-none">
          {clampedPct.toFixed(1)}%
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
          del presupuesto
        </span>
      </div>
    </div>
  );
}
