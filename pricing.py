"""
Per-million-token pricing for ~10 commonly-routed models.

Prices in USD per 1M tokens, captured Nov 2026 from public provider pages
and OpenRouter. Update freely — pricing is the most volatile part of this
stack. Cost calculations consume these dicts directly.
"""

# (input_per_million, output_per_million)
PRICING = {
    # Frontier
    "claude-opus-4":          {"in": 15.00, "out": 75.00, "tier": "frontier"},
    "gpt-4-turbo":            {"in": 10.00, "out": 30.00, "tier": "frontier"},
    "gpt-4o":                 {"in":  2.50, "out": 10.00, "tier": "frontier"},

    # Mid
    "claude-sonnet-4":        {"in":  3.00, "out": 15.00, "tier": "mid"},
    "gpt-4o-2024-11":         {"in":  2.50, "out": 10.00, "tier": "mid"},
    "deepseek-v3":            {"in":  0.27, "out":  1.10, "tier": "mid"},

    # Cheap
    "claude-haiku-3.5":       {"in":  0.80, "out":  4.00, "tier": "cheap"},
    "gpt-4o-mini":            {"in":  0.15, "out":  0.60, "tier": "cheap"},
    "qwen-2.5-7b-instruct":   {"in":  0.05, "out":  0.10, "tier": "cheap"},
    "llama-3.1-8b-instruct":  {"in":  0.05, "out":  0.10, "tier": "cheap"},
}

# Default model per tier (override via Router(tier_models=...))
DEFAULT_TIER_MODEL = {
    "cheap":    "gpt-4o-mini",
    "mid":      "claude-sonnet-4",
    "frontier": "claude-opus-4",
}


def cost_usd(model: str, in_tokens: int, out_tokens: int) -> float:
    """Return USD cost for a single call given model + token counts."""
    if model not in PRICING:
        raise KeyError(f"Unknown model: {model}. Add it to pricing.PRICING.")
    p = PRICING[model]
    return (in_tokens / 1_000_000.0) * p["in"] + (out_tokens / 1_000_000.0) * p["out"]


def tier_of(model: str) -> str:
    return PRICING[model]["tier"]
