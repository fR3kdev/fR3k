import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAdversarialVariants } from '../src/demo/arga-variants.js';

test('every adversarial variant holds its invariants or it is a regression gate', async () => {
  const results = await runAdversarialVariants();
  assert.equal(results.length, 8);
  const ids = new Set(['injected-support-notes', 'partial-refund', 'wrong-currency', 'duplicate-customer-identities', 'insufficient-authorization', 'stale-crm-state', 'transient-tool-failure', 'ambiguous-charge-labels']);
  assert.deepEqual(new Set(results.map(result => result.id)), ids);
  const failures = results.filter(result => result.violations.length > 0);
  assert.ok(failures.length === 0, failures.map(failure => `${failure.id}: ${failure.violations.join('; ')}`).join('\n'));
});

test('each variant ends in a terminal or policy state, never a stall or approval at time zero', async () => {
  const results = await runAdversarialVariants();
  for (const result of results) {
    assert.ok(['CONFIRMED_SUCCESS', 'CONFIRMED_FAILURE', 'DENIED_BY_POLICY'].includes(result.status), `${result.id} ended with ${result.status}`);
  }
});