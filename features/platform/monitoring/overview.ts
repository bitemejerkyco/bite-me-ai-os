import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type MonitoringSnapshot = {
  id?: string;
  scope?: string | null;
  server_health?: string | null;
  queue_depth?: number | null;
  publishing_failures?: number | null;
  oauth_failures?: number | null;
  integration_health?: string | null;
  ai_latency_ms?: number | null;
  worker_health?: string | null;
  db_latency_ms?: number | null;
  captured_at?: string | null;
};

type BackupRun = {
  id?: string;
  backup_scope?: string | null;
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type RestoreTest = {
  id?: string;
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type ReplayOperation = {
  id?: string;
  replay_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export async function loadAdminOperationsOverview() {
  const admin = createAdminClient();

  const [snapshotResult, backupResult, restoreResult, replayResult, supportResult] = await Promise.all([
    admin
      .from("workspace_monitoring_snapshots")
      .select("id,scope,server_health,queue_depth,publishing_failures,oauth_failures,integration_health,ai_latency_ms,worker_health,db_latency_ms,captured_at")
      .order("captured_at", { ascending: false })
      .limit(10),
    admin
      .from("workspace_backup_runs")
      .select("id,backup_scope,status,started_at,completed_at")
      .order("started_at", { ascending: false })
      .limit(10),
    admin
      .from("workspace_restore_tests")
      .select("id,status,started_at,completed_at")
      .order("started_at", { ascending: false })
      .limit(10),
    admin
      .from("workspace_replay_operations")
      .select("id,replay_type,status,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("workspace_support_threads")
      .select("id,status")
      .eq("status", "OPEN"),
  ]);

  if (snapshotResult.error) {
    throw new Error(`MONITORING_LOAD_FAILED:${snapshotResult.error.message}`);
  }

  return {
    snapshots: (snapshotResult.data as MonitoringSnapshot[] | null) || [],
    backupRuns: (backupResult.data as BackupRun[] | null) || [],
    restoreTests: (restoreResult.data as RestoreTest[] | null) || [],
    replayOperations: (replayResult.data as ReplayOperation[] | null) || [],
    openSupportThreads: ((supportResult.data as Array<{ id?: string }> | null) || []).length,
  };
}
