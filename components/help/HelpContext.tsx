"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { getPageHelp, normalizeHelpRoute } from "@/features/help/page-help-registry";
import { getWalkthrough, WALKTHROUGH_REGISTRY } from "@/features/help/walkthrough-registry";
import { resolveTrainerPrompt, type TrainerPrompt } from "@/features/help/trainer-rules";
import type { HelpMode, PageHelpEntry, WalkthroughDefinition } from "@/features/help/types";

type HelpPreferenceState = {
  helpMode: HelpMode;
  compactPanels: boolean;
  proactiveTrainerEnabled: boolean;
};

type HelpContextPayload = {
  preference: HelpPreferenceState;
  setHelpMode: (mode: HelpMode) => Promise<void>;
  setCompactPanels: (value: boolean) => Promise<void>;
  pageHelp: PageHelpEntry | null;
  currentRoute: string;
  visitCount: number;
  panelExpanded: boolean;
  setPanelExpanded: (expanded: boolean) => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  assistantOpen: boolean;
  setAssistantOpen: (value: boolean) => void;
  trainerPrompt: TrainerPrompt | null;
  dismissTrainerPrompt: (input: { dontShowAgain?: boolean }) => Promise<void>;
  walkthrough: {
    active: WalkthroughDefinition | null;
    stepIndex: number;
    start: (walkthroughId?: string) => Promise<void>;
    next: () => Promise<void>;
    back: () => Promise<void>;
    skip: () => Promise<void>;
    finish: () => Promise<void>;
    resume: () => Promise<void>;
    restart: () => Promise<void>;
  };
  helpContextData: {
    onboardingPercent: number;
    pendingApprovals: number;
    connectedIntegrations: number;
    isSuperAdmin: boolean;
    betaTesterMode: boolean;
    appVersion: string;
  };
};

const HelpContext = createContext<HelpContextPayload | null>(null);

const VISIT_KEY = "postmotive-help-route-visits";
const PANEL_KEY = "postmotive-help-panel-expanded";
const WALKTHROUGH_KEY = "postmotive-help-active-walkthrough";
const SESSION_PROMPT_KEY = "postmotive-help-prompt-session";

