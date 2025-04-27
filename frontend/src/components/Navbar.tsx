"use client";

import React, { useState } from "react";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        <div className="md:hidden">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"
                }
              />
            </svg>
          </button>
        </div>
        <div className="hidden md:flex space-x-4 items-center">
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
                Track an Index
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
      {/* Mobile Menu */}
      <div className={`${isMenuOpen ? "block" : "hidden"} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {user ? (
            <>
              <Link
                href="/"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === "/"
                    ? "text-blue-400 bg-gray-900"
                    : "hover:bg-gray-700 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/indices"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === "/indices"
                    ? "text-blue-400 bg-gray-900"
                    : "hover:bg-gray-700 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Track an Index
              </Link>
              <Link
                href="/alerts"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === "/alerts"
                    ? "text-blue-400 bg-gray-900"
                    : "hover:bg-gray-700 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                My Alerts
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-400 hover:bg-gray-700 hover:text-red-300"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === "/login"
                    ? "text-blue-400 bg-gray-900"
                    : "hover:bg-gray-700 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === "/signup"
                    ? "text-blue-400 bg-gray-900"
                    : "hover:bg-gray-700 hover:text-white"
                }`}
                onClick={() => setIsMenuOpen(false)}
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
