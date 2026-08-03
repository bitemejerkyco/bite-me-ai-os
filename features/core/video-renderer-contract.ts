export type VideoRendererProvider = "OPENAI" | "REPLICATE" | "INTERNAL";

export type RenderJobStatus =
  | "queued"
  | "claimed"
  | "in_progress"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export type CreateRenderJobInput = {
  workspaceId: string;
  projectId: string;
  workflowKey: string;
  prompt: string;
  durationSeconds: number;
  qualityTier: "ECONOMY" | "BALANCED" | "PREMIUM";
  provider: VideoRendererProvider;
  metadata?: Record<string, unknown>;
};

export type RenderJobRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  workflowKey: string;
  provider: VideoRendererProvider;
  status: RenderJobStatus;
  attempt: number;
  progressPercent: number;
  providerJobId?: string;
  outputUrl?: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type RendererProgressEvent = {
  jobId: string;
  status: RenderJobStatus;
  progressPercent: number;
  providerJobId?: string;
  failureCode?: string;
  failureReason?: string;
  outputUrl?: string;
};

export interface VideoRendererQueue {
  createJob(input: CreateRenderJobInput): Promise<RenderJobRecord>;
  claimJob(input: { workspaceId: string; workerId: string }): Promise<RenderJobRecord | null>;
  updateProgress(event: RendererProgressEvent): Promise<RenderJobRecord>;
  completeJob(input: { jobId: string; outputUrl: string }): Promise<RenderJobRecord>;
  failJob(input: { jobId: string; failureCode: string; failureReason: string }): Promise<RenderJobRecord>;
  retryJob(input: { jobId: string; reason: string }): Promise<RenderJobRecord>;
}
