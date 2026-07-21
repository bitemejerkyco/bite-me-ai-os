"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { DASHBOARD_NAVIGATION } from "@/lib/constants";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Create Brand", href: "/brand-brain" },
  { label: "Import Website", href: "/brand-brain" },
  { label: "Upload Documents", href: "/knowledge-hub" },
  { label: "Connect Social Account", href: "/settings" },
  { label: "New Campaign", href: "/campaigns" },
  { label: "Generate Content", href: "/content-studio" },
] as const;

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onOpenChange]);

  const allItems = useMemo(
    () => [
      ...DASHBOARD_NAVIGATION.map((item) => ({ label: item.label, href: item.href, section: "Navigation" })),
      ...QUICK_ACTIONS.map((item) => ({ ...item, section: "Quick Actions" })),
    ],
    []
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [allItems, query]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-50 bg-black/65"
            onClick={() => onOpenChange(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close search"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="fixed left-1/2 top-[12vh] z-[60] w-[min(640px,92vw)] -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl"
          >
            <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-zinc-900 px-3">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                placeholder="Search pages and actions..."
                aria-label="Search"
              />
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">ESC</span>
            </div>

            <div className="mt-3 max-h-[50vh] overflow-auto">
              {filtered.length ? (
                <ul className="space-y-1">
                  {filtered.map((item) => (
                    <li key={`${item.section}:${item.href}`}>
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                          "hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        )}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-zinc-500">{item.section}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-sm text-zinc-500">No results found.</p>
              )}
            </div>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}
