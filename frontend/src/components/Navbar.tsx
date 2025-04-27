"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/context/ToastContext";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addToast("Logged out successfully.", "success");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
      addToast("Error signing out. Please try again.", "error");
    }
  };

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Stock Index Tracker
        </Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link
                href="/"
                className={`${
                  pathname === "/" ? "text-blue-400" : "hover:text-gray-300"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/indices"
                className={`${
                  pathname === "/indices"
                    ? "text-blue-400"
                    : "hover:text-gray-300"
                }`}
              >
                Browse Indices
              </Link>
              <Link
                href="/alerts"
                className={`${
                  pathname === "/alerts"
                    ? "text-blue-400"
                    : "hover:text-gray-300"
                }`}
              >
                My Alerts
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`${
                  pathname === "/login"
                    ? "text-blue-400"
                    : "hover:text-gray-300"
                }`}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={`${
                  pathname === "/signup"
                    ? "text-blue-400"
                    : "hover:text-gray-300"
                }`}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
