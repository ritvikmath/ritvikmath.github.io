#!/usr/bin/env python3
"""Build the frozen SPY-versus-AGG quarterly contextual-bandit experiment."""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "stock-bond-bandit.json"
CPI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL"
SYMBOLS = ("SPY", "AGG")
SNAPSHOT_START = "2003-09-22"
SNAPSHOT_END_EXCLUSIVE = "2026-08-23"
STARTING_VALUE = 1000.0
BASE_QUARTERLY_CONTRIBUTION = 1000.0
STARTING_AGE = 22.0
ALPHA = 0.075
RIDGE = 1.0
SWITCH_COST = 0.001
ALLOCATION_ANCHOR = 0.60
ALLOCATION_MAX_TILT = 0.30
ALLOCATION_SIGNAL_SCALE = 0.05
ALLOCATION_SMOOTHING = 0.50
ALLOCATION_NO_TRADE_BAND = 0.03
ALLOCATION_MINIMUM = 0.15
ALLOCATION_MAXIMUM = 0.90
STOCK_VOLATILITY_GUARDRAIL = 0.20
FEATURES = (
    ("relative_momentum_3m", "3-month relative momentum", "Which asset has led over roughly one quarter."),
    ("relative_momentum_12m", "12-month relative momentum", "Whether stock leadership persists over a fuller market cycle."),
    ("relative_volatility_3m", "3-month volatility gap", "How much rougher stocks have been than bonds lately."),
    ("stock_drawdown_12m", "Stock drawdown", "How far SPY sits below its trailing one-year high."),
    ("stock_bond_correlation_6m", "6-month correlation", "Whether the two assets have recently moved together or offset one another."),
    ("relative_trend_10m", "Relative long-trend distance", "Which asset sits more strongly above or below its 200-day trend."),
)


def fetch_prices():
    last_error = None
    for attempt in range(3):
        try:
            raw = yf.download(
                list(SYMBOLS),
                start=SNAPSHOT_START,
                end=SNAPSHOT_END_EXCLUSIVE,
                interval="1d",
                auto_adjust=True,
                actions=False,
                progress=False,
                threads=False,
            )
            closes = raw["Close"].loc[:, list(SYMBOLS)].dropna()
            if len(closes) < 1000:
                raise ValueError("The shared SPY/AGG history is unexpectedly short")
            return closes
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to download the frozen SPY/AGG snapshot: {last_error}")


def fetch_cpi():
    """Fetch monthly seasonally adjusted CPI-U from FRED for purchasing-power comparisons."""
    last_error = None
    for attempt in range(3):
        try:
            frame = pd.read_csv(CPI_URL, parse_dates=["observation_date"])
            series = frame.set_index("observation_date")["CPIAUCSL"].replace(".", np.nan).astype(float).dropna()
            if series.index.max() < pd.Timestamp("2026-07-01"):
                raise ValueError("The CPI snapshot does not cover the backtest end")
            return series.sort_index()
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to download the frozen CPI snapshot: {last_error}")


def clipped(series, lower, upper, scale):
    return series.clip(lower, upper) / scale


def build_context(closes):
    returns = closes.pct_change()
    stock_trend = closes["SPY"] / closes["SPY"].rolling(200).mean() - 1
    bond_trend = closes["AGG"] / closes["AGG"].rolling(200).mean() - 1
    context = pd.DataFrame(index=closes.index)
    context["relative_momentum_3m"] = clipped(
        closes["SPY"].pct_change(63) - closes["AGG"].pct_change(63), -0.50, 0.50, 0.25
    )
    context["relative_momentum_12m"] = clipped(
        closes["SPY"].pct_change(252) - closes["AGG"].pct_change(252), -1.0, 1.0, 0.50
    )
    context["relative_volatility_3m"] = clipped(
        returns["SPY"].rolling(63).std() * np.sqrt(252)
        - returns["AGG"].rolling(63).std() * np.sqrt(252),
        -0.50,
        0.50,
        0.25,
    )
    context["stock_drawdown_12m"] = clipped(
        closes["SPY"] / closes["SPY"].rolling(252).max() - 1, -0.60, 0.0, 0.30
    )
    context["stock_bond_correlation_6m"] = returns["SPY"].rolling(126).corr(returns["AGG"]).clip(-1, 1)
    context["relative_trend_10m"] = clipped(stock_trend - bond_trend, -0.50, 0.50, 0.25)
    context["stock_volatility_3m"] = returns["SPY"].rolling(63).std() * np.sqrt(252)
    return context


