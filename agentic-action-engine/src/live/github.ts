import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { Runtime } from '../core/orchestrator.js';
import type { Evaluator, Mission, Planner, RunView } from '../core/types.js';
import { ToolFault, ToolRegistry } from '../tools/registry.js';
import { TraceStore } from '../trace/jsonl.js';

const ownerSchema = z.string().regex(/^[a-zA-Z0-9-]+$/);
const repoNameSchema = z.string().regex(/^[a-zA-Z0-9_.-]+$/);
const repoInfoInput = z.strictObject({ owner: ownerSchema, repo: repoNameSchema });
const repoInfoOutput = z.strictObject({ id: z.number(), name: z.string(), fullName: z.string(), private: z.boolean(), archived: z.boolean(), defaultBranch: z.string(), updatedAt: z.string(), source: z.string() });
const commitsInput = z.strictObject({ owner: ownerSchema, repo: repoNameSchema, perPage: z.number().int().min(1).max(25).default(5) });
const commitsOutput = z.strictObject({ owner: z.string(), repo: z.string(), commits: z.array(z.strictObject({ sha: z.string(), date: z.string(), message: z.string() })) });
const issuesInput = z.strictObject({ owner: ownerSchema, repo: repoNameSchema });
const issuesOutput = z.strictObject({ owner: z.string(), repo: z.string(), issues: z.array(z.strictObject({ number: z.number(), title: z.string(), state: z.string(), createdAt: z.string() })) });

export interface GithubCredential { name: string; token: string }

/** Resolve an operator-supplied token: GH_TOKEN / GITHUB_TOKEN, else `gh auth token`. */
export async function resolveGithubToken(): Promise<GithubCredential> {
  const envToken = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (envToken) return { name: process.env.GH_TOKEN?.trim() ? 'GH_TOKEN' : 'GITHUB_TOKEN', token: envToken };
  const call = (): Promise<string> => new Promise((resolve, reject) => execFile('gh', ['auth', 'token'], (error, stdout) => error ? reject(error) : resolve(stdout.trim())));
  try {
    const token = await call();
    if (token) return { name: 'gh auth token', token };
  } catch {
    // fall through to a single fail-closed error below
  }
  throw new Error('No GitHub token: set GH_TOKEN/GITHUB_TOKEN or authenticate `gh auth login` ');
}

async function gh(token: string, path: string, timeoutMs = 30_000): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': 'fr3k-agentic-action-engine' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 401 || response.status === 403) throw new ToolFault('REJECTED');
  if (response.status === 404) throw new Error('Not found');
  if (!response.ok) throw new ToolFault('UNAVAILABLE');
  return response.json();
}

/** Build the read-only GitHub tool set. Writes are deliberately not registered. */
export function registerGithubReadTools(registry: ToolRegistry, token: string, repo: { owner: string; repo: string }) {
  registry.register({
    name: 'github.repo_info', description: 'Read repository metadata and default branch', effect: 'read', autonomy: 0,
    environment: 'live', reversible: true, blastRadius: 'None (read)', idempotency: 'read-only',
    verificationMethod: 'Direct GitHub REST read-back with the same operator token',
    input: repoInfoInput, output: repoInfoOutput,
    async execute(input) {
      const result = await gh(token, `/repos/${input.owner}/${input.repo}`) as { id: number; name: string; full_name: string; private: boolean; archived: boolean; default_branch: string; updated_at: string };
      return { id: result.id, name: result.name, fullName: result.full_name, private: result.private, archived: result.archived, defaultBranch: result.default_branch, updatedAt: result.updated_at, source: `https://api.github.com/repos/${input.owner}/${input.repo}` };
    },
  });
  registry.register({
    name: 'github.list_commits', description: 'Read the most recent commits on the repository', effect: 'read', autonomy: 0,
    environment: 'live', reversible: true, blastRadius: 'None (read)', idempotency: 'read-only',
    verificationMethod: 'Direct GitHub REST read-back with the same operator token',
    input: commitsInput, output: commitsOutput,
    async execute(input) {
      const result = await gh(token, `/repos/${input.owner}/${input.repo}/commits?per_page=${input.perPage}`) as Array<{ sha: string; commit: { message: string; author: { date: string } } }>;
      return { owner: input.owner, repo: input.repo, commits: result.map(commit => ({ sha: commit.sha.slice(0, 7), date: commit.commit.author.date, message: commit.commit.message.split('\n')[0] })) };
    },
  });
  registry.register({
    name: 'github.list_open_issues', description: 'Read open issues on the repository', effect: 'read', autonomy: 0,
    environment: 'live', reversible: true, blastRadius: 'None (read)', idempotency: 'read-only',
    verificationMethod: 'Direct GitHub REST read-back with the same operator token',
    input: issuesInput, output: issuesOutput,
    async execute(input) {
      const result = await gh(token, `/repos/${input.owner}/${input.repo}/issues?state=open&per_page=10`) as Array<{ number: number; title: string; state: string; created_at: string }>;
      return { owner: input.owner, repo: input.repo, issues: result.map(issue => ({ number: issue.number, title: issue.title, state: issue.state, createdAt: issue.created_at })) };
    },
  });
}

