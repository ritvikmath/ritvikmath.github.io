#!/usr/bin/env python3
"""Build a frozen constituent-level attribution of one large SPY trading day."""

import json
import math
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "market-attribution.json"
TARGET_DATE = date(2026, 9, 3)
HOLDINGS_URL = "https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{}"
USER_AGENT = "Mozilla/5.0 (compatible; ritvikmath research snapshot)"


def download(url, timeout=30):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def parse_xlsx_rows(payload):
    """Read the first worksheet with only the Python's standard library."""
    namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    ns = {"x": namespace}
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        strings_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = [
            "".join(node.text or "" for node in item.iter(f"{{{namespace}}}t"))
            for item in strings_root.findall("x:si", ns)
        ]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))

    rows = []
    for row in sheet.findall(".//x:row", ns):
        values = {}
        for cell in row.findall("x:c", ns):
            reference = cell.get("r", "")
            column = "".join(character for character in reference if character.isalpha())
            value_node = cell.find("x:v", ns)
            value = "" if value_node is None else value_node.text
            if cell.get("t") == "s" and value:
                value = strings[int(value)]
            values[column] = value
        rows.append(values)
    return rows


def load_holdings():
    rows = parse_xlsx_rows(download(HOLDINGS_URL))
    as_of_text = next(row.get("B", "") for row in rows if row.get("A") == "Holdings:")
    as_of = datetime.strptime(as_of_text.replace("As of ", ""), "%d-%b-%Y").date()
    if as_of != TARGET_DATE:
        raise ValueError(f"Expected holdings dated {TARGET_DATE}; State Street supplied {as_of}")

    holdings = []
    for row in rows:
        ticker = row.get("B", "").strip()
        try:
            weight = float(row.get("E", "")) / 100
        except ValueError:
            continue
        if not ticker or ticker in {"SPY", "Ticker"} or weight <= 0:
            continue
        holdings.append({"name": row.get("A", "").strip(), "ticker": ticker, "end_weight": weight})
    return as_of, holdings


def yahoo_ticker(ticker):
    return ticker.replace(".", "-")


def fetch_two_closes(ticker):
    start = int(datetime.combine(TARGET_DATE - timedelta(days=5), datetime.min.time(), tzinfo=timezone.utc).timestamp())
    end = int(datetime.combine(TARGET_DATE + timedelta(days=2), datetime.min.time(), tzinfo=timezone.utc).timestamp())
    params = urllib.parse.urlencode({"period1": start, "period2": end, "interval": "1d", "events": "history"})
    url = f"{YAHOO_CHART.format(urllib.parse.quote(yahoo_ticker(ticker)))}?{params}"
    last_error = None
    for attempt in range(3):
        try:
            payload = json.loads(download(url))
            result = payload["chart"]["result"][0]
            closes = result["indicators"]["quote"][0]["close"]
            observations = {
                datetime.fromtimestamp(timestamp, timezone.utc).date(): close
                for timestamp, close in zip(result["timestamp"], closes)
                if close is not None
            }
            prior_dates = [day for day in observations if day < TARGET_DATE]
            if TARGET_DATE not in observations or not prior_dates:
                raise ValueError("target or prior close missing")
            previous = max(prior_dates)
            return previous, float(observations[previous]), float(observations[TARGET_DATE])
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"{ticker}: {last_error}")


def build():
    holdings_date, holdings = load_holdings()
    prices = {}
    failures = []
    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(fetch_two_closes, item["ticker"]): item["ticker"] for item in holdings}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                prices[ticker] = future.result()
            except Exception as error:
                failures.append(str(error))

    included = [item for item in holdings if item["ticker"] in prices]
    covered_end_weight = sum(item["end_weight"] for item in included)
    if len(included) < 495 or covered_end_weight < 0.995:
        raise ValueError(f"Insufficient coverage: {len(included)} holdings, {covered_end_weight:.3%} weight; {failures[:5]}")

    raw_start_weights = {}
    records = []
    prior_date = None
    for item in included:
        previous, prior_close, close = prices[item["ticker"]]
        if prior_date is None:
            prior_date = previous
        elif previous != prior_date:
            raise ValueError(f"Mismatched prior trading date for {item['ticker']}: {previous}")
        stock_return = close / prior_close - 1
        raw_start_weights[item["ticker"]] = item["end_weight"] / (1 + stock_return)
        records.append({**item, "prior_close": prior_close, "close": close, "return": stock_return})

    raw_total = sum(raw_start_weights.values())
    for record in records:
        start_weight = raw_start_weights[record["ticker"]] / raw_total
        record["weight"] = start_weight
        record["contribution"] = start_weight * record["return"]

    records.sort(key=lambda item: item["contribution"], reverse=True)
    basket_return = sum(item["contribution"] for item in records)
    _, spy_prior, spy_close = fetch_two_closes("SPY")
    spy_return = spy_close / spy_prior - 1
    positive = [item for item in records if item["contribution"] > 0]
    negative = [item for item in records if item["contribution"] < 0]
    positive_total = sum(item["contribution"] for item in positive)
    negative_total = sum(item["contribution"] for item in negative)

    def clean(record):
        return {
            "name": record["name"].title(),
            "ticker": record["ticker"],
            "weight_pct": round(record["weight"] * 100, 4),
            "return_pct": round(record["return"] * 100, 4),
            "contribution_bps": round(record["contribution"] * 10000, 3),
        }

    payload = {
        "snapshot": {
            "prior_date": prior_date.isoformat(),
            "date": TARGET_DATE.isoformat(),
            "holdings_date": holdings_date.isoformat(),
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "spy_prior_close": round(spy_prior, 4),
            "spy_close": round(spy_close, 4),
            "spy_return_pct": round(spy_return * 100, 4),
            "basket_return_pct": round(basket_return * 100, 4),
            "residual_bps": round((spy_return - basket_return) * 10000, 3),
            "covered_holdings": len(records),
            "covered_end_weight_pct": round(covered_end_weight * 100, 4),
            "advancers": len(positive),
            "decliners": len(negative),
            "unchanged": len(records) - len(positive) - len(negative),
            "positive_bps": round(positive_total * 10000, 3),
            "negative_bps": round(negative_total * 10000, 3),
        },
        "top_positive": [clean(item) for item in records[:12]],
        "top_negative": [clean(item) for item in records[-12:][::-1]],
        "constituents": [clean(item) for item in records],
        "method": {
            "weight_source": "State Street SPY fund holdings",
            "price_source": "Yahoo Finance unadjusted daily closes",
            "notes": "Opening weights are reconstructed from same-day closing weights and constituent returns.",
        },
    }
    if not math.isclose(sum(item["weight_pct"] for item in payload["constituents"]), 100, abs_tol=0.1):
        raise ValueError("Opening weights do not sum to approximately 100%")
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    print(json.dumps(payload["snapshot"], indent=2))
    print("Top positive:", [(x["ticker"], x["contribution_bps"]) for x in payload["top_positive"][:5]])
    print("Top negative:", [(x["ticker"], x["contribution_bps"]) for x in payload["top_negative"][:5]])


if __name__ == "__main__":
    build()
