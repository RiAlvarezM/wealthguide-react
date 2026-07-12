import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useLoyalty, LOYALTY_GROUPS } from '../context/LoyaltyContext';

const GROUP_ICONS = {
  Tarjetas: 'credit_card',
  Millas: 'flight',
  Hoteles: 'hotel',
  Otros: 'loyalty',
};

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function Lealtad() {
  const { programs, updateProgram } = useLoyalty();
  const [editingId, setEditingId] = useState(null);
  const [editBalance, setEditBalance] = useState('');

  const startEditBalance = (program) => {
    setEditingId(program.id);
    setEditBalance(String(program.balance ?? 0));
  };

  const saveBalance = (program) => {
    updateProgram(program.id, program.name, program.equivalenceUSD, program.group, editBalance);
    setEditingId(null);
  };

  const totalValue = useMemo(
    () => programs.reduce((sum, p) => sum + (p.balance ?? 0) * p.equivalenceUSD, 0),
    [programs]
  );

  const groupSummaries = useMemo(() => {
    return LOYALTY_GROUPS
      .map((group) => {
        const groupPrograms = programs.filter((p) => p.group === group);
        const balance = groupPrograms.reduce((sum, p) => sum + (p.balance ?? 0), 0);
        const value = groupPrograms.reduce((sum, p) => sum + (p.balance ?? 0) * p.equivalenceUSD, 0);
        const avgRate = balance > 0 ? value / balance : 0;
        return { group, programs: groupPrograms, balance, value, avgRate };
      })
      .filter((summary) => summary.programs.length > 0);
  }, [programs]);

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => (b.balance ?? 0) * b.equivalenceUSD - (a.balance ?? 0) * a.equivalenceUSD),
    [programs]
  );

  return (
    <AppLayout title="Lealtad" searchPlaceholder="Buscar programas...">
      <div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-sm">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Puntos y Millas</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Valor estimado total de todos los programas de lealtad conectados.
          </p>
        </div>
        <div className="text-right">
          <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">Valor Estimado</div>
          <div className="font-display-lg text-display-lg text-primary mt-1">{formatCurrency(totalValue)}</div>
        </div>
      </div>

      {/* Group Summary Cards */}
      {groupSummaries.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center text-on-surface-variant font-body-sm mb-gutter">
          No hay programas de lealtad registrados. Agrégalos en Configuración → Programas de Lealtad.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-gutter">
          {groupSummaries.map((summary) => (
            <div
              key={summary.group}
              className="md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-[0_10px_15px_-3px_rgba(15,23,42,0.02)] flex flex-col justify-between min-h-[180px]"
            >
              <div>
                <div className="font-label-sm text-label-sm text-on-surface-variant uppercase flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm">{GROUP_ICONS[summary.group] || 'loyalty'}</span>
                  {summary.group}
                </div>
                <div className="font-headline-lg text-headline-lg text-on-surface mt-sm">
                  {summary.balance.toLocaleString('en-US')} <span className="font-body-md text-body-md text-on-surface-variant">pts</span>
                </div>
              </div>
              <div className="mt-md">
                <div className="h-2 bg-surface-container rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-secondary rounded-full"
                    style={{ width: `${totalValue > 0 ? Math.min(100, (summary.value / totalValue) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mt-xs">
                  <span>{formatCurrency(summary.value)} valor</span>
                  <span>Prom. {summary.avgRate.toFixed(2)}¢/pt</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Program Balances Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_10px_15px_-3px_rgba(15,23,42,0.02)] overflow-hidden">
        <div className="p-sm md:p-md border-b border-outline-variant flex justify-between items-center bg-surface">
          <h3 className="font-label-md text-label-md text-on-surface">Balance de Programas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase">
                <th className="p-sm font-medium">Programa</th>
                <th className="p-sm font-medium">Grupo</th>
                <th className="p-sm font-medium text-right">Balance</th>
                <th className="p-sm font-medium text-right">Equivalencia</th>
                <th className="p-sm font-medium text-right">Valor Estimado</th>
                <th className="p-sm font-medium text-right w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant">
              {sortedPrograms.map((program) => {
                const isEditing = editingId === program.id;
                return (
                  <tr key={program.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-sm">
                      <div className="flex items-center gap-sm">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: program.color }}
                        >
                          {program.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="font-medium">{program.name}</div>
                      </div>
                    </td>
                    <td className="p-sm text-on-surface-variant">{program.group}</td>
                    <td className="p-sm text-right">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="1"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveBalance(program)}
                          className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm text-right font-label-md w-28 outline-none"
                        />
                      ) : (
                        <span className="font-label-md">{(program.balance ?? 0).toLocaleString('en-US')}</span>
                      )}
                    </td>
                    <td className="p-sm text-right text-on-surface-variant">${program.equivalenceUSD.toFixed(3)}</td>
                    <td className="p-sm text-right font-label-md text-secondary">
                      {formatCurrency((program.balance ?? 0) * program.equivalenceUSD)}
                    </td>
                    <td className="p-sm text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-xs">
                          <button
                            type="button"
                            onClick={() => saveBalance(program)}
                            title="Guardar"
                            className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-secondary-container/30 text-on-surface-variant hover:text-secondary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            title="Cancelar"
                            className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditBalance(program)}
                          title="Editar balance"
                          className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface-variant hover:text-secondary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
