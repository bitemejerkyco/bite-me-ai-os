import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
