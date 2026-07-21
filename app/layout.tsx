import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostMotive AI",
  description: "Every Post Has a Motive. AI-powered marketing operations for modern brands.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">{children}</body>
    </html>
  );
}
