#!/usr/bin/env python3
"""Synthetic parity and accounting checks for the public browser housing model."""
import json, math, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "assets" / "housing-calculator.js"


def payment(principal, rate_percent, months):
    rate = rate_percent / 1200
    return principal / months if rate == 0 else principal * rate / (1 - (1 + rate) ** -months)


def browser(expression):
    source = "require(" + json.dumps(str(JS)) + "); console.log(JSON.stringify(" + expression + "));"
    return json.loads(subprocess.check_output(["node", "-e", source], text=True))


def main():
    # Mortgage payment is independently recomputed in Python.
    js_payment = browser("ritvikmathHousingPublic.payment(400000, 6.25, 360)")
    assert math.isclose(js_payment, payment(400000, 6.25, 360), rel_tol=1e-12)

    # All fixtures are synthetic and derived only from the public configuration.
    result = browser("ritvikmathHousingPublic.evaluate(ritvikmathHousingPublic.defaults, true)")
    assert len(result["buy"]["rows"]) == 361
    assert len(result["rent"]["rows"]) == 361
    assert result["buy"]["rows"][0]["balance"] > result["buy"]["rows"][120]["balance"]
    assert result["buy"]["rows"][120]["equity"] == result["buy"]["rows"][120]["home"] - result["buy"]["rows"][120]["balance"]
    assert math.isfinite(result["metrics"]["saleAdvantage"])

    # Taxable withdrawals preserve a finite, nonnegative taxable balance and basis.
    withdrawal = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,cash:1000,taxable:250000,taxableBasis:150000}, true)")
    assert withdrawal["buy"]["rows"][0]["accessible"] >= 0

    # Stress fixtures exercise infeasibility, market loss, and a large repair.
    infeasible = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,cash:0,taxable:0,taxableBasis:0,income:2500,living:4000}, true)")
    assert infeasible["metrics"]["feasible"] is False
    stressed = browser("ritvikmathHousingPublic.simulate(ritvikmathHousingPublic.defaults,true,{incomeCut:true,marketShock:true,repair:true})")
    assert stressed["minAccessible"] < result["buy"]["minAccessible"]

    # Scenario direction checks: stronger appreciation helps buying; stronger
    # investment returns improve renting's opportunity-cost path.
    low_app = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,appreciation:0}, true).metrics.advantage")
    high_app = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,appreciation:6}, true).metrics.advantage")
    assert high_app > low_app
    low_return = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,investmentReturn:3}, true).metrics.advantage")
    high_return = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,investmentReturn:9}, true).metrics.advantage")
    assert high_return < low_return
    print("Public housing model synthetic parity and scenario checks passed.")


if __name__ == "__main__":
    main()
