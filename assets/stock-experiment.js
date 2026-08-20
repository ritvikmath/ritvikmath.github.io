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
  const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const colors = { sp500: '#315fba', google: '#d96c54' };
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

  function signedPercent(value) {
    return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
  }

  function seriesById(payload, id) {
    return payload.series.find(function (series) { return series.id === id; });
  }

  function updateResult(id, series) {
    document.querySelector('#' + id + '-value').textContent = moneyFormatter.format(series.latest_value);
    const returnElement = document.querySelector('#' + id + '-return');
    returnElement.textContent = signedPercent(series.return_percent);
    returnElement.classList.toggle('negative', series.return_percent < 0);
  }

  function updateSummary(payload) {
    document.querySelector('#market-date').textContent = dateFormatter.format(parseDate(payload.market_date));
    const refreshed = document.querySelector('#market-refreshed');
    const refreshedAt = new Date(payload.generated_at);
    refreshed.dateTime = payload.generated_at;
    refreshed.textContent = timestampFormatter.format(refreshedAt);

    const sp500 = seriesById(payload, 'sp500');
    const google = seriesById(payload, 'google');
    updateResult('sp500', sp500);
    updateResult('google', google);
    const leader = seriesById(payload, payload.leader);
    document.querySelector('#market-leader').textContent = leader.name;
    document.querySelector('#market-observations').textContent = payload.points.length;
    canvas.setAttribute('aria-label', 'Interactive comparison of $1,000 invested in the S&P 500 and Google from ' +
      dateFormatter.format(parseDate(payload.start_date)) + ' through ' +
      dateFormatter.format(parseDate(payload.market_date)) + '. Current values: S&P 500 ' +
      moneyFormatter.format(sp500.latest_value) + ' and Google ' + moneyFormatter.format(google.latest_value) + '.');
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

  function drawSeries(points, id, xFor, yFor) {
    context.beginPath();
    points.forEach(function (point, index) {
      const x = xFor(index);
      const y = yFor(point[id]);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = colors[id];
    context.lineWidth = 2.4;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
  }

  function drawChart() {
    frame = 0;
    context.clearRect(0, 0, chartWidth, chartHeight);
    if (!data) return;
    const points = data.points;
    const padding = { top: 24, right: 22, bottom: 38, left: chartWidth < 520 ? 54 : 72 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const values = points.reduce(function (all, point) { return all.concat([point.sp500, point.google]); }, []);
    const rawMin = Math.min.apply(null, values);
    const rawMax = Math.max.apply(null, values);
    const buffer = Math.max(8, (rawMax - rawMin) * 0.12);
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
      context.fillText('$' + Math.round(value).toLocaleString('en-US'), padding.left - 10, y);
    }

    const startingY = yFor(data.starting_investment);
    context.beginPath();
    context.moveTo(padding.left, startingY);
    context.lineTo(chartWidth - padding.right, startingY);
    context.setLineDash([5, 5]);
    context.strokeStyle = 'rgba(39, 47, 59, .24)';
    context.stroke();
    context.setLineDash([]);

    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach(function (index) {
      context.fillStyle = '#7b8190';
      context.textAlign = index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center';
      context.fillText(shortDateFormatter.format(parseDate(points[index].date)), xFor(index), chartHeight - 14);
    });

    drawSeries(points, 'sp500', xFor, yFor);
    drawSeries(points, 'google', xFor, yFor);

    if (selectedIndex >= 0) {
      const selected = points[selectedIndex];
      const x = xFor(selectedIndex);
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, chartHeight - padding.bottom);
      context.strokeStyle = 'rgba(39, 47, 59, .3)';
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.stroke();
      context.setLineDash([]);
      ['sp500', 'google'].forEach(function (id) {
        context.beginPath();
        context.arc(x, yFor(selected[id]), 5, 0, Math.PI * 2);
        context.fillStyle = colors[id];
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = '#fffdf8';
        context.stroke();
      });
    }
  }

  function selectPoint(event) {
    if (!data) return;
    const bounds = canvas.getBoundingClientRect();
    const paddingLeft = chartWidth < 520 ? 54 : 72;
    const plotWidth = chartWidth - paddingLeft - 22;
    const relative = Math.max(0, Math.min(1, (event.clientX - bounds.left - paddingLeft) / plotWidth));
    selectedIndex = Math.round(relative * (data.points.length - 1));
    const point = data.points[selectedIndex];
    const x = paddingLeft + (selectedIndex / (data.points.length - 1)) * plotWidth;
    tooltip.querySelector('time').textContent = dateFormatter.format(parseDate(point.date));
    tooltip.querySelector('.tooltip-sp500 strong').textContent = moneyFormatter.format(point.sp500);
    tooltip.querySelector('.tooltip-google strong').textContent = moneyFormatter.format(point.google);
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
        if (!payload.series || !payload.points || typeof payload.points[0].sp500 !== 'number') {
          throw new Error('Market data has an unsupported format');
        }
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
