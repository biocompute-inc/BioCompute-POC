from __future__ import annotations
from pathlib import Path
import json

def normalize_text(s: str) -> str:
    # POC-friendly normalization
    return "".join(s.split())

def compare_plaintext_vs_ascii(plaintext_path: Path, ascii_path: Path, out_summary_path: Path) -> dict:
    expected = plaintext_path.read_bytes()
    actual = ascii_path.read_bytes()

    min_len = min(len(expected), len(actual))
    matched = 0
    first_mismatch = None

    for i in range(min_len):
        if expected[i] == actual[i]:
            matched += 1
        else:
            if first_mismatch is None:
                first_mismatch = i

    # If all prefix matched but lengths differ
    if first_mismatch is None and len(expected) != len(actual):
        first_mismatch = min_len

    accuracy = (matched / len(expected)) * 100 if len(expected) > 0 else 0.0
    match = (expected == actual)

    summary = {
        "match": match,
        "expected_len": len(expected),
        "actual_len": len(actual),
        "matched_bytes": matched,
        "accuracy_percent": round(accuracy, 2),
        "first_mismatch_index": first_mismatch,
    }

    # MAKE SURE RESULTS DIR EXISTS
    out_summary_path.parent.mkdir(parents=True, exist_ok=True)
    out_summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    return summary