def quarter_decision_dates(index):
    dates = pd.Series(index=index, data=index)
    return list(dates.groupby(index.to_period("Q")).min())


def feature_vector(row):
    return np.array([1.0, *[float(row[name]) for name, _, _ in FEATURES]], dtype=float)


def drawdown(values):
    array = np.asarray(values, dtype=float)
    peaks = np.maximum.accumulate(array)
    return float(np.min(array / peaks - 1))


def metrics(points, key, period_returns, contributions):
    values = [point[key] for point in points]
    terminal = values[-1]
    returns = np.asarray(period_returns, dtype=float)
    unit_values = np.cumprod(np.r_[1.0, 1.0 + returns])
    return {
        "terminal_value": round(terminal, 2),
        "contributed": round(contributions, 2),
        "investment_gain": round(terminal - contributions, 2),
        "annualized_return": round((float(np.prod(1 + returns)) ** (4 / len(returns)) - 1) * 100, 2),
        "annualized_volatility": round(float(returns.std(ddof=1) * np.sqrt(4) * 100), 2),
        "max_drawdown": round(drawdown(unit_values) * 100, 2),
        "worst_quarter": round(float(returns.min() * 100), 2),
    }


def risk_aware_allocation(predicted_excess_return, uncertainty, stock_volatility, previous_stock_weight):
    """Turn a noisy SPY-minus-AGG forecast into a conservative portfolio tilt."""
    confidence = 1.0 / (1.0 + 2.0 * uncertainty)
    directional_tilt = ALLOCATION_MAX_TILT * np.tanh(predicted_excess_return / ALLOCATION_SIGNAL_SCALE)
    target = ALLOCATION_ANCHOR + confidence * directional_tilt

    if stock_volatility > STOCK_VOLATILITY_GUARDRAIL:
        target *= STOCK_VOLATILITY_GUARDRAIL / stock_volatility
    target = float(np.clip(target, ALLOCATION_MINIMUM, ALLOCATION_MAXIMUM))

    if previous_stock_weight is None:
        stock_weight = target
    else:
        stock_weight = previous_stock_weight + ALLOCATION_SMOOTHING * (target - previous_stock_weight)
        if abs(stock_weight - previous_stock_weight) < ALLOCATION_NO_TRADE_BAND:
            stock_weight = previous_stock_weight
    stock_weight = float(np.clip(stock_weight, ALLOCATION_MINIMUM, ALLOCATION_MAXIMUM))
    return {"SPY": stock_weight, "AGG": 1 - stock_weight}, target, confidence


def contribution_inflation_summary(cpi, start_date, end_date, final_contribution):
    """Describe how the quarterly contribution grows with the CPI price level."""
    base_cpi = float(cpi.asof(start_date))
    end_cpi = float(cpi.asof(end_date))
    return {
        "series": "CPIAUCSL",
        "name": "Consumer Price Index for All Urban Consumers: All Items",
        "source": "U.S. Bureau of Labor Statistics via FRED",
        "frequency": "monthly",
        "seasonally_adjusted": True,
        "base_date": start_date.date().isoformat(),
        "base_cpi": round(base_cpi, 3),
        "end_date": end_date.date().isoformat(),
        "end_cpi": round(end_cpi, 3),
        "cumulative_inflation_percent": round((end_cpi / base_cpi - 1) * 100, 2),
        "base_quarterly_contribution": BASE_QUARTERLY_CONTRIBUTION,
        "final_quarterly_contribution": round(final_contribution, 2),
        "contribution_policy": "The quarterly contribution starts at $1,000 and changes in proportion to CPI.",
    }


