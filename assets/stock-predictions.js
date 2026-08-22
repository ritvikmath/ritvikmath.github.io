(function () {
  const chart = document.querySelector('#prediction-accuracy-chart');
  const wrap = document.querySelector('#prediction-chart-wrap');
  const tooltip = document.querySelector('#prediction-tooltip');
  if (!chart || !wrap || !tooltip) return;

  const context = chart.getContext('2d');
  const classColors = ['#b95b52', '#d69a69', '#62a58b', '#2e7c61'];
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timestampFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  let data = null;
  let width = 0;
  let height = 330;
  let ratio = 1;
  let selected = -1;
  let frame = 0;

  function parseDate(value) { return new Date(value + 'T00:00:00Z'); }
  function pct(value) { return value.toFixed(1) + '%'; }

  function metricCard(label, value, note, featured) {
    return '<div class="prediction-metric' + (featured ? ' prediction-metric-featured' : '') + '"><span>' + label + '</span><strong>' + value + '</strong><small>' + note + '</small></div>';
  }

  function renderMetrics() {
    const metrics = data.metrics;
    document.querySelector('#prediction-metrics').innerHTML =
      metricCard('Balanced accuracy', pct(metrics.balanced_accuracy), 'equal weight for all 4 classes', true) +
      metricCard('Exact category', pct(metrics.accuracy), 'one of four labels correct') +
      metricCard('Up or down', pct(metrics.direction_accuracy), 'direction correct') +
      metricCard('Majority baseline', pct(metrics.majority_accuracy), 'always guess the common class');
    const lift = metrics.balanced_accuracy - 25;
    const directionGap = Math.abs(metrics.direction_accuracy - 50);
    const directionVerdict = directionGap < 0.1 ? 'effectively a coin flip' : 'only ' + directionGap.toFixed(1) + ' point' + (directionGap.toFixed(1) === '1.0' ? '' : 's') + ' from a coin flip';
    document.querySelector('#prediction-verdict').innerHTML = '<strong>Bottom line:</strong> the four-way model scores ' + lift.toFixed(1) + ' points above balanced chance, but its up-or-down result is ' + directionVerdict + '. That is interesting evidence of a small classification pattern—not a dependable trading edge.';
  }

  function renderForecasts() {
    const grid = document.querySelector('#forecast-grid');
    grid.innerHTML = '';
    data.current_predictions.forEach(function (item) {
      const card = document.createElement('article');
      card.className = 'forecast-card forecast-class-' + item.class_id;
      const probabilities = item.probabilities.map(function (value, index) {
        return '<span style="--probability:' + value + '%;--class-color:' + classColors[index] + '"><i></i><b>' + data.classes[index].name.replace('Very ', 'V. ') + '</b><em>' + pct(value) + '</em></span>';
      }).join('');
      card.innerHTML = '<header><span>' + item.symbol + '</span><small>' + item.name + '</small></header><strong>' + item.prediction + '</strong><p>' + pct(item.confidence) + ' model confidence</p><div class="forecast-probabilities">' + probabilities + '</div>';
      grid.appendChild(card);
    });
  }

  function renderConfusion() {
    const matrix = document.querySelector('#confusion-matrix');
    matrix.innerHTML = '<span></span>' + data.classes.map(function (item) { return '<b>' + item.name.replace('Very ', 'V. ') + '</b>'; }).join('');
    data.confusion_matrix_percent.forEach(function (row, rowIndex) {
      matrix.insertAdjacentHTML('beforeend', '<b>' + data.classes[rowIndex].name.replace('Very ', 'V. ') + '</b>');
      row.forEach(function (value, columnIndex) {
        const strength = Math.min(1, value / 65);
        matrix.insertAdjacentHTML('beforeend', '<span class="matrix-cell' + (rowIndex === columnIndex ? ' matrix-correct' : '') + '" style="--strength:' + strength + '"><strong>' + value.toFixed(1) + '%</strong><small>' + data.confusion_matrix[rowIndex][columnIndex] + '</small></span>');
      });
    });
  }

  function renderStockAccuracy() {
    const container = document.querySelector('#stock-accuracy-bars');
    container.innerHTML = '';
    data.per_stock.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'stock-accuracy-row';
      row.innerHTML = '<strong>' + item.symbol + '</strong><div><span style="width:' + item.accuracy + '%"></span><i style="width:' + item.direction_accuracy + '%"></i></div><small>' + pct(item.accuracy) + ' / ' + pct(item.direction_accuracy) + '</small>';
      container.appendChild(row);
    });
  }

  function renderImportance() {
    const container = document.querySelector('#feature-importance');
    const maximum = Math.max.apply(null, data.feature_importance.map(function (item) { return item.importance; }).concat([0.001]));
    container.innerHTML = '<h3>Held-out permutation importance</h3><p>Drop in balanced accuracy when shuffled</p>';
    data.feature_importance.slice(0, 10).forEach(function (item, index) {
      const row = document.createElement('div');
      row.className = 'importance-row';
      row.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + '</span><strong>' + item.label + '</strong><div><i style="width:' + (item.importance / maximum * 100) + '%"></i></div><small>' + item.importance.toFixed(2) + ' pts</small>';
      container.appendChild(row);
    });
  }

  function resize() {
    width = Math.max(280, Math.floor(wrap.getBoundingClientRect().width));
    height = width < 520 ? 285 : 330;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    chart.width = Math.round(width * ratio);
    chart.height = Math.round(height * ratio);
    chart.style.width = width + 'px';
    chart.style.height = height + 'px';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    requestDraw();
  }

  function geometry() {
    const padding = { top: 24, right: 18, bottom: 42, left: width < 520 ? 48 : 62 };
    return { padding: padding, plotWidth: width - padding.left - padding.right, plotHeight: height - padding.top - padding.bottom };
  }

  function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }

  function draw() {
    frame = 0;
    context.clearRect(0, 0, width, height);
    if (!data) return;
    const points = data.accuracy_history;
    const geo = geometry();
    const minimum = 20;
    const maximum = 75;
    const xFor = function (index) { return geo.padding.left + index / (points.length - 1) * geo.plotWidth; };
    const yFor = function (value) { return geo.padding.top + (maximum - value) / (maximum - minimum) * geo.plotHeight; };
    context.font = '10px "DM Mono", monospace';
    context.textBaseline = 'middle';
    [25, 40, 55, 70].forEach(function (value) {
      const y = yFor(value);
      context.beginPath(); context.moveTo(geo.padding.left, y); context.lineTo(width - geo.padding.right, y);
      context.strokeStyle = value === 25 ? 'rgba(217,108,84,.38)' : 'rgba(49,95,186,.1)';
      context.setLineDash(value === 25 ? [5, 5] : []); context.stroke(); context.setLineDash([]);
      context.fillStyle = '#7b8190'; context.textAlign = 'right'; context.fillText(value + '%', geo.padding.left - 8, y);
    });
    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach(function (index) {
      context.fillStyle = '#7b8190'; context.textAlign = index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center';
      context.fillText(dateFormatter.format(parseDate(points[index].date)).replace(/, \d{4}/, ''), xFor(index), height - 14);
    });
    [{ key: 'direction_accuracy', color: '#3f8b68', width: 2.2 }, { key: 'accuracy', color: '#315fba', width: 3.2 }].forEach(function (line) {
      context.beginPath();
      points.forEach(function (point, index) { const x = xFor(index); const y = yFor(point[line.key]); if (!index) context.moveTo(x, y); else context.lineTo(x, y); });
      context.strokeStyle = line.color; context.lineWidth = line.width; context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke();
    });
    if (selected >= 0) {
      const x = xFor(selected); context.beginPath(); context.moveTo(x, geo.padding.top); context.lineTo(x, height - geo.padding.bottom);
      context.strokeStyle = 'rgba(23,32,51,.35)'; context.setLineDash([4, 4]); context.stroke(); context.setLineDash([]);
    }
  }

  function selectPoint(event) {
    if (!data) return;
    const bounds = chart.getBoundingClientRect();
    const geo = geometry();
    const relative = Math.max(0, Math.min(1, (event.clientX - bounds.left - geo.padding.left) / geo.plotWidth));
    selected = Math.round(relative * (data.accuracy_history.length - 1));
    const point = data.accuracy_history[selected];
    tooltip.querySelector('time').textContent = dateFormatter.format(parseDate(point.date));
    tooltip.querySelector('[data-value="accuracy"]').textContent = pct(point.accuracy);
    tooltip.querySelector('[data-value="direction_accuracy"]').textContent = pct(point.direction_accuracy);
    tooltip.hidden = false;
    const left = geo.padding.left + selected / (data.accuracy_history.length - 1) * geo.plotWidth;
    tooltip.style.left = Math.max(8, Math.min(width - 190, left - 90)) + 'px';
    tooltip.style.top = '12px';
    requestDraw();
  }

  chart.addEventListener('pointermove', selectPoint);
  chart.addEventListener('pointerdown', selectPoint);
  chart.addEventListener('pointerleave', function () { selected = -1; tooltip.hidden = true; requestDraw(); });
  window.addEventListener('resize', resize, { passive: true });

  fetch('/assets/data/stock-direction-xgb.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('Prediction data unavailable'); return response.json(); })
    .then(function (payload) {
      if (payload.experiment !== 'stock-direction-xgboost') throw new Error('Unexpected prediction dataset');
      data = payload;
      document.querySelector('#prediction-market-date').textContent = dateFormatter.format(parseDate(data.market_date));
      document.querySelector('#prediction-generated-at').textContent = timestampFormatter.format(new Date(data.generated_at));
      renderMetrics(); renderForecasts(); renderConfusion(); renderStockAccuracy(); renderImportance(); resize();
    })
    .catch(function (error) {
      document.querySelector('#prediction-metrics').innerHTML = '<p class="market-source">' + error.message + '</p>';
    });
}());
