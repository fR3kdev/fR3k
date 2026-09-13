import { z } from 'zod';
import { decisionSchema, json, missionSchema, type Action, type Evaluator, type Json, type Planner, type PlannerContext, type RunStatus, type RunView } from './types.js';
import { project, terminal } from './state-machine.js';
import { TraceStore, digest, type Journal } from '../trace/jsonl.js';
import { ToolFault, ToolRegistry, type RegisteredTool, type ToolContext, type Verification } from '../tools/registry.js';
import { checkPolicy } from '../policy/engine.js';
import { evaluateTrajectory } from '../eval/evaluator.js';
import { MemoryStore, memorySchema } from '../memory/store.js';

export interface RuntimeOptions { timeoutMs?: number; approvalTtlMs?: number; maxReadAttempts?: number }

export class Runtime {
  readonly timeoutMs: number;
  readonly approvalTtlMs: number;
  readonly maxReadAttempts: number;
  constructor(
    readonly store: TraceStore,
    readonly tools: ToolRegistry,
    readonly planner: Planner,
    readonly evaluator: Evaluator,
    readonly memory = new MemoryStore(),
    options: RuntimeOptions = {},
  ) {
    this.timeoutMs = z.int().positive().parse(options.timeoutMs ?? 30_000);
    this.approvalTtlMs = z.int().positive().parse(options.approvalTtlMs ?? 15 * 60_000);
    this.maxReadAttempts = z.int().min(1).max(5).parse(options.maxReadAttempts ?? 3);
  }

  async create(input: unknown): Promise<RunView> {
    const mission = missionSchema.parse(input);
    return this.store.withRun(mission.id, async journal => {
      if (journal.events.length) throw new Error('Run ID already exists');
      await journal.append('run.created', { mission: json(mission), planner: this.planner.id, evaluator: this.evaluator.id });
      await journal.append('memory.retrieved', { entries: json(this.memory.retrieve(mission.world, mission.goal)) });
      return project(journal.events);
    });
  }

  async inspect(runId: string): Promise<RunView> { return project(await this.store.read(runId)); }

  /** This trusted operator method is deliberately not registered as an agent tool. */
  async approve(runId: string, actionDigest: string, actor: string, allow: boolean): Promise<RunView> {
    z.string().min(1).max(200).parse(actor);
    z.boolean().parse(allow);
    return this.store.withRun(runId, async journal => {
      const view = project(journal.events);
      if (view.status !== 'WAITING_FOR_APPROVAL' || !view.pending) throw new Error('Run is not waiting for approval');
      if (view.pending.digest !== actionDigest) throw new Error('Approval does not match the exact pending action');
      const request = journal.events.filter(e => e.kind === 'approval.requested' && e.data.step === view.pending!.step).at(-1);
      if (!request || request.data.digest !== actionDigest || Number(request.data.expiresAt) <= Date.now()) {
        throw new Error('Approval request expired; resume the run to refresh it');
      }
      await journal.append(allow ? 'approval.granted' : 'approval.denied', {
        step: view.pending.step, digest: actionDigest, actor, expiresAt: request.data.expiresAt!,
      });
      return this.status(journal, allow ? 'RUNNING' : 'DENIED_BY_POLICY', allow ? 'Operator approved the exact action' : 'Operator denied the action');
    });
  }

