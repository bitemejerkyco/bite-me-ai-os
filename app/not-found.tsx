import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="surface-card max-w-lg p-8 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          The page you requested does not exist or may have moved.
        </p>
        <div className="mt-6">
          <Button>
            <Link href="/mission-control">Back to Mission Control</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
