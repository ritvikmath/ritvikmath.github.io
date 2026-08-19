(function () {
  const canvas = document.querySelector('#market-chart');
  const wrap = document.querySelector('#market-chart-wrap');
  const tooltip = document.querySelector('#market-tooltip');
  if (!canvas || !wrap || !tooltip) return;

  const context = canvas.getContext('2d');
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timestampFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });
  const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const numberFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let data = null;
  let selectedIndex = -1;
  let frame = 0;
  let chartWidth = 0;
  let chartHeight = 0;
  let pixelRatio = 1;
  let lastFetchAt = 0;

  function parseDate(value) {
    return new Date(value + 'T00:00:00Z');
  }

  function updateSummary(payload) {
    document.querySelector('#market-date').textContent = dateFormatter.format(parseDate(payload.market_date));
    const refreshed = document.querySelector('#market-refreshed');
    const refreshedAt = new Date(payload.generated_at);
    refreshed.dateTime = payload.generated_at;
    refreshed.textContent = timestampFormatter.format(refreshedAt);
    document.querySelector('#market-latest').textContent = numberFormatter.format(payload.summary.latest);
    const change = document.querySelector('#market-change');
    const positive = payload.summary.change_percent >= 0;
    change.textContent = (positive ? '+' : '') + payload.summary.change_percent.toFixed(2) + '% over the period';
    change.classList.toggle('negative', !positive);
    document.querySelector('#market-low').textContent = numberFormatter.format(payload.summary.low);
    document.querySelector('#market-high').textContent = numberFormatter.format(payload.summary.high);
    document.querySelector('#market-observations').textContent = payload.points.length;
    canvas.setAttribute('aria-label', 'Interactive chart of S&P 500 closing prices from ' +
      dateFormatter.format(parseDate(payload.points[0].date)) + ' through ' +
      dateFormatter.format(parseDate(payload.market_date)) + '. Latest close ' +
      numberFormatter.format(payload.summary.latest) + '.');
  }

  function resizeChart() {
    chartWidth = wrap.clientWidth;
    chartHeight = Math.max(300, Math.min(430, Math.round(chartWidth * 0.48)));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(chartWidth * pixelRatio);
    canvas.height = Math.round(chartHeight * pixelRatio);
    canvas.style.width = chartWidth + 'px';
    canvas.style.height = chartHeight + 'px';
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    requestDraw();
  }

  function requestDraw() {
    if (!frame) frame = window.requestAnimationFrame(drawChart);
  }

  function drawChart() {
    frame = 0;
    context.clearRect(0, 0, chartWidth, chartHeight);
    if (!data) return;
    const points = data.points;
    const padding = { top: 24, right: 22, bottom: 38, left: chartWidth < 520 ? 46 : 64 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const closes = points.map(function (point) { return point.close; });
    const rawMin = Math.min.apply(null, closes);
    const rawMax = Math.max.apply(null, closes);
    const buffer = Math.max(10, (rawMax - rawMin) * 0.12);
    const minimum = rawMin - buffer;
    const maximum = rawMax + buffer;

    function xFor(index) { return padding.left + (index / (points.length - 1)) * plotWidth; }
    function yFor(value) { return padding.top + ((maximum - value) / (maximum - minimum)) * plotHeight; }

    context.font = '10px "DM Mono", monospace';
    context.textBaseline = 'middle';
    for (let step = 0; step <= 4; step += 1) {
      const y = padding.top + (step / 4) * plotHeight;
      const value = maximum - (step / 4) * (maximum - minimum);
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(chartWidth - padding.right, y);
      context.strokeStyle = 'rgba(49, 95, 186, .11)';
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = '#7b8190';
      context.textAlign = 'right';
      context.fillText(Math.round(value).toLocaleString('en-US'), padding.left - 10, y);
    }

    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach(function (index) {
      context.fillStyle = '#7b8190';
      context.textAlign = index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center';
      context.fillText(shortDateFormatter.format(parseDate(points[index].date)), xFor(index), chartHeight - 14);
    });

    const gradient = context.createLinearGradient(0, padding.top, 0, chartHeight - padding.bottom);
    gradient.addColorStop(0, 'rgba(49, 95, 186, .24)');
    gradient.addColorStop(1, 'rgba(49, 95, 186, .015)');
    context.beginPath();
    points.forEach(function (point, index) {
      const x = xFor(index);
      const y = yFor(point.close);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.lineTo(xFor(points.length - 1), chartHeight - padding.bottom);
    context.lineTo(xFor(0), chartHeight - padding.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    points.forEach(function (point, index) {
      const x = xFor(index);
      const y = yFor(point.close);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = '#315fba';
    context.lineWidth = 2.25;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();

    if (selectedIndex >= 0) {
      const selected = points[selectedIndex];
      const x = xFor(selectedIndex);
      const y = yFor(selected.close);
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, chartHeight - padding.bottom);
      context.strokeStyle = 'rgba(217, 108, 84, .45)';
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fillStyle = '#d96c54';
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = '#fffdf8';
      context.stroke();
    }
  }

  function selectPoint(event) {
    if (!data) return;
    const bounds = canvas.getBoundingClientRect();
    const paddingLeft = chartWidth < 520 ? 46 : 64;
    const plotWidth = chartWidth - paddingLeft - 22;
    const relative = Math.max(0, Math.min(1, (event.clientX - bounds.left - paddingLeft) / plotWidth));
    selectedIndex = Math.round(relative * (data.points.length - 1));
    const point = data.points[selectedIndex];
    const x = paddingLeft + (selectedIndex / (data.points.length - 1)) * plotWidth;
    tooltip.querySelector('time').textContent = dateFormatter.format(parseDate(point.date));
    tooltip.querySelector('strong').textContent = numberFormatter.format(point.close);
    tooltip.hidden = false;
    const tooltipWidth = tooltip.offsetWidth;
    tooltip.style.left = Math.max(8, Math.min(chartWidth - tooltipWidth - 8, x - tooltipWidth / 2)) + 'px';
    tooltip.style.top = '12px';
    requestDraw();
  }

  canvas.addEventListener('pointermove', selectPoint);
  canvas.addEventListener('pointerdown', selectPoint);
  canvas.addEventListener('pointerleave', function (event) {
    if (event.pointerType === 'mouse') {
      selectedIndex = -1;
      tooltip.hidden = true;
      requestDraw();
    }
  });
  window.addEventListener('resize', resizeChart, { passive: true });

  function loadMarketData() {
    lastFetchAt = Date.now();
    const baseUrl = canvas.dataset.marketDataUrl || '/assets/data/sp500-3m.json';
    const separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
    const dataUrl = baseUrl + separator + 'refresh=' + lastFetchAt;

    fetch(dataUrl, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Market data request failed');
        return response.json();
      })
      .then(function (payload) {
        data = payload;
        wrap.classList.remove('market-chart-error');
        wrap.removeAttribute('data-error');
        updateSummary(payload);
        resizeChart();
      })
      .catch(function () {
        if (data) return;
        wrap.classList.add('market-chart-error');
        wrap.setAttribute('data-error', 'Market data is temporarily unavailable.');
      });
  }

  window.addEventListener('pageshow', loadMarketData);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - lastFetchAt > 60000) loadMarketData();
  });
}());
