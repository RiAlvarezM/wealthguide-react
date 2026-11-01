#!/usr/bin/env node
//
// Seed: sube el calendario de amortización del préstamo "4 Islas" a Firestore.
//
// Estructura en Firestore:
//   loanDetails/{loanId}/schedule/{n}   → una cuota por documento (1..240)
//
// Setup:
//   1. npm install --no-save firebase-admin
//   2. Firebase Console > Project Settings > Service Accounts >
//      "Generate new private key" → guardar como serviceAccountKey.json
//
// Uso:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
//   FIREBASE_PROJECT_ID=networth-algam-dev \
//   node scripts/seed-amortizacion.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../local-data/amortizacion-4islas.csv');
const LOAN_ID = '4islas';

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'networth-algam-dev',
});
const db = getFirestore();

function parseMoney(raw = '') {
  if (typeof raw === 'number') return raw;
  if (!raw || typeof raw !== 'string') return 0;
  const str = raw.replace(/\u00A0/g, ' ').replace(/\t/g, ' ').trim();
  const isNegative = str.includes('(') || str.startsWith('-') || str.includes('-USD') || str.includes('-B/.');
  const cleaned = str
    .replace(/USD/gi, '')
    .replace(/B\/\./gi, '')
    .replace(/[(),\-]/g, '')
    .trim();
  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  return isNegative ? -val : val;
}

const MONTHS_ES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

function parseMonthYear(mesLabel = '', sequentialIndex = 0) {
  const parts = mesLabel.trim().toLowerCase().split(/\s+/);
  if (parts.length >= 2) {
    const mes = parts[0];
    let yr = parts[1];
    if (yr.length === 2) yr = '20' + yr;
    const mm = MONTHS_ES[mes];
    if (mm && !isNaN(parseInt(yr, 10))) {
      return `${yr}-${mm}-01`;
    }
  }
  const d = new Date(2016, 3 + sequentialIndex, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  return result;
}

const raw = readFileSync(CSV_PATH, 'utf8');
const rows = parseCsv(raw);

const records = [];
let cuotaSeq = 1;

for (let i = 3; i < rows.length; i++) {
  const row = rows[i];
  const mesLabel = (row[1] || '').trim();
  if (!mesLabel || mesLabel.toUpperCase() === 'TOTAL') continue;
  if (!row[4] && !row[5] && !row[12]) continue;

  const date = parseMonthYear(mesLabel, cuotaSeq - 1);
  const total = parseMoney(row[4]);
  const principal = parseMoney(row[5]);
  const extra = parseMoney(row[6]);
  const interest = parseMoney(row[7]);
  const maintenance = parseMoney(row[8]);
  const feci = parseMoney(row[9]);
  const expenses = parseMoney(row[10]);
  const rent = parseMoney(row[11]);
  const balance = parseMoney(row[12]);
  const theoreticalBalance = parseMoney(row[13]);
  const note = (row[20] || row[row.length - 1] || '').trim();

  records.push({
    n: cuotaSeq,
    date,
    mesLabel,
    total,
    principal,
    extra,
    interest,
    maintenance,
    feci,
    expenses,
    rent,
    balance,
    theoreticalBalance,
    note,
  });

  cuotaSeq++;
}

console.log(`✅ Parseadas ${records.length} cuotas del CSV`);
const withExtra = records.filter((r) => r.extra > 0);
console.log(`   Cuotas con abono extraordinario: ${withExtra.length}`);
console.log(`   Primera cuota: #${records[0]?.n} ${records[0]?.date} (${records[0]?.mesLabel}) — Balance: $${records[0]?.balance}`);
console.log(`   Última cuota:  #${records[records.length - 1]?.n} ${records[records.length - 1]?.date} (${records[records.length - 1]?.mesLabel}) — Balance: $${records[records.length - 1]?.balance}`);

const scheduleRef = db.collection('loanDetails').doc(LOAN_ID).collection('schedule');

await db.collection('loanDetails').doc(LOAN_ID).set(
  {
    name: '4 Islas',
    loanId: LOAN_ID,
    originalAmount: 108000,
    startDate: '2016-04-01',
    currency: 'USD',
    seededAt: new Date().toISOString(),
    totalPayments: records.length,
    latestBalance: records[records.length - 1]?.balance || 0,
    totalExtra: withExtra.reduce((s, r) => s + r.extra, 0),
  },
  { merge: true }
);

const BATCH_SIZE = 400;
let uploaded = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = db.batch();
  const chunk = records.slice(i, i + BATCH_SIZE);
  for (const rec of chunk) {
    batch.set(scheduleRef.doc(String(rec.n)), rec);
  }
  await batch.commit();
  uploaded += chunk.length;
  console.log(`   Subidas ${uploaded}/${records.length} cuotas...`);
}

console.log(`\n🎉 Seed completado exitosamente: ${records.length} cuotas en loanDetails/${LOAN_ID}/schedule`);
