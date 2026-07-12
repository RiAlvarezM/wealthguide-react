#!/usr/bin/env node
//
// One-time migration: seeds Cloud Firestore with this app's local data —
// local-data/*.csv|json (accounts, properties, vehicles, loyalty programs,
// net worth history) — into shared top-level collections. This is a
// family dashboard, not multi-tenant SaaS: every authenticated user sees
// the same data, so there is no per-user (uid) scoping.
//
// This is dev tooling, not part of the shipped app. It uses firebase-admin
// (service-account credentials), which must never run in the browser bundle.
//
// Setup:
//   1. npm install --no-save firebase-admin
//   2. Firebase Console > Project Settings > Service Accounts >
//      "Generate new private key" -> save the JSON file somewhere OUTSIDE
//      this repo (never commit it).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccountKey.json \
//   FIREBASE_PROJECT_ID=your-project-id \
//   node scripts/migrate-to-firebase.mjs
//
// Re-running is safe: documents are written with deterministic IDs derived
// from the source data, so a second run overwrites rather than duplicates.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../local-data');

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
});
const db = getFirestore();

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}

function slugify(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CATEGORY_MAP = {
  Inversion: 'inversiones',
  Ahorro: 'liquidez',
  Jubilacion: 'jubilacion',
  Deuda: 'consumo',
  Prestamo: 'prestamos',
};
const CATEGORY_TYPES = {
  liquidez: 'activo',
  inversiones: 'activo',
  jubilacion: 'activo',
  consumo: 'pasivo',
  prestamos: 'pasivo',
};

async function migrateAccounts(batch) {
  const rows = parseCsv(readFileSync(path.join(DATA_DIR, 'cuentas.csv'), 'utf8'));
  rows.forEach((row, index) => {
    const category = CATEGORY_MAP[row.Categoria];
    const ref = db.collection('accounts').doc(`acc-${index + 1}`);
    batch.set(ref, {
      name: row.Nombre_Cuenta,
      amount: Number(row.Ultimo_Valor),
      category,
      type: CATEGORY_TYPES[category],
      active: row.Incluir.trim() === 'True',
    });
  });
  console.log(`Queued ${rows.length} accounts.`);
}

async function migrateProperties(batch) {
  const rows = parseCsv(readFileSync(path.join(DATA_DIR, 'propiedades.csv'), 'utf8'));
  rows.forEach((row) => {
    const ref = db.collection('properties').doc(slugify(row.Propiedad));
    batch.set(ref, {
      name: row.Propiedad,
      value: Number(row.Valor_Avaluo),
      appraisalDate: row.Fecha_Avaluo,
    });
  });
  console.log(`Queued ${rows.length} properties.`);
}

async function migrateVehicles(batch) {
  const vehicles = JSON.parse(readFileSync(path.join(DATA_DIR, 'vehiculos.json'), 'utf8'));
  vehicles.forEach((v) => {
    const ref = db.collection('vehicles').doc(v.id);
    batch.set(ref, {
      name: v.nombre,
      originalValue: Number(v.valor_original),
      purchaseYear: Number(v.anio_compra),
    });
  });
  console.log(`Queued ${vehicles.length} vehicles.`);
}

async function migrateLoyalty(batch) {
  const { categorias } = JSON.parse(readFileSync(path.join(DATA_DIR, 'puntos.json'), 'utf8'));
  categorias.forEach((c) => {
    const ref = db.collection('loyaltyPrograms').doc(c.id);
    batch.set(ref, {
      name: c.nombre,
      equivalenceUSD: Number(c.equivalencia_dolar),
      group: c.grupo,
      color: c.color,
      balance: 0, // not tracked in the source data — set real balances after migrating
    });
  });
  console.log(`Queued ${categorias.length} loyalty programs.`);
}

async function migrateNetworthHistory(batch) {
  const rows = parseCsv(readFileSync(path.join(DATA_DIR, 'networth_db.csv'), 'utf8'));
  rows.forEach((row) => {
    const ref = db.collection('networthHistory').doc(row.Fecha);
    batch.set(ref, {
      date: row.Fecha,
      ahorro: Number(row.Ahorro),
      inversion: Number(row.Inversion),
      jubilacion: Number(row.Jubilacion),
      deuda: Number(row.Deuda),
      prestamo: Number(row.Prestamo),
    });
  });
  console.log(`Queued ${rows.length} networth history rows.`);
}

async function main() {
  // Firestore batches cap at 500 writes; this dataset is well under that,
  // so a single batch is fine. Split into multiple batches if you add more seed data.
  const batch = db.batch();
  await migrateAccounts(batch);
  await migrateProperties(batch);
  await migrateVehicles(batch);
  await migrateLoyalty(batch);
  await migrateNetworthHistory(batch);
  await batch.commit();
  console.log('\nDone. Seeded Firestore top-level collections (accounts, properties, vehicles, loyaltyPrograms, networthHistory).');
  console.log('Note: Efectivo Diario / Presupuesto transactions have no persisted');
  console.log('data to migrate today (they live in memory only) — they will start empty.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
