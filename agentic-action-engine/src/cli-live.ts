import { runLiveGithub } from './live/github.js';

const owner = process.env.LIVE_GH_OWNER?.trim() || 'fR3kdev';
const repo = process.env.LIVE_GH_REPO?.trim() || 'fR3k';

const view = await runLiveGithub({ owner, repo });
console.log(`LIVE     github.com/${owner}/${repo} (direct authenticated READ-only)`);
console.log(`STATE    ${view.status}`);
for (const observation of view.observations) {
  console.log(`OBS      ${observation.tool} ${observation.label} ${JSON.stringify(observation.value)}`);
}
console.log(`EVAL     ${view.evaluation ? `${view.evaluation.score.toFixed(2)} (${view.evaluation.checks.map(c => `${c.id}=${c.passed ? 'pass' : 'fail'}`).join(', ')})` : 'not run'}`);
if (view.status !== 'CONFIRMED_SUCCESS') process.exitCode = 1;