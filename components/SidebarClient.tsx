"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";
import HelpModeToggle from "@/components/help/HelpModeToggle";
import {
  SIDEBAR_GROUPS,
  defaultExpandedGroups,
  isActiveRoute,
  type SidebarGroupId,
} from "@/features/navigation/sidebar-config";

type SidebarClientProps = {
  primaryAccountName: string | null;
  viewerEmail: string | null;
  showAdminSection: boolean;
};

const GROUP_STORAGE_KEY = "postmotive-sidebar-groups-v1";
const COMPACT_STORAGE_KEY = "postmotive-sidebar-compact-v1";

function shouldDefaultCompact(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 768px) and (max-width: 1199px)").matches;
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <span aria-hidden="true" className={`text-[10px] transition ${expanded ? "rotate-0" : "-rotate-90"}`}>▾</span>;
}

export function SidebarClientView({
  pathname,
  primaryAccountName,
  viewerEmail,
  showAdminSection,
  compactMode,
  expandedGroups,
  mobileOpen,
  onOpenMobile,
  onToggleCompact,
  onToggleGroup,
  onCloseMobile,
  helpModeSlot,
  signOutSlot,
}: {
  pathname: string;
  primaryAccountName: string | null;
  viewerEmail: string | null;
  showAdminSection: boolean;
  compactMode: boolean;
  expandedGroups: Record<SidebarGroupId, boolean>;
  mobileOpen: boolean;
  onOpenMobile?: () => void;
  onToggleCompact?: () => void;
  onToggleGroup?: (groupId: SidebarGroupId) => void;
  onCloseMobile?: () => void;
  helpModeSlot?: ReactNode;
  signOutSlot?: ReactNode;
}) {
  const visibleGroups = SIDEBAR_GROUPS.filter((group) => !group.adminOnly || showAdminSection);

  const asideContent = (
    <div className={`flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden border-r border-white/80 bg-white/70 text-slate-800 shadow-[16px_0_50px_rgba(76,61,139,0.07)] backdrop-blur-2xl transition-all duration-200 ${compactMode ? "w-24" : "w-72"}`}>
      <div data-sidebar-header className="shrink-0 border-b border-white/80 px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" onClick={onCloseMobile} className="flex min-w-0 items-center gap-3">
            <Image
              src="/postmotive-mark.png"
              alt=""
              width={48}
              height={48}
              priority
              className="h-12 w-12 shrink-0 rounded-2xl shadow-[0_12px_30px_rgba(104,87,245,0.22)]"
            />
            {!compactMode ? (
              <span className="min-w-0">
                <span className="pm-brand block truncate text-2xl font-black tracking-tight">
                  PostMotive
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                  AI marketing command center
                </span>
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={onToggleCompact}
            aria-label={compactMode ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-10 min-w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:inline-flex"
          >
            {compactMode ? "→" : "←"}
          </button>
        </div>
      </div>

      <div data-sidebar-scroll className="pm-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <nav aria-label="Sidebar navigation" className="space-y-4">
          {visibleGroups.map((group) => {
            const expanded = expandedGroups[group.id];
            return (
              <section key={group.id} aria-label={group.label} className="space-y-2">
                <button
                  type="button"
                  onClick={() => onToggleGroup?.(group.id)}
                  aria-expanded={expanded}
                  className={`flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 hover:bg-white/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${compactMode ? "justify-center" : ""}`}
                >
                  {compactMode ? <span className="sr-only">{group.label}</span> : <span>{group.label}</span>}
                  <Chevron expanded={expanded} />
                </button>
                {expanded ? (
                  <div className={`space-y-1 ${compactMode ? "flex flex-col items-center" : ""}`}>
                    {group.links.map((link) => {
                      const active = isActiveRoute(pathname, link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={onCloseMobile}
                          aria-current={active ? "page" : undefined}
                          aria-label={link.label}
                          title={link.label}
                          className={`group flex min-h-10 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${compactMode ? "justify-center px-2" : ""} ${
                            active
                              ? "bg-gradient-to-r from-violet-100 to-fuchsia-50 text-violet-800 shadow-sm"
                              : "text-slate-600 hover:bg-white/80 hover:text-violet-700"
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-xs ${
                              active
                                ? "bg-white text-violet-600 shadow-sm"
                                : "bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-600"
                            }`}
                          >
                            {link.icon}
                          </span>
                          {!compactMode ? <span className="truncate">{link.label}</span> : <span className="sr-only">{link.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>
      </div>

      <div data-sidebar-footer className="shrink-0 border-t border-white/80 px-4 py-4">
        <div className="rounded-3xl border border-white bg-white/75 p-4 shadow-[0_18px_45px_rgba(76,61,139,0.09)]">
          {!compactMode ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Active account
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {primaryAccountName || "Workspace pending"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewerEmail || "Signed-in user"}
              </p>
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Help Mode
                </p>
                <div className="mt-2">
                  {helpModeSlot}
                </div>
              </div>
              <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Secure demo-account switching is deferred to the next phase so browser state cannot grant elevated access.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700" title={primaryAccountName || "Workspace pending"} aria-label={primaryAccountName || "Workspace pending"}>
                {(primaryAccountName || "W").slice(0, 1).toUpperCase()}
              </span>
              <div title="Help mode controls" aria-label="Help mode controls" className="w-full">
                {helpModeSlot}
              </div>
            </div>
          )}
          <div className={`${compactMode ? "mt-3" : ""}`}>
            {signOutSlot}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={mobileOpen ? onCloseMobile : onOpenMobile}
        aria-expanded={mobileOpen}
        aria-controls="postmotive-sidebar-drawer"
        className="fixed left-4 top-4 z-[81] inline-flex min-h-10 min-w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/85 px-3 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(76,61,139,0.12)] backdrop-blur md:hidden"
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      <aside className="hidden md:sticky md:top-0 md:block md:self-start" aria-label="PostMotive sidebar">
        {asideContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden" aria-modal="true" role="dialog" aria-label="Navigation drawer">
          <button type="button" aria-label="Close navigation drawer" onClick={onCloseMobile} className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" />
          <div id="postmotive-sidebar-drawer" className="relative z-[81] h-full max-w-[88vw]">
            {asideContent}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function SidebarClient({
  primaryAccountName,
  viewerEmail,
  showAdminSection,
}: SidebarClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem(COMPACT_STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
    return shouldDefaultCompact();
  });
  const [groupPreference, setGroupPreference] = useState<Partial<Record<SidebarGroupId, boolean>>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(GROUP_STORAGE_KEY) || "{}") as Partial<Record<SidebarGroupId, boolean>>;
    } catch {
      return {};
    }
  });

  const expandedGroups = useMemo(() => {
    const defaults = defaultExpandedGroups({ pathname, compact: compactMode, showAdminSection });
    return { ...defaults, ...groupPreference, ...Object.fromEntries(Object.keys(defaults).map((key) => [key, defaults[key as SidebarGroupId] || groupPreference[key as SidebarGroupId]])) } as Record<SidebarGroupId, boolean>;
  }, [compactMode, groupPreference, pathname, showAdminSection]);

  useEffect(() => {
    window.localStorage.setItem(COMPACT_STORAGE_KEY, String(compactMode));
  }, [compactMode]);

  useEffect(() => {
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groupPreference));
  }, [groupPreference]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [mobileOpen]);

  return (
    <SidebarClientView
      pathname={pathname}
      primaryAccountName={primaryAccountName}
      viewerEmail={viewerEmail}
      showAdminSection={showAdminSection}
      compactMode={compactMode}
      expandedGroups={expandedGroups}
      mobileOpen={mobileOpen}
      onOpenMobile={() => setMobileOpen(true)}
      onToggleCompact={() => setCompactMode((current) => !current)}
      onToggleGroup={(groupId) => setGroupPreference((current) => ({ ...current, [groupId]: !expandedGroups[groupId] }))}
      onCloseMobile={() => setMobileOpen(false)}
      helpModeSlot={<HelpModeToggle />}
      signOutSlot={<SignOutButton />}
    />
  );
}