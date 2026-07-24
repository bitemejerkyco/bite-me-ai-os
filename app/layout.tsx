import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bite Me AI OS",
  description: "AI-powered marketing operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-[#0d0d0d] text-[#f0f0f0]">{children}</body>
    </html>
  );
}
