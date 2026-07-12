import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAuthContext } from '../context/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

const CATEGORY_OPTIONS = [
  'Ingresos',
  'Vivienda',
  'Abarrotes',
  'Salud y Bienestar',
  'Transporte',
  'Entretenimiento',
  'Otro',
];

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function EfectivoDiario() {
  const { user } = useAuthContext();
  const { transactions, loading, totals, addTransaction, deleteTransaction } = useTransactions(
    user?.uid
  );

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: '',
    description: '',
    category: CATEGORY_OPTIONS[0],
    account: 'Corriente Principal',
    amount: '',
    type: 'expense', // 'expense' | 'income'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericAmount = Math.abs(parseFloat(form.amount || '0'));
    if (!form.date || !form.description || !numericAmount) return;

    await addTransaction({
      date: form.date,
      description: form.description,
      category: form.category,
      account: form.account,
      type: form.type,
      amount: form.type === 'expense' ? -numericAmount : numericAmount,
    });

    setForm({
      date: '',
      description: '',
      category: CATEGORY_OPTIONS[0],
      account: 'Corriente Principal',
      amount: '',
      type: 'expense',
    });
    setShowForm(false);
  };

  return (
    <AppLayout title="Efectivo Diario" searchPlaceholder="Buscar cuentas, transacciones...">
      <header className="mb-lg">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">
          Flujo Mensual
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
          Análisis de liquidez actual y obligaciones a corto plazo.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Liquid Assets Overview */}
        <section className="lg:col-span-8 flex flex-col gap-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm">
            <div className="flex justify-between items-start mb-md">
              <div>
                <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                  Dinero Disponible Ahora
                </h2>
                <div className="font-display-lg text-display-lg text-on-background mt-xs">
                  {formatCurrency(totals.balance)}
                </div>
              </div>
              <span className="material-symbols-outlined text-secondary text-[32px]">
                account_balance
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm shadow-sm">
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-xs">
                Ingresos Totales
              </div>
              <div className="font-headline-md text-headline-md">{formatCurrency(totals.income)}</div>
              <div className="text-body-sm text-secondary mt-base">Este período</div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm shadow-sm">
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-xs">
                Gastos Totales
              </div>
              <div className="font-headline-md text-headline-md">{formatCurrency(totals.expense)}</div>
              <div className="text-body-sm text-error mt-base">Este período</div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm shadow-sm">
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-xs">
                Balance Neto
              </div>
              <div className="font-headline-md text-headline-md">{formatCurrency(totals.balance)}</div>
              <div className="text-body-sm text-on-surface-variant mt-base">Ingresos - Gastos</div>
            </div>
          </div>
        </section>

        {/* Add transaction card */}
        <aside className="lg:col-span-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-sm">
              <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                Nueva Transacción
              </h2>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="text-secondary hover:text-on-secondary-container transition-colors"
              >
                <span className="material-symbols-outlined">{showForm ? 'close' : 'add_circle'}</span>
              </button>
            </div>

            {showForm ? (
              <form className="flex flex-col gap-sm" onSubmit={handleSubmit}>
                <div className="flex gap-sm">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: 'expense' }))}
                    className={`flex-1 py-1.5 rounded text-label-sm font-label-sm border ${
                      form.type === 'expense'
                        ? 'bg-error-container border-error text-on-error-container'
                        : 'border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: 'income' }))}
                    className={`flex-1 py-1.5 rounded text-label-sm font-label-sm border ${
                      form.type === 'income'
                        ? 'bg-secondary-container border-secondary text-on-secondary-container'
                        : 'border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    Ingreso
                  </button>
                </div>

                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                  className="border border-outline-variant rounded px-sm py-2 text-body-sm"
                />
                <input
                  type="text"
                  name="description"
                  placeholder="Descripción"
                  value={form.description}
                  onChange={handleChange}
                  required
                  className="border border-outline-variant rounded px-sm py-2 text-body-sm"
                />
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="border border-outline-variant rounded px-sm py-2 text-body-sm"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="account"
                  placeholder="Cuenta"
                  value={form.account}
                  onChange={handleChange}
                  className="border border-outline-variant rounded px-sm py-2 text-body-sm"
                />
                <input
                  type="number"
                  name="amount"
                  placeholder="Monto"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={handleChange}
                  required
                  className="border border-outline-variant rounded px-sm py-2 text-body-sm"
                />
                <button
                  type="submit"
                  className="mt-xs w-full bg-secondary text-white font-label-md py-2 rounded hover:bg-secondary/90 transition-colors"
                >
                  Guardar
                </button>
              </form>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Registra un gasto o ingreso para verlo reflejado en tu flujo mensual.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Transactions Table */}
      <section className="mt-xl">
        <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
          Transacciones Recientes
        </h2>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-bright border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase">
                  <th className="p-sm font-medium">Fecha</th>
                  <th className="p-sm font-medium">Descripción</th>
                  <th className="p-sm font-medium">Categoría</th>
                  <th className="p-sm font-medium">Cuenta</th>
                  <th className="p-sm font-medium text-right">Monto</th>
                  <th className="p-sm font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm divide-y divide-outline-variant/50">
                {loading && (
                  <tr>
                    <td className="p-sm text-on-surface-variant" colSpan={6}>
                      Cargando transacciones...
                    </td>
                  </tr>
                )}
                {!loading && transactions.length === 0 && (
                  <tr>
                    <td className="p-sm text-on-surface-variant" colSpan={6}>
                      Aún no hay transacciones registradas.
                    </td>
                  </tr>
                )}
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low transition-colors group">
                    <td className="p-sm text-on-surface-variant">{t.date}</td>
                    <td className="p-sm font-medium text-on-background group-hover:text-tertiary-container transition-colors">
                      {t.description}
                    </td>
                    <td className="p-sm">
                      <span className="bg-surface-container border border-outline-variant/50 px-2 py-1 rounded text-xs">
                        {t.category}
                      </span>
                    </td>
                    <td className="p-sm text-on-surface-variant">{t.account}</td>
                    <td
                      className={`p-sm text-right font-medium ${
                        t.amount >= 0 ? 'text-secondary' : 'text-on-background'
                      }`}
                    >
                      {t.amount >= 0 ? '+' : ''}
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="p-sm text-right">
                      <button
                        type="button"
                        onClick={() => deleteTransaction(t.id)}
                        className="text-outline hover:text-error transition-colors"
                        aria-label={`Eliminar transacción ${t.description}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
