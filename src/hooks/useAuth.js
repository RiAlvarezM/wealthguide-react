// src/hooks/useAuth.js
//
// Hook de autenticación para WealthGuide, conectado a Firebase Auth real.
// El registro queda abierto, pero una cuenta nueva no puede leer/escribir
// ningún dato del dashboard hasta que el administrador la apruebe a mano
// desde la consola de Firebase (Firestore Database > users/{uid} >
// approved: true) — ver terraform/main/firestore.rules.

import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export function useAuth() {
  const [user, setUser] = useState(null);
  // null = todavía no se sabe (o no hay sesión); true/false = estado real.
  const [approved, setApproved] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Escucha en tiempo real si el administrador ya aprobó esta cuenta.
  useEffect(() => {
    if (!user) {
      setApproved(null);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => setApproved(snap.exists() && snap.data().approved === true),
      () => setApproved(false)
    );
    return unsubscribe;
  }, [user]);

  /**
   * Inicia sesión con correo y contraseña.
   */
  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      setUser(credentials.user);
      return credentials.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  /**
   * Crea una cuenta nueva con nombre, correo y contraseña. Queda pendiente
   * de aprobación hasta que un administrador la active desde la consola.
   */
  const register = useCallback(async (fullName, email, password) => {
    setAuthError(null);
    try {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credentials.user, { displayName: fullName });

      // Doc de perfil con approved:false — las reglas de Firestore impiden
      // que el propio usuario cambie este campo; solo el admin puede,
      // desde la consola (que opera con permisos de IAM, no de estas reglas).
      await setDoc(doc(db, 'users', credentials.user.uid), {
        approved: false,
        email,
        fullName,
      });

      setUser(credentials.user);
      return credentials.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  /**
   * Cierra la sesión del usuario actual.
   */
  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    approved,
    authLoading,
    authError,
    login,
    register,
    logout,
  };
}

export default useAuth;
