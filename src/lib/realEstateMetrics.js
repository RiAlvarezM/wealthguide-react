/**
 * realEstateMetrics.js
 * Motor de Cálculo Financiero y Métricas Inmobiliarias para WealthGuide.
 * 
 * Calcula:
 *  - Equity Neto = Valor de Avalúo - Saldo Hipotecario
 *  - LTV (Loan-to-Value) y % de Capital Propio
 *  - Cash Flow Mensual = Ingreso Alquiler - (Hipoteca + Mantenimiento + Seguro/Otros)
 *  - Gross Rental Yield (%) = (Alquiler Anual / Valor de Avalúo) * 100
 *  - Net Cap Rate (%) = (NOI Anual / Valor de Avalúo) * 100
 *  - Desglose de flujo histórico por propiedad a partir de transacciones reales
 */

// Mapeo entre propiedades y nombres de préstamos/cuentas y subcategorías de HomeBudget
export const PROPERTY_CONFIG = {
  '4-islas': {
    id: '4-islas',
    name: '4 Islas',
    fullName: 'PH 4 Islas - Apto.',
    type: 'investment', // 'investment' | 'residence'
    typeLabel: 'Inversión / Renta',
    typeIcon: 'real_estate_agent',
    typeBadgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/50',
    loanAccountName: '4 Islas',
    defaultAppraisalValue: 120000,
    appraisalDate: '2016-05-01',
    keywords: ['4 islas', 'islas', 'ph 4 islas'],
    expenseSubcategories: {
      mortgage: ['hipoteca - 4 islas'],
      maintenance: ['mantenimiento - 4 islas'],
      other: ['varias - 4 islas', 'seguro - 4 islas']
    },
    // Renta mensual configurada / estimada si no hay en el mes activo
    targetRent: 650,
  },
  'park-avenue': {
    id: 'park-avenue',
    name: 'Park Avenue',
    fullName: 'PH Park Avenue - Residencia',
    type: 'residence',
    typeLabel: 'Residencia Familiar',
    typeIcon: 'home',
    typeBadgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/50',
    loanAccountName: 'Park Avenue',
    defaultAppraisalValue: 224900,
    appraisalDate: '2018-12-01',
    keywords: ['park ave', 'park avenue', 'ph park avenue'],
    expenseSubcategories: {
      mortgage: ['hipoteca - park ave'],
      maintenance: ['mantenimiento - park ave'],
      other: ['park ave varios', 'seguro - park ave']
    },
    targetRent: 0,
  }
};

/**
 * Normaliza cadenas para comparaciones flexibles
 */
