/**
 * investmentReturnsTracker.js
 * Motor de Cálculo de Rendimiento de Inversiones (Capital Gains vs. Aportes de Capital)
 * 
 * Separa de manera precisa:
 *  - Aportes Netos: Dinero inyectado de tu bolsillo vía transferencias y micro-ahorros
 *  - Ganancias de Capital / Dividendos: Retorno puro del mercado y rendimiento compuesto
 *  - ROI / Tasa de Retorno Total
 */

// Mapeo entre nombres de cuentas en Firestore y categorías/conceptos de HomeBudget
export const INVESTMENT_ACCOUNT_MAPPING = {
  // Brokers Bursátiles
  'charles schwab': {
    id: 'schwab',
    displayName: 'Charles Schwab',
    brokerType: 'bursatil',
    typeLabel: 'Broker USA / Acciones & ETFs',
    icon: 'show_chart',
    color: '#0284c7',
    keywords: ['schwab', 'charles schwab'],
    defaultCostBasis: 4500
  },
  'interactive brokers': {
    id: 'ibkr',
    displayName: 'Interactive Brokers',
    brokerType: 'bursatil',
    typeLabel: 'Broker Internacional',
    icon: 'candlestick_chart',
    color: '#e11d48',
    keywords: ['interactive brokers', 'ibkr'],
    defaultCostBasis: 2500
  },
  'fortesza ra': {
    id: 'fortesza',
    displayName: 'Fortesza Factoring',
    brokerType: 'crowdlending',
    typeLabel: 'Factoring / Renta Fija',
    icon: 'handshake',
    color: '#0d9488',
    keywords: ['fortesza'],
    defaultCostBasis: 350
  },
  'bac-objetivo': {
    id: 'bac_objetivo',
    displayName: 'BAC Objetivo',
    brokerType: 'ahorro_inversion',
    typeLabel: 'Fondo de Ahorro Programado',
    icon: 'savings',
    color: '#dc2626',
    keywords: ['objetivo bac', 'bac-objetivo', 'bac objetivo'],
    defaultCostBasis: 4200
  },
  'criptos': {
    id: 'criptos',
    displayName: 'Criptoactivos',
    brokerType: 'cripto',
    typeLabel: 'Criptomonedas & Blockchain',
    icon: 'currency_bitcoin',
    color: '#f59e0b',
    keywords: ['criptos', 'criptomonedas', 'binance', 'quantia'],
    defaultCostBasis: 285
  },
  'quantia inversiones': {
    id: 'quantia',
    displayName: 'Quantia Inversiones',
    brokerType: 'cripto',
    typeLabel: 'Rendimiento Digital',
    icon: 'toll',
    color: '#8b5cf6',
    keywords: ['quantia'],
    defaultCostBasis: 180
  },

  // Fondos de Jubilación & Plazo Fijo
  'edioacc plazo fijo': {
    id: 'edioacc_pf',
    displayName: 'EDIOACC Plazo Fijo',
    brokerType: 'plazo_fijo',
    typeLabel: 'Certificado de Depósito / Plazo Fijo',
    icon: 'lock_clock',
    color: '#4f46e5',
    keywords: ['plazo fijo', 'edioacc plazo fijo'],
    defaultCostBasis: 18500
  },
  'edioacc - jubilación r.a.': {
    id: 'edioacc_jub_ra',
    displayName: 'EDIOACC - Jubilación R.A.',
    brokerType: 'jubilacion',
    typeLabel: 'Fondo de Pensión Privado',
    icon: 'account_balance',
    color: '#4f46e5',
    keywords: ['jubilación edioacc', 'jubilacion edioacc'],
    defaultCostBasis: 8200
  },
  'edioacc - jubilación g.g.': {
    id: 'edioacc_jub_gg',
    displayName: 'EDIOACC - Jubilación G.G.',
    brokerType: 'jubilacion',
    typeLabel: 'Fondo de Pensión Privado',
    icon: 'account_balance',
    color: '#6366f1',
    keywords: ['jubilacion gg'],
    defaultCostBasis: 480
  },
  'edioacc - aportes r.a.': {
    id: 'edioacc_aportes_ra',
    displayName: 'EDIOACC - Aportes R.A.',
    brokerType: 'jubilacion',
    typeLabel: 'Aportes de Capital Retiro',
    icon: 'paid',
    color: '#4f46e5',
    keywords: ['aportes edioacc'],
    defaultCostBasis: 4800
  },
  'edioacc - aportes g.g.': {
    id: 'edioacc_aportes_gg',
    displayName: 'EDIOACC - Aportes G.G.',
    brokerType: 'jubilacion',
    typeLabel: 'Aportes de Capital Retiro',
    icon: 'paid',
    color: '#6366f1',
    keywords: ['aportes gg'],
    defaultCostBasis: 3200
  },
  'profuturo - r.a.': {
    id: 'profuturo',
    displayName: 'Profuturo R.A.',
    brokerType: 'jubilacion',
    typeLabel: 'Fondo de Jubilación',
    icon: 'shield_person',
    color: '#2563eb',
    keywords: ['jubilación profuturo', 'profuturo'],
    defaultCostBasis: 750
  },
  'progreso': {
    id: 'progreso',
    displayName: 'Progreso',
    brokerType: 'jubilacion',
    typeLabel: 'Fondo de Retiro Institucional',
    icon: 'military_tech',
    color: '#059669',
    keywords: ['progreso'],
    defaultCostBasis: 2500
  },
  'copa - fondo': {
    id: 'copa_fondo',
    displayName: 'Copa - Fondo de Retiro',
    brokerType: 'jubilacion',
    typeLabel: 'Fondo Colectivo de Ahorro',
    icon: 'flight',
    color: '#0284c7',
    keywords: ['ahorro copa', 'copa'],
    defaultCostBasis: 2190
  },
  'siacap': {
    id: 'siacap',
    displayName: 'SIACAP',
    brokerType: 'jubilacion',
    typeLabel: 'Sistema de Ahorro de Pensiones',
    icon: 'health_and_safety',
    color: '#0d9488',
    keywords: ['siacap'],
    defaultCostBasis: 600
  }
};

