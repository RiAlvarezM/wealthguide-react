/**
 * accountReconciliation.js
 * Motor de Conciliación Automática entre el Flujo Diario (HomeBudget)
 * y los Saldos Patrimoniales (Firestore `accounts`).
 * 
 * Calcula para cada cuenta:
 *   Saldo Inicial + Entradas (Ingresos + Traspasos In) - Salidas (Gastos + Traspasos Out) = Saldo Estimado
 */

import { isInvestmentAccount } from './accountClassification';

// Mapeo normalizado entre nombres de HomeBudget y Firestore `accounts`
export const HB_TO_FIRESTORE_ACCOUNT_MAP = {
  // Cuentas Bancarias / Ahorro / Liquidez
  'bac': 'BAC - Ahorro',
  'bac - ahorro': 'BAC - Ahorro',
  'bg-ahorroflia': 'Bco General - Ahorro RyG',
  'bco general - ahorro ryg': 'Bco General - Ahorro RyG',
  'bg-ahorroricardo': 'Bco General - Ahorro RyG',
  'bg-ahorrograciela': 'Bco General - Ahorro G.G.',
  'bco general - ahorro g.g.': 'Bco General - Ahorro G.G.',
  'edioacc-ahorroricardo': 'EDIOACC - Ahorro R.A.',
  'edioacc - ahorro r.a.': 'EDIOACC - Ahorro R.A.',
  'edioacc-ahorrograciela': 'EDIOACC - Ahorro G.G.',
  'edioacc - ahorro g.g.': 'EDIOACC - Ahorro G.G.',
  'global-emergencia': 'Global Bank - Ahorro (Tap + Ahorro)',
  'global-flia': 'Global Bank - Ahorro (Tap + Ahorro)',
  'global tap': 'Global Bank - Ahorro (Tap + Ahorro)',
  'global bank - ahorro (tap + ahorro)': 'Global Bank - Ahorro (Tap + Ahorro)',
  'global online': 'Global Online',
  'global online gg': 'Global Online',
  'global cashback': 'Global Bank - Ahorro (Tap + Ahorro)',
  'nequi': 'Nequi',
  'banesco': 'Banesco',

  // Tarjetas de Crédito / Deuda de Consumo
  'bac smartcash': 'BAC - Visa Smartcash',
  'bac - visa smartcash': 'BAC - Visa Smartcash',
  'bac - amex': 'BAC - Visa Smartcash',
  'bac - mastercard': 'BAC - Visa Smartcash',
  'global mc black': 'Global MC - Ricardo',
  'global mc - ricardo': 'Global MC - Ricardo',
  'global link - ricardo': 'Global MC - Ricardo',
  'global unica': 'Global TC - Graciela',
  'global link - graciela': 'Global TC - Graciela',
  'global tc - graciela': 'Global TC - Graciela',
  'mc - banesco': 'Banesco - MC Travel',
  'banesco - mc travel': 'Banesco - MC Travel',
  'visa estrellas': 'Banesco - MC Travel',

  // Inversiones
  'schwab': 'Charles Schwab',
  'charles schwab': 'Charles Schwab',
  'fortesza': 'Fortesza RA',
  'fortesza ra': 'Fortesza RA',
  'mmg': 'MMG',
  'interactive brokers': 'Interactive Brokers',
  'criptomonedas': 'Criptos',
  'criptos': 'Criptos',
  'paullier': 'Paullier Online',
  'miangel': 'Fortesza RA',
  'bac-objetivo': 'BAC-Objetivo',
  'objetivo bac': 'BAC-Objetivo',

  // Jubilación
  'jubilación edioacc': 'EDIOACC - Jubilación R.A.',
  'jubilacion edioacc': 'EDIOACC - Jubilación R.A.',
  'aportes edioacc': 'EDIOACC - Aportes R.A.',
  'jubilación profuturo': 'Profuturo - R.A.',
  'jubilacion profuturo': 'Profuturo - R.A.',
  'edioacc plazo fijo': 'EDIOACC Plazo Fijo',
  'ahorro copa': 'Copa - Fondo',
  'progreso': 'Progreso',

  // Hipotecas / Préstamos
  '4 islas': '4 Islas',
  'park ave': 'Park Avenue',
  'park avenue': 'Park Avenue'
};

/**
 * Normaliza el nombre de una cuenta para emparejamiento
 */
