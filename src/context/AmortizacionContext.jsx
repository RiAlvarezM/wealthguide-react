// src/context/AmortizacionContext.jsx
//
// Provee el calendario de amortización, pagos extra y metadatos del préstamo
// desde Firestore. Soporta importación en lote por batches de 400 cuotas.
//
// Colecciones Firestore:
//   loanDetails/{loanId}                    ← metadatos (monto original, fechas, resumen)
//   loanDetails/{loanId}/schedule/{n}       ← cuotas amortizadas (1..N)
//   loanDetails/{loanId}/extraPayments/{id} ← abonos extraordinarios (CRUD)

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';
import { DEFAULT_4ISLAS_SCHEDULE } from '../data/default4IslasSchedule';

const AmortizacionContext = createContext(null);

const DEFAULT_LOAN_ID = '4islas';

export function AmortizacionProvider({ children }) {
  const { approved } = useAuthContext();

  const [currentLoanId, setCurrentLoanId] = useState(DEFAULT_LOAN_ID);
  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [loanMetadata, setLoanMetadata] = useState(null);

  // Pagos extra en tiempo real
  const [extraPayments, setExtraPayments] = useState([]);
  const [extraLoading, setExtraLoading] = useState(true);

  // Cargar metadata y schedule del préstamo activo
  const loadSchedule = useCallback(async (loanId = currentLoanId) => {
    if (!approved) {
      setSchedule([]);
      setLoanMetadata(null);
      setScheduleLoading(false);
      return;
    }

    setScheduleLoading(true);
    try {
      // 1. Cargar metadatos
      const metaDocRef = doc(db, 'loanDetails', loanId);
      const metaSnap = await getDoc(metaDocRef);
      if (metaSnap.exists()) {
        setLoanMetadata(metaSnap.data());
      } else {
        setLoanMetadata(null);
      }

      // 2. Cargar cuotas ordenadas por n
      const scheduleRef = collection(db, 'loanDetails', loanId, 'schedule');
      const snap = await getDocs(query(scheduleRef, orderBy('n', 'asc')));

      if (!snap.empty) {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSchedule(rows);
      } else {
        // Si no hay cuotas en Firestore aún para 4islas, podemos usar los datos precargados
        if (loanId === DEFAULT_LOAN_ID && DEFAULT_4ISLAS_SCHEDULE?.length > 0) {
          setSchedule(DEFAULT_4ISLAS_SCHEDULE);
        } else {
          setSchedule([]);
        }
      }
    } catch (err) {
      console.error('Error cargando schedule:', err);
      // Fallback a los datos locales si falla conexión pero es 4islas
      if (loanId === DEFAULT_LOAN_ID && DEFAULT_4ISLAS_SCHEDULE?.length > 0) {
        setSchedule(DEFAULT_4ISLAS_SCHEDULE);
      }
    } finally {
      setScheduleLoading(false);
    }
  }, [approved, currentLoanId]);

  useEffect(() => {
    loadSchedule(currentLoanId);
  }, [loadSchedule, currentLoanId]);

  // Pagos extra (onSnapshot en tiempo real)
  useEffect(() => {
    if (!approved) {
      setExtraPayments([]);
      setExtraLoading(false);
      return;
    }

    setExtraLoading(true);
    const extraRef = collection(db, 'loanDetails', currentLoanId, 'extraPayments');
    const unsubscribe = onSnapshot(
      query(extraRef, orderBy('date', 'asc')),
      (snap) => {
        setExtraPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setExtraLoading(false);
      },
      (err) => {
        console.error('Error en extraPayments listener:', err);
        setExtraLoading(false);
      }
    );
    return unsubscribe;
  }, [approved, currentLoanId]);

  // ── Importación de Schedule a Firestore en batches ─────────────────────────
  const importSchedule = useCallback(async (loanId, records, meta = {}, onProgress) => {
    if (!records || records.length === 0) return { success: false, error: 'No hay cuotas para importar' };

    const targetLoanId = loanId || currentLoanId;
    const scheduleRef = collection(db, 'loanDetails', targetLoanId, 'schedule');

    // 1. Guardar o actualizar metadatos del préstamo
    const initialBalance = records[0]?.balance + (records[0]?.principal || 0);
    const metadataToSave = {
      name: meta.name || '4 Islas',
      loanId: targetLoanId,
      originalAmount: meta.originalAmount || initialBalance || 108000,
      startDate: meta.startDate || records[0]?.date || '2016-04-01',
      currency: meta.currency || 'USD',
      totalPayments: records.length,
      updatedAt: serverTimestamp(),
      latestBalance: records[records.length - 1]?.balance || 0,
      totalExtra: records.reduce((s, r) => s + (r.extra || 0), 0),
    };

    await setDoc(doc(db, 'loanDetails', targetLoanId), metadataToSave, { merge: true });

    // 2. Escribir cuotas en lotes de 400 (límite de Firestore es 500 ops)
    const BATCH_SIZE = 400;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
      const batch = writeBatch(db);
      const chunk = records.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      for (const rec of chunk) {
        const docRef = doc(scheduleRef, String(rec.n));
        batch.set(docRef, rec, { merge: true });
      }

      await batch.commit();
      if (onProgress) {
        const percent = Math.round(((b + 1) / totalBatches) * 100);
        onProgress(percent, (b + 1) * chunk.length);
      }
    }

    // Actualizar estado local inmediatamente
    setSchedule(records);
    setLoanMetadata(metadataToSave);
    return { success: true, count: records.length };
  }, [currentLoanId]);

  // Sincronizar el schedule precargado de 4 Islas
  const syncDefaultSchedule = useCallback(async (onProgress) => {
    return await importSchedule(
      DEFAULT_LOAN_ID,
      DEFAULT_4ISLAS_SCHEDULE,
      {
        name: '4 Islas',
        originalAmount: 108000,
        startDate: '2016-04-01',
      },
      onProgress
    );
  }, [importSchedule]);

  // ── Actualización de cuota con recálculo en cascada ───────────────────────
  const updateScheduleRowCascade = useCallback(async (n, updates) => {
    if (!schedule || schedule.length === 0) return { success: false, error: 'No hay cuotas cargadas' };

    const targetLoanId = currentLoanId;
    const scheduleRef = collection(db, 'loanDetails', targetLoanId, 'schedule');

    const index = schedule.findIndex((r) => r.n === n);
    if (index === -1) return { success: false, error: `Cuota #${n} no encontrada` };

    const initialAmount = loanMetadata?.originalAmount || 108000;
    const prevBalance = index === 0 ? initialAmount : (schedule[index - 1].balance ?? initialAmount);

    // Clonar schedule
    const newSchedule = schedule.map((row) => ({ ...row }));

    // Actualizar fila objetivo
    const target = { ...newSchedule[index], ...updates };
    const principal = Number(target.principal ?? newSchedule[index].principal ?? 0);
    const extra = Number(target.extra ?? newSchedule[index].extra ?? 0);
    const interest = Number(target.interest ?? newSchedule[index].interest ?? 0);
    const maintenance = Number(target.maintenance ?? newSchedule[index].maintenance ?? 0);
    const expenses = Number(target.expenses ?? newSchedule[index].expenses ?? 0);

    const calculatedTotal = Number((principal + interest + maintenance + expenses).toFixed(2));
    const calculatedBalance = Math.max(0, Number((prevBalance - principal - extra).toFixed(2)));

    target.principal = principal;
    target.extra = extra;
    target.interest = interest;
    target.maintenance = maintenance;
    target.expenses = expenses;
    target.total = calculatedTotal;
    target.balance = calculatedBalance;

    newSchedule[index] = target;

    // Recalcular saldos en cascada hacia adelante
    let runningBalance = calculatedBalance;
    for (let i = index + 1; i < newSchedule.length; i++) {
      const p = Number(newSchedule[i].principal || 0);
      const e = Number(newSchedule[i].extra || 0);
      runningBalance = Math.max(0, Number((runningBalance - p - e).toFixed(2)));
      newSchedule[i].balance = runningBalance;
    }

    // Actualizar estado local de inmediato
    setSchedule(newSchedule);

    // Persistir en Firestore en un batch las filas cambiadas
    try {
      const changedRows = newSchedule.slice(index);
      const batch = writeBatch(db);

      for (const rec of changedRows) {
        const docRef = doc(scheduleRef, String(rec.n));
        batch.set(docRef, rec, { merge: true });
      }

      // Actualizar metadatos
      const metaDocRef = doc(db, 'loanDetails', targetLoanId);
      batch.set(
        metaDocRef,
        {
          latestBalance: newSchedule[newSchedule.length - 1]?.balance || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
      return { success: true, updatedCount: changedRows.length };
    } catch (err) {
      console.error('Error persistiendo recálculo en cascada:', err);
      return { success: false, error: err.message };
    }
  }, [schedule, currentLoanId, loanMetadata]);

  // ── Marcar cuotas conciliadas hasta la cuota N ───────────────────────────
  const markReconciledUntil = useCallback(async (cutoffN) => {
    if (!schedule || schedule.length === 0) return;

    const newSchedule = schedule.map((row) => ({
      ...row,
      reconciled: row.n <= cutoffN,
    }));

    setSchedule(newSchedule);

    try {
      const batch = writeBatch(db);
      const scheduleRef = collection(db, 'loanDetails', currentLoanId, 'schedule');
      for (const rec of newSchedule) {
        const docRef = doc(scheduleRef, String(rec.n));
        batch.set(docRef, { reconciled: rec.reconciled }, { merge: true });
      }
      const metaDocRef = doc(db, 'loanDetails', currentLoanId);
      batch.set(metaDocRef, { reconciledCutoffN: cutoffN, updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
    } catch (err) {
      console.error('Error guardando límite de conciliación:', err);
    }
  }, [schedule, currentLoanId]);

  // ── CRUD de pagos extra ───────────────────────────────────────────────────
  const addExtraPayment = useCallback(async ({ date, amount, note }) => {
    const extraRef = collection(db, 'loanDetails', currentLoanId, 'extraPayments');
    await addDoc(extraRef, {
      date,
      amount: Number(amount),
      note: note || '',
      createdAt: serverTimestamp(),
    });
  }, [currentLoanId]);

  const updateExtraPayment = useCallback(async (id, { date, amount, note }) => {
    const docRef = doc(db, 'loanDetails', currentLoanId, 'extraPayments', id);
    await updateDoc(docRef, {
      date,
      amount: Number(amount),
      note: note || '',
    });
  }, [currentLoanId]);

  const deleteExtraPayment = useCallback(async (id) => {
    const docRef = doc(db, 'loanDetails', currentLoanId, 'extraPayments', id);
    await deleteDoc(docRef);
  }, [currentLoanId]);

  return (
    <AmortizacionContext.Provider
      value={{
        LOAN_ID: currentLoanId,
        loanId: currentLoanId,
        setLoanId: setCurrentLoanId,
        schedule,
        scheduleLoading,
        loanMetadata,
        extraPayments,
        extraLoading,
        loadSchedule,
        importSchedule,
        syncDefaultSchedule,
        updateScheduleRowCascade,
        markReconciledUntil,
        addExtraPayment,
        updateExtraPayment,
        deleteExtraPayment,
      }}
    >
      {children}
    </AmortizacionContext.Provider>
  );
}

export function useAmortizacion() {
  const ctx = useContext(AmortizacionContext);
  if (!ctx) throw new Error('useAmortizacion debe usarse dentro de <AmortizacionProvider>');
  return ctx;
}

export default AmortizacionContext;