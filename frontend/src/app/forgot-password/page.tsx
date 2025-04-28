"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!email) {
      addToast("Please enter your email address.", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      addToast(
        "Password reset email sent. Please check your inbox.",
        "success"
      );
      router.push("/login");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while sending reset email");
      }
      addToast(
        error || "Failed to send password reset email. Please try again.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="bg-card border border-border p-8 rounded-lg shadow-md w-full max-w-md text-white">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Stock <span className="text-blue-500">Index</span> Tracker
        </h1>
        <h2 className="text-2xl font-semibold mb-6 text-center">
          Forgot Password
        </h2>
        <form onSubmit={handleResetPassword}>
          <div className="mb-4">
            <label
              className="block text-gray-400 text-sm font-bold mb-2"
              htmlFor="email"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 bg-input text-gray-100 placeholder-gray-500 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <p className="text-destructive text-xs italic mb-4">{error}</p>
          )}
          <div className="flex items-center justify-between mt-6">
            <Button
              type="submit"
              variant="outline"
              className="cursor-pointer w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Reset My Password"}
            </Button>
          </div>
          <div className="text-center mt-4">
            <Link
              href="/login"
              className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-700"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
