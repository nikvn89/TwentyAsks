"""
Golden commitment and game-id vectors shared with the frontend (tests/js/ids.test.ts
and tests/js/ids-html.test.ts read the same file). Every value is computed by the
contract's own code on the real SDK Keccak256.

Regenerate:  WRITE_VECTORS=1 python3 -m pytest tests/contract/test_id_vectors.py
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "tests" / "js" / "id-vectors.json"
CONTRACT = str(ROOT / "contracts" / "HonestKeeper.py")

KEEPER = "0x6276095FAEA15108740445ff277fdA8c304657F4"
SALT = "k3Rv8pQz1Lw6Tn0Yh5Xc2Bm9Df4Gs7Ja"
SECRETS = [
    ("lighthouse", SALT),
    ("Lighthouse", SALT),
    ("  light   house  ", SALT),
    ("\u001cvolcano\u001f", "s"),
    ("tea\u0085pot　cup", "salt with spaces "),
    ("﻿candle", "x"),
    ("Crème brûlée \U0001F36E", "ÄÖÜ-salt"),
    ("penguin", ""),
]


def build(contract):
    rows = []
    for secret, salt in SECRETS:
        commitment = contract._commitment(secret, salt)
        rows.append({"secret": secret, "salt": salt, "normalized_lower": contract._normalize_text(secret).lower(),
                     "commitment": commitment, "game_id": contract._game_id(KEEPER, commitment)})
    return {"keeper": KEEPER, "games": rows}


def test_vectors_match_contract(direct_deploy):
    data = build(direct_deploy(CONTRACT))
    if os.environ.get("WRITE_VECTORS") == "1":
        VECTORS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    assert json.loads(VECTORS.read_text(encoding="utf-8")) == data
