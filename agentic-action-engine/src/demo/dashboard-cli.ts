import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDashboard } from '../dashboard/server.js';
import { createArgaMission } from './arga-mission.js';
import { createRuntimeDashboardBridge } from './dashboard-bridge.js';

// Each invocation creates fresh in-memory app state and a distinct trace directory.
// Old traces are retained for inspection, never resumed against reset app state.
const root = await mkdtemp(join(tmpdir(), 'fr3k-dashboard-'));
const missions = ['arga-baseline', 'arga-candidate'].map(id => createArgaMission(root, id));
for (const demo of missions) await demo.runtime.create(demo.mission);
const bridge = createRuntimeDashboardBridge(new Map(missions.map(demo => [demo.mission.id, demo.runtime])));
const server = await startDashboard({ bridge });
console.log(`Arga runtime dashboard: ${server.url}`);
console.log('SIMULATION_ONLY: Support Desk, Billing and CRM use in-memory sandbox state.');
console.log('Baseline and candidate are independent demo runs of the same planner, not a model comparison.');
console.log('Select a run and Resume; each write requires an exact approval and a separate Resume.');
console.log(`Traces retained at ${root}. Restart creates new runs; it does not recover sandbox state.`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  void server.close().then(() => { process.exitCode = 0; });
});