export function normalizeAccountKey(name = '') {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Encuentra el nombre en Firestore correspondiente a una cuenta de HomeBudget
 */
export function mapHomeBudgetToFirestoreName(hbAccountName) {
  if (!hbAccountName) return null;
  const key = normalizeAccountKey(hbAccountName);
  return HB_TO_FIRESTORE_ACCOUNT_MAP[key] || hbAccountName;
}

/**
 * Calcula el flujo neto del mes por cuenta a partir de las transacciones
 * @param {Array} transactions - Lista de transacciones del mes (gastos, ingresos, transferencias)
 * @returns {Object} - Mapa con flujos por cuenta { [accountName]: { inflows, outflows, netFlow, txCount } }
 */
export function computeMonthlyFlowByAccount(transactions = []) {
  const accountFlows = {};

  function ensureAccount(acc) {
    if (!acc) return null;
    if (!accountFlows[acc]) {
      accountFlows[acc] = {
        inflows: 0,
        outflows: 0,
        netFlow: 0,
        txCount: 0,
        details: []
      };
    }
    return accountFlows[acc];
  }

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (amount <= 0) continue;

    if (tx.type === 'income') {
      const acc = tx.account || 'BAC';
      const item = ensureAccount(acc);
      if (item) {
        item.inflows = Math.round((item.inflows + amount) * 100) / 100;
        item.netFlow = Math.round((item.netFlow + amount) * 100) / 100;
        item.txCount++;
        item.details.push({ type: 'income', amount, date: tx.date, desc: tx.description || tx.payee });
      }
    } else if (tx.type === 'expense') {
      const acc = tx.account || 'BAC';
      const item = ensureAccount(acc);
      if (item) {
        item.outflows = Math.round((item.outflows + amount) * 100) / 100;
        item.netFlow = Math.round((item.netFlow - amount) * 100) / 100;
        item.txCount++;
        item.details.push({ type: 'expense', amount, date: tx.date, desc: tx.category + (tx.subcategory ? ` • ${tx.subcategory}` : '') });
      }
    } else if (tx.type === 'transfer') {
      const fromAcc = tx.fromAccount || tx.account;
      const toAcc = tx.toAccount;

      if (fromAcc) {
        const itemFrom = ensureAccount(fromAcc);
        if (itemFrom) {
          itemFrom.outflows = Math.round((itemFrom.outflows + amount) * 100) / 100;
          itemFrom.netFlow = Math.round((itemFrom.netFlow - amount) * 100) / 100;
          itemFrom.txCount++;
          itemFrom.details.push({ type: 'transfer_out', amount, date: tx.date, desc: `Traspaso a ${toAcc}` });
        }
      }

      if (toAcc) {
        const itemTo = ensureAccount(toAcc);
        if (itemTo) {
          itemTo.inflows = Math.round((itemTo.inflows + amount) * 100) / 100;
          itemTo.netFlow = Math.round((itemTo.netFlow + amount) * 100) / 100;
          itemTo.txCount++;
          itemTo.details.push({ type: 'transfer_in', amount, date: tx.date, desc: `Traspaso desde ${fromAcc}` });
        }
      }
    }
  }

  return accountFlows;
}

/**
 * Cruza las cuentas de Firestore con los flujos de HomeBudget
 * para producir la Matriz de Conciliación
 */
export function buildReconciliationMatrix(firestoreAccounts = [], monthlyFlows = {}) {
  // Mapa de flujos normalizado por clave
  const normalizedFlows = {};
  for (const [accName, flow] of Object.entries(monthlyFlows)) {
    const fsName = mapHomeBudgetToFirestoreName(accName);
    const key = normalizeAccountKey(fsName);
    if (!normalizedFlows[key]) {
      normalizedFlows[key] = {
        inflows: 0,
        outflows: 0,
        netFlow: 0,
        txCount: 0,
        sourceNames: []
      };
    }
    normalizedFlows[key].inflows = Math.round((normalizedFlows[key].inflows + flow.inflows) * 100) / 100;
    normalizedFlows[key].outflows = Math.round((normalizedFlows[key].outflows + flow.outflows) * 100) / 100;
    normalizedFlows[key].netFlow = Math.round((normalizedFlows[key].netFlow + flow.netFlow) * 100) / 100;
    normalizedFlows[key].txCount += flow.txCount;
    normalizedFlows[key].sourceNames.push(accName);
  }

  // Generar fila por cada cuenta activa de Firestore
  const matrix = firestoreAccounts
    .filter(acc => acc.active !== false)
    .map(acc => {
      const key = normalizeAccountKey(acc.name);
      const flow = normalizedFlows[key] || { inflows: 0, outflows: 0, netFlow: 0, txCount: 0 };

      const currentBalance = Number(acc.amount) || 0;
      const isLiability = acc.type === 'pasivo' || acc.category === 'consumo' || acc.category === 'prestamos';

      // Para pasivos (tarjetas de crédito):
      // Gasto incrementa la deuda (saldo más negativo o más alto en pasivo), pago de tarjeta la reduce.
      let estimatedBalance;
      if (isLiability) {
        // En pasivo: saldo final = saldo anterior + salidas(gastos) - entradas(pagos)
        estimatedBalance = Math.round((currentBalance + flow.outflows - flow.inflows) * 100) / 100;
      } else {
        // En activo: saldo final = saldo anterior + flujo neto (entradas - salidas)
        estimatedBalance = Math.round((currentBalance + flow.netFlow) * 100) / 100;
      }

      return {
        id: acc.id,
        name: acc.name,
        category: acc.category || 'liquidez',
        type: acc.type || 'activo',
        isLiability,
        previousBalance: currentBalance,
        inflows: flow.inflows,
        outflows: flow.outflows,
        netFlow: flow.netFlow,
        txCount: flow.txCount,
        estimatedBalance: estimatedBalance < 0 && !isLiability ? 0 : estimatedBalance,
        confirmedBalance: estimatedBalance < 0 && !isLiability ? 0 : estimatedBalance, // por defecto pre-llenado con el estimado
        variance: 0, // diferencia entre confirmado y estimado
        hasFlow: flow.txCount > 0
      };
    });

  // Ordenar primero las que tuvieron movimiento en el mes, y luego por categoría
  return matrix.sort((a, b) => {
    if (a.hasFlow !== b.hasFlow) return a.hasFlow ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
