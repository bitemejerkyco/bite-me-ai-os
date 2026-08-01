export type MarketingDirectorMode = "advisor" | "copilot" | "autopilot";

export function resolveOperatingMode(
  requestedMode: MarketingDirectorMode,
  stagedModesAvailable: boolean,
): MarketingDirectorMode {
  if (requestedMode === "advisor") return "advisor";
  return stagedModesAvailable ? requestedMode : "advisor";
}
