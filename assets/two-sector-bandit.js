(function () {
  const chart = document.querySelector('#two-stock-chart');
  const allocationChart = document.querySelector('#two-stock-allocation-chart');
  if (!chart || !allocationChart) return;

  const chartWrap = document.querySelector('#two-stock-chart-wrap');
  const allocationWrap = document.querySelector('#two-stock-allocation-wrap');
  const tooltip = document.querySelector('#two-stock-tooltip');
  const allocationTooltip = document.querySelector('#two-stock-allocation-tooltip');
  const context = chart.getContext('2d');
  const allocationContext = allocationChart.getContext('2d');
  const colors = { bandit: '#19253b', panic: '#d96c54', fomo: '#9f765d', dip: '#378b72', xlk: '#315fba', xlv: '#d96c54', xle: '#b88922', xlf: '#378b72', xlp: '#8266a8' };
  const names = { bandit: 'Contextual allocator', panic: 'Panic seller', fomo: 'Performance chaser', dip: 'Dip buyer' };
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  let data;
  let ratio = 1;
  let width = 0;
  let height = 420;
  let allocationWidth = 0;
  let allocationHeight = 230;
  let selected = -1;
  let selectedAllocation = -1;

  function parseDate(value) { return new Date(value + 'T00:00:00Z'); }
  function signed(value) { return (value >= 0 ? '+' : '') + value.toFixed(2) + '%'; }
  function setupCanvas(canvas, drawingContext, canvasWidth, canvasHeight) {
    canvas.width = Math.round(canvasWidth * ratio); canvas.height = Math.round(canvasHeight * ratio);
    canvas.style.width = canvasWidth + 'px'; canvas.style.height = canvasHeight + 'px';
    drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function buildInterface() {
    document.querySelector('#two-stock-date').textContent = date.format(parseDate(data.market_date));
    const keys = ['bandit', 'panic', 'fomo', 'dip'];
    document.querySelector('#two-stock-scorecards').innerHTML = keys.map(function (key) {
      const item = data.summary[key];
      return '<article style="--series-color:' + colors[key] + '"><span>' + item.label + '</span><strong>' + money.format(item.final_value) + '</strong><small>' + signed(item.return_percent) + '</small></article>';
    }).join('');
    document.querySelector('#two-stock-key').innerHTML = keys.map(function (key) { return '<span style="--series-color:' + colors[key] + '">' + names[key] + '</span>'; }).join('');
    const bandit = data.summary.bandit;
    const panic = data.summary.panic;
    const fomo = data.summary.fomo;
    const dip = data.summary.dip;
    document.querySelector('#two-stock-verdict').innerHTML = '<strong>The result:</strong> the dip buyer finished ' + money.format(dip.final_value - bandit.final_value) + ' ahead of the model, and the performance chaser finished ' + money.format(fomo.final_value - bandit.final_value) + ' ahead. The model still beat the panic seller by ' + money.format(bandit.final_value - panic.final_value) + '. Two years is enough to compare these runs, but not enough to declare one rule the permanent winner.';
    document.querySelector('#two-stock-facts').innerHTML = '<span><strong>5</strong> sector funds</span><span><strong>' + data.decisions.length + '</strong> weekly choices</span><span><strong>' + data.maximum_weekly_move.toFixed(1) + ' points</strong> largest weekly move</span><span><strong>' + money.format(data.total_cost) + '</strong> model trading cost</span>';
    document.querySelector('#two-stock-allocation-key').innerHTML = data.assets.map(function (asset) { return '<span style="--series-color:' + colors[asset.id] + '">' + asset.symbol + ' · ' + asset.sector + '</span>'; }).join('');
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = chartWrap.clientWidth; height = Math.max(340, Math.min(480, Math.round(width * 0.54)));
    allocationWidth = allocationWrap.clientWidth; allocationHeight = allocationWidth < 560 ? 260 : 220;
    setupCanvas(chart, context, width, height);
    setupCanvas(allocationChart, allocationContext, allocationWidth, allocationHeight);
    drawChart(); drawAllocation();
  }

  function drawChart() {
    context.clearRect(0, 0, width, height);
    if (!data) return;
    const keys = ['bandit', 'panic', 'fomo', 'dip'];
    const points = data.points;
    const values = points.flatMap(function (point) { return keys.map(function (key) { return point[key]; }); });
    const minimum = Math.min.apply(null, values) * 0.96;
    const maximum = Math.max.apply(null, values) * 1.04;
    const pad = { top: 22, right: 18, bottom: 42, left: width < 520 ? 58 : 72 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const x = function (index) { return pad.left + index / (points.length - 1) * plotWidth; };
    const y = function (value) { return pad.top + (maximum - value) / (maximum - minimum) * plotHeight; };
    context.font = '10px "DM Mono", monospace'; context.textBaseline = 'middle';
    for (let step = 0; step <= 4; step += 1) {
      const value = maximum - step / 4 * (maximum - minimum); const py = pad.top + step / 4 * plotHeight;
      context.strokeStyle = 'rgba(40,55,77,.10)'; context.lineWidth = 1; context.beginPath(); context.moveTo(pad.left, py); context.lineTo(width - pad.right, py); context.stroke();
      context.fillStyle = '#7b8190'; context.textAlign = 'right'; context.fillText(money.format(value), pad.left - 9, py);
    }
    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach(function (index) {
      context.fillStyle = '#7b8190'; context.textAlign = index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center'; context.fillText(date.format(parseDate(points[index].date)), x(index), height - 15);
    });
    keys.forEach(function (key) {
      context.beginPath(); points.forEach(function (point, index) { if (index === 0) context.moveTo(x(index), y(point[key])); else context.lineTo(x(index), y(point[key])); });
      context.strokeStyle = colors[key]; context.lineWidth = key === 'bandit' ? 3.4 : 2.1; context.globalAlpha = key === 'bandit' ? 1 : 0.9; context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke(); context.globalAlpha = 1;
    });
    if (selected >= 0) {
      const point = points[selected]; const px = x(selected);
      context.strokeStyle = 'rgba(25,37,59,.25)'; context.lineWidth = 1; context.beginPath(); context.moveTo(px, pad.top); context.lineTo(px, pad.top + plotHeight); context.stroke();
      keys.forEach(function (key) { context.fillStyle = colors[key]; context.beginPath(); context.arc(px, y(point[key]), key === 'bandit' ? 4 : 3, 0, Math.PI * 2); context.fill(); });
    }
  }

  function drawAllocation() {
    allocationContext.clearRect(0, 0, allocationWidth, allocationHeight);
    if (!data) return;
    const decisions = data.decisions; const assetIds = data.assets.map(function (asset) { return asset.id; }); const pad = { top: 18, right: 14, bottom: 38, left: 45 };
    const plotWidth = allocationWidth - pad.left - pad.right; const plotHeight = allocationHeight - pad.top - pad.bottom;
    const x = function (index) { return pad.left + index / (decisions.length - 1) * plotWidth; };
    const y = function (weight) { return pad.top + (100 - weight) / 100 * plotHeight; };
    [0, 50, 100].forEach(function (value) { const py = y(value); allocationContext.strokeStyle = 'rgba(40,55,77,.10)'; allocationContext.beginPath(); allocationContext.moveTo(pad.left, py); allocationContext.lineTo(allocationWidth - pad.right, py); allocationContext.stroke(); allocationContext.fillStyle = '#7b8190'; allocationContext.font = '10px "DM Mono", monospace'; allocationContext.textAlign = 'right'; allocationContext.fillText(value + '%', pad.left - 8, py + 3); });
    assetIds.forEach(function (asset) {
      allocationContext.beginPath(); decisions.forEach(function (item, index) { const px = x(index), py = y(item.weights[asset]); if (index === 0) allocationContext.moveTo(px, py); else allocationContext.lineTo(px, py); });
      allocationContext.strokeStyle = colors[asset]; allocationContext.lineWidth = 2.4; allocationContext.lineJoin = 'round'; allocationContext.stroke();
      if (selectedAllocation >= 0) { allocationContext.fillStyle = colors[asset]; allocationContext.beginPath(); allocationContext.arc(x(selectedAllocation), y(decisions[selectedAllocation].weights[asset]), 4, 0, Math.PI * 2); allocationContext.fill(); }
    });
    if (selectedAllocation >= 0) {
      const px = x(selectedAllocation);
      allocationContext.strokeStyle = 'rgba(25,37,59,.28)'; allocationContext.lineWidth = 1;
      allocationContext.beginPath(); allocationContext.moveTo(px, pad.top); allocationContext.lineTo(px, pad.top + plotHeight); allocationContext.stroke();
    }
    allocationContext.fillStyle = '#7b8190'; allocationContext.textAlign = 'left'; allocationContext.fillText('Share of the model portfolio', pad.left, allocationHeight - 14);
  }

  function selectPoint(event) {
    if (!data) return;
    const rect = chart.getBoundingClientRect(); const padLeft = width < 520 ? 58 : 72; const plotWidth = width - padLeft - 18;
    selected = Math.max(0, Math.min(data.points.length - 1, Math.round(((event.clientX - rect.left - padLeft) / plotWidth) * (data.points.length - 1))));
    const point = data.points[selected];
    tooltip.querySelector('time').textContent = date.format(parseDate(point.date));
    tooltip.querySelector('div').innerHTML = ['bandit', 'panic', 'fomo', 'dip'].map(function (key) { return '<span><i style="background:' + colors[key] + '"></i>' + names[key] + ' <strong>' + money.format(point[key]) + '</strong></span>'; }).join('');
    tooltip.hidden = false; tooltip.style.left = Math.max(8, Math.min(width - tooltip.offsetWidth - 8, event.clientX - rect.left + 12)) + 'px'; tooltip.style.top = '18px'; drawChart();
  }

  function selectAllocation(event) {
    if (!data) return;
    const rect = allocationChart.getBoundingClientRect();
    const padLeft = 45;
    const plotWidth = allocationWidth - padLeft - 14;
    selectedAllocation = Math.max(0, Math.min(data.decisions.length - 1, Math.round(((event.clientX - rect.left - padLeft) / plotWidth) * (data.decisions.length - 1))));
    const item = data.decisions[selectedAllocation];
    allocationTooltip.querySelector('time').textContent = date.format(parseDate(item.date)) + ' allocation';
    allocationTooltip.querySelector('div').innerHTML = data.assets.map(function (asset) {
      return '<span><i style="background:' + colors[asset.id] + '"></i>' + asset.symbol + ' <strong>' + item.weights[asset.id].toFixed(1) + '%</strong></span>';
    }).join('') + '<span>Portfolio return that week <strong>' + signed(item.weekly_return) + '</strong></span>';
    allocationTooltip.hidden = false;
    const desiredLeft = event.clientX - rect.left + 12;
    allocationTooltip.style.left = Math.max(8, Math.min(allocationWidth - allocationTooltip.offsetWidth - 8, desiredLeft)) + 'px';
    allocationTooltip.style.top = '12px';
    drawAllocation();
  }

  chart.addEventListener('pointermove', selectPoint);
  chart.addEventListener('pointerleave', function () { selected = -1; tooltip.hidden = true; drawChart(); });
  allocationChart.addEventListener('pointermove', selectAllocation);
  allocationChart.addEventListener('pointerdown', selectAllocation);
  allocationChart.addEventListener('pointerleave', function (event) {
    if (event.pointerType === 'touch') return;
    selectedAllocation = -1; allocationTooltip.hidden = true; drawAllocation();
  });
  window.addEventListener('resize', resize);
  fetch(chart.dataset.source, { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('Could not load experiment data'); return response.json(); }).then(function (payload) {
    if (payload.experiment !== 'five-sector-behavioral-bandit') throw new Error('Unexpected experiment data');
    data = payload; buildInterface(); resize();
  }).catch(function () { document.querySelector('#two-stock-verdict').textContent = 'The frozen experiment data could not be loaded.'; });
}());