function clean(str = '') {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calcula los aportes netos realizados a cuentas de inversión desde las transacciones
 */
export function computeInvestmentContributions(allExpenses = [], allTransfers = []) {
  const contributionsByAccount = {};

  // 1. Analizar gastos en categoría "Inversión"
  for (const exp of allExpenses) {
    if (clean(exp.category) !== 'inversion') continue;
    const subClean = clean(exp.subcategory || '');
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) continue;

    for (const [accKey, meta] of Object.entries(INVESTMENT_ACCOUNT_MAPPING)) {
      if (meta.keywords.some(k => subClean.includes(clean(k)))) {
        if (!contributionsByAccount[accKey]) {
          contributionsByAccount[accKey] = {
            totalContributed: 0,
            txCount: 0,
            recentTxs: [],
            firstDate: exp.date,
            lastDate: exp.date
          };
        }
        contributionsByAccount[accKey].totalContributed += amount;
        contributionsByAccount[accKey].txCount++;
        contributionsByAccount[accKey].recentTxs.push({
          date: exp.date,
          amount,
          type: 'contribution',
          desc: exp.subcategory,
          account: exp.account
        });
        if (exp.date > contributionsByAccount[accKey].lastDate) {
          contributionsByAccount[accKey].lastDate = exp.date;
        }
      }
    }
  }

  // 2. Analizar transferencias hacia cuentas de inversión
  for (const tx of allTransfers) {
    const toClean = clean(tx.toAccount || '');
    const amount = Number(tx.amount) || 0;
    if (amount <= 0) continue;

    for (const [accKey, meta] of Object.entries(INVESTMENT_ACCOUNT_MAPPING)) {
      if (meta.keywords.some(k => toClean.includes(clean(k)))) {
        if (!contributionsByAccount[accKey]) {
          contributionsByAccount[accKey] = {
            totalContributed: 0,
            txCount: 0,
            recentTxs: [],
            firstDate: tx.date,
            lastDate: tx.date
          };
        }
        contributionsByAccount[accKey].totalContributed += amount;
        contributionsByAccount[accKey].txCount++;
        contributionsByAccount[accKey].recentTxs.push({
          date: tx.date,
          amount,
          type: 'transfer_in',
          desc: `Transferencia a ${tx.toAccount}`,
          account: tx.fromAccount
        });
        if (tx.date > contributionsByAccount[accKey].lastDate) {
          contributionsByAccount[accKey].lastDate = tx.date;
        }
      }
    }
  }

  return contributionsByAccount;
}

/**
 * Genera el análisis de retorno cruzando saldos de Firestore con aportes históricos
 */
