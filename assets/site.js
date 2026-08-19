(function () {
  const search = document.querySelector('#archive-search');
  const cards = Array.from(document.querySelectorAll('.post-card'));
  const filters = Array.from(document.querySelectorAll('.filter'));
  const methodFilter = document.querySelector('#method-filter');
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#no-results');
  let activeFilter = 'all';

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function queryTerms() {
    const value = normalize(search ? search.value : '');
    return value ? value.split(/\s+/) : [];
  }

  function cardMatchesTopic(card) {
    return activeFilter === 'all' || card.dataset.category === activeFilter ||
      (activeFilter === 'authors-choice' && card.dataset.authorsChoice === 'true');
  }

  function cardMatchesMethod(card) {
    if (!methodFilter || methodFilter.value === 'all') return true;
    return (card.dataset.methods || '').split('|').some(function (method) {
      return normalize(method) === methodFilter.value;
    });
  }

  function cardMatchesSearch(card, terms) {
    const searchable = normalize(card.dataset.search);
    return !terms.length || terms.every(function (term) { return searchable.indexOf(term) !== -1; });
  }

  function updateArchive() {
    if (!search) return;
    const terms = queryTerms();
    let visible = 0;
    cards.forEach(function (card) {
      const show = cardMatchesTopic(card) && cardMatchesMethod(card) && cardMatchesSearch(card, terms);
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (count) count.textContent = visible;
    if (empty) empty.hidden = visible !== 0;
  }

  if (search) {
    search.addEventListener('input', updateArchive);
    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.focus();
      }
    });
  }

  filters.forEach(function (button) {
    button.addEventListener('click', function () {
      activeFilter = button.dataset.filter;
      filters.forEach(function (item) {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      updateArchive();
    });
  });

  if (methodFilter) methodFilter.addEventListener('change', updateArchive);

  const randomRelated = Array.from(document.querySelectorAll('.random-related-candidate'));
  if (randomRelated.length) {
    const randomIndex = Math.floor(Math.random() * randomRelated.length);
    randomRelated[randomIndex].hidden = false;
  }

  const progress = document.querySelector('#reading-progress-bar');
  if (progress) {
    function updateProgress() {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const value = available > 0 ? Math.min(100, (window.scrollY / available) * 100) : 0;
      progress.style.width = value + '%';
    }
    document.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  const graphHint = document.querySelector('#graph-play-hint');
  const graphSurface = document.querySelector('#analyses');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (cards.length && graphSurface && !reducedMotion.matches) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const maxNodes = 12;
    const maxConnections = 20;
    const clickCooldown = 180;
    const inactivityDelay = 9000;
    const fadeDuration = 2800;
    const strokeDuration = 520;
    const nodeDuration = 260;
    let nodes = [];
    let connections = [];
    let frame = 0;
    let lastClick = 0;
    let inactivityTimer = 0;
    let fadeStarted = 0;
    let pixelRatio = 1;
    let viewportWidth = 0;
    let viewportHeight = 0;

    canvas.className = 'graph-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    graphSurface.appendChild(canvas);

    function sizeCanvas() {
      const nextWidth = window.innerWidth;
      const nextHeight = graphSurface.scrollHeight;
      if (viewportWidth && viewportHeight && nodes.length) {
        const widthScale = nextWidth / viewportWidth;
        const heightScale = nextHeight / viewportHeight;
        nodes.forEach(function (node) {
          node.x *= widthScale;
          node.y *= heightScale;
        });
      }
      viewportWidth = nextWidth;
      viewportHeight = nextHeight;
      const safeRatio = Math.sqrt(8000000 / Math.max(1, nextWidth * nextHeight));
      pixelRatio = Math.min(window.devicePixelRatio || 1, safeRatio, 2);
      canvas.width = Math.round(nextWidth * pixelRatio);
      canvas.height = Math.round(nextHeight * pixelRatio);
      canvas.style.width = nextWidth + 'px';
      canvas.style.height = nextHeight + 'px';
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      requestDraw();
    }

    function clearGraph() {
      nodes = [];
      connections = [];
      fadeStarted = 0;
      window.clearTimeout(inactivityTimer);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      context.clearRect(0, 0, viewportWidth, viewportHeight);
    }

    function beginFade() {
      if (nodes.length) {
        fadeStarted = performance.now();
        requestDraw();
      }
    }

    function requestDraw() {
      if (!frame) frame = window.requestAnimationFrame(drawGraph);
    }

    function drawGraph(now) {
      frame = 0;
      context.clearRect(0, 0, viewportWidth, viewportHeight);
      connections = connections.filter(function (connection) { return !connection.retiredAt || now - connection.retiredAt < fadeDuration; });
      nodes = nodes.filter(function (node) { return !node.retiredAt || now - node.retiredAt < fadeDuration; });
      if (!nodes.length) return;
      const opacity = fadeStarted ? Math.max(0, 1 - ((now - fadeStarted) / fadeDuration)) : 1;
      if (opacity <= 0) {
        clearGraph();
        return;
      }

      let animating = false;
      context.lineWidth = 1.35;
      connections.forEach(function (connection) {
        const retirementOpacity = connection.retiredAt ? Math.max(0, 1 - ((now - connection.retiredAt) / fadeDuration)) : 1;
        const progress = Math.max(0, Math.min(1, (now - connection.born) / strokeDuration));
        const eased = 1 - Math.pow(1 - progress, 3);
        const startY = connection.from.y;
        const endX = connection.from.x + ((connection.to.x - connection.from.x) * eased);
        const endY = startY + ((connection.to.y - connection.from.y) * eased);
        context.beginPath();
        context.moveTo(connection.from.x, startY);
        context.lineTo(endX, endY);
        context.strokeStyle = 'rgba(49, 95, 186, ' + (0.24 * opacity * retirementOpacity) + ')';
        context.stroke();
        if (progress < 1 || connection.retiredAt) animating = true;
      });
      nodes.forEach(function (node, index) {
        const retirementOpacity = node.retiredAt ? Math.max(0, 1 - ((now - node.retiredAt) / fadeDuration)) : 1;
        const progress = Math.max(0, Math.min(1, (now - node.born) / nodeDuration));
        const eased = 1 - Math.pow(1 - progress, 3);
        const targetRadius = index === nodes.length - 1 ? 7 : 5.8;
        context.beginPath();
        context.arc(node.x, node.y, targetRadius * eased, 0, Math.PI * 2);
        context.fillStyle = index === nodes.length - 1 ?
          'rgba(205, 89, 82, ' + (0.72 * opacity * retirementOpacity) + ')' :
          'rgba(49, 95, 186, ' + (0.62 * opacity * retirementOpacity) + ')';
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = 'rgba(255, 253, 248, ' + (0.9 * opacity * retirementOpacity) + ')';
        context.stroke();
        if (progress < 1 || node.retiredAt) animating = true;
      });
      if (fadeStarted || animating) requestDraw();
    }

    function canPlaceNode(event) {
      if (event.button !== 0 || event.defaultPrevented || fadeStarted) return false;
      if (event.target.closest('a, button, input, select, textarea, label, img, .post-card, .archive-tools, .topic-strip, .about-band, .site-header, .site-footer')) return false;
      const surfaceBounds = graphSurface.getBoundingClientRect();
      return event.clientY >= surfaceBounds.top && event.clientY <= surfaceBounds.bottom;
    }

    document.addEventListener('pointerup', function (event) {
      const now = performance.now();
      if (!canPlaceNode(event) || now - lastClick < clickCooldown) return;
      const surfaceBounds = graphSurface.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY - surfaceBounds.top;
      if (nodes.some(function (node) { return !node.retiredAt && Math.hypot(node.x - x, node.y - y) < 24; })) return;
      lastClick = now;
      const node = { x: x, y: y, born: now };
      const activeNodes = nodes.filter(function (candidate) { return !candidate.retiredAt; });
      const nearest = activeNodes.slice().sort(function (a, b) {
        return Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y);
      }).filter(function (candidate) {
        return Math.hypot(candidate.x - node.x, candidate.y - node.y) < 300;
      }).slice(0, 2);
      nodes.push(node);
      nearest.forEach(function (neighbor) { connections.push({ from: neighbor, to: node, born: now }); });

      if (activeNodes.length + 1 > maxNodes) {
        const retired = activeNodes[0];
        retired.retiredAt = now;
        connections.forEach(function (connection) {
          if (!connection.retiredAt && (connection.from === retired || connection.to === retired)) connection.retiredAt = now;
        });
      }
      const activeConnections = connections.filter(function (connection) { return !connection.retiredAt; });
      while (activeConnections.length > maxConnections) activeConnections.shift().retiredAt = now;

      const retiredNodes = nodes.filter(function (candidate) { return candidate.retiredAt; }).sort(function (a, b) { return a.retiredAt - b.retiredAt; });
      while (retiredNodes.length > 16) {
        const discarded = retiredNodes.shift();
        nodes = nodes.filter(function (candidate) { return candidate !== discarded; });
        connections = connections.filter(function (connection) { return connection.from !== discarded && connection.to !== discarded; });
      }
      const retiredConnections = connections.filter(function (connection) { return connection.retiredAt; }).sort(function (a, b) { return a.retiredAt - b.retiredAt; });
      while (retiredConnections.length > 32) {
        const discarded = retiredConnections.shift();
        connections = connections.filter(function (connection) { return connection !== discarded; });
      }
      if (graphHint) graphHint.classList.add('dismissed');
      window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(beginFade, inactivityDelay);
      requestDraw();
    });

    window.addEventListener('resize', sizeCanvas, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(sizeCanvas).observe(graphSurface);
    reducedMotion.addEventListener('change', function (event) { if (event.matches) clearGraph(); });
    window.setTimeout(function () { if (graphHint) graphHint.classList.add('dismissed'); }, 7000);
    sizeCanvas();
  } else if (graphHint) {
    graphHint.hidden = true;
  }

  updateArchive();
}());
