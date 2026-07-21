"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboardIcon,
  MegaphoneIcon,
  FileTextIcon,
  CalendarIcon,
  BookOpenIcon,
  BrainIcon,
  ImageIcon,
  BarChart2Icon,
  BotIcon,
  CreditCardIcon,
  SettingsIcon,
  ChevronLeftIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Mission Control", href: "/dashboard", icon: <LayoutDashboardIcon className="h-4 w-4" /> },
  { label: "Campaigns", href: "/campaigns", icon: <MegaphoneIcon className="h-4 w-4" /> },
  { label: "Content Studio", href: "/content-studio", icon: <FileTextIcon className="h-4 w-4" /> },
  { label: "Marketing Calendar", href: "/marketing-calendar", icon: <CalendarIcon className="h-4 w-4" /> },
  { label: "Knowledge Hub", href: "/knowledge-hub", icon: <BookOpenIcon className="h-4 w-4" /> },
  { label: "Brand Brain", href: "/brand-brain", icon: <BrainIcon className="h-4 w-4" /> },
  { label: "Media Library", href: "/media-library", icon: <ImageIcon className="h-4 w-4" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart2Icon className="h-4 w-4" /> },
  { label: "AI Employees", href: "/ai-employees", icon: <BotIcon className="h-4 w-4" /> },
];

const bottomNavItems: NavItem[] = [
  { label: "Billing", href: "/billing", icon: <CreditCardIcon className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <SettingsIcon className="h-4 w-4" /> },
];

interface SidebarNavItemProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function SidebarNavItem({ item, isActive, collapsed }: SidebarNavItemProps) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
        isActive
          ? "bg-red-600/10 text-red-400"
          : "text-zinc-400 hover:bg-[#1e1e1e] hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className={`shrink-0 ${isActive ? "text-red-400" : "text-zinc-500 group-hover:text-white"}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="sr-only">{item.label}</span>
      )}
    </Link>
  );
}

interface SidebarGroupProps {
  label?: string;
  children: React.ReactNode;
  collapsed: boolean;
}

function SidebarGroup({ label, children, collapsed }: SidebarGroupProps) {
  return (
    <div className="space-y-0.5">
      {label && !collapsed && (
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#1e1e1e] bg-[#111111] transition-all duration-300 ease-in-out
          ${collapsed ? "w-16" : "w-60"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        aria-label="Main navigation"
      >
        {/* Logo area */}
        <div className={`flex h-16 shrink-0 items-center border-b border-[#1e1e1e] px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <span className="text-base font-bold tracking-tight text-white">
              <span className="text-red-500">Bite Me</span> AI OS
            </span>
          )}
          {collapsed && (
            <span className="font-bold text-red-500 text-lg">B</span>
          )}
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="hidden rounded-lg p-1.5 text-zinc-500 hover:bg-[#1e1e1e] hover:text-white lg:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeftIcon className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          </button>
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-[#1e1e1e] hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Close navigation"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3" role="navigation">
          <SidebarGroup label="Platform" collapsed={collapsed}>
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isActive={
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href)
                }
                collapsed={collapsed}
              />
            ))}
          </SidebarGroup>

          <div className="mt-auto">
            <SidebarGroup label="Account" collapsed={collapsed}>
              {bottomNavItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isActive={pathname.startsWith(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </SidebarGroup>
          </div>
        </nav>
      </aside>

      {/* Mobile toggle button (rendered outside sidebar) */}
      <button
        className="fixed bottom-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        onClick={onMobileClose}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>
    </>
  );
}

export { SidebarGroup };
export type { NavItem };
