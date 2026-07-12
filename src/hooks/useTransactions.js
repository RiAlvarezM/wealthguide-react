// src/hooks/useTransactions.js
//
// Maneja el estado de las transacciones (gastos e ingresos) del dashboard.
// Colección compartida `transactions` (dashboard familiar, no hay filtro
// por dueño) — ver terraform/main/firestore.rules.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * @param {string|null} userId - uid del usuario autenticado; solo se usa
 *   como compuerta para saber si ya hay sesión (las páginas que llaman a
 *   este hook ya están detrás de <ProtectedRoute>, así que en la práctica
 *   siempre llega con valor cuando importa).
 */
export function useTransactions(userId = null) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [userId]);

  const addTransaction = useCallback(async (newTransaction) => {
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...newTransaction,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...newTransaction };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    setError(null);
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateTransaction = useCallback(async (id, updates) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'transactions', id), updates);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Totales derivados, útiles para las tarjetas KPI de Efectivo Diario / Presupuesto.
  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  return {
    transactions,
    loading,
    error,
    totals,
    addTransaction,
    deleteTransaction,
    updateTransaction,
  };
}

export default useTransactions;
