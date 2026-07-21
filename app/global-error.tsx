"use client";

import { logger } from "@/lib/logger";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  logger.error("Global error boundary triggered", {
    message: error.message,
    digest: error.digest,
  });

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
        <section className="surface-card max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold">Critical application error</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            The application encountered an unrecoverable error.
          </p>
        </section>
      </body>
    </html>
  );
}
