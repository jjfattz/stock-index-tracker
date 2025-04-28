"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import Navbar from "@/components/Navbar";

export default function LayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const hideNavbarPaths = ["/login", "/signup"];
  const shouldHideNavbar = hideNavbarPaths.includes(pathname);

  return (
    <AuthProvider>
      <ToastProvider>
        {!shouldHideNavbar && <Navbar />}
        <main className="flex-grow container mx-auto p-4">{children}</main>
      </ToastProvider>
    </AuthProvider>
  );
}
