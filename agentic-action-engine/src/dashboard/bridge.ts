import type { RunView } from "../core/types.js";
export interface DashboardComparison {
  runs: Array<{
    runId: string;
    label: string;
    status: string;
    score: number | null;
    toolCalls: number;
    policyViolations: number | null;
    unverifiedWrites: number | null;
    modelCalls?: number;
    modelLatencyMs?: number | null;
    modelCostUsd?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs: number | null;
    costUsd: number | null;
  }>;
}
export interface DashboardBridge {
  listRuns(): Promise<
    Array<{ id: string; world: string; goal: string; status: string }>
  >;
  inspect(runId: string): Promise<RunView>;
  approve(
    runId: string,
    digest: string,
    actor: string,
    allow: boolean,
  ): Promise<RunView>;
  resume(runId: string): Promise<RunView>;
  reconcile(runId: string): Promise<RunView>;
  compare(runIds: [string, string]): Promise<DashboardComparison>;
}
