import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prelim",
  description: "Prelim — project management built on Next.js, Clerk, and Prisma"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
