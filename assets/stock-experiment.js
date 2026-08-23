(function () {
  const marketCanvas = document.querySelector('#market-chart');
  const marketWrap = document.querySelector('#market-chart-wrap');
  const marketTooltip = document.querySelector('#market-tooltip');
  const allocationCanvas = document.querySelector('#allocation-chart');
  const allocationWrap = document.querySelector('#allocation-chart-wrap');
  const allocationTooltip = document.querySelector('#allocation-tooltip');
  if (!marketCanvas || !marketWrap || !marketTooltip || !allocationCanvas || !allocationWrap || !allocationTooltip) return;

  const marketContext = marketCanvas.getContext('2d');
  const allocationContext = allocationCanvas.getContext('2d');
  const stockPalette = ['#315fba', '#d96c54', '#3f8b68', '#b1892d', '#735fa5', '#2d8995', '#a85f78', '#6d813d', '#bd7137', '#596276'];
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  let data = null;
  let stockSeries = [];
  let series = [];
  let colors = { adaptive: '#18243a' };
  let marketSelectedIndex = -1;
  let allocationSelectedIndex = -1;
  let marketFrame = 0;
  let allocationFrame = 0;
  let chartWidth = 0;
  let marketHeight = 0;
  let allocationHeight = 0;
  let pixelRatio = 1;

  function parseDate(value) {
    return new Date(value + 'T00:00:00Z');
  }

  function signedPercent(value) {
    return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
  }

  function colorWithAlpha(hex, alpha) {
    const value = hex.replace('#', '');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
  }

  function seriesById(id) {
    return series.find(function (item) { return item.id === id; });
  }

  function buildDynamicInterface(payload) {
    stockSeries = payload.series.filter(function (item) { return item.id !== 'adaptive'; });
    series = payload.series;
    stockSeries.forEach(function (item, index) { colors[item.id] = stockPalette[index % stockPalette.length]; });

    const results = document.querySelector('#portfolio-results');
    results.innerHTML = '';
    series.forEach(function (item) {
      const card = document.createElement('div');
      card.className = 'portfolio-result' + (item.id === 'adaptive' ? ' portfolio-result-adaptive' : '');
      card.style.setProperty('--series-color', colors[item.id]);
      const label = document.createElement('span');
      label.textContent = item.id === 'adaptive' ? item.name : item.name + ' · ' + item.symbol;
      const value = document.createElement('strong');
      value.id = item.id + '-value';
      const change = document.createElement('small');
      change.id = item.id + '-return';
      card.appendChild(label);
      card.appendChild(value);
      card.appendChild(change);
      results.appendChild(card);
    });

    const tooltipSeries = document.querySelector('#market-tooltip-series');
    tooltipSeries.innerHTML = '';
    series.forEach(function (item) {
      const row = document.createElement('span');
      row.className = 'tooltip-row';
      row.dataset.series = item.id;
      row.style.setProperty('--series-color', colors[item.id]);
      const label = document.createElement('b');
      label.textContent = item.id === 'adaptive' ? 'Adaptive' : item.symbol;
      const value = document.createElement('strong');
      row.appendChild(label);
      row.appendChild(value);
      tooltipSeries.appendChild(row);
    });

    const bars = document.querySelector('#allocation-bars');
    const legend = document.querySelector('#allocation-legend');
    bars.innerHTML = '';
    legend.innerHTML = '';
    stockSeries.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'allocation-row';
      row.style.setProperty('--series-color', colors[item.id]);
      row.innerHTML = '<span>' + item.symbol + '</span><div><i id="' + item.id + '-bar"></i></div><strong id="' + item.id + '-weight">...</strong>';
      bars.appendChild(row);

      const legendItem = document.createElement('span');
      legendItem.style.setProperty('--series-color', colors[item.id]);
      legendItem.textContent = item.symbol;
      legend.appendChild(legendItem);
    });

    const allocationTooltipSeries = document.querySelector('#allocation-tooltip-series');
    allocationTooltipSeries.innerHTML = '';
    stockSeries.forEach(function (item) {
      const row = document.createElement('span');
      row.dataset.series = item.id;
      row.style.setProperty('--series-color', colors[item.id]);
      row.innerHTML = '<b>' + item.symbol + '</b><strong></strong>';
      allocationTooltipSeries.appendChild(row);
    });
  }

  function updateResults() {
    series.forEach(function (item) {
      document.querySelector('#' + item.id + '-value').textContent = moneyFormatter.format(item.latest_value);
      const returnElement = document.querySelector('#' + item.id + '-return');
      returnElement.textContent = signedPercent(item.return_percent);
      returnElement.classList.toggle('negative', item.return_percent < 0);
    });
  }

  function updateAllocation(payload) {
    stockSeries.forEach(function (item) {
      const weight = payload.current_allocation[item.id];
      document.querySelector('#' + item.id + '-weight').textContent = weight.toFixed(1) + '%';
      document.querySelector('#' + item.id + '-bar').style.width = weight + '%';
    });

    const latest = payload.recent_rebalances[0];
    if (!latest) return;
    const largest = stockSeries.reduce(function (best, item) {
      return latest.weights[item.id] > latest.weights[best.id] ? item : best;
    }, stockSeries[0]);
    const weeklyWinner = stockSeries.reduce(function (best, item) {
      return latest.weekly_returns[item.id] > latest.weekly_returns[best.id] ? item : best;
    }, stockSeries[0]);
    document.querySelector('#latest-decision').textContent = 'After ' +
      dateFormatter.format(parseDate(latest.date)) + ', the largest allocation is ' + largest.name +
      ' at ' + latest.weights[largest.id].toFixed(1) + '%. The week’s strongest return was ' +
      weeklyWinner.name + ' at ' + signedPercent(latest.weekly_returns[weeklyWinner.id]) + '.';
  }

  function updateHistory(payload) {
    const body = document.querySelector('#rebalance-table');
    body.innerHTML = '';
    payload.recent_rebalances.forEach(function (rebalance) {
      const largest = stockSeries.reduce(function (best, item) {
        return rebalance.weights[item.id] > rebalance.weights[best.id] ? item : best;
      }, stockSeries[0]);
      const weeklyWinner = stockSeries.reduce(function (best, item) {
        return rebalance.weekly_returns[item.id] > rebalance.weekly_returns[best.id] ? item : best;
      }, stockSeries[0]);
      const values = [
        dateFormatter.format(parseDate(rebalance.date)),
        moneyFormatter.format(rebalance.portfolio_value),
        largest.symbol + ' · ' + rebalance.weights[largest.id].toFixed(1) + '%',
        weeklyWinner.symbol + ' · ' + signedPercent(rebalance.weekly_returns[weeklyWinner.id]),
        rebalance.turnover_percent.toFixed(1) + '%'
      ];
      const row = document.createElement('tr');
      values.forEach(function (value) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function updateSummary(payload) {
    document.querySelector('#market-date').textContent = dateFormatter.format(parseDate(payload.market_date));
    updateResults();
    document.querySelector('#market-leader').textContent = seriesById(payload.leader).name;
    document.querySelector('#market-rebalances').textContent = payload.rebalance_count;
    updateAllocation(payload);
    updateHistory(payload);
    const values = series.map(function (item) { return item.name + ' ' + moneyFormatter.format(item.latest_value); }).join(', ');
    marketCanvas.setAttribute('aria-label', 'Interactive one-year portfolio comparison from ' +
      dateFormatter.format(parseDate(payload.start_date)) + ' through ' + dateFormatter.format(parseDate(payload.market_date)) +
      '. Current values: ' + values + '.');
  }

  function resizeCharts() {
    chartWidth = marketWrap.clientWidth;
    marketHeight = Math.max(350, Math.min(500, Math.round(chartWidth * 0.56)));
    allocationHeight = Math.max(320, Math.min(430, Math.round(chartWidth * 0.48)));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    [[marketCanvas, marketContext, marketHeight], [allocationCanvas, allocationContext, allocationHeight]].forEach(function (entry) {
      entry[0].width = Math.round(chartWidth * pixelRatio);
      entry[0].height = Math.round(entry[2] * pixelRatio);
      entry[0].style.width = chartWidth + 'px';
      entry[0].style.height = entry[2] + 'px';
      entry[1].setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    });
    requestMarketDraw();
    requestAllocationDraw();
  }

  function chartGeometry(height) {
    const padding = { top: 25, right: 20, bottom: 40, left: chartWidth < 520 ? 54 : 72 };
    return { padding: padding, plotWidth: chartWidth - padding.left - padding.right, plotHeight: height - padding.top - padding.bottom };
  }

  function drawDateAxis(ctx, points, height, geometry, xFor) {
    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach(function (index) {
      ctx.fillStyle = '#7b8190';
      ctx.textAlign = index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center';
      ctx.fillText(shortDateFormatter.format(parseDate(points[index].date)), xFor(index), height - 14);
    });
  }

  function requestMarketDraw() {
    if (!marketFrame) marketFrame = window.requestAnimationFrame(drawMarketChart);
  }

  function drawMarketChart() {
    marketFrame = 0;
    marketContext.clearRect(0, 0, chartWidth, marketHeight);
    if (!data) return;
    const points = data.points;
    const geometry = chartGeometry(marketHeight);
    const values = points.reduce(function (all, point) {
      return all.concat(series.map(function (item) { return point[item.id]; }));
    }, []);
    const rawMin = Math.min.apply(null, values);
    const rawMax = Math.max.apply(null, values);
    const buffer = Math.max(12, (rawMax - rawMin) * 0.1);
    const minimum = rawMin - buffer;
    const maximum = rawMax + buffer;
    function xFor(index) { return geometry.padding.left + (index / (points.length - 1)) * geometry.plotWidth; }
    function yFor(value) { return geometry.padding.top + ((maximum - value) / (maximum - minimum)) * geometry.plotHeight; }

    marketContext.font = '10px "DM Mono", monospace';
    marketContext.textBaseline = 'middle';
    for (let step = 0; step <= 4; step += 1) {
      const y = geometry.padding.top + (step / 4) * geometry.plotHeight;
      const value = maximum - (step / 4) * (maximum - minimum);
      marketContext.beginPath();
      marketContext.moveTo(geometry.padding.left, y);
      marketContext.lineTo(chartWidth - geometry.padding.right, y);
      marketContext.strokeStyle = 'rgba(49,95,186,.1)';
      marketContext.lineWidth = 1;
      marketContext.stroke();
      marketContext.fillStyle = '#7b8190';
      marketContext.textAlign = 'right';
      marketContext.fillText('$' + Math.round(value).toLocaleString('en-US'), geometry.padding.left - 9, y);
    }
    const startingY = yFor(data.starting_investment);
    marketContext.beginPath();
    marketContext.moveTo(geometry.padding.left, startingY);
    marketContext.lineTo(chartWidth - geometry.padding.right, startingY);
    marketContext.setLineDash([5, 5]);
    marketContext.strokeStyle = 'rgba(39,47,59,.2)';
    marketContext.stroke();
    marketContext.setLineDash([]);
    drawDateAxis(marketContext, points, marketHeight, geometry, xFor);

    series.slice().reverse().forEach(function (item) {
      marketContext.beginPath();
      points.forEach(function (point, index) {
        const x = xFor(index);
        const y = yFor(point[item.id]);
        if (index === 0) marketContext.moveTo(x, y); else marketContext.lineTo(x, y);
      });
      marketContext.strokeStyle = colors[item.id];
      marketContext.globalAlpha = item.id === 'adaptive' ? 1 : .78;
      marketContext.lineWidth = item.id === 'adaptive' ? 3.4 : 1.45;
      marketContext.lineJoin = 'round';
      marketContext.lineCap = 'round';
      marketContext.stroke();
    });
    marketContext.globalAlpha = 1;

    if (marketSelectedIndex >= 0) {
      const selected = points[marketSelectedIndex];
      const x = xFor(marketSelectedIndex);
      marketContext.beginPath();
      marketContext.moveTo(x, geometry.padding.top);
      marketContext.lineTo(x, marketHeight - geometry.padding.bottom);
      marketContext.strokeStyle = 'rgba(39,47,59,.3)';
      marketContext.lineWidth = 1;
      marketContext.setLineDash([4, 4]);
      marketContext.stroke();
      marketContext.setLineDash([]);
      series.forEach(function (item) {
        marketContext.beginPath();
        marketContext.arc(x, yFor(selected[item.id]), item.id === 'adaptive' ? 5 : 3.5, 0, Math.PI * 2);
        marketContext.fillStyle = colors[item.id];
        marketContext.fill();
      });
    }
  }

  function requestAllocationDraw() {
    if (!allocationFrame) allocationFrame = window.requestAnimationFrame(drawAllocationChart);
  }

  function drawAllocationChart() {
    allocationFrame = 0;
    allocationContext.clearRect(0, 0, chartWidth, allocationHeight);
    if (!data) return;
    const points = data.allocation_points;
    const geometry = chartGeometry(allocationHeight);
    function xFor(index) { return geometry.padding.left + (index / (points.length - 1)) * geometry.plotWidth; }
    function yFor(value) { return geometry.padding.top + ((100 - value) / 100) * geometry.plotHeight; }
    allocationContext.font = '10px "DM Mono", monospace';
    allocationContext.textBaseline = 'middle';
    [0, 25, 50, 75, 100].forEach(function (value) {
      const y = yFor(value);
      allocationContext.beginPath();
      allocationContext.moveTo(geometry.padding.left, y);
      allocationContext.lineTo(chartWidth - geometry.padding.right, y);
      allocationContext.strokeStyle = 'rgba(49,95,186,.1)';
      allocationContext.lineWidth = 1;
      allocationContext.stroke();
      allocationContext.fillStyle = '#7b8190';
      allocationContext.textAlign = 'right';
      allocationContext.fillText(value + '%', geometry.padding.left - 9, y);
    });
    drawDateAxis(allocationContext, points, allocationHeight, geometry, xFor);

    const lower = points.map(function () { return 0; });
    stockSeries.forEach(function (item) {
      const upper = points.map(function (point, index) { return lower[index] + point[item.id]; });
      allocationContext.beginPath();
      points.forEach(function (point, index) {
        const x = xFor(index);
        const y = yFor(upper[index]);
        if (index === 0) allocationContext.moveTo(x, y); else allocationContext.lineTo(x, y);
      });
      for (let index = points.length - 1; index >= 0; index -= 1) {
        allocationContext.lineTo(xFor(index), yFor(lower[index]));
      }
      allocationContext.closePath();
      allocationContext.fillStyle = colorWithAlpha(colors[item.id], .78);
      allocationContext.fill();
      upper.forEach(function (value, index) { lower[index] = value; });
    });

    if (allocationSelectedIndex >= 0) {
      const x = xFor(allocationSelectedIndex);
      allocationContext.beginPath();
      allocationContext.moveTo(x, geometry.padding.top);
      allocationContext.lineTo(x, allocationHeight - geometry.padding.bottom);
      allocationContext.strokeStyle = 'rgba(39,47,59,.55)';
      allocationContext.lineWidth = 1;
      allocationContext.setLineDash([4, 4]);
      allocationContext.stroke();
      allocationContext.setLineDash([]);
    }
  }

  function selectMarketPoint(event) {
    if (!data) return;
    const bounds = marketCanvas.getBoundingClientRect();
    const geometry = chartGeometry(marketHeight);
    const relative = Math.max(0, Math.min(1, (event.clientX - bounds.left - geometry.padding.left) / geometry.plotWidth));
    marketSelectedIndex = Math.round(relative * (data.points.length - 1));
    const point = data.points[marketSelectedIndex];
    const x = geometry.padding.left + (marketSelectedIndex / (data.points.length - 1)) * geometry.plotWidth;
    marketTooltip.querySelector('time').textContent = dateFormatter.format(parseDate(point.date));
    series.forEach(function (item) {
      marketTooltip.querySelector('[data-series="' + item.id + '"] strong').textContent = moneyFormatter.format(point[item.id]);
    });
    marketTooltip.hidden = false;
    positionTooltip(marketTooltip, x, chartWidth);
    requestMarketDraw();
  }

  function selectAllocationPoint(event) {
    if (!data) return;
    const bounds = allocationCanvas.getBoundingClientRect();
    const geometry = chartGeometry(allocationHeight);
    const relative = Math.max(0, Math.min(1, (event.clientX - bounds.left - geometry.padding.left) / geometry.plotWidth));
    allocationSelectedIndex = Math.round(relative * (data.allocation_points.length - 1));
    const point = data.allocation_points[allocationSelectedIndex];
    const x = geometry.padding.left + (allocationSelectedIndex / (data.allocation_points.length - 1)) * geometry.plotWidth;
    allocationTooltip.querySelector('time').textContent = dateFormatter.format(parseDate(point.date));
    stockSeries.forEach(function (item) {
      allocationTooltip.querySelector('[data-series="' + item.id + '"] strong').textContent = point[item.id].toFixed(1) + '%';
    });
    allocationTooltip.hidden = false;
    positionTooltip(allocationTooltip, x, chartWidth);
    requestAllocationDraw();
  }

  function positionTooltip(element, x, width) {
    const tooltipWidth = element.offsetWidth;
    element.style.left = Math.max(8, Math.min(width - tooltipWidth - 8, x - tooltipWidth / 2)) + 'px';
    element.style.top = '10px';
  }

  marketCanvas.addEventListener('pointermove', selectMarketPoint);
  marketCanvas.addEventListener('pointerdown', selectMarketPoint);
  marketCanvas.addEventListener('pointerleave', function (event) {
    if (event.pointerType === 'mouse') { marketSelectedIndex = -1; marketTooltip.hidden = true; requestMarketDraw(); }
  });
  allocationCanvas.addEventListener('pointermove', selectAllocationPoint);
  allocationCanvas.addEventListener('pointerdown', selectAllocationPoint);
  allocationCanvas.addEventListener('pointerleave', function (event) {
    if (event.pointerType === 'mouse') { allocationSelectedIndex = -1; allocationTooltip.hidden = true; requestAllocationDraw(); }
  });
  window.addEventListener('resize', resizeCharts, { passive: true });

  function loadMarketData() {
    const baseUrl = marketCanvas.dataset.marketDataUrl || '/assets/data/stock-bandit-1y.json';
    fetch(baseUrl)
      .then(function (response) { if (!response.ok) throw new Error('Market data request failed'); return response.json(); })
      .then(function (payload) {
        if (payload.experiment !== 'adaptive-stock-bandit' || !payload.points || !payload.allocation_points || payload.series.length !== 11) {
          throw new Error('Market data has an unsupported format');
        }
        data = payload;
        buildDynamicInterface(payload);
        marketWrap.classList.remove('market-chart-error');
        marketWrap.removeAttribute('data-error');
        updateSummary(payload);
        resizeCharts();
      })
      .catch(function () {
        if (data) return;
        marketWrap.classList.add('market-chart-error');
        marketWrap.setAttribute('data-error', 'Market data is temporarily unavailable.');
      });
  }

  window.addEventListener('pageshow', loadMarketData);
}());
