from __future__ import annotations
from pathlib import Path

class B2ANormalizationError(Exception):
    pass

WHITESPACE = {" ", "\t", "\n", "\r"}

def _is_digit(ch: str) -> bool:
    return "0" <= ch <= "9"

def _is_bit(ch: str) -> bool:
    return ch == "0" or ch == "1"

def b2a_ascii_to_recovered_bytes(ascii_path: Path) -> bytes:
    """
    Deterministic normalization + interpretation:

    Tokens:
    - Decimal: [0-9]+ -> byte (0..255)
    - Binary: [01]{8,} -> must be multiple of 8 -> bytes
    - Single char: any other non-whitespace char -> latin-1 byte

    Whitespace is ignored.
    """
    # Strict: fail if the output isn't valid UTF-8 text
    text = ascii_path.read_text(encoding="utf-8", errors="strict")

    out = bytearray()
    i = 0
    n = len(text)

    while i < n:
        ch = text[i]

        if ch in WHITESPACE:
            i += 1
            continue

        # Decimal token
        if _is_digit(ch):
            j = i
            while j < n and _is_digit(text[j]):
                j += 1
            token = text[i:j]
            val = int(token)
            if not (0 <= val <= 255):
                raise B2ANormalizationError(f"Decimal token out of range 0..255: {token}")
            out.append(val)
            i = j
            continue

        # Binary token
        if _is_bit(ch):
            j = i
            while j < n and _is_bit(text[j]):
                j += 1
            token = text[i:j]
            if len(token) >= 8:
                rem = len(token) % 8
                full_len = len(token) - rem

                # Convert complete bytes first
                for k in range(0, full_len, 8):
                    out.append(int(token[k:k+8], 2))

                # Handle leftover bits deterministically
                if rem != 0:
                    leftover = token[full_len:]
                    # Allow ONLY all-zero leftover at end (e.g., "0000") -> discard
                    if set(leftover) == {"0"}:
                        # discard and continue
                        pass
                    else:
                        raise B2ANormalizationError(
                            f"Binary token has non-zero leftover bits (len={rem}): {leftover}"
                        )

                i = j
                continue

            else:
                # If it's 0/1 but shorter than 8, treat as a single character byte
                out.extend(ch.encode("latin-1"))
                i += 1
                continue

        # Single character token -> latin-1 byte
        try:
            out.extend(ch.encode("latin-1"))
        except UnicodeEncodeError:
            raise B2ANormalizationError(f"Character not representable in latin-1: U+{ord(ch):04X}")
        i += 1

    return bytes(out)

def write_recovered_file(ascii_path: Path, recovered_path: Path) -> int:
    recovered = b2a_ascii_to_recovered_bytes(ascii_path)
    recovered_path.parent.mkdir(parents=True, exist_ok=True)
    recovered_path.write_bytes(recovered)
    return len(recovered)
