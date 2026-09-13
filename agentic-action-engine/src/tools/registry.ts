import { createHash } from 'node:crypto';
import { z } from 'zod';
import { identifier, json, type Json } from '../core/types.js';

export interface ToolContext {
  runId: string;
  step: string;
  idempotencyKey: string;
  signal: AbortSignal;
}
export type Verification =
  | { status: 'confirmed'; source: string; observation: Json }
  | { status: 'absent' | 'unknown'; source: string; observation?: Json };
export interface ToolMetadata {
  name: string;
  description: string;
  effect: 'read' | 'write';
  autonomy: 0 | 1 | 2 | 3 | 4 | 'X';
  environment: 'live' | 'sandbox';
  reversible: boolean;
  blastRadius: string;
  idempotency: 'read-only' | 'provider-key' | 'reconcile-only';
  verificationMethod: string;
}
export interface ToolDefinition<I, O> extends ToolMetadata {
  /** Explicit implementation revision; defaults to a hash of the executable source. */
  revision?: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  execute(input: I, context: ToolContext): Promise<O>;
  verify?: (input: I, context: ToolContext, output?: O) => Promise<Verification>;
}
export interface RegisteredTool extends ToolMetadata {
  revision: string;
  inputSchema: Json;
  outputSchema: Json;
  parse(input: unknown): Json;
  execute(input: Json, context: ToolContext): Promise<Json>;
  verify(input: Json, context: ToolContext, output?: Json): Promise<Verification>;
}

/** Adapters classify errors; raw provider bodies and tokens never enter the trace. */
export class ToolFault extends Error {
  constructor(public readonly code: 'TRANSIENT' | 'UNAVAILABLE' | 'REJECTED' | 'UNCERTAIN') {
    super(code);
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register<I, O>(definition: ToolDefinition<I, O>): this {
    identifier.parse(definition.name);
    if (this.tools.has(definition.name)) throw new Error(`Duplicate tool: ${definition.name}`);
    if (definition.effect === 'write' && (!definition.verify || definition.idempotency === 'read-only'
      || definition.autonomy === 0 || definition.autonomy === 1)) {
      throw new Error('Write tools require a verifier, write idempotency semantics, and autonomy >= 2');
    }
    if (definition.effect === 'read' && definition.idempotency !== 'read-only') {
      throw new Error('Read tools must declare read-only idempotency');
    }
    for (const field of ['description', 'blastRadius', 'verificationMethod'] as const) {
      if (!definition[field].trim()) throw new Error(`Missing tool metadata: ${field}`);
    }
    const verificationSchema = z.discriminatedUnion('status', [
      z.strictObject({ status: z.literal('confirmed'), source: z.string().min(1), observation: z.json() }),
      z.strictObject({ status: z.enum(['absent', 'unknown']), source: z.string().min(1), observation: z.json().optional() }),
    ]);
    // Bind the deployed executable, not just the declared contract, so a pending
    // action cannot silently execute against changed adapter implementation.
    const revision = definition.revision ?? createHash('sha256')
      .update(`${definition.execute.toString()}\n${definition.verify?.toString() ?? ''}`).digest('hex').slice(0, 16);
    const tool: RegisteredTool = {
      ...definition,
      revision,
      inputSchema: json(z.toJSONSchema(definition.input)),
      outputSchema: json(z.toJSONSchema(definition.output)),
      parse: value => json(definition.input.parse(value)),
      execute: async (value, context) => json(definition.output.parse(
        await definition.execute(definition.input.parse(value), context),
      )),
      verify: async (value, context, output) => {
        if (!definition.verify) throw new Error('Read tool has no write verifier');
        return verificationSchema.parse(await definition.verify(
          definition.input.parse(value), context,
          output === undefined ? undefined : definition.output.parse(output),
        ));
      },
    };
    this.tools.set(definition.name, Object.freeze(tool));
    return this;
  }

  get(name: string): RegisteredTool {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolFault('UNAVAILABLE');
    return tool;
  }

  list(): RegisteredTool[] { return [...this.tools.values()]; }
}
