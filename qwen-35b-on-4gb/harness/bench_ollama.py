#!/usr/bin/env python3
"""bench_ollama.py — drive Ollama /api/chat, score against gold."""
import argparse, json, time, sys, requests, pathlib

URL = "http://127.0.0.1:11434"

def _score(text, gold_list):
    t = text.lower()
    return any(g.lower() in t for g in gold_list)

def _chat(model, prompt, max_tokens, timeout=900):
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "think": False,
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.0,
            "top_k": 1,
            "top_p": 1.0,
        },
    }
    t0 = time.time()
    r = requests.post(f"{URL}/api/chat", json=payload, timeout=timeout)
    elapsed = time.time() - t0
    r.raise_for_status()
    j = r.json()
    msg = j.get("message", {}).get("content", "")
    ec = j.get("eval_count", 0)
    ed = j.get("eval_duration", 1) or 1
    pec = j.get("prompt_eval_count", 0)
    ped = j.get("prompt_eval_duration", 1) or 1
    gen_tps = round(ec / (ed / 1e9), 2)
    pre_tps = round(pec / (ped / 1e9), 2)
    return {
        "text": msg,
        "gen_tok_per_s": gen_tps,
        "prefill_tok_per_s": pre_tps,
        "predicted_n": ec,
        "prompt_n": pec,
        "wall_s": round(elapsed, 2),
    }

def run_short(model, gold_path):
    gold = json.loads(pathlib.Path(gold_path).read_text())
    rows = []
    for it in gold["items"]:
        try:
            rec = _chat(model, it["prompt"], it["max_tokens"])
        except Exception as e:
            rows.append({"id": it["id"], "ok": False, "error": str(e)[:200]})
            continue
        rec["id"] = it["id"]
        rec["ok"] = _score(rec["text"], it["gold"])
        rec["tail"] = rec.pop("text")[-180:]
        rows.append(rec)
    return rows

def run_recall(model, gold_path, label):
    gold = json.loads(pathlib.Path(gold_path).read_text())
    ctx = gold["context_text"]
    rows = []
    for it in gold["items"]:
        full = (
            "You are answering questions about the document below. Read carefully.\n\n"
            "===== DOCUMENT START =====\n" + ctx + "\n===== DOCUMENT END =====\n\n"
            "Question: " + it["question"] + "\n\nAnswer:\n"
        )
        try:
            rec = _chat(model, full, it["max_tokens"], timeout=1500)
        except Exception as e:
            rows.append({"suite": label, "id": it["id"], "ok": False, "error": str(e)[:200]})
            continue
        rec["suite"] = label
        rec["id"] = it["id"]
        rec["ok"] = _score(rec["text"], it["gold"])
        rec["tail"] = rec.pop("text")[-180:]
        rows.append(rec)
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--suite", choices=["short", "medium", "long", "all"], default="short")
    ap.add_argument("--gold-dir", default=str(pathlib.Path(__file__).parents[1] / "bench" / "gold"))
    ap.add_argument("--out")
    args = ap.parse_args()

    g = pathlib.Path(args.gold_dir)
    rows = []
    if args.suite in ("short", "all"):
        rows += run_short(args.model, g / "short.json")
    if args.suite in ("medium", "all"):
        rows += run_recall(args.model, g / "medium_recall.json", "medium")
    if args.suite in ("long", "all"):
        rows += run_recall(args.model, g / "long_codebase.json", "long")

    out = {"rows": rows}
    if rows:
        gens = [r.get("gen_tok_per_s") for r in rows if r.get("gen_tok_per_s")]
        pres = [r.get("prefill_tok_per_s") for r in rows if r.get("prefill_tok_per_s")]
        out["summary"] = {
            "n_items": len(rows),
            "n_pass": sum(1 for r in rows if r.get("ok")),
            "mean_gen_tok_per_s": round(sum(gens)/max(1,len(gens)), 2),
            "max_gen_tok_per_s": round(max(gens) if gens else 0, 2),
            "mean_prefill_tok_per_s": round(sum(pres)/max(1,len(pres)), 2) if pres else 0,
        }
    if args.out:
        pathlib.Path(args.out).write_text(json.dumps(out, indent=2))
    print(json.dumps(out.get("summary", {}), indent=2))

if __name__ == "__main__":
    main()
