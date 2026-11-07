import { useState, useMemo, useEffect } from 'react';
import { useHomeBudget } from '../../context/HomeBudgetContext';
import { useAccounts } from '../../context/AccountsContext';
import { useNetworthHistory } from '../../context/NetworthHistoryContext';
import { computeMonthlyFlowByAccount, buildReconciliationMatrix } from '../../lib/accountReconciliation';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const CATEGORY_LABELS = {
  liquidez: '1. Liquidez (Bancos & Ahorros)',
  inversiones: '2. Inversiones Bursátiles & Brokers',
  jubilacion: '3. Fondos de Jubilación',
  consumo: '4. Tarjetas & Deudas de Consumo',
  prestamos: '5. Préstamos e Hipotecas'
};

const CATEGORY_COLORS = {
  liquidez: '#0d9488',
  inversiones: '#3b82f6',
  jubilacion: '#6366f1',
  consumo: '#f43f5e',
  prestamos: '#e11d48'
};

export default function ConciliacionFinDeMesModal({ isOpen, onClose }) {
  const { allCurrentMonthTransactions, selectedMonth } = useHomeBudget();
  const { accounts: firestoreAccounts, updateAccount } = useAccounts();
  const { saveToday } = useNetworthHistory();

  // Calcular flujos del mes por cuenta a partir de transacciones reales
  const monthlyFlows = useMemo(() => {
    return computeMonthlyFlowByAccount(allCurrentMonthTransactions);
  }, [allCurrentMonthTransactions]);

  // Construir matriz inicial de conciliación
  const initialMatrix = useMemo(() => {
    return buildReconciliationMatrix(firestoreAccounts, monthlyFlows);
  }, [firestoreAccounts, monthlyFlows]);

  // Estados de edición del usuario
  const [edits, setEdits] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Inicializar o resetear edits al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const initialEdits = {};
      initialMatrix.forEach(row => {
        initialEdits[row.id] = String(row.estimatedBalance);
      });
      setEdits(initialEdits);
      setSuccessMessage(null);
    }
  }, [isOpen, initialMatrix]);

  const handleInputChange = (id, rawValue) => {
    let cleaned = rawValue.replace(/[^0-9.-]/g, '');
    setEdits(prev => ({ ...prev, [id]: cleaned }));
  };

  // Matriz computada con los valores confirmados por el usuario
  const computedRows = useMemo(() => {
    return initialMatrix.map(row => {
      const inputVal = edits[row.id];
      const confirmed = inputVal !== undefined ? (Number(inputVal) || 0) : row.estimatedBalance;
      const variance = Math.round((confirmed - row.estimatedBalance) * 100) / 100;
      return {
        ...row,
        confirmedBalance: confirmed,
        variance,
        isMatched: Math.abs(variance) < 0.01
      };
    });
  }, [initialMatrix, edits]);

  // Agrupado por categoría para mostrar secciones limpias
  const rowsByCategory = useMemo(() => {
    const map = {};
    for (const key of Object.keys(CATEGORY_LABELS)) map[key] = [];
    for (const r of computedRows) {
      if (map[r.category]) {
        map[r.category].push(r);
      }
    }
    return map;
  }, [computedRows]);

  // Totales consolidados proyectados
  const summaryTotals = useMemo(() => {
    let totalActivos = 0;
    let totalPasivos = 0;

    for (const r of computedRows) {
      if (r.isLiability) {
        totalPasivos += r.confirmedBalance;
      } else {
        totalActivos += r.confirmedBalance;
      }
    }

    const netWorth = totalActivos - totalPasivos;

    return {
      totalActivos: Math.round(totalActivos * 100) / 100,
      totalPasivos: Math.round(totalPasivos * 100) / 100,
      netWorth: Math.round(netWorth * 100) / 100
    };
  }, [computedRows]);

  // Guardar Conciliación & Actualizar Firestore
  const handleApproveReconciliation = async () => {
    try {
      setIsSubmitting(true);
      let updatedCount = 0;

      // 1. Actualizar cada cuenta en Firestore
      for (const row of computedRows) {
        await updateAccount(row.id, row.name, row.confirmedBalance);
        updatedCount++;
      }

      // 2. Guardar snapshot en historial de patrimonio
      const byCat = {
        liquidez: 0,
        inversiones: 0,
        jubilacion: 0,
        consumo: 0,
        prestamos: 0
      };
      for (const row of computedRows) {
        if (byCat[row.category] !== undefined) {
          byCat[row.category] += row.confirmedBalance;
        }
      }

      try {
        await saveToday({
          ahorro: byCat.liquidez,
          inversion: byCat.inversiones,
          jubilacion: byCat.jubilacion,
          deuda: byCat.consumo,
          prestamo: byCat.prestamos
        });
      } catch (e) {
        console.warn('Snapshot history skipped or warning:', e);
      }

      // 3. Guardar marca de mes conciliado en localStorage
      try {
        const key = 'wealthguide_reconciled_months';
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        saved[selectedMonth] = {
          date: new Date().toISOString(),
          netWorth: summaryTotals.netWorth,
          accountsCount: updatedCount
        };
        localStorage.setItem(key, JSON.stringify(saved));
      } catch (e) {
        console.error(e);
      }

      setSuccessMessage(`¡Conciliación exitosa! Se actualizaron ${updatedCount} cuentas en Patrimonio Neto.`);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1500);

    } catch (err) {
      console.error(err);
      alert(`Error al guardar conciliación: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">sync_alt</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  Conciliación Automática de Fin de Mes
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/50">
                  {selectedMonth}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                El puente que conecta tus movimientos de HomeBudget con tu Balance Patrimonial
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Banner Explicativo */}
        <div className="px-5 py-2.5 bg-teal-50/60 dark:bg-teal-950/30 border-b border-teal-100 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-base">auto_fix_high</span>
            <span>
              Los saldos de cierre se <strong>pre-calculan solos</strong> sumando ingresos y restando gastos/traspasos. Puedes editarlos si hay comisiones o intereses bancarios.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 shrink-0 hidden sm:inline">
            Cierre en 1 clic
          </span>
        </div>

        {/* Contenido con Scroll: Tabla de Conciliación */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {Object.entries(rowsByCategory).map(([catKey, rows]) => {
            if (rows.length === 0) return null;
            const label = CATEGORY_LABELS[catKey] || catKey;
            const color = CATEGORY_COLORS[catKey] || '#94a3b8';

            return (
              <div key={catKey} className="space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-zinc-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    {label}
                  </h4>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                          <th className="py-2.5 px-3 font-semibold">Cuenta</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Saldo Anterior</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Flujo del Mes</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Saldo Estimado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Confirmar en Banco</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                        {rows.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-zinc-100">
                              <div className="flex items-center gap-2">
                                <span>{r.name}</span>
                                {r.hasFlow && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/50">
                                    {r.txCount} mov
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 dark:text-zinc-400">
                              {formatCurrency(r.previousBalance)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-medium ${
                              r.netFlow > 0 ? 'text-emerald-600 dark:text-emerald-400' : (r.netFlow < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')
                            }`}>
                              {r.netFlow > 0 ? `+${formatCurrency(r.netFlow)}` : (r.netFlow < 0 ? formatCurrency(r.netFlow) : '$0.00')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-zinc-300">
                              {formatCurrency(r.estimatedBalance)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1">
                                <span className="text-[10px] text-slate-400">$</span>
                                <input
                                  type="text"
                                  value={edits[r.id] !== undefined ? edits[r.id] : String(r.estimatedBalance)}
                                  onChange={(e) => handleInputChange(r.id, e.target.value)}
                                  className="w-24 text-right bg-transparent outline-none text-xs font-bold text-slate-900 dark:text-zinc-100"
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {r.isMatched ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                                  <span className="material-symbols-outlined text-xs">check</span>
                                  <span>Cuadrado</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50" title={`Diferencia de ${formatCurrency(r.variance)}`}>
                                  <span>Δ {formatCurrency(r.variance)}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer con Resumen y Botón Maestro */}
        <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400">Activos Proyectados: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(summaryTotals.totalActivos)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Pasivos: </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                {formatCurrency(summaryTotals.totalPasivos)}
              </span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-400">Patrimonio Neto: </span>
              <span className="font-black text-slate-900 dark:text-zinc-100 font-mono">
                {formatCurrency(summaryTotals.netWorth)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {successMessage && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                {successMessage}
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApproveReconciliation}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{isSubmitting ? 'Guardando...' : 'Aprobar Cierre & Actualizar Patrimonio'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
