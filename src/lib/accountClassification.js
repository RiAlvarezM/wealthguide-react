/**
 * accountClassification.js
 * Clasificación de cuentas en el Modelo de 2 Bolsas:
 *  1. Bolsa de Liquidez (POOL_LIQUIDITY): Cuentas bancarias corrientes, de ahorro local,
 *     monederos, tarjetas de crédito, efectivo y vales.
 *  2. Bolsa de Inversión (POOL_INVESTMENT): Cuentas de brokerage, fondos de inversión,
 *     plazos fijos y jubilación (representa el "Ahorro Real" patrimonial).
 */

export const POOL_LIQUIDITY = 'liquidez';
export const POOL_INVESTMENT = 'inversion';

// Cuentas conocidas de Inversión (Brokers, Jubilación, Activos)
export const KNOWN_INVESTMENT_ACCOUNTS = [
  'Schwab',
  'MMG',
  'Fortesza',
  'MiAngel',
  'EDIOACC Plazo Fijo',
  'Paullier',
  'Interactive brokers',
  'Interactive Brokers',
  'Criptomonedas',
  'QuAI'
];

// Subcategorías de Inversión que representan aportes patrimoniales
export const INVESTMENT_SUBCATEGORIES = [
  'Jubilación EDIOACC',
  'Aportes EDIOACC',
  'Jubilación Profuturo',
  'Fortesza',
  'Paullier',
  'Interactive brokers',
  'Negocio Graciela',
  'Criptomonedas',
  'UTP',
  'Objetivo BAC',
  'Ahorro Copa',
  'Mi Meta',
  'Progreso',
  'Schwab',
  'QuAI',
  'MMG'
];

/**
 * Determina a qué bolsa pertenece una cuenta
 * @param {string} accountName
 * @returns {'inversion' | 'liquidez'}
 */
export function getAccountPool(accountName) {
  if (!accountName) return POOL_LIQUIDITY;
  const normalized = accountName.trim().toLowerCase();
  
  const isInvestment = KNOWN_INVESTMENT_ACCOUNTS.some(
    inv => normalized === inv.toLowerCase() || normalized.includes(inv.toLowerCase())
  );

  return isInvestment ? POOL_INVESTMENT : POOL_LIQUIDITY;
}

export function isInvestmentAccount(accountName) {
  return getAccountPool(accountName) === POOL_INVESTMENT;
}

export function isLiquidityAccount(accountName) {
  return getAccountPool(accountName) === POOL_LIQUIDITY;
}

/**
 * Clasifica una transferencia entre dos cuentas
 * @param {string} fromAccount 
 * @param {string} toAccount 
 * @returns {'investment_contribution' | 'investment_withdrawal' | 'internal_liquidity'}
 */
export function classifyTransfer(fromAccount, toAccount) {
  const fromPool = getAccountPool(fromAccount);
  const toPool = getAccountPool(toAccount);

  if (fromPool === POOL_LIQUIDITY && toPool === POOL_INVESTMENT) {
    return 'investment_contribution'; // Aporte a Inversión (Tu Ahorro)
  }
  if (fromPool === POOL_INVESTMENT && toPool === POOL_LIQUIDITY) {
    return 'investment_withdrawal'; // Retiro / Desinversión
  }
  return 'internal_liquidity'; // Movimiento interno de caja / pago de tarjeta
}

/**
 * Clasifica una transacción de gasto o transferencia
 * Determina si es Costo de Vida real o Aporte a Inversión
 */
export function classifyTransaction(tx) {
  if (tx.type === 'transfer') {
    return classifyTransfer(tx.account || tx.fromAccount, tx.toAccount);
  }

  // Si es un gasto registrado históricamente en HomeBudget bajo categoría "Inversion"
  // o destinado a una cuenta de inversión
  const isInvCategory = (tx.category || '').trim().toLowerCase() === 'inversion';
  const isInvAccount = isInvestmentAccount(tx.account);

  if (isInvCategory || isInvAccount) {
    return 'investment_contribution'; // Reclasificado: es tu Ahorro / Inversión
  }

  return 'living_expense'; // Costo de vida real
}

/**
 * Devuelve cuentas agrupadas para dropdowns en modales
 */
export function groupAccountsByPool(accountsList = []) {
  const liquidity = [];
  const investment = [];

  for (const acc of accountsList) {
    if (isInvestmentAccount(acc)) {
      investment.push(acc);
    } else {
      liquidity.push(acc);
    }
  }

  // Asegurar que las cuentas clave de inversión estén presentes para selección
  KNOWN_INVESTMENT_ACCOUNTS.forEach(acc => {
    if (!investment.includes(acc)) {
      investment.push(acc);
    }
  });

  return {
    liquidity: liquidity.sort(),
    investment: investment.sort()
  };
}
