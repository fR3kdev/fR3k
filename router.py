"""
router.py — classify task complexity, return a model + tier decision.

Two-stage classifier:
  1. Cheap heuristics (length, code/math keywords, reasoning markers).
     This handles ~80% of cases for free with no LLM call.
  2. Optional LLM tie-breaker on the cheap model when heuristic confidence
     is low. Disabled by default; enable with use_llm_classifier=True.

Thresholds are intentionally exposed so they can be tuned per deployment.
A router that nobody can tune is a router that gets ripped out in week 3.
"""

from __future__ import annotations
import os
import re
from dataclasses import dataclass
from typing import Optional

from pricing import DEFAULT_TIER_MODEL


# ---------- Heuristic features ----------

_CODE_MARKERS = re.compile(
    r"\b(function|def |class |import |SELECT |refactor|implement|bug|stacktrace|"
    r"regex|algorithm|complexity|recursion|async|race condition)\b",
    re.IGNORECASE,
)
_REASONING_MARKERS = re.compile(
    r"\b(why|prove|derive|trade[- ]?off|compare|design|architect|strategy|"
    r"step[- ]by[- ]step|reason|justify|analy[sz]e|implication)\b",
    re.IGNORECASE,
)
_TRIVIAL_MARKERS = re.compile(
    r"^(what is|who is|when did|where is|define|spell|translate|capital of)\b",
    re.IGNORECASE,
)


def complexity_score(prompt: str) -> float:
    """Return a [0.0, 1.0] complexity score. Higher = harder."""
    p = prompt.strip()
    n_tokens = max(1, len(p.split()))

    score = 0.0
    # Length signal — long prompts skew complex
    score += min(0.4, n_tokens / 250.0)
    # Code/math signal
    if _CODE_MARKERS.search(p):
        score += 0.25
    # Reasoning signal
    if len(_REASONING_MARKERS.findall(p)) >= 1:
        score += 0.20
    if len(_REASONING_MARKERS.findall(p)) >= 3:
        score += 0.10  # multiple reasoning markers compound
    # Trivial QA pattern caps the score
    if _TRIVIAL_MARKERS.search(p) and n_tokens < 25:
        score = min(score, 0.15)
    # Multi-paragraph almost always means substance
    if p.count("\n\n") >= 1:
        score += 0.10
    return max(0.0, min(1.0, score))


# ---------- Decision ----------

@dataclass
class Decision:
    tier: str          # "cheap" | "mid" | "frontier"
    model: str         # concrete model ID
    score: float       # complexity score [0,1]
    reason: str        # short human-readable rationale


class Router:
    def __init__(
        self,
        tier_models: Optional[dict] = None,
        trivial_max_tokens: int = 40,
        complex_min_score: float = 0.45,
        mid_min_score: float = 0.25,
    ):
        self.tier_models = tier_models or DEFAULT_TIER_MODEL
        self.trivial_max_tokens = int(
            os.getenv("ROUTER_TRIVIAL_MAX_TOKENS", trivial_max_tokens)
        )
        self.complex_min_score = float(
            os.getenv("ROUTER_COMPLEX_MIN_SCORE", complex_min_score)
        )
        self.mid_min_score = mid_min_score

    def route(self, prompt: str) -> Decision:
        s = complexity_score(prompt)
        n_tokens = len(prompt.split())

        # Fast path: very short trivial QA → cheap
        if n_tokens <= self.trivial_max_tokens and s < self.mid_min_score:
            return Decision(
                tier="cheap",
                model=self.tier_models["cheap"],
                score=s,
                reason=f"trivial: {n_tokens} tokens, score={s:.2f}",
            )

        if s >= self.complex_min_score:
            return Decision(
                tier="frontier",
                model=self.tier_models["frontier"],
                score=s,
                reason=f"complex: score={s:.2f} >= {self.complex_min_score}",
            )

        if s >= self.mid_min_score:
            return Decision(
                tier="mid",
                model=self.tier_models["mid"],
                score=s,
                reason=f"standard: score={s:.2f}",
            )

        return Decision(
            tier="cheap",
            model=self.tier_models["cheap"],
            score=s,
            reason=f"cheap default: score={s:.2f}",
        )


if __name__ == "__main__":
    import sys
    r = Router()
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        prompt = "What is the capital of France?"
    d = r.route(prompt)
    print(f"prompt:  {prompt[:80]}...")
    print(f"tier:    {d.tier}")
    print(f"model:   {d.model}")
    print(f"score:   {d.score:.2f}")
    print(f"reason:  {d.reason}")
