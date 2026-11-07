import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import summaryData from '../data/homebudgetSummary.json';
import {
  isInvestmentAccount,
  classifyTransfer,
  groupAccountsByPool
} from '../lib/accountClassification';

const HomeBudgetContext = createContext(null);

export function HomeBudgetProvider({ children }) {
  // Modo de vista: 'pools' (2 Bolsas: Liquidez vs Ahorro Real / Inversión) | 'classic' (HomeBudget Histórico)
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('wealthguide_hb_viewmode') || 'pools';
    } catch {
      return 'pools';
    }
  });

  const toggleViewMode = () => {
    const next = viewMode === 'pools' ? 'classic' : 'pools';
    setViewMode(next);
    try { localStorage.setItem('wealthguide_hb_viewmode', next); } catch (e) {}
  };

  // Transacciones manuales guardadas en LocalStorage
  const [customTransactions, setCustomTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('wealthguide_custom_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Base completa de transacciones bajo demanda (19.7k gastos, 1.9k ingresos, 2.8k transferencias)
  const [fullTransactions, setFullTransactions] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/data/homebudgetTransactions.json')
      .then(res => res.json())
      .then(data => {
        if (isMounted) setFullTransactions(data);
      })
      .catch(err => console.log('Using pre-indexed summary transactions', err));
    return () => { isMounted = false; };
  }, []);

  const monthlySummaries = summaryData.monthlySummaries || [];
  const yearlySummaries = summaryData.yearlySummaries || [];
  const allMonths = useMemo(() => monthlySummaries.map(m => m.month), [monthlySummaries]);

  // Mes por defecto: el último con gastos registrados (generalmente Octubre 2026)
  const defaultMonth = useMemo(() => {
    for (let i = monthlySummaries.length - 1; i >= 0; i--) {
      if (monthlySummaries[i].totalExpenses > 0) return monthlySummaries[i].month;
    }
    return monthlySummaries[monthlySummaries.length - 1]?.month || '2026-10';
  }, [monthlySummaries]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const monthIndex = useMemo(() => {
    return allMonths.indexOf(selectedMonth);
  }, [allMonths, selectedMonth]);

  const handlePrevMonth = () => {
    if (monthIndex > 0) setSelectedMonth(allMonths[monthIndex - 1]);
  };

  const handleNextMonth = () => {
    if (monthIndex < allMonths.length - 1) setSelectedMonth(allMonths[monthIndex + 1]);
  };

  // Guardar nueva transacción manual
  const handleSaveTransaction = (newTx) => {
    const updated = [newTx, ...customTransactions];
    setCustomTransactions(updated);
    try {
      localStorage.setItem('wealthguide_custom_expenses', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    const txMonth = newTx.date.substring(0, 7);
    setSelectedMonth(txMonth);
  };

  // Datos del mes actual consolidando histórico y manuales
  const currentMonthData = useMemo(() => {
    const base = monthlySummaries.find(m => m.month === selectedMonth) || {
      month: selectedMonth,
      totalExpenses: 0,
      livingExpenses: 0,
      investmentSavings: 0,
      totalIncome: 0,
      netSavings: 0,
      realNetSavings: 0,
      freeCashFlow: 0,
      savingsRate: 0,
      realSavingsRate: 0,
      expensesByCategory: {},
      livingExpensesByCategory: {},
      investmentBySubcategory: {},
      expensesBySubcategory: {},
      incomeBySource: {},
      expensesCount: 0,
      incomesCount: 0,
      transfersCount: 0,
      internalTransfersAmount: 0
    };

    const monthManualTxs = customTransactions.filter(t => t.date.startsWith(selectedMonth));
    let extraExpenses = 0;
    let extraLivingExpenses = 0;
    let extraInvestmentSavings = 0;
    let extraIncomes = 0;
    const catMap = { ...(base.expensesByCategory || {}) };
    const livingCatMap = { ...(base.livingExpensesByCategory || {}) };
    const invMap = { ...(base.investmentBySubcategory || {}) };
    const incSourceMap = { ...(base.incomeBySource || {}) };

    monthManualTxs.forEach(t => {
      if (t.type === 'expense') {
        extraExpenses += t.amount;
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        const isInv = t.category?.toLowerCase() === 'inversion' || isInvestmentAccount(t.account);
        if (isInv) {
          extraInvestmentSavings += t.amount;
          const target = t.subcategory || t.account || 'Inversión';
          invMap[target] = (invMap[target] || 0) + t.amount;
        } else {
          extraLivingExpenses += t.amount;
          livingCatMap[t.category] = (livingCatMap[t.category] || 0) + t.amount;
        }
      } else if (t.type === 'income') {
        extraIncomes += t.amount;
        const src = t.payee || t.description || 'Otros';
        incSourceMap[src] = (incSourceMap[src] || 0) + t.amount;
      } else if (t.type === 'transfer') {
        const kind = classifyTransfer(t.fromAccount || t.account, t.toAccount);
        if (kind === 'investment_contribution') {
          extraInvestmentSavings += t.amount;
          const target = t.toAccount || 'Inversión';
          invMap[target] = (invMap[target] || 0) + t.amount;
        } else if (kind === 'investment_withdrawal') {
          extraInvestmentSavings -= t.amount;
        }
      }
    });

    const totalExp = Math.round((base.totalExpenses + extraExpenses) * 100) / 100;
    const livingExp = Math.round(((base.livingExpenses !== undefined ? base.livingExpenses : base.totalExpenses) + extraLivingExpenses) * 100) / 100;
    const invSavings = Math.round(((base.investmentSavings || 0) + extraInvestmentSavings) * 100) / 100;
    const totalInc = Math.round((base.totalIncome + extraIncomes) * 100) / 100;
    const net = Math.round((totalInc - totalExp) * 100) / 100;
    const realNet = Math.round((totalInc - livingExp) * 100) / 100;
    const freeCash = Math.round((totalInc - livingExp - invSavings) * 100) / 100;
    const rate = totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 1000) / 10 : 0;
    const realRate = totalInc > 0 ? Math.round((invSavings / totalInc) * 1000) / 10 : 0;

    return {
      ...base,
      totalExpenses: totalExp,
      livingExpenses: livingExp,
      investmentSavings: invSavings,
      totalIncome: totalInc,
      netSavings: net,
      realNetSavings: realNet,
      freeCashFlow: freeCash,
      savingsRate: rate,
      realSavingsRate: realRate,
      expensesByCategory: catMap,
      livingExpensesByCategory: livingCatMap,
      investmentBySubcategory: invMap,
      incomeBySource: incSourceMap,
      expensesCount: (base.expensesCount || 0) + monthManualTxs.filter(t => t.type === 'expense').length,
      incomesCount: (base.incomesCount || 0) + monthManualTxs.filter(t => t.type === 'income').length
    };
  }, [monthlySummaries, selectedMonth, customTransactions]);

  // Transacciones completas del mes
  const allCurrentMonthTransactions = useMemo(() => {
    let histExp = [];
    let histInc = [];
    let histTrn = [];

    if (fullTransactions) {
      histExp = (fullTransactions.expenses || []).filter(e => e.date.startsWith(selectedMonth));
      histInc = (fullTransactions.incomes || []).filter(i => i.date.startsWith(selectedMonth));
      histTrn = (fullTransactions.transfers || []).filter(t => t.date.startsWith(selectedMonth));
    } else {
      histExp = (summaryData.recentExpenses || []).filter(e => e.date.startsWith(selectedMonth));
      histInc = (summaryData.recentIncomes || []).filter(i => i.date.startsWith(selectedMonth));
      histTrn = (summaryData.recentTransfers || []).filter(t => t.date.startsWith(selectedMonth));
    }

    const manual = customTransactions.filter(t => t.date.startsWith(selectedMonth));

    const processedHistoricalExpenses = histExp.map(h => {
      const isInv = (h.category || '').toLowerCase() === 'inversion' || isInvestmentAccount(h.account);
      return {
        ...h,
        type: 'expense',
        poolKind: isInv ? 'investment' : 'living',
        displayCategory: isInv ? 'Aporte Inversión' : h.category
      };
    });

    const processedHistoricalIncomes = histInc.map(h => ({
      ...h,
      type: 'income',
      poolKind: 'income',
      displayCategory: 'Ingreso',
      payee: h.description || h.payee || 'Ingreso'
    }));

    const processedHistoricalTransfers = histTrn.map(t => {
      const transferKind = classifyTransfer(t.fromAccount, t.toAccount);
      return {
        ...t,
        type: 'transfer',
        poolKind: transferKind === 'investment_contribution' ? 'investment' : (transferKind === 'investment_withdrawal' ? 'investment_withdrawal' : 'internal'),
        account: t.fromAccount,
        displayCategory: transferKind === 'investment_contribution' ? 'Aporte Inversión' : 'Traspaso Interno'
      };
    });

    const processedManual = manual.map(m => {
      if (m.type === 'transfer') {
        const transferKind = classifyTransfer(m.fromAccount || m.account, m.toAccount);
        return {
          ...m,
          poolKind: transferKind === 'investment_contribution' ? 'investment' : (transferKind === 'investment_withdrawal' ? 'investment_withdrawal' : 'internal'),
          displayCategory: transferKind === 'investment_contribution' ? 'Aporte Inversión' : 'Traspaso Interno'
        };
      }
      if (m.type === 'income') {
        return {
          ...m,
          poolKind: 'income',
          displayCategory: 'Ingreso'
        };
      }
      const isInv = (m.category || '').toLowerCase() === 'inversion' || isInvestmentAccount(m.account);
      return {
        ...m,
        poolKind: isInv ? 'investment' : 'living',
        displayCategory: isInv ? 'Aporte Inversión' : m.category
      };
    });

    const combined = [
      ...processedManual,
      ...processedHistoricalExpenses,
      ...processedHistoricalIncomes,
      ...processedHistoricalTransfers
    ];

    return combined.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedMonth, customTransactions, fullTransactions]);

  // Modales
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('expense');
  const [isBeneficiariosOpen, setIsBeneficiariosOpen] = useState(false);
  const [isCuentasOpen, setIsCuentasOpen] = useState(false);

  const openQuickAdd = (type = 'expense') => {
    setQuickAddType(type);
    setIsQuickAddOpen(true);
  };

  const closeQuickAdd = () => setIsQuickAddOpen(false);

  // Cuentas agrupadas
  const groupedAccounts = useMemo(() => {
    return groupAccountsByPool(summaryData.accounts || []);
  }, []);

  return (
    <HomeBudgetContext.Provider
      value={{
        summaryData,
        monthlySummaries,
        yearlySummaries,
        allMonths,
        selectedMonth,
        setSelectedMonth,
        monthIndex,
        handlePrevMonth,
        handleNextMonth,
        viewMode,
        setViewMode,
        toggleViewMode,
        customTransactions,
        handleSaveTransaction,
        currentMonthData,
        allCurrentMonthTransactions,
        groupedAccounts,
        isQuickAddOpen,
        quickAddType,
        openQuickAdd,
        closeQuickAdd,
        isBeneficiariosOpen,
        setIsBeneficiariosOpen,
        isCuentasOpen,
        setIsCuentasOpen
      }}
    >
      {children}
    </HomeBudgetContext.Provider>
  );
}

export function useHomeBudget() {
  const context = useContext(HomeBudgetContext);
  if (!context) {
    throw new Error('useHomeBudget debe usarse dentro de un HomeBudgetProvider');
  }
  return context;
}
