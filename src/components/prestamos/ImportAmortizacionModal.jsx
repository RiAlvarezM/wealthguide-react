// src/components/prestamos/ImportAmortizacionModal.jsx
//
// Modal para importar o actualizar la tabla de amortización vía CSV.
// Permite arrastrar archivo, seleccionar .csv, pegar texto o cargar datos por defecto.

import { useState, useRef } from 'react';
import { parseAmortizacionCsv } from '../../lib/amortizacionParser';
import { DEFAULT_4ISLAS_SCHEDULE } from '../../data/default4IslasSchedule';
import { useAmortizacion } from '../../context/AmortizacionContext';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export default function ImportAmortizacionModal({ isOpen, onClose, loanName = '4 Islas', loanId = '4islas' }) {
  const { importSchedule } = useAmortizacion();
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState('upload'); // 'upload' | 'paste' | 'preview'
  const [csvRaw, setCsvRaw] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  function resetState() {
    setCsvRaw('');
    setParsedData(null);
    setParseError(null);
    setIsSubmitting(false);
    setProgress(0);
    setImportSuccess(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        processCsvText(text);
      }
    };
    reader.readAsText(file);
  }

  function processCsvText(text) {
    setParseError(null);
    try {
      const res = parseAmortizacionCsv(text);
      if (res.success && res.records.length > 0) {
        setParsedData(res);
        setMode('preview');
      } else {
        setParseError(res.error || 'No se pudieron extraer cuotas del archivo CSV.');
      }
    } catch (err) {
      setParseError('Error procesando CSV: ' + err.message);
    }
  }

  function handleLoadDefault() {
    setParsedData({
      success: true,
      records: DEFAULT_4ISLAS_SCHEDULE,
      summary: {
        totalQuotas: DEFAULT_4ISLAS_SCHEDULE.length,
        startDate: DEFAULT_4ISLAS_SCHEDULE[0].date,
        startLabel: DEFAULT_4ISLAS_SCHEDULE[0].mesLabel,
        endDate: DEFAULT_4ISLAS_SCHEDULE[DEFAULT_4ISLAS_SCHEDULE.length - 1].date,
        endLabel: DEFAULT_4ISLAS_SCHEDULE[DEFAULT_4ISLAS_SCHEDULE.length - 1].mesLabel,
        initialBalance: 108000,
        latestBalance: DEFAULT_4ISLAS_SCHEDULE[DEFAULT_4ISLAS_SCHEDULE.length - 1].balance,
        totalExtraPaid: DEFAULT_4ISLAS_SCHEDULE.reduce((s, r) => s + (r.extra || 0), 0),
        quotasWithExtra: DEFAULT_4ISLAS_SCHEDULE.filter((r) => r.extra > 0).length,
      },
    });
    setMode('preview');
  }

  async function handleConfirmImport() {
    if (!parsedData || !parsedData.records.length) return;

    setIsSubmitting(true);
    setProgress(10);

    try {
      await importSchedule(
        loanId,
        parsedData.records,
        {
          name: loanName,
          originalAmount: parsedData.summary.initialBalance || 108000,
          startDate: parsedData.summary.startDate,
        },
        (pct) => setProgress(pct)
      );

      setImportSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setParseError('Error guardando en Firestore: ' + err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl border border-outline-variant shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-[fadeIn_0.15s_ease]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">upload_file</span>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Importar Tabla de Amortización
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {importSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <span className="material-symbols-outlined text-5xl text-secondary animate-bounce">
                check_circle
              </span>
              <h4 className="font-headline-md text-headline-md text-on-surface">
                ¡Calendario importado exitosamente!
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Se guardaron {parsedData?.records.length} cuotas en la base de datos de {loanName}.
              </p>
            </div>
          ) : mode === 'preview' && parsedData ? (
            /* PREVIEW MODE */
            <div className="flex flex-col gap-4">
              <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-body-lg text-body-lg font-semibold text-secondary">
                    Archivo analizado correctamente
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Se detectaron {parsedData.summary.totalQuotas} cuotas desde {parsedData.summary.startLabel} hasta {parsedData.summary.endLabel}.
                  </p>
                </div>
                <button
                  onClick={() => { setParsedData(null); setMode('upload'); }}
                  className="font-label-sm text-label-sm text-secondary hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/60">
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Total Cuotas</p>
                  <p className="font-headline-md text-headline-md text-on-surface font-bold">
                    {parsedData.summary.totalQuotas}
                  </p>
                </div>
                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/60">
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Saldo Inicial</p>
                  <p className="font-headline-md text-headline-md text-on-surface font-bold">
                    {fmt.format(parsedData.summary.initialBalance)}
                  </p>
                </div>
                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/60">
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Abonos Extra</p>
                  <p className="font-headline-md text-headline-md text-secondary font-bold">
                    {fmt.format(parsedData.summary.totalExtraPaid)}
                  </p>
                </div>
                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/60">
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Cuotas c/ Extra</p>
                  <p className="font-headline-md text-headline-md text-on-surface font-bold">
                    {parsedData.summary.quotasWithExtra}
                  </p>
                </div>
              </div>

              {/* Preview Table of First and Last Rows */}
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 font-medium">
                  Muestra de cuotas a guardar (primeras 3 y últimas 2):
                </p>
                <div className="overflow-x-auto rounded border border-outline-variant text-xs">
                  <table className="w-full border-collapse">
                    <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant">
                      <tr>
                        <th className="px-2.5 py-1.5 text-left">#</th>
                        <th className="px-2.5 py-1.5 text-left">Mes</th>
                        <th className="px-2.5 py-1.5 text-right">Capital</th>
                        <th className="px-2.5 py-1.5 text-right">Extra</th>
                        <th className="px-2.5 py-1.5 text-right">Interés</th>
                        <th className="px-2.5 py-1.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.records.slice(0, 3).map((r) => (
                        <tr key={r.n} className="border-b border-outline-variant/40">
                          <td className="px-2.5 py-1.5 font-mono">{r.n}</td>
                          <td className="px-2.5 py-1.5 capitalize">{r.mesLabel}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.format(r.principal)}</td>
                          <td className="px-2.5 py-1.5 text-right font-medium text-secondary">{r.extra > 0 ? fmt.format(r.extra) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.format(r.interest)}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold">{fmt.format(r.balance)}</td>
                        </tr>
                      ))}
                      <tr className="bg-surface-container-lowest text-center text-on-surface-variant/60 italic">
                        <td colSpan="6" className="py-1">... ({parsedData.records.length - 5} cuotas intermedias) ...</td>
                      </tr>
                      {parsedData.records.slice(-2).map((r) => (
                        <tr key={r.n} className="border-b border-outline-variant/40">
                          <td className="px-2.5 py-1.5 font-mono">{r.n}</td>
                          <td className="px-2.5 py-1.5 capitalize">{r.mesLabel}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.format(r.principal)}</td>
                          <td className="px-2.5 py-1.5 text-right font-medium text-secondary">{r.extra > 0 ? fmt.format(r.extra) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.format(r.interest)}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold">{fmt.format(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress bar if submitting */}
              {isSubmitting && (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>Guardando cuotas en base de datos...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-secondary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* UPLOAD / PASTE SELECTOR */
            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex border-b border-outline-variant gap-4">
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={`pb-2 font-label-md text-label-md transition-colors border-b-2 -mb-px ${
                    mode === 'upload'
                      ? 'border-secondary text-secondary font-semibold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Subir archivo CSV
                </button>
                <button
                  type="button"
                  onClick={() => setMode('paste')}
                  className={`pb-2 font-label-md text-label-md transition-colors border-b-2 -mb-px ${
                    mode === 'paste'
                      ? 'border-secondary text-secondary font-semibold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Pegar texto CSV
                </button>
              </div>

              {mode === 'upload' && (
                <div className="flex flex-col gap-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline-variant hover:border-secondary/60 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-surface-container-lowest/50 hover:bg-surface-container-low transition-all"
                  >
                    <span className="material-symbols-outlined text-4xl text-secondary">cloud_upload</span>
                    <p className="font-body-md text-body-md font-medium text-on-surface">
                      Haz clic para seleccionar o arrastra tu archivo CSV aquí
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Formato de tabla con cuotas, capital, extra, intereses y balance.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {mode === 'paste' && (
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Pega el contenido CSV aquí:
                  </label>
                  <textarea
                    rows={8}
                    value={csvRaw}
                    onChange={(e) => setCsvRaw(e.target.value)}
                    placeholder="Año,Mes,,Neto,Total,Capital,Extra,interes,..."
                    className="w-full p-3 font-mono text-xs border border-outline-variant rounded bg-surface-container-low text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => processCsvText(csvRaw)}
                      disabled={!csvRaw.trim()}
                      className="px-4 py-2 bg-secondary text-on-secondary rounded font-label-sm text-label-sm disabled:opacity-40"
                    >
                      Analizar datos
                    </button>
                  </div>
                </div>
              )}

              {/* Quick default loader shortcut */}
              <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between bg-surface-container-low/30 p-3 rounded-lg">
                <div>
                  <p className="font-body-sm text-body-sm font-medium text-on-surface">
                    ¿Tienes los datos de 4 Islas listos?
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Carga directamente las 240 cuotas históricas y proyectadas registradas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDefault}
                  className="px-3.5 py-1.5 border border-secondary text-secondary hover:bg-secondary/10 rounded font-label-sm text-label-sm transition-colors whitespace-nowrap"
                >
                  Cargar 4 Islas
                </button>
              </div>

              {parseError && (
                <div className="p-3 rounded bg-error/10 border border-error/30 text-error font-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-outline-variant flex items-center justify-end gap-3 bg-surface-container-low/40">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-outline-variant rounded font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          {mode === 'preview' && !importSuccess && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSubmitting}
              className="px-5 py-2 bg-secondary text-on-secondary rounded font-label-sm text-label-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Importando ({progress}%)...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  <span>Confirmar e Importar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}