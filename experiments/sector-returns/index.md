---
layout: default
title: "Where the Market Moved"
search_terms: sector returns market performance ETF heatmap sector rotation
permalink: /experiments/sector-returns/
image: /images/sector-returns.svg
methods: [Data visualization, Time series]
summary: A map of 20 stock market benchmarks, sectors and themes, from the last month to the last five years.
search_terms: stock market sectors sector rotation ETF total return heatmap S&P 500 technology chips artificial intelligence software cybersecurity biotechnology energy real estate
---

{% assign study = site.data.sector_returns %}

<article class="article-shell sector-experiment" markdown="1">
<header class="article-header">
  <a class="back-link" href="{{ '/experiments/' | relative_url }}">← All experiments</a>
  <p class="eyebrow"><span></span> Sector performance</p>
  <h1>{{ page.title }}</h1>
  <p class="experiment-status experiment-status-static">Rolling returns through <strong>{{ study.end | date: '%B %-d, %Y' }}</strong></p>
</header>
<div class="article-content" markdown="1">

{% assign monthly = study.rankings | first %}
{% assign monthly_best = monthly.best | first %}
{% assign monthly_worst = monthly.worst | first %}
{% assign spy = study.rows | first %}

Over the last month SPY returned {{ spy.cells[0].label }}. Of the funds below, {{ monthly_best.name }} ({{ monthly_best.ticker }}) came in first at {{ monthly_best.label }}, and {{ monthly_worst.name }} ({{ monthly_worst.ticker }}) came in last at {{ monthly_worst.label }}. What happens if we start the clock five years earlier?

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

The periods in the heatmap overlap. This chart splits the six month window at the start of the latest month. The two stretches differ in length, so I look at which direction the bars point and whether the leaders changed.

<figure class="sector-figure sector-rotation">
  <figcaption><strong>Before and during the latest month</strong><span>{{ study.starts[2] | date: '%b %-d, %Y' }} to {{ study.starts[0] | date: '%b %-d, %Y' }}, then to {{ study.end | date: '%b %-d, %Y' }} · same horizontal scale</span></figcaption>
  <div class="sector-rotation-head"><span>ETF</span><span>Preceding stretch</span><span>Latest month</span></div>
  {% for fund in study.rotation %}
    <div class="sector-rotation-row"><strong title="{{ fund.name | escape }}">{{ fund.ticker }}</strong>
      {% for move in fund.moves %}
        {% assign length = move | abs | times: 50.0 | divided_by: study.rotation_scale %}
        <div class="sector-move"><span class="sector-track" aria-hidden="true"><i class="{% if move < 0 %}negative{% else %}positive{% endif %}" style="width:{{ length }}%"></i></span><span>{{ move | round: 1 }}%</span></div>
      {% endfor %}
    </div>
  {% endfor %}
</figure>

### What I saw on November 24, 2026

At launch, health care and biotechnology rose in both stretches. XLE gained 18.1% in the earlier stretch, then fell 12.8% in the latest month. The change in leadership was visible in prices. To find out whether investors actually moved money from one fund to another, we’d need flow data.

