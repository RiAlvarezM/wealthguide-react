// src/lib/amortizacionParser.js
//
// Parser robusto para tablas de amortización en CSV (formato bancario / Excel en español).
// Soporta:
//   • Formatos de moneda: "USD 515.85", "B/. 89,170.28", "-USD 170.15", "USD (1,415.97)"
//   • Espacios duros (\u00A0), tabs (\t) y comas de miles
//   • Fechas en español: "abril 2016", "mar 46", "septiembre 2026"
//   • Detección automática de encabezados, cuota secuencial y fila de totales

export const MONTHS_ES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

/**
 * Parsea cadenas numéricas con moneda a float
 * Soporta números negativos con signo (-) o entre paréntesis `(1,415.97)`
 */
export function parseMoney(raw = '') {
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

/**
 * Parsea "abril 2016" o "mar 46" a formato ISO "YYYY-MM-DD"
 * Con fallback a proyección mensual si el string del año es inusual.
 */
export function parseMonthYear(mesLabel = '', sequentialIndex = 0, baseDate = new Date(2016, 3, 1)) {
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

  // Fallback calculando el mes secuencial desde baseDate
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + sequentialIndex);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

/**
 * Divide una línea CSV respetando comillas
 */
export function parseCsvLine(line) {
  const result = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parsea el texto completo del CSV de amortización
 * @param {string} csvText
 * @param {object} options
 * @returns {{ success: boolean, records: Array, summary: object, error?: string }}
 */
export function parseAmortizacionCsv(csvText, options = {}) {
  if (!csvText || typeof csvText !== 'string') {
    return { success: false, records: [], error: 'El archivo CSV está vacío.' };
  }

  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(parseCsvLine(line));
  }

  if (rows.length < 3) {
    return { success: false, records: [], error: 'El archivo no contiene suficientes filas.' };
  }

  // Encontrar el inicio de las cuotas:
  // Típicamente las primeras 1-3 filas son encabezados / iniciales
  let startIndex = 0;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const r = rows[i];
    const mes = (r[1] || '').toLowerCase();
    // Si encontramos una fila que contiene un mes reconocible (e.g., abril 2016, enero...)
    const isMonthRow = Object.keys(MONTHS_ES).some((m) => mes.startsWith(m));
    if (isMonthRow) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === 0 && rows.length > 3) {
    startIndex = 3; // Fallback al layout estándar (fila 3 es la cuota 1)
  }

  const records = [];
  let cuotaSeq = 1;
  let totalExtraAccum = 0;
  let totalPrincipalAccum = 0;
  let totalInterestAccum = 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const mesLabel = (row[1] || '').trim();
    if (!mesLabel || mesLabel.toUpperCase() === 'TOTAL') continue;

    // Verificar si es una fila de resumen vacía
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

    totalExtraAccum += extra > 0 ? extra : 0;
    totalPrincipalAccum += principal;
    totalInterestAccum += interest;

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

  if (records.length === 0) {
    return { success: false, records: [], error: 'No se detectaron filas de cuotas válidas en el archivo.' };
  }

  const initialBalance = records[0].balance + records[0].principal;
  const currentOrLastBalance = records[records.length - 1].balance;

  const summary = {
    totalQuotas: records.length,
    startDate: records[0].date,
    startLabel: records[0].mesLabel,
    endDate: records[records.length - 1].date,
    endLabel: records[records.length - 1].mesLabel,
    initialBalance,
    latestBalance: currentOrLastBalance,
    totalExtraPaid: totalExtraAccum,
    totalPrincipalPaid: totalPrincipalAccum,
    totalInterestPaid: totalInterestAccum,
    quotasWithExtra: records.filter((r) => r.extra > 0).length,
  };

  return {
    success: true,
    records,
    summary,
  };
}

/**
 * Genera un archivo CSV descargable a partir del array de cuotas
 */
export function exportScheduleToCsv(records, loanName = 'amortizacion') {
  const headers = [
    'Cuota #',
    'Fecha',
    'Mes',
    'Cuota Total',
    'Capital',
    'Abono Extra',
    'Interés',
    'Mantenimiento',
    'FECI',
    'Gastos',
    'Ingreso Alquiler',
    'Balance Real',
    'Balance Teórico',
    'Notas',
  ];

  const lines = [headers.join(',')];

  for (const r of records) {
    const line = [
      r.n,
      `"${r.date}"`,
      `"${r.mesLabel || ''}"`,
      r.total?.toFixed(2) ?? '0.00',
      r.principal?.toFixed(2) ?? '0.00',
      r.extra?.toFixed(2) ?? '0.00',
      r.interest?.toFixed(2) ?? '0.00',
      r.maintenance?.toFixed(2) ?? '0.00',
      r.feci?.toFixed(2) ?? '0.00',
      r.expenses?.toFixed(2) ?? '0.00',
      r.rent?.toFixed(2) ?? '0.00',
      r.balance?.toFixed(2) ?? '0.00',
      r.theoreticalBalance?.toFixed(2) ?? '0.00',
      `"${(r.note || '').replace(/"/g, '""')}"`,
    ];
    lines.push(line.join(','));
  }

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${loanName.toLowerCase().replace(/\s+/g, '_')}_amortizacion.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}