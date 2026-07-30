import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://postmotive-ai1.vercel.app"),
  title: {
    default: "PostMotive",
    template: "%s | PostMotive",
  },
  description: "AI-powered marketing command center for growing businesses.",
  icons: {
    icon: "/postmotive-mark.png",
    apple: "/postmotive-mark.png",
  },
  openGraph: {
    title: "PostMotive",
    description: "AI-powered marketing command center for growing businesses.",
    images: ["/postmotive-mark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