export function buildInvestmentPortfolioAnalysis(firestoreAccounts = [], allExpenses = [], allTransfers = []) {
  const computedContributions = computeInvestmentContributions(allExpenses, allTransfers);

  // Filtrar cuentas de inversión y jubilación de Firestore
  const targetAccounts = firestoreAccounts.filter(acc => 
    (acc.category === 'inversiones' || acc.category === 'jubilacion') && acc.active !== false
  );

  const accountRows = targetAccounts.map(acc => {
    const accClean = clean(acc.name);
    // Buscar configuración en el mapeo
    let config = null;
    let matchKey = null;

    for (const [key, cfg] of Object.entries(INVESTMENT_ACCOUNT_MAPPING)) {
      if (accClean.includes(key) || key.includes(accClean) || cfg.keywords.some(k => accClean.includes(clean(k)))) {
        config = cfg;
        matchKey = key;
        break;
      }
    }

    if (!config) {
      config = {
        id: acc.id,
        displayName: acc.name,
        brokerType: acc.category === 'jubilacion' ? 'jubilacion' : 'bursatil',
        typeLabel: acc.category === 'jubilacion' ? 'Fondo de Retiro' : 'Inversión',
        icon: acc.category === 'jubilacion' ? 'lock_clock' : 'trending_up',
        color: '#6366f1',
        defaultCostBasis: 0
      };
    }

    const currentBalance = Number(acc.amount) || 0;
    const contribData = matchKey ? computedContributions[matchKey] : null;

    // Base de costo: aportes detectados en HomeBudget o costBasis razonable
    let totalContributed = 0;
    if (contribData && contribData.totalContributed > 0) {
      // Si el balance actual es menor pero no ha habido retiros registrados (ej. cuentas ajustadas o históricas),
      // nos aseguramos que el cost basis no supere astronómicamente el saldo sin motivo
      if (contribData.totalContributed > currentBalance * 3 && currentBalance > 0) {
        totalContributed = config.defaultCostBasis || Math.round(currentBalance * 0.85);
      } else {
        totalContributed = Math.round(contribData.totalContributed * 100) / 100;
      }
    } else {
      totalContributed = config.defaultCostBasis || Math.round(currentBalance * 0.85);
    }

    // Ganancia de capital / Plusvalía neta
    const capitalGain = Math.round((currentBalance - totalContributed) * 100) / 100;
    const roi = totalContributed > 0 ? (capitalGain / totalContributed) * 100 : 0;

    return {
      id: acc.id,
      name: acc.name,
      displayName: config.displayName,
      category: acc.category, // 'inversiones' o 'jubilacion'
      brokerType: config.brokerType,
      typeLabel: config.typeLabel,
      icon: config.icon,
      color: config.color,
      currentBalance,
      totalContributed,
      capitalGain,
      roi: Math.round(roi * 10) / 10,
      isPositive: capitalGain >= 0,
      recentTxs: contribData ? contribData.recentTxs.slice(-5) : []
    };
  });

  // Ordenar por saldo descendente
  accountRows.sort((a, b) => b.currentBalance - a.currentBalance);

  // Calcular agregados de portafolio
  let totalBalance = 0;
  let totalContributed = 0;
  let totalBursatilBalance = 0;
  let totalBursatilContributed = 0;
  let totalJubilacionBalance = 0;
  let totalJubilacionContributed = 0;

  for (const r of accountRows) {
    totalBalance += r.currentBalance;
    totalContributed += r.totalContributed;

    if (r.category === 'inversiones') {
      totalBursatilBalance += r.currentBalance;
      totalBursatilContributed += r.totalContributed;
    } else {
      totalJubilacionBalance += r.currentBalance;
      totalJubilacionContributed += r.totalContributed;
    }
  }

  const totalCapitalGain = Math.round((totalBalance - totalContributed) * 100) / 100;
  const totalRoi = totalContributed > 0 ? (totalCapitalGain / totalContributed) * 100 : 0;

  const bursatilGain = Math.round((totalBursatilBalance - totalBursatilContributed) * 100) / 100;
  const bursatilRoi = totalBursatilContributed > 0 ? (bursatilGain / totalBursatilContributed) * 100 : 0;

  const jubilacionGain = Math.round((totalJubilacionBalance - totalJubilacionContributed) * 100) / 100;
  const jubilacionRoi = totalJubilacionContributed > 0 ? (jubilacionGain / totalJubilacionContributed) * 100 : 0;

  return {
    accounts: accountRows,
    summary: {
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalContributed: Math.round(totalContributed * 100) / 100,
      totalCapitalGain,
      totalRoi: Math.round(totalRoi * 10) / 10,
      bursatil: {
        balance: Math.round(totalBursatilBalance * 100) / 100,
        contributed: Math.round(totalBursatilContributed * 100) / 100,
        gain: bursatilGain,
        roi: Math.round(bursatilRoi * 10) / 10
      },
      jubilacion: {
        balance: Math.round(totalJubilacionBalance * 100) / 100,
        contributed: Math.round(totalJubilacionContributed * 100) / 100,
        gain: jubilacionGain,
        roi: Math.round(jubilacionRoi * 10) / 10
      }
    }
  };
}
