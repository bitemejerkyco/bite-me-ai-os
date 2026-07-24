"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon, LayoutDashboardIcon, MegaphoneIcon, FileTextIcon, CalendarIcon, BookOpenIcon, BrainIcon, ImageIcon, BarChart2Icon, BotIcon, CreditCardIcon, SettingsIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  keywords?: string[];
}

const navItems: NavItem[] = [
  { label: "Mission Control", href: "/dashboard", icon: <LayoutDashboardIcon className="h-4 w-4" />, keywords: ["home", "overview"] },
  { label: "Campaigns", href: "/campaigns", icon: <MegaphoneIcon className="h-4 w-4" />, keywords: ["marketing", "ads"] },
  { label: "Content Studio", href: "/content-studio", icon: <FileTextIcon className="h-4 w-4" />, keywords: ["content", "posts", "copy"] },
  { label: "Marketing Calendar", href: "/marketing-calendar", icon: <CalendarIcon className="h-4 w-4" />, keywords: ["schedule", "calendar", "plan"] },
  { label: "Knowledge Hub", href: "/knowledge-hub", icon: <BookOpenIcon className="h-4 w-4" />, keywords: ["docs", "knowledge", "library"] },
  { label: "Brand Brain", href: "/brand-brain", icon: <BrainIcon className="h-4 w-4" />, keywords: ["brand", "identity"] },
  { label: "Media Library", href: "/media-library", icon: <ImageIcon className="h-4 w-4" />, keywords: ["media", "images", "files"] },
  { label: "Analytics", href: "/analytics", icon: <BarChart2Icon className="h-4 w-4" />, keywords: ["stats", "reports", "data"] },
  { label: "AI Employees", href: "/ai-employees", icon: <BotIcon className="h-4 w-4" />, keywords: ["ai", "automation", "agents"] },
  { label: "Billing", href: "/billing", icon: <CreditCardIcon className="h-4 w-4" />, keywords: ["payment", "subscription", "plan"] },
  { label: "Settings", href: "/settings", icon: <SettingsIcon className="h-4 w-4" />, keywords: ["preferences", "account", "config"] },
];

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  const filtered = query.trim()
    ? navItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.keywords?.some((k) => k.includes(query.toLowerCase()))
      )
    : navItems;

  const handleClose = useCallback(() => {
    setQuery("");
    setSelected(0);
    onClose();
  }, [onClose]);

  // Update query and reset selected index together (no effect needed)
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(0);
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && filtered[selected]) {
        router.push(filtered[selected].href);
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, filtered, selected, router, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search navigation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[#222] px-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search pages, actions…"
            className="flex-1 bg-transparent py-4 text-sm text-white placeholder-zinc-500 outline-none"
            aria-label="Search"
          />
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              className="rounded p-1 text-zinc-500 hover:text-white"
              aria-label="Clear search"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        <ul className="max-h-72 overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-500">No results found.</li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.href} role="option" aria-selected={i === selected}>
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    i === selected
                      ? "bg-[#222] text-white"
                      : "text-zinc-300 hover:bg-[#1e1e1e] hover:text-white"
                  }`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => {
                    router.push(item.href);
                    handleClose();
                  }}
                >
                  <span className="shrink-0 text-zinc-500">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-[#222] px-4 py-2.5">
          <span className="text-xs text-zinc-600">
            <kbd className="rounded bg-[#222] px-1 py-0.5 text-xs text-zinc-400">↑↓</kbd>{" "}
            navigate&nbsp;&nbsp;
            <kbd className="rounded bg-[#222] px-1 py-0.5 text-xs text-zinc-400">↵</kbd> open&nbsp;&nbsp;
            <kbd className="rounded bg-[#222] px-1 py-0.5 text-xs text-zinc-400">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
