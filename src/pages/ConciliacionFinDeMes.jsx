import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useHomeBudget } from '../context/HomeBudgetContext';
import { useAccounts } from '../context/AccountsContext';
import { useNetworthHistory } from '../context/NetworthHistoryContext';
import { computeMonthlyFlowByAccount, buildReconciliationMatrix } from '../lib/accountReconciliation';

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

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default function ConciliacionFinDeMes() {
  const navigate = useNavigate();
  const {
    allCurrentMonthTransactions,
    selectedMonth,
    setSelectedMonth,
    handlePrevMonth,
    handleNextMonth
  } = useHomeBudget();
  const { accounts: firestoreAccounts, updateAccount } = useAccounts();
  const { saveToday } = useNetworthHistory();

  // Flujos calculados desde transacciones de HomeBudget
  const monthlyFlows = useMemo(() => {
    return computeMonthlyFlowByAccount(allCurrentMonthTransactions);
  }, [allCurrentMonthTransactions]);

  // Matriz de conciliación cruzando Firestore y HomeBudget
  const initialMatrix = useMemo(() => {
    return buildReconciliationMatrix(firestoreAccounts, monthlyFlows);
  }, [firestoreAccounts, monthlyFlows]);

  const [edits, setEdits] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Inicializar edits al cambiar la matriz o el mes
  useEffect(() => {
    const initialEdits = {};
    initialMatrix.forEach(row => {
      initialEdits[row.id] = String(row.estimatedBalance);
    });
    setEdits(initialEdits);
    setFeedback(null);
  }, [initialMatrix, selectedMonth]);

  const handleInputChange = (id, rawValue) => {
    const cleaned = rawValue.replace(/[^0-9.-]/g, '');
    setEdits(prev => ({ ...prev, [id]: cleaned }));
  };

  const handleResetRow = (id, estimatedVal) => {
    setEdits(prev => ({ ...prev, [id]: String(estimatedVal) }));
  };

  const handleResetAllToEstimated = () => {
    const fresh = {};
    initialMatrix.forEach(row => {
      fresh[row.id] = String(row.estimatedBalance);
    });
    setEdits(fresh);
    setFeedback({ type: 'info', text: 'Se restablecieron todos los saldos al valor proyectado por HomeBudget.' });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Matriz con valores confirmados
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

  // Filtrado por búsqueda y categoría
  const filteredRows = useMemo(() => {
    return computedRows.filter(r => {
      const matchesSearch = !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategoryFilter === 'all' || r.category === activeCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [computedRows, searchTerm, activeCategoryFilter]);

  // Agrupación por categoría
  const rowsByCategory = useMemo(() => {
    const map = {};
    for (const key of Object.keys(CATEGORY_LABELS)) map[key] = [];
    for (const r of filteredRows) {
      if (map[r.category]) {
        map[r.category].push(r);
      }
    }
    return map;
  }, [filteredRows]);

  // Resumen financiero consolidado
  const summary = useMemo(() => {
    let totalActivosAnterior = 0;
    let totalPasivosAnterior = 0;
    let totalActivosConfirmado = 0;
    let totalPasivosConfirmado = 0;
    let totalActivosEstimado = 0;
    let totalPasivosEstimado = 0;
    let reconciledCount = 0;
    let withVarianceCount = 0;

    for (const r of computedRows) {
      if (r.isLiability) {
        totalPasivosAnterior += r.previousBalance;
        totalPasivosEstimado += r.estimatedBalance;
        totalPasivosConfirmado += r.confirmedBalance;
      } else {
        totalActivosAnterior += r.previousBalance;
        totalActivosEstimado += r.estimatedBalance;
        totalActivosConfirmado += r.confirmedBalance;
      }

      if (r.isMatched) {
        reconciledCount++;
      } else {
        withVarianceCount++;
      }
    }

    const netWorthAnterior = totalActivosAnterior - totalPasivosAnterior;
    const netWorthEstimado = totalActivosEstimado - totalPasivosEstimado;
    const netWorthConfirmado = totalActivosConfirmado - totalPasivosConfirmado;

    return {
      netWorthAnterior: Math.round(netWorthAnterior * 100) / 100,
      netWorthEstimado: Math.round(netWorthEstimado * 100) / 100,
      netWorthConfirmado: Math.round(netWorthConfirmado * 100) / 100,
      deltaNetWorth: Math.round((netWorthConfirmado - netWorthAnterior) * 100) / 100,
      reconciledCount,
      withVarianceCount,
      totalAccounts: computedRows.length
    };
  }, [computedRows]);

  // Comprobar si este mes ya fue guardado en el pasado
  const reconciledStatus = useMemo(() => {
    try {
      const key = 'wealthguide_reconciled_months';
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return saved[selectedMonth] || null;
    } catch (e) {
      return null;
    }
  }, [selectedMonth, feedback]);

  // Guardar y Aprobar Conciliación
  const handleApproveReconciliation = async () => {
    try {
      setIsSubmitting(true);
      let updatedCount = 0;

      // 1. Actualizar cuentas en Firestore
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

      // 3. Registrar cierre en localStorage
      try {
        const key = 'wealthguide_reconciled_months';
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        saved[selectedMonth] = {
          date: new Date().toISOString(),
          netWorth: summary.netWorthConfirmado,
          accountsCount: updatedCount
        };
        localStorage.setItem(key, JSON.stringify(saved));
      } catch (e) {
        console.error(e);
      }

      setFeedback({
        type: 'success',
        text: `¡Conciliación de ${formatMonthLabel(selectedMonth)} aprobada! Se sincronizaron ${updatedCount} cuentas en Firestore y se registró el snapshot en Patrimonio.`
      });
      setIsSubmitting(false);

    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: `Error al guardar conciliación: ${err.message}` });
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Conciliación de Fin de Mes"
      searchPlaceholder="Buscar cuenta para conciliar..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <div className="space-y-6">

        {/* 1. HEADER DE CONTROL Y NAVEGACIÓN DE MES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-2xl">
                sync_alt
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Conciliación Automática de Cierre
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Conecta los gastos, ingresos y transferencias de <strong>HomeBudget</strong> con los saldos oficiales de <strong>Patrimonio</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Paginador de Mes */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Mes anterior"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <div className="px-3 text-xs font-bold text-slate-800 dark:text-zinc-200 min-w-[120px] text-center font-mono">
                {formatMonthLabel(selectedMonth)}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Mes siguiente"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>

            {/* Badge de estado del mes */}
            {reconciledStatus ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>Mes Conciliado</span>
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">pending_actions</span>
                <span>Pendiente de Cierre</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-300'
                : 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 text-teal-800 dark:text-teal-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                {feedback.type === 'success' ? 'check_circle' : feedback.type === 'error' ? 'error' : 'info'}
              </span>
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2. TARJETAS DE IMPACTO PATRIMONIAL */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Patrimonio Anterior
            </span>
            <div className="text-lg sm:text-xl font-black text-slate-700 dark:text-zinc-300 mt-1 font-mono">
              {formatCurrency(summary.netWorthAnterior)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Saldo base registrado</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider block">
              Proyección HomeBudget
            </span>
            <div className="text-lg sm:text-xl font-black text-teal-700 dark:text-teal-300 mt-1 font-mono">
              {formatCurrency(summary.netWorthEstimado)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.netWorthEstimado >= summary.netWorthAnterior ? '+' : ''}
              {formatCurrency(summary.netWorthEstimado - summary.netWorthAnterior)} este mes
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Patrimonio Confirmado
            </span>
            <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
              {formatCurrency(summary.netWorthConfirmado)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Cifra que se guardará
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Estado de Conciliación
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-zinc-100 font-mono">
                {summary.reconciledCount}/{summary.totalAccounts}
              </span>
              <span className="text-xs text-slate-500">cuadradas</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.withVarianceCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {summary.withVarianceCount} con ajuste manual
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  100% cuadradas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. FILTROS Y ACCIONES DE TABLA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter por Categoría */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Todas ({computedRows.length})
            </button>
            {Object.keys(CATEGORY_LABELS).map(catKey => (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategoryFilter(catKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  activeCategoryFilter === catKey
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[catKey] }} />
                <span>{catKey.charAt(0).toUpperCase() + catKey.slice(1)}</span>
              </button>
            ))}
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAllToEstimated}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
              title="Restablecer todos los saldos confirmados a los estimados proyectados"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              <span>Reestablecer Proyecciones</span>
            </button>

            <button
              type="button"
              onClick={handleApproveReconciliation}
              disabled={isSubmitting}
              className="py-1.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 active:scale-98 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              <span>{isSubmitting ? 'Guardando...' : 'Aprobar Cierre'}</span>
            </button>
          </div>
        </div>

        {/* 4. TABLA DE CONCILIACIÓN POR SECCIONES */}
        <div className="space-y-6">
          {Object.entries(rowsByCategory).map(([catKey, rows]) => {
            if (rows.length === 0) return null;
            const label = CATEGORY_LABELS[catKey] || catKey;
            const color = CATEGORY_COLORS[catKey] || '#94a3b8';

            return (
              <div key={catKey} className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      {label}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {rows.length} {rows.length === 1 ? 'cuenta' : 'cuentas'}
                  </span>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                          <th className="py-2.5 px-3.5 font-semibold">Cuenta</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Saldo Anterior</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Entradas (+)</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Salidas (-)</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Flujo Neto</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Saldo Proyectado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Saldo Real Confirmado</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                          <th className="py-2.5 px-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                        {rows.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 px-3.5 font-sans font-semibold text-slate-900 dark:text-zinc-100">
                              <div className="flex items-center gap-2">
                                <span>{r.name}</span>
                                {r.hasFlow && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/50">
                                    {r.txCount} mov
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500 dark:text-zinc-400">
                              {formatCurrency(r.previousBalance)}
                            </td>
                            <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                              {r.inflows > 0 ? `+${formatCurrency(r.inflows)}` : '—'}
                            </td>
                            <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 font-medium">
                              {r.outflows > 0 ? `-${formatCurrency(r.outflows)}` : '—'}
                            </td>
                            <td className={`py-3 px-3 text-right font-medium ${
                              r.netFlow > 0 ? 'text-emerald-600 dark:text-emerald-400' : (r.netFlow < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')
                            }`}>
                              {r.netFlow > 0 ? `+${formatCurrency(r.netFlow)}` : (r.netFlow < 0 ? formatCurrency(r.netFlow) : '$0.00')}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-teal-700 dark:text-teal-300">
                              {formatCurrency(r.estimatedBalance)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
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
                            <td className="py-3 px-3 text-center">
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
                            <td className="py-3 px-3 text-center">
                              {!r.isMatched && (
                                <button
                                  type="button"
                                  onClick={() => handleResetRow(r.id, r.estimatedBalance)}
                                  className="text-[11px] text-slate-400 hover:text-teal-600 hover:underline"
                                  title="Igualar a la proyección estimada"
                                >
                                  Revertir
                                </button>
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

        {/* 5. FOOTER FIJO DE APROBACIÓN */}
        <div className="sticky bottom-4 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Cierre de Mes: {formatMonthLabel(selectedMonth)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Al aprobar, los saldos confirmados se actualizarán directamente en Firestore y se registrará un snapshot patrimonial histórico.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate('/presupuesto')}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Volver al Dashboard
            </button>

            <button
              type="button"
              onClick={handleApproveReconciliation}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{isSubmitting ? 'Guardando...' : 'Aprobar Cierre & Actualizar Patrimonio'}</span>
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
