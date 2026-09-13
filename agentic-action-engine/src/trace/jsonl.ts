import { createHash } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { eventSchema, identifier, json, type EventKind, type Json, type TraceEvent } from '../core/types.js';

/** Denotes a crashed owner; callers may recover the exclusive lock. */
export class StaleLockError extends Error {}

export function canonical(value: unknown): string {
  const normalized = json(value);
  function encode(item: Json): string {
    if (item === null || typeof item !== 'object') return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(encode).join(',')}]`;
    return `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${encode(item[key]!)}`).join(',')}}`;
  }
  return encode(normalized);
}
export const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');

export class RunBusyError extends Error {}
export class TraceIntegrityError extends Error {}

/** A local, single-host journal. Each event is fsynced before the next side effect. */
export class TraceStore {
  constructor(public readonly root: string) {}

  path(runId: string): string { return join(this.root, `${identifier.parse(runId)}.jsonl`); }

  async read(runId: string): Promise<TraceEvent[]> {
    let content: string;
    try { content = await readFile(this.path(runId), 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    if (content && !content.endsWith('\n')) throw new TraceIntegrityError('Incomplete journal tail; refusing to execute');
    return this.parse(runId, content).events;
  }

  /** Parse committed `\n`-terminated events. Rejects any invalid or out-of-chain event that is not the incomplete tail. */
  private parse(runId: string, content: string): { events: TraceEvent[]; complete: boolean } {
    if (!content) return { events: [], complete: true };
    if (!content.endsWith('\n')) {
      // The final line is an incomplete tail. Everything before it must still be valid.
      const prefix = content.slice(0, content.lastIndexOf('\n') + 1);
      return { events: this.parse(runId, prefix).events, complete: false };
    }
    const events: TraceEvent[] = [];
    for (const line of content.split('\n').slice(0, -1)) {
      let event: TraceEvent;
      try { event = eventSchema.parse(JSON.parse(line)); }
      catch { throw new TraceIntegrityError('Invalid journal event'); }
      const { hash, ...payload } = event;
      if (event.runId !== runId || event.seq !== events.length + 1
        || event.previousHash !== (events.at(-1)?.hash ?? '') || hash !== digest(payload)) {
        throw new TraceIntegrityError('Journal sequence or hash mismatch');
      }
      events.push(event);
    }
    return { events, complete: true };
  }

  /**
   * Audited repair for an incomplete journal tail. Fails closed by default: this
   * explicit operator action preserves the original bytes, truncates only the
   * uncommitted final line, and returns an immutable report. Corruption in the
   * committed prefix (not merely an unwritten tail) is never modified.
   */
  async repairTail(runId: string): Promise<{
    repaired: boolean; runId: string; reason: string;
    preservedPath?: string; parsedEvents: number; removedBytes: number;
  }> {
    identifier.parse(runId);
    let content: string;
    try { content = await readFile(this.path(runId), 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { repaired: false, runId, reason: 'Journal does not exist', parsedEvents: 0, removedBytes: 0 };
      throw error;
    }
    if (!content) return { repaired: false, runId, reason: 'Journal is empty', parsedEvents: 0, removedBytes: 0 };
    // Integrity of the committed prefix is required before any truncation.
    const { events, complete } = this.parse(runId, content);
    if (complete) return { repaired: false, runId, reason: 'Journal tail is complete', parsedEvents: events.length, removedBytes: 0 };
    const goodEnd = content.lastIndexOf('\n') + 1;
    const originalBytes = Buffer.from(content);
    const preservedPath = `${this.path(runId)}.incomplete.${Date.now()}`;
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lockPath = join(this.root, `${runId}.repair.lock`);
    const lock = await open(lockPath, 'wx', 0o600);
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      await lock.sync();
      // Preserve the original bytes verbatim before truncating.
      const handlePreserve = await open(preservedPath, 'w', 0o600);
      try { await handlePreserve.writeFile(originalBytes); await handlePreserve.sync(); } finally { await handlePreserve.close(); }
      const handle = await open(this.path(runId), 'r+', 0o600);
      try { await handle.truncate(goodEnd); await handle.sync(); } finally { await handle.close(); }
    } finally { await lock.close(); await unlink(lockPath); }
    return { repaired: true, runId, reason: 'Incomplete tail truncated after an audited snapshot', preservedPath, parsedEvents: events.length, removedBytes: originalBytes.length - goodEnd };
  }

  async withRun<T>(runId: string, operation: (journal: Journal) => Promise<T>, retryStaleLock = true): Promise<T> {
    identifier.parse(runId);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lockPath = join(this.root, `${runId}.lock`);
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // A crashed owner leaves a lock file behind. Verified dead PIDs are stale;
      // PID reuse keeps a working-owner lock busy rather than risking a double writer.
      if (await this.staleLock(lockPath)) {
        await unlink(lockPath).catch(() => undefined);
        if (retryStaleLock) return this.withRun(runId, operation, false);
      }
      throw new RunBusyError('Run is locked; do not launch another writer');
    }
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      await lock.sync();
      const events = await this.read(runId);
      const handle = await open(this.path(runId), 'a', 0o600);
      try {
        // Persist the directory entry as well as subsequent event contents.
        const directory = await open(this.root, 'r');
        try { await directory.sync(); } finally { await directory.close(); }
        const journal: Journal = {
          events,
          append: async (kind, data) => {
            const payload = {
              version: 1 as const, runId, seq: events.length + 1,
              time: new Date().toISOString(), kind, data: json(data), previousHash: events.at(-1)?.hash ?? '',
            };
            const event = eventSchema.parse({ ...payload, hash: digest(payload) });
            await handle.writeFile(`${JSON.stringify(event)}\n`);
            await handle.sync();
            events.push(event);
            return event;
          },
        };
        return await operation(journal);
      } finally { await handle.close(); }
    } finally { await lock.close(); await unlink(lockPath); }
  }

  /** Returns true only when the recorded owner PID is provably dead. */
  private async staleLock(lockPath: string): Promise<boolean> {
    let lock;
    try { lock = await open(lockPath, 'r', 0o600); }
    catch { return false; }
    try {
      const raw = await lock.readFile('utf8');
      const parsed = JSON.parse(raw) as { pid?: number | string; createdAt?: string };
      const pid = Number(parsed.pid);
      if (!Number.isInteger(pid) || pid <= 0) return true;
      try { process.kill(pid, 0); return false; }
      catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
    } catch { return true; } finally { await lock.close(); }
  }
}

export interface Journal {
  events: TraceEvent[];
  append(kind: EventKind, data: Record<string, Json>): Promise<TraceEvent>;
}
