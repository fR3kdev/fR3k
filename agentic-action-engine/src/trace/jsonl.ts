import { createHash } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { eventSchema, identifier, json, type EventKind, type Json, type TraceEvent } from '../core/types.js';

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
    return events;
  }

  async withRun<T>(runId: string, operation: (journal: Journal) => Promise<T>): Promise<T> {
    identifier.parse(runId);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lockPath = join(this.root, `${runId}.lock`);
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new RunBusyError('Run is locked; do not launch another writer');
      throw error;
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
}

export interface Journal {
  events: TraceEvent[];
  append(kind: EventKind, data: Record<string, Json>): Promise<TraceEvent>;
}
