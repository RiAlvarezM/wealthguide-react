/**
 * fireCalculations.js
 * Motor de Cálculo para el Tablero de Independencia Financiera (FIRE Live)
 * 
 * Basado en:
 *  - Costo de vida real anual de HomeBudget (filtrando inversiones/ahorro con el modelo 2 bolsas)
 *  - Ingresos pasivos actuales (Alquileres de 4 Islas y Park Ave: $1,800/mes + dividendos)
 *  - Patrimonio financiero líquido e inversiones en cartera
 *  - Reglas de Retiro Seguro (SWR): 4.0% (Tradicional), 3.5% (Conservador), 3.0% (Ultra-seguro)
 */

export const SWR_RATES = {
  traditional: { rate: 0.04, multiplier: 25, label: 'Regla del 4.0% (Tradicional - 25x gastos)' },
  conservative: { rate: 0.035, multiplier: 28.57, label: 'Regla del 3.5% (Conservadora - 28.5x gastos)' },
  ultraSafe: { rate: 0.03, multiplier: 33.33, label: 'Regla del 3.0% (Ultra-Segura - 33.3x gastos)' }
};

/**
 * Calcula todas las métricas de Independencia Financiera (FIRE)
 */
export function computeFireMetrics({
  annualLivingExpenses = 60000,
  monthlyLivingExpenses = 5000,
  totalLiquidInvestments = 65000, // Cuentas de inversión + jubilación líquida
  totalNetWorth = 240000,
  monthlyPassiveIncome = 1800, // Alquileres de 4 Islas + Park Ave ($1,800/mes)
  annualSavingsRatePct = 35, // % de ahorro/inversión sobre ingresos
  annualReturnRate = 0.07, // 7% retorno anual promedio indexado
  inflationRate = 0.025, // 2.5% inflación anual
  swrMode = 'traditional' // 'traditional' | 'conservative' | 'ultraSafe'
}) {
  const swrConfig = SWR_RATES[swrMode] || SWR_RATES.traditional;

  // 1. Gasto anual neto a cubrir con portafolio (descontando ingresos pasivos existentes como alquileres)
  const annualPassiveIncome = monthlyPassiveIncome * 12;
  const netAnnualExpensesToCover = Math.max(0, annualLivingExpenses - annualPassiveIncome);

  // 2. Número FIRE
  // Número FIRE Bruto (si no tuvieras alquileres):
  const grossFireNumber = Math.round(annualLivingExpenses * swrConfig.multiplier);
  // Número FIRE Neto (considerando que los alquileres ya cubren parte de tu vida):
  const netFireNumber = Math.round(netAnnualExpensesToCover * swrConfig.multiplier);

  // 3. Progreso actual hacia FIRE
  const currentInvestments = totalLiquidInvestments > 0 ? totalLiquidInvestments : 60000;
  const progressPctGross = grossFireNumber > 0 ? (currentInvestments / grossFireNumber) * 100 : 0;
  const progressPctNet = netFireNumber > 0 ? (currentInvestments / netFireNumber) * 100 : 0;

  // 4. Termómetro de Cobertura Pasiva Actual (% de gastos cubiertos hoy)
  const passiveCoveragePct = annualLivingExpenses > 0 ? (annualPassiveIncome / annualLivingExpenses) * 100 : 0;
  const portfolioSafeWithdrawalMonthly = Math.round((currentInvestments * swrConfig.rate) / 12);
  const totalPassiveMonthly = monthlyPassiveIncome + portfolioSafeWithdrawalMonthly;
  const totalCoveragePct = monthlyLivingExpenses > 0 ? (totalPassiveMonthly / monthlyLivingExpenses) * 100 : 0;

  // 5. Runway de Libertad Financiera (¿Cuántos años vivirías hoy con tu capital sin trabajar?)
  const financialRunwayYears = annualLivingExpenses > 0 ? currentInvestments / annualLivingExpenses : 0;

  // 6. Proyección de Tiempo hasta FIRE (Años restantes)
  // Fórmula de anualidad con interés compuesto:
  const realReturnRate = Math.max(0.01, annualReturnRate - inflationRate);
  const annualSavingsDollars = (annualLivingExpenses / ((100 - annualSavingsRatePct) / 100 || 1)) * (annualSavingsRatePct / 100);

  let projectedYearsToFire = 0;
  let simulatedBalance = currentInvestments;

  if (simulatedBalance >= netFireNumber) {
    projectedYearsToFire = 0;
  } else {
    for (let yr = 1; yr <= 40; yr++) {
      simulatedBalance = (simulatedBalance * (1 + realReturnRate)) + annualSavingsDollars;
      if (simulatedBalance >= netFireNumber) {
        projectedYearsToFire = yr;
        break;
      }
    }
    if (projectedYearsToFire === 0) projectedYearsToFire = 40;
  }

  // 7. Niveles FIRE
  // Lean FIRE: Cubre el 75% del costo de vida (solo lo indispensable)
  const leanFireNumber = Math.round(grossFireNumber * 0.75);
  // Fat FIRE: Cubre el 150% del costo de vida (lujo y total holgura)
  const fatFireNumber = Math.round(grossFireNumber * 1.50);
  // Barista / Coast FIRE: El capital actual crecerá solo hasta el número FIRE sin aportar más
  const coastFireCapitalNeeded = Math.round(grossFireNumber / Math.pow(1 + realReturnRate, 15));

  return {
    grossFireNumber,
    netFireNumber,
    leanFireNumber,
    fatFireNumber,
    coastFireCapitalNeeded,
    currentInvestments,
    totalNetWorth,
    progressPct: Math.round(progressPctNet * 10) / 10,
    progressPctGross: Math.round(progressPctGross * 10) / 10,
    annualLivingExpenses,
    monthlyLivingExpenses,
    monthlyPassiveIncome,
    annualPassiveIncome,
    netAnnualExpensesToCover,
    passiveCoveragePct: Math.round(passiveCoveragePct * 10) / 10,
    totalCoveragePct: Math.round(totalCoveragePct * 10) / 10,
    portfolioSafeWithdrawalMonthly,
    totalPassiveMonthly,
    financialRunwayYears: Math.round(financialRunwayYears * 10) / 10,
    projectedYearsToFire,
    swrConfig,
    annualSavingsDollars: Math.round(annualSavingsDollars),
    annualSavingsRatePct
  };
}
