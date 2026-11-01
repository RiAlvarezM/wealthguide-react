/**
 * homebudgetParser.js
 * Robust parser for HomeBudget export CSV files.
 * Handles the 4 sections:
 *  1. Gastos (Expenses)
 *  2. Ingresos (Income)
 *  3. Presupuesto (Budgets)
 *  4. Transferencias (Transfers)
 * 
 * Supports RFC 4180 multiline quoted fields, whitespace/currency cleanup,
 * and pre-computes monthly and yearly aggregates for high-performance dashboard charts.
 */

export function parseCsvRows(text) {
  if (!text) return [];
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  const len = text.length;
  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // skip carriage return
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function parseAmount(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function cleanString(val) {
  return (val || '').trim();
}

export function parseHomeBudgetCsv(csvText) {
  const rows = parseCsvRows(csvText);

  let currentSection = null;
  const expenses = [];
  const incomes = [];
  const budgets = [];
  const transfers = [];

  let expIndex = 0;
  let incIndex = 0;
  let trnIndex = 0;

  for (const row of rows) {
    if (!row || row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue;
    }

    const first = cleanString(row[0]).toLowerCase();
    const second = cleanString(row[1]).toLowerCase();

    // Section header detection
    if (first === 'fecha' && second === 'categoría') {
      currentSection = 'EXPENSES';
      continue;
    }
    if (first === 'fecha' && second === 'descripción') {
      currentSection = 'INCOMES';
      continue;
    }
    if (first === 'categoría' && second === 'subcategoría') {
      currentSection = 'BUDGETS';
      continue;
    }
    if (first === 'fecha' && second === 'desde') {
      currentSection = 'TRANSFERS';
      continue;
    }

    if (currentSection === 'EXPENSES') {
      const date = cleanString(row[0]);
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/)) continue;
      expIndex++;
      expenses.push({
        id: `exp_${expIndex}`,
        date,
        category: cleanString(row[1]),
        subcategory: cleanString(row[2]),
        amount: parseAmount(row[3]),
        account: cleanString(row[4]),
        payee: cleanString(row[5]),
        notes: cleanString(row[6]),
        device: cleanString(row[7])
      });
    } else if (currentSection === 'INCOMES') {
      const date = cleanString(row[0]);
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/)) continue;
      incIndex++;
      incomes.push({
        id: `inc_${incIndex}`,
        date,
        description: cleanString(row[1]),
        amount: parseAmount(row[2]),
        account: cleanString(row[3]),
        notes: cleanString(row[4]),
        device: cleanString(row[5])
      });
    } else if (currentSection === 'BUDGETS') {
      const category = cleanString(row[0]);
      if (!category) continue;
      budgets.push({
        category,
        subcategory: cleanString(row[1]),
        budgetAmount: parseAmount(row[2]),
        actualExpense: parseAmount(row[3]),
        balance: parseAmount(row[4])
      });
    } else if (currentSection === 'TRANSFERS') {
      const date = cleanString(row[0]);
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/)) continue;
      trnIndex++;
      transfers.push({
        id: `trn_${trnIndex}`,
        date,
        fromAccount: cleanString(row[1]),
        toAccount: cleanString(row[2]),
        amount: parseAmount(row[3]),
        notes: cleanString(row[4]),
        device: cleanString(row[5])
      });
    }
  }

  // 1. Catalogs
  const categoryMap = {};
  for (const e of expenses) {
    if (!e.category) continue;
    if (!categoryMap[e.category]) categoryMap[e.category] = new Set();
    if (e.subcategory) categoryMap[e.category].add(e.subcategory);
  }
  for (const b of budgets) {
    if (!b.category) continue;
    if (!categoryMap[b.category]) categoryMap[b.category] = new Set();
    if (b.subcategory) categoryMap[b.category].add(b.subcategory);
  }

  const categories = Object.keys(categoryMap).sort().map(cat => ({
    name: cat,
    subcategories: Array.from(categoryMap[cat]).sort()
  }));

  const accountsSet = new Set();
  const payeesSet = new Set();
  const incomeSourcesSet = new Set();

  expenses.forEach(e => {
    if (e.account) accountsSet.add(e.account);
    if (e.payee) payeesSet.add(e.payee);
  });
  incomes.forEach(i => {
    if (i.account) accountsSet.add(i.account);
    if (i.description) incomeSourcesSet.add(i.description);
  });
  transfers.forEach(t => {
    if (t.fromAccount) accountsSet.add(t.fromAccount);
    if (t.toAccount) accountsSet.add(t.toAccount);
  });

  const accounts = Array.from(accountsSet).sort();
  const payees = Array.from(payeesSet).sort();
  const incomeSources = Array.from(incomeSourcesSet).sort();

  // 2. Monthly aggregations (YYYY-MM)
  const monthlyMap = {};

  function getMonthObj(monthStr) {
    if (!monthlyMap[monthStr]) {
      const [y, m] = monthStr.split('-').map(Number);
      monthlyMap[monthStr] = {
        month: monthStr,
        year: y,
        monthNum: m,
        totalExpenses: 0,
        totalIncome: 0,
        netSavings: 0,
        savingsRate: 0,
        expensesByCategory: {},
        expensesBySubcategory: {},
        incomeBySource: {},
        expensesByAccount: {},
        expensesCount: 0,
        incomesCount: 0,
        transfersCount: 0
      };
    }
    return monthlyMap[monthStr];
  }

  for (const exp of expenses) {
    const month = exp.date.substring(0, 7);
    const m = getMonthObj(month);
    m.totalExpenses = Math.round((m.totalExpenses + exp.amount) * 100) / 100;
    m.expensesCount++;

    // By category
    const cat = exp.category || 'Otros';
    m.expensesByCategory[cat] = Math.round(((m.expensesByCategory[cat] || 0) + exp.amount) * 100) / 100;

    // By subcategory
    if (!m.expensesBySubcategory[cat]) m.expensesBySubcategory[cat] = {};
    const sub = exp.subcategory || 'General';
    m.expensesBySubcategory[cat][sub] = Math.round(((m.expensesBySubcategory[cat][sub] || 0) + exp.amount) * 100) / 100;

    // By account
    if (exp.account) {
      m.expensesByAccount[exp.account] = Math.round(((m.expensesByAccount[exp.account] || 0) + exp.amount) * 100) / 100;
    }
  }

  for (const inc of incomes) {
    const month = inc.date.substring(0, 7);
    const m = getMonthObj(month);
    m.totalIncome = Math.round((m.totalIncome + inc.amount) * 100) / 100;
    m.incomesCount++;

    const src = inc.description || 'Otros';
    m.incomeBySource[src] = Math.round(((m.incomeBySource[src] || 0) + inc.amount) * 100) / 100;
  }

  for (const trn of transfers) {
    const month = trn.date.substring(0, 7);
    const m = getMonthObj(month);
    m.transfersCount++;
  }

  // Calculate netSavings & savingsRate per month
  const monthlySummaries = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  for (const m of monthlySummaries) {
    m.netSavings = Math.round((m.totalIncome - m.totalExpenses) * 100) / 100;
    if (m.totalIncome > 0) {
      m.savingsRate = Math.round(((m.totalIncome - m.totalExpenses) / m.totalIncome) * 1000) / 10;
    } else {
      m.savingsRate = m.totalExpenses > 0 ? -100 : 0;
    }
  }

  // 3. Yearly aggregations (YYYY)
  const yearlyMap = {};
  for (const m of monthlySummaries) {
    const y = m.year;
    if (!yearlyMap[y]) {
      yearlyMap[y] = {
        year: y,
        totalExpenses: 0,
        totalIncome: 0,
        netSavings: 0,
        savingsRate: 0,
        expensesByCategory: {},
        monthsCount: 0
      };
    }
    const yr = yearlyMap[y];
    yr.totalExpenses = Math.round((yr.totalExpenses + m.totalExpenses) * 100) / 100;
    yr.totalIncome = Math.round((yr.totalIncome + m.totalIncome) * 100) / 100;
    yr.monthsCount++;

    for (const [cat, amt] of Object.entries(m.expensesByCategory)) {
      yr.expensesByCategory[cat] = Math.round(((yr.expensesByCategory[cat] || 0) + amt) * 100) / 100;
    }
  }

  const yearlySummaries = Object.values(yearlyMap).sort((a, b) => a.year - b.year);
  for (const yr of yearlySummaries) {
    yr.netSavings = Math.round((yr.totalIncome - yr.totalExpenses) * 100) / 100;
    if (yr.totalIncome > 0) {
      yr.savingsRate = Math.round(((yr.totalIncome - yr.totalExpenses) / yr.totalIncome) * 1000) / 10;
    } else {
      yr.savingsRate = yr.totalExpenses > 0 ? -100 : 0;
    }
    yr.monthlyAvgExpense = yr.monthsCount > 0 ? Math.round((yr.totalExpenses / yr.monthsCount) * 100) / 100 : 0;
    yr.monthlyAvgIncome = yr.monthsCount > 0 ? Math.round((yr.totalIncome / yr.monthsCount) * 100) / 100 : 0;
  }

  // Overall Stats
  const totalExp = Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  const totalInc = Math.round(incomes.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  return {
    expenses,
    incomes,
    budgets,
    transfers,
    categories,
    accounts,
    payees,
    incomeSources,
    monthlySummaries,
    yearlySummaries,
    stats: {
      totalExpenses: totalExp,
      totalIncome: totalInc,
      netSavings: Math.round((totalInc - totalExp) * 100) / 100,
      expensesCount: expenses.length,
      incomesCount: incomes.length,
      transfersCount: transfers.length,
      minDate: expenses[0]?.date || '',
      maxDate: expenses[expenses.length - 1]?.date || ''
    }
  };
}
