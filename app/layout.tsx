"use client";

import "./globals.css";
import NavBar from "./components/NavBar";
import MaintenanceBanner from "./components/MaintenanceBanner";
import { SessionProvider } from "next-auth/react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased w-screen`}>
        <SessionProvider>
          <MaintenanceBanner />
          <NavBar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
