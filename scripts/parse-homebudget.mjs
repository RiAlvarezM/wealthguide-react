/**
 * scripts/parse-homebudget.mjs
 * CLI script to parse HomeBudget CSV and output precomputed summary and datasets.
 * Usage: node scripts/parse-homebudget.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseHomeBudgetCsv } from '../src/lib/homebudgetParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const csvPath = path.join(rootDir, 'local-data', 'homebudget', 'Report (16).csv');
const outSummaryPath = path.join(rootDir, 'src', 'data', 'homebudgetSummary.json');
const publicDataDir = path.join(rootDir, 'public', 'data');
const fullTransactionsPath = path.join(publicDataDir, 'homebudgetTransactions.json');

console.log(`Reading CSV from: ${csvPath}`);
const startTime = Date.now();
const csvText = fs.readFileSync(csvPath, 'utf-8');

console.log(`Parsing HomeBudget data...`);
const result = parseHomeBudgetCsv(csvText);
const duration = Date.now() - startTime;

console.log(`\n=== Parse Results (${duration}ms) ===`);
console.log(`Expenses:          ${result.expenses.length} (Total: $${result.stats.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })})`);
console.log(`Incomes:           ${result.incomes.length} (Total: $${result.stats.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })})`);
console.log(`Transfers:         ${result.transfers.length}`);
console.log(`Budgets:           ${result.budgets.length}`);
console.log(`Categories:        ${result.categories.length}`);
console.log(`Accounts:          ${result.accounts.length}`);
console.log(`Payees:            ${result.payees.length}`);
console.log(`Months tracked:    ${result.monthlySummaries.length} (${result.monthlySummaries[0]?.month} -> ${result.monthlySummaries[result.monthlySummaries.length - 1]?.month})`);
console.log(`Years tracked:     ${result.yearlySummaries.length} (${result.yearlySummaries[0]?.year} -> ${result.yearlySummaries[result.yearlySummaries.length - 1]?.year})`);

// Create pre-indexed summary object (compact)
const summaryData = {
  stats: result.stats,
  categories: result.categories,
  accounts: result.accounts,
  incomeSources: result.incomeSources,
  budgets: result.budgets,
  monthlySummaries: result.monthlySummaries,
  yearlySummaries: result.yearlySummaries,
  // Recent transactions (last 300) for instant preview
  recentExpenses: result.expenses.slice(-300).reverse(),
  recentIncomes: result.incomes.slice(-100).reverse(),
  recentTransfers: result.transfers.slice(-100).reverse()
};

fs.mkdirSync(path.dirname(outSummaryPath), { recursive: true });
fs.writeFileSync(outSummaryPath, JSON.stringify(summaryData), 'utf-8');
const stat = fs.statSync(outSummaryPath);
console.log(`\nWrote summary dataset to ${outSummaryPath} (${Math.round(stat.size / 1024)} KB)`);

// Save full transactions to public/data/ for on-demand fetch
fs.mkdirSync(publicDataDir, { recursive: true });
fs.writeFileSync(fullTransactionsPath, JSON.stringify({
  expenses: result.expenses,
  incomes: result.incomes,
  transfers: result.transfers
}), 'utf-8');
const fullStat = fs.statSync(fullTransactionsPath);
console.log(`Wrote full transactions on-demand file to ${fullTransactionsPath} (${Math.round(fullStat.size / 1024)} KB)`);

// Clean up any old duplicate in src/data
const oldSrcTransactions = path.join(rootDir, 'src', 'data', 'homebudgetTransactions.json');
if (fs.existsSync(oldSrcTransactions)) {
  fs.unlinkSync(oldSrcTransactions);
}
