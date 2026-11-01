// src/pages/Prestamos.jsx
//
// Gestión de Préstamos e Hipotecas con calendario de amortización detallado,
// gráficos interactivos, importación de CSV y control de abonos extraordinarios.

import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';
import { useAmortizacion } from '../context/AmortizacionContext';
import LoanKPIs from '../components/prestamos/LoanKPIs';
import LoanChart from '../components/prestamos/LoanChart';
import AmortizacionTable from '../components/prestamos/AmortizacionTable';
import PagosExtraTable from '../components/prestamos/PagosExtraTable';
import ImportAmortizacionModal from '../components/prestamos/ImportAmortizacionModal';

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const CATEGORY_META = {
  prestamos: { label: 'Préstamo / Hipoteca', icon: 'home' },
};

const AMORTIZATION_LOAN_ID = '4islas';
function accountSlug(name = '') {
  return name.toLowerCase().replace(/\s+/g, '');
}

const TABS = [
  { id: 'resumen', label: 'Resumen y Métricas', icon: 'summarize' },
  { id: 'amortizacion', label: 'Tabla de Amortización', icon: 'table_chart' },
  { id: 'pagos_extra', label: 'Abonos Extraordinarios', icon: 'payments' },
];

export default function Prestamos() {
  const { accounts } = useAccounts();
  const { properties } = useProperties();
  const { schedule, loanMetadata } = useAmortizacion();

  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const liabilities = useMemo(
    () =>
      accounts
        .filter((acc) => acc.category === 'prestamos' && acc.active !== false)
        .sort((a, b) => b.amount - a.amount),
    [accounts]
  );

  const totalDebt = liabilities.reduce((sum, acc) => sum + acc.amount, 0);

  const findLinkedProperty = (accountName) =>
    properties.find((p) => p.name.trim().toLowerCase() === accountName.trim().toLowerCase());

  const selected = liabilities.find((acc) => acc.id === selectedId) || liabilities[0] || null;
  const selectedProperty = selected ? findLinkedProperty(selected.name) : null;

  // El préstamo seleccionado tiene calendario si su slug coincide con 4islas o si tiene schedule cargado
  const hasAmortizacion =
    selected && (accountSlug(selected.name) === AMORTIZATION_LOAN_ID || schedule.length > 0);

  function handleSelectLoan(id) {
    setSelectedId(id);
    setActiveTab('resumen');
  }

  return (
    <AppLayout title="Préstamos" searchPlaceholder="Buscar préstamos...">
      {/* Header */}
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Gestión de Préstamos</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Seguimiento de hipotecas, amortización de capital y abonos extraordinarios.
          </p>
        </div>
        {hasAmortizacion && (
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg font-label-sm text-label-sm shadow-sm hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Importar Amortización CSV
          </button>
        )}
      </header>

      {/* KPI Global Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-outline-variant rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-fixed/20 rounded-bl-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Deuda Total en Préstamos</p>
          <h3 className="font-headline-lg text-headline-lg font-bold text-on-surface">{formatCurrency(totalDebt)}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Total de pasivos hipotecarios y préstamos</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Préstamos Activos</p>
          <h3 className="font-headline-lg text-headline-lg font-bold text-on-surface">{liabilities.length}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Cuentas vinculadas</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Cuotas Registradas</p>
          <h3 className="font-headline-lg text-headline-lg font-bold text-secondary">
            {schedule.length > 0 ? `${schedule.length} cuotas` : 'Sin calendario'}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {schedule.length > 0 ? 'Abril 2016 – Marzo 2036 (4 Islas)' : 'Pendiente de importación'}
          </p>
        </div>
      </section>

      {/* Active Loans Cards */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">Préstamos Registrados</h3>
      </div>

      {liabilities.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-xl p-8 text-center text-on-surface-variant font-body-sm shadow-sm mb-6">
          No hay préstamos activos. Agrega cuentas de categoría "Préstamos" en Configuración → Cuentas.
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {liabilities.map((acc) => {
            const meta = CATEGORY_META[acc.category];
            const linkedProperty = findLinkedProperty(acc.name);
            const shareOfTotal = totalDebt > 0 ? (acc.amount / totalDebt) * 100 : 0;
            const isSelected = selected?.id === acc.id;
            const hasAm = accountSlug(acc.name) === AMORTIZATION_LOAN_ID || schedule.length > 0;

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleSelectLoan(acc.id)}
                className={`text-left bg-white border rounded-xl flex flex-col cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${
                  isSelected
                    ? 'border-secondary ring-1 ring-secondary shadow-md'
                    : 'border-outline-variant'
                }`}
              >
                {isSelected && <div className="absolute inset-y-0 left-0 w-1.5 bg-secondary" />}
                <div className="p-4 border-b border-outline-variant/50 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-secondary bg-secondary-fixed/30 p-1 rounded-md text-[18px]">
                        {meta.icon}
                      </span>
                      <span className="font-label-sm text-label-sm uppercase text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                        {meta.label}
                      </span>
                      {hasAm && (
                        <span className="font-label-sm text-label-sm uppercase text-secondary bg-secondary-fixed/20 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                          <span className="material-symbols-outlined text-[12px]">table_chart</span>
                          Amortización
                        </span>
                      )}
                    </div>
                    <h4 className="font-body-lg text-body-lg font-bold text-on-surface">{acc.name}</h4>
                    {linkedProperty && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Garantizado por: <span className="font-medium">{linkedProperty.name}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Saldo Registrado</p>
                    <p className="font-headline-md text-headline-md font-bold text-on-surface mt-0.5">
                      {formatCurrency(acc.amount)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden mb-1.5">
                      <div className="bg-secondary h-2 rounded-full transition-all" style={{ width: `${shareOfTotal}%` }} />
                    </div>
                    <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                      <span>{shareOfTotal.toFixed(1)}% de la deuda total</span>
                      {linkedProperty && <span>LTV: {((acc.amount / linkedProperty.value) * 100).toFixed(0)}%</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          {/* Panel header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 border-b border-outline-variant bg-surface-container-low/30">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                  Detalle: {selected.name}
                </h3>
                {hasAmortizacion && (
                  <span className="font-label-sm text-label-sm bg-secondary/10 text-secondary px-2.5 py-0.5 rounded-full font-semibold border border-secondary/20">
                    20 Años (240 Cuotas)
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {CATEGORY_META[selected.category].label} • Saldo actual: {formatCurrency(selected.amount)}
              </p>
            </div>
          </div>

          {/* Tabs */}
          {hasAmortizacion && (
            <div className="flex gap-2 px-6 pt-3 border-b border-outline-variant bg-white">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-label-sm text-label-sm transition-all -mb-px border-b-2 font-medium ${
                    activeTab === tab.id
                      ? 'border-secondary text-secondary bg-secondary/5 font-semibold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Panel Body */}
          <div className="p-6">
            {/* ── TAB: RESUMEN ────────────────────────────────────────────── */}
            {(!hasAmortizacion || activeTab === 'resumen') && (
              <div className="flex flex-col gap-6">
                {/* KPIs dinámicos calculados a partir de las 240 cuotas */}
                {hasAmortizacion && <LoanKPIs />}

                {/* Gráfica interactiva de amortización */}
                {hasAmortizacion && <LoanChart />}

                {/* Resumen de cuentas y propiedad vinculada */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-container-low/60 p-4 rounded-xl border border-outline-variant/60">
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Saldo en Cuentas</p>
                    <p className="font-headline-md text-headline-md font-bold text-on-surface mt-1">
                      {formatCurrency(selected.amount)}
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      Sincronizado con balance general
                    </p>
                  </div>

                  <div className="bg-surface-container-low/60 p-4 rounded-xl border border-outline-variant/60">
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">% Deuda Total</p>
                    <p className="font-headline-md text-headline-md font-bold text-on-surface mt-1">
                      {(totalDebt > 0 ? (selected.amount / totalDebt) * 100 : 0).toFixed(1)}%
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      Participación sobre pasivos
                    </p>
                  </div>

                  {selectedProperty ? (
                    <div className="bg-surface-container-low/60 p-4 rounded-xl border border-outline-variant/60">
                      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Garantía / Propiedad</p>
                      <p className="font-body-md text-body-md font-bold text-on-surface mt-1">{selectedProperty.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Avalúo: {formatCurrency(selectedProperty.value)} ({selectedProperty.appraisalDate})
                      </p>
                    </div>
                  ) : (
                    <div className="bg-surface-container-low/60 p-4 rounded-xl border border-outline-variant/60">
                      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Propiedad Vinculada</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant italic mt-1">Sin propiedad asociada</p>
                    </div>
                  )}
                </div>

                {!hasAmortizacion && (
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface-variant font-body-sm">
                    Tasa de interés, pago mensual y calendario de amortización no están configurados para este préstamo.
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: AMORTIZACIÓN ───────────────────────────────────────── */}
            {hasAmortizacion && activeTab === 'amortizacion' && <AmortizacionTable />}

            {/* ── TAB: PAGOS EXTRA ────────────────────────────────────────── */}
            {hasAmortizacion && activeTab === 'pagos_extra' && <PagosExtraTable />}
          </div>
        </div>
      )}

      {/* Modal de importación global */}
      <ImportAmortizacionModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        loanName={selected?.name || '4 Islas'}
        loanId={selected ? accountSlug(selected.name) : '4islas'}
      />
    </AppLayout>
  );
}