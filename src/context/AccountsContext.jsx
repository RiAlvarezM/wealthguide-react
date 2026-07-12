import { createContext, useContext, useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';

const AccountsContext = createContext(null);

const CATEGORY_TYPES = {
  liquidez: 'activo',
  inversiones: 'activo',
  jubilacion: 'activo',
  consumo: 'pasivo',
  prestamos: 'pasivo',
};

// Colección compartida `accounts` (ver terraform/main/firestore.rules):
// toda cuenta aprobada de la familia ve y edita los mismos documentos.
export function AccountsProvider({ children }) {
  const { approved } = useAuthContext();
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (!approved) {
      setAccounts([]);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [approved]);

  const addAccount = async (name, amount, category) => {
    const type = CATEGORY_TYPES[category] || 'activo';
    await addDoc(collection(db, 'accounts'), {
      name,
      amount: Number(amount) || 0,
      category,
      type,
      active: true,
    });
  };

  const updateAccount = async (id, name, amount) => {
    await updateDoc(doc(db, 'accounts', id), { name, amount: Number(amount) || 0 });
  };

  const toggleAccountActive = async (id) => {
    const account = accounts.find((acc) => acc.id === id);
    if (!account) return;
    await updateDoc(doc(db, 'accounts', id), { active: !account.active });
  };

  const deleteAccount = async (id) => {
    await deleteDoc(doc(db, 'accounts', id));
  };

  return (
    <AccountsContext.Provider
      value={{ accounts, addAccount, updateAccount, toggleAccountActive, deleteAccount }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error('useAccounts debe usarse dentro de un <AccountsProvider>');
  }
  return context;
}

export default AccountsContext;
