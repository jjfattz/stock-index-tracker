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
} from "../lib/firebase"; // Rename import

interface AuthContextType {
  user: User | null;
  loading: boolean; // This will now represent only the auth state loading
  firebaseInitialized: boolean; // New state to track Firebase init
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseInitialized: false, // Default to false
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Auth state loading
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    initializeFirebase().then((app) => {
      setFirebaseInitialized(true); // Mark Firebase as initialized (or attempted)
      if (app && firebaseAuthService) {
        // Use the imported service name
        unsubscribe = onAuthStateChanged(firebaseAuthService, (user) => {
          setUser(user);
          setLoading(false); // Auth state is now determined
        });
      } else {
        console.error("Firebase auth failed to initialize for AuthProvider.");
        setLoading(false); // Stop loading even if init failed
      }
    });

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <AuthContext.Provider value={{ user, loading, firebaseInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
