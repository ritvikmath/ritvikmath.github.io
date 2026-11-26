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
    assert math.isfinite(withdrawal["buy"]["rows"][0]["accessible"])
    assert withdrawal["buy"]["rows"][0]["taxable"] >= 0
    assert withdrawal["buy"]["rows"][0]["taxableBasis"] >= 0

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

    # Automatic closing costs follow the public formula and respond to both
    # price and down payment through the financed amount used for points.
    closing = browser("ritvikmathHousingPublic.closingEstimate({...ritvikmathHousingPublic.defaults,price:800000,downPayment:20,closingFraction:3.5,closingPoints:1,closingCredits:2000,escrowDeposit:3000,prepaidInsurance:1000,prepaidPropertyTax:2000})")
    assert math.isclose(closing["grossBudget"], 34400)
    assert math.isclose(closing["netFees"], 26400)
    lower_loan = browser("ritvikmathHousingPublic.closingEstimate({...ritvikmathHousingPublic.defaults,price:800000,downPayment:40,closingPoints:1}).pointsCost")
    assert lower_loan < closing["pointsCost"]
    manual = browser("ritvikmathHousingPublic.closingEstimate({...ritvikmathHousingPublic.defaults,closingMode:'manual',manualClosingCosts:12345})")
    assert manual["netFees"] == 12345

    # Saved comparisons migrate once, preserve the stored effective rate, and
    # never overwrite a deliberate manual override after migration.
    migrated = browser("ritvikmathHousingPublic.migrateSaves([{id:'old',savedAt:'2026-01-01T00:00:00Z',config:{...ritvikmathHousingPublic.defaults,mortgageRate:5.75,closingMode:'manual',manualClosingCosts:10000}}])")
    assert migrated[0]["schemaVersion"] == 2
    assert migrated[0]["config"]["mortgageRate"] == 5.75
    assert migrated[0]["config"]["closingMode"] == "auto"
    remigrated = browser("ritvikmathHousingPublic.migrateSaves(" + json.dumps(migrated) + ")")
    assert remigrated == migrated

    # The default mortgage is a plain 30-year note; no temporary rate schedule
    # exists in the public schema.
    defaults = browser("ritvikmathHousingPublic.defaults")
    assert defaults["mortgageYears"] == 30
    assert defaults["repairYear"] == defaults["repairAmount"] == 0
    assert defaults["homeGainTax"] == defaults["homeGainEligible"] == 0
    assert defaults["affordabilityYears"] == defaults["horizon"]
    assert "buydownRates" not in defaults

    # Exact year-over-year pairs may fall back from an incomplete newest row.
    fred = "DATE,CPIAUCSL\n2025-01-01,100\n2026-01-01,103\n2026-02-01,104"
    parsed = browser("ritvikmathHousingPublic.parseFredCSV(" + json.dumps(fred) + ",{series:'CPIAUCSL',lagMonths:12,maxAge:800},'2026-03-01T00:00:00Z')")
    assert parsed["observationDate"] == "2026-01-01"
    assert parsed["latestAvailableObservation"] == "2026-02-01"
    assert math.isclose(parsed["rate"], .03)

    # Affordability windows cap to the forecast and are independent of the
    # selected holding period.
    short_window = browser("ritvikmathHousingPublic.evaluate({...ritvikmathHousingPublic.defaults,horizon:3,forecastYears:5,affordabilityYears:30},true)")
    assert short_window["metrics"]["budgetWindowMonths"] == 60

    # Published standard deduction amounts are explicit through 2027.
    assert browser("ritvikmathHousingPublic.standardDeduction(2026,'mfj')") == 32200
    assert browser("ritvikmathHousingPublic.standardDeduction(2026,'single')") == 16100
    assert browser("ritvikmathHousingPublic.standardDeduction(2027,'mfj')") == 33200
    assert browser("ritvikmathHousingPublic.standardDeduction(2027,'single')") == 16600

    # Dependent-cost phases include the start month and exclude the end month.
    phased = browser("ritvikmathHousingPublic.simulate({...ritvikmathHousingPublic.defaults,forecastYears:1,horizon:1,affordabilityYears:1,childPhases:[{start:2,end:4,amount:500}]},false)")
    assert phased["rows"][2]["dependent"] == 0
    assert phased["rows"][3]["dependent"] > 0
    assert phased["rows"][4]["dependent"] > 0
    assert phased["rows"][5]["dependent"] == 0
    print("Public housing model synthetic parity and scenario checks passed.")


if __name__ == "__main__":
    main()
