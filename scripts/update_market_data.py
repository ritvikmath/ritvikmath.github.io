#!/usr/bin/env python3
"""Refresh static data used by the Stock Trading experiment."""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "sp500-3m.json"
STARTING_INVESTMENT = 1000.0
ASSETS = (
    {"id": "sp500", "symbol": "SPY", "name": "S&P 500", "detail": "SPY ETF"},
    {"id": "google", "symbol": "GOOGL", "name": "Google", "detail": "Alphabet Class A"},
)


def fetch_prices():
    """Download aligned adjusted closes for every asset in the experiment."""
    last_error = None
    symbols = [asset["symbol"] for asset in ASSETS]
    for attempt in range(3):
        try:
            history = yf.download(
                symbols,
                period="3mo",
                interval="1d",
                auto_adjust=True,
                actions=False,
                progress=False,
                threads=False,
            )
            closes = history["Close"][symbols].dropna()
            if len(closes) < 40:
                raise ValueError(f"Expected at least 40 shared observations, received {len(closes)}")
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


def build_payload(dates, closes):
    series = []
    shares = {}
    for asset in ASSETS:
        symbol = asset["symbol"]
        starting_price = float(closes.iloc[0][symbol])
        latest_price = float(closes.iloc[-1][symbol])
        owned_shares = STARTING_INVESTMENT / starting_price
        latest_value = owned_shares * latest_price
        shares[asset["id"]] = owned_shares
        series.append({
            **asset,
            "starting_price": round(starting_price, 2),
            "shares": round(owned_shares, 6),
            "latest_price": round(latest_price, 2),
            "latest_value": round(latest_value, 2),
            "return_percent": round(((latest_value / STARTING_INVESTMENT) - 1) * 100, 2),
        })

    points = []
    for row_index, date in enumerate(dates):
        point = {"date": date}
        for asset in ASSETS:
            asset_id = asset["id"]
            price = float(closes.iloc[row_index][asset["symbol"]])
            point[asset_id] = round(shares[asset_id] * price, 2)
        points.append(point)

    leader = max(series, key=lambda item: item["latest_value"])
    return {
        "experiment": "sp500-vs-google",
        "currency": "USD",
        "range": "90 days",
        "starting_investment": STARTING_INVESTMENT,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "market_date": dates[-1],
        "start_date": dates[0],
        "leader": leader["id"],
        "series": series,
        "points": points,
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
    print(f"Saved {len(payload['points'])} shared observations through {payload['market_date']} to {OUTPUT}")


if __name__ == "__main__":
    main()
