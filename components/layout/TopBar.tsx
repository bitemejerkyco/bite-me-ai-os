"use client";

import { useState, useRef, useEffect } from "react";
import { SearchIcon, BellIcon, ChevronDownIcon, MenuIcon, BuildingIcon, CheckIcon } from "lucide-react";
import Link from "next/link";

interface TopBarProps {
  onMenuClick: () => void;
  onSearchOpen: () => void;
}

const workspaces = [
  { id: "bite-me-jerky", name: "Bite Me Jerky", plan: "Pro" },
  { id: "demo-brand", name: "Demo Brand", plan: "Starter" },
];

export function TopBar({ onMenuClick, onSearchOpen }: TopBarProps) {
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ESC closes any open dropdown
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWorkspaceOpen(false);
        setUserOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <header
      className="flex h-16 shrink-0 items-center gap-3 border-b border-[#1e1e1e] bg-[#111111] px-4"
      role="banner"
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-[#1e1e1e] hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        aria-label="Open navigation menu"
      >
        <MenuIcon className="h-4 w-4" />
      </button>

      {/* Workspace switcher */}
      <div className="relative" ref={workspaceRef}>
        <button
          onClick={() => {
            setWorkspaceOpen((o) => !o);
            setUserOpen(false);
            setNotifOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-[#1e1e1e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-haspopup="listbox"
          aria-expanded={workspaceOpen}
          aria-label="Switch workspace"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
            {activeWorkspace.name.charAt(0)}
          </span>
          <span className="max-w-[120px] truncate">{activeWorkspace.name}</span>
          <ChevronDownIcon className="h-3 w-3 text-zinc-500" aria-hidden="true" />
        </button>

        {workspaceOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[#2a2a2a] bg-[#161616] py-1 shadow-xl"
            role="listbox"
            aria-label="Workspaces"
          >
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Workspaces
            </p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                role="option"
                aria-selected={ws.id === activeWorkspace.id}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#1e1e1e]"
                onClick={() => {
                  setActiveWorkspace(ws);
                  setWorkspaceOpen(false);
                }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#2a2a2a] text-xs font-bold text-zinc-400">
                  {ws.name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-white">{ws.name}</p>
                  <p className="text-xs text-zinc-500">{ws.plan}</p>
                </div>
                {ws.id === activeWorkspace.id && (
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" aria-label="Active" />
                )}
              </button>
            ))}
            <div className="mx-3 my-1 border-t border-[#222]" />
            <Link
              href="/brand-setup"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-[#1e1e1e] hover:text-white"
              onClick={() => setWorkspaceOpen(false)}
            >
              <BuildingIcon className="h-4 w-4" />
              Add workspace
            </Link>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search trigger */}
      <button
        onClick={onSearchOpen}
        className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-[#333] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        aria-label="Open search (⌘K)"
      >
        <SearchIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:block">Search…</span>
        <kbd className="hidden rounded bg-[#222] px-1.5 py-0.5 text-xs text-zinc-500 sm:block" aria-label="Command K shortcut">
          ⌘K
        </kbd>
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => {
            setNotifOpen((o) => !o);
            setUserOpen(false);
            setWorkspaceOpen(false);
          }}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-[#1e1e1e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Notifications"
          aria-haspopup="dialog"
          aria-expanded={notifOpen}
        >
          <BellIcon className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-label="New notifications" />
        </button>

        {notifOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-xl"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-[#222] px-4 py-3">
              <p className="text-sm font-semibold text-white">Notifications</p>
              <button className="text-xs text-zinc-500 hover:text-white">Mark all read</button>
            </div>
            <div className="flex flex-col items-center justify-center py-10">
              <BellIcon className="h-8 w-8 text-zinc-700" />
              <p className="mt-2 text-sm text-zinc-500">No notifications yet</p>
            </div>
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => {
            setUserOpen((o) => !o);
            setNotifOpen(false);
            setWorkspaceOpen(false);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={userOpen}
        >
          K
        </button>

        {userOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-[#2a2a2a] bg-[#161616] py-1 shadow-xl"
            role="menu"
            aria-label="User menu"
          >
            <div className="px-4 py-3 border-b border-[#222]">
              <p className="text-sm font-medium text-white">Keith</p>
              <p className="text-xs text-zinc-500">admin@bitemejerkysausage.com</p>
            </div>
            <div className="py-1">
              <Link
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:bg-[#1e1e1e] hover:text-white"
                role="menuitem"
                onClick={() => setUserOpen(false)}
              >
                Account settings
              </Link>
              <Link
                href="/billing"
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:bg-[#1e1e1e] hover:text-white"
                role="menuitem"
                onClick={() => setUserOpen(false)}
              >
                Billing
              </Link>
            </div>
            <div className="border-t border-[#222] py-1">
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-[#1e1e1e]"
                role="menuitem"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