function clean(str = '') {
  return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Encuentra el préstamo en accounts que corresponde a la propiedad
 */
export function findMortgageForProperty(propertyName, accounts = []) {
  const pClean = clean(propertyName);
  return accounts.find(acc => {
    if (acc.category !== 'prestamos') return false;
    const aClean = clean(acc.name);
    return aClean.includes(pClean) || pClean.includes(aClean);
  }) || null;
}

/**
 * Extrae y calcula los flujos mensuales de una propiedad a partir de transacciones de HomeBudget
 */
export function computePropertyCashFlowHistory(propertyKey, allExpenses = [], allIncomes = []) {
  const cfg = PROPERTY_CONFIG[propertyKey];
  if (!cfg) return { monthly: {}, transactions: [] };

  const mortgageSubs = (cfg.expenseSubcategories.mortgage || []).map(clean);
  const maintSubs = (cfg.expenseSubcategories.maintenance || []).map(clean);
  const otherSubs = (cfg.expenseSubcategories.other || []).map(clean);
  const propKeywords = cfg.keywords.map(clean);

  const matchedTx = [];
  const monthly = {};

  function ensureMonth(m) {
    if (!monthly[m]) {
      monthly[m] = {
        month: m,
        rentIncome: 0,
        mortgageExpense: 0,
        maintenanceExpense: 0,
        otherExpense: 0,
        totalExpenses: 0,
        netCashFlow: 0,
        txCount: 0
      };
    }
    return monthly[m];
  }

  // 1. Filtrar gastos
  for (const exp of allExpenses) {
    const subClean = clean(exp.subcategory || '');
    const descClean = clean(exp.description || exp.notes || exp.payee || '');
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) continue;

    let expenseType = null;
    if (mortgageSubs.some(s => subClean.includes(s))) {
      expenseType = 'mortgage';
    } else if (maintSubs.some(s => subClean.includes(s))) {
      expenseType = 'maintenance';
    } else if (otherSubs.some(s => subClean.includes(s)) || propKeywords.some(k => descClean.includes(k))) {
      expenseType = 'other';
    }

    if (expenseType) {
      const m = exp.date.slice(0, 7);
      const row = ensureMonth(m);
      if (expenseType === 'mortgage') row.mortgageExpense += amount;
      else if (expenseType === 'maintenance') row.maintenanceExpense += amount;
      else row.otherExpense += amount;

      row.totalExpenses += amount;
      row.txCount++;
      matchedTx.push({
        id: exp.id,
        date: exp.date,
        type: 'expense',
        subtype: expenseType,
        description: exp.subcategory || exp.category,
        detail: exp.notes || exp.payee,
        amount
      });
    }
  }

  // 2. Filtrar ingresos por alquiler
  for (const inc of allIncomes) {
    const amount = Number(inc.amount) || 0;
    if (amount <= 0) continue;
    const descClean = clean(inc.description || '');
    const notesClean = clean(inc.notes || '');
    const isAlquiler = descClean.includes('alquiler') || descClean.includes('renta');

    if (!isAlquiler) continue;

    // Si es 4 Islas (nuestra principal inversión en renta):
    // El alquiler de 4 Islas típicamente es de $650 a $750 (o notes dicen 4 islas).
    // Si la propiedad evaluada es 4-islas y el ingreso es de alquiler general:
    let isMatch = false;
    if (propertyKey === '4-islas') {
      if (notesClean.includes('4 islas') || notesClean.includes('islas')) {
        isMatch = true;
      } else if (!notesClean.includes('park') && amount <= 850) {
        // Alquiler habitual de 4 Islas
        isMatch = true;
      }
    } else if (propertyKey === 'park-avenue') {
      if (notesClean.includes('park') || amount > 850) {
        // En caso de que Park Ave tuviera algún ingreso de renta esporádico
        isMatch = true;
      }
    }

    if (isMatch) {
      const m = inc.date.slice(0, 7);
      const row = ensureMonth(m);
      row.rentIncome += amount;
      row.txCount++;
      matchedTx.push({
        id: inc.id,
        date: inc.date,
        type: 'income',
        subtype: 'rent',
        description: 'Alquiler Percibido',
        detail: inc.notes || inc.account,
        amount
      });
    }
  }

  // Redondear y calcular cash flow neto por mes
  for (const m of Object.keys(monthly)) {
    const row = monthly[m];
    row.rentIncome = Math.round(row.rentIncome * 100) / 100;
    row.mortgageExpense = Math.round(row.mortgageExpense * 100) / 100;
    row.maintenanceExpense = Math.round(row.maintenanceExpense * 100) / 100;
    row.otherExpense = Math.round(row.otherExpense * 100) / 100;
    row.totalExpenses = Math.round(row.totalExpenses * 100) / 100;
    row.netCashFlow = Math.round((row.rentIncome - row.totalExpenses) * 100) / 100;
  }

  // Ordenar transacciones de más reciente a más antigua
  matchedTx.sort((a, b) => b.date.localeCompare(a.date));

  return { monthly, transactions: matchedTx };
}

/**
 * Computa la Ficha Integral Completa para una Propiedad
 */
