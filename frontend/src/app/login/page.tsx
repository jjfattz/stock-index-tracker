"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { initializeFirebase } from "@/lib/firebase"; // Import initializeFirebase
import { useEffect } from "react"; // Import useEffect

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [firebaseInitialized, setFirebaseInitialized] = useState(false); // Add state
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { addToast } = useToast();

  // Ensure Firebase is initialized before allowing login attempts
  useEffect(() => {
    initializeFirebase().then(() => setFirebaseInitialized(true));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firebaseInitialized || !auth) {
      // Check both flags
      setError("Authentication service is not ready. Please try again.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      if (userCredential.user && userCredential.user.email) {
        addToast(`Welcome back ${userCredential.user.email}`, "success");
      } else {
        addToast("Welcome back!", "success");
      }
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="bg-card border border-border p-8 rounded-lg shadow-md w-full max-w-md text-white">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Stock <span className="text-blue-500">Index</span> Tracker
        </h1>
        <h2 className="text-2xl font-semibold mb-6 text-center">Login</h2>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label
              className="block text-gray-400 text-sm font-bold mb-2"
              htmlFor="email"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 bg-input text-gray-100 placeholder-gray-500 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-gray-400 text-sm font-bold mb-2"
              htmlFor="password"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 bg-input text-gray-100 placeholder-gray-500 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
            <div className="text-right mt-1">
              <Link
                href="/forgot-password"
                className="inline-block align-baseline font-bold text-sm text-white hover:text-gray-300 cursor-pointer"
              >
                Forgot Password?
              </Link>
            </div>
          </div>
          {error && (
            <p className="text-destructive text-xs italic mb-4">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <Button
              type="submit"
              variant="outline"
              className="cursor-pointer"
              disabled={!firebaseInitialized}
            >
              {" "}
              {/* Disable button until initialized */}
              Sign In
            </Button>
            <Link
              href="/signup"
              className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-700"
            >
              Need an account? Sign Up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
