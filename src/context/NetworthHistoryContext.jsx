import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';

const NetworthHistoryContext = createContext(null);

function withDerivedFields(row) {
  const totalActivos = row.ahorro + row.inversion + row.jubilacion;
  const totalPasivos = row.deuda + row.prestamo;
  return {
    ...row,
    totalActivos,
    totalPasivos,
    netWorth: totalActivos - totalPasivos,
    debtRatio: totalActivos > 0 ? totalPasivos / totalActivos : 0,
  };
}

// Colección compartida `networthHistory` (doc id = fecha ISO). "Eliminar"
// una fila no la borra: le pone `hidden: true` para que quede sincronizado
// entre todos los dispositivos de la familia (antes era un array de fechas
// ocultas en localStorage, propio de cada navegador).
export function NetworthHistoryProvider({ children }) {
  const { approved } = useAuthContext();
  const [rawRows, setRawRows] = useState([]);

  useEffect(() => {
    if (!approved) {
      setRawRows([]);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'networthHistory'), (snap) => {
      setRawRows(snap.docs.map((d) => ({ date: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [approved]);

  const hiddenRows = useMemo(() => rawRows.filter((row) => row.hidden === true), [rawRows]);

  const history = useMemo(
    () =>
      rawRows
        .filter((row) => row.hidden !== true)
        .map(withDerivedFields)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [rawRows]
  );

  // Crea/actualiza el registro de hoy con los totales por categoría del
  // formulario de Patrimonio Neto. merge:true conserva cualquier otro campo
  // del doc (p.ej. si ya existía); hidden:false lo des-oculta si el usuario
  // lo había borrado antes y hoy vuelve a guardar un valor para esa fecha.
  const saveToday = async ({ ahorro, inversion, jubilacion, deuda, prestamo }) => {
    const today = new Date().toISOString().slice(0, 10);
    await setDoc(
      doc(db, 'networthHistory', today),
      { ahorro, inversion, jubilacion, deuda, prestamo, hidden: false },
      { merge: true }
    );
    return today;
  };

  const deleteEntry = async (date) => {
    await updateDoc(doc(db, 'networthHistory', date), { hidden: true });
  };

  const restoreAll = async () => {
    if (hiddenRows.length === 0) return;
    const batch = writeBatch(db);
    hiddenRows.forEach((row) => batch.update(doc(db, 'networthHistory', row.date), { hidden: false }));
    await batch.commit();
  };

  return (
    <NetworthHistoryContext.Provider
      value={{ history, saveToday, deleteEntry, restoreAll, deletedCount: hiddenRows.length }}
    >
      {children}
    </NetworthHistoryContext.Provider>
  );
}

export function useNetworthHistory() {
  const context = useContext(NetworthHistoryContext);
  if (!context) {
    throw new Error('useNetworthHistory debe usarse dentro de un <NetworthHistoryProvider>');
  }
  return context;
}

export default NetworthHistoryContext;
