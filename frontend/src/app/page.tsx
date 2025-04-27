"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    // Show loading or redirect will happen
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <p>Dashboard Page (Content TBD)</p>
    </div>
  );
}
