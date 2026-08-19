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

  updateArchive();
}());