Energy’s short and long windows tell different stories. XLE led at one and five years. Clean energy, represented by ICLN, trailed SPY in all six windows. XLE owns oil and gas companies, while ICLN owns global clean energy businesses. Putting both under the word “energy” hides what you’re actually buying. The [EIA’s November outlook](https://www.eia.gov/outlooks/steo/marketreview/crude.php) described higher October oil prices and tight supply, useful context for the oil producers even though it doesn’t explain their full return or the November pullback.

NVIDIA [reported that data center revenue more than doubled year over year](https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/) on November 17. SOXX still finished the month down. A company’s sales and what investors are willing to pay for those sales can move in different directions. The grid doesn’t separate earnings news from changes in valuations or expectations.

No sector or theme in this set beat SPY in all six windows. Biotech came close, beating it in five and falling short over five years. Energy also beat it in five, with the latest month as its exception. Since the windows overlap, a strong stretch can show up in several columns.

In that November snapshot, 12 of the 19 funds beat SPY over one month, even though only nine posted gains. Beating the market can mean losing less. Over five years, seven beat SPY. The counts below update with the charts and describe only the funds shown here, some of which hold the same companies.

## The leaders and laggards

The bars show the three highest and three lowest returns for each period, excluding SPY. Each period has its own scale, shared by both sides. Bar length shows the size of the return, and the sign tells you whether the fund gained or lost. Rankings use unrounded values.

<div class="sector-rank-grid">
  {% for rank in study.rankings %}
    <section class="sector-rank-card">
      <h3>{{ rank.label }}</h3>
      <div class="sector-rank-columns">
        {% for side in (1..2) %}
          {% if side == 1 %}{% assign entries = rank.best %}{% else %}{% assign entries = rank.worst %}{% endif %}
          <div>
            <h4>{% if side == 1 %}Three highest{% else %}Three lowest{% endif %}</h4>
            <ol>
              {% for entry in entries %}
                {% assign width = entry.value | abs | times: 100.0 | divided_by: rank.scale %}
                <li>
                  <div class="sector-bar-label"><span>{{ entry.name | escape }} <small>{{ entry.ticker }}</small></span><strong>{{ entry.label }}</strong></div>
                  <div class="sector-bar-track" aria-hidden="true"><span class="{% if entry.value < 0 %}loss{% else %}gain{% endif %}" style="width:{{ width }}%"></span></div>
                </li>
              {% endfor %}
            </ol>
          </div>
        {% endfor %}
      </div>
      <p class="sector-note">{{ rank.ahead }} of {{ rank.eligible }} funds beat SPY.</p>
    </section>
  {% endfor %}
</div>

## What happened to $10,000?

Suppose you put $10,000 into each of these funds separately on {{ study.starts[5] | date: '%B %-d, %Y' }} and reinvested the distributions. Here's what each investment would be worth at the latest close in this comparison.

<figure class="sector-figure sector-growth">
  <figcaption><strong>Ending value of a $10,000 investment</strong><span>Selected ETFs · {{ study.starts[5] | date: '%B %-d, %Y' }} to {{ study.end | date: '%B %-d, %Y' }}</span></figcaption>
  <p class="sector-note">The vertical tick marks the original $10,000. SPY is shown in blue.</p>
  {% assign principal = 10000.0 | times: 100 | divided_by: study.growth_scale %}
  <ul>
    {% for entry in study.growth %}
      {% assign width = entry.amount | times: 100.0 | divided_by: study.growth_scale %}
      <li>
        <div class="sector-bar-label"><span>{{ entry.name | escape }} <small>{{ entry.ticker }}</small></span><strong>{{ entry.label }}</strong></div>
        <div class="sector-bar-track" aria-hidden="true">
          <span class="{% if entry.ticker == 'SPY' %}benchmark{% elsif entry.amount < 10000 %}loss{% else %}gain{% endif %}" style="width:{{ width }}%"></span>
          <i class="sector-principal" style="left:{{ principal }}%"></i>
        </div>
      </li>
    {% endfor %}
  </ul>
</figure>

At the November 24 launch, the AI fund finished only about $385 ahead of SPY on a $10,000 investment. Oil and gas ended more than $8,500 ahead of SPY. The chart shows the ending amounts; it leaves out the swings investors would have had to sit through.

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

The page refreshes after trading days. Each window counts back by calendar months from the latest completed session, then uses the last trading close on or before that target. The current start dates, in column order, are **{% for start in study.starts %}{{ start | date: '%b %-d, %Y' }}{% unless forloop.last %}; {% endunless %}{% endfor %}**. A fund without enough history shows N/A. If any fund is missing a required close, the last complete comparison stays up.

</div>
</article>
