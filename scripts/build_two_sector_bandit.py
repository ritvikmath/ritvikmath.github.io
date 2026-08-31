#!/usr/bin/env python3
"""Build the frozen five-sector behavioral-allocation experiment."""

import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "two-sector-bandit.json"
STARTING_VALUE = 1000.0
TRADING_COST = 0.001
MIN_WEIGHT = 0.05
RIDGE = 5.0
PREDICTION_SCALE = 0.01
UNCERTAINTY_SHRINKAGE = 1.0
TURNOVER_PENALTY = 3.0
PANIC_LOSS = -0.02
PANIC_ADVANTAGE = 0.01
FOMO_ADVANTAGE = 0.015
DIP_LOSS = -0.02
DIP_DISCOUNT = 0.01
BEHAVIORAL_FOCUS = 0.60
ASSETS = [
    {"id": "xlk", "symbol": "XLK", "name": "Technology Select Sector SPDR ETF", "sector": "Technology"},
    {"id": "xlv", "symbol": "XLV", "name": "Health Care Select Sector SPDR ETF", "sector": "Health care"},
    {"id": "xle", "symbol": "XLE", "name": "Energy Select Sector SPDR ETF", "sector": "Energy"},
    {"id": "xlf", "symbol": "XLF", "name": "Financial Select Sector SPDR ETF", "sector": "Financials"},
    {"id": "xlp", "symbol": "XLP", "name": "Consumer Staples Select Sector SPDR ETF", "sector": "Consumer staples"},
]
ASSET_IDS = [asset["id"] for asset in ASSETS]


def fetch_prices():
    """Download and align two years of adjusted daily sector-ETF prices."""
    series = {}
    for asset in ASSETS:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{asset['symbol']}?range=2y&interval=1d&events=div%2Csplits"
        request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urlopen(request, timeout=30) as response:
            chart = json.load(response)["chart"]["result"][0]
        adjusted = chart["indicators"]["adjclose"][0]["adjclose"]
        series[asset["id"]] = {
            datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat(): price
            for timestamp, price in zip(chart["timestamp"], adjusted)
            if price is not None
        }
    dates = sorted(set.intersection(*(set(series[asset]) for asset in ASSET_IDS)))
    if len(dates) < 450:
        raise ValueError(f"Expected at least 450 aligned observations, received {len(dates)}")
    first = {asset: series[asset][dates[0]] for asset in ASSET_IDS}
    return [{
        "date": date,
        **{asset: STARTING_VALUE * series[asset][date] / first[asset] for asset in ASSET_IDS},
    } for date in dates]


def clip(value, lower, upper):
    return min(upper, max(lower, value))


