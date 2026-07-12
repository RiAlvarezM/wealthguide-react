import { useState, useMemo, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';
import { useVehicles, estimateCurrentValue, estimateMonthlyDepreciation } from '../context/VehiclesContext';
import { useNetworthHistory } from '../context/NetworthHistoryContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatDate = (date) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const CATEGORY_META = {
  liquidez:    { label: '1. Liquidez',           dotColor: '#006a61', bullet: 'secondary', isLiability: false },
  inversiones: { label: '2. Inversiones',         dotColor: '#131b2e', bullet: 'primary',   isLiability: false },
  jubilacion:  { label: '3. Jubilación',          dotColor: '#3980f4', bullet: 'tertiary',  isLiability: false },
  consumo:     { label: '4. Deudas de Consumo',   dotColor: '#ba1a1a', bullet: 'error',     isLiability: true  },
  prestamos:   { label: '5. Préstamos',           dotColor: '#ffdad6', bullet: 'error',     isLiability: true  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function PatrimonioNeto() {
  const { accounts: allAccounts, updateAccount } = useAccounts();
  const { properties } = useProperties();
  const { vehicles } = useVehicles();
  const { saveToday } = useNetworthHistory();

  // Accounts turned off ("Incluir" = False in Configuración → Cuentas) are excluded here.
  const accounts = useMemo(() => allAccounts.filter((acc) => acc.active !== false), [allAccounts]);

  // ── local edits are kept in a map: { [id]: newAmount } ──────────────────
  const [edits, setEdits] = useState({});      // pending (unsaved) edits
  const [saved, setSaved] = useState({});      // last-saved snapshot of edits
  const [checkedFields, setCheckedFields] = useState({}); // { [id]: true } → field locked/confirmed for today's record
  const [alert, setAlert] = useState(null);

  const [entries, setEntries] = useState([
    { id: 'seed-1', date: '24 Oct, 2023', category: 'Inversiones', type: 'Activo',  adjustment:  4200, newBalance: 450200 },
    { id: 'seed-2', date: '15 Oct, 2023', category: 'Hipoteca Apto 1', type: 'Pasivo', adjustment: 1850, newBalance: 250000 },
    { id: 'seed-3', date: '01 Oct, 2023', category: 'Préstamo Carro 1', type: 'Pasivo', adjustment:  650, newBalance:  20000 },
  ]);

  // ── Effective amounts: start from context value, apply local edits ───────
  const effectiveAmount = (acc) =>
    edits[acc.id] !== undefined ? Number(edits[acc.id]) : acc.amount;

  // ── Totals ────────────────────────────────────────────────────────────────
  // Properties are held at their avalúo value (the appraisal date is treated as the
  // purchase date — no appreciation/depreciation model is applied on top of it).
  const propiedadesTotal = useMemo(
    () => properties.reduce((sum, p) => sum + p.value, 0),
    [properties]
  );

  // Vehicles are held at their estimated current (depreciated) value.
  const vehiculosTotal = useMemo(
    () => vehicles.reduce((sum, v) => sum + estimateCurrentValue(v), 0),
    [vehicles]
  );

  const totals = useMemo(() => {
    const byCategory = {};
    for (const key of Object.keys(CATEGORY_META)) byCategory[key] = 0;
    for (const acc of accounts) {
      if (byCategory[acc.category] !== undefined) {
        byCategory[acc.category] += effectiveAmount(acc);
      }
    }

    const totalActivos  = byCategory.liquidez + byCategory.inversiones + byCategory.jubilacion + propiedadesTotal + vehiculosTotal;
    const totalPasivos  = byCategory.consumo + byCategory.prestamos;
    const patrimonioNeto = totalActivos - totalPasivos;

    const grand = totalActivos + byCategory.consumo + byCategory.prestamos;

    const pct = (val) => grand > 0 ? Math.round((val / grand) * 100) : 0;
    const pctJubilacion  = pct(byCategory.jubilacion);
    const pctInversiones = pct(byCategory.inversiones);
    const pctLiquidez    = pct(byCategory.liquidez);
    const pctPropiedades = pct(propiedadesTotal);
    const pctVehiculos   = pct(vehiculosTotal);
    const pctPrestamos   = pct(byCategory.prestamos);
    const pctConsumo     = Math.max(0, 100 - pctJubilacion - pctInversiones - pctLiquidez - pctPropiedades - pctVehiculos - pctPrestamos);

    return { totalActivos, totalPasivos, patrimonioNeto, byCategory, pctJubilacion, pctInversiones, pctLiquidez, pctPropiedades, pctVehiculos, pctPrestamos, pctConsumo };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, edits, propiedadesTotal, vehiculosTotal]);

  // ── Donut gradient ────────────────────────────────────────────────────────
  const donutGradient = useMemo(() => {
    const { pctJubilacion, pctInversiones, pctLiquidez, pctPropiedades, pctVehiculos, pctPrestamos } = totals;
    const jEnd = pctJubilacion;
    const iEnd = jEnd + pctInversiones;
    const lEnd = iEnd + pctLiquidez;
    const propEnd = lEnd + pctPropiedades;
    const vEnd = propEnd + pctVehiculos;
    const pEnd = vEnd + pctPrestamos;
    return `conic-gradient(#006a61 0% ${jEnd}%, #131b2e ${jEnd}% ${iEnd}%, #c6c6cd ${iEnd}% ${lEnd}%, #f59e0b ${lEnd}% ${propEnd}%, #8b5cf6 ${propEnd}% ${vEnd}%, #ffdad6 ${vEnd}% ${pEnd}%, #ba1a1a ${pEnd}% 100%)`;
  }, [totals]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInputChange = (id, rawValue) => {
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    setEdits((prev) => ({ ...prev, [id]: cleaned }));
  };

  const handleCheckToggle = (id) => {
    setCheckedFields((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const changes = [];
    const today = new Date();
    let changeCount = 0;

    for (const acc of accounts) {
      const editedRaw = edits[acc.id];
      if (editedRaw === undefined) continue;

      const newVal = Number(editedRaw) || 0;
      const oldVal = saved[acc.id] !== undefined ? Number(saved[acc.id]) : acc.amount;
      if (newVal === oldVal) continue;

      const diff = newVal - oldVal;
      changeCount++;
      changes.push({
        id: `entry-${Date.now()}-${acc.id}`,
        date: formatDate(today),
        category: acc.name,
        type: acc.type === 'activo' ? 'Activo' : 'Pasivo',
        adjustment: diff,
        newBalance: newVal,
      });

      // Persist to context
      updateAccount(acc.id, acc.name, newVal);
    }

    if (changeCount === 0) {
      setAlert({ type: 'info', message: 'No se detectaron cambios para guardar.' });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    // Snapshot de hoy en networthHistory (alimenta las gráficas de Resumen).
    try {
      await saveToday({
        ahorro: totals.byCategory.liquidez,
        inversion: totals.byCategory.inversiones,
        jubilacion: totals.byCategory.jubilacion,
        deuda: totals.byCategory.consumo,
        prestamo: totals.byCategory.prestamos,
      });
    } catch (err) {
      setAlert({ type: 'info', message: `Se guardaron las cuentas, pero falló el registro histórico: ${err.message}` });
      setTimeout(() => setAlert(null), 5000);
      return;
    }

    // Mark as saved
    const newSaved = { ...saved };
    for (const acc of accounts) {
      if (edits[acc.id] !== undefined) newSaved[acc.id] = edits[acc.id];
    }
    setSaved(newSaved);
    setEdits({});
    setCheckedFields({});

    setEntries((prev) => [...changes, ...prev]);
    setAlert({ type: 'success', message: `¡Registro guardado! Se registraron ${changeCount} ajuste${changeCount !== 1 ? 's' : ''}.` });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleDiscard = () => {
    setEdits({});
    setCheckedFields({});
    setAlert({ type: 'info', message: 'Se han descartado los cambios no guardados.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleExportCSV = useCallback(() => {
    const headers = ['Fecha', 'Categoría', 'Tipo', 'Ajuste', 'Nuevo Saldo'];
    const rows = entries.map((e) => [
      e.date, e.category, e.type,
      (e.adjustment >= 0 ? '+' : '') + e.adjustment,
      e.newBalance,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patrimonio_neto_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [entries]);

  // ── Grouped accounts by category ──────────────────────────────────────────
  const accountsByCategory = useMemo(() => {
    const grouped = {};
    for (const key of Object.keys(CATEGORY_META)) grouped[key] = [];
    for (const acc of accounts) {
      if (grouped[acc.category]) grouped[acc.category].push(acc);
    }
    return grouped;
  }, [accounts]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Patrimonio Neto" searchPlaceholder="Buscar en patrimonio...">

      {/* Alert banner */}
      {alert && (
        <div className={`flex items-center gap-sm p-sm rounded border font-body-sm text-body-sm transition-all ${
          alert.type === 'success'
            ? 'bg-secondary-container/20 border-secondary text-on-secondary-container'
            : 'bg-surface-container border-outline-variant text-on-surface-variant'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {alert.type === 'success' ? 'check_circle' : 'info'}
          </span>
          {alert.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            Registro de Patrimonio Neto
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            Actualice sus valoraciones de activos y pasivos. Las cuentas se configuran en{' '}
            <a href="/configuracion" className="text-secondary underline hover:text-secondary/80 transition-colors">
              Configuración → Cuentas
            </a>.
          </p>
        </div>
        <div className="flex items-center gap-sm bg-surface-container-lowest p-xs rounded border border-outline-variant shrink-0">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase px-sm">
            Patrimonio Neto Total
          </span>
          <span className="font-headline-md text-headline-md text-secondary font-bold px-sm border-l border-outline-variant">
            {formatCurrency(totals.patrimonioNeto)}
          </span>
        </div>
      </div>

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">

        {/* ── Left column (8) ── */}
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-lg shadow-sm">

            <div className="flex items-center justify-between mb-md border-b border-outline-variant pb-sm">
              <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider flex items-center gap-xs">
                <span className="material-symbols-outlined text-[20px] text-primary-container">edit_document</span>
                Formulario de Actualización de Valor
              </h3>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-sm py-base rounded-full hidden sm:block">
                Última actualización: Hoy
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center gap-sm py-xl text-on-surface-variant text-center">
                <span className="material-symbols-outlined text-[48px] opacity-30">account_balance_wallet</span>
                <p className="font-body-md text-body-md">No hay cuentas configuradas.</p>
                <p className="font-body-sm text-body-sm">
                  Ve a{' '}
                  <a href="/configuracion" className="text-secondary underline">Configuración → Cuentas</a>
                  {' '}para agregar tus cuentas.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-lg">
                {/* Render a section per category */}
                {Object.entries(CATEGORY_META).map(([catKey, catMeta]) => {
                  const catAccounts = accountsByCategory[catKey] || [];
                  if (catAccounts.length === 0) return null;
                  return (
                    <div key={catKey} className={catKey !== 'liquidez' ? 'pt-md border-t border-outline-variant/50' : ''}>
                      <h4 className={`font-body-sm text-body-sm text-on-surface-variant mb-sm flex items-center gap-xs
                        before:content-[''] before:block before:w-2 before:h-2 before:rounded-full
                        ${catMeta.isLiability ? 'before:bg-error' : 'before:bg-secondary'}`}>
                        {catMeta.label}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                        {catAccounts.map((acc) => {
                          const displayVal = edits[acc.id] !== undefined
                            ? edits[acc.id]
                            : acc.amount.toLocaleString('en-US');
                          const isLocked = !!checkedFields[acc.id];
                          return (
                            <div key={acc.id} className="flex flex-col gap-base">
                              <div className="flex items-center justify-between gap-xs">
                                <label className="font-label-md text-label-md text-on-surface">
                                  {acc.name}
                                </label>
                                <label
                                  className="flex items-center gap-xs cursor-pointer select-none"
                                  title="Marcar como actualizado (bloquea el campo hasta guardar el registro)"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isLocked}
                                    onChange={() => handleCheckToggle(acc.id)}
                                    className="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-1 focus:ring-secondary cursor-pointer"
                                  />
                                  <span className="font-label-sm text-label-sm text-on-surface-variant">Actualizado</span>
                                </label>
                              </div>
                              <div className="relative">
                                <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">$</span>
                                <input
                                  className={`w-full h-10 pl-8 pr-sm bg-surface border border-outline-variant focus:border-on-tertiary-container focus:ring-1 focus:ring-on-tertiary-container rounded text-body-sm text-right font-label-md text-label-md outline-none ${catMeta.isLiability ? 'text-error' : ''} ${isLocked ? 'opacity-60 cursor-not-allowed bg-surface-container-low' : ''}`}
                                  type="text"
                                  value={displayVal}
                                  disabled={isLocked}
                                  onChange={(e) => handleInputChange(acc.id, e.target.value)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Summary row */}
                <div className="pt-md border-t border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                  <div className="flex gap-lg font-label-sm text-label-sm text-on-surface-variant">
                    <span>Activos: <strong className="text-secondary">{formatCurrency(totals.totalActivos)}</strong></span>
                    <span>Pasivos: <strong className="text-error">{formatCurrency(totals.totalPasivos)}</strong></span>
                  </div>
                  <div className="flex gap-sm justify-end">
                    <button
                      type="button"
                      onClick={handleDiscard}
                      className="h-10 px-md bg-surface border border-outline-variant text-on-surface rounded font-label-md text-label-md hover:bg-surface-container-low transition-colors outline-none"
                    >
                      Descartar
                    </button>
                    <button
                      type="submit"
                      className="h-10 px-md bg-secondary text-on-secondary rounded font-label-md text-label-md hover:bg-secondary/90 transition-colors outline-none"
                    >
                      Guardar Registro
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Adjustments history table */}
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-lg shadow-sm">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">Ajustes Recientes</h3>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-xs px-sm py-xs bg-surface border border-outline-variant text-on-surface rounded font-label-md text-label-md hover:bg-surface-container-low transition-colors h-8 outline-none"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant">
                    {['Fecha','Categoría','Tipo','Ajuste','Nuevo Saldo'].map((h, i) => (
                      <th key={h} className={`py-sm px-sm font-label-sm text-label-sm text-on-surface-variant uppercase ${i > 2 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-sm px-sm text-on-surface">{entry.date}</td>
                      <td className="py-sm px-sm font-label-md text-label-md text-on-surface">{entry.category}</td>
                      <td className="py-sm px-sm">
                        <span className={`px-xs py-base rounded text-xs font-label-sm ${entry.type === 'Activo' ? 'bg-secondary-container/20 text-on-secondary-container' : 'bg-error-container/20 text-error'}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className={`py-sm px-sm text-right font-label-md font-bold ${entry.adjustment >= 0 ? 'text-secondary' : 'text-error'}`}>
                        {entry.adjustment >= 0 ? '+' : ''}{formatCurrency(entry.adjustment)}
                      </td>
                      <td className={`py-sm px-sm text-right font-label-md text-label-md ${entry.type === 'Pasivo' ? 'text-error' : 'text-on-surface'}`}>
                        {formatCurrency(entry.newBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right column (4) ── */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">

          {/* Portfolio Donut */}
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-lg shadow-sm flex flex-col items-center">
            <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider w-full mb-lg text-left">
              Distribución del Portafolio
            </h3>
            <div
              className="relative w-48 h-48 rounded-full flex items-center justify-center mb-lg shadow-sm transition-all duration-500"
              style={{ background: donutGradient }}
            >
              <div className="absolute w-36 h-36 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center shadow">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Patrimonio</span>
                <span className="font-headline-md text-headline-md text-on-surface font-bold text-center leading-tight">
                  {formatCurrency(totals.patrimonioNeto).replace('US$','$')}
                </span>
              </div>
            </div>
            <div className="w-full space-y-sm">
              {[
                { label: 'Jubilación',         color: '#006a61', pct: totals.pctJubilacion  },
                { label: 'Inversiones',         color: '#131b2e', pct: totals.pctInversiones },
                { label: 'Liquidez',            color: '#c6c6cd', pct: totals.pctLiquidez    },
                { label: 'Propiedades',         color: '#f59e0b', pct: totals.pctPropiedades },
                { label: 'Automóviles',          color: '#8b5cf6', pct: totals.pctVehiculos   },
                { label: 'Préstamos',           color: '#ffdad6', pct: totals.pctPrestamos   },
                { label: 'Deudas de Consumo',  color: '#ba1a1a', pct: totals.pctConsumo     },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-body-sm text-body-sm text-on-surface">{item.label}</span>
                  </div>
                  <span className="font-label-md text-label-md text-on-surface">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-Depreciación */}
          <div className="bg-surface-container-highest rounded-lg border border-outline-variant p-lg shadow-sm glass-panel relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-5">
              <span className="material-symbols-outlined text-[120px]">trending_down</span>
            </div>
            <div className="relative z-10">
              <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">directions_car</span>
                Automóviles
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
                Deducciones estimadas por el sistema para activos físicos.
              </p>
              {vehicles.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                  Sin vehículos registrados.
                </p>
              ) : (
                vehicles.map((vehicle) => {
                  const currentValue = estimateCurrentValue(vehicle);
                  const monthly = estimateMonthlyDepreciation(vehicle);
                  return (
                    <div key={vehicle.id} className="bg-surface-container-lowest p-sm rounded border border-outline-variant/50 flex justify-between items-center mb-sm last:mb-0">
                      <div>
                        <div className="font-label-md text-label-md text-on-surface">{vehicle.name}</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant mt-base">15% Est. Anual</div>
                      </div>
                      <div className="text-right">
                        <div className="font-label-md text-label-md text-on-surface">{formatCurrency(currentValue)}</div>
                        <div className="font-label-sm text-label-sm text-error mt-base flex items-center justify-end gap-base">
                          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                          {formatCurrency(monthly)}/mo
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Propiedades */}
          <div className="bg-surface-container-highest rounded-lg border border-outline-variant p-lg shadow-sm glass-panel relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-5">
              <span className="material-symbols-outlined text-[120px]">home_work</span>
            </div>
            <div className="relative z-10">
              <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">home_work</span>
                Propiedades
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
                Valores de avalúo registrados en Configuración → Propiedades.
              </p>
              {properties.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                  Sin propiedades registradas.
                </p>
              ) : (
                properties.map((prop) => (
                  <div key={prop.id} className="bg-surface-container-lowest p-sm rounded border border-outline-variant/50 flex justify-between items-center mb-sm last:mb-0">
                    <div>
                      <div className="font-label-md text-label-md text-on-surface">{prop.name}</div>
                      <div className="font-label-sm text-label-sm text-on-surface-variant mt-base">
                        Adquirida: {prop.appraisalDate}
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface">
                      {formatCurrency(prop.value)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
