import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const CATEGORY_META = {
  prestamos: { label: 'Préstamo / Hipoteca', icon: 'home' },
};

export default function Prestamos() {
  const { accounts } = useAccounts();
  const { properties } = useProperties();
  const [selectedId, setSelectedId] = useState(null);

  const liabilities = useMemo(
    () => accounts
      .filter((acc) => acc.category === 'prestamos' && acc.active !== false)
      .sort((a, b) => b.amount - a.amount),
    [accounts]
  );

  const totalDebt = liabilities.reduce((sum, acc) => sum + acc.amount, 0);

  const findLinkedProperty = (accountName) =>
    properties.find((p) => p.name.trim().toLowerCase() === accountName.trim().toLowerCase());

  const selected = liabilities.find((acc) => acc.id === selectedId) || liabilities[0] || null;
  const selectedProperty = selected ? findLinkedProperty(selected.name) : null;

  return (
    <AppLayout title="Préstamos" searchPlaceholder="Buscar instalaciones...">
      <header className="mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Gestión de Préstamos</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Préstamos activos, sincronizados con Configuración → Cuentas.
        </p>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-lg">
        <div className="bg-white border border-outline-variant rounded p-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-fixed/20 rounded-bl-full -mr-16 -mt-16 blur-2xl" />
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Deuda Total en Préstamos</p>
          <h3 className="font-headline-lg text-headline-lg text-on-surface">{formatCurrency(totalDebt)}</h3>
        </div>
        <div className="bg-white border border-outline-variant rounded p-sm">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Préstamos Activos</p>
          <h3 className="font-headline-lg text-headline-lg text-on-surface">{liabilities.length}</h3>
        </div>
      </section>

      {/* Active Loans Bento Grid */}
      <h3 className="font-headline-md text-headline-md mb-sm text-on-surface">Préstamos Activos</h3>
      {liabilities.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded p-lg text-center text-on-surface-variant font-body-sm">
          No hay préstamos activos. Agrega cuentas de categoría "Préstamos" en Configuración → Cuentas.
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mb-lg">
          {liabilities.map((acc) => {
            const meta = CATEGORY_META[acc.category];
            const linkedProperty = findLinkedProperty(acc.name);
            const shareOfTotal = totalDebt > 0 ? (acc.amount / totalDebt) * 100 : 0;
            const isSelected = selected?.id === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedId(acc.id)}
                className={`text-left bg-white border rounded flex flex-col cursor-pointer transition-all hover:shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)] relative overflow-hidden ${
                  isSelected ? 'border-secondary shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)]' : 'border-outline-variant'
                }`}
              >
                {isSelected && <div className="absolute inset-y-0 left-0 w-1 bg-secondary" />}
                <div className="p-sm border-b border-outline-variant/50 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-secondary bg-secondary-fixed/30 p-1 rounded">
                        {meta.icon}
                      </span>
                      <span className="font-label-sm text-label-sm uppercase text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                        {meta.label}
                      </span>
                    </div>
                    <h4 className="font-body-lg text-body-lg font-semibold text-on-surface">{acc.name}</h4>
                    {linkedProperty && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Garantizado por: {linkedProperty.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-sm flex-1">
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Saldo Pendiente</p>
                  <p className="font-headline-md text-headline-md text-on-surface">{formatCurrency(acc.amount)}</p>
                  <div className="w-full bg-surface-container-highest h-2 rounded-full mt-2 mb-1">
                    <div className="bg-secondary h-2 rounded-full" style={{ width: `${shareOfTotal}%` }} />
                  </div>
                  <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>{shareOfTotal.toFixed(1)}% de la deuda total</span>
                    {linkedProperty && <span>LTV: {((acc.amount / linkedProperty.value) * 100).toFixed(0)}%</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="bg-white border border-outline-variant rounded p-sm md:p-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-lg border-b border-outline-variant pb-sm">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Detalle: {selected.name}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {CATEGORY_META[selected.category].label}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <div className="bg-surface-bright p-sm rounded border border-outline-variant/50">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Saldo Pendiente</p>
              <p className="font-headline-md text-headline-md text-on-surface">{formatCurrency(selected.amount)}</p>
            </div>
            <div className="bg-surface-bright p-sm rounded border border-outline-variant/50">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">% de la Deuda Total</p>
              <p className="font-headline-md text-headline-md text-on-surface">
                {(totalDebt > 0 ? (selected.amount / totalDebt) * 100 : 0).toFixed(1)}%
              </p>
            </div>
            {selectedProperty ? (
              <div className="bg-surface-bright p-sm rounded border border-outline-variant/50">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Propiedad Vinculada</p>
                <p className="font-body-md text-body-md text-on-surface">{selectedProperty.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Avalúo: {formatCurrency(selectedProperty.value)} ({selectedProperty.appraisalDate})
                </p>
              </div>
            ) : (
              <div className="bg-surface-bright p-sm rounded border border-outline-variant/50">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Propiedad Vinculada</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant italic">Sin propiedad asociada</p>
              </div>
            )}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-md">
            Tasa de interés, pago mensual y calendario de amortización no están disponibles — esta app aún no
            registra esos datos por cuenta. Agrégalos en Configuración → Cuentas si los necesitas aquí.
          </p>
        </div>
      )}
    </AppLayout>
  );
}