  async run(runId: string): Promise<RunView> {
    return this.store.withRun(runId, async journal => {
      let view = project(journal.events);
      if (terminal.has(view.status)) return view;
      if (journal.events[0]!.data.planner !== this.planner.id || journal.events[0]!.data.evaluator !== this.evaluator.id) {
        throw new Error('Planner/evaluator revision changed; use a new replay run');
      }
      await this.status(journal, 'RUNNING', 'Runtime resumed');
      while (true) {
        view = project(journal.events);
        if (view.pending) {
          if (!await this.execute(journal, view)) return project(journal.events);
          continue;
        }
        const context = this.context(journal);
        let decision;
        try { decision = decisionSchema.parse(await this.planner.decide(context, AbortSignal.timeout(this.timeoutMs))); }
        catch {
          await journal.append('planner.error', { code: 'INVALID_OR_UNAVAILABLE_PLANNER' });
          return this.status(journal, 'CONFIRMED_FAILURE', 'Planner failed or returned an invalid decision');
        }
        if (decision.kind === 'finish') {
          await journal.append('plan.finish', { reason: decision.reason });
          let evaluation;
          try {
            evaluation = evaluateTrajectory(journal.events, await this.evaluator.evaluate(this.context(journal), AbortSignal.timeout(this.timeoutMs)));
          } catch {
            return this.status(journal, 'CONFIRMED_FAILURE', 'Independent evaluator failed or returned invalid evidence');
          }
          await journal.append('evaluation.result', { evaluator: this.evaluator.id, evaluation: json(evaluation) });
          if (evaluation.passed) return this.status(journal, 'CONFIRMED_SUCCESS', 'Independent evaluator and runtime checks passed');
          const replans = journal.events.filter(e => e.kind === 'replan.requested').length;
          if (replans < view.mission.maxReplans) {
            await journal.append('replan.requested', { attempt: replans + 1, reason: 'Independent evaluation did not pass' });
            continue;
          }
          return this.status(journal, 'CONFIRMED_FAILURE', 'Evaluation failed; replan budget exhausted');
        }
        const count = journal.events.filter(e => e.kind === 'plan.action').length;
        if (count >= view.mission.maxSteps) return this.status(journal, 'CONFIRMED_FAILURE', 'Step budget exhausted');
        let tool: RegisteredTool;
        let input: Json;
        try { tool = this.tools.get(decision.action.tool); input = tool.parse(decision.action.input); }
        catch (error) {
          return this.status(journal, error instanceof ToolFault ? 'TOOL_UNAVAILABLE' : 'CONFIRMED_FAILURE', 'Unknown tool or invalid input');
        }
        const action = { ...decision.action, input };
        const refs = new Set(view.observations.map(observation => observation.seq));
        if (action.evidenceRefs.some(ref => !refs.has(ref)) || tool.effect === 'write' && action.evidenceRefs.length === 0) {
          return this.status(journal, 'CONFIRMED_FAILURE', 'Action does not cite observed evidence');
        }
        await journal.append('plan.action', { step: `step-${count + 1}`, action: json(action), digest: this.actionDigest(view, action, tool) });
      }
    });
  }

  private context(journal: Journal): PlannerContext {
    const view = project(journal.events);
    const memory = z.array(memorySchema).parse(journal.events.find(e => e.kind === 'memory.retrieved')?.data.entries ?? []);
    return structuredClone({ mission: view.mission, observations: view.observations, events: journal.events, memory });
  }

  private actionDigest(view: RunView, action: Action, tool: RegisteredTool): string {
    const { execute: _execute, verify: _verify, parse: _parse, ...metadata } = tool;
    // Registered definitions also carry Zod instances; include only serializable contract fields.
    return digest({ runId: view.mission.id, policy: view.mission.policy, action,
      tool: { name: metadata.name, effect: metadata.effect, autonomy: metadata.autonomy,
        environment: metadata.environment, idempotency: metadata.idempotency,
        inputSchema: metadata.inputSchema, outputSchema: metadata.outputSchema,
        reversible: metadata.reversible, blastRadius: metadata.blastRadius, verificationMethod: metadata.verificationMethod } });
  }

  private async status(journal: Journal, status: RunStatus, reason: string): Promise<RunView> {
    await journal.append('run.status', { status, reason });
    return project(journal.events);
  }