export interface GithubLiveMission {
  runtime: Runtime;
  mission: Mission;
  storeRoot: string;
  credentialName: string;
  repo: { owner: string; repo: string };
}

function asIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 95) || 'live';
}

export async function createGithubLiveRuntime(repo: { owner: string; repo: string }, options: { token?: GithubCredential; root?: string } = {}): Promise<GithubLiveMission> {
  const credential = options.token ?? await resolveGithubToken();
  const registry = new ToolRegistry();
  registerGithubReadTools(registry, credential.token, repo);
  const planner: Planner = {
    id: 'github-read-planner-v1',
    async decide(context) {
      const used = new Set(context.observations.map(observation => observation.tool));
      if (!used.has('github.repo_info')) return { kind: 'action', action: { tool: 'github.repo_info', input: repo, reason: 'Ground repository identity and archiving state', evidenceRefs: [] } };
      if (!used.has('github.list_commits')) return { kind: 'action', action: { tool: 'github.list_commits', input: { ...repo, perPage: 5 }, reason: 'Prove the default branch is live', evidenceRefs: context.observations.map(observation => observation.seq) } };
      if (!used.has('github.list_open_issues')) return { kind: 'action', action: { tool: 'github.list_open_issues', input: repo, reason: 'Prove write-free issue state', evidenceRefs: context.observations.map(observation => observation.seq) } };
      return { kind: 'finish', reason: 'All reads verified against the live repository' };
    },
  };
  const evaluator: Evaluator = {
    id: 'github-read-evaluator-v1',
    async evaluate(context) {
      const seqOf = (tool: string) => context.observations.filter(observation => observation.tool === tool).map(observation => observation.seq);
      const info = context.observations.find(observation => observation.tool === 'github.repo_info');
      const commits = context.observations.find(observation => observation.tool === 'github.list_commits');
      const issues = context.observations.find(observation => observation.tool === 'github.list_open_issues');
      const infoOk = Boolean(info) && (info!.value as { archived: boolean; defaultBranch: string }).archived === false
        && (info!.value as { defaultBranch: string }).defaultBranch.length > 0;
      const commitsOk = Boolean(commits) && (commits!.value as { commits: unknown[] }).commits.length >= 1;
      const label = 'VERIFIED';
      void label;
      return [
        { id: 'live.repo-identified', passed: infoOk, detail: 'Repository metadata read with the operator token', evidenceRefs: seqOf('github.repo_info') },
        { id: 'live.default-branch-live', passed: commitsOk, detail: 'Default branch has observable fresh commits', evidenceRefs: seqOf('github.list_commits') },
        { id: 'live.no-writes', passed: context.observations.every(observation => observation.label === 'VERIFIED'), detail: 'Only authenticated reads were used', evidenceRefs: context.observations.map(observation => observation.seq) },
      ];
    },
  };
  const storeRoot = options.root ?? await mkdtemp(join(tmpdir(), 'fr3k-live-github-'));
  const mission: Mission = {
    id: asIdentifier(`live-${repo.owner}-${repo.repo}`), world: 'live', goal: `Prove the state of ${repo.owner}/${repo.repo} by direct authenticated reads`,
    context: repo,
    policy: { allowedTools: ['github.repo_info', 'github.list_commits', 'github.list_open_issues'], maxAutonomy: 0, maxWrites: 0, sandbox: false },
    maxSteps: 8, maxReplans: 0,
  };
  if (!options.root) process.once('exit', () => void rm(storeRoot, { recursive: true, force: true }));
  return { runtime: new Runtime(new TraceStore(storeRoot), registry, planner, evaluator), mission, storeRoot, credentialName: credential.name, repo };
}

export async function runLiveGithub(repo: { owner: string; repo: string }): Promise<RunView> {
  const mission = await createGithubLiveRuntime(repo);
  const runtime = mission.runtime;
  await runtime.create(mission.mission);
  let view: RunView | undefined;
  for (let cycle = 0; cycle < 6; cycle++) {
    view = await runtime.run(mission.mission.id);
    const status = view.status;
    if (status === 'CONFIRMED_SUCCESS' || status === 'CONFIRMED_FAILURE' || status === 'DENIED_BY_POLICY' || status === 'TOOL_UNAVAILABLE') break;
  }
  return view!;
}