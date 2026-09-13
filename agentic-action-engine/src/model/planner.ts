import { z } from 'zod';
import { decisionSchema, type Decision, type Planner, type PlannerContext } from '../core/types.js';
import { boundPrompt, defaultBoundaries, guardProviderDecision, PlannerBoundaryError,
  type ModelPlannerBoundaries, type ModelPlannerProvider } from './bounded.js';

export interface BoundedModelPlannerOptions {
  provider: ModelPlannerProvider;
  toolEffect: (tool: string) => 'read' | 'write';
  boundaries?: Partial<ModelPlannerBoundaries>;
}

/**
 * A planner whose authority is bounded: it can only consider a trimmed, read-only
 * snapshot of the ledger and its output is validated against the mission policy and
 * evidence budget before the runtime ever sees it. The provider never receives the
 * trusted ledger itself, so it cannot mutate it.
 */
export function createBoundedModelPlanner(options: BoundedModelPlannerOptions): Planner {
  const boundaries: ModelPlannerBoundaries = { ...defaultBoundaries, ...options.boundaries };
  return {
    id: `bounded-${options.provider.id}`,
    async decide(context: PlannerContext, signal: AbortSignal): Promise<unknown> {
      const prompt = boundPrompt(context.mission, context.observations, context.memory, context.events, boundaries);
      let raw: unknown;
      try {
        raw = await options.provider.generate(prompt, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new PlannerBoundaryError('PROVIDER_HANG', 'provider threw or timed out');
      }
      let decision: Decision;
      try {
        decision = decisionSchema.parse(raw);
      } catch {
        throw new PlannerBoundaryError('PROVIDER_INVALID_OUTPUT', 'provider returned something that is not a decision');
      }
      guardProviderDecision(z.any().parse(raw), prompt, boundaries, options.toolEffect);
      return decision;
    },
  };
}

const endpointSchema = z.strictObject({ endpoint: z.string().url(), apiKey: z.string().min(1), apiKeyHeader: z.string().default('Authorization'), model: z.string().min(1) });
export interface FetchModelEndpoint {
  endpoint: string; apiKey: string; apiKeyHeader?: string; model: string;
}

/** OpenAI-compatible chat-completions provider used (and gated) on a real API key. */
export function createFetchModelProvider(endpoint: FetchModelEndpoint): ModelPlannerProvider {
  const config = endpointSchema.parse(endpoint);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  headers[config.apiKeyHeader] = config.apiKeyHeader === 'Authorization' ? `Bearer ${config.apiKey}` : config.apiKey;
  return {
    id: `fetch-${encodeURIComponent(config.model)}`,
    async generate(prompt, signal) {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return only a JSON object. It must conform to {kind:"action",tool,input,reason,evidenceRefs} or {kind:"finish",reason}. Cite evidenceRefs as observation sequence numbers.' },
            { role: 'user', content: JSON.stringify(prompt) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`model provider returned HTTP ${response.status}`);
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('model provider returned no content');
      return JSON.parse(content);
    },
  };
}