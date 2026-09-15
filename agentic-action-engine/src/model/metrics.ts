import type { TraceEvent } from '../core/types.js';

/** Model request time excludes operator approval waits; absent billing stays unknown. */
export function modelMetrics(events: TraceEvent[]) {
  const calls = events.filter(event => event.kind === 'model.generation').map(event => event.data.generation as Record<string, unknown>);
  const sum = (key: string) => calls.length && calls.every(call => typeof call[key] === 'number' && Number.isFinite(call[key]))
    ? calls.reduce((total, call) => total + Number(call[key]), 0) : null;
  return { modelCalls: calls.length, modelLatencyMs: sum('elapsedMs'), modelCostUsd: sum('costUsd'), inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens') };
}
