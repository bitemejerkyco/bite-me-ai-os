import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SIDEBAR_GROUPS, activeGroupIds, defaultExpandedGroups } from "@/features/navigation/sidebar-config";
import { SidebarClientView } from "@/components/SidebarClient";

describe("sidebar navigation", () => {
  it("keeps active route group expanded automatically", () => {
    const expanded = defaultExpandedGroups({ pathname: "/settings/billing", compact: false, showAdminSection: false });
    expect(expanded.account).toBe(true);
    expect(activeGroupIds("/settings/billing")).toContain("account");
  });

  it("includes admin group only for authorized users", () => {
    const adminGroup = SIDEBAR_GROUPS.find((group) => group.id === "admin");
    expect(adminGroup?.links.map((item) => item.label)).toContain("Admin Console");

    const customerHtml = renderToStaticMarkup(
      createElement(SidebarClientView, {
        pathname: "/",
        primaryAccountName: "Workspace",
        viewerEmail: "user@example.com",
        showAdminSection: false,
        compactMode: false,
        expandedGroups: defaultExpandedGroups({ pathname: "/", compact: false, showAdminSection: false }),
        mobileOpen: false,
        onOpenMobile: () => undefined,
      }),
    );
    expect(customerHtml).not.toContain("Admin Console");

    const adminHtml = renderToStaticMarkup(
      createElement(SidebarClientView, {
        pathname: "/admin",
        primaryAccountName: "Workspace",
        viewerEmail: "admin@example.com",
        showAdminSection: true,
        compactMode: false,
        expandedGroups: defaultExpandedGroups({ pathname: "/admin", compact: false, showAdminSection: true }),
        mobileOpen: false,
        onOpenMobile: () => undefined,
      }),
    );
    expect(adminHtml).toContain("Admin Console");
    expect(adminHtml).toContain("Integration Operations");
    expect(adminHtml).toContain("Tester Checklist");
    expect(adminHtml).toContain("Feedback");
  });

  it("renders dedicated header, scroll container, and footer regions", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarClientView, {
        pathname: "/",
        primaryAccountName: "Workspace",
        viewerEmail: "user@example.com",
        showAdminSection: false,
        compactMode: false,
        expandedGroups: defaultExpandedGroups({ pathname: "/", compact: false, showAdminSection: false }),
        mobileOpen: false,
        onOpenMobile: () => undefined,
      }),
    );

    expect(html).toContain("data-sidebar-header");
    expect(html).toContain("data-sidebar-scroll");
    expect(html).toContain("data-sidebar-footer");
    expect(html).toContain("100dvh");
  });

  it("renders compact mode with icon-only navigation labels hidden visually but available by aria label", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarClientView, {
        pathname: "/",
        primaryAccountName: "Workspace",
        viewerEmail: "user@example.com",
        showAdminSection: false,
        compactMode: true,
        expandedGroups: defaultExpandedGroups({ pathname: "/", compact: true, showAdminSection: false }),
        mobileOpen: false,
        onOpenMobile: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Dashboard"');
    expect(html).toContain('title="Dashboard"');
  });

  it("renders mobile drawer state and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarClientView, {
        pathname: "/help",
        primaryAccountName: "Workspace",
        viewerEmail: "user@example.com",
        showAdminSection: false,
        compactMode: false,
        expandedGroups: defaultExpandedGroups({ pathname: "/help", compact: false, showAdminSection: false }),
        mobileOpen: true,
        onOpenMobile: () => undefined,
      }),
    );

    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Help &amp; Academy');
  });
});
