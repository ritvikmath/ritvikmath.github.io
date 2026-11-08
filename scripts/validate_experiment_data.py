#!/usr/bin/env python3
"""Fail deployment when an experiment builder emits incomplete or invalid data."""

import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "assets" / "data"


def load(name):
    payload = json.loads((DATA / name).read_text(encoding="utf-8"))
    def finite(value):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError(f"{name} contains a non-finite number")
        if isinstance(value, dict):
            for child in value.values(): finite(child)
        elif isinstance(value, list):
            for child in value: finite(child)
    finite(payload)
    return payload


def increasing(points, label):
    dates = [point["date"] for point in points]
    if dates != sorted(set(dates)):
        raise ValueError(f"{label} dates are not strictly increasing")


def main():
    stock = load("stock-bandit-1y.json")
    increasing(stock["points"], "stock bandit")
    if abs(sum(stock["current_allocation"].values()) - 100) > 0.1:
        raise ValueError("Stock-bandit allocation does not sum to 100%")

    prediction = load("stock-direction-xgb.json")
    if prediction["train_target_end"] >= prediction["test_start"]:
        raise ValueError("Prediction training targets cross into the test period")
    if prediction["split"]["model_fits"] != 1:
        raise ValueError("Prediction experiment must fit exactly once")

    stock_bond = load("stock-bond-bandit.json")
    increasing(stock_bond["points"], "stock/bond bandit")
    if stock_bond["backtest_end"] > stock_bond["market_date"]:
        raise ValueError("Completed stock/bond quarter exceeds market date")

    sectors = load("two-sector-bandit.json")
    increasing(sectors["points"], "sector experiment")
    for decision in sectors["decisions"]:
        if abs(sum(decision["weights"].values()) - 100) > 0.6:
            raise ValueError("Sector allocation does not sum to 100%")

    attribution = load("market-attribution.json")
    snapshot = attribution["snapshot"]
    if snapshot["date"] != snapshot["holdings_date"]:
        raise ValueError("Attribution prices and holdings use different dates")
    if snapshot["covered_end_weight_pct"] < 99.5:
        raise ValueError("Attribution coverage is below 99.5%")
    if abs(sum(item["weight_pct"] for item in attribution["constituents"]) - 100) > 0.1:
        raise ValueError("Attribution opening weights do not sum to 100%")

    print("Validated all five experiment datasets.")


if __name__ == "__main__":
    main()
