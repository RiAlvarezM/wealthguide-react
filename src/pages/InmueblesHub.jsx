import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ChartCanvas from '../components/ChartCanvas';
import { useProperties } from '../context/PropertiesContext';
import { useAccounts } from '../context/AccountsContext';
import { useHomeBudget } from '../context/HomeBudgetContext';
import { useTheme } from '../context/ThemeContext';
import { buildRealEstatePortfolio, PROPERTY_CONFIG } from '../lib/realEstateMetrics';

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatExactCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function InmueblesHub() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { properties, updateProperty, addProperty } = useProperties();
  const { accounts } = useAccounts();
  const { summaryData } = useHomeBudget();

  // Transacciones completas históricas de HomeBudget cargadas en memoria
  const allExpenses = summaryData?.rawExpenses || [];
  const allIncomes = summaryData?.rawIncomes || [];

  // Calcular el Portafolio Inmobiliario Completo
  const portfolio = useMemo(() => {
    return buildRealEstatePortfolio(properties, accounts, allExpenses, allIncomes);
  }, [properties, accounts, allExpenses, allIncomes]);

  // Selección de pestaña: 'all' (Portfolio) o ID de propiedad
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');

  // Estado del modal de edición de avalúo
  const [editModalProp, setEditModalProp] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSavingProp, setIsSavingProp] = useState(false);

  // Propiedad activa seleccionada
  const activeProfile = useMemo(() => {
    if (selectedPropertyId === 'all') return null;
    return portfolio.profiles.find(p => p.id === selectedPropertyId || p.key === selectedPropertyId) || portfolio.profiles[0];
  }, [portfolio, selectedPropertyId]);

  const handleOpenEdit = (propProfile) => {
    // Buscar la propiedad real en el contexto de properties o crearla si fue default
    const existing = properties.find(p => p.name.toLowerCase().includes(propProfile.name.toLowerCase()));
    setEditModalProp({
      id: existing?.id || null,
      name: propProfile.name,
      currentValue: propProfile.propertyValue,
      appraisalDate: propProfile.appraisalDate !== '—' ? propProfile.appraisalDate : new Date().toISOString().slice(0, 10)
    });
    setEditVal(String(propProfile.propertyValue));
    setEditDate(propProfile.appraisalDate !== '—' ? propProfile.appraisalDate : new Date().toISOString().slice(0, 10));
  };

  const handleSavePropertyEdit = async (e) => {
    e.preventDefault();
    if (!editModalProp) return;
    try {
      setIsSavingProp(true);
      const numVal = Number(editVal) || 0;
      if (editModalProp.id) {
        await updateProperty(editModalProp.id, editModalProp.name, numVal, editDate);
      } else {
        await addProperty(editModalProp.name, numVal, editDate);
      }
      setIsSavingProp(false);
      setEditModalProp(null);
    } catch (err) {
      console.error(err);
      alert(`Error al guardar propiedad: ${err.message}`);
      setIsSavingProp(false);
    }
  };

  // Datos para Gráfico de Composición de Portafolio (Doughnut)
  const portfolioDoughnutData = useMemo(() => {
    return {
      labels: ['Equity Neto (Patrimonio Libre)', 'Deuda Hipotecaria Bancaria'],
      datasets: [
        {
          data: [portfolio.totalEquity, portfolio.totalMortgage],
          backgroundColor: ['#0d9488', '#f43f5e'],
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    };
  }, [portfolio]);

  const portfolioDoughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#a1a1aa' : '#52525b',
          font: { size: 11, family: 'Inter, sans-serif', weight: '600' },
          padding: 12
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${((ctx.raw / (portfolio.totalValue || 1)) * 100).toFixed(1)}%)`
        }
      }
    },
    cutout: '72%'
  }), [isDark, portfolio]);

  // Datos para Gráfico de Flujo Mensual de la propiedad activa (Bar / Line)
  const propertyFlowChartData = useMemo(() => {
    if (!activeProfile) return null;
    const months = activeProfile.recentMonths.slice(-8);
    const labels = months.map(m => {
      const parts = m.month.split('-');
      return parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : m.month;
    });

    return {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Ingreso Alquiler',
          data: months.map(m => m.rentIncome),
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderRadius: 6,
          order: 2
        },
        {
          type: 'bar',
          label: 'Cuota Hipoteca',
          data: months.map(m => m.mortgageExpense),
          backgroundColor: 'rgba(244, 63, 94, 0.75)',
          borderRadius: 6,
          order: 2
        },
        {
          type: 'bar',
          label: 'Mantenimiento HOA',
          data: months.map(m => m.maintenanceExpense),
          backgroundColor: 'rgba(245, 158, 11, 0.75)',
          borderRadius: 6,
          order: 2
        },
        {
          type: 'line',
          label: 'Cash Flow Neto',
          data: months.map(m => m.netCashFlow),
          borderColor: isDark ? '#38bdf8' : '#0284c7',
          backgroundColor: isDark ? '#38bdf8' : '#0284c7',
          borderWidth: 2.5,
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 6,
          order: 1
        }
      ]
    };
  }, [activeProfile, isDark]);

  const propertyFlowChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#a1a1aa' : '#52525b',
          font: { size: 11, family: 'Inter, sans-serif' },
          padding: 10
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatExactCurrency(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#71717a' : '#a1a1aa', font: { size: 10 } }
      },
      y: {
        grid: { color: isDark ? '#27272a' : '#f1f5f9' },
        ticks: {
          color: isDark ? '#71717a' : '#a1a1aa',
          font: { size: 10 },
          callback: (val) => `$${val}`
        }
      }
    }
  }), [isDark]);

  return (
    <AppLayout
      title="Bienes Raíces & Hub Inmobiliario"
      searchPlaceholder="Buscar en inmuebles..."
    >
      <div className="space-y-6">

        {/* 1. HEADER EJECUTIVO & NAVEGADOR DE PROPIEDADES */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-2xl">
                domain
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Hub Inmobiliario & Cash Flow por Propiedad
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Ficha integral de bienes raíces: cálculo de equity neto real, LTV, cuotas hipotecarias y rentabilidad operativa.
            </p>
          </div>

          {/* Selector de Pestañas: Consolidado vs Cada Propiedad */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedPropertyId('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedPropertyId === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm">pie_chart</span>
              <span>Portafolio Consolidado</span>
            </button>

            {portfolio.profiles.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPropertyId(p.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedPropertyId === p.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{p.typeIcon}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. TARJETAS DE IMPACTO CONSOLIDADO (PORTAFOLIO) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Valor de Mercado */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider">Valor de Avalúo</span>
              <span className="material-symbols-outlined text-slate-400 text-lg">apartment</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 font-mono">
              {formatCurrency(portfolio.totalValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {portfolio.propertiesCount} propiedades valuadas
            </div>
          </div>

          {/* Deuda Hipotecaria */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider">Deuda Hipotecaria</span>
              <span className="material-symbols-outlined text-rose-500 text-lg">account_balance</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {formatCurrency(portfolio.totalMortgage)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>LTV Consolidado:</span>
              <span className="font-bold text-slate-700 dark:text-zinc-300">{portfolio.portfolioLtv}%</span>
            </div>
          </div>

          {/* Equity Neto */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Equity Neto Real
              </span>
              <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-lg">
                verified
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-300 font-mono">
              {formatCurrency(portfolio.totalEquity)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              <strong className="text-teal-600 dark:text-teal-400">{portfolio.portfolioEquityPct}%</strong> de las propiedades ya es tuyo
            </div>
          </div>

          {/* Flujo Neto Mensual */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider">Flujo Alquiler vs Cuotas</span>
              <span className="material-symbols-outlined text-sky-500 text-lg">payments</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 font-mono">
              +{formatCurrency(portfolio.totalMonthlyRent)}/m
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Yield Bruto Cartera: <strong className="text-emerald-600 dark:text-emerald-400">{portfolio.portfolioGrossYield}%</strong>
            </div>
          </div>
        </div>

        {/* 3. VISTA CONSOLIDADA (Si selectedPropertyId === 'all') */}
        {selectedPropertyId === 'all' && (
          <div className="space-y-6">
            {/* Grid de 2 Columnas: Donut de Equity vs Deuda & Resumen por Inmueble */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Columna Izquierda: Gráfico Donut de Desglose Patrimonial */}
              <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Apalancamiento Inmobiliario Total
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Proporción de capital propio (Equity) frente a capital bancario (Hipotecas).
                  </p>
                </div>

                <div className="relative h-[220px] sm:h-[240px] my-4 flex items-center justify-center">
                  <ChartCanvas type="doughnut" data={portfolioDoughnutData} options={portfolioDoughnutOptions} height={230} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equity Total</span>
                    <span className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono">
                      {portfolio.portfolioEquityPct}%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span className="material-symbols-outlined text-sm text-teal-600">health_and_safety</span>
                    <span>Salud de Deuda: Excelente (LTV {portfolio.portfolioLtv}%)</span>
                  </div>
                  <span>Por cada $1.00 de deuda hipotecaria, la familia cuenta con <strong>${(portfolio.totalEquity / (portfolio.totalMortgage || 1)).toFixed(2)}</strong> de valor propio en inmuebles.</span>
                </div>
              </div>

              {/* Columna Derecha: Tarjetas de las Propiedades del Portafolio */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Propiedades de la Familia
                  </h3>
                  <span className="text-xs text-slate-400">
                    Haz clic en una propiedad para abrir su ficha detallada
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {portfolio.profiles.map(p => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPropertyId(p.id)}
                      className="group cursor-pointer bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-teal-500/50 dark:hover:border-teal-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Header de Tarjeta */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${p.typeBadgeColor}`}>
                              <span className="material-symbols-outlined text-xs">{p.typeIcon}</span>
                              <span>{p.typeLabel}</span>
                            </span>
                            <h4 className="font-bold text-base text-slate-900 dark:text-zinc-100 mt-1.5 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                              {p.name}
                            </h4>
                            <p className="text-[11px] text-slate-400">{p.fullName}</p>
                          </div>

                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-400 group-hover:text-teal-600 group-hover:bg-teal-50 dark:group-hover:bg-teal-950 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </div>
                        </div>

                        {/* Barra de Progreso Equity */}
                        <div className="space-y-1 mb-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Equity ({p.equityPct.toFixed(0)}%)</span>
                            <span className="font-bold text-teal-700 dark:text-teal-300 font-mono">
                              {formatCurrency(p.equity)}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden flex">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all"
                              style={{ width: `${p.equityPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Deuda: {formatCurrency(p.mortgageBalance)}</span>
                            <span>Valor: {formatCurrency(p.propertyValue)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer de Tarjeta con Métricas Rápidas */}
                      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                        {p.type === 'investment' ? (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Renta Estimada</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                +{formatCurrency(p.cashFlow.avgRent)}/m
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">Yield Bruto</span>
                              <span className="font-bold text-slate-900 dark:text-zinc-100 font-mono">
                                {p.cashFlow.grossYield.toFixed(1)}% anual
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Cuota Hipoteca</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                                -{formatCurrency(p.cashFlow.avgMortgage)}/m
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">LTV Actual</span>
                              <span className="font-bold text-slate-900 dark:text-zinc-100 font-mono">
                                {p.ltv.toFixed(1)}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 4. FICHA INTEGRAL DETALLADA (Si hay una propiedad seleccionada) */}
        {activeProfile && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Cabecera de la Ficha con Botón Volver y Botón Editar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">{activeProfile.typeIcon}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-zinc-100">
                      {activeProfile.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${activeProfile.typeBadgeColor}`}>
                      {activeProfile.typeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {activeProfile.fullName} • Avalúo registrado: {activeProfile.appraisalDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(activeProfile)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>Editar Valor de Avalúo</span>
                </button>

                {activeProfile.mortgageAccount && (
                  <button
                    type="button"
                    onClick={() => navigate('/prestamos')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                    title="Ver tabla de amortización completa en Préstamos"
                  >
                    <span className="material-symbols-outlined text-sm">table_chart</span>
                    <span>Ver Amortización</span>
                  </button>
                )}
              </div>
            </div>

            {/* Grid 2 Columnas: Métricas de Capital (Equity/LTV) & Termómetro de Cash Flow Operativo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Columna Izquierda: Estructura Patrimonial (Equity vs Deuda) */}
              <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider text-slate-400 mb-4">
                    Estructura Patrimonial (Balance Sheet)
                  </h4>

                  {/* Cuadrantes de Valor */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Valor de Mercado</span>
                      <span className="text-xl font-bold text-slate-900 dark:text-zinc-100 font-mono mt-0.5 block">
                        {formatCurrency(activeProfile.propertyValue)}
                      </span>
                      <span className="text-[10px] text-slate-400">Avalúo {activeProfile.appraisalDate}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                      <span className="text-[11px] text-slate-400 font-semibold block uppercase">Saldo Hipoteca</span>
                      <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
                        {formatCurrency(activeProfile.mortgageBalance)}
                      </span>
                      <span className="text-[10px] text-slate-400">Deuda viva en banco</span>
                    </div>
                  </div>

                  {/* Equity Destacado con Barra */}
                  <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/40 mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-teal-800 dark:text-teal-300">
                        Equity Neto de la Familia (Patrimonio Libre)
                      </span>
                      <span className="text-lg font-black text-teal-700 dark:text-teal-300 font-mono">
                        {formatCurrency(activeProfile.equity)}
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden flex my-2">
                      <div
                        className="h-full bg-teal-600 rounded-full transition-all"
                        style={{ width: `${activeProfile.equityPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-teal-900/80 dark:text-teal-300/80">
                      <span><strong>{activeProfile.equityPct.toFixed(1)}%</strong> pagado</span>
                      <span>LTV Actual: <strong>{activeProfile.ltv.toFixed(1)}%</strong></span>
                    </div>
                  </div>
                </div>

                {/* Badge de Estado LTV */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Nivel de Apalancamiento:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${activeProfile.ltvStatus.badge}`}>
                    {activeProfile.ltvStatus.label}
                  </span>
                </div>
              </div>

              {/* Columna Derecha: Termómetro de Cash Flow Operativo (HomeBudget Live) */}
              <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-wider text-slate-400">
                      Cash Flow Operativo Mensual
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Basado en HomeBudget
                    </span>
                  </div>

                  {/* Cascada de Flujo Mensual */}
                  <div className="space-y-2.5 font-mono text-xs">
                    {/* Ingreso Alquiler */}
                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                      <div className="font-sans flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-bold text-emerald-900 dark:text-emerald-200">
                          (+) Ingreso Mensual por Alquiler
                        </span>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{formatExactCurrency(activeProfile.cashFlow.avgRent)}
                      </span>
                    </div>

                    {/* Cuota Hipoteca */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="font-sans flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-slate-700 dark:text-zinc-300">
                          (-) Servicio de Deuda (Cuota Hipotecaria)
                        </span>
                      </div>
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                        -{formatExactCurrency(activeProfile.cashFlow.avgMortgage)}
                      </span>
                    </div>

                    {/* Mantenimiento HOA */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="font-sans flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-slate-700 dark:text-zinc-300">
                          (-) Cuota de Mantenimiento HOA & Edificio
                        </span>
                      </div>
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                        -{formatExactCurrency(activeProfile.cashFlow.avgMaint)}
                      </span>
                    </div>

                    {/* Resultado Neto */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                      activeProfile.cashFlow.avgNetFlow >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
                    }`}>
                      <div className="font-sans">
                        <span className="font-bold text-xs uppercase tracking-wider block">
                          (=) Cash Flow Operativo Neto
                        </span>
                        <span className="text-[11px] opacity-80">
                          {activeProfile.cashFlow.avgNetFlow >= 0 ? 'Superávit mensual en bolsillo' : 'Costo habitacional / Aporte requerido'}
                        </span>
                      </div>
                      <span className="font-black text-lg">
                        {activeProfile.cashFlow.avgNetFlow >= 0 ? '+' : ''}
                        {formatExactCurrency(activeProfile.cashFlow.avgNetFlow)}/mes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Veredicto de Autofinanciabilidad */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-zinc-300 flex items-start gap-2">
                  <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-base mt-0.5">
                    info
                  </span>
                  <div>
                    {activeProfile.type === 'investment' ? (
                      activeProfile.cashFlow.isSelfFinancing ? (
                        <span>
                          <strong>Propiedad Autofinanciable:</strong> El alquiler percibido cubre el costo operativo y el servicio de la hipoteca. Cada mes el inquilino paga la deuda bancaria e incrementa tu patrimonio neto.
                        </span>
                      ) : (
                        <span>
                          <strong>Flujo Neutro:</strong> La propiedad requiere una pequeña inyección marginal de ${Math.abs(activeProfile.cashFlow.avgNetFlow).toFixed(0)}/mes para cubrir el mantenimiento, manteniendo un retorno neto sólido.
                        </span>
                      )
                    ) : (
                      <span>
                        <strong>Vivienda Familiar Principal:</strong> Tu costo habitacional neto es de <strong>{formatCurrency(activeProfile.cashFlow.avgMortgage + activeProfile.cashFlow.avgMaint)}/mes</strong>. Una porción significativa de cada pago de hipoteca amortiza capital, acumulando equity propio.
                      </span>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* 5. GRÁFICO HISTÓRICO DE CASH FLOW MENSUAL (Últimos Meses) */}
            {propertyFlowChartData && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                      Evolución Histórica de Flujo Mensual (Últimos 8 Meses)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Comparativa entre Ingresos por Alquiler, Pagos de Hipoteca y Mantenimiento HOA.
                    </p>
                  </div>

                  {activeProfile.type === 'investment' && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Gross Rental Yield</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {activeProfile.cashFlow.grossYield.toFixed(2)}% anual
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Cap Rate (NOI)</span>
                        <span className="font-black text-teal-600 dark:text-teal-400 font-mono">
                          {activeProfile.cashFlow.capRate.toFixed(2)}% anual
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-[240px] sm:h-[280px] w-full pt-2">
                  <ChartCanvas type="bar" data={propertyFlowChartData} options={propertyFlowChartOptions} height={260} />
                </div>
              </div>
            )}

            {/* 6. ÚLTIMOS MOVIMIENTOS REGISTRADOS EN HOMEBUDGET */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Últimas Transacciones Registradas ({activeProfile.name})
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Movimientos identificados en HomeBudget vinculados a este inmueble.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {activeProfile.recentTransactions.length} movimientos
                </span>
              </div>

              {activeProfile.recentTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No se encontraron transacciones recientes registradas para esta propiedad.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Concepto</th>
                        <th className="py-2.5 px-3">Detalle / Notas</th>
                        <th className="py-2.5 px-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                      {activeProfile.recentTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                            {tx.date}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 dark:text-zinc-200">
                            {tx.description}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">
                            {tx.detail || '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${
                            tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-zinc-100'
                          }`}>
                            {tx.type === 'income' ? `+${formatExactCurrency(tx.amount)}` : `-${formatExactCurrency(tx.amount)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* MODAL DE EDICIÓN DE VALOR DE AVALÚO */}
        {editModalProp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600">apartment</span>
                  <span>Actualizar Valor: {editModalProp.name}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditModalProp(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleSavePropertyEdit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Valor de Avalúo / Mercado (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Fecha del Avalúo
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-teal-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalProp(null)}
                    disabled={isSavingProp}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProp}
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20"
                  >
                    {isSavingProp ? 'Guardando...' : 'Guardar y Recalcular'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
