import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

let initializationPromise: Promise<FirebaseApp | null> | null = null;

const initializeFirebase = async (): Promise<FirebaseApp | null> => {
  if (getApps().length) {
    if (!app) app = getApp();
    if (!auth && app) auth = getAuth(app);
    if (!db && app) db = getFirestore(app);
    return app;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    let firebaseConfig: FirebaseConfig = {};
    let configSource = "environment"; // Track where config came from

    try {
      const response = await fetch("/__/firebase/init.json");
      if (response.ok) {
        firebaseConfig = await response.json();
        configSource = "hosting";
        console.log("Fetched Firebase config from Hosting.");
      } else {
        throw new Error("Fetch not ok"); // Trigger fallback
      }
    } catch (e) {
      console.warn(
        "Could not fetch Firebase config from /__/firebase/init.json. Falling back to process.env.",
        e
      );
      firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };
    }

    if (!firebaseConfig.apiKey) {
      console.error(
        `Firebase config is missing apiKey (source: ${configSource}). Initialization failed.`
      );
      initializationPromise = null; // Reset promise on failure
      return null;
    }

    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);

      if (
        process.env.NODE_ENV === "development" &&
        typeof window !== "undefined"
      ) {
        try {
          connectAuthEmulator(auth, "http://localhost:9099", {
            disableWarnings: true,
          });
          connectFirestoreEmulator(db, "localhost", 8080);
          console.log("Firebase emulators connected.");
        } catch (emulatorError) {
          console.error(
            "Error connecting to Firebase emulators:",
            emulatorError
          );
        }
      }
      console.log("Firebase initialized successfully.");
      return app;
    } catch (initError) {
      console.error("Error during Firebase initialization:", initError);
      app = null; // Ensure app is null on error
      auth = null;
      db = null;
      initializationPromise = null; // Reset promise on failure
      return null;
    }
  })();

  return initializationPromise;
};

// Export the promise itself, and the potentially null services
export { app, auth, db, initializeFirebase };
