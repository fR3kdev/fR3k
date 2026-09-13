# fR3k Open Code Drop

Useful, runnable code shared during the Multi-App AI Agent Hackathon.

## First drop: dependency-free LLM cost router

This small Python router classifies a prompt by complexity and selects a cheap, mid-tier, or frontier model. It is copied from [fr3kchy/agent-cost-router-demo](https://github.com/fr3kchy/agent-cost-router-demo) so competitors and builders can lift it into their own agents quickly.

```bash
git clone https://github.com/fR3kdev/fR3k
cd fR3k
python router.py "Design a multi-app agent with retries and idempotency"
```

No API key is required to inspect routing decisions. Change `DEFAULT_TIER_MODEL` in `pricing.py` to match your providers.

> Pricing changes frequently. Verify current provider pricing before using the cost table in production.

## Why this exists

If you're building today: best of luck. Take what helps, improve it, and ship something brilliant.

## Origin and licence

Copied from the MIT-licensed [Fr3kchy source repository](https://github.com/fr3kchy/agent-cost-router-demo). Original copyright and MIT licence are preserved in `LICENSE`.