async function postJson(url: string, body: Record<string, unknown>) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function HelpProvider({
  children,
  initialPreference,
  initialIsSuperAdmin,
}: {
  children: ReactNode;
  initialPreference: HelpPreferenceState;
  initialIsSuperAdmin: boolean;
}) {
  const pathname = normalizeHelpRoute(usePathname() || "/");
  const [preference, setPreference] = useState(initialPreference);
  const [routeVisits, setRouteVisits] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(VISIT_KEY) || "{}") as Record<string, number>;
    } catch {
      return {};
    }
  });
  const [panelExpandedState, setPanelExpandedState] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(PANEL_KEY) || "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [secondsOnPage, setSecondsOnPage] = useState(0);
  const [helpContextData, setHelpContextData] = useState({
    onboardingPercent: 0,
    pendingApprovals: 0,
    connectedIntegrations: 0,
    isSuperAdmin: initialIsSuperAdmin,
    betaTesterMode: false,
    appVersion: "dev",
  });
  const [activeWalkthrough, setActiveWalkthrough] = useState<WalkthroughDefinition | null>(null);
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState(0);

  const pageHelp = useMemo(() => getPageHelp(pathname), [pathname]);
  const visitCount = routeVisits[pathname] || 0;
  const panelExpanded = panelExpandedState[pathname] ?? !(preference.compactPanels || (preference.helpMode === "AUTO" && visitCount > 2));

  useEffect(() => {
    try {
      const savedWalkthrough = JSON.parse(sessionStorage.getItem(WALKTHROUGH_KEY) || "null");
      if (savedWalkthrough?.id) {
        const walkthrough = WALKTHROUGH_REGISTRY.find((item) => item.id === savedWalkthrough.id) || null;
        if (walkthrough) {
          const handle = window.requestAnimationFrame(() => {
            setActiveWalkthrough(walkthrough);
            setWalkthroughStepIndex(Number(savedWalkthrough.stepIndex || 0));
          });
          return () => window.cancelAnimationFrame(handle);
        }
      }
    } catch {
      // ignore local persistence failures
    }
    return undefined;
  }, []);

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      setRouteVisits((current) => {
        const next = { ...current, [pathname]: (current[pathname] || 0) + 1 };
        localStorage.setItem(VISIT_KEY, JSON.stringify(next));
        return next;
      });
      setSecondsOnPage(0);
    });

    void fetch(`/api/help/context?route=${encodeURIComponent(pathname)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload?.ok) return;
        const onboardingPercent = Number(payload.data?.onboarding?.percentage || 0);
        const pendingApprovals = Number(payload.data?.workflow?.pendingApprovals || 0);
        const connectedIntegrations = Array.isArray(payload.data?.integrations)
          ? payload.data.integrations.filter((item: { state?: string }) => item.state === "connected").length
          : 0;
        setHelpContextData({
          onboardingPercent,
          pendingApprovals,
          connectedIntegrations,
          isSuperAdmin: Boolean(payload.data?.viewer?.isSuperAdmin || initialIsSuperAdmin),
          betaTesterMode: Boolean(payload.data?.betaTesterMode),
          appVersion: String(payload.data?.appVersion || "dev"),
        });
        if (payload.data?.preference) {
          setPreference({
            helpMode: payload.data.preference.helpMode || initialPreference.helpMode,
            compactPanels: Boolean(payload.data.preference.compactPanels),
            proactiveTrainerEnabled: payload.data.preference.proactiveTrainerEnabled !== false,
          });
        }
      })
      .catch(() => undefined);
    return () => window.cancelAnimationFrame(handle);
  }, [initialIsSuperAdmin, initialPreference.helpMode, pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsOnPage((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [pathname]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const trainerPrompt = useMemo(() => {
    const sessionPromptMap = JSON.parse(sessionStorage.getItem(SESSION_PROMPT_KEY) || "{}");
    return resolveTrainerPrompt({
      route: pathname,
      helpMode: preference.helpMode,
      proactiveTrainerEnabled: preference.proactiveTrainerEnabled,
      isSuperAdmin: helpContextData.isSuperAdmin,
      visitCount,
      secondsOnPage,
      pendingApprovals: helpContextData.pendingApprovals,
      onboardingPercent: helpContextData.onboardingPercent,
      connectedIntegrations: helpContextData.connectedIntegrations,
      walkthroughAbandoned: Boolean(activeWalkthrough && activeWalkthrough.route !== pathname),
      dismissed: Boolean(sessionPromptMap[pathname]),
    });
  }, [activeWalkthrough, helpContextData, pathname, preference, secondsOnPage, visitCount]);

  async function persistPreference(next: Partial<HelpPreferenceState>) {
    const merged = { ...preference, ...next };
    setPreference(merged);
    await postJson("/api/help/preferences", {
      helpMode: merged.helpMode,
      compactPanels: merged.compactPanels,
      proactiveTrainerEnabled: merged.proactiveTrainerEnabled,
    }).catch(() => undefined);
  }

  function setPanelExpanded(expanded: boolean) {
    const next = { ...panelExpandedState, [pathname]: expanded };
    setPanelExpandedState(next);
    localStorage.setItem(PANEL_KEY, JSON.stringify(next));
    if (!expanded && !preference.compactPanels) {
      void persistPreference({ compactPanels: true });
    }
  }

  async function dismissTrainerPrompt(input: { dontShowAgain?: boolean }) {
    const sessionPromptMap = JSON.parse(sessionStorage.getItem(SESSION_PROMPT_KEY) || "{}");
    sessionPromptMap[pathname] = true;
    sessionStorage.setItem(SESSION_PROMPT_KEY, JSON.stringify(sessionPromptMap));
    if (trainerPrompt) {
      await postJson("/api/help/walkthrough", {
        action: "dismiss_prompt",
        promptKey: trainerPrompt.promptKey,
        route: pathname,
        dontShowAgain: Boolean(input.dontShowAgain),
      }).catch(() => undefined);
    }
  }

  async function startWalkthrough(walkthroughId?: string) {
    const walkthrough = WALKTHROUGH_REGISTRY.find((item) => item.id === walkthroughId)
      || getWalkthrough(pathname)
      || null;
    if (!walkthrough) return;
    setActiveWalkthrough(walkthrough);
    setWalkthroughStepIndex(0);
    sessionStorage.setItem(WALKTHROUGH_KEY, JSON.stringify({ id: walkthrough.id, stepIndex: 0 }));
    await postJson("/api/help/walkthrough", { action: "start", walkthroughId: walkthrough.id, route: walkthrough.route, version: walkthrough.version, stepIndex: 0 }).catch(() => undefined);
  }

  async function nextWalkthroughStep() {
    if (!activeWalkthrough) return;
    const nextIndex = Math.min(walkthroughStepIndex + 1, activeWalkthrough.steps.length - 1);
    await postJson("/api/help/walkthrough", { action: "step", walkthroughId: activeWalkthrough.id, route: activeWalkthrough.route, version: activeWalkthrough.version, stepIndex: nextIndex }).catch(() => undefined);
    if (walkthroughStepIndex >= activeWalkthrough.steps.length - 1) {
      await finishWalkthrough();
      return;
    }
    setWalkthroughStepIndex(nextIndex);
    sessionStorage.setItem(WALKTHROUGH_KEY, JSON.stringify({ id: activeWalkthrough.id, stepIndex: nextIndex }));
  }

  async function backWalkthroughStep() {
    if (!activeWalkthrough) return;
    const nextIndex = Math.max(walkthroughStepIndex - 1, 0);
    setWalkthroughStepIndex(nextIndex);
    sessionStorage.setItem(WALKTHROUGH_KEY, JSON.stringify({ id: activeWalkthrough.id, stepIndex: nextIndex }));
  }

  async function skipWalkthrough() {
    if (!activeWalkthrough) return;
    await postJson("/api/help/walkthrough", { action: "skip", walkthroughId: activeWalkthrough.id, route: activeWalkthrough.route, version: activeWalkthrough.version, stepIndex: walkthroughStepIndex }).catch(() => undefined);
    setActiveWalkthrough(null);
    sessionStorage.removeItem(WALKTHROUGH_KEY);
  }

  async function finishWalkthrough() {
    if (!activeWalkthrough) return;
    await postJson("/api/help/walkthrough", { action: "finish", walkthroughId: activeWalkthrough.id, route: activeWalkthrough.route, version: activeWalkthrough.version, stepIndex: walkthroughStepIndex }).catch(() => undefined);
    setActiveWalkthrough(null);
    sessionStorage.removeItem(WALKTHROUGH_KEY);
  }

  async function resumeWalkthrough() {
    if (!activeWalkthrough) {
      await startWalkthrough();
      return;
    }
    setActiveWalkthrough(activeWalkthrough);
  }

  async function restartWalkthrough() {
    if (!activeWalkthrough) {
      await startWalkthrough();
      return;
    }
    setWalkthroughStepIndex(0);
    sessionStorage.setItem(WALKTHROUGH_KEY, JSON.stringify({ id: activeWalkthrough.id, stepIndex: 0 }));
    await postJson("/api/help/walkthrough", { action: "restart", walkthroughId: activeWalkthrough.id, route: activeWalkthrough.route, version: activeWalkthrough.version, stepIndex: 0 }).catch(() => undefined);
  }

  const value: HelpContextPayload = {
    preference,
    setHelpMode: async (helpMode) => persistPreference({ helpMode }),
    setCompactPanels: async (compactPanels) => persistPreference({ compactPanels }),
    pageHelp,
    currentRoute: pathname,
    visitCount,
    panelExpanded,
    setPanelExpanded,
    searchOpen,
    openSearch: () => setSearchOpen(true),
    closeSearch: () => setSearchOpen(false),
    assistantOpen,
    setAssistantOpen,
    trainerPrompt,
    dismissTrainerPrompt,
    walkthrough: {
      active: activeWalkthrough,
      stepIndex: walkthroughStepIndex,
      start: startWalkthrough,
      next: nextWalkthroughStep,
      back: backWalkthroughStep,
      skip: skipWalkthrough,
      finish: finishWalkthrough,
      resume: resumeWalkthrough,
      restart: restartWalkthrough,
    },
    helpContextData,
  };

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error("useHelp must be used inside HelpProvider");
  }
  return context;
}