  private async execute(journal: Journal, view: RunView): Promise<boolean> {
    const { action, step, digest: actionDigest } = view.pending!;
    let tool: RegisteredTool;
    try { tool = this.tools.get(action.tool); tool.parse(action.input); }
    catch { await this.status(journal, 'TOOL_UNAVAILABLE', 'Pending tool is unavailable'); return false; }
    if (this.actionDigest(view, action, tool) !== actionDigest) {
      await this.status(journal, 'DENIED_BY_POLICY', 'Tool contract or action changed after planning'); return false;
    }
    const context = (): ToolContext => ({ runId: view.mission.id, step,
      idempotencyKey: digest({ runId: view.mission.id, step, actionDigest }), signal: AbortSignal.timeout(this.timeoutMs) });
    const label = tool.environment === 'sandbox' ? 'SIMULATION_ONLY' : 'VERIFIED';
    const stepEvents = () => journal.events.filter(event => event.data.step === step);
    const complete = async () => { await journal.append('step.completed', { step, tool: tool.name }); return true; };
    const priorConfirmation = stepEvents().find(e => e.kind === 'tool.verification' && e.data.status === 'confirmed');
    if (priorConfirmation) return complete();
    const priorRead = stepEvents().find(e => e.kind === 'tool.result' && e.data.effect === 'read');
    if (priorRead) return complete();
    const verify = async (): Promise<Verification> => {
      const output = stepEvents().filter(e => e.kind === 'tool.result').at(-1)?.data.output;
      let result: Verification;
      try { result = await tool.verify(action.input, context(), output); }
      catch { result = { status: 'unknown', source: tool.verificationMethod }; }
      await journal.append('tool.verification', {
        step, tool: tool.name, status: result.status, source: result.source,
        observation: result.observation ?? null, label,
      });
      return result;
    };
    let attempts = stepEvents().filter(e => e.kind === 'tool.started').length;
    // A previous process may have died after the provider accepted the write.
    if (tool.effect === 'write' && attempts > 0) {
      const reconciliation = await verify();
      if (reconciliation.status === 'confirmed') return complete();
      if (reconciliation.status === 'unknown') {
        await this.status(journal, 'UNCERTAIN_SIDE_EFFECT', 'Read-back is inconclusive; no duplicate write attempted'); return false;
      }
      if (tool.idempotency !== 'provider-key' || attempts >= 2) {
        await this.status(journal, 'CONFIRMED_FAILURE', 'Write is absent; automatic retry is not safe or budget is exhausted'); return false;
      }
    }
    const writtenSteps = new Set(journal.events.filter(e => e.kind === 'tool.started' && e.data.effect === 'write' && e.data.step !== step).map(e => e.data.step));
    const policy = checkPolicy(view.mission.policy, tool, writtenSteps.size);
    await journal.append('policy.decision', { step, ...policy });
    if (policy.decision === 'deny') { await this.status(journal, 'DENIED_BY_POLICY', policy.reason); return false; }
    if (policy.decision === 'approve') {
      const granted = stepEvents().filter(e => e.kind === 'approval.granted' && e.data.digest === actionDigest).at(-1);
      if (!granted || Number(granted.data.expiresAt) <= Date.now()) {
        const previous = stepEvents().filter(e => e.kind === 'approval.requested').at(-1);
        if (!previous || Number(previous.data.expiresAt) <= Date.now()) {
          await journal.append('approval.requested', { step, digest: actionDigest, action: json(action), expiresAt: Date.now() + this.approvalTtlMs });
        }
        await this.status(journal, 'WAITING_FOR_APPROVAL', policy.reason); return false;
      }
    }
    const maxAttempts = tool.effect === 'write' ? 2 : this.maxReadAttempts;
    while (attempts < maxAttempts) {
      attempts++;
      await journal.append('tool.started', { step, tool: tool.name, effect: tool.effect, digest: actionDigest, attempt: attempts, idempotencyKey: context().idempotencyKey });
      let errorCode: string | undefined;
      try {
        const output = await tool.execute(action.input, context());
        await journal.append('tool.result', { step, tool: tool.name, effect: tool.effect, output, observation: output, label });
      } catch (error) {
        errorCode = error instanceof ToolFault ? error.code : 'INVALID_OUTPUT_OR_UNCLASSIFIED_ERROR';
        await journal.append('tool.error', { step, tool: tool.name, code: errorCode });
      }
      if (tool.effect === 'read') {
        if (!errorCode) return complete();
        if (errorCode === 'TRANSIENT' && attempts < maxAttempts) continue;
        await this.status(journal, errorCode === 'UNAVAILABLE' || errorCode === 'TRANSIENT' ? 'TOOL_UNAVAILABLE' : 'CONFIRMED_FAILURE', 'Read failed'); return false;
      }
      const result = await verify();
      if (result.status === 'confirmed') return complete();
      if (result.status === 'unknown') {
        await this.status(journal, 'UNCERTAIN_SIDE_EFFECT', 'Write may have been accepted; read-back is inconclusive'); return false;
      }
      if (tool.idempotency !== 'provider-key' || attempts >= maxAttempts || errorCode === 'REJECTED') {
        await this.status(journal, 'CONFIRMED_FAILURE', 'Write was not verified and will not be repeated'); return false;
      }
    }
    await this.status(journal, 'TOOL_UNAVAILABLE', 'Tool attempt budget exhausted');
    return false;
  }
}
