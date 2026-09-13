import { z } from 'zod';
import type { MemoryEntry } from '../core/types.js';

export const memorySchema = z.strictObject({
  id: z.string().min(1), world: z.string().min(1), text: z.string().min(1),
  source: z.string().min(1), outcome: z.json(),
});
/** Baseline lexical retrieval. Entries are historical context, never authority to act. */
export class MemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();
  constructor(entries: MemoryEntry[] = []) { entries.forEach(entry => this.record(entry)); }
  record(entry: MemoryEntry): void {
    const parsed = memorySchema.parse(entry);
    if (this.entries.has(parsed.id)) throw new Error('Memory IDs are append-only');
    this.entries.set(parsed.id, structuredClone(parsed));
  }
  retrieve(world: string, query: string, limit = 5): MemoryEntry[] {
    const terms = new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? []);
    return [...this.entries.values()].filter(entry => entry.world === world)
      .map(entry => ({ entry, score: (entry.text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(term => terms.has(term)).length }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
      .slice(0, limit).map(item => structuredClone(item.entry));
  }
  snapshot(): MemoryEntry[] { return structuredClone([...this.entries.values()]); }
}
