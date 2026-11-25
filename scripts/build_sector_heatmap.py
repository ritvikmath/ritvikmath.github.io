"""Refresh the sector study with an explicitly selected completed session."""
from calendar import monthrange
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
import json
import math
from pathlib import Path
import sys
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ASSETS = [
    ("Benchmark", "S&P 500", "SPY", "Large US companies in the S&P 500."),
    ("Sectors", "Information technology", "XLK", "S&P 500 companies classified as information technology."),
    ("Sectors", "Health care", "XLV", "S&P 500 drugmakers, health insurers, equipment makers and other health businesses."),
    ("Sectors", "Financials", "XLF", "S&P 500 banks, insurers and other financial companies."),
    ("Sectors", "Energy", "XLE", "S&P 500 oil, gas and energy services companies."),
    ("Sectors", "Industrials", "XLI", "S&P 500 manufacturers, transport and industrial service firms."),
    ("Sectors", "Consumer discretionary", "XLY", "S&P 500 companies selling goods and services people can put off buying."),
    ("Sectors", "Consumer staples", "XLP", "S&P 500 producers and sellers of everyday goods."),
    ("Sectors", "Communication services", "XLC", "S&P 500 telecom, media and interactive platform businesses."),
    ("Sectors", "Real estate", "XLRE", "S&P 500 real estate companies, including equity REITs."),
    ("Sectors", "Utilities", "XLU", "S&P 500 electric, gas and other utilities."),
    ("Sectors", "Materials", "XLB", "S&P 500 chemicals, packaging, metals and other materials companies."),
    ("Themes and industries", "Artificial intelligence", "AIQ", "Global X fund covering AI developers and businesses that supply enabling hardware or data."),
    ("Themes and industries", "Semiconductors", "SOXX", "iShares portfolio of US-listed chip companies and equipment makers."),
    ("Themes and industries", "Software", "IGV", "iShares portfolio focused on North American software and related businesses."),
    ("Themes and industries", "Cybersecurity", "CIBR", "First Trust fund tracking companies in the cybersecurity industry."),
    ("Themes and industries", "Biotechnology", "IBB", "iShares portfolio focused on US-listed biotechnology companies."),
    ("Themes and industries", "Clean energy", "ICLN", "iShares global portfolio of clean energy producers and equipment makers."),
    ("Themes and industries", "Aerospace and defense", "ITA", "iShares portfolio of US aerospace and defense companies."),
    ("Themes and industries", "Housing and homebuilders", "ITB", "iShares portfolio focused on US homebuilders and related suppliers."),
]
WINDOWS = [("1 month", 1), ("3 months", 3), ("6 months", 6),
           ("1 year", 12), ("2 years", 24), ("5 years", 60)]
NY = ZoneInfo("America/New_York")


def latest_completed_session(now=None):
    import exchange_calendars as xcals
    now = datetime.now(NY) if now is None else now.astimezone(NY)
    calendar = xcals.get_calendar("XNYS")
    session = calendar.date_to_session(now.date().isoformat(), direction="previous")
    if now < calendar.session_close(session):
        session = calendar.previous_session(session)
    return session.date()


def fetch(ticker):
    for host in ("query1", "query2"):
        try:
            url = f"https://{host}.finance.yahoo.com/v8/finance/chart/{ticker}?range=10y&interval=1d&events=div%2Csplits"
            with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=25) as fp:
                chart = json.load(fp)["chart"]["result"][0]
            assert chart["meta"]["symbol"] == ticker and chart["meta"]["currency"] == "USD"
            return {datetime.fromtimestamp(ts, NY).date(): p
                    for ts, p in zip(chart["timestamp"], chart["indicators"]["adjclose"][0]["adjclose"])
                    if p is not None and math.isfinite(p) and p > 0}
        except Exception as exc:
            error = exc
    raise RuntimeError(f"No verified adjusted closes for {ticker}") from error


def target(end, months):
    year, month0 = divmod(end.year * 12 + end.month - 1 - months, 12)
    return date(year, month0 + 1, min(end.day, monthrange(year, month0 + 1)[1]))


def luminance(rgb):
    normalized = [value / 255 for value in rgb]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in normalized]
    return sum(w * v for w, v in zip((.2126, .7152, .0722), linear))


