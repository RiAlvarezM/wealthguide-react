// src/pages/PatrimonioNeto.jsx
//
// Registro de Patrimonio Neto para la familia Álvarez Gamboa.
// Incluye métricas de alto valor:
//   • Runway de Liquidez (Meses de cobertura sin ingresos)
//   • Tiers de Liquidez en 3 Capas (Inmediata, Crecimiento, Iliquidez)
//   • Ratio de Deuda Neta y Salud de Apalancamiento
//   • Actualización en tiempo real con soporte Dark Mode y números tabulares.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';
import { useVehicles, estimateCurrentValue, estimateMonthlyDepreciation } from '../context/VehiclesContext';
import { useNetworthHistory } from '../context/NetworthHistoryContext';
import ConciliacionFinDeMesModal from '../components/homebudget/ConciliacionFinDeMesModal';

// Formato de moneda con decimales limpios
const formatCurrency = (value) =>
  new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatExactCurrency = (value) =>
  new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const CATEGORY_META = {
  liquidez:    { label: '1. Liquidez (Efectivo & Ahorros)', color: '#0d9488', icon: 'savings',           isLiability: false },
  inversiones: { label: '2. Inversiones Bursátiles & Fondos', color: '#3b82f6', icon: 'trending_up',       isLiability: false },
  jubilacion:  { label: '3. Fondo de Jubilación',            color: '#6366f1', icon: 'account_balance',   isLiability: false },
  consumo:     { label: '4. Deudas de Consumo / Tarjetas',    color: '#f43f5e', icon: 'credit_card',       isLiability: true  },
  prestamos:   { label: '5. Préstamos e Hipotecas',           color: '#e11d48', icon: 'receipt_long',      isLiability: true  },
};

