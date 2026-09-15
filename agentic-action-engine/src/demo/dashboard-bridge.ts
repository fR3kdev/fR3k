import { modelMetrics } from '../model/metrics.js';
import { identifier, type RunView } from '../core/types.js';
import type { DashboardBridge, DashboardComparison } from '../dashboard/bridge.js';
import type { Runtime } from '../core/orchestrator.js';

/** Only explicitly attached runtime instances can be controlled by the dashboard. */
export function createRuntimeDashboardBridge(runtimes: ReadonlyMap<string, Runtime>): DashboardBridge {
  function runtime(id: string): Runtime {
    identifier.parse(id);
    const instance = runtimes.get(id);
    if (!instance) throw new Error('Run does not exist');
    return instance;
  }
  async function inspect(id: string): Promise<RunView> { return runtime(id).inspect(id); }
  return {
    async listRuns() {
      return Promise.all([...runtimes.keys()].map(async id => {
        const view = await inspect(id);
        return { id, world: view.mission.world, goal: view.mission.goal, status: view.status };
      }));
    },
    inspect,
    approve(id, digest, actor, allow) { return runtime(id).approve(id, digest, actor, allow); },
    resume(id) { return runtime(id).run(id); },
    reconcile(id) { return runtime(id).reconcileWrite(id); },
    async compare(ids): Promise<DashboardComparison> {
      return { runs: await Promise.all(ids.map(async runId => {
        const view = await inspect(runId);
        const checks = view.evaluation?.checks;
        // An absent evaluator check is unknown, including for unfinished runs.
        const policy = checks?.find(check => check.id === 'runtime.policy');
        const writes = view.events.filter(event => event.kind === 'tool.started' && event.data.effect === 'write');
        const unverifiedWrites = new Set(writes.filter(event => !view.events.some(candidate =>
          candidate.kind === 'tool.verification' && candidate.seq > event.seq && candidate.data.step === event.data.step
          && candidate.data.status === 'confirmed')).map(event => event.data.step)).size;
        return {
          ...modelMetrics(view.events),
          runId, label: view.mission.goal, status: view.status, score: view.evaluation?.score ?? null,
          toolCalls: view.events.filter(event => event.kind === 'tool.started').length,
          policyViolations: policy?.passed ? 0 : null,
          unverifiedWrites,
          // Trace timestamps include operator waiting, not measured execution latency.
          latencyMs: null, costUsd: null,
        };
      })) };
    },
  };
}
