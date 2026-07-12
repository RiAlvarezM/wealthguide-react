import { createContext, useContext, useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';

const LoyaltyContext = createContext(null);

export const LOYALTY_GROUPS = ['Tarjetas', 'Millas', 'Hoteles', 'Otros'];

// Colección compartida `loyaltyPrograms` — ver terraform/main/firestore.rules.
export function LoyaltyProvider({ children }) {
  const { approved } = useAuthContext();
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    if (!approved) {
      setPrograms([]);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'loyaltyPrograms'), (snap) => {
      setPrograms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [approved]);

  const addProgram = async (name, equivalenceUSD, group, balance = 0) => {
    await addDoc(collection(db, 'loyaltyPrograms'), {
      name,
      equivalenceUSD: Number(equivalenceUSD) || 0,
      group,
      color: '#94a3b8',
      balance: Number(balance) || 0,
    });
  };

  const updateProgram = async (id, name, equivalenceUSD, group, balance) => {
    await updateDoc(doc(db, 'loyaltyPrograms', id), {
      name,
      equivalenceUSD: Number(equivalenceUSD) || 0,
      group,
      balance: Number(balance) || 0,
    });
  };

  const deleteProgram = async (id) => {
    await deleteDoc(doc(db, 'loyaltyPrograms', id));
  };

  return (
    <LoyaltyContext.Provider value={{ programs, addProgram, updateProgram, deleteProgram }}>
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error('useLoyalty debe usarse dentro de un <LoyaltyProvider>');
  }
  return context;
}

export default LoyaltyContext;
