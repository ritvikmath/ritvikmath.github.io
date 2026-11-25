---
layout: post
title: "Where the Market Moved"
category: stock market
image: /images/sector-returns.svg
methods: [Data visualization, Time series]
summary: A map of 20 stock market benchmarks, sectors and themes, from the last month to the last five years.
search_terms: stock market sectors sector rotation ETF total return heatmap S&P 500 technology chips artificial intelligence software cybersecurity biotechnology energy real estate
---

{% assign study = site.data.sector_returns %}

The stock market fell 5.4% in the month ending November 24. Which stock market? If you owned the S&P 500, that was roughly your month. If you owned chip stocks, it was closer to a 19% loss. A biotech fund gained nearly 6% over the same dates. I wanted to see how much of that story changes when you move the start date back.

## One closing date, six ways to look back

<link rel="stylesheet" href="{{ '/assets/sector-returns.css' | relative_url }}">
<script src="{{ '/assets/sector-returns.js' | relative_url }}" defer></script>
<figure class="sector-figure">
  <figcaption id="sector-grid-title"><strong>Market returns by sector and theme</strong><span>Through the {{ study.end | date: '%B %-d, %Y' }} close · cumulative total returns</span></figcaption>
  <label class="sector-sort" id="sector-sort-control" hidden>Sort within groups
    <select id="sector-sort">
      <option value="">Original order</option>
      {% for window in study.windows %}<option value="{{ forloop.index0 }}">{{ window }} · highest first</option>{% endfor %}
    </select>
  </label>
  <div class="sector-legend" aria-label="Colors range from losses in red through zero to gains in green">
    <span>−{{ study.cap }}%</span><span class="sector-gradient" style="background:linear-gradient(90deg,{{ study.legend }})" aria-hidden="true"></span><span>+{{ study.cap }}%</span>
  </div>
  <p class="sector-note">White is zero. The same return has the same color anywhere in the grid. On a small screen, swipe to see every period.</p>
  <div class="sector-scroll" role="region" aria-labelledby="sector-grid-title" tabindex="0">
    <table class="sector-table" id="sector-table">
      <thead><tr><th scope="col">Category / ETF</th>{% for window in study.windows %}<th scope="col">{{ window }}</th>{% endfor %}</tr></thead>
      {% assign groups = study.rows | group_by: "group" %}
      {% for group in groups %}
      <tbody>
        <tr class="sector-group"><th scope="rowgroup" colspan="7">{{ group.name }}</th></tr>
        {% for row in group.items %}
        <tr data-sector-row><th scope="row"><span>{{ row.name | escape }}</span><small>{{ row.ticker }}</small></th>
          {% for cell in row.cells %}<td data-return="{{ cell.value }}" style="background-color:{{ cell.color }};color:{{ cell.ink }}">{{ cell.label }}</td>{% endfor %}
        </tr>
        {% endfor %}
      </tbody>
      {% endfor %}
    </table>
  </div>
</figure>

## What changed this month?

The one-month column makes chips and AI look like two of the roughest places to be. Go back five years and the same two funds beat the S&P 500. Software didn't follow them: IGV lagged the benchmark both this month and over five years. Even within technology, the starting date and the kind of company you own matter.

The periods in the heatmap overlap. To see what happened before the last month, I split the six-month period in two. Each bar shows the fund's return during that stretch, not its return per month. The stretches have different lengths; what I’m looking for here is the change in direction.

<figure class="sector-figure sector-rotation">
  <figcaption><strong>Before and during the latest month</strong><span>May 22 to Oct. 23, then Oct. 23 to Nov. 24 · same horizontal scale</span></figcaption>
  <div class="sector-rotation-head"><span>ETF</span><span>Preceding stretch</span><span>Latest month</span></div>
  {% assign examples = 'SPY,SOXX,XLE,IBB,XLV,ITB' | split: ',' %}
  {% for ticker in examples %}
    {% assign fund = study.rows | where: "ticker", ticker | first %}
    {% assign before = fund.cells[0].close | times: 100.0 | divided_by: fund.cells[2].close | minus: 100 %}
    {% assign recent = fund.cells[0].value %}
    <div class="sector-rotation-row"><strong title="{{ fund.name | escape }}">{{ ticker }}</strong>
      {% for period in (1..2) %}
        {% if period == 1 %}{% assign move = before %}{% else %}{% assign move = recent %}{% endif %}
        {% assign length = move | abs | times: 1.25 %}
        <div class="sector-move"><span class="sector-track" aria-hidden="true"><i class="{% if move < 0 %}negative{% else %}positive{% endif %}" style="width:{{ length }}%"></i></span><span>{{ move | round: 1 }}%</span></div>
      {% endfor %}
    </div>
  {% endfor %}
