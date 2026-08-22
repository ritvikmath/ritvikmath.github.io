#!/usr/bin/env python3
"""Train and evaluate the live four-class XGBoost stock-direction experiment."""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.inspection import permutation_importance
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from update_market_data import ASSETS


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "stock-direction-xgb.json"
CLASS_NAMES = ("Very negative", "Negative", "Positive", "Very positive")
FEATURE_LABELS = {
    "return_1d": "1-day return",
    "return_5d": "1-week return",
    "return_21d": "1-month return",
    "return_63d": "3-month return",
    "volatility_21d": "21-day volatility",
    "drawdown_21d": "21-day drawdown",
    "atr_14_pct": "ATR (14 days)",
    "rsi_14": "RSI (14 days)",
    "macd_gap": "MACD gap",
    "price_vs_sma20": "Price vs. 20-day average",
    "price_vs_sma50": "Price vs. 50-day average",
    "volume_vs_20d": "Volume vs. 20-day average",
    "market_return_5d": "S&P 500 1-week return",
    "relative_strength_21d": "1-month relative strength",
}
FEATURES = tuple(FEATURE_LABELS)


def fetch_history():
    """Fetch six years of adjusted OHLCV history plus the S&P 500 proxy."""
    symbols = [asset["symbol"] for asset in ASSETS] + ["SPY"]
    last_error = None
    for attempt in range(3):
        try:
            history = yf.download(
                symbols,
                period="6y",
                interval="1d",
                auto_adjust=True,
                actions=False,
                progress=False,
                threads=False,
                group_by="column",
            )
            if not isinstance(history.columns, pd.MultiIndex):
                raise ValueError("Expected multi-symbol market history")
            closes = history["Close"][symbols].dropna(how="all")
            if len(closes) < 1200:
                raise ValueError(f"Expected at least 1,200 observations, received {len(closes)}")
            return history
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to refresh prediction data: {last_error}")


def rsi(close, period=14):
    change = close.diff()
    gain = change.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-change.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    strength = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + strength))


def make_stock_frame(history, asset, spy_close):
    symbol = asset["symbol"]
    stock = history.xs(symbol, axis=1, level=1).copy()
    close = stock["Close"]
    high = stock["High"]
    low = stock["Low"]
    volume = stock["Volume"]
    daily_return = close.pct_change()
    previous_close = close.shift(1)
    true_range = pd.concat(
        [(high - low), (high - previous_close).abs(), (low - previous_close).abs()], axis=1
    ).max(axis=1)
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()

    frame = pd.DataFrame(index=stock.index)
    frame["return_1d"] = daily_return
    frame["return_5d"] = close.pct_change(5)
    frame["return_21d"] = close.pct_change(21)
    frame["return_63d"] = close.pct_change(63)
    frame["volatility_21d"] = daily_return.rolling(21).std()
    frame["drawdown_21d"] = close / close.rolling(21).max() - 1
    frame["atr_14_pct"] = true_range.rolling(14).mean() / close
    frame["rsi_14"] = rsi(close) / 100
    frame["macd_gap"] = (ema_12 - ema_26) / close
    frame["price_vs_sma20"] = close / close.rolling(20).mean() - 1
    frame["price_vs_sma50"] = close / close.rolling(50).mean() - 1
    frame["volume_vs_20d"] = volume / volume.rolling(20).mean() - 1
    frame["market_return_5d"] = spy_close.reindex(frame.index).pct_change(5)
    frame["relative_strength_21d"] = frame["return_21d"] - spy_close.reindex(frame.index).pct_change(21)
    frame["next_return"] = close.shift(-1) / close - 1
    frame["stock_id"] = asset["id"]
    frame["symbol"] = symbol
    return frame.replace([np.inf, -np.inf], np.nan)


def classify_returns(values):
    return np.select(
        [values < -0.01, values < 0, values < 0.01],
        [0, 1, 2],
        default=3,
    ).astype(int)