def run_backtest(closes, cpi):
    context = build_context(closes)
    dates = [date for date in quarter_decision_dates(closes.index) if not context.loc[date].isna().any()]
    if len(dates) < 60:
        raise ValueError("Not enough complete quarters for the contextual bandit")

    dimension = len(FEATURES) + 1
    matrices = {symbol: np.eye(dimension) * RIDGE for symbol in SYMBOLS}
    rewards = {symbol: np.zeros(dimension) for symbol in SYMBOLS}
    allocation_matrix = np.eye(dimension) * RIDGE
    allocation_reward = np.zeros(dimension)
    values = {"bandit": STARTING_VALUE, "allocation": STARTING_VALUE, "spy": STARTING_VALUE, "agg": STARTING_VALUE, "balanced": STARTING_VALUE}
    period_returns = {key: [] for key in values}
    contributions = STARTING_VALUE
    first_entry_position = closes.index.get_loc(dates[0]) + 1
    first_entry = closes.index[first_entry_position]
    base_cpi = float(cpi.asof(first_entry))
    points = [{"date": first_entry.date().isoformat(), "age": STARTING_AGE, "quarterly_contribution": STARTING_VALUE, "contributed": contributions, **{key: round(value, 2) for key, value in values.items()}}]
    decisions = []
    pending = None
    previous_action = None
    previous_stock_weight = None

    for decision_date in dates:
        if pending is not None:
            asset_returns = {
                symbol: float(closes.loc[decision_date, symbol] / closes.loc[pending["execution_date"], symbol] - 1)
                for symbol in SYMBOLS
            }
            gross_return = asset_returns[pending["action"]]
            values["bandit"] *= 1 + gross_return
            allocation_return = sum(pending["allocation"][symbol] * asset_returns[symbol] for symbol in SYMBOLS)
            values["allocation"] *= 1 + allocation_return
            values["spy"] *= 1 + asset_returns["SPY"]
            values["agg"] *= 1 + asset_returns["AGG"]
            balanced_return = 0.60 * asset_returns["SPY"] + 0.40 * asset_returns["AGG"]
            values["balanced"] *= 1 + balanced_return
            all_in_net_return = (1 - (SWITCH_COST if pending["switched"] else 0.0)) * (1 + gross_return) - 1
            allocation_net_return = (1 - pending["allocation_cost"]) * (1 + allocation_return) - 1
            period_returns["bandit"].append(all_in_net_return)
            period_returns["allocation"].append(allocation_net_return)
            period_returns["spy"].append(asset_returns["SPY"])
            period_returns["agg"].append(asset_returns["AGG"])
            period_returns["balanced"].append(balanced_return)
            observed_reward = float(np.clip(gross_return, -0.25, 0.25))
            matrices[pending["action"]] += np.outer(pending["x"], pending["x"])
            rewards[pending["action"]] += observed_reward * pending["x"]
            observed_excess_return = float(np.clip(asset_returns["SPY"] - asset_returns["AGG"], -0.35, 0.35))
            allocation_matrix += np.outer(pending["x"], pending["x"])
            allocation_reward += observed_excess_return * pending["x"]
            best_action = max(SYMBOLS, key=asset_returns.get)
            decisions.append({
                "start": pending["decision_date"].date().isoformat(),
                "execution": pending["execution_date"].date().isoformat(),
                "end": decision_date.date().isoformat(),
                "age": round(STARTING_AGE + (pending["decision_date"] - first_entry).days / 365.25, 2),
                "action": pending["action"],
                "reason": pending["reason"],
                "switched": pending["switched"],
                "return": round(gross_return * 100, 2),
                "net_return": round(all_in_net_return * 100, 2),
                "allocation": {symbol: round(pending["allocation"][symbol] * 100, 2) for symbol in SYMBOLS},
                "allocation_return": round(allocation_net_return * 100, 2),
                "allocation_turnover": round(pending["allocation_turnover"] * 100, 2),
                "allocation_target": round(pending["allocation_target"] * 100, 2),
                "allocation_confidence": round(pending["allocation_confidence"] * 100, 2),
                "predicted_excess_return": round(pending["predicted_excess_return"] * 100, 2),
                "spy_return": round(asset_returns["SPY"] * 100, 2),
                "agg_return": round(asset_returns["AGG"] * 100, 2),
                "best_action": best_action,
                "correct_choice": pending["action"] == best_action,
                "scores": pending["scores"],
                "estimates": pending["estimates"],
                "bonuses": pending["bonuses"],
                "context": pending["context"],
            })
            quarterly_contribution = BASE_QUARTERLY_CONTRIBUTION * float(cpi.asof(decision_date)) / base_cpi
            contributions += quarterly_contribution
            for key in values:
                values[key] += quarterly_contribution
            age = STARTING_AGE + (decision_date - first_entry).days / 365.25
            points.append({"date": decision_date.date().isoformat(), "age": round(age, 2), "quarterly_contribution": round(quarterly_contribution, 2), "contributed": round(contributions, 2), **{key: round(value, 2) for key, value in values.items()}})

        if decision_date == dates[-1]:
            break

        x = feature_vector(context.loc[decision_date])
        scores = {}
        estimates = {}
        bonuses = {}
        for symbol in SYMBOLS:
            inverse = np.linalg.inv(matrices[symbol])
            theta = inverse @ rewards[symbol]
            estimate = float(theta @ x)
            bonus = float(ALPHA * np.sqrt(x @ inverse @ x))
            estimates[symbol] = estimate
            bonuses[symbol] = bonus
            scores[symbol] = estimate + bonus

        choice_number = len(decisions)
        if choice_number < 2:
            action = SYMBOLS[choice_number]
            reason = "warm-up"
        else:
            action = max(SYMBOLS, key=lambda symbol: (scores[symbol], symbol == "AGG"))
            reason = "LinUCB"

        switched = previous_action is not None and action != previous_action
        if switched:
            values["bandit"] *= 1 - SWITCH_COST
        allocation_inverse = np.linalg.inv(allocation_matrix)
        allocation_theta = allocation_inverse @ allocation_reward
        predicted_excess_return = float(allocation_theta @ x)
        allocation_uncertainty = float(np.sqrt(x @ allocation_inverse @ x))
        allocation, allocation_target, allocation_confidence = risk_aware_allocation(
            predicted_excess_return,
            allocation_uncertainty,
            float(context.loc[decision_date, "stock_volatility_3m"]),
            previous_stock_weight,
        )
        allocation_turnover = 0.0 if previous_stock_weight is None else abs(allocation["SPY"] - previous_stock_weight)
        allocation_cost = SWITCH_COST * allocation_turnover
        values["allocation"] *= 1 - allocation_cost
        execution_position = closes.index.get_loc(decision_date) + 1
        execution_date = closes.index[execution_position]
        pending = {
            "decision_date": decision_date,
            "execution_date": execution_date,
            "action": action,
            "reason": reason,
            "switched": switched,
            "x": x,
            "scores": {symbol: round(scores[symbol], 5) for symbol in SYMBOLS},
            "estimates": {symbol: round(estimates[symbol], 5) for symbol in SYMBOLS},
            "bonuses": {symbol: round(bonuses[symbol], 5) for symbol in SYMBOLS},
            "context": {name: round(float(context.loc[decision_date, name]), 4) for name, _, _ in FEATURES},
            "allocation": allocation,
            "allocation_target": allocation_target,
            "allocation_confidence": allocation_confidence,
            "predicted_excess_return": predicted_excess_return,
            "allocation_uncertainty": allocation_uncertainty,
            "allocation_turnover": allocation_turnover,
            "allocation_cost": allocation_cost,
        }
        previous_action = action
        previous_stock_weight = allocation["SPY"]

    start_date, end_date = first_entry, dates[-1]
    summary = {key: metrics(points, key, period_returns[key], contributions) for key in values}
    inflation = contribution_inflation_summary(cpi, start_date, end_date, points[-1]["quarterly_contribution"])
    choices = {symbol: sum(decision["action"] == symbol for decision in decisions) for symbol in SYMBOLS}
    stock_weights = [decision["allocation"]["SPY"] for decision in decisions]
    return {
        "experiment": "stock-bond-contextual-bandit",
        "frozen_snapshot": True,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "data_start": closes.index.min().date().isoformat(),
        "backtest_start": start_date.date().isoformat(),
        "backtest_end": end_date.date().isoformat(),
        "starting_value": STARTING_VALUE,
        "base_quarterly_contribution": BASE_QUARTERLY_CONTRIBUTION,
        "final_quarterly_contribution": points[-1]["quarterly_contribution"],
        "total_contributed": contributions,
        "starting_age": STARTING_AGE,
        "ending_age": round(STARTING_AGE + (end_date - start_date).days / 365.25, 2),
        "assets": [
            {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "role": "U.S. stocks"},
            {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF", "role": "U.S. investment-grade bonds"},
        ],
        "method": {
            "algorithm": "disjoint LinUCB",
            "decision_frequency": "calendar quarter",
            "execution_lag": "one trading session after each decision",
            "alpha": ALPHA,
            "ridge": RIDGE,
            "switch_cost_percent": SWITCH_COST * 100,
            "reward_clip": [-25, 25],
            "warm_up_quarters": 2,
            "allocation_model": "shared online ridge model of SPY minus AGG quarterly return",
            "allocation_anchor_percent": ALLOCATION_ANCHOR * 100,
            "allocation_maximum_tilt_percent": ALLOCATION_MAX_TILT * 100,
            "allocation_smoothing": ALLOCATION_SMOOTHING,
            "allocation_no_trade_band_percent": ALLOCATION_NO_TRADE_BAND * 100,
            "minimum_stock_weight_percent": ALLOCATION_MINIMUM * 100,
            "maximum_stock_weight_percent": ALLOCATION_MAXIMUM * 100,
            "stock_volatility_guardrail_percent": STOCK_VOLATILITY_GUARDRAIL * 100,
            "feature_count": len(FEATURES),
            "feature_scaling": "fixed before the backtest; no future-fitted scaler",
            "hyperparameter_tuning": "none",
        },
        "features": [{"id": name, "name": label, "description": description} for name, label, description in FEATURES],
        "points": points,
        "decisions": decisions,
        "summary": summary,
        "choice_summary": {
            **choices,
            "switches": sum(decision["switched"] for decision in decisions),
            "quarters": len(decisions),
            "better_asset_hit_rate": round(sum(decision["correct_choice"] for decision in decisions) / len(decisions) * 100, 2),
            "average_stock_allocation": round(float(np.mean(stock_weights)), 2),
            "minimum_stock_allocation": round(float(np.min(stock_weights)), 2),
            "maximum_stock_allocation": round(float(np.max(stock_weights)), 2),
            "allocation_turnover": round(sum(decision["allocation_turnover"] for decision in decisions), 2),
        },
        "inflation": inflation,
    }


def main():
    payload = run_backtest(fetch_prices(), fetch_cpi())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(
        f"Saved {payload['choice_summary']['quarters']} frozen quarterly decisions "
        f"from {payload['backtest_start']} through {payload['backtest_end']} to {OUTPUT}"
    )


if __name__ == "__main__":
    main()
