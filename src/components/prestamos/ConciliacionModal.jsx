// src/components/prestamos/ConciliacionModal.jsx
//
// Modal interactivo para conciliar y actualizar cuota por cuota:
// Permite al usuario editar o confirmar Capital, Intereses, Abono Extra y Gastos
// para una cuota específica (o agregar la conciliación del mes actual),
// recalculando el Saldo Real y actualizándolo en Firestore y localmente.

import { useState } from 'react';
import { useAmortizacion } from '../../context/AmortizacionContext';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export default function ConciliacionModal({ isOpen, onClose, cuota, prevBalance = 0 }) {
  const { schedule, importSchedule, loanId } = useAmortizacion();

  const [form, setForm] = useState(() => ({
    n: cuota?.n || 1,
    mesLabel: cuota?.mesLabel || '',
    date: cuota?.date || '',
    principal: cuota?.principal || 0,
    interest: cuota?.interest || 0,
    extra: cuota?.extra || 0,
    maintenance: cuota?.maintenance || 0,
    expenses: cuota?.expenses || 0,
    note: cuota?.note || '',
  }));

  const [saving, setSaving] = useState(false);

  if (!isOpen || !cuota) return null;

  // Cálculo en vivo del nuevo balance y cuota total
  const calculatedTotal = Number(form.principal) + Number(form.interest) + Number(form.maintenance) + Number(form.expenses);
  const calculatedBalance = Math.max(0, prevBalance - Number(form.principal) - Number(form.extra));

  const handleChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Clona y actualiza la cuota en el array del schedule completo
      const updatedSchedule = schedule.map((row) => {
        if (row.n === cuota.n) {
          return {
            ...row,
            mesLabel: form.mesLabel,
            date: form.date,
            principal: Number(form.principal),
            interest: Number(form.interest),
            extra: Number(form.extra),
            maintenance: Number(form.maintenance),
            expenses: Number(form.expenses),
            total: calculatedTotal,
            balance: calculatedBalance,
            note: form.note,
          };
        }
        return row;
      });

      // Recalcular saldos posteriores en cascada si se modificó el capital o abono extra
      let runningBalance = calculatedBalance;
      for (let i = cuota.n; i < updatedSchedule.length; i++) {
        runningBalance = Math.max(0, runningBalance - (updatedSchedule[i].principal || 0) - (updatedSchedule[i].extra || 0));
        updatedSchedule[i].balance = runningBalance;
      }

      await importSchedule(loanId, updatedSchedule, {
        name: '4 Islas',
      });

      onClose();
    } catch (err) {
      console.error('Error guardando conciliación:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5 animate-[fadeIn_0.15s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">fact_check</span>
              Conciliación Cuota #{cuota.n} ({cuota.mesLabel})
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Saldo anterior: <strong className="font-mono">{fmt.format(prevBalance)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
                Capital Pagado
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.principal}
                  onChange={(e) => handleChange('principal', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-slate-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
                Intereses Bancarios
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.interest}
                  onChange={(e) => handleChange('interest', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-amber-600 dark:text-amber-400 outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
                Abono Extraordinario
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.extra}
                  onChange={(e) => handleChange('extra', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
                Mantenimiento / Otros
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.maintenance}
                  onChange={(e) => handleChange('maintenance', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-slate-700 dark:text-zinc-300 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
              Nota / Detalle de la conciliación
            </label>
            <input
              type="text"
              placeholder="Ej: Conciliado con estado de cuenta de agosto..."
              value={form.note}
              onChange={(e) => handleChange('note', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Live Calculated Balance Summary */}
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold block">
                Nuevo Saldo Resultante:
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Total pagado este mes: {fmt.format(calculatedTotal + Number(form.extra))}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {fmt.format(calculatedBalance)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Guardar y Recalcular Saldo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
