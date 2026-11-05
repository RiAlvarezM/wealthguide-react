/**
 * src/lib/loanProjections.js
 * 
 * Motor de cálculo financiero para hipotecas y préstamos amortizables.
 * Modela la amortización real y proyecta el plazo efectivo y la fecha de liquidación
 * en función del saldo inicial, tiempo inicial, tasa de interés, cuota mensual
 * y abonos extraordinarios a capital.
 */

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Parámetros predeterminados por préstamo
 */
export const LOAN_DEFAULTS = {
  '4islas': {
    name: '4 Islas',
    startDate: '2016-04-01',
    startLabel: 'Abril 2016',
    initialPrincipal: 108000,
    termYears: 30,
    termMonths: 360,
    interestRate: 0.0385, // 3.85% tasa ponderada
    monthlyPayment: 524.41,
    typicalExtraMonthly: 200, // ~$2,400/año en abonos promedio
  },
  'parkavenue': {
    name: 'Park Avenue',
    startDate: '2018-12-01',
    startLabel: 'Diciembre 2018',
    initialPrincipal: 180000,
    termYears: 30,
    termMonths: 360,
    interestRate: 0.0400, // 4.00%
    monthlyPayment: 778.00,
    typicalExtraMonthly: 200,
  }
};

/**
 * Simula la amortización mes a mes a partir de un saldo dado
 * hasta alcanzar balance 0.
 * Retorna número de meses requeridos y total de intereses pagados.
 */
export function simulateAmortizationRemaining(currentBalance, monthlyPayment, annualRate, monthlyExtra = 0) {
  if (currentBalance <= 0) return { months: 0, totalInterest: 0 };
  const r = annualRate / 12;
  const totalPayment = monthlyPayment + monthlyExtra;

  let balance = currentBalance;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600; // límite de seguridad (50 años)

  while (balance > 0.01 && months < maxMonths) {
    const interest = balance * r;
    totalInterest += interest;
    const principal = totalPayment - interest;
    
    // Si la cuota no cubre el interés mensual, no amortiza
    if (principal <= 0) {
      return { months: Infinity, totalInterest: Infinity };
    }

    balance = Math.max(0, balance - principal);
    months++;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100
  };
}

/**
 * Añade un número de meses a una fecha base (YYYY-MM-DD o objeto Date)
 * y retorna string legible 'Mes YYYY'.
 */
export function addMonthsToDate(baseDate, monthsToAdd) {
  const d = new Date(baseDate);
  const totalMonths = d.getMonth() + monthsToAdd;
  const newYear = d.getFullYear() + Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;
  return {
    year: newYear,
    monthNum: newMonth + 1,
    label: `${MONTH_NAMES[newMonth]} ${newYear}`,
    isoDate: `${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`
  };
}

/**
 * Calcula todas las proyecciones y reducciones de plazo para un préstamo.
 */
export function calculateLoanProjections({
  startDate = '2016-04-01',
  termYears = 30,
  termMonths = 360,
  initialPrincipal = 108000,
  interestRate = 0.0385,
  monthlyPayment = 524.41,
  currentBalance = 52469.68,
  customExtraMonthly = 0,
  asOfDate = new Date()
}) {
  const start = new Date(startDate);
  const now = new Date(asOfDate);

  // 1. Tiempo transcurrido
  const elapsedMonths = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  const elapsedYears = parseFloat((elapsedMonths / 12).toFixed(1));

  // 2. Vencimiento contractual original (a 30 años)
  const originalEnd = addMonthsToDate(startDate, termMonths);

  // 3. Escenario Base: Sin más abonos extraordinarios (solo cuota regular)
  const simBase = simulateAmortizationRemaining(currentBalance, monthlyPayment, interestRate, 0);
  const remainingMonthsBase = simBase.months;
  const remainingYearsBase = parseFloat((remainingMonthsBase / 12).toFixed(1));
  const effectiveTotalMonthsBase = elapsedMonths + remainingMonthsBase;
  const effectiveTermYearsBase = parseFloat((effectiveTotalMonthsBase / 12).toFixed(1));
  const monthsSavedBase = Math.max(0, termMonths - effectiveTotalMonthsBase);
  const yearsSavedBase = parseFloat((monthsSavedBase / 12).toFixed(1));
  const projectedEndBase = addMonthsToDate(now, remainingMonthsBase);

  // 4. Escenario con Abono Extraactivo / Simulado
  const extraToApply = customExtraMonthly > 0 ? customExtraMonthly : 200;
  const simActive = simulateAmortizationRemaining(currentBalance, monthlyPayment, interestRate, extraToApply);
  const remainingMonthsActive = simActive.months;
  const remainingYearsActive = parseFloat((remainingMonthsActive / 12).toFixed(1));
  const effectiveTotalMonthsActive = elapsedMonths + remainingMonthsActive;
  const effectiveTermYearsActive = parseFloat((effectiveTotalMonthsActive / 12).toFixed(1));
  const monthsSavedActive = Math.max(0, termMonths - effectiveTotalMonthsActive);
  const yearsSavedActive = parseFloat((monthsSavedActive / 12).toFixed(1));
  const projectedEndActive = addMonthsToDate(now, remainingMonthsActive);

  // 5. Ahorro de intereses proyectado
  // Comparativa de interés restante base vs interés con extra
  const interestSavedVsBase = Math.max(0, simBase.totalInterest - simActive.totalInterest);
  
  // Estimación de intereses teóricos que se habrían pagado en los 30 años completos
  const simOriginal30y = simulateAmortizationRemaining(initialPrincipal, monthlyPayment, interestRate, 0);
  const totalInterestAvoided = Math.max(0, simOriginal30y.totalInterest - simActive.totalInterest);

  return {
    startDate,
    startLabel: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`,
    originalTermYears: termYears,
    originalTermMonths: termMonths,
    originalEndDate: originalEnd.label,
    originalIsoDate: originalEnd.isoDate,

    elapsedMonths,
    elapsedYears,
    progressOriginalPct: Math.min(100, Math.round((elapsedMonths / termMonths) * 100)),

    // Escenario Base (solo cuota regular de aquí en adelante)
    base: {
      remainingMonths: remainingMonthsBase,
      remainingYears: remainingYearsBase,
      effectiveTermMonths: effectiveTotalMonthsBase,
      effectiveTermYears: effectiveTermYearsBase,
      monthsSaved: monthsSavedBase,
      yearsSaved: yearsSavedBase,
      projectedEndDate: projectedEndBase.label,
      projectedIsoDate: projectedEndBase.isoDate,
      futureInterestToPay: simBase.totalInterest,
    },

    // Escenario Activo / Simulado (con abonos extraordinarios mensuales)
    active: {
      extraMonthly: extraToApply,
      remainingMonths: remainingMonthsActive,
      remainingYears: remainingYearsActive,
      effectiveTermMonths: effectiveTotalMonthsActive,
      effectiveTermYears: effectiveTermYearsActive,
      monthsSaved: monthsSavedActive,
      yearsSaved: yearsSavedActive,
      projectedEndDate: projectedEndActive.label,
      projectedIsoDate: projectedEndActive.isoDate,
      futureInterestToPay: simActive.totalInterest,
      interestSavedVsBase,
      totalInterestAvoided,
    }
  };
}
