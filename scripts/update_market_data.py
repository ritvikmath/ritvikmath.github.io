#!/usr/bin/env python3
"""Refresh static market data used by the Stock Trading experiment."""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "sp500-3m.json"


def fetch_sp500():
    last_error = None
    for attempt in range(3):
        try:
            history = yf.Ticker("^GSPC").history(
                period="3mo",
                interval="1d",
                auto_adjust=False,
                actions=False,
            )
            closes = history["Close"].dropna()
            if len(closes) < 40:
                raise ValueError(f"Expected at least 40 observations, received {len(closes)}")
            points = [
                {"date": index.date().isoformat(), "close": round(float(value), 2)}
                for index, value in closes.items()
            ]
            if any(points[index]["date"] >= points[index + 1]["date"] for index in range(len(points) - 1)):
                raise ValueError("Market dates are not strictly increasing")
            return points
        except Exception as error:  # Preserve the previous good file after all retries.
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to refresh S&P 500 data: {last_error}")


def main():
    points = fetch_sp500()
    first = points[0]["close"]
    latest = points[-1]["close"]
    payload = {
        "symbol": "^GSPC",
        "name": "S&P 500",
        "currency": "USD",
        "range": "3 months",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "market_date": points[-1]["date"],
        "summary": {
            "latest": latest,
            "change_percent": round(((latest / first) - 1) * 100, 2),
            "high": max(point["close"] for point in points),
            "low": min(point["close"] for point in points),
        },
        "points": points,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Saved {len(points)} observations through {payload['market_date']} to {OUTPUT}")


if __name__ == "__main__":
    main()
