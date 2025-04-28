"use client";

import React, { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, firebaseInitialized } = useAuth();
  const router = useRouter();

  // Show loading indicator while Firebase initializes or auth state is loading
  if (!firebaseInitialized || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24 text-white">
        {" "}
        {/* Added text-white for visibility */}
        Authenticating...
      </div>
    );
  }

  // If initialization and loading are done, check for user
  if (!user) {
    // Redirect immediately if no user after loading is complete
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null; // Render nothing while redirecting
  }

  // If user exists, render children
  return <>{children}</>;
};

export default ProtectedRoute;