def design_matrix(frame):
    numerical = frame.loc[:, FEATURES].astype(float)
    stock_flags = pd.get_dummies(frame["stock_id"], prefix="stock", dtype=float)
    expected = [f"stock_{asset['id']}" for asset in ASSETS]
    return pd.concat([numerical, stock_flags.reindex(columns=expected, fill_value=0)], axis=1)


def rounded_percent(value):
    return round(float(value) * 100, 2)


def make_model():
    return XGBClassifier(
        objective="multi:softprob",
        num_class=4,
        n_estimators=260,
        max_depth=3,
        learning_rate=0.04,
        min_child_weight=5,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=2.0,
        reg_alpha=0.1,
        tree_method="hist",
        n_jobs=2,
        random_state=42,
        eval_metric="mlogloss",
    )


def train_experiment(history):
    spy_close = history.xs("SPY", axis=1, level=1)["Close"]
    all_frames = [make_stock_frame(history, asset, spy_close) for asset in ASSETS]
    latest_rows = pd.concat([frame.dropna(subset=FEATURES).tail(1) for frame in all_frames])
    labeled = pd.concat(all_frames).dropna(subset=[*FEATURES, "next_return"]).sort_index()
    labeled["target"] = classify_returns(labeled["next_return"].to_numpy())

    dates = sorted(labeled.index.unique())
    split_index = int(len(dates) * 0.8)
    split_date = dates[split_index]
    train = labeled[labeled.index < split_date]
    test = labeled[labeled.index >= split_date]
    x_train = design_matrix(train)
    x_test = design_matrix(test)
    y_train = train["target"].to_numpy()
    y_test = test["target"].to_numpy()

    model = make_model()
    weights = compute_sample_weight(class_weight="balanced", y=y_train)
    model.fit(x_train, y_train, sample_weight=weights)
    predictions = model.predict(x_test).astype(int)
    probabilities = model.predict_proba(x_test)

    majority_class = int(pd.Series(y_train).value_counts().idxmax())
    majority_predictions = np.full_like(y_test, majority_class)
    direction_actual = y_test >= 2
    direction_predicted = predictions >= 2
    matrix = confusion_matrix(y_test, predictions, labels=range(4))
    matrix_percent = matrix / np.maximum(matrix.sum(axis=1, keepdims=True), 1) * 100

    test_results = test.loc[:, ["stock_id", "symbol", "next_return"]].copy()
    test_results["actual"] = y_test
    test_results["predicted"] = predictions
    test_results["correct"] = predictions == y_test
    test_results["direction_correct"] = direction_predicted == direction_actual

    per_stock = []
    for asset in ASSETS:
        subset = test_results[test_results["stock_id"] == asset["id"]]
        per_stock.append({
            "id": asset["id"],
            "symbol": asset["symbol"],
            "name": asset["name"],
            "accuracy": rounded_percent(subset["correct"].mean()),
            "direction_accuracy": rounded_percent(subset["direction_correct"].mean()),
            "samples": int(len(subset)),
        })

    daily = test_results.groupby(test_results.index).agg(
        accuracy=("correct", "mean"), direction_accuracy=("direction_correct", "mean")
    ).sort_index()
    rolling = daily.rolling(60, min_periods=20).mean().dropna()
    accuracy_history = [{
        "date": index.date().isoformat(),
        "accuracy": rounded_percent(row["accuracy"]),
        "direction_accuracy": rounded_percent(row["direction_accuracy"]),
    } for index, row in rolling.iterrows()]

    importance = permutation_importance(
        model,
        x_test,
        y_test,
        scoring="balanced_accuracy",
        n_repeats=3,
        random_state=42,
        n_jobs=1,
    )
    feature_importance = sorted(
        [{
            "id": feature,
            "label": FEATURE_LABELS[feature],
            "importance": round(max(0.0, float(importance.importances_mean[x_test.columns.get_loc(feature)])) * 100, 3),
        } for feature in FEATURES],
        key=lambda item: item["importance"],
        reverse=True,
    )

    live_model = make_model()
    all_x = design_matrix(labeled)
    all_y = labeled["target"].to_numpy()
    live_weights = compute_sample_weight(class_weight="balanced", y=all_y)
    live_model.fit(all_x, all_y, sample_weight=live_weights)
    latest_x = design_matrix(latest_rows)
    latest_probabilities = live_model.predict_proba(latest_x)
    latest_predictions = live_model.predict(latest_x).astype(int)
    current_predictions = []
    for row_index, (_, row) in enumerate(latest_rows.iterrows()):
        class_id = int(latest_predictions[row_index])
        current_predictions.append({
            "id": row["stock_id"],
            "symbol": row["symbol"],
            "name": next(asset["name"] for asset in ASSETS if asset["id"] == row["stock_id"]),
            "class_id": class_id,
            "prediction": CLASS_NAMES[class_id],
            "confidence": rounded_percent(latest_probabilities[row_index][class_id]),
            "probabilities": [rounded_percent(value) for value in latest_probabilities[row_index]],
        })

    class_counts = pd.Series(y_test).value_counts().reindex(range(4), fill_value=0)
    return {
        "experiment": "stock-direction-xgboost",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "market_date": latest_rows.index.max().date().isoformat(),
        "history_start": labeled.index.min().date().isoformat(),
        "test_start": split_date.date().isoformat(),
        "thresholds": {
            "very_negative": "return < -1%",
            "negative": "-1% ≤ return < 0%",
            "positive": "0% ≤ return < 1%",
            "very_positive": "return ≥ 1%",
        },
        "classes": [{"id": index, "name": name} for index, name in enumerate(CLASS_NAMES)],
        "features": [{"id": feature, "label": label} for feature, label in FEATURE_LABELS.items()],
        "model": {
            "name": "XGBoost multiclass classifier",
            "training_samples": int(len(train)),
            "test_samples": int(len(test)),
            "training_dates": int(train.index.nunique()),
            "test_dates": int(test.index.nunique()),
            "trees": 260,
            "max_depth": 3,
            "learning_rate": 0.04,
        },
        "metrics": {
            "accuracy": rounded_percent(accuracy_score(y_test, predictions)),
            "balanced_accuracy": rounded_percent(balanced_accuracy_score(y_test, predictions)),
            "macro_f1": rounded_percent(f1_score(y_test, predictions, average="macro")),
            "direction_accuracy": rounded_percent(accuracy_score(direction_actual, direction_predicted)),
            "majority_accuracy": rounded_percent(accuracy_score(y_test, majority_predictions)),
            "majority_balanced_accuracy": rounded_percent(balanced_accuracy_score(y_test, majority_predictions)),
        },
        "class_distribution": [int(value) for value in class_counts],
        "confusion_matrix": matrix.astype(int).tolist(),
        "confusion_matrix_percent": np.round(matrix_percent, 1).tolist(),
        "per_stock": per_stock,
        "accuracy_history": accuracy_history,
        "feature_importance": feature_importance,
        "current_predictions": current_predictions,
    }


def existing_market_date():
    if not OUTPUT.exists():
        return None
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8")).get("market_date")
    except (OSError, json.JSONDecodeError):
        return None


def main():
    history = fetch_history()
    payload = train_experiment(history)
    force_write = os.environ.get("FORCE_MARKET_DATA_WRITE", "").lower() in {"1", "true", "yes"}
    if existing_market_date() == payload["market_date"] and not force_write:
        print(f"No new prediction data; {payload['market_date']} is already published.")
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(
        f"Saved {payload['model']['test_samples']} held-out predictions through "
        f"{payload['market_date']} to {OUTPUT}"
    )


if __name__ == "__main__":
    main()