</figure>

Health care and biotechnology went up in both stretches. Energy moved the other way: XLE was up before the last month and then lost 12.8%, even as several defensive areas rose. That looks like a change in market leadership. These returns don’t tell us whether investors sold one fund to buy another; for that we’d need holdings or flow data.

Energy’s short and long windows tell different stories. XLE led at one and five years. Clean energy, represented by ICLN, trailed SPY in all six windows. XLE owns oil and gas companies, while ICLN owns global clean energy businesses. Putting both under the word “energy” hides what you’re actually buying. The [EIA’s November outlook](https://www.eia.gov/outlooks/steo/marketreview/crude.php) described higher October oil prices and tight supply, useful context for the oil producers even though it doesn’t explain their full return or the November pullback.

NVIDIA [reported that data center revenue more than doubled year over year](https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/) on November 17. SOXX still finished the month down. A company’s sales and what investors are willing to pay for those sales can move in different directions. The grid doesn’t separate earnings news from changes in valuations or expectations.

No sector or theme in this set beat SPY in all six windows. IBB beat it in five, missing at five years; XLE also beat it in five, missing at one month. The six windows share an ending date, so five wins here aren’t five independent tests.

## The leaders and laggards

These rankings exclude SPY. They use unrounded returns, so two funds that look tied to one decimal place can appear in a particular order.

<div class="sector-scroll" role="region" aria-label="Top and bottom ETF returns by horizon" tabindex="0">
  <table class="sector-rankings">
    <thead><tr><th scope="col">Period</th><th scope="col">Three highest</th><th scope="col">Three lowest</th></tr></thead>
    <tbody>{% for rank in study.rankings %}<tr><th scope="row">{{ rank.label }}</th><td>{{ rank.best }}</td><td>{{ rank.worst }}</td></tr>{% endfor %}</tbody>
  </table>
</div>

## What each fund represents

The traditional sector funds divide the S&P 500 by business classification. The themes use different rules, can hold companies outside that index, and can overlap each other. Clean energy and AI include companies outside the US. These are returns on the named funds, in US dollars, rather than returns on every company in each line of business.

<details class="sector-proxies"><summary>See all 20 fund choices and price histories</summary>
  <dl>{% for row in study.rows %}
    <dt>{{ row.name | escape }} <a href="https://finance.yahoo.com/quote/{{ row.ticker }}/history/">{{ row.ticker }} history</a></dt>
    <dd>{{ row.reason | escape }}</dd>
  {% endfor %}</dl>
</details>

Fund mandates: [State Street sector ETFs](https://www.ssga.com/us/en/individual/capabilities/equities/sector-investing/sector-and-industry-etfs), [iShares sector and industry ETFs](https://www.ishares.com/us/literature/presentation/ishares-sector-and-industry-etfs.pdf), [Global X AIQ](https://www.globalxetfs.com/funds/aiq/) and [First Trust CIBR](https://www.ftportfolios.com/Retail/Etf/EtfSummary.aspx?Ticker=CIBR).

## How I calculated the returns

I used [Yahoo Finance adjusted closing prices](https://finance.yahoo.com/quote/SPY/history/). The adjustments account for splits and distributions and give a reinvestment-based estimate of each fund’s total return. To get the number in a cell, divide the ending adjusted close by the starting adjusted close, subtract one, then multiply by 100. I didn’t annualize the results or subtract an investor’s taxes or trading costs.

For each horizon I went back by calendar months, then used the last market close on or before that date. The start dates, in column order, were **{% for start in study.starts %}{{ start | date: '%b %-d, %Y' }}{% unless forloop.last %}; {% endunless %}{% endfor %}**. The rule is the same for every fund. A fund without enough history would show N/A; this set has data for all six windows. These figures are a dated snapshot, not a forecast or a live quote.
