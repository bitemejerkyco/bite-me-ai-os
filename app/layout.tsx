import type { Metadata } from "next";
import HelpRoot from "@/components/help/HelpRoot";
import { loadHelpPreference } from "@/features/help/server";
import { getViewerContext } from "@/lib/auth/server";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [viewer, preference] = await Promise.all([
    getViewerContext(),
    loadHelpPreference(),
  ]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <HelpRoot
          initialPreference={preference}
          initialIsSuperAdmin={viewer.isSuperAdmin}
        >
          {children}
        </HelpRoot>
      </body>
    </html>
  );
}