def shade(value, cap):
    strength = (abs(value) / cap) ** .65
    endpoint = (19, 102, 73) if value >= 0 else (164, 53, 56)
    return tuple(round(a + strength * (b - a)) for a, b in zip((249, 249, 243), endpoint))


def build(end, prices):
    assert all(end in series for series in prices.values()), "Missing common end close"
    dates = sorted(prices["SPY"])
    starts = [max(day for day in dates if day <= target(end, months)) for _, months in WINDOWS]
    rows = []
    for group, name, ticker, reason in ASSETS:
        series = prices[ticker]
        close = series[end]
        cells = []
        for day in starts:
            if day not in series and day >= min(series):
                raise ValueError(f"{ticker} missing an expected historical close: {day}")
            start = series.get(day)
            value = round(100 * (close / start - 1), 8) if start else None
            cells.append(dict(value=value, label=f"{value:+.1f}%" if value is not None else "N/A", close=start))
        rows.append(dict(group=group, name=name, ticker=ticker, reason=reason, cells=cells, close=close))
    rankings = []
    cap = max(10, math.ceil(max(abs(c["value"]) for r in rows for c in r["cells"] if c["value"] is not None) / 10) * 10)
    for row in rows:
        for cell in row["cells"]:
            v = cell["value"]
            rgb = shade(v or 0, cap)
            level = luminance(rgb) + .05
            cell["color"] = "#%02x%02x%02x" % rgb
            cell["ink"] = "#fff" if 1.05 / level > level / .05 else "#000"
    for i, (label, _) in enumerate(WINDOWS):
        eligible = sorted((r for r in rows[1:] if r["cells"][i]["value"] is not None),
                          key=lambda r: r["cells"][i]["value"])
        def summarize(selected):
            return [dict(name=r["name"], ticker=r["ticker"], **r["cells"][i]) for r in selected]
        benchmark = rows[0]["cells"][i]["value"]
        rankings.append(dict(
            label=label, best=summarize(eligible[:-4:-1]), worst=summarize(eligible[:3]),
            scale=max(abs(r["cells"][i]["value"]) for r in eligible) or 1,
            ahead=sum(r["cells"][i]["value"] > benchmark for r in eligible) if benchmark is not None else None,
            eligible=len(eligible),
        ))
    legend = ", ".join("#%02x%02x%02x" % shade(cap * (i - 10) / 10, cap) for i in range(21))
    selected = {"XLE", "SOXX", "ITA", "XLK", "CIBR", "AIQ", "SPY", "XLRE", "ICLN"}
    growth = []
    for row in rows:
        value = row["cells"][-1]["value"]
        if row["ticker"] in selected and value is not None:
            amount = 10000 * (1 + value / 100)
            growth.append(dict(name=row["name"], ticker=row["ticker"], amount=amount, label=f"${amount:,.0f}"))
    growth.sort(key=lambda entry: entry["amount"], reverse=True)
    growth_scale = max(10000, math.ceil(max((e["amount"] for e in growth), default=0) / 5000) * 5000)
    rotation = []
    for ticker in ("SPY", "SOXX", "XLE", "IBB", "XLV", "ITB"):
        row = next(r for r in rows if r["ticker"] == ticker)
        recent, earlier = row["cells"][0], row["cells"][2]
        if recent["close"] is not None and earlier["close"] is not None:
            before = 100 * (recent["close"] / earlier["close"] - 1)
            rotation.append(dict(ticker=ticker, name=row["name"], moves=[before, recent["value"]]))
    rotation_scale = max(10, math.ceil(max((abs(v) for r in rotation for v in r["moves"]), default=0) / 10) * 10)
    return dict(end=end.isoformat(), starts=[x.isoformat() for x in starts], windows=[x[0] for x in WINDOWS],
                cap=cap, legend=legend, rows=rows, rankings=rankings, growth=growth,
                growth_scale=growth_scale, rotation=rotation, rotation_scale=rotation_scale)


if __name__ == "__main__":
    end = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else latest_completed_session()
    with ThreadPoolExecutor(max_workers=5) as pool:
        tickers = [a[2] for a in ASSETS]
        prices = dict(zip(tickers, pool.map(fetch, tickers)))
    result = build(end, prices)
    output = Path(__file__).resolve().parents[1] / "_data/sector_returns.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    for row in result["rows"]:
        print(row["ticker"], *(c["label"] for c in row["cells"]))
