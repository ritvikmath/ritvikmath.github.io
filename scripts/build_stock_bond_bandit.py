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
QUARTERLY_CONTRIBUTION = 1000.0
STARTING_AGE = 22.0
ALPHA = 0.075
RIDGE = 1.0
SWITCH_COST = 0.001
ALLOCATION_TEMPERATURE = 0.08
MINIMUM_ALLOCATION = 0.10
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


def allocation_from_scores(scores):
    ordered = np.array([scores["SPY"], scores["AGG"]], dtype=float)
    preferences = np.exp((ordered - ordered.max()) / ALLOCATION_TEMPERATURE)
    stock_probability = float(preferences[0] / preferences.sum())
    stock_weight = MINIMUM_ALLOCATION + (1 - 2 * MINIMUM_ALLOCATION) * stock_probability
    return {"SPY": stock_weight, "AGG": 1 - stock_weight}


def add_inflation_view(points, cpi, strategy_keys):
    """Express every nominal point in dollars from the first backtest month."""
    dates = pd.DatetimeIndex(point["date"] for point in points)
    observed_cpi = cpi.reindex(dates, method="ffill")
    if observed_cpi.isna().any():
        raise ValueError("CPI does not cover every backtest point")

    base_cpi = float(observed_cpi.iloc[0])
    real_contributed = 0.0
    previous_nominal_contributed = 0.0
    for point, cpi_value in zip(points, observed_cpi):
        cpi_value = float(cpi_value)
        factor = base_cpi / cpi_value
        new_contribution = point["contributed"] - previous_nominal_contributed
        real_contributed += new_contribution * factor
        point["cpi"] = round(cpi_value, 3)
        point["inflation_factor"] = round(factor, 6)
        point["real_contributed"] = round(real_contributed, 2)
        for key in strategy_keys:
            point[f"{key}_real"] = round(point[key] * factor, 2)
        previous_nominal_contributed = point["contributed"]

    end_cpi = float(observed_cpi.iloc[-1])
    return {
        "series": "CPIAUCSL",
        "name": "Consumer Price Index for All Urban Consumers: All Items",
        "source": "U.S. Bureau of Labor Statistics via FRED",
        "frequency": "monthly",
        "seasonally_adjusted": True,
        "base_date": points[0]["date"],
        "base_cpi": round(base_cpi, 3),
        "end_date": points[-1]["date"],
        "end_cpi": round(end_cpi, 3),
        "cumulative_inflation_percent": round((end_cpi / base_cpi - 1) * 100, 2),
        "end_dollar_in_base_dollars": round(base_cpi / end_cpi, 4),
        "real_total_contributed": round(real_contributed, 2),
    }


def run_backtest(closes, cpi):
    context = build_context(closes)
    dates = [date for date in quarter_decision_dates(closes.index) if not context.loc[date].isna().any()]
    if len(dates) < 60:
        raise ValueError("Not enough complete quarters for the contextual bandit")

    dimension = len(FEATURES) + 1
    matrices = {symbol: np.eye(dimension) * RIDGE for symbol in SYMBOLS}
    rewards = {symbol: np.zeros(dimension) for symbol in SYMBOLS}
    allocation_matrices = {symbol: np.eye(dimension) * RIDGE for symbol in SYMBOLS}
    allocation_rewards = {symbol: np.zeros(dimension) for symbol in SYMBOLS}
    values = {"bandit": STARTING_VALUE, "allocation": STARTING_VALUE, "spy": STARTING_VALUE, "agg": STARTING_VALUE, "balanced": STARTING_VALUE}
    period_returns = {key: [] for key in values}
    contributions = STARTING_VALUE
    first_entry_position = closes.index.get_loc(dates[0]) + 1
    first_entry = closes.index[first_entry_position]
    points = [{"date": first_entry.date().isoformat(), "age": STARTING_AGE, "contributed": contributions, **{key: round(value, 2) for key, value in values.items()}}]
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
            for symbol in SYMBOLS:
                allocation_matrices[symbol] += np.outer(pending["x"], pending["x"])
                allocation_rewards[symbol] += float(np.clip(asset_returns[symbol], -0.25, 0.25)) * pending["x"]
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
                "spy_return": round(asset_returns["SPY"] * 100, 2),
                "agg_return": round(asset_returns["AGG"] * 100, 2),
                "best_action": best_action,
                "correct_choice": pending["action"] == best_action,
                "scores": pending["scores"],
                "estimates": pending["estimates"],
                "bonuses": pending["bonuses"],
                "context": pending["context"],
            })
            contributions += QUARTERLY_CONTRIBUTION
            for key in values:
                values[key] += QUARTERLY_CONTRIBUTION
            age = STARTING_AGE + (decision_date - first_entry).days / 365.25
            points.append({"date": decision_date.date().isoformat(), "age": round(age, 2), "contributed": contributions, **{key: round(value, 2) for key, value in values.items()}})

        if decision_date == dates[-1]:
            break

        x = feature_vector(context.loc[decision_date])
        scores = {}
        estimates = {}
        bonuses = {}
        allocation_scores = {}
        for symbol in SYMBOLS:
            inverse = np.linalg.inv(matrices[symbol])
            theta = inverse @ rewards[symbol]
            estimate = float(theta @ x)
            bonus = float(ALPHA * np.sqrt(x @ inverse @ x))
            estimates[symbol] = estimate
            bonuses[symbol] = bonus
            scores[symbol] = estimate + bonus
            allocation_inverse = np.linalg.inv(allocation_matrices[symbol])
            allocation_theta = allocation_inverse @ allocation_rewards[symbol]
            allocation_scores[symbol] = float(allocation_theta @ x + ALPHA * np.sqrt(x @ allocation_inverse @ x))

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
        allocation = allocation_from_scores(allocation_scores)
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
            "allocation_scores": {symbol: round(allocation_scores[symbol], 5) for symbol in SYMBOLS},
            "allocation_turnover": allocation_turnover,
            "allocation_cost": allocation_cost,
        }
        previous_action = action
        previous_stock_weight = allocation["SPY"]

    start_date, end_date = first_entry, dates[-1]
    summary = {key: metrics(points, key, period_returns[key], contributions) for key in values}
    inflation = add_inflation_view(points, cpi, values.keys())
    for key in values:
        summary[key]["real_terminal_value"] = points[-1][f"{key}_real"]
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
        "quarterly_contribution": QUARTERLY_CONTRIBUTION,
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
            "allocation_temperature": ALLOCATION_TEMPERATURE,
            "minimum_asset_weight_percent": MINIMUM_ALLOCATION * 100,
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
