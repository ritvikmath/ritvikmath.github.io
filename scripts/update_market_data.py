#!/usr/bin/env python3
"""Refresh and backtest the adaptive stock-allocation experiment."""

import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "stock-bandit-1y.json"
STARTING_INVESTMENT = 1000.0
SCORE_MEMORY = 0.5
EXPLORATION_SHARE = 0.3
MAX_WEIGHT = 0.3
SOFTMAX_TEMPERATURE = 0.04
ASSETS = (
    {"id": "msft", "symbol": "MSFT", "name": "Microsoft", "detail": "Technology"},
    {"id": "google", "symbol": "GOOGL", "name": "Google", "detail": "Communication Services"},
    {"id": "amazon", "symbol": "AMZN", "name": "Amazon", "detail": "Consumer Discretionary"},
    {"id": "pg", "symbol": "PG", "name": "Procter & Gamble", "detail": "Consumer Staples"},
    {"id": "jpm", "symbol": "JPM", "name": "JPMorgan", "detail": "Financials"},
    {"id": "jnj", "symbol": "JNJ", "name": "Johnson & Johnson", "detail": "Health Care"},
    {"id": "xom", "symbol": "XOM", "name": "Exxon Mobil", "detail": "Energy"},
    {"id": "cat", "symbol": "CAT", "name": "Caterpillar", "detail": "Industrials"},
    {"id": "nee", "symbol": "NEE", "name": "NextEra Energy", "detail": "Utilities"},
    {"id": "lin", "symbol": "LIN", "name": "Linde", "detail": "Materials"},
)


def fetch_prices():
    """Download one year of aligned adjusted closes for all experiment stocks."""
    last_error = None
    symbols = [asset["symbol"] for asset in ASSETS]
    for attempt in range(3):
        try:
            history = yf.download(
                symbols,
                period="1y",
                interval="1d",
                auto_adjust=True,
                actions=False,
                progress=False,
                threads=False,
            )
            closes = history["Close"][symbols].dropna()
            if len(closes) < 200:
                raise ValueError(f"Expected at least 200 shared observations, received {len(closes)}")
            dates = [index.date().isoformat() for index in closes.index]
            if any(dates[index] >= dates[index + 1] for index in range(len(dates) - 1)):
                raise ValueError("Market dates are not strictly increasing")
            return dates, closes
        except Exception as error:  # Preserve the previous good file after all retries.
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to refresh experiment data: {last_error}")


def existing_market_date():
    """Return the currently published market date, if the data file is valid."""
    if not OUTPUT.exists():
        return None
    try:
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return payload.get("market_date")
    except (OSError, json.JSONDecodeError):
        return None


def allocation_from_scores(scores):
    """Turn learned rewards into bounded explore/exploit portfolio weights."""
    highest_score = max(scores.values())
    exponentials = {
        asset_id: math.exp((score - highest_score) / SOFTMAX_TEMPERATURE)
        for asset_id, score in scores.items()
    }
    denominator = sum(exponentials.values())
    minimum_weight = EXPLORATION_SHARE / len(scores)
    uncapped_weights = {
        asset_id: minimum_weight + (1 - EXPLORATION_SHARE) * (value / denominator)
        for asset_id, value in exponentials.items()
    }
    weights = {}
    remaining_ids = list(uncapped_weights)
    while remaining_ids:
        remaining_total = 1 - sum(weights.values())
        scale = remaining_total / sum(uncapped_weights[asset_id] for asset_id in remaining_ids)
        over_cap = [
            asset_id for asset_id in remaining_ids
            if uncapped_weights[asset_id] * scale > MAX_WEIGHT
        ]
        if not over_cap:
            for asset_id in remaining_ids:
                weights[asset_id] = uncapped_weights[asset_id] * scale
            break
        for asset_id in over_cap:
            weights[asset_id] = MAX_WEIGHT
        remaining_ids = [asset_id for asset_id in remaining_ids if asset_id not in over_cap]
    return weights


