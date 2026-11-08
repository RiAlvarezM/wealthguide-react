// src/components/prestamos/AmortizacionTable.jsx
//
// Tabla avanzada del calendario de amortización con capacidad de conciliación mensual:
//   • Edición directa inline y modal de Capital e Intereses con recálculo en cascada
//   • Cuotas conciliadas resaltadas en NEGRITA (estilo Excel de conciliación de estados de cuenta)
//   • Comparativa en cada fila: Tasa Teórica (%) vs Tasa Real Anualizada (%) en base a intereses desembolsados
//   • Acciones rápidas: "Marcar conciliado hasta este mes", filtros por estado y exportación a CSV

import { useState, useMemo } from 'react';
import { useAmortizacion } from '../../context/AmortizacionContext';
import { exportScheduleToCsv } from '../../lib/amortizacionParser';
import ImportAmortizacionModal from './ImportAmortizacionModal';
import ConciliacionModal from './ConciliacionModal';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}

// Determinar si una fila está conciliada con el estado de cuenta bancario
// (por defecto hasta agosto 2026, cuota #125)
function isRowReconciled(row) {
  if (row.reconciled !== undefined) return Boolean(row.reconciled);
  return Number(row.n) <= 125;
}

export default function AmortizacionTable() {
  const {
    schedule,
    scheduleLoading,
    loanMetadata,
    updateScheduleRowCascade,
    markReconciledUntil,
  } = useAmortizacion();

  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [conciliacionTarget, setConciliacionTarget] = useState(null); // { cuota, prevBalance }

  // Estado para edición inline rápida
  const [editingRowN, setEditingRowN] = useState(null);
  const [editForm, setEditForm] = useState({ principal: '', interest: '', extra: '', note: '' });
  const [isSavingInline, setIsSavingInline] = useState(false);

  const today = useMemo(() => new Date(), []);
  const initialLoanAmount = loanMetadata?.originalAmount || 108000;

  // Lista de años disponibles
  const availableYears = useMemo(() => {
    if (!schedule || !schedule.length) return [];
    const set = new Set();
    schedule.forEach((r) => {
      if (r.date) set.add(r.date.substring(0, 4));
    });
    return Array.from(set).sort();
  }, [schedule]);

  // Cuota actual a la fecha
  const currentN = useMemo(() => {
    if (!schedule.length) return null;
    const paid = schedule.filter((r) => new Date(r.date) <= today && r.balance > 0);
    return paid[paid.length - 1]?.n ?? schedule[0]?.n;
  }, [schedule, today]);

  // Última cuota conciliada
  const latestReconciled = useMemo(() => {
    if (!schedule || !schedule.length) return null;
    const reconciledList = schedule.filter((r) => isRowReconciled(r));
    return reconciledList.length ? reconciledList[reconciledList.length - 1] : null;
  }, [schedule]);

  // Tasa real de la última cuota conciliada
  const latestReconciledRate = useMemo(() => {
    if (!latestReconciled || !schedule.length) return 3.50;
    const idx = schedule.findIndex((r) => r.n === latestReconciled.n);
    const prev = idx === 0 ? initialLoanAmount : (schedule[idx - 1]?.balance || initialLoanAmount);
    return prev > 0 && latestReconciled.interest > 0 ? (latestReconciled.interest / prev) * 12 * 100 : 3.50;
  }, [latestReconciled, schedule, initialLoanAmount]);

  const reconciledCount = useMemo(() => {
    if (!schedule) return 0;
    return schedule.filter((r) => isRowReconciled(r)).length;
  }, [schedule]);

  // Filtrado de filas
  const filtered = useMemo(() => {
    let rows = schedule;

    if (statusFilter === 'RECONCILED') {
      rows = rows.filter((r) => isRowReconciled(r));
    } else if (statusFilter === 'PENDING') {
      rows = rows.filter((r) => !isRowReconciled(r));
    } else if (statusFilter === 'EXTRA') {
      rows = rows.filter((r) => r.extra > 0);
    } else if (statusFilter === 'PAID') {
      rows = rows.filter((r) => new Date(r.date) <= today);
    } else if (statusFilter === 'FUTURE') {
      rows = rows.filter((r) => new Date(r.date) > today);
    }

    if (selectedYear !== 'ALL') {
      rows = rows.filter((r) => r.date && r.date.startsWith(selectedYear));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.mesLabel?.toLowerCase().includes(q) ||
          String(r.n).includes(q) ||
          r.note?.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [schedule, search, selectedYear, statusFilter, today]);

  // Totales del resumen
  const summaryTotals = useMemo(() => {
    let principal = 0;
    let extra = 0;
    let interest = 0;
    let totalPaid = 0;

    for (const r of filtered) {
      principal += r.principal || 0;
      extra += r.extra || 0;
      interest += r.interest || 0;
      totalPaid += (r.total || 0) + (r.extra || 0);
    }

    return { principal, extra, interest, totalPaid };
  }, [filtered]);

  const actualPageSize = pageSize === 'ALL' ? filtered.length || 1 : pageSize;
  const totalPages = Math.ceil(filtered.length / actualPageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const pageRows = pageSize === 'ALL' ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleFilterChange() {
    setPage(1);
  }

  function handleOpenConciliacion(row) {
    const prevIndex = schedule.findIndex((r) => r.n === row.n) - 1;
    const prevBalance = prevIndex >= 0 ? schedule[prevIndex].balance : initialLoanAmount;
    setConciliacionTarget({ cuota: row, prevBalance });
  }

  // Iniciar edición inline
  function startInlineEdit(row) {
    setEditingRowN(row.n);
    setEditForm({
      principal: row.principal || 0,
      interest: row.interest || 0,
      extra: row.extra || 0,
      note: row.note || '',
    });
  }

  function cancelInlineEdit() {
    setEditingRowN(null);
  }

  async function saveInlineEdit(row) {
    setIsSavingInline(true);
    try {
      await updateScheduleRowCascade(row.n, {
        principal: Number(editForm.principal),
        interest: Number(editForm.interest),
        extra: Number(editForm.extra),
        note: editForm.note,
        reconciled: true, // Al guardar conciliación se marca conciliado
      });
      setEditingRowN(null);
    } catch (err) {
      console.error('Error guardando edición inline:', err);
    } finally {
      setIsSavingInline(false);
    }
  }

  async function handleMarkReconciledUntil(n) {
    await markReconciledUntil(n);
  }

  if (scheduleLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 font-body-sm">
        <span className="material-symbols-outlined animate-spin mr-2 text-emerald-600">progress_activity</span>
        Cargando calendario...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── BANNER DE CONCILIACIÓN CON ESTADO DE CUENTA BANCARIO ─────────────── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-slate-500/10 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Conciliación Bancaria de Préstamo (4 Islas)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                Conciliado hasta {latestReconciled?.mesLabel || 'agosto 2026'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
              Las filas en <strong className="text-slate-900 dark:text-white font-bold">negrita</strong> corresponden a cuotas verificadas contra tu estado de cuenta. Puedes editar <strong>Capital</strong> e <strong>Interés</strong> directamente en cada cuota para recalcular el saldo en cascada y monitorear la <strong>Tasa Real</strong> vs <strong>Tasa Teórica (3.50%)</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0 bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-emerald-500/20 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 block">Saldo Conciliado</span>
            <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
              {fmt.format(latestReconciled?.balance || 53712.33)}
            </span>
          </div>
          <div className="border-l border-slate-200 dark:border-zinc-800 pl-3">
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 block">Tasa Real Corte</span>
            <span className="font-bold font-mono text-slate-800 dark:text-zinc-200 text-sm tabular-nums">
              {latestReconciledRate.toFixed(2)}%
            </span>
          </div>
          <div className="border-l border-slate-200 dark:border-zinc-800 pl-3">
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 block">Cuotas Verificadas</span>
            <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm tabular-nums">
              {reconciledCount} / {schedule.length}
            </span>
          </div>
        </div>
      </div>

      {/* Top summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Cuotas Mostradas</p>
          <p className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
            {filtered.length} <span className="text-xs text-slate-400 font-normal">de {schedule.length}</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Capital Amortizado</p>
          <p className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
            {fmtCompact.format(summaryTotals.principal)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Abonos Extraordinarios</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {fmtCompact.format(summaryTotals.extra)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Intereses Pagados</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {fmtCompact.format(summaryTotals.interest)}
          </p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar mes o nota..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              handleFilterChange();
            }}
            className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los años</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Año {yr}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              handleFilterChange();
            }}
            className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todas las cuotas</option>
            <option value="RECONCILED">✓ Solo conciliadas con estado de cuenta ({reconciledCount})</option>
            <option value="PENDING">Solo proyectadas / pendientes</option>
            <option value="PAID">Solo cuotas pagadas (fecha)</option>
            <option value="FUTURE">Solo cuotas futuras</option>
            <option value="EXTRA">Solo con abono extra</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            type="button"
            onClick={() => exportScheduleToCsv(filtered, '4islas')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors bg-white dark:bg-zinc-900 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            Importar CSV
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800">
            <tr>
              <Th>#</Th>
              <Th>Mes / Fecha</Th>
              <Th>Estado</Th>
              <Th className="text-right">Cuota Total</Th>
              <Th className="text-right">Capital</Th>
              <Th className="text-right">Abono Extra</Th>
              <Th className="text-right">Interés</Th>
              <Th className="text-right">Tasa Teórica</Th>
              <Th className="text-right">Tasa Real</Th>
              <Th className="text-right">Saldo Real</Th>
              <Th className="text-right">Saldo Teórico</Th>
              <Th className="text-right">Ahorro Capital</Th>
              <Th>Nota</Th>
              <Th className="text-center">Acciones</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {pageRows.map((row) => {
              const isCurrent = row.n === currentN;
              const hasExtra = row.extra > 0;
              const diff = (row.theoreticalBalance || row.balance) - row.balance;
              const reconciled = isRowReconciled(row);

              // Saldo previo para cálculo de tasa real
              const rowIndex = schedule.findIndex((r) => r.n === row.n);
              const prevBalance = rowIndex === 0 ? initialLoanAmount : (schedule[rowIndex - 1]?.balance || initialLoanAmount);

              // Cálculo de tasas
              const theorRate = row.theoreticalRate ?? (row.n <= 21 ? 3.40 : 3.50);
              const realRate = prevBalance > 0 && row.interest > 0 ? (row.interest / prevBalance) * 12 * 100 : 0;
              const rateDiff = realRate - theorRate;

              const isEditingThisRow = editingRowN === row.n;

              // En edición inline en vivo
              const liveEditBalance = isEditingThisRow
                ? Math.max(0, Number((prevBalance - Number(editForm.principal || 0) - Number(editForm.extra || 0)).toFixed(2)))
                : row.balance;
              const liveEditRealRate = isEditingThisRow && prevBalance > 0 && Number(editForm.interest || 0) > 0
                ? (Number(editForm.interest) / prevBalance) * 12 * 100
                : realRate;

              return (
                <tr
                  key={row.n}
                  className={`transition-colors ${
                    isEditingThisRow
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                      : reconciled
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-l-4 border-l-emerald-500'
                      : 'hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 border-l-4 border-l-transparent'
                  } ${isCurrent ? 'ring-1 ring-emerald-500/50' : ''}`}
                >
                  {/* Cuota # */}
                  <Td className="font-mono text-slate-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" title="Mes en curso" />
                      )}
                      <span className={reconciled ? 'font-bold text-slate-900 dark:text-zinc-100' : ''}>
                        {row.n}
                      </span>
                    </div>
                  </Td>

                  {/* Mes */}
                  <Td className={`capitalize ${reconciled ? 'font-bold text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300'}`}>
                    {row.mesLabel}
                  </Td>

                  {/* Estado Conciliado */}
                  <Td>
                    {reconciled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                        <span className="material-symbols-outlined text-[12px]">verified</span>
                        Conciliado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                        Proyectado
                      </span>
                    )}
                  </Td>

                  {/* Cuota Total */}
                  <Td className={`text-right tabular-nums ${reconciled ? 'font-bold text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300'}`}>
                    {fmt.format(row.total || 0)}
                  </Td>

                  {/* Capital (editable inline o texto resaltado) */}
                  <Td className="text-right tabular-nums">
                    {isEditingThisRow ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.principal}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, principal: e.target.value }))}
                        className="w-24 px-2 py-1 text-right text-xs font-mono font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="0.00"
                        autoFocus
                      />
                    ) : (
                      <span className={reconciled ? 'font-bold text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300'}>
                        {fmt.format(row.principal || 0)}
                      </span>
                    )}
                  </Td>

                  {/* Abono Extra */}
                  <Td className="text-right tabular-nums">
                    {isEditingThisRow ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.extra}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, extra: e.target.value }))}
                        className="w-20 px-2 py-1 text-right text-xs font-mono font-bold text-emerald-600 bg-white dark:bg-zinc-900 border border-emerald-500 rounded-lg outline-none"
                        placeholder="0.00"
                      />
                    ) : hasExtra ? (
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
                        {fmt.format(row.extra)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600">—</span>
                    )}
                  </Td>

                  {/* Interés (editable inline) */}
                  <Td className="text-right tabular-nums font-mono">
                    {isEditingThisRow ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.interest}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, interest: e.target.value }))}
                        className="w-24 px-2 py-1 text-right text-xs font-mono font-bold text-amber-600 bg-white dark:bg-zinc-900 border border-amber-500 rounded-lg outline-none"
                        placeholder="0.00"
                      />
                    ) : (
                      <span className={`text-amber-600 dark:text-amber-400 ${reconciled ? 'font-bold' : 'font-medium'}`}>
                        {fmt.format(row.interest || 0)}
                      </span>
                    )}
                  </Td>

                  {/* Tasa Teórica */}
                  <Td className="text-right font-mono text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                    {theorRate.toFixed(2)}%
                  </Td>

                  {/* Tasa Real Anualizada */}
                  <Td className="text-right font-mono text-xs tabular-nums">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        reconciled ? 'font-bold' : 'font-medium'
                      } ${
                        liveEditRealRate <= theorRate
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                      title={`Tasa Real: ${liveEditRealRate.toFixed(2)}% vs Teórica: ${theorRate.toFixed(2)}% (Dif: ${(liveEditRealRate - theorRate).toFixed(2)}%)`}
                    >
                      {liveEditRealRate.toFixed(2)}%
                    </span>
                  </Td>

                  {/* Saldo Real */}
                  <Td className="text-right font-mono tabular-nums">
                    <span
                      className={`${
                        isEditingThisRow
                          ? 'text-amber-600 dark:text-amber-400 font-bold'
                          : reconciled
                          ? 'font-bold text-slate-900 dark:text-zinc-100'
                          : 'text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {fmt.format(liveEditBalance)}
                    </span>
                  </Td>

                  {/* Saldo Teórico */}
                  <Td className="text-right text-slate-400 dark:text-zinc-500 text-[11px] font-mono tabular-nums">
                    {fmt.format(row.theoreticalBalance ?? row.balance)}
                  </Td>

                  {/* Ahorro de Capital */}
                  <Td className="text-right font-mono text-xs tabular-nums">
                    {diff > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        +{fmtCompact.format(diff)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600">—</span>
                    )}
                  </Td>

                  {/* Nota */}
                  <Td className="max-w-[160px] truncate text-slate-500 dark:text-zinc-400 text-[11px]" title={row.note}>
                    {isEditingThisRow ? (
                      <input
                        type="text"
                        value={editForm.note}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none"
                        placeholder="Nota..."
                      />
                    ) : (
                      row.note || <span className="text-slate-300 dark:text-zinc-600 italic">—</span>
                    )}
                  </Td>

                  {/* Acciones */}
                  <Td className="text-center">
                    {isEditingThisRow ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveInlineEdit(row)}
                          disabled={isSavingInline}
                          title="Guardar y recalcular en cascada"
                          className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelInlineEdit}
                          title="Cancelar"
                          className="p-1 rounded-lg bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => startInlineEdit(row)}
                          title="Edición rápida en fila (Capital, Interés)"
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[17px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenConciliacion(row)}
                          title="Conciliación detallada (Gastos, Tasas, Saldo)"
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[17px]">edit_note</span>
                        </button>
                        {!reconciled && (
                          <button
                            type="button"
                            onClick={() => handleMarkReconciledUntil(row.n)}
                            title="Marcar conciliado hasta este mes"
                            className="p-1 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[17px]">verified</span>
                          </button>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span>Filas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
              setPageSize(val);
              setPage(1);
            }}
            className="px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-700 dark:text-zinc-300"
          >
            <option value={12}>12 cuotas (1 año)</option>
            <option value={24}>24 cuotas (2 años)</option>
            <option value={48}>48 cuotas (4 años)</option>
            <option value="ALL">Todas</option>
          </select>
        </div>

        {pageSize !== 'ALL' && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              Anterior
            </button>
            <span className="px-3 text-xs text-slate-600 dark:text-zinc-400 font-semibold">
              {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal de Importación Global */}
      <ImportAmortizacionModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Modal de Conciliación de Cuota Específica */}
      {conciliacionTarget && (
        <ConciliacionModal
          isOpen={true}
          onClose={() => setConciliacionTarget(null)}
          cuota={conciliacionTarget.cuota}
          prevBalance={conciliacionTarget.prevBalance}
        />
      )}
    </div>
  );
}
