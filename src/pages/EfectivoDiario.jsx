import { useState, useMemo, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAuthContext } from '../context/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../context/AccountsContext';

const MIN_ROWS = 10;

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// '2026-08-14' -> '14/8/26'
function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${Number(d)}/${Number(m)}/${y.slice(2)}`;
}

// '14/8/26' o '14/08/2026' -> '2026-08-14'
function parseDateDisplay(value) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  let [, d, m, y] = match;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function EditableRow({ row, saldo, onCommit, onDelete }) {
  const [date, setDate] = useState(formatDateDisplay(row?.date));
  const [description, setDescription] = useState(row?.description || '');
  const [ingreso, setIngreso] = useState(row?.amount > 0 ? String(row.amount) : '');
  const [gasto, setGasto] = useState(row?.amount < 0 ? String(Math.abs(row.amount)) : '');

  useEffect(() => {
    setDate(formatDateDisplay(row?.date));
    setDescription(row?.description || '');
    setIngreso(row?.amount > 0 ? String(row.amount) : '');
    setGasto(row?.amount < 0 ? String(Math.abs(row.amount)) : '');
  }, [row?.id, row?.date, row?.description, row?.amount]);

  const commit = () => {
    const isoDate = parseDateDisplay(date);
    if (!isoDate || !description) return;
    const amount = ingreso ? Math.abs(parseFloat(ingreso)) : gasto ? -Math.abs(parseFloat(gasto)) : 0;
    if (row && isoDate === row.date && description === row.description && amount === (row.amount || 0)) return;
    onCommit({ date: isoDate, description, amount });
  };

  return (
    <tr className="hover:bg-surface-container-low transition-colors group">
      <td className="p-sm">
        <input
          type="text"
          value={date}
          placeholder="dd/mm/yy"
          onChange={(e) => setDate(e.target.value)}
          onBlur={commit}
          className="bg-transparent w-24 outline-none text-on-surface-variant placeholder:text-outline"
        />
      </td>
      <td className="p-sm">
        <input
          type="text"
          value={description}
          placeholder="Detalle"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          className="bg-transparent w-full outline-none font-medium text-on-background group-hover:text-tertiary-container transition-colors placeholder:text-outline placeholder:font-normal"
        />
      </td>
      <td className="p-sm text-right">
        <input
          type="number"
          step="0.01"
          value={ingreso}
          onChange={(e) => {
            setIngreso(e.target.value);
            if (e.target.value) setGasto('');
          }}
          onBlur={commit}
          className="bg-transparent w-full text-right outline-none text-secondary"
        />
      </td>
      <td className="p-sm text-right">
        <input
          type="number"
          step="0.01"
          value={gasto}
          onChange={(e) => {
            setGasto(e.target.value);
            if (e.target.value) setIngreso('');
          }}
          onBlur={commit}
          className="bg-transparent w-full text-right outline-none text-error"
        />
      </td>
      <td className="p-sm text-right font-bold text-on-background">
        {row ? formatCurrency(saldo) : ''}
      </td>
      <td className="p-sm text-right">
        {row && (
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            className="text-outline hover:text-error transition-colors"
            aria-label={`Eliminar movimiento ${row.description}`}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        )}
      </td>
    </tr>
  );
}

export default function EfectivoDiario() {
  const { user } = useAuthContext();
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(
    user?.uid
  );
  const { accounts } = useAccounts();

  // Saldo inicial del flujo: liquidez actual (cuentas activas categoría "liquidez"),
  // pero editable por si el usuario quiere ajustarlo manualmente para el mes.
  const liquidezTotal = useMemo(
    () =>
      accounts
        .filter((acc) => acc.category === 'liquidez' && acc.active !== false)
        .reduce((sum, acc) => sum + acc.amount, 0),
    [accounts]
  );

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const openingBalanceStorageKey = `efectivoDiario:saldoInicial:${currentMonthKey}`;

  const [openingBalanceOverride, setOpeningBalanceOverride] = useState(() => {
    const stored = localStorage.getItem(openingBalanceStorageKey);
    return stored !== null ? Number(stored) : null;
  });
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(openingBalanceStorageKey);
    setOpeningBalanceOverride(stored !== null ? Number(stored) : null);
  }, [openingBalanceStorageKey]);

  const effectiveOpeningBalance = openingBalanceOverride ?? liquidezTotal;

  const commitOpeningBalance = () => {
    if (openingBalanceInput.trim() === '') {
      localStorage.removeItem(openingBalanceStorageKey);
      setOpeningBalanceOverride(null);
      return;
    }
    const value = parseFloat(openingBalanceInput);
    if (Number.isNaN(value)) return;
    localStorage.setItem(openingBalanceStorageKey, String(value));
    setOpeningBalanceOverride(value);
  };

  const [extraRows, setExtraRows] = useState(0);

  // Movimientos del mes en curso, ordenados cronológicamente, con saldo corrido
  // que arranca en el saldo inicial (editable) del mes.
  const monthRows = useMemo(() => {
    const monthTx = transactions
      .filter((t) => t.date && t.date.startsWith(currentMonthKey))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
      });

    let running = effectiveOpeningBalance;
    return monthTx.map((t) => {
      running += t.amount || 0;
      return { ...t, saldo: running };
    });
  }, [transactions, currentMonthKey, effectiveOpeningBalance]);

  const draftCount = Math.max(0, MIN_ROWS - monthRows.length) + extraRows;

  return (
    <AppLayout title="Efectivo Diario" searchPlaceholder="Buscar movimientos...">
      <header className="mb-lg flex flex-col sm:flex-row sm:items-end sm:justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">
            Flujo Mensual
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            Saldo proyectado del mes en curso. Edita las líneas directamente en la tabla: fecha, detalle,
            ingreso o gasto.
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-xs shrink-0">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            Saldo inicial del mes
          </label>
          <input
            type="number"
            step="0.01"
            value={openingBalanceInput !== '' ? openingBalanceInput : effectiveOpeningBalance}
            onFocus={() => setOpeningBalanceInput(String(effectiveOpeningBalance))}
            onChange={(e) => setOpeningBalanceInput(e.target.value)}
            onBlur={() => {
              commitOpeningBalance();
              setOpeningBalanceInput('');
            }}
            className="h-10 w-40 px-sm border border-outline-variant rounded text-right font-bold text-on-background"
          />
          {openingBalanceOverride !== null && (
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(openingBalanceStorageKey);
                setOpeningBalanceOverride(null);
              }}
              className="font-label-sm text-label-sm text-secondary hover:underline"
            >
              Usar liquidez actual ({formatCurrency(liquidezTotal)})
            </button>
          )}
        </div>
      </header>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-bright border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase">
                <th className="p-sm font-medium">Fecha</th>
                <th className="p-sm font-medium">Detalle</th>
                <th className="p-sm font-medium text-right">Ingreso</th>
                <th className="p-sm font-medium text-right">Gasto</th>
                <th className="p-sm font-medium text-right">Saldo</th>
                <th className="p-sm font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm divide-y divide-outline-variant/50">
              {loading && (
                <tr>
                  <td className="p-sm text-on-surface-variant" colSpan={6}>
                    Cargando movimientos...
                  </td>
                </tr>
              )}
              {!loading &&
                monthRows.map((row) => (
                  <EditableRow
                    key={row.id}
                    row={row}
                    saldo={row.saldo}
                    onCommit={(fields) => updateTransaction(row.id, fields)}
                    onDelete={deleteTransaction}
                  />
                ))}
              {!loading &&
                Array.from({ length: draftCount }).map((_, i) => (
                  <EditableRow
                    key={`draft-${monthRows.length}-${i}`}
                    row={null}
                    onCommit={(fields) => addTransaction(fields)}
                    onDelete={() => {}}
                  />
                ))}
            </tbody>
          </table>
        </div>
        <div className="p-sm border-t border-outline-variant">
          <button
            type="button"
            onClick={() => setExtraRows((n) => n + 5)}
            className="font-label-sm text-label-sm text-secondary hover:underline"
          >
            + Agregar más líneas
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
