import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DASHBOARD_NAVIGATION } from "@/config/navigation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleFromPathname(pathname: string) {
  const match = DASHBOARD_NAVIGATION.find((item) => item.href === pathname);
  if (match) return match.label;
  if (pathname === "/") return "Mission Control";
  return "Mission Control";
}
