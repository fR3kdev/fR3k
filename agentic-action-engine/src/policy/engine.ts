import type { Policy } from '../core/types.js';
import type { ToolMetadata } from '../tools/registry.js';

export type PolicyDecision = { decision: 'allow' | 'approve' | 'deny'; reason: string };

/** Only trusted runtime configuration enters this function; never model-provided permission claims. */
export function checkPolicy(policy: Policy, tool: ToolMetadata, writes: number): PolicyDecision {
  if (!policy.allowedTools.includes(tool.name)) return { decision: 'deny', reason: 'Tool is not allowed for this mission' };
  if (tool.autonomy === 'X') return { decision: 'deny', reason: 'Tool is prohibited' };
  if (policy.sandbox && tool.environment !== 'sandbox') return { decision: 'deny', reason: 'Sandbox mission cannot call live tools' };
  if (tool.autonomy === 4 && tool.environment !== 'sandbox') return { decision: 'deny', reason: 'Level 4 requires a sandbox tool' };
  if (tool.effect === 'read') return { decision: 'allow', reason: 'Read-only observation' };
  if (policy.maxAutonomy < 2) return { decision: 'deny', reason: 'Mission permits observation or recommendation only' };
  if (writes >= policy.maxWrites) return { decision: 'deny', reason: 'Mission write budget exhausted' };
  if (tool.autonomy === 2 || tool.autonomy > policy.maxAutonomy) {
    return { decision: 'approve', reason: 'Exact action requires human approval' };
  }
  return { decision: 'allow', reason: 'Action is inside the configured autonomy and write budget' };
}
