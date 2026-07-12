import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAuthContext } from '../context/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

const MONTHS = ['Oct 2023', 'Sep 2023', 'Ago 2023'];
const MONTHLY_BUDGET = 12500;

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function Presupuesto() {
  const { user } = useAuthContext();
  const { totals } = useTransactions(user?.uid);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);

  const spentPercentage = Math.min(100, (totals.expense / MONTHLY_BUDGET) * 100);
  const remaining = MONTHLY_BUDGET - totals.expense;

  return (
    <AppLayout title="Presupuesto" searchPlaceholder="Buscar transacciones, categorías...">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-lg gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Asignación de Presupuesto
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Gestiona límites mensuales y haz seguimiento del gasto planificado vs real.
          </p>
        </div>
        <div className="flex items-center gap-xs bg-surface-container-lowest border border-outline-variant rounded-lg p-1">
          {MONTHS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() => setSelectedMonth(month)}
              className={`px-3 py-1.5 text-label-md font-label-md rounded transition-colors ${
                selectedMonth === month
                  ? 'bg-surface-container-low text-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {month}
            </button>
          ))}
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm lg:p-md shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
              Presupuesto Total
            </h3>
            <div className="font-display-lg text-display-lg text-on-surface">
              {formatCurrency(MONTHLY_BUDGET)}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span className="font-label-md text-label-md">Meta fija mensual</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm lg:p-md shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
              Gasto Real
            </h3>
            <div className="font-display-lg text-display-lg text-on-surface">
              {formatCurrency(totals.expense)}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-on-surface-variant relative z-10">
            <span className="font-label-md text-label-md">{spentPercentage.toFixed(1)}% del presupuesto total</span>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-surface-container w-full">
            <div
              className="h-full bg-tertiary-container transition-all duration-700"
              style={{ width: `${spentPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm lg:p-md shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
              Restante
            </h3>
            <div
              className={`font-display-lg text-display-lg ${remaining >= 0 ? 'text-secondary' : 'text-error'}`}
            >
              {formatCurrency(remaining)}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant">
              {remaining >= 0 ? 'Seguro para gastar' : 'Presupuesto excedido'}
            </span>
            <button
              type="button"
              className="text-on-tertiary-container hover:text-on-tertiary-fixed-variant transition-colors font-label-md text-label-md flex items-center gap-1"
            >
              Ajustar <span className="material-symbols-outlined text-sm">tune</span>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
