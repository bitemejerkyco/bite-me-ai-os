import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchAI — Marketing Operating System",
  description: "Build coordinated, brand-aware marketing campaigns with an AI team.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}</body></html>;
}
