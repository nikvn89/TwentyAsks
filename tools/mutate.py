"""
Mutation check: apply each deliberate fault from <project>/tests/mutations.py to the
contract, one at a time, run the Direct Mode suite, and require a red run.

Usage: python3.13 mutate.py <project-dir>
Writes <project-dir>/tests/mutation-report.json and exits 1 unless every fault is caught.
Each mutation is (name, old, new); `old` must occur exactly once in the contract.
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
spec = importlib.util.spec_from_file_location("mutations", root / "tests" / "mutations.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
contract = next((root / "contracts").glob("*.py"))
original = contract.read_text(encoding="utf-8")

results = []
try:
    base = subprocess.run([sys.executable, "-m", "pytest", "tests/contract", "-q", "-x", "-p", "no:cacheprovider"],
                          cwd=root, capture_output=True, text=True)
    if base.returncode != 0:
        print(base.stdout[-3000:])
        sys.exit("baseline suite is red — fix it before mutating")
    for name, old, new in mod.MUTATIONS:
        count = original.count(old)
        if count != 1:
            results.append({"name": name, "status": "BAD_PATTERN", "count": count})
            continue
        contract.write_text(original.replace(old, new), encoding="utf-8")
        run = subprocess.run([sys.executable, "-m", "pytest", "tests/contract", "-q", "-x", "-p", "no:cacheprovider"],
                             cwd=root, capture_output=True, text=True)
        status = "CAUGHT" if run.returncode != 0 else "SURVIVED"
        failing = ""
        for line in run.stdout.splitlines():
            if line.startswith("FAILED") or line.startswith("ERROR"):
                failing = line[:160]
                break
        results.append({"name": name, "status": status, "first_failure": failing})
finally:
    contract.write_text(original, encoding="utf-8")

caught = sum(1 for r in results if r["status"] == "CAUGHT")
report = {"total": len(results), "caught": caught, "results": results}
(root / "tests" / "mutation-report.json").write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
for r in results:
    print(f'{r["status"]:<11} {r["name"]}')
print(f"mutation {caught}/{len(results)}")
sys.exit(0 if results and caught == len(results) and len(results) >= 12 else 1)
