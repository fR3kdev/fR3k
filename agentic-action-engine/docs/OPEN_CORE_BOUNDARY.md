# Open-Core Boundary

The public project should be genuinely useful, not a brochure with the interesting pieces removed.

## Public and reproducible

- agent runtime and state machine,
- typed tool registry,
- policy/autonomy engine,
- trace/evidence format,
- approval checkpoints,
- baseline memory/retrieval,
- replay and single-machine comparison,
- four synthetic world packs,
- baseline evaluators and adversarial fixtures,
- connector interfaces and safe demo connectors,
- tests and local dashboard/demo UI required by the hackathon.

## Reasonable future commercial layer

Only components whose value is dominated by operations, scale, proprietary data, or enterprise support should be gated:

- managed multi-tenant control plane,
- SSO/RBAC/audit retention/admin policy packs,
- licensed financial/CRM/enrichment connectors,
- high-volume replay/evaluation clusters,
- proprietary relationship-graph enrichment,
- advanced causal/uplift optimisation at production scale,
- SLA-backed deployment and support.

## Explicit non-gates

Do **not** gate safety checks, trace inspection, baseline evaluation, local replay, or enough functionality to reproduce the public demos. A community project that cannot verify itself is decorative software.
