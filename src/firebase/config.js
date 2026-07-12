// src/firebase/config.js
//
// Inicialización de Firebase para WealthGuide.
// Reemplaza estos valores con los de tu proyecto en la consola de Firebase
// (Project Settings > General > Your apps > SDK setup and configuration),
// o mejor aún, cárgalos desde variables de entorno (.env) con Vite:
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   etc.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'TODO_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'TODO_AUTH_DOMAIN',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'TODO_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'TODO_STORAGE_BUCKET',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'TODO_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'TODO_APP_ID',
};

const app = initializeApp(firebaseConfig);

// Instancias listas para usarse en los hooks (useAuth, useTransactions, etc.)
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