def simulate_backtest(dates, closes):
    """Run buy-and-hold baselines and the weekly adaptive strategy."""
    asset_ids = [asset["id"] for asset in ASSETS]
    symbol_for = {asset["id"]: asset["symbol"] for asset in ASSETS}
    buy_hold_shares = {
        asset_id: STARTING_INVESTMENT / float(closes.iloc[0][symbol_for[asset_id]])
        for asset_id in asset_ids
    }
    equal_weight_shares = {
        asset_id: (STARTING_INVESTMENT / len(asset_ids)) / float(closes.iloc[0][symbol_for[asset_id]])
        for asset_id in asset_ids
    }
    weights = {asset_id: 1 / len(asset_ids) for asset_id in asset_ids}
    scores = {asset_id: 0.0 for asset_id in asset_ids}
    adaptive_shares = {
        asset_id: STARTING_INVESTMENT * weights[asset_id] / float(closes.iloc[0][symbol_for[asset_id]])
        for asset_id in asset_ids
    }

    week_keys = [(index.isocalendar().year, index.isocalendar().week) for index in closes.index]
    week_end_indices = {
        index for index in range(len(week_keys) - 1)
        if week_keys[index + 1] != week_keys[index]
    }
    if closes.index[-1].weekday() == 4:  # Include the current week once Friday has closed.
        week_end_indices.add(len(week_keys) - 1)
    week_start_index = 0
    points = []
    allocation_points = []
    rebalances = []

    for row_index, date in enumerate(dates):
        prices = {
            asset_id: float(closes.iloc[row_index][symbol_for[asset_id]])
            for asset_id in asset_ids
        }
        adaptive_value = sum(adaptive_shares[asset_id] * prices[asset_id] for asset_id in asset_ids)
        equal_weight_value = sum(equal_weight_shares[asset_id] * prices[asset_id] for asset_id in asset_ids)
        point = {"date": date, "adaptive": round(adaptive_value, 2), "equal": round(equal_weight_value, 2)}
        for asset_id in asset_ids:
            point[asset_id] = round(buy_hold_shares[asset_id] * prices[asset_id], 2)
        points.append(point)
        allocation_points.append({
            "date": date,
            **{asset_id: round(weights[asset_id] * 100, 4) for asset_id in asset_ids},
        })

        if row_index in week_end_indices:
            weekly_returns = {
                asset_id: (
                    prices[asset_id] / float(closes.iloc[week_start_index][symbol_for[asset_id]])
                ) - 1
                for asset_id in asset_ids
            }
            scores = {
                asset_id: SCORE_MEMORY * scores[asset_id] + (1 - SCORE_MEMORY) * weekly_returns[asset_id]
                for asset_id in asset_ids
            }
            next_weights = allocation_from_scores(scores)
            turnover = 0.5 * sum(abs(next_weights[asset_id] - weights[asset_id]) for asset_id in asset_ids)
            adaptive_shares = {
                asset_id: adaptive_value * next_weights[asset_id] / prices[asset_id]
                for asset_id in asset_ids
            }
            weights = next_weights
            allocation_points[-1].update({
                asset_id: round(weights[asset_id] * 100, 4) for asset_id in asset_ids
            })
            rebalances.append({
                "date": date,
                "portfolio_value": round(adaptive_value, 2),
                "weekly_returns": {
                    asset_id: round(weekly_returns[asset_id] * 100, 2) for asset_id in asset_ids
                },
                "scores": {asset_id: round(scores[asset_id] * 100, 2) for asset_id in asset_ids},
                "weights": {asset_id: round(weights[asset_id] * 100, 2) for asset_id in asset_ids},
                "turnover_percent": round(turnover * 100, 2),
            })
            week_start_index = row_index + 1

    return points, allocation_points, rebalances, weights


def build_payload(dates, closes):
    points, allocation_points, rebalances, current_weights = simulate_backtest(dates, closes)
    series = [{
        "id": "adaptive",
        "symbol": "ADAPTIVE",
        "name": "Adaptive Bandit",
        "detail": "Weekly allocation",
        "latest_value": points[-1]["adaptive"],
        "return_percent": round((points[-1]["adaptive"] / STARTING_INVESTMENT - 1) * 100, 2),
    }, {
        "id": "equal",
        "symbol": "EQUAL",
        "name": "Equal-Weight Hold",
        "detail": "10% in each stock, never rebalanced",
        "latest_value": points[-1]["equal"],
        "return_percent": round((points[-1]["equal"] / STARTING_INVESTMENT - 1) * 100, 2),
    }]
    for asset in ASSETS:
        series.append({
            **asset,
            "latest_value": points[-1][asset["id"]],
            "return_percent": round((points[-1][asset["id"]] / STARTING_INVESTMENT - 1) * 100, 2),
        })

    leader = max(series, key=lambda item: item["latest_value"])
    return {
        "experiment": "adaptive-stock-bandit",
        "currency": "USD",
        "range": "1 year",
        "starting_investment": STARTING_INVESTMENT,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "market_date": dates[-1],
        "start_date": dates[0],
        "leader": leader["id"],
        "adaptive_vs_equal_weight": {
            "dollar_difference": round(points[-1]["adaptive"] - points[-1]["equal"], 2),
            "return_difference_points": round((points[-1]["adaptive"] - points[-1]["equal"]) / STARTING_INVESTMENT * 100, 2),
        },
        "strategy": {
            "score_memory_percent": SCORE_MEMORY * 100,
            "latest_week_percent": (1 - SCORE_MEMORY) * 100,
            "exploration_share_percent": EXPLORATION_SHARE * 100,
            "minimum_weight_percent": (EXPLORATION_SHARE / len(ASSETS)) * 100,
            "maximum_weight_percent": MAX_WEIGHT * 100,
            "rebalance_frequency": "weekly",
        },
        "series": series,
        "current_allocation": {
            asset_id: round(weight * 100, 2) for asset_id, weight in current_weights.items()
        },
        "recent_rebalances": rebalances[-8:][::-1],
        "rebalance_count": len(rebalances),
        "points": points,
        "allocation_points": allocation_points,
    }


def main():
    dates, closes = fetch_prices()
    latest_market_date = dates[-1]
    force_write = os.environ.get("FORCE_MARKET_DATA_WRITE", "").lower() in {"1", "true", "yes"}
    if existing_market_date() == latest_market_date and not force_write:
        print(f"No new market data; {latest_market_date} is already published.")
        return

    payload = build_payload(dates, closes)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Saved {len(payload['points'])} observations and {payload['rebalance_count']} rebalances through {payload['market_date']} to {OUTPUT}")


if __name__ == "__main__":
    main()
