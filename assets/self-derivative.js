(function () {
  const canvas = document.querySelector('#derivative-chart');
  const control = document.querySelector('#lambda-control');
  const value = document.querySelector('#lambda-value');
  const reading = document.querySelector('#lambda-reading');
  if (!canvas || !control) return;

  const context = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  let width = 0;
  let height = 310;
  let ratio = 1;

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = wrap.clientWidth;
    height = width < 520 ? 260 : 310;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function drawCurve(lambda, multiplier, color, dash) {
    const pad = { top: 24, right: 24, bottom: 38, left: 47 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const minimumX = -2;
    const maximumX = 1.25;
    const maximumY = 8;
    context.beginPath();
    for (let step = 0; step <= 180; step += 1) {
      const xValue = minimumX + (maximumX - minimumX) * step / 180;
      const yValue = multiplier * Math.exp(lambda * xValue);
      const x = pad.left + step / 180 * plotWidth;
      const y = pad.top + (maximumY - yValue) / maximumY * plotHeight;
      if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.setLineDash(dash);
    context.stroke();
    context.setLineDash([]);
  }

  function draw() {
    const lambda = Number(control.value);
    context.clearRect(0, 0, width, height);
    const pad = { top: 24, right: 24, bottom: 38, left: 47 };
    context.strokeStyle = 'rgba(49,95,186,.11)';
    context.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
      const y = pad.top + i / 5 * (height - pad.top - pad.bottom);
      context.beginPath(); context.moveTo(pad.left, y); context.lineTo(width - pad.right, y); context.stroke();
    }
    context.strokeStyle = 'rgba(23,34,56,.45)';
    context.beginPath(); context.moveTo(pad.left, pad.top); context.lineTo(pad.left, height - pad.bottom); context.lineTo(width - pad.right, height - pad.bottom); context.stroke();
    drawCurve(lambda, 1, '#172238', []);
    drawCurve(lambda, lambda, '#cf6553', [9, 7]);
    context.font = '11px "DM Mono", monospace';
    context.fillStyle = '#172238'; context.fillText('fλ(x)', width - 88, 30);
    context.fillStyle = '#cf6553'; context.fillText("fλ′(x)", width - 88, 49);
    value.textContent = lambda.toFixed(2);
    if (Math.abs(lambda - 1) < 0.001) reading.textContent = 'The derivative is exactly the function.';
    else if (lambda < 1) reading.textContent = 'The derivative is ' + lambda.toFixed(2) + ' times the function.';
    else reading.textContent = 'The derivative is ' + lambda.toFixed(2) + ' times the function.';
  }

  control.addEventListener('input', draw);
  window.addEventListener('resize', resize, { passive: true });
  resize();
}());
