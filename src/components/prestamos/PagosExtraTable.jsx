// src/components/prestamos/PagosExtraTable.jsx
//
// Tabla CRUD de abonos extraordinarios a capital del préstamo "4 Islas".
// Permite al usuario agregar, editar y eliminar pagos extra.
// Los cambios se sincronizan en tiempo real vía Firestore.

import { useState } from 'react';
import { useAmortizacion } from '../../context/AmortizacionContext';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const EMPTY_FORM = { date: '', amount: '', note: '' };

function FormModal({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.date && form.amount && Number(form.amount) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl border border-outline-variant shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 animate-[fadeIn_0.15s_ease]">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {initial?.id ? 'Editar Pago Extra' : 'Agregar Pago Extra'}
          </h3>
          <button
            onClick={onCancel}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Fecha del pago</span>
            <input
              type="date"
              value={form.date}
              onChange={set('date')}
              className="px-3 py-2 border border-outline-variant rounded bg-surface-container-low font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Monto (USD)</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-label-sm text-on-surface-variant">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={set('amount')}
                className="w-full pl-7 pr-3 py-2 border border-outline-variant rounded bg-surface-container-low font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Nota (opcional)</span>
            <input
              type="text"
              placeholder="Ej: Bono anual, ahorro mes..."
              value={form.note}
              onChange={set('note')}
              className="px-3 py-2 border border-outline-variant rounded bg-surface-container-low font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
            />
          </label>
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-outline-variant font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="px-4 py-2 rounded bg-secondary text-on-secondary font-label-sm text-label-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
            {initial?.id ? 'Guardar cambios' : 'Agregar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PagosExtraTable() {
  const { extraPayments, extraLoading, addExtraPayment, updateExtraPayment, deleteExtraPayment } =
    useAmortizacion();

  const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', data?: object }
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const totalExtra = extraPayments.reduce((s, p) => s + p.amount, 0);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (modal?.data?.id) {
        await updateExtraPayment(modal.data.id, form);
      } else {
        await addExtraPayment(form);
      }
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteExtraPayment(id);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Total registrado:{' '}
            <span className="font-semibold text-secondary">{fmt.format(totalExtra)}</span>
            {' '}en {extraPayments.length} pago{extraPayments.length !== 1 ? 's' : ''} extra
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-sm text-label-sm hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Agregar pago
        </button>
      </div>

      {/* Table or empty state */}
      {extraLoading ? (
        <div className="flex items-center justify-center h-32 text-on-surface-variant font-body-sm">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Cargando...
        </div>
      ) : extraPayments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-outline-variant rounded-lg text-on-surface-variant gap-3">
          <span className="material-symbols-outlined text-4xl text-outline">payments</span>
          <p className="font-body-sm text-body-sm">Aún no hay pagos extra registrados en la app.</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant/70">
            Los abonos históricos vienen del CSV. Aquí puedes agregar nuevos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-outline-variant">
          <table className="w-full min-w-[480px] border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-3 py-2.5 text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Fecha</th>
                <th className="px-3 py-2.5 text-right font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Monto</th>
                <th className="px-3 py-2.5 text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Nota</th>
                <th className="px-3 py-2.5 text-center font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {extraPayments.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`border-b border-outline-variant/40 transition-colors hover:bg-surface-container-low ${idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest'}`}
                >
                  <td className="px-3 py-2.5 font-label-md text-label-md text-on-surface">
                    {new Date(p.date + 'T12:00:00').toLocaleDateString('es-PA', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2.5 font-label-md text-label-md text-right font-semibold text-secondary">
                    {fmt.format(p.amount)}
                  </td>
                  <td className="px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant max-w-[200px] truncate">
                    {p.note || <span className="italic opacity-40">Sin nota</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setModal({ mode: 'edit', data: p })}
                        className="p-1.5 rounded text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="p-1.5 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                        title="Eliminar"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${deleting === p.id ? 'animate-spin' : ''}`}>
                          {deleting === p.id ? 'progress_activity' : 'delete'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <FormModal
          initial={modal.data ? { ...modal.data, date: modal.data.date } : EMPTY_FORM}
          onSave={handleSave}
          onCancel={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
