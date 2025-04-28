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

  if (!firebaseInitialized || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24 text-white">
        {" "}
        Authenticating...
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
