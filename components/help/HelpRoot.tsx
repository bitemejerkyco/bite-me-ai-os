"use client";

import type { ReactNode } from "react";
import HelpAssistant from "@/components/help/HelpAssistant";
import { HelpProvider } from "@/components/help/HelpContext";
import HelpSearchDialog from "@/components/help/HelpSearchDialog";
import TrainerPrompt from "@/components/help/TrainerPrompt";
import WalkthroughOverlay from "@/components/help/WalkthroughOverlay";
import type { HelpMode } from "@/features/help/types";

export default function HelpRoot({
  children,
  initialPreference,
  initialIsSuperAdmin,
}: {
  children: ReactNode;
  initialPreference: {
    helpMode: HelpMode;
    compactPanels: boolean;
    proactiveTrainerEnabled: boolean;
  };
  initialIsSuperAdmin: boolean;
}) {
  return (
    <HelpProvider initialPreference={initialPreference} initialIsSuperAdmin={initialIsSuperAdmin}>
      {children}
      <HelpSearchDialog />
      <HelpAssistant />
      <TrainerPrompt />
      <WalkthroughOverlay />
    </HelpProvider>
  );
}