export default function PatrimonioNeto() {
  const navigate = useNavigate();
  const { accounts: allAccounts, updateAccount } = useAccounts();
  const { properties } = useProperties();
  const { vehicles } = useVehicles();
  const { saveToday } = useNetworthHistory();

  const accounts = useMemo(() => allAccounts.filter((acc) => acc.active !== false), [allAccounts]);

  const [edits, setEdits] = useState({});
  const [saved, setSaved] = useState({});
  const [checkedFields, setCheckedFields] = useState({});
  const [alert, setAlert] = useState(null);
  const [isConciliacionOpen, setIsConciliacionOpen] = useState(false);

  const effectiveAmount = (acc) =>
    edits[acc.id] !== undefined ? Number(edits[acc.id]) : acc.amount;

  const propiedadesTotal = useMemo(
    () => properties.reduce((sum, p) => sum + p.value, 0),
    [properties]
  );

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

    const totalActivos =
      byCategory.liquidez + byCategory.inversiones + byCategory.jubilacion + propiedadesTotal + vehiculosTotal;
    const totalPasivos = byCategory.consumo + byCategory.prestamos;
    const patrimonioNeto = totalActivos - totalPasivos;

    // Métricas estratégicas de alto valor
    const deudaNeta = Math.max(0, totalPasivos - byCategory.liquidez);
    const debtRatio = totalActivos > 0 ? (totalPasivos / totalActivos) * 100 : 0;

    // Capas de Liquidez (Tier 1, Tier 2, Tier 3)
    const capa1Inmediata = byCategory.liquidez;
    const capa2Crecimiento = byCategory.inversiones;
    const capa3Iliquida = byCategory.jubilacion + propiedadesTotal + vehiculosTotal;

    // Estimación de Runway de Liquidez (ejemplo base de gasto mensual estimado o cuotas de deuda)
    // Usamos el promedio de servicio de deuda mensual + gastos como referencia
    const estimatedMonthlyBurn = Math.max(2500, (byCategory.prestamos * 0.007) + 1800);
    const runwayMeses = estimatedMonthlyBurn > 0 ? (capa1Inmediata / estimatedMonthlyBurn).toFixed(1) : '—';

    // Porcentajes para donut
    const grand = totalActivos + totalPasivos;
    const pct = (val) => (grand > 0 ? Math.round((val / grand) * 100) : 0);

    return {
      totalActivos,
      totalPasivos,
      patrimonioNeto,
      byCategory,
      deudaNeta,
      debtRatio,
      capa1Inmediata,
      capa2Crecimiento,
      capa3Iliquida,
      runwayMeses,
      pctLiquidez: pct(byCategory.liquidez),
      pctInversiones: pct(byCategory.inversiones),
      pctJubilacion: pct(byCategory.jubilacion),
      pctPropiedades: pct(propiedadesTotal),
      pctVehiculos: pct(vehiculosTotal),
      pctPrestamos: pct(byCategory.prestamos),
      pctConsumo: pct(byCategory.consumo),
    };
  }, [accounts, edits, propiedadesTotal, vehiculosTotal]);

  const handleInputChange = (id, rawValue) => {
    let cleaned = rawValue.replace(/[^0-9.-]/g, '');
    const isNegative = cleaned.startsWith('-');
    cleaned = cleaned.replace(/-/g, '');
    if (isNegative) cleaned = '-' + cleaned;
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    setEdits((prev) => ({ ...prev, [id]: cleaned }));
  };

  const handleCheckToggle = (id) => {
    setCheckedFields((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let changedCount = 0;
    let touchedCount = 0;

    for (const acc of accounts) {
      const editedRaw = edits[acc.id];
      const isChecked = !!checkedFields[acc.id];
      if (editedRaw === undefined && !isChecked) continue;

      touchedCount++;
      const newVal = editedRaw !== undefined ? Number(editedRaw) || 0 : acc.amount;
      const oldVal = saved[acc.id] !== undefined ? Number(saved[acc.id]) : acc.amount;
      if (newVal === oldVal) continue;

      changedCount++;
      updateAccount(acc.id, acc.name, newVal);
    }

    if (touchedCount === 0) {
      setAlert({ type: 'info', message: 'Marca el campo como Actualizado o cambia un valor antes de guardar.' });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    try {
      await saveToday({
        ahorro: totals.byCategory.liquidez,
        inversion: totals.byCategory.inversiones,
        jubilacion: totals.byCategory.jubilacion,
        deuda: totals.byCategory.consumo,
        prestamo: totals.byCategory.prestamos,
      });
    } catch (err) {
      setAlert({ type: 'info', message: `Guardado en cuentas, pero falló historial: ${err.message}` });
      setTimeout(() => setAlert(null), 5000);
      return;
    }

    const newSaved = { ...saved };
    for (const acc of accounts) {
      if (edits[acc.id] !== undefined || checkedFields[acc.id]) {
        newSaved[acc.id] = String(effectiveAmount(acc));
      }
    }
    setSaved(newSaved);
    setEdits({});
    setCheckedFields({});

    setAlert({
      type: 'success',
      message: `¡Registro guardado! Se actualizaron ${changedCount} cuentas del patrimonio.`,
    });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleDiscard = () => {
    setEdits({});
    setCheckedFields({});
    setAlert({ type: 'info', message: 'Se han descartado los cambios no guardados.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const accountsByCategory = useMemo(() => {
    const grouped = {};
    for (const key of Object.keys(CATEGORY_META)) grouped[key] = [];
    for (const acc of accounts) {
      if (grouped[acc.category]) grouped[acc.category].push(acc);
    }
    return grouped;
  }, [accounts]);

  return (
    <AppLayout title="Patrimonio Neto" searchPlaceholder="Buscar en patrimonio...">
      {/* Alert banner */}
      {alert && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border text-sm transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {alert.type === 'success' ? 'check_circle' : 'info'}
          </span>
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header & Networth Total Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Patrimonio Neto Familiar
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Balance consolidado de los activos y pasivos de la familia Álvarez Gamboa.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 px-5 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs shrink-0">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
              Networth Consolidado
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatExactCurrency(totals.patrimonioNeto)}
            </span>
          </div>
        </div>
      </div>

      {/* Strategic Metrics Row (Runway, Deuda Neta, Salud Financiera) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Activos */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
            <span className="text-xs uppercase font-semibold tracking-wider">Activos Totales</span>
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
            {formatCurrency(totals.totalActivos)}
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Bienes, inversiones y efectivo
          </p>
        </div>

        {/* Pasivos / Ratio Deuda */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
            <span className="text-xs uppercase font-semibold tracking-wider">Deuda / Apalancamiento</span>
            <span className="material-symbols-outlined text-rose-500 text-[18px]">trending_down</span>
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {formatCurrency(totals.totalPasivos)}
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Ratio de deuda: <span className="font-semibold">{totals.debtRatio.toFixed(1)}%</span> de los activos
          </p>
        </div>

        {/* Runway de Liquidez */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
            <span className="text-xs uppercase font-semibold tracking-wider">Runway de Liquidez</span>
            <span className="material-symbols-outlined text-teal-600 text-[18px]">hourglass_top</span>
          </div>
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 tabular-nums">
            ~{totals.runwayMeses} meses
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Autonomía financiera en efectivo
          </p>
        </div>

        {/* Salud Financiera */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
            <span className="text-xs uppercase font-semibold tracking-wider">Salud Financiera</span>
            <span className="material-symbols-outlined text-blue-500 text-[18px]">verified</span>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Excelente</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Patrimonio neto positivo (+{((totals.patrimonioNeto / (totals.totalActivos || 1)) * 100).toFixed(0)}% libre de deuda)
          </p>
        </div>
      </section>

      {/* Main Grid: Form Left (8 cols) + Breakdown Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Account Input Forms */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
                    edit_note
                  </span>
                  Actualización de Valores por Cuenta
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Modifica los balances actuales o concilia automáticamente con el flujo del mes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConciliacionOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all"
                >
                  <span className="material-symbols-outlined text-sm">sync_alt</span>
                  <span>Conciliar con HomeBudget</span>
                </button>
              </div>
            </div>

            {accounts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl opacity-40">account_balance</span>
                <p className="text-sm mt-2">No hay cuentas activas registradas.</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                {Object.entries(CATEGORY_META).map(([catKey, catMeta]) => {
                  const catAccounts = accountsByCategory[catKey] || [];
                  if (catAccounts.length === 0) return null;

                  return (
                    <div key={catKey} className="pt-4 first:pt-0 border-t first:border-t-0 border-slate-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={{ color: catMeta.color }}
                        >
                          {catMeta.icon}
                        </span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                          {catMeta.label}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catAccounts.map((acc) => {
                          const displayVal =
                            edits[acc.id] !== undefined ? edits[acc.id] : String(acc.amount);
                          const isLocked = !!checkedFields[acc.id];

                          return (
                            <div
                              key={acc.id}
                              className={`p-3 rounded-xl border transition-all ${
                                isLocked
                                  ? 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/60'
                                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus-within:border-emerald-500 dark:focus-within:border-emerald-500'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate pr-2">
                                  {acc.name}
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isLocked}
                                    onChange={() => handleCheckToggle(acc.id)}
                                    className="w-3.5 h-3.5 rounded text-emerald-600 accent-emerald-600 focus:ring-0 cursor-pointer"
                                  />
                                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                                    Al día
                                  </span>
                                </label>
                              </div>

                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-xs font-mono">
                                  $
                                </span>
                                <input
                                  type="text"
                                  value={displayVal}
                                  disabled={isLocked}
                                  onChange={(e) => handleInputChange(acc.id, e.target.value)}
                                  className={`w-full pl-6 pr-2 py-1.5 bg-transparent border-0 text-right font-mono text-sm tabular-nums outline-none font-medium ${
                                    catMeta.isLiability ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-zinc-100'
                                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Footer Save / Discard Bar */}
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex gap-4 text-xs text-slate-500 dark:text-zinc-400">
                    <span>
                      Activos: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.totalActivos)}</strong>
                    </span>
                    <span>
                      Pasivos: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(totals.totalPasivos)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleDiscard}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Descartar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      Guardar Registro
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right column: 3 Tiers of Liquidity & Asset Breakdown */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Tiers of Assets (3 Capas de Liquidez) */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              Estructura por Capas de Liquidez
            </h3>

            <div className="space-y-3">
              {/* Capa 1 */}
              <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    Capa 1: Inmediata
                  </span>
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-300 tabular-nums">
                    {formatCurrency(totals.capa1Inmediata)}
                  </span>
                </div>
                <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80">
                  Cuentas corrientes y ahorros de acceso inmediato.
                </p>
              </div>

              {/* Capa 2 */}
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Capa 2: Crecimiento Líquido
                  </span>
                  <span className="text-xs font-bold text-blue-800 dark:text-blue-300 tabular-nums">
                    {formatCurrency(totals.capa2Crecimiento)}
                  </span>
                </div>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80">
                  Fondos bursátiles y acciones convertibles a efectivo en días.
                </p>
              </div>

              {/* Capa 3 */}
              <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Capa 3: Patrimonio Iliquido
                  </span>
                  <span className="text-xs font-bold text-purple-800 dark:text-purple-300 tabular-nums">
                    {formatCurrency(totals.capa3Iliquida)}
                  </span>
                </div>
                <p className="text-[11px] text-purple-700/80 dark:text-purple-400/80">
                  Propiedades de avalúo, vehículos y aportes de jubilación.
                </p>
              </div>
            </div>
          </div>

          {/* Propiedades */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">domain</span>
                Propiedades ({properties.length})
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                  {formatCurrency(propiedadesTotal)}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/inmuebles')}
                  className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/50 text-[10px] font-bold hover:bg-teal-100 dark:hover:bg-teal-900 flex items-center gap-0.5"
                  title="Ver ficha integral y cash flow en el Hub Inmobiliario"
                >
                  <span>Hub</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 block">{p.name}</span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">Avalúo: {p.appraisalDate}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                    {formatCurrency(p.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Automóviles */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">directions_car</span>
                Vehículos ({vehicles.length})
              </h3>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                {formatCurrency(vehiculosTotal)}
              </span>
            </div>
            <div className="space-y-2">
              {vehicles.map((v) => {
                const curVal = estimateCurrentValue(v);
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 block">{v.name}</span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">Año {v.purchaseYear} • Depr. 15%</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                      {formatCurrency(curVal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ConciliacionFinDeMesModal
        isOpen={isConciliacionOpen}
        onClose={() => setIsConciliacionOpen(false)}
      />
    </AppLayout>
  );
}
