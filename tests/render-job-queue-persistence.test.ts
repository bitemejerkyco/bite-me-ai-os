import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = {
  id: string;
  workspace_id: string;
  project_id: string;
  workflow_key: string;
  provider: string;
  status: string;
  attempt: number;
  progress_percent: number;
  provider_job_id: string | null;
  output_url: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function createAdminStub(initialRows: Row[] = []) {
  const rows = [...initialRows];
  let sequence = 0;

  class Builder {
    private op: "select" | "insert" | "update" | null = null;
    private payload: Record<string, unknown> | null = null;
    private filters = new Map<string, unknown>();

    constructor(private readonly table: string) {}

    select(): this {
      if (!this.op) this.op = "select";
      return this;
    }

    insert(payload: Record<string, unknown>): this {
      this.op = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: Record<string, unknown>): this {
      this.op = "update";
      this.payload = payload;
      return this;
    }

    eq(key: string, value: unknown): this {
      this.filters.set(key, value);
      return this;
    }

    order(): this {
      return this;
    }

    limit(): this {
      return this;
    }

    maybeSingle = async () => {
      if (this.table !== "video_render_jobs") {
        return { data: null, error: null };
      }

      if (this.op === "update" && this.payload) {
        const target = rows.find((row) => [...this.filters.entries()].every(([key, value]) => (row as Record<string, unknown>)[key] === value));
        if (!target) return { data: null, error: null };
        Object.assign(target, this.payload, { updated_at: nowIso() });
        return { data: target, error: null };
      }

      const data = rows.find((row) => [...this.filters.entries()].every(([key, value]) => (row as Record<string, unknown>)[key] === value)) || null;
      return { data, error: null };
    };

    single = async () => {
      if (this.table !== "video_render_jobs") {
        return { data: null, error: null };
      }

      if (this.op === "insert" && this.payload) {
        sequence += 1;
        const created: Row = {
          id: `job-${sequence}`,
          workspace_id: String(this.payload.workspace_id),
          project_id: String(this.payload.project_id),
          workflow_key: String(this.payload.workflow_key),
          provider: String(this.payload.provider),
          status: String(this.payload.status || "queued"),
          attempt: Number(this.payload.attempt || 1),
          progress_percent: Number(this.payload.progress_percent || 0),
          provider_job_id: null,
          output_url: null,
          failure_code: null,
          failure_reason: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        rows.push(created);
        return { data: created, error: null };
      }

      if (this.op === "update" && this.payload) {
        const target = rows.find((row) => [...this.filters.entries()].every(([key, value]) => (row as Record<string, unknown>)[key] === value));
        if (!target) return { data: null, error: { message: "not found" } };
        Object.assign(target, this.payload, { updated_at: nowIso() });
        return { data: target, error: null };
      }

      const data = rows.find((row) => [...this.filters.entries()].every(([key, value]) => (row as Record<string, unknown>)[key] === value)) || null;
      return { data, error: data ? null : { message: "not found" } };
    };
  }

  return {
    from(table: string) {
      return new Builder(table);
    },
    snapshot() {
      return rows;
    },
  };
}

const state = vi.hoisted(() => ({
  admin: createAdminStub(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => state.admin,
}));

describe("SupabaseRenderJobQueue", () => {
  beforeEach(() => {
    state.admin = createAdminStub();
  });

  it("persists jobs and keeps workflow idempotency by workspace", async () => {
    const { SupabaseRenderJobQueue } = await import("@/features/core/render-job-queue");
    const queue = new SupabaseRenderJobQueue();

    const first = await queue.createJob({
      workspaceId: "workspace-1",
      projectId: "project-1",
      workflowKey: "wf-1",
      prompt: "Prompt",
      durationSeconds: 12,
      qualityTier: "ECONOMY",
      provider: "INTERNAL",
    });

    const second = await queue.createJob({
      workspaceId: "workspace-1",
      projectId: "project-1",
      workflowKey: "wf-1",
      prompt: "Prompt",
      durationSeconds: 12,
      qualityTier: "ECONOMY",
      provider: "INTERNAL",
    });

    expect(second.id).toBe(first.id);
    expect(state.admin.snapshot()).toHaveLength(1);
  });

  it("claims only queued jobs in the requested workspace", async () => {
    state.admin = createAdminStub([
      {
        id: "job-a",
        workspace_id: "workspace-a",
        project_id: "project-a",
        workflow_key: "wf-a",
        provider: "INTERNAL",
        status: "queued",
        attempt: 1,
        progress_percent: 0,
        provider_job_id: null,
        output_url: null,
        failure_code: null,
        failure_reason: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: "job-b",
        workspace_id: "workspace-b",
        project_id: "project-b",
        workflow_key: "wf-b",
        provider: "INTERNAL",
        status: "queued",
        attempt: 1,
        progress_percent: 0,
        provider_job_id: null,
        output_url: null,
        failure_code: null,
        failure_reason: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ]);

    const { SupabaseRenderJobQueue } = await import("@/features/core/render-job-queue");
    const queue = new SupabaseRenderJobQueue();
    const claimed = await queue.claimJob({ workspaceId: "workspace-b", workerId: "worker-1" });

    expect(claimed?.id).toBe("job-b");
    expect(claimed?.status).toBe("claimed");
  });
});
