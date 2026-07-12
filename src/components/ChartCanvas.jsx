import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Envuelve un <canvas> de Chart.js como componente de React.
 * Crea el chart al montar, lo destruye al desmontar, y lo re-crea si
 * cambian los datos/opciones para evitar fugas de memoria.
 */
export default function ChartCanvas({ type, data, options, height = 300 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type,
      data,
      options,
    });

    return () => {
      chartRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(data), JSON.stringify(options)]);

  return (
    <div className="w-full relative" style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
