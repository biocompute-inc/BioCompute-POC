from __future__ import annotations
from pathlib import Path
import json

def normalize_text(s: str) -> str:
    # POC-friendly normalization
    return "".join(s.split())

def compare_plaintext_vs_ascii(plaintext_path: Path, ascii_path: Path, out_summary_path: Path) -> dict:
    expected = plaintext_path.read_text(encoding="utf-8", errors="ignore")
    actual = ascii_path.read_text(encoding="utf-8", errors="ignore")

    exp_n = normalize_text(expected)
    act_n = normalize_text(actual)

    match = (exp_n == act_n)

    # compute quick mismatch info
    mismatch_index = None
    if not match:
        m = min(len(exp_n), len(act_n))
        for i in range(m):
            if exp_n[i] != act_n[i]:
                mismatch_index = i
                break
        if mismatch_index is None and len(exp_n) != len(act_n):
            mismatch_index = m

    summary = {
        "match": match,
        "expected_len": len(expected),
        "actual_len": len(actual),
        "expected_norm_len": len(exp_n),
        "actual_norm_len": len(act_n),
        "first_mismatch_index_norm": mismatch_index,
    }

    out_summary_path.parent.mkdir(parents=True, exist_ok=True)
    out_summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
