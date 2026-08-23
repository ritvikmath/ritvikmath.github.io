(function () {
  const growth = document.querySelector('#sb-growth-chart');
  const regime = document.querySelector('#sb-regime-chart');
  if (!growth || !regime) return;

  const growthWrap = document.querySelector('#sb-growth-wrap');
  const regimeWrap = document.querySelector('#sb-regime-wrap');
  const growthTooltip = document.querySelector('#sb-growth-tooltip');
  const regimeTooltip = document.querySelector('#sb-regime-tooltip');
  const growthContext = growth.getContext('2d');
  const regimeContext = regime.getContext('2d');
  const colors = { bandit: '#19253b', allocation: '#d96c54', spy: '#315fba', agg: '#b1892d', balanced: '#3f8b68', contributed: '#8b8f96' };
  const names = { bandit: 'All-in bandit', allocation: 'Contextual mix', spy: 'SPY', agg: 'AGG', balanced: '60/40', contributed: 'Money contributed' };
  const featureNames = {
    relative_momentum_3m: '3m relative momentum', relative_momentum_12m: '12m relative momentum',
    relative_volatility_3m: 'volatility gap', stock_drawdown_12m: 'stock drawdown',
    stock_bond_correlation_6m: 'stock/bond correlation', relative_trend_10m: 'trend gap'
  };
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  let data;
  let ratio = 1;
  let growthWidth = 0;
  let growthHeight = 440;
  let regimeWidth = 0;
  let regimeHeight = 180;
  let growthSelected = -1;
  let regimeSelected = -1;

  function parseDate(value) { return new Date(value + 'T00:00:00Z'); }
  function signed(value) { return (value >= 0 ? '+' : '') + value.toFixed(2) + '%'; }
  function setupCanvas(canvas, context, width, height) {
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function buildInterface() {
    const endingAge = Math.round(data.ending_age);
    document.querySelector('#sb-period').textContent = 'Age ' + data.starting_age.toFixed(0) + ' to ' + endingAge;
    const cards = document.querySelector('#sb-scorecards');
    const keys = ['bandit', 'allocation', 'spy', 'balanced', 'agg'];
    cards.innerHTML = keys.map(function (key) {
      const item = data.summary[key];
      return '<article style="--strategy-color:' + colors[key] + '"><span>' + names[key] + '</span><strong>' + money.format(item.terminal_value) + '</strong><small>' + signed(item.annualized_return) + ' time-weighted · ' + item.max_drawdown.toFixed(1) + '% max drawdown</small><small class="sb-real-value"><b>' + money.format(item.real_terminal_value) + '</b> after inflation · 2004 dollars</small></article>';
    }).join('');
    const chartKeys = keys.concat(['contributed']);
    document.querySelector('#sb-chart-key').innerHTML = chartKeys.map(function (key) { return '<span class="key-' + key + '" style="--strategy-color:' + colors[key] + '">' + names[key] + '</span>'; }).join('');
    const choices = data.choice_summary;
    document.querySelector('#sb-choice-summary').innerHTML = '<span><strong>' + choices.average_stock_allocation.toFixed(1) + '%</strong> average SPY mix</span><span><strong>' + choices.minimum_stock_allocation.toFixed(1) + ' to ' + choices.maximum_stock_allocation.toFixed(1) + '%</strong> SPY allocation range</span><span><strong>' + choices.SPY + ' / ' + choices.AGG + '</strong> all-in SPY / AGG quarters</span><span><strong>' + choices.switches + '</strong> all-in switches</span>';
    document.querySelector('#sb-feature-grid').innerHTML = data.features.map(function (feature, index) {
      return '<article><span>0' + (index + 1) + '</span><h3>' + feature.name + '</h3><p>' + feature.description + '</p></article>';
    }).join('');
    const leader = keys.reduce(function (best, key) { return data.summary[key].terminal_value > data.summary[best].terminal_value ? key : best; }, keys[0]);
    const bandit = data.summary.bandit;
    const allocation = data.summary.allocation;
    document.querySelector('#sb-result-note').innerHTML = '<strong>The result at age ' + endingAge + ':</strong> after ' + money.format(data.total_contributed) + ' of deposits, ' + names[leader] + ' finished with the most money. The contextual mix reached ' + money.format(allocation.terminal_value) + ', compared with ' + money.format(bandit.terminal_value) + ' for the all-in version. These are historical results and do not predict future returns.';
    document.querySelector('#sb-life-summary').innerHTML = '<span><strong>Age ' + data.starting_age.toFixed(0) + '</strong>' + fullDate.format(parseDate(data.backtest_start)) + '</span><span><strong>' + money.format(data.quarterly_contribution) + '</strong>added every quarter</span><span><strong>' + money.format(data.total_contributed) + '</strong>total contributed</span><span><strong>Age ' + endingAge + '</strong>' + fullDate.format(parseDate(data.backtest_end)) + '</span>';
    document.querySelector('#sb-ending-age-copy').textContent = endingAge;
    document.querySelector('#sb-inflation-caption').innerHTML = 'Consumer prices rose <strong>' + data.inflation.cumulative_inflation_percent.toFixed(1) + '%</strong> during the backtest. Each card’s “after inflation” statistic translates its ending balance into October 2004 purchasing power using monthly U.S. CPI.';
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    growthWidth = growthWrap.clientWidth; growthHeight = Math.max(350, Math.min(500, Math.round(growthWidth * 0.55)));
    regimeWidth = regimeWrap.clientWidth; regimeHeight = regimeWidth < 560 ? 230 : 175;
    setupCanvas(growth, growthContext, growthWidth, growthHeight);
    setupCanvas(regime, regimeContext, regimeWidth, regimeHeight);
    drawGrowth(); drawRegime();
  }

  function drawGrowth() {
    growthContext.clearRect(0, 0, growthWidth, growthHeight);
    if (!data) return;
    const points = data.points;
    const keys = ['bandit', 'allocation', 'spy', 'agg', 'balanced', 'contributed'];
    const values = points.flatMap(function (point) { return keys.map(function (key) { return point[key]; }); });
    const minimum = Math.min.apply(null, values) * 0.92;
    const maximum = Math.max.apply(null, values) * 1.05;
    const pad = { top: 22, right: 18, bottom: 42, left: growthWidth < 520 ? 58 : 75 };
    const plotWidth = growthWidth - pad.left - pad.right;
    const plotHeight = growthHeight - pad.top - pad.bottom;
    const x = function (i) { return pad.left + i / (points.length - 1) * plotWidth; };
    const y = function (value) { return pad.top + (maximum - value) / (maximum - minimum) * plotHeight; };
    growthContext.font = '10px "DM Mono", monospace'; growthContext.textBaseline = 'middle';
    for (let step = 0; step <= 4; step += 1) {
      const value = minimum + (4 - step) / 4 * (maximum - minimum);
      const py = pad.top + step / 4 * plotHeight;
      growthContext.strokeStyle = 'rgba(40,55,77,.10)'; growthContext.lineWidth = 1;
      growthContext.beginPath(); growthContext.moveTo(pad.left, py); growthContext.lineTo(growthWidth - pad.right, py); growthContext.stroke();
      growthContext.fillStyle = '#7b8190'; growthContext.textAlign = 'right'; growthContext.fillText(money.format(value), pad.left - 10, py);
    }
    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach(function (index) {
      growthContext.fillStyle = '#7b8190'; growthContext.textAlign = index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center';
      growthContext.fillText('Age ' + points[index].age.toFixed(0), x(index), growthHeight - 16);
    });
    keys.forEach(function (key) {
      growthContext.beginPath();
      points.forEach(function (point, index) { const px = x(index), py = y(point[key]); if (index === 0) growthContext.moveTo(px, py); else growthContext.lineTo(px, py); });
      growthContext.strokeStyle = colors[key]; growthContext.lineWidth = key === 'bandit' || key === 'allocation' ? 3.2 : key === 'contributed' ? 1.4 : 2.2; growthContext.setLineDash(key === 'contributed' ? [5, 5] : []); growthContext.lineJoin = 'round'; growthContext.lineCap = 'round'; growthContext.stroke(); growthContext.setLineDash([]);
    });
    if (growthSelected >= 0) {
      const point = points[growthSelected]; const px = x(growthSelected);
      growthContext.strokeStyle = 'rgba(25,37,59,.28)'; growthContext.lineWidth = 1; growthContext.beginPath(); growthContext.moveTo(px, pad.top); growthContext.lineTo(px, pad.top + plotHeight); growthContext.stroke();
      keys.forEach(function (key) { growthContext.fillStyle = colors[key]; growthContext.beginPath(); growthContext.arc(px, y(point[key]), 4, 0, Math.PI * 2); growthContext.fill(); });
    }
  }

  function drawRegime() {
    regimeContext.clearRect(0, 0, regimeWidth, regimeHeight);
    if (!data) return;
    const decisions = data.decisions;
    const pad = { top: 22, right: 12, bottom: 38, left: 42 };
    const plotWidth = regimeWidth - pad.left - pad.right;
    const plotHeight = regimeHeight - pad.top - pad.bottom;
    const blockWidth = plotWidth / decisions.length;
    decisions.forEach(function (decision, index) {
      const px = pad.left + index * blockWidth;
      const stockHeight = plotHeight * decision.allocation.SPY / 100;
      regimeContext.fillStyle = colors.agg;
      regimeContext.globalAlpha = index === regimeSelected ? 1 : 0.78;
      regimeContext.fillRect(px, pad.top, Math.max(1, blockWidth + 0.3), plotHeight - stockHeight);
      regimeContext.fillStyle = colors.spy;
      regimeContext.fillRect(px, pad.top + plotHeight - stockHeight, Math.max(1, blockWidth + 0.3), stockHeight);
    });
    regimeContext.globalAlpha = 1; regimeContext.font = '9px "DM Mono", monospace'; regimeContext.fillStyle = '#7b8190'; regimeContext.textBaseline = 'middle';
    [0, 50, 100].forEach(function (value) { const py = pad.top + (100 - value) / 100 * plotHeight; regimeContext.textAlign = 'right'; regimeContext.fillText(value + '%', pad.left - 7, py); });
    regimeContext.beginPath(); decisions.forEach(function (decision, index) { const px = pad.left + (index + 0.5) * blockWidth; const py = pad.top + (1 - decision.allocation.SPY / 100) * plotHeight; if (index === 0) regimeContext.moveTo(px, py); else regimeContext.lineTo(px, py); }); regimeContext.strokeStyle = '#fffdf8'; regimeContext.lineWidth = 2; regimeContext.stroke();
    [0, Math.floor((decisions.length - 1) / 2), decisions.length - 1].forEach(function (index) {
      regimeContext.textAlign = index === 0 ? 'left' : index === decisions.length - 1 ? 'right' : 'center';
      regimeContext.fillText('Age ' + decisions[index].age.toFixed(0), pad.left + index / (decisions.length - 1) * plotWidth, regimeHeight - 15);
    });
    if (regimeSelected >= 0) {
      const px = pad.left + (regimeSelected + 0.5) * blockWidth;
      regimeContext.strokeStyle = '#19253b'; regimeContext.lineWidth = 2; regimeContext.strokeRect(px - blockWidth / 2, pad.top - 2, Math.max(2, blockWidth), regimeHeight - pad.top - pad.bottom + 4);
    }
  }

  function localPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.clientWidth / rect.width, y: (event.clientY - rect.top) * canvas.clientHeight / rect.height };
  }
  function placeTooltip(tooltip, wrap, x, y) {
    const left = Math.min(Math.max(8, x + 14), Math.max(8, wrap.clientWidth - 220));
    tooltip.style.left = left + 'px'; tooltip.style.top = Math.max(8, y - 45) + 'px'; tooltip.hidden = false;
  }
  function growthMove(event) {
    if (!data) return;
    const point = localPoint(event, growth);
    const padLeft = growthWidth < 520 ? 58 : 75;
    growthSelected = Math.max(0, Math.min(data.points.length - 1, Math.round((point.x - padLeft) / (growthWidth - padLeft - 18) * (data.points.length - 1))));
    const item = data.points[growthSelected];
    growthTooltip.querySelector('time').textContent = 'Age ' + item.age.toFixed(1) + ' · ' + fullDate.format(parseDate(item.date));
    growthTooltip.querySelector('div').innerHTML = ['bandit', 'allocation', 'spy', 'agg', 'balanced', 'contributed'].map(function (key) { return '<span style="--series-color:' + colors[key] + '"><b>' + names[key] + '</b><strong>' + money.format(item[key]) + '</strong></span>'; }).join('');
    placeTooltip(growthTooltip, growthWrap, point.x, point.y); drawGrowth();
  }
  function regimeMove(event) {
    if (!data) return;
    const point = localPoint(event, regime);
    regimeSelected = Math.max(0, Math.min(data.decisions.length - 1, Math.floor((point.x - 42) / (regimeWidth - 54) * data.decisions.length)));
    const item = data.decisions[regimeSelected];
    regimeTooltip.querySelector('time').textContent = 'Age ' + item.age.toFixed(1) + ' · ' + fullDate.format(parseDate(item.start));
    const strongest = Object.keys(item.context).reduce(function (best, key) { return Math.abs(item.context[key]) > Math.abs(item.context[best]) ? key : best; }, Object.keys(item.context)[0]);
    regimeTooltip.querySelector('div').innerHTML = '<strong class="sb-tooltip-choice">' + item.allocation.SPY.toFixed(1) + '% SPY · ' + item.allocation.AGG.toFixed(1) + '% AGG</strong><span><b>Mix return</b><strong>' + signed(item.allocation_return) + '</strong></span><span><b>All-in choice</b><strong>' + item.action + '</strong></span><span><b>Strongest context</b><strong>' + featureNames[strongest] + '</strong></span>';
    placeTooltip(regimeTooltip, regimeWrap, point.x, point.y); drawRegime();
  }
  function leaveGrowth() { growthSelected = -1; growthTooltip.hidden = true; drawGrowth(); }
  function leaveRegime() { regimeSelected = -1; regimeTooltip.hidden = true; drawRegime(); }
  growth.addEventListener('pointermove', growthMove); growth.addEventListener('pointerleave', leaveGrowth);
  regime.addEventListener('pointermove', regimeMove); regime.addEventListener('pointerleave', leaveRegime);
  window.addEventListener('resize', resize, { passive: true });

  fetch(growth.dataset.source).then(function (response) { if (!response.ok) throw new Error('Experiment data unavailable'); return response.json(); }).then(function (payload) {
    if (payload.experiment !== 'stock-bond-contextual-bandit') throw new Error('Unexpected experiment data');
    data = payload; buildInterface(); resize();
  }).catch(function (error) { document.querySelector('#sb-result-note').textContent = error.message; });
}());
