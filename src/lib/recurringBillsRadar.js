/**
 * recurringBillsRadar.js
 * Motor de Compromisos Fijos, Facturas Recurrentes y Radar de Suscripciones.
 * 
 * Gestiona el calendario mensual de pagos, detección de pagos ejecutados en HomeBudget
 * y radar de suscripciones digitales.
 */

export const DEFAULT_BILLS_CATALOG = [
  // 1. Inmuebles e Hipotecas
  {
    id: 'bill_hipoteca_parkave',
    name: 'Hipoteca Park Avenue',
    category: 'Inmuebles',
    subcategories: ['hipoteca - park ave'],
    payeeKeywords: ['park ave', 'hipoteca park ave'],
    typicalDay: 6,
    secondDay: 20, // Biweekly
    amount: 778.00,
    frequency: 'quincenal',
    isSubscription: false,
    color: '#e11d48',
    icon: 'home'
  },
  {
    id: 'bill_hipoteca_4islas',
    name: 'Hipoteca 4 Islas',
    category: 'Inmuebles',
    subcategories: ['hipoteca - 4 islas'],
    payeeKeywords: ['4 islas', 'hipoteca 4 islas'],
    typicalDay: 14,
    amount: 572.41,
    frequency: 'mensual',
    isSubscription: false,
    color: '#e11d48',
    icon: 'apartment'
  },
  {
    id: 'bill_manto_parkave',
    name: 'Mantenimiento HOA Park Ave',
    category: 'Inmuebles',
    subcategories: ['mantenimiento - park ave'],
    payeeKeywords: ['mantenimiento park', 'hoa park ave'],
    typicalDay: 7,
    amount: 394.61,
    frequency: 'mensual',
    isSubscription: false,
    color: '#f59e0b',
    icon: 'domain'
  },
  {
    id: 'bill_manto_4islas',
    name: 'Mantenimiento HOA 4 Islas',
    category: 'Inmuebles',
    subcategories: ['mantenimiento - 4 islas'],
    payeeKeywords: ['mantenimiento 4 islas'],
    typicalDay: 4,
    amount: 82.12,
    frequency: 'mensual',
    isSubscription: false,
    color: '#f59e0b',
    icon: 'domain'
  },

  // 2. Educación
  {
    id: 'bill_escuela_andres',
    name: 'Colegio Andrés',
    category: 'Educación',
    subcategories: ['escuela andres'],
    payeeKeywords: ['escuela andres', 'andres colegio'],
    typicalDay: 23,
    amount: 138.00,
    frequency: 'mensual',
    isSubscription: false,
    color: '#3b82f6',
    icon: 'school'
  },
  {
    id: 'bill_educacion_mateo',
    name: 'Educación Mateo',
    category: 'Educación',
    subcategories: ['educacion mateo'],
    payeeKeywords: ['educacion mateo', 'mateo'],
    typicalDay: 19,
    amount: 217.00,
    frequency: 'mensual',
    isSubscription: false,
    color: '#3b82f6',
    icon: 'backpack'
  },

  // 3. Servicios Básicos / Utilidades
  {
    id: 'bill_electricidad',
    name: 'Electricidad (Naturgy / Ensa)',
    category: 'Servicios',
    subcategories: ['electricidad'],
    payeeKeywords: ['naturgy', 'ensa', 'electricidad'],
    typicalDay: 14,
    amount: 75.00,
    frequency: 'mensual',
    isSubscription: false,
    color: '#eab308',
    icon: 'bolt'
  },
  {
    id: 'bill_agua',
    name: 'Agua & Aseo (IDAAN)',
    category: 'Servicios',
    subcategories: ['agua y aseo', 'idaan 4 islas'],
    payeeKeywords: ['idaan', 'agua'],
    typicalDay: 16,
    amount: 18.22,
    frequency: 'mensual',
    isSubscription: false,
    color: '#06b6d4',
    icon: 'water_drop'
  },
  {
    id: 'bill_telefono_movil',
    name: 'Telecomunicaciones (Tigo / Móvil)',
    category: 'Servicios',
    subcategories: ['teléfono móvil', 'tigo', 'internet'],
    payeeKeywords: ['tigo', 'mas movil', 'claro', 'cable onda'],
    typicalDay: 14,
    amount: 83.38,
    frequency: 'mensual',
    isSubscription: false,
    color: '#0284c7',
    icon: 'cell_tower'
  },

  // 4. Seguros
  {
    id: 'bill_seguro_vida',
    name: 'Seguro de Vida',
    category: 'Seguros',
    subcategories: ['seguro - vida'],
    payeeKeywords: ['seguro vida', 'assat', 'mapfre'],
    typicalDay: 15,
    amount: 23.00,
    frequency: 'mensual',
    isSubscription: false,
    color: '#8b5cf6',
    icon: 'health_and_safety'
  },
  {
    id: 'bill_seguros_tarjetas',
    name: 'Seguros Tarjetas de Crédito',
    category: 'Seguros',
    subcategories: ['seguros - tarjetas'],
    payeeKeywords: ['seguro tarjeta'],
    typicalDay: 26,
    amount: 9.50,
    frequency: 'mensual',
    isSubscription: false,
    color: '#8b5cf6',
    icon: 'credit_card'
  },

  // 5. Suscripciones Digitales & Membresías (Radar)
  {
    id: 'sub_netflix',
    name: 'Netflix',
    category: 'Suscripciones',
    subcategories: ['entretenimiento', 'varias'],
    payeeKeywords: ['netflix'],
    typicalDay: 28,
    amount: 13.99,
    frequency: 'mensual',
    isSubscription: true,
    color: '#e50914',
    icon: 'smart_display',
    logo: 'netflix'
  },
  {
    id: 'sub_spotify',
    name: 'Spotify Family / Premium',
    category: 'Suscripciones',
    subcategories: ['entretenimiento'],
    payeeKeywords: ['spotify'],
    typicalDay: 13,
    amount: 5.99,
    frequency: 'mensual',
    isSubscription: true,
    color: '#1db954',
    icon: 'headphones',
    logo: 'spotify'
  },
  {
    id: 'sub_hbo',
    name: 'Max (HBO Max)',
    category: 'Suscripciones',
    subcategories: ['entretenimiento'],
    payeeKeywords: ['hbo', 'max'],
    typicalDay: 9,
    amount: 2.99,
    frequency: 'mensual',
    isSubscription: true,
    color: '#5822b4',
    icon: 'movie',
    logo: 'hbo'
  },
  {
    id: 'sub_apple',
    name: 'Apple iCloud / Services',
    category: 'Suscripciones',
    subcategories: ['varias', 'otros'],
    payeeKeywords: ['icloud', 'apple music', 'apple.com'],
    typicalDay: 24,
    amount: 6.99,
    frequency: 'mensual',
    isSubscription: true,
    color: '#71717a',
    icon: 'cloud',
    logo: 'apple'
  },
  {
    id: 'sub_chatgpt',
    name: 'ChatGPT Plus (OpenAI)',
    category: 'Suscripciones',
    subcategories: ['varias', 'otros'],
    payeeKeywords: ['chatgpt', 'openai'],
    typicalDay: 29,
    amount: 20.00,
    frequency: 'mensual',
    isSubscription: true,
    color: '#10a37f',
    icon: 'neurology',
    logo: 'openai'
  },
  {
    id: 'sub_disney',
    name: 'Disney+ / Star+',
    category: 'Suscripciones',
    subcategories: ['entretenimiento'],
    payeeKeywords: ['disney', 'star+'],
    typicalDay: 25,
    amount: 5.99,
    frequency: 'mensual',
    isSubscription: true,
    color: '#113ccf',
    icon: 'local_movies',
    logo: 'disney'
  }
];

