"use client";

"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";

export default function AccountPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordReset = async () => {
    if (!user?.email) {
      addToast("Error: No email address found for this account.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      addToast(
        "Password reset email sent. Please check your inbox.",
        "success"
      );
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      addToast(`Error sending password reset email: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Account</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Account Details</h2>
          <p>
            <span className="font-medium">Email:</span> {user.email}
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Security</h2>
          <Button
            onClick={handlePasswordReset}
            disabled={isLoading}
            variant="outline"
            className="cursor-pointer"
          >
            {isLoading ? "Sending..." : "Send Password Reset Email"}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Click the button above to receive an email with instructions on how
            to reset your password.
          </p>
        </div>
      </div>
    </div>
  );
}
