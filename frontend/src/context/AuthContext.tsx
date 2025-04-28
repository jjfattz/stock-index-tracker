"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import {
  auth as firebaseAuthService,
  initializeFirebase,
} from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  firebaseInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseInitialized: false,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    initializeFirebase().then((app) => {
      setFirebaseInitialized(true);
      if (app && firebaseAuthService) {
        unsubscribe = onAuthStateChanged(firebaseAuthService, (user) => {
          setUser(user);
          setLoading(false);
        });
      } else {
        console.error("Firebase auth failed to initialize for AuthProvider.");
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, firebaseInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
