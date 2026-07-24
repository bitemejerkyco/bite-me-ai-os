export type FeatureFlagKey =
  | "brandBrainFoundation"
  | "brandBrainIntelligence"
  | "knowledgeHub"
  | "aiEmployees"
  | "contentStudio"
  | "campaigns"
  | "publishing"
  | "analytics"
  | "billing"
  | "agencyMode"
  | "approvals";

export type FeatureFlagState = "implemented" | "planned" | "proposed";

export type FeatureFlagMap = Record<FeatureFlagKey, FeatureFlagState>;
