(function () {
  const search = document.querySelector('#archive-search');
  const cards = Array.from(document.querySelectorAll('.post-card'));
  const filters = Array.from(document.querySelectorAll('.filter'));
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#no-results');
  let activeFilter = 'all';

  function normalize(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function updateArchive() {
    if (!search) return;
    const query = normalize(search.value);
    const queryTerms = query ? query.split(/\s+/) : [];
    let visible = 0;
    cards.forEach(function (card) {
      const matchesTopic = activeFilter === 'all' ||
        card.dataset.category === activeFilter ||
        (activeFilter === 'authors-choice' && card.dataset.authorsChoice === 'true');
      const searchable = normalize(card.dataset.search || '');
      const matchesSearch = !queryTerms.length || queryTerms.every(function (term) {
        return searchable.indexOf(term) !== -1;
      });
      const show = matchesTopic && matchesSearch;
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
}());