export function buildPropertyProfile(propData, accounts = [], allExpenses = [], allIncomes = []) {
  const propertyKey = clean(propData.name).includes('islas') ? '4-islas' : 'park-avenue';
  const cfg = PROPERTY_CONFIG[propertyKey] || {
    id: propData.id,
    name: propData.name,
    fullName: propData.name,
    type: 'investment',
    typeLabel: 'Inmueble',
    typeIcon: 'apartment',
    typeBadgeColor: 'bg-slate-100 text-slate-700',
    targetRent: 0
  };

  const propertyValue = Number(propData.value) || cfg.defaultAppraisalValue || 0;
  const appraisalDate = propData.appraisalDate || cfg.appraisalDate || '—';

  // Vincular hipoteca
  const mortgageAccount = findMortgageForProperty(propData.name, accounts);
  const mortgageBalance = mortgageAccount ? Number(mortgageAccount.amount) || 0 : 0;

  // Métricas de Capital
  const equity = Math.max(0, propertyValue - mortgageBalance);
  const equityPct = propertyValue > 0 ? (equity / propertyValue) * 100 : 0;
  const ltv = propertyValue > 0 ? (mortgageBalance / propertyValue) * 100 : 0;

  // Estado de apalancamiento
  let ltvStatus = { label: 'Excelente (<50%)', color: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' };
  if (ltv > 75) {
    ltvStatus = { label: 'Elevado (>75%)', color: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300' };
  } else if (ltv > 50) {
    ltvStatus = { label: 'Moderado (50-75%)', color: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' };
  }

  // Flujo histórico desde HomeBudget
  const { monthly, transactions } = computePropertyCashFlowHistory(propertyKey, allExpenses, allIncomes);

  // Calcular promedios representativos de los últimos 6 meses activos
  const recentMonths = Object.keys(monthly).sort().slice(-6);
  let avgRent = 0;
  let avgMortgage = 0;
  let avgMaint = 0;
  let avgNetFlow = 0;

  if (recentMonths.length > 0) {
    const sumRent = recentMonths.reduce((acc, m) => acc + monthly[m].rentIncome, 0);
    const sumMortgage = recentMonths.reduce((acc, m) => acc + monthly[m].mortgageExpense, 0);
    const sumMaint = recentMonths.reduce((acc, m) => acc + monthly[m].maintenanceExpense, 0);
    const sumNet = recentMonths.reduce((acc, m) => acc + monthly[m].netCashFlow, 0);

    avgRent = Math.round((sumRent / recentMonths.length) * 100) / 100;
    avgMortgage = Math.round((sumMortgage / recentMonths.length) * 100) / 100;
    avgMaint = Math.round((sumMaint / recentMonths.length) * 100) / 100;
    avgNetFlow = Math.round((sumNet / recentMonths.length) * 100) / 100;
  } else {
    avgRent = cfg.targetRent || 0;
  }

  // Métricas de Rendimiento Inmobiliario (Anualizadas)
  const annualRent = avgRent * 12;
  const grossYield = propertyValue > 0 ? (annualRent / propertyValue) * 100 : 0;
  const annualNOI = Math.max(0, (avgRent - avgMaint) * 12); // Net Operating Income (sin servicio de deuda)
  const capRate = propertyValue > 0 ? (annualNOI / propertyValue) * 100 : 0;
  const annualNetCashFlow = avgNetFlow * 12;
  const cashOnCash = equity > 0 ? (annualNetCashFlow / equity) * 100 : 0;

  // Autofinanciabilidad
  const isSelfFinancing = avgRent >= (avgMortgage + avgMaint) || (cfg.type === 'investment' && Math.abs(avgNetFlow) < 15);

  return {
    id: propData.id || cfg.id,
    key: propertyKey,
    name: propData.name,
    fullName: cfg.fullName,
    type: cfg.type,
    typeLabel: cfg.typeLabel,
    typeIcon: cfg.typeIcon,
    typeBadgeColor: cfg.typeBadgeColor,
    propertyValue,
    appraisalDate,
    mortgageAccount,
    mortgageBalance,
    equity,
    equityPct,
    ltv,
    ltvStatus,
    cashFlow: {
      avgRent,
      avgMortgage,
      avgMaint,
      avgNetFlow,
      annualRent,
      annualNetCashFlow,
      grossYield,
      capRate,
      cashOnCash,
      isSelfFinancing
    },
    monthlyHistory: monthly,
    recentMonths: recentMonths.map(m => monthly[m]),
    recentTransactions: transactions.slice(0, 15)
  };
}

/**
 * Computa el Portafolio Inmobiliario Consolidado
 */
export function buildRealEstatePortfolio(properties = [], accounts = [], allExpenses = [], allIncomes = []) {
  // Asegurar que al menos tengamos 4 Islas y Park Avenue si properties de Firestore aún no tiene ambas
  let effectiveProps = [...properties];
  const has4Islas = effectiveProps.some(p => clean(p.name).includes('islas'));
  const hasParkAve = effectiveProps.some(p => clean(p.name).includes('park'));

  if (!has4Islas) {
    effectiveProps.push({
      id: 'prop_4islas',
      name: '4 Islas',
      value: 120000,
      appraisalDate: '2016-05-01'
    });
  }
  if (!hasParkAve) {
    effectiveProps.push({
      id: 'prop_parkave',
      name: 'Park Avenue',
      value: 224900,
      appraisalDate: '2018-12-01'
    });
  }

  const profiles = effectiveProps.map(prop =>
    buildPropertyProfile(prop, accounts, allExpenses, allIncomes)
  );

  let totalValue = 0;
  let totalMortgage = 0;
  let totalEquity = 0;
  let totalMonthlyRent = 0;
  let totalMonthlyMortgage = 0;
  let totalMonthlyMaint = 0;
  let totalMonthlyCashFlow = 0;

  for (const p of profiles) {
    totalValue += p.propertyValue;
    totalMortgage += p.mortgageBalance;
    totalEquity += p.equity;
    totalMonthlyRent += p.cashFlow.avgRent;
    totalMonthlyMortgage += p.cashFlow.avgMortgage;
    totalMonthlyMaint += p.cashFlow.avgMaint;
    totalMonthlyCashFlow += p.cashFlow.avgNetFlow;
  }

  const portfolioLtv = totalValue > 0 ? (totalMortgage / totalValue) * 100 : 0;
  const portfolioEquityPct = totalValue > 0 ? (totalEquity / totalValue) * 100 : 0;
  const portfolioGrossYield = totalValue > 0 ? ((totalMonthlyRent * 12) / totalValue) * 100 : 0;

  return {
    profiles,
    totalValue: Math.round(totalValue * 100) / 100,
    totalMortgage: Math.round(totalMortgage * 100) / 100,
    totalEquity: Math.round(totalEquity * 100) / 100,
    portfolioLtv: Math.round(portfolioLtv * 10) / 10,
    portfolioEquityPct: Math.round(portfolioEquityPct * 10) / 10,
    portfolioGrossYield: Math.round(portfolioGrossYield * 10) / 10,
    totalMonthlyRent: Math.round(totalMonthlyRent * 100) / 100,
    totalMonthlyMortgage: Math.round(totalMonthlyMortgage * 100) / 100,
    totalMonthlyMaint: Math.round(totalMonthlyMaint * 100) / 100,
    totalMonthlyCashFlow: Math.round(totalMonthlyCashFlow * 100) / 100,
    propertiesCount: profiles.length
  };
}
