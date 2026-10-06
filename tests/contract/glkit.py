"""
glkit — shared helpers for the Direct Mode test suites of this batch.

One source of truth per contract: tests/runtime.json holds the planned on-chain table
(wallet, method, exact arguments, expected result) and the payload recipe of
every id the table needs. The same file drives:
  * the replay test (this module's replay());
  * the offline calldata measurement (tools/calldata.mjs);
  * the Studio runner page (STUDIO_RUNNER.html) that fills ids for real wallets.

Id recipes are evaluated by eval_payload() here and by the same tiny language in
the runner page; tests assert both agree with the contract's own id functions.
"""

import ast
import json
import re
from pathlib import Path

from Crypto.Hash import keccak as _keccak

# Python str.split() whitespace (the runner page mirrors this exact set).
PY_WS = "\t\n\x0b\x0c\r\x1c\x1d\x1e\x1f \x85\xa0 " + "".join(chr(c) for c in range(0x2000, 0x200B)) + \
    "    　"


def hx(addr) -> str:
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    return str(addr)


def lo(addr) -> str:
    return hx(addr).lower()


def J(raw):
    return json.loads(raw)


def keccak_hex(text: str) -> str:
    k = _keccak.new(digest_bits=256)
    k.update(text.encode("utf-8"))
    return k.hexdigest()


def norm(text: str) -> str:
    return " ".join(text.split())


def alnum(text: str) -> str:
    return "".join(ch for ch in text.lower() if ch in "abcdefghijklmnopqrstuvwxyz0123456789")


def alnumsp(text: str) -> str:
    kept = "".join(ch if ch in "abcdefghijklmnopqrstuvwxyz0123456789" else (" " if ch in PY_WS else "")
                   for ch in text.lower())
    return " ".join(kept.split())


_FUNCS = {
    "norm": norm,
    "strip": lambda s: s.strip(),
    "lower": lambda s: s.lower(),
    "alnum": alnum,
    "alnumsp": alnumsp,
    "len": lambda s: str(len(s)),
}


def _eval_term(term: str, row_args, sender: str, ctx) -> str:
    term = term.strip()
    m = re.fullmatch(r"(\w+)\((.*)\)", term)
    if m and m.group(1) in _FUNCS:
        return _FUNCS[m.group(1)](_eval_term(m.group(2), row_args, sender, ctx))
    if term.startswith("L:"):
        return term[2:]
    if term == "sender":
        return sender
    if term.startswith("W:"):
        return ctx["wallets"][term[2:]]
    if term.startswith("ID:"):
        return ctx["ids"][term[3:]]
    if re.fullmatch(r"A\d+", term):
        value = row_args[int(term[1:])]
        if isinstance(value, bool):
            return "true" if value else "false"
        return str(value)
    raise ValueError("bad payload term " + term)


def eval_payload(parts, row_args, sender: str, ctx) -> str:
    return keccak_hex("".join(_eval_term(p, row_args, sender, ctx) for p in parts))


def resolve_arg(value, ctx):
    """'$A' -> wallet A (lower-case hex); '$G1' -> saved id G1 (64 hex); '$$x' -> literal '$x'."""
    if isinstance(value, str) and value.startswith("$"):
        if value.startswith("$$"):
            return value[1:]
        key = value[1:]
        if key in ctx["wallets"]:
            return ctx["wallets"][key]
        if key in ctx["ids"]:
            return ctx["ids"][key]
        raise KeyError("unresolved reference " + value)
    if isinstance(value, list):
        return [resolve_arg(v, ctx) for v in value]
    return value


def load_runtime(root: Path) -> dict:
    return json.loads((root / "tests" / "runtime.json").read_text(encoding="utf-8"))


def calls_of(row):
    """A row may carry one call or several ('calls': [...]) — e.g. 'add_item x5'."""
    if "calls" in row:
        return row["calls"]
    return [row]


