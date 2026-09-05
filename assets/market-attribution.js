(function () {
  const canvas = document.querySelector('#attribution-chart');
  if (!canvas) return;
  const wrap = document.querySelector('#attribution-chart-wrap');
  const tooltip = document.querySelector('#attribution-tooltip');
  const context = canvas.getContext('2d');
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  let data;
  let bars = [];
  let width = 0;
  let height = 470;
  let ratio = 1;
  let selected = -1;

  function date(value) { return dateFormat.format(new Date(value + 'T00:00:00Z')); }
  function signed(value, digits) { return (value >= 0 ? '+' : '') + value.toFixed(digits) + (digits === 1 ? ' bps' : '%'); }

  function buildInterface() {
    const s = data.snapshot;
    document.querySelector('#attribution-period').textContent = date(s.prior_date) + ' → ' + date(s.date);
    document.querySelector('#attribution-summary').innerHTML = [
      ['SPY return', signed(s.spy_return_pct, 2)],
      ['Stocks up', s.advancers + ' of ' + s.covered_holdings],
      ['Positive push', signed(s.positive_bps, 1)],
      ['Negative pull', signed(s.negative_bps, 1)]
    ].map(function (item, index) { return '<article' + (index === 0 ? ' class="featured"' : '') + '><span>' + item[0] + '</span><strong>' + item[1] + '</strong></article>'; }).join('');
    const topTwo = data.top_positive[0].contribution_bps + data.top_positive[1].contribution_bps;
    document.querySelector('#attribution-verdict').innerHTML = '<strong>The literal answer:</strong> ' + s.advancers + ' securities added ' + s.positive_bps.toFixed(1) + ' basis points while ' + s.decliners + ' removed ' + Math.abs(s.negative_bps).toFixed(1) + '. Microsoft and Nvidia alone added ' + topTwo.toFixed(1) + ' basis points. The reconstructed basket finished at ' + signed(s.basket_return_pct, 2) + ', only ' + Math.abs(s.residual_bps).toFixed(1) + ' basis points from SPY.';
    function rows(items) {
      return items.slice(0, 6).map(function (item) { return '<article><div><strong>' + item.ticker + '</strong><span>' + item.name + '</span></div><span>' + item.weight_pct.toFixed(2) + '% weight</span><b class="' + (item.contribution_bps >= 0 ? 'positive' : 'negative') + '">' + signed(item.contribution_bps, 1) + '</b></article>'; }).join('');
    }
    document.querySelector('#attribution-positive-table').innerHTML = rows(data.top_positive);
    document.querySelector('#attribution-negative-table').innerHTML = rows(data.top_negative);
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = wrap.clientWidth;
    height = width < 560 ? 540 : 470;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    if (!data) return;
    bars = data.top_negative.slice(0, 10).reverse().concat(data.top_positive.slice(0, 10));
    const mobile = width < 560;
    const pad = { top: 24, right: mobile ? 18 : 34, bottom: 38, left: mobile ? 51 : 72 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const max = Math.max.apply(null, bars.map(function (item) { return Math.abs(item.contribution_bps); })) * 1.12;
    const zero = pad.left + plotWidth * 0.36;
    const negativeWidth = plotWidth * 0.34;
    const positiveWidth = plotWidth * 0.62;
    const row = plotHeight / bars.length;
    context.font = (mobile ? '8px' : '9px') + ' "DM Mono", monospace';
    context.textBaseline = 'middle';
    context.strokeStyle = 'rgba(25,37,59,.20)'; context.beginPath(); context.moveTo(zero, pad.top - 5); context.lineTo(zero, height - pad.bottom + 5); context.stroke();
    bars.forEach(function (item, index) {
      const y = pad.top + row * index + row / 2;
      const scale = item.contribution_bps < 0 ? negativeWidth : positiveWidth;
      const length = Math.abs(item.contribution_bps) / max * scale;
      const x = item.contribution_bps < 0 ? zero - length : zero;
      context.fillStyle = item.contribution_bps < 0 ? '#d96c54' : '#3f8b68';
      context.globalAlpha = selected < 0 || selected === index ? 0.94 : 0.28;
      context.fillRect(x, y - Math.max(4, row * 0.27), length, Math.max(8, row * 0.54));
      context.globalAlpha = 1;
      context.fillStyle = '#5f6671';
      context.textAlign = 'right'; context.fillText(item.ticker, zero - 7, y);
      if (!mobile || Math.abs(item.contribution_bps) > 2) {
        context.textAlign = 'left'; context.fillText(signed(item.contribution_bps, 1), zero + 7, y);
      }
    });
    context.fillStyle = '#7b8190'; context.textAlign = 'left'; context.fillText('← subtracted', pad.left, height - 14);
    context.textAlign = 'right'; context.fillText('added →', width - pad.right, height - 14);
  }

  function select(event) {
    if (!data) return;
    const rect = canvas.getBoundingClientRect();
    const top = 24; const bottom = 38; const row = (height - top - bottom) / bars.length;
    selected = Math.max(0, Math.min(bars.length - 1, Math.floor((event.clientY - rect.top - top) / row)));
    const item = bars[selected];
    tooltip.querySelector('strong').textContent = item.name + ' (' + item.ticker + ')';
    tooltip.querySelector('div').innerHTML = '<span>Opening weight <b>' + item.weight_pct.toFixed(2) + '%</b></span><span>Stock return <b>' + signed(item.return_pct, 2) + '</b></span><span>Market contribution <b>' + signed(item.contribution_bps, 1) + '</b></span>';
    tooltip.hidden = false;
    tooltip.style.left = Math.max(8, Math.min(width - tooltip.offsetWidth - 8, event.clientX - rect.left + 14)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(height - tooltip.offsetHeight - 8, event.clientY - rect.top - 20)) + 'px';
    draw();
  }

  canvas.addEventListener('pointermove', select);
  canvas.addEventListener('pointerdown', select);
  canvas.addEventListener('pointerleave', function (event) { if (event.pointerType === 'touch') return; selected = -1; tooltip.hidden = true; draw(); });
  window.addEventListener('resize', resize);
  fetch(canvas.dataset.source, { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('Could not load data'); return response.json(); }).then(function (payload) { data = payload; buildInterface(); resize(); }).catch(function () { document.querySelector('#attribution-verdict').textContent = 'The frozen attribution data could not be loaded.'; });
}());
