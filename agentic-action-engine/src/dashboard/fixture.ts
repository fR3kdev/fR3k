import { pathToFileURL } from "node:url";
import type { RunStatus, RunView, TraceEvent } from "../core/types.js";
import type { DashboardBridge } from "./bridge.js";
import { startDashboard } from "./server.js";
export function createFixtureBridge(): DashboardBridge {
  const views = new Map<string, RunView>();
  for (const [id, status] of Object.entries({
    active: "RUNNING",
    approval: "WAITING_FOR_APPROVAL",
    expired: "WAITING_FOR_APPROVAL",
    denied: "DENIED_BY_POLICY",
    unavailable: "TOOL_UNAVAILABLE",
    uncertain: "UNCERTAIN_SIDE_EFFECT",
    failure: "CONFIRMED_FAILURE",
    success: "CONFIRMED_SUCCESS",
  })) {
    const action = {
      tool: "fixture.write",
      input: {
        message: "<img src=x onerror=alert(1)>",
        long: "Example ".repeat(80),
      },
      reason: "Synthetic action citing observed evidence",
      evidenceRefs: [1],
    };
    const events: TraceEvent[] = [];
    const event = (kind: TraceEvent["kind"], data: TraceEvent["data"]) =>
      events.push({
        version: 1,
        runId: id,
        seq: events.length + 1,
        time: "2026-01-01T00:00:00.000Z",
        kind,
        data,
        previousHash: "",
        hash: "0".repeat(64),
      });
    event("tool.result", {
      tool: "fixture.read",
      label: "SIMULATION_ONLY",
      observation: { record: "Synthetic customer" },
    });
    event("memory.retrieved", {
      entries: [
        {
          id: "historical",
          world: "fixture",
          text: "Historical result, not current state",
          source: "synthetic-memory",
          outcome: "failed",
        },
      ],
    });
    event("plan.action", { action, step: "step-1" });
    if (status === "WAITING_FOR_APPROVAL")
      event("approval.requested", {
        step: "step-1",
        digest: "fixture-digest",
        expiresAt: id === "expired" ? 1 : Date.now() + 3600000,
      });
    const view: RunView = {
      mission: {
        id,
        world: "fixture-only",
        goal: "Fixture: " + id,
        context: {},
        policy: {
          allowedTools: ["fixture.write"],
          maxAutonomy: 1,
          maxWrites: 1,
          sandbox: true,
        },
        maxSteps: 10,
        maxReplans: 0,
      },
      status: status as RunStatus,
      events,
      observations: [
        {
          seq: 1,
          tool: "fixture.read",
          value: { record: "Synthetic customer" },
          label: "SIMULATION_ONLY",
        },
      ],
    };
    if (
      [
        "WAITING_FOR_APPROVAL",
        "RUNNING",
        "UNCERTAIN_SIDE_EFFECT",
        "CONFIRMED_FAILURE",
      ].includes(status)
    )
      view.pending = { step: "step-1", action, digest: "fixture-digest" };
    if (id === "success" || id === "failure")
      view.evaluation = {
        passed: id === "success",
        score: id === "success" ? 1 : 0,
        checks: [
          {
            id: "synthetic-check",
            passed: id === "success",
            detail: "Fixture evaluation only",
            evidenceRefs: [1],
          },
        ],
      };
    views.set(id, view);
  }
  const get = (id: string) => {
    const view = views.get(id);
    if (!view) throw new Error("Run not found");
    return view;
  };
  return {
    async listRuns() {
      return [...views.values()].map((v) => ({
        id: v.mission.id,
        world: v.mission.world,
        goal: v.mission.goal,
        status: v.status,
      }));
    },
    async inspect(id) {
      return structuredClone(get(id));
    },
    async approve(id, digest, actor, allow) {
      const v = get(id);
      if (v.status !== "WAITING_FOR_APPROVAL" || v.pending?.digest !== digest)
        throw new Error("Stale approval digest");
      if (
        Number(
          v.events.filter((e) => e.kind === "approval.requested").at(-1)?.data
            .expiresAt,
        ) <= Date.now()
      )
        throw new Error("Approval expired");
      v.status = allow ? "RUNNING" : "DENIED_BY_POLICY";
      v.events.push({
        version: 1,
        runId: id,
        seq: v.events.length + 1,
        time: new Date().toISOString(),
        kind: allow ? "approval.granted" : "approval.denied",
        data: { actor, digest },
        previousHash: "",
        hash: "0".repeat(64),
      });
      return structuredClone(v);
    },
    async resume(id) {
      const v = get(id);
      if (id === "expired") {
        v.events
          .filter((e) => e.kind === "approval.requested")
          .at(-1)!.data.expiresAt = Date.now() + 3600000;
      } else if (v.status === "RUNNING") {
        v.status = "CONFIRMED_SUCCESS";
        v.evaluation = { passed: true, score: 1, checks: [] };
        delete v.pending;
      }
      return structuredClone(v);
    },
    async reconcile(id) {
      const v = get(id);
      if (v.status !== "CONFIRMED_FAILURE" || !v.pending)
        throw new Error("Run is not eligible for write reconciliation");
      delete v.pending;
      v.status = "CONFIRMED_SUCCESS";
      v.evaluation = {
        passed: true,
        score: 1,
        checks: [
          {
            id: "synthetic-reconcile",
            passed: true,
            detail: "Fixture reconciliation only",
            evidenceRefs: [1],
          },
        ],
      };
      return structuredClone(v);
    },
    async compare(ids) {
      return {
        runs: ids.map((id) => {
          const v = get(id);
          return {
            runId: id,
            label: "FIXTURE",
            status: v.status,
            score: v.evaluation?.score ?? null,
            toolCalls: 1,
            policyViolations: null,
            unverifiedWrites: null,
            latencyMs: null,
            costUsd: null,
          };
        }),
      };
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = await startDashboard({ bridge: createFixtureBridge() });
  console.log("FIXTURE MODE — synthetic evidence only: " + server.url);
  process.once("SIGINT", () => void server.close());
  process.once("SIGTERM", () => void server.close());
}
