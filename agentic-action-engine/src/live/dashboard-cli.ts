import { startDashboard } from '../dashboard/server.js';
import { createRuntimeDashboardBridge } from '../demo/dashboard-bridge.js';
import { openLiveIncident } from './incident-host.js';
import { z } from 'zod';

const live = await openLiveIncident();
const server = await startDashboard({
  bridge: createRuntimeDashboardBridge(new Map([[live.runId, live.runtime]])),
  port: z.coerce.number().int().min(0).max(65535).parse(process.env.FR3K_DASHBOARD_PORT ?? 4317),
  actor: live.actor,
});
console.log(`Live mission dashboard: ${server.url}`);
console.log(`RUN ${live.runId}\nPLANNER ${live.plannerMode}\nTRACE ${live.root}`);
console.log('YouTube → GitHub → ntfy → GitHub evidence. Resume to observe and plan; each write requires exact approval and a separate Resume.');
console.log('Restart with FR3K_RESUME=1 and the same FR3K_RUN_ID/FR3K_TRACE_ROOT/model configuration to attach this run.');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  void server.close().then(() => { process.exitCode = 0; });
});
