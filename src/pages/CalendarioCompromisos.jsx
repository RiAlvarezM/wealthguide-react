import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useHomeBudget } from '../context/HomeBudgetContext';
import { useTheme } from '../context/ThemeContext';
import {
  evaluateBillsForMonth,
  getUpcomingCommitments,
  getSavedBillsCatalog,
  saveBillsCatalog
} from '../lib/recurringBillsRadar';

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

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarioCompromisos() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    selectedMonth,
    handlePrevMonth,
    handleNextMonth,
    allCurrentMonthTransactions
  } = useHomeBudget();

  // Vista activa: 'calendar', 'timeline', 'subscriptions'
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  // Estado del modal de nueva suscripción / compromiso
  const [isNewBillModalOpen, setIsNewBillModalOpen] = useState(false);
  const [newBillForm, setNewBillForm] = useState({
    name: '',
    category: 'Suscripciones',
    amount: '',
    typicalDay: 15,
    isSubscription: true,
    color: '#3b82f6',
    icon: 'credit_card'
  });

  // Evaluar compromisos del mes cruzando HomeBudget
  const evaluated = useMemo(() => {
    return evaluateBillsForMonth(selectedMonth, allCurrentMonthTransactions);
  }, [selectedMonth, allCurrentMonthTransactions]);

  const { bills, summary } = evaluated;

  // Próximos vencimientos urgentes
  const upcomingBills = useMemo(() => {
    return getUpcomingCommitments(bills, 15);
  }, [bills]);

  // Suscripciones digitales filtradas
  const subscriptionsList = useMemo(() => {
    return bills.filter(b => b.isSubscription);
  }, [bills]);

  // Generar estructura de calendario para el mes seleccionado
  const calendarDays = useMemo(() => {
    if (!selectedMonth || !selectedMonth.includes('-')) return [];
    const [year, month] = selectedMonth.split('-').map(Number);

    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // 0 = Domingo, 1 = Lunes en JS Date. Convertir a lunes = 0 .. domingo = 6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const days = [];

    // Celdas vacías previas
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ dayNumber: null, isCurrentMonth: false });
    }

    // Días del mes con sus compromisos mapeados
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYearMonth = todayStr.slice(0, 7);
    const todayDay = new Date().getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = selectedMonth === currentYearMonth && d === todayDay;
      const dayBills = bills.filter(b => b.typicalDay === d || b.secondDay === d);

      const hasPaid = dayBills.some(b => b.isPaid);
      const hasPending = dayBills.some(b => !b.isPaid);
      const dayTotal = dayBills.reduce((sum, b) => sum + b.amount, 0);

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        bills: dayBills,
        hasPaid,
        hasPending,
        dayTotal
      });
    }

    return days;
  }, [selectedMonth, bills]);

  // Guardar nueva suscripción o compromiso
  const handleSaveNewBill = (e) => {
    e.preventDefault();
    if (!newBillForm.name || !newBillForm.amount) return;

    const currentCatalog = getSavedBillsCatalog();
    const newEntry = {
      id: `bill_${Date.now()}`,
      name: newBillForm.name,
      category: newBillForm.category,
      subcategories: [newBillForm.name.toLowerCase()],
      payeeKeywords: [newBillForm.name.toLowerCase()],
      typicalDay: Number(newBillForm.typicalDay) || 15,
      amount: Number(newBillForm.amount) || 0,
      frequency: 'mensual',
      isSubscription: Boolean(newBillForm.isSubscription),
      color: newBillForm.color || '#3b82f6',
      icon: newBillForm.isSubscription ? 'smart_display' : 'receipt_long'
    };

    const updated = [...currentCatalog, newEntry];
    saveBillsCatalog(updated);
    setIsNewBillModalOpen(false);
    setNewBillForm({
      name: '',
      category: 'Suscripciones',
      amount: '',
      typicalDay: 15,
      isSubscription: true,
      color: '#3b82f6',
      icon: 'credit_card'
    });
  };

  return (
    <AppLayout
      title="Calendario & Radar de Suscripciones"
      searchPlaceholder="Buscar compromisos..."
    >
      <div className="space-y-6">

        {/* 1. HEADER DE CONTROL Y NAVEGACIÓN DE MES */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-2xl">
                calendar_month
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Compromisos Fijos & Radar de Suscripciones
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Monitoreo de vencimientos, cuotas de hipoteca, mantenimientos, colegios y radar de suscripciones activas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Paginador de Mes */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Mes anterior"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <div className="px-3 text-xs font-bold text-slate-800 dark:text-zinc-200 min-w-[120px] text-center font-mono">
                {formatMonthLabel(selectedMonth)}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Mes siguiente"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsNewBillModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Nuevo Compromiso</span>
            </button>
          </div>
        </div>

        {/* 2. TARJETAS DE IMPACTO FINANCIERO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Compromisos */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Compromisos
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 font-mono mt-1">
              {formatCurrency(summary.totalBudgeted)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {bills.length} pagos recurrentes en el mes
            </div>
          </div>

          {/* Pagado a la Fecha */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Pagado a la Fecha
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {formatCurrency(summary.totalPaid)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>Progreso:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">{summary.completionPct}%</strong>
            </div>
          </div>

          {/* Pendiente por Pagar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Pendiente por Cubrir
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
              {formatCurrency(summary.totalPending)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {bills.filter(b => !b.isPaid).length} pagos restantes
            </div>
          </div>

          {/* Radar Suscripciones */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
              Radar de Suscripciones
            </span>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
              ${summary.subscriptionsMonthly}/m
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              ${summary.subscriptionsAnnual}/año ({summary.subscriptionsCount} servicios)
            </div>
          </div>
        </div>

        {/* 3. ALERTA: PRÓXIMOS VENCIMIENTOS (RADAR A 15 DÍAS) */}
        {upcomingBills.length > 0 && (
          <div className="bg-gradient-to-r from-teal-500/10 via-amber-500/10 to-rose-500/10 border border-teal-200 dark:border-teal-900/50 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl animate-pulse">
                  alarm
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Próximos Vencimientos Inmediatos
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {upcomingBills.length} pagos pendientes en los próximos 15 días
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {upcomingBills.map(b => (
                <div
                  key={b.id}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: b.color }}>
                        <span className="material-symbols-outlined text-sm">{b.icon}</span>
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 line-clamp-1">
                          {b.name}
                        </div>
                        <div className="text-[10px] text-slate-400">Día {b.typicalDay} de cada mes</div>
                      </div>
                    </div>

                    <span className="font-black text-xs text-slate-900 dark:text-zinc-100 font-mono">
                      {formatExactCurrency(b.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[10px]">
                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                      b.daysUntil === 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : b.daysUntil < 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {b.daysUntil === 0 ? 'Vence HOY' : b.daysUntil < 0 ? `Vencido hace ${Math.abs(b.daysUntil)}d` : `En ${b.daysUntil} días`}
                    </span>
                    <span className="text-slate-400">{b.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. CONMUTADOR DE VISTAS (CALENDARIO vs TIMELINE vs RADAR SUSCRIPCIONES) */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Vista Calendario</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'timeline'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_agenda</span>
              <span>Agenda Cronológica</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('subscriptions')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'subscriptions'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">smart_display</span>
              <span>Radar Suscripciones ({subscriptionsList.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Pagado</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Pendiente</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Vencido</span>
            </span>
          </div>
        </div>

        {/* 5. VISTA 1: CALENDARIO MENSUAL (GRID) */}
        {activeTab === 'calendar' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs">
            {/* Cabecera Días de la Semana */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-400 mb-2">
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="py-1 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Celdas del Calendario */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={`empty_${idx}`}
                      className="min-h-[75px] sm:min-h-[95px] rounded-xl bg-slate-50/50 dark:bg-zinc-950/20 border border-transparent"
                    />
                  );
                }

                return (
                  <div
                    key={`day_${cell.dayNumber}`}
                    onClick={() => cell.bills.length > 0 && setSelectedDayDetail(cell)}
                    className={`min-h-[75px] sm:min-h-[95px] p-1.5 sm:p-2 rounded-xl border transition-all flex flex-col justify-between ${
                      cell.isToday
                        ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/20 shadow-xs ring-1 ring-teal-500/50'
                        : cell.bills.length > 0
                        ? 'border-slate-200 dark:border-zinc-800 hover:border-teal-400/60 bg-white dark:bg-zinc-900 cursor-pointer'
                        : 'border-slate-100 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/40'
                    }`}
                  >
                    {/* Número del Día */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.2 rounded ${
                        cell.isToday
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-700 dark:text-zinc-300'
                      }`}>
                        {cell.dayNumber}
                      </span>

                      {cell.bills.length > 0 && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 hidden sm:inline">
                          ${Math.round(cell.dayTotal)}
                        </span>
                      )}
                    </div>

                    {/* Chips de Compromisos */}
                    <div className="space-y-1 my-1 overflow-hidden">
                      {cell.bills.slice(0, 2).map(b => (
                        <div
                          key={b.id}
                          className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded truncate font-medium flex items-center justify-between gap-1 ${
                            b.isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/50'
                          }`}
                          title={`${b.name}: $${b.amount} (${b.isPaid ? 'Pagado' : 'Pendiente'})`}
                        >
                          <span className="truncate">{b.name}</span>
                          {b.isPaid && <span className="material-symbols-outlined text-[10px] text-emerald-600">check</span>}
                        </div>
                      ))}

                      {cell.bills.length > 2 && (
                        <div className="text-[9px] text-slate-400 text-center font-bold">
                          +{cell.bills.length - 2} más
                        </div>
                      )}
                    </div>

                    {/* Indicador de estado al pie */}
                    {cell.bills.length > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        {cell.hasPaid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {cell.hasPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. VISTA 2: AGENDA CRONOLÓGICA (TIMELINE) */}
        {activeTab === 'timeline' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                    <th className="py-3 px-4">Día</th>
                    <th className="py-3 px-4">Compromiso / Servicio</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Estado en {formatMonthLabel(selectedMonth)}</th>
                    <th className="py-3 px-4">Detalle en HomeBudget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                  {bills.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">
                        Día {b.typicalDay}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px]" style={{ backgroundColor: b.color }}>
                            <span className="material-symbols-outlined text-sm">{b.icon}</span>
                          </div>
                          <span>{b.name}</span>
                          {b.isSubscription && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/50">
                              Suscripción
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500 dark:text-zinc-400">
                        {b.category}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-zinc-100">
                        {formatExactCurrency(b.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {b.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                            <span className="material-symbols-outlined text-xs">check</span>
                            <span>Pagado</span>
                          </span>
                        ) : b.status === 'overdue' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/50">
                            <span>Vencido</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                            <span>Pendiente</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                        {b.isPaid ? (
                          <span className="text-emerald-700 dark:text-emerald-300">
                            Pagado {b.paidDate} ({formatExactCurrency(b.paidAmount)})
                          </span>
                        ) : (
                          <span>Sin cobro detectado este mes</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. VISTA 3: RADAR DE SUSCRIPCIONES DIGITALES */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  Radar de Suscripciones Activas
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Total acumulado en servicios de streaming, software y membresías: <strong>${summary.subscriptionsMonthly}/mes</strong> (${summary.subscriptionsAnnual}/año).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewBillForm(p => ({ ...p, isSubscription: true, category: 'Suscripciones' }));
                  setIsNewBillModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>+ Suscripción</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {subscriptionsList.map(sub => (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-purple-400 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-xs" style={{ backgroundColor: sub.color }}>
                          <span className="material-symbols-outlined text-xl">{sub.icon}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                            {sub.name}
                          </h4>
                          <span className="text-[11px] text-slate-400">Cobro el día {sub.typicalDay}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sub.isPaid
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200/50'
                          : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200/50'
                      }`}>
                        {sub.isPaid ? 'Pagado este mes' : 'Pendiente'}
                      </span>
                    </div>

                    <div className="space-y-1.5 my-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Costo Mensual:</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-zinc-100">
                          {formatExactCurrency(sub.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Costo Anual Proyectado:</span>
                        <span className="font-bold font-mono text-purple-600 dark:text-purple-400">
                          {formatCurrency(sub.amount * 12)}/año
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Estado: Activa</span>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold">Monitoreada en HomeBudget</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL DETALLE DE UN DÍA DEL CALENDARIO */}
        {selectedDayDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Compromisos del Día {selectedDayDetail.dayNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {formatMonthLabel(selectedMonth)} • Total del día: {formatExactCurrency(selectedDayDetail.dayTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayDetail(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="space-y-3">
                {selectedDayDetail.bills.map(b => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: b.color }}>
                        <span className="material-symbols-outlined text-sm">{b.icon}</span>
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                          {b.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{b.category}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-xs font-mono text-slate-900 dark:text-zinc-100">
                        {formatExactCurrency(b.amount)}
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        b.isPaid
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        {b.isPaid ? 'Pagado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDayDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CREAR NUEVO COMPROMISO / SUSCRIPCIÓN */}
        {isNewBillModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  Agregar Compromiso o Suscripción
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewBillModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveNewBill} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Nombre del Servicio o Pago
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Netflix, Gimnasio, Seguro..."
                    value={newBillForm.name}
                    onChange={e => setNewBillForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                      Monto Recurrente ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="14.99"
                      value={newBillForm.amount}
                      onChange={e => setNewBillForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                      Día de Cobro (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={newBillForm.typicalDay}
                      onChange={e => setNewBillForm(p => ({ ...p, typicalDay: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={newBillForm.category}
                    onChange={e => setNewBillForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-teal-500"
                  >
                    <option value="Suscripciones">Suscripciones Digitales</option>
                    <option value="Servicios">Servicios Básicos / Utilidades</option>
                    <option value="Inmuebles">Inmuebles / Hipotecas</option>
                    <option value="Educación">Educación / Colegios</option>
                    <option value="Seguros">Seguros & Salud</option>
                    <option value="Varias">Otras Fijas</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isSubCheck"
                    checked={newBillForm.isSubscription}
                    onChange={e => setNewBillForm(p => ({ ...p, isSubscription: e.target.checked }))}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="isSubCheck" className="text-slate-700 dark:text-zinc-300">
                    Incluir en el <strong>Radar de Suscripciones</strong>
                  </label>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewBillModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md shadow-teal-600/20"
                  >
                    Guardar Compromiso
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