def inverse(matrix):
    size = len(matrix)
    augmented = [row[:] + [1.0 if i == j else 0.0 for j in range(size)] for i, row in enumerate(matrix)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        if abs(divisor) < 1e-12:
            raise ValueError("Context matrix is singular")
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [value - factor * pivot_value for value, pivot_value in zip(augmented[row], augmented[column])]
    return [row[size:] for row in augmented]


def mat_vec(matrix, vector):
    return [sum(value * vector[column] for column, value in enumerate(row)) for row in matrix]


def dot(left, right):
    return sum(a * b for a, b in zip(left, right))


def trailing_return(points, index, lookback, asset):
    return points[index][asset] / points[max(0, index - lookback)][asset] - 1


def trailing_volatility(points, index, lookback, asset):
    start = max(1, index - lookback + 1)
    returns = [points[i][asset] / points[i - 1][asset] - 1 for i in range(start, index + 1)]
    return statistics.stdev(returns) * math.sqrt(252) if len(returns) > 1 else 0.0


def trailing_drawdown(points, index, lookback, asset):
    start = max(0, index - lookback)
    peak = max(point[asset] for point in points[start:index + 1])
    return points[index][asset] / peak - 1


def contexts_at(points, index):
    """Make comparable, bounded features using information known at index."""
    raw = {}
    for asset in ASSET_IDS:
        raw[asset] = {
            "momentum_4": trailing_return(points, index, 20, asset),
            "momentum_13": trailing_return(points, index, 60, asset),
            "volatility": trailing_volatility(points, index, 60, asset),
            "drawdown": trailing_drawdown(points, index, 60, asset),
        }
    averages = {name: sum(values[name] for values in raw.values()) / len(raw) for name in raw[ASSET_IDS[0]]}
    return {
        asset: [
            1.0,
            clip((raw[asset]["momentum_4"] - averages["momentum_4"]) / 0.15, -1.0, 1.0),
            clip((raw[asset]["momentum_13"] - averages["momentum_13"]) / 0.30, -1.0, 1.0),
            clip((raw[asset]["volatility"] - averages["volatility"]) / 0.30, -1.0, 1.0),
            clip((raw[asset]["drawdown"] - averages["drawdown"]) / 0.30, -1.0, 1.0),
        ] for asset in ASSET_IDS
    }


def continuous_weights(contexts, matrix, rewards, previous_weights):
    matrix_inverse = inverse(matrix)
    coefficients = mat_vec(matrix_inverse, rewards)
    predictions = {asset: dot(coefficients, contexts[asset]) for asset in ASSET_IDS}
    uncertainties = {
        asset: math.sqrt(max(0.0, dot(contexts[asset], mat_vec(matrix_inverse, contexts[asset]))))
        for asset in ASSET_IDS
    }
    scores = {
        asset: predictions[asset] / (1.0 + UNCERTAINTY_SHRINKAGE * uncertainties[asset])
        for asset in ASSET_IDS
    }
    maximum = max(scores.values())
    exponentials = {asset: math.exp((scores[asset] - maximum) / PREDICTION_SCALE) for asset in ASSET_IDS}
    total = sum(exponentials.values())
    available = 1.0 - MIN_WEIGHT * len(ASSET_IDS)
    targets = {asset: MIN_WEIGHT + available * exponentials[asset] / total for asset in ASSET_IDS}
    weights = {
        asset: (targets[asset] + TURNOVER_PENALTY * previous_weights[asset]) / (1.0 + TURNOVER_PENALTY)
        for asset in ASSET_IDS
    }
    return weights, predictions, uncertainties, targets


def focused_weights(asset):
    remainder = (1.0 - BEHAVIORAL_FOCUS) / (len(ASSET_IDS) - 1)
    return {candidate: BEHAVIORAL_FOCUS if candidate == asset else remainder for candidate in ASSET_IDS}


def panic_weights(previous, returns):
    if returns is None:
        return previous
    majority = max(ASSET_IDS, key=previous.get)
    alternative = max((asset for asset in ASSET_IDS if asset != majority), key=returns.get)
    if returns[majority] <= PANIC_LOSS and returns[alternative] - returns[majority] >= PANIC_ADVANTAGE:
        return focused_weights(alternative)
    return previous


def fomo_weights(previous, returns):
    if returns is None:
        return previous
    ordered = sorted(ASSET_IDS, key=returns.get, reverse=True)
    return focused_weights(ordered[0]) if returns[ordered[0]] - returns[ordered[1]] >= FOMO_ADVANTAGE else previous


def dip_weights(previous, returns):
    if returns is None:
        return previous
    ordered = sorted(ASSET_IDS, key=returns.get)
    return focused_weights(ordered[0]) if returns[ordered[0]] <= DIP_LOSS and returns[ordered[1]] - returns[ordered[0]] >= DIP_DISCOUNT else previous


def turnover(new, previous):
    return 0.5 * sum(abs(new[asset] - previous[asset]) for asset in ASSET_IDS)


def weighted_growth(weights, points, index, start_values):
    return sum(weights[asset] * points[index][asset] / start_values[asset] for asset in ASSET_IDS)


def main():
    raw_points = fetch_prices()
    week_starts = [0] + list(range(5, len(raw_points), 5))
    if week_starts[-1] != len(raw_points) - 1:
        week_starts.append(len(raw_points) - 1)

    dimension = 5
    matrix = [[RIDGE if row == column else 0.0 for column in range(dimension)] for row in range(dimension)]
    rewards = [0.0] * dimension
    equal = {asset: 1.0 / len(ASSET_IDS) for asset in ASSET_IDS}
    strategy_values = {strategy: STARTING_VALUE for strategy in ("bandit", "panic", "fomo", "dip")}
    previous_bandit = equal.copy()
    previous_behavior = {strategy: equal.copy() for strategy in ("panic", "fomo", "dip")}
    behavior_functions = {"panic": panic_weights, "fomo": fomo_weights, "dip": dip_weights}
    behavior_costs = {strategy: 0.0 for strategy in behavior_functions}
    behavior_switches = {strategy: 0 for strategy in behavior_functions}
    previous_returns = None
    output_points = []
    decisions = []

    for round_number, (start, end) in enumerate(zip(week_starts[:-1], week_starts[1:])):
        contexts = contexts_at(raw_points, start)
        if round_number < 12:
            bandit_weights = equal.copy()
            predictions = {asset: 0.0 for asset in ASSET_IDS}
            uncertainties = {asset: 1.0 for asset in ASSET_IDS}
            targets = equal.copy()
        else:
            bandit_weights, predictions, uncertainties, targets = continuous_weights(contexts, matrix, rewards, previous_bandit)

        current_weights = {"bandit": bandit_weights}
        for strategy, function in behavior_functions.items():
            current_weights[strategy] = function(previous_behavior[strategy], previous_returns)

        start_values = {asset: raw_points[start][asset] for asset in ASSET_IDS}
        starting_portfolios = {}
        costs = {}
        for strategy, weights in current_weights.items():
            previous = previous_bandit if strategy == "bandit" else previous_behavior[strategy]
            moved = 0.0 if round_number == 0 else turnover(weights, previous)
            costs[strategy] = strategy_values[strategy] * moved * TRADING_COST
            strategy_values[strategy] -= costs[strategy]
            starting_portfolios[strategy] = strategy_values[strategy]
            if strategy != "bandit":
                behavior_costs[strategy] += costs[strategy]
                if moved > 0:
                    behavior_switches[strategy] += 1

        for index in range(start, end + 1):
            point = {"date": raw_points[index]["date"]}
            for strategy, weights in current_weights.items():
                point[strategy] = round(starting_portfolios[strategy] * weighted_growth(weights, raw_points, index, start_values), 2)
            if not output_points or output_points[-1]["date"] != point["date"]:
                output_points.append(point)
            else:
                output_points[-1] = point

        realized_returns = {asset: raw_points[end][asset] / start_values[asset] - 1 for asset in ASSET_IDS}
        for strategy, weights in current_weights.items():
            portfolio_return = sum(weights[asset] * realized_returns[asset] for asset in ASSET_IDS)
            strategy_values[strategy] = starting_portfolios[strategy] * (1 + portfolio_return)

        average_return = sum(realized_returns.values()) / len(realized_returns)
        for asset in ASSET_IDS:
            relative_return = realized_returns[asset] - average_return
            context = contexts[asset]
            for row in range(dimension):
                rewards[row] += context[row] * relative_return
                for column in range(dimension):
                    matrix[row][column] += context[row] * context[column]

        decisions.append({
            "date": raw_points[start]["date"],
            "week_ending": raw_points[end]["date"],
            "weights": {asset: round(100 * bandit_weights[asset], 1) for asset in ASSET_IDS},
            "targets": {asset: round(100 * targets[asset], 1) for asset in ASSET_IDS},
            "predictions": {asset: round(100 * predictions[asset], 3) for asset in ASSET_IDS},
            "uncertainties": {asset: round(uncertainties[asset], 3) for asset in ASSET_IDS},
            "weekly_return": round(100 * sum(bandit_weights[asset] * realized_returns[asset] for asset in ASSET_IDS), 2),
            "turnover": round(100 * (0.0 if round_number == 0 else turnover(bandit_weights, previous_bandit)), 2),
            "cost": round(costs["bandit"], 2),
            "reason": "equal-weight learning period" if round_number < 12 else "continuous contextual estimate",
        })
        previous_bandit = bandit_weights
        for strategy in behavior_functions:
            previous_behavior[strategy] = current_weights[strategy]
        previous_returns = realized_returns

    final = output_points[-1]
    moves = [
        max(abs(decisions[index]["weights"][asset] - decisions[index - 1]["weights"][asset]) for asset in ASSET_IDS)
        for index in range(1, len(decisions))
    ]
    payload = {
        "experiment": "five-sector-behavioral-bandit",
        "data_source": "Yahoo Finance adjusted daily prices",
        "start_date": output_points[0]["date"],
        "market_date": output_points[-1]["date"],
        "starting_value": STARTING_VALUE,
        "assets": ASSETS,
        "strategy": {
            "method": "continuous contextual allocation learner with full-information updates",
            "lookback": "two years",
            "rebalance_frequency": "weekly",
            "minimum_weight": MIN_WEIGHT * 100,
            "ridge": RIDGE,
            "prediction_scale_percent": PREDICTION_SCALE * 100,
            "uncertainty_shrinkage": UNCERTAINTY_SHRINKAGE,
            "turnover_penalty": TURNOVER_PENALTY,
            "turnover_cost_percent": TRADING_COST * 100,
            "features": ["intercept", "4-week relative momentum", "13-week relative momentum", "13-week relative volatility", "13-week relative drawdown"],
            "behavioral_focus_percent": BEHAVIORAL_FOCUS * 100,
        },
        "summary": {
            "bandit": {"label": "Contextual allocator", "final_value": final["bandit"], "return_percent": round(final["bandit"] / 10 - 100, 2)},
            "panic": {"label": "Panic seller", "final_value": final["panic"], "return_percent": round(final["panic"] / 10 - 100, 2)},
            "fomo": {"label": "Performance chaser", "final_value": final["fomo"], "return_percent": round(final["fomo"] / 10 - 100, 2)},
            "dip": {"label": "Dip buyer", "final_value": final["dip"], "return_percent": round(final["dip"] / 10 - 100, 2)},
        },
        "average_weights": {
            asset: round(sum(item["weights"][asset] for item in decisions) / len(decisions), 1)
            for asset in ASSET_IDS
        },
        "maximum_weekly_move": round(max(moves), 1),
        "total_turnover": round(sum(item["turnover"] for item in decisions), 1),
        "total_cost": round(sum(item["cost"] for item in decisions), 2),
        **{f"{strategy}_switches": behavior_switches[strategy] for strategy in behavior_functions},
        **{f"{strategy}_total_cost": round(behavior_costs[strategy], 2) for strategy in behavior_functions},
        "points": output_points,
        "decisions": decisions,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} from {payload['start_date']} through {payload['market_date']}")
    print(json.dumps(payload["summary"], indent=2))
    print("Switches:", {strategy: behavior_switches[strategy] for strategy in behavior_functions})


if __name__ == "__main__":
    main()