function clean(str = '') {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Obtiene la lista combinada de compromisos (defaults + customizados de localStorage)
 */
export function getSavedBillsCatalog() {
  try {
    const raw = localStorage.getItem('wealthguide_custom_bills');
    if (!raw) return DEFAULT_BILLS_CATALOG;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.warn('Failed to parse custom bills:', e);
  }
  return DEFAULT_BILLS_CATALOG;
}

export function saveBillsCatalog(catalog = []) {
  try {
    localStorage.setItem('wealthguide_custom_bills', JSON.stringify(catalog));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Cruza las transacciones del mes seleccionado con el catálogo de compromisos
 */
export function evaluateBillsForMonth(selectedMonth, monthTransactions = []) {
  const catalog = getSavedBillsCatalog();
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const currentDay = new Date().getDate();
  const isCurrentActiveMonth = selectedMonth === currentYearMonth;

  // Mapa de gastos del mes para cruce
  const expenses = monthTransactions.filter(t => t.type === 'expense');

  let totalBudgeted = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let subscriptionsCount = 0;
  let subscriptionsMonthly = 0;

  const evaluatedBills = catalog.map(bill => {
    totalBudgeted += bill.amount;
    if (bill.isSubscription) {
      subscriptionsCount++;
      subscriptionsMonthly += bill.amount;
    }

    // Buscar si hay coincidencia en los gastos del mes
    const matchedExpenses = expenses.filter(exp => {
      const subClean = clean(exp.subcategory || '');
      const payeeClean = clean(exp.payee || '');
      const descClean = clean(exp.description || exp.notes || '');

      const matchesSub = (bill.subcategories || []).some(s => subClean.includes(clean(s)));
      const matchesPayee = (bill.payeeKeywords || []).some(k => 
        payeeClean.includes(clean(k)) || descClean.includes(clean(k))
      );

      return matchesSub || matchesPayee;
    });

    const isPaid = matchedExpenses.length > 0;
    const paidAmount = matchedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const lastPaidDate = matchedExpenses.length > 0 ? matchedExpenses[matchedExpenses.length - 1].date : null;

    if (isPaid) {
      totalPaid += (paidAmount > 0 ? paidAmount : bill.amount);
    } else {
      totalPending += bill.amount;
    }

    // Determinar estado de vencimiento
    let status = 'pending'; // 'paid', 'pending', 'overdue', 'upcoming'
    if (isPaid) {
      status = 'paid';
    } else if (isCurrentActiveMonth) {
      if (currentDay > bill.typicalDay + 3) {
        status = 'overdue';
      } else if (currentDay >= bill.typicalDay - 3 && currentDay <= bill.typicalDay) {
        status = 'due_soon';
      } else {
        status = 'pending';
      }
    } else {
      // Mes pasado no pagado = overdue, mes futuro = pending
      status = selectedMonth < currentYearMonth ? 'overdue' : 'pending';
    }

    return {
      ...bill,
      isPaid,
      paidAmount: Math.round(paidAmount * 100) / 100,
      paidDate: lastPaidDate,
      status,
      matchedCount: matchedExpenses.length,
      recentExpense: matchedExpenses[matchedExpenses.length - 1] || null
    };
  });

  // Ordenar por día del mes
  evaluatedBills.sort((a, b) => a.typicalDay - b.typicalDay);

  const completionPct = totalBudgeted > 0 ? (totalPaid / totalBudgeted) * 100 : 0;

  return {
    bills: evaluatedBills,
    summary: {
      totalBudgeted: Math.round(totalBudgeted * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      completionPct: Math.round(completionPct * 10) / 10,
      subscriptionsCount,
      subscriptionsMonthly: Math.round(subscriptionsMonthly * 100) / 100,
      subscriptionsAnnual: Math.round(subscriptionsMonthly * 12 * 100) / 100
    }
  };
}

/**
 * Extrae compromisos que vencen en los próximos X días desde hoy
 */
export function getUpcomingCommitments(evaluatedBills = [], nextDays = 15) {
  const currentDay = new Date().getDate();

  return evaluatedBills
    .map(bill => {
      let daysUntil = bill.typicalDay - currentDay;
      return { ...bill, daysUntil };
    })
    .filter(bill => {
      // Mostrar si no está pagado y cae en la ventana de los próximos X días (o venció recientemente)
      return !bill.isPaid && bill.daysUntil >= -5 && bill.daysUntil <= nextDays;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
