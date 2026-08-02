function normalizeWorkflowPart(value: string | number): string {
  return String(value).trim().toLowerCase();
}

function buildWorkflowKeyFromParts(parts: Array<string | number>): string {
  return parts.map(normalizeWorkflowPart).join("|").slice(0, 240);
}

export function buildShortVideoWorkflowKey(input: {
  workspaceId: string;
  channel: string;
  objective: string;
  message: string;
  callToAction: string;
  durationSeconds: number;
  voice: string;
  musicMode: string;
}): string {
  return buildWorkflowKeyFromParts([
    input.workspaceId,
    input.channel,
    input.objective,
    input.message,
    input.callToAction,
    input.durationSeconds,
    input.voice,
    input.musicMode,
  ]);
}

export function buildLegacyRenderWorkflowKey(input: {
  workspaceId: string;
  prompt: string;
  seconds: number;
  sourceVideoId: string;
  requestedTier: string;
}): string {
  return buildWorkflowKeyFromParts([
    input.workspaceId,
    "legacy-render",
    input.prompt,
    input.seconds,
    input.sourceVideoId || "fresh",
    input.requestedTier || "auto",
  ]);
}