def replay(vm, contract, runtime: dict, wallets: dict, after=None, warp=None):
    """
    Execute the planned on-chain table in order.
      wallets: role -> Address (from create_address)
      after(n, ctx): optional per-row assertion hook, called after the row ran.
      warp(vm, iso): optional clock hook used when a row has "at": "<ISO datetime>".
    Returns ctx = {"wallets": role -> lower hex, "ids": name -> hex}.
    """
    ctx = {"wallets": {k: lo(v) for k, v in wallets.items()}, "ids": {}}
    for row in runtime["rows"]:
        for call in calls_of(row):
            who = call.get("wallet", row.get("wallet"))
            if call.get("at") and warp is not None:
                warp(vm, call["at"])
            if who:
                vm.sender = wallets[who]
            if call.get("value") is not None:
                vm.value = int(call["value"])
            args = resolve_arg(call.get("args", []), ctx)
            fn = getattr(contract, call["method"])
            if call.get("revert"):
                with vm.expect_revert(call["revert"]):
                    fn(*args)
            else:
                result = fn(*args)
                if call.get("kind") == "view":
                    call["_result"] = result
            if call.get("value") is not None:
                vm.value = 0
            save = call.get("save")
            if save:
                sender = ctx["wallets"][who] if who else ""
                ctx["ids"][save["name"]] = eval_payload(save["payload"], args, sender, ctx)
        if after is not None:
            after(row["n"], ctx)
    return ctx


def chain_warp(vm, iso: str):
    """vm.warp() alone does not change gl.message_raw['datetime']; write it directly."""
    vm.warp(iso)
    import genlayer.gl as gl
    gl.message_raw["datetime"] = iso


# ---------------------------------------------------------------------
# Source-level helpers shared by every suite
# ---------------------------------------------------------------------

def source_revert_strings(contract_path: str):
    src = Path(contract_path).read_text(encoding="utf-8")
    return set(re.findall(r'UserError\(\s*"([^"]+)"\s*\)', src))


def owned_revert_strings(test_file: str, namespace: dict):
    """The first expect_revert string inside each test_revert_* function is the string it owns."""
    tree = ast.parse(Path(test_file).read_text(encoding="utf-8"))
    owned = {}
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name.startswith("test_revert_"):
            calls = [c for c in ast.walk(node)
                     if isinstance(c, ast.Call) and getattr(c.func, "attr", "") == "expect_revert" and c.args]
            calls.sort(key=lambda c: (c.lineno, c.col_offset))
            value = None
            if calls:
                arg = calls[0].args[0]
                if isinstance(arg, ast.Constant):
                    value = arg.value
                elif isinstance(arg, ast.Name):
                    value = namespace.get(arg.id)
            owned[node.name] = value
    return owned


def check_revert_coverage(contract_path: str, test_file: str, namespace: dict, expected_count: int):
    strings = source_revert_strings(contract_path)
    assert len(strings) == expected_count, sorted(strings)
    owned = owned_revert_strings(test_file, namespace)
    assert None not in owned.values(), owned
    per_string = {}
    for test, s in owned.items():
        per_string.setdefault(s, []).append(test)
    assert sorted(set(per_string) - strings) == [], "tests own strings the contract does not have"
    assert sorted(strings - set(per_string)) == [], "revert strings without a dedicated test"
    for s, tests in per_string.items():
        assert len(tests) == 1, (s, tests)


def check_forbidden_constructs(contract_path: str, money: bool, clock: bool, model_calls: int = 1):
    src = Path(contract_path).read_text(encoding="utf-8")
    lines = src.splitlines()
    assert lines[0] == "# v0.2.16"
    assert lines[1].startswith('# { "Depends": "py-genlayer:')
    assert lines[3] == "from genlayer import *"
    for name in re.findall(r"def\s+(\w+)", src):
        assert not re.match(r"(preview_|classify_|dry_run_|simulate_)", name), name
    for api in ("web.render", "time.time", "import datetime", "from datetime", "datetime.now", "random",
                "gl.message.raw", "run_nondet(", "import genlayer as gl"):
        assert api not in src, api
    assert src.count("exec_prompt") == model_calls
    assert src.count("run_nondet_unsafe") == model_calls
    if not money:
        for api in ("emit_transfer", "payable", "message.value"):
            assert api not in src, api
    if not clock:
        assert "message_raw" not in src
    else:
        assert src.count('gl.message_raw["datetime"]') == 1


def gate_rubric(gate_path: str) -> str:
    src = Path(gate_path).read_text(encoding="utf-8")
    m = re.search(r"RUBRIC_DRAFT = '''(.*?)'''", src, re.S)
    assert m, "gate has no RUBRIC_DRAFT"
    return m.group(1).strip()
