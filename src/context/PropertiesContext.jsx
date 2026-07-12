import { createContext, useContext, useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';

const PropertiesContext = createContext(null);

// Colección compartida `properties` — ver terraform/main/firestore.rules.
export function PropertiesProvider({ children }) {
  const { approved } = useAuthContext();
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    if (!approved) {
      setProperties([]);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [approved]);

  const addProperty = async (name, value, appraisalDate) => {
    await addDoc(collection(db, 'properties'), {
      name,
      value: Number(value) || 0,
      appraisalDate,
    });
  };

  const updateProperty = async (id, name, value, appraisalDate) => {
    await updateDoc(doc(db, 'properties', id), { name, value: Number(value) || 0, appraisalDate });
  };

  const deleteProperty = async (id) => {
    await deleteDoc(doc(db, 'properties', id));
  };

  return (
    <PropertiesContext.Provider
      value={{ properties, addProperty, updateProperty, deleteProperty }}
    >
      {children}
    </PropertiesContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertiesContext);
  if (!context) {
    throw new Error('useProperties debe usarse dentro de un <PropertiesProvider>');
  }
  return context;
}

export default PropertiesContext;
