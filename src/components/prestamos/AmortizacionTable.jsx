// src/components/prestamos/AmortizacionTable.jsx
//
// Tabla avanzada del calendario de amortización con capacidad de conciliación mensual:
//   • Edición y conciliación de cuotas individuales (Capital, Intereses, Saldo)
//   • Filtros por año, texto y abonos extraordinarios
//   • Comparativa en cada fila: Saldo Real vs Teórico y Ahorro acumulado
//   • Exportación a CSV y modal de importación

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

export default function AmortizacionTable() {
  const { schedule, scheduleLoading, syncDefaultSchedule } = useAmortizacion();

  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [conciliacionTarget, setConciliacionTarget] = useState(null); // { cuota, prevBalance }
  const [isSyncingDefault, setIsSyncingDefault] = useState(false);

  const today = useMemo(() => new Date(), []);

  const availableYears = useMemo(() => {
    if (!schedule || !schedule.length) return [];
    const set = new Set();
    schedule.forEach((r) => {
      if (r.date) set.add(r.date.substring(0, 4));
    });
    return Array.from(set).sort();
  }, [schedule]);

  const currentN = useMemo(() => {
    if (!schedule.length) return null;
    const paid = schedule.filter((r) => new Date(r.date) <= today && r.balance > 0);
    return paid[paid.length - 1]?.n ?? schedule[0]?.n;
  }, [schedule, today]);

  const filtered = useMemo(() => {
    let rows = schedule;

    if (statusFilter === 'EXTRA') {
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
    const prevBalance = prevIndex >= 0 ? schedule[prevIndex].balance : 108000;
    setConciliacionTarget({ cuota: row, prevBalance });
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
            <option value="PAID">Solo cuotas pagadas</option>
            <option value="FUTURE">Solo cuotas proyectadas</option>
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
        <table className="w-full min-w-[960px] border-collapse">
          <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800">
            <tr>
              <Th>#</Th>
              <Th>Mes / Fecha</Th>
              <Th className="text-right">Cuota Total</Th>
              <Th className="text-right">Capital</Th>
              <Th className="text-right">Abono Extra</Th>
              <Th className="text-right">Interés</Th>
              <Th className="text-right">Saldo Real</Th>
              <Th className="text-right">Saldo Teórico</Th>
              <Th className="text-right">Ahorro Capital</Th>
              <Th>Detalles / Nota</Th>
              <Th className="text-center">Conciliar</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {pageRows.map((row) => {
              const isCurrent = row.n === currentN;
              const hasExtra = row.extra > 0;
              const diff = (row.theoreticalBalance || row.balance) - row.balance;

              return (
                <tr
                  key={row.n}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 ${
                    isCurrent ? 'bg-emerald-50/60 dark:bg-emerald-950/20 font-medium' : ''
                  }`}
                >
                  {/* Cuota # */}
                  <Td className="font-mono text-slate-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      )}
                      <span>{row.n}</span>
                    </div>
                  </Td>

                  {/* Mes */}
                  <Td className="font-semibold text-slate-800 dark:text-zinc-200 capitalize">
                    {row.mesLabel}
                  </Td>

                  {/* Cuota Total */}
                  <Td className="text-right font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                    {fmt.format(row.total || 0)}
                  </Td>

                  {/* Capital */}
                  <Td className="text-right text-slate-700 dark:text-zinc-300 tabular-nums">
                    {fmt.format(row.principal || 0)}
                  </Td>

                  {/* Abono Extra */}
                  <Td className="text-right tabular-nums">
                    {hasExtra ? (
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
                        {fmt.format(row.extra)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600">—</span>
                    )}
                  </Td>

                  {/* Interés */}
                  <Td className="text-right text-amber-600 dark:text-amber-400 tabular-nums font-medium">
                    {fmt.format(row.interest || 0)}
                  </Td>

                  {/* Saldo Real */}
                  <Td className="text-right font-bold font-mono text-slate-900 dark:text-zinc-100 tabular-nums">
                    {fmt.format(row.balance)}
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
                  <Td className="max-w-[180px] truncate text-slate-500 dark:text-zinc-400 text-[11px]" title={row.note}>
                    {row.note || <span className="text-slate-300 dark:text-zinc-600 italic">—</span>}
                  </Td>

                  {/* Botón de Conciliación Rápida */}
                  <Td className="text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenConciliacion(row)}
                      title="Conciliar capital, interés y saldo"
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    </button>
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
