import type { CreationMode } from "@/features/core/creative-spec";

export type CreatorTemplate = {
  id: string;
  name: string;
  creationMode: CreationMode;
  summary: string;
  defaultConcept: string;
  defaultObjective: string;
  defaultCallToAction: string;
  sceneStructure: string[];
  hookTimingSeconds: number;
  textPositions: string[];
  productPlacement: string;
  captionStyle: string;
  ctaTimingSeconds: number;
  animationDefaults: string[];
  platformSafeZones: {
    topPercent: number;
    bottomPercent: number;
    leftPercent: number;
    rightPercent: number;
  };
};

export const CREATOR_TEMPLATES: CreatorTemplate[] = [
  {
    id: "template-pattern-interrupt",
    name: "Pattern Interrupt",
    creationMode: "VIRAL_READY_VIDEO",
    summary: "Fast visual disruption followed by a clean value reveal.",
    defaultConcept: "Feature one flagship product in dynamic lifestyle moments.",
    defaultObjective: "Drive product consideration",
    defaultCallToAction: "Shop now",
    sceneStructure: ["Interrupt", "Context", "Product proof", "CTA close"],
    hookTimingSeconds: 1,
    textPositions: ["top-center", "center", "lower-third"],
    productPlacement: "center frame",
    captionStyle: "high-contrast bold",
    ctaTimingSeconds: 10,
    animationDefaults: ["POP", "SLIDE", "PULSE"],
    platformSafeZones: { topPercent: 8, bottomPercent: 16, leftPercent: 6, rightPercent: 6 },
  },
  {
    id: "template-problem-solution",
    name: "Problem to Solution",
    creationMode: "PRODUCT_ADVERTISEMENT",
    summary: "Open with friction, resolve with product-led proof.",
    defaultConcept: "Capture a first-use reaction with sensory details.",
    defaultObjective: "Generate sales",
    defaultCallToAction: "Try it today",
    sceneStructure: ["Problem", "Escalation", "Product intro", "Outcome", "CTA"],
    hookTimingSeconds: 2,
    textPositions: ["top-left", "center", "bottom-center"],
    productPlacement: "center-right",
    captionStyle: "clean subtitle",
    ctaTimingSeconds: 11,
    animationDefaults: ["FADE", "SLIDE", "ZOOM"],
    platformSafeZones: { topPercent: 8, bottomPercent: 18, leftPercent: 6, rightPercent: 6 },
  },
  {
    id: "template-product-reveal",
    name: "Product Reveal",
    creationMode: "PRODUCT_DEMO",
    summary: "Staged reveal rhythm that lands on a product hero moment.",
    defaultConcept: "Hide the hero detail first, then reveal the full product at peak beat.",
    defaultObjective: "Demonstrate value",
    defaultCallToAction: "See the difference",
    sceneStructure: ["Tease", "Build tension", "Reveal", "Feature stack", "CTA"],
    hookTimingSeconds: 1,
    textPositions: ["center", "upper-third", "lower-third"],
    productPlacement: "center frame",
    captionStyle: "bold uppercase",
    ctaTimingSeconds: 12,
    animationDefaults: ["ZOOM", "BOUNCE", "PULSE"],
    platformSafeZones: { topPercent: 9, bottomPercent: 16, leftPercent: 5, rightPercent: 5 },
  },
  {
    id: "template-three-reasons",
    name: "Three Reasons",
    creationMode: "CAPTION_VIDEO",
    summary: "Numbered value progression with retention-oriented pacing.",
    defaultConcept: "Present three short product reasons with escalating impact.",
    defaultObjective: "Build trust",
    defaultCallToAction: "Save this",
    sceneStructure: ["Hook", "Reason 1", "Reason 2", "Reason 3", "CTA"],
    hookTimingSeconds: 1,
    textPositions: ["top-center", "center", "bottom-center"],
    productPlacement: "lower-right",
    captionStyle: "numbered card",
    ctaTimingSeconds: 11,
    animationDefaults: ["WORD_BY_WORD", "FADE", "POP"],
    platformSafeZones: { topPercent: 7, bottomPercent: 20, leftPercent: 6, rightPercent: 6 },
  },
  {
    id: "template-meme-remix",
    name: "Meme Remix",
    creationMode: "ANIMATED_MEME",
    summary: "Lightweight reaction setup with visual punchline timing.",
    defaultConcept: "Build a relatable tension and flip it with a branded punchline.",
    defaultObjective: "Drive engagement",
    defaultCallToAction: "Tag a friend",
    sceneStructure: ["Setup caption", "Reaction beat", "Punchline caption", "Brand tag"],
    hookTimingSeconds: 1,
    textPositions: ["top-center", "bottom-center"],
    productPlacement: "center frame",
    captionStyle: "meme block",
    ctaTimingSeconds: 9,
    animationDefaults: ["SHAKE", "PULSE", "KARAOKE_HIGHLIGHT"],
    platformSafeZones: { topPercent: 6, bottomPercent: 22, leftPercent: 6, rightPercent: 6 },
  },
];

export function listTemplatesForMode(mode: CreationMode): CreatorTemplate[] {
  return CREATOR_TEMPLATES.filter((template) => template.creationMode === mode);
}

export function resolveCreatorTemplate(templateId: string | null | undefined): CreatorTemplate {
  const fallback = CREATOR_TEMPLATES[0];
  if (!templateId) return fallback;
  return CREATOR_TEMPLATES.find((template) => template.id === templateId) || fallback;
}
