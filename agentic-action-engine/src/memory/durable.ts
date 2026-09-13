import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { json, type Json } from '../core/types.js';
import type { MemoryEntry } from '../core/types.js';
import { memorySchema, MemoryStore } from './store.js';
import { digest } from '../trace/jsonl.js';

export interface StoredMemoryEvent {
  id: string; world: string; text: string; source: string; outcome: Json; hash: string;
}

const storedSchema = z.strictObject({
  id: z.string().min(1), world: z.string().min(1), text: z.string().min(1),
  source: z.string().min(1), outcome: z.json(), hash: z.string().length(64),
});

function entryFromStored(payload: Omit<StoredMemoryEvent, 'hash'>): MemoryEntry {
  return { id: payload.id, world: payload.world, text: payload.text, source: payload.source, outcome: payload.outcome };
}

/** Outcome memory that is appended-only, fsynced, and reconstructable after a crash. */
export class DurableMemoryStore extends MemoryStore {
  private constructor(private readonly root: string) { super(); }

  static async open(root: string): Promise<DurableMemoryStore> {
    const store = new DurableMemoryStore(root);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const content = await readFile(join(root, 'memory.jsonl'), 'utf8').catch(error =>
      (error as NodeJS.ErrnoException).code === 'ENOENT' ? '' : Promise.reject(error));
    for (const line of content.split('\n').filter(Boolean)) {
      const parsed = storedSchema.parse(JSON.parse(line));
      const { hash, ...payload } = parsed;
      if (hash !== digest(payload)) throw new Error('Memory journal sequence or hash mismatch');
      store.record(entryFromStored(payload));
    }
    return store;
  }

  /** Persist is append-only and fsynced before the entry becomes observable. */
  async persist(entry: MemoryEntry): Promise<MemoryEntry> {
    const parsed = this.record(entry);
    const payload = { id: parsed.id, world: parsed.world, text: parsed.text, source: parsed.source, outcome: json(parsed.outcome) };
    const event = storedSchema.parse({ ...payload, hash: digest(payload) });
    const handle = await open(join(this.root, 'memory.jsonl'), 'a', 0o600);
    try { await handle.writeFile(`${JSON.stringify(event)}\n`); await handle.sync(); } finally { await handle.close(); }
    return parsed;
  }
}

/** Persist the outcome of a terminal run as durable memory the moment it happens. */
export function outcomeFrom(journalSource: string, entry: { world: string; id: string; text: string; outcome: Json }): MemoryEntry {
  return memorySchema.parse({ id: entry.id, world: entry.world, text: entry.text, source: journalSource, outcome: entry.outcome });
}