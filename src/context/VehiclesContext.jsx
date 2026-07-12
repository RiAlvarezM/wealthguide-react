import { createContext, useContext, useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';

const VehiclesContext = createContext(null);

// Simplified 15%/year declining-balance depreciation estimate.
const ANNUAL_DEPRECIATION_RATE = 0.15;

export function estimateCurrentValue(vehicle, asOfYear = new Date().getFullYear()) {
  const years = Math.max(0, asOfYear - vehicle.purchaseYear);
  return vehicle.originalValue * Math.pow(1 - ANNUAL_DEPRECIATION_RATE, years);
}

export function estimateMonthlyDepreciation(vehicle, asOfYear = new Date().getFullYear()) {
  return estimateCurrentValue(vehicle, asOfYear) * ANNUAL_DEPRECIATION_RATE / 12;
}

// Colección compartida `vehicles` — ver terraform/main/firestore.rules.
export function VehiclesProvider({ children }) {
  const { approved } = useAuthContext();
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    if (!approved) {
      setVehicles([]);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [approved]);

  const addVehicle = async (name, originalValue, purchaseYear) => {
    await addDoc(collection(db, 'vehicles'), {
      name,
      originalValue: Number(originalValue) || 0,
      purchaseYear: Number(purchaseYear) || new Date().getFullYear(),
    });
  };

  const updateVehicle = async (id, name, originalValue, purchaseYear) => {
    const vehicle = vehicles.find((v) => v.id === id);
    await updateDoc(doc(db, 'vehicles', id), {
      name,
      originalValue: Number(originalValue) || 0,
      purchaseYear: Number(purchaseYear) || vehicle?.purchaseYear,
    });
  };

  const deleteVehicle = async (id) => {
    await deleteDoc(doc(db, 'vehicles', id));
  };

  return (
    <VehiclesContext.Provider value={{ vehicles, addVehicle, updateVehicle, deleteVehicle }}>
      {children}
    </VehiclesContext.Provider>
  );
}

export function useVehicles() {
  const context = useContext(VehiclesContext);
  if (!context) {
    throw new Error('useVehicles debe usarse dentro de un <VehiclesProvider>');
  }
  return context;
}

export default VehiclesContext;
