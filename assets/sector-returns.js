(() => {
  const select = document.getElementById("sector-sort");
  const table = document.getElementById("sector-table");
  if (!select || !table) return;

  const groups = [...table.tBodies].map((body) => ({
    body,
    original: [...body.querySelectorAll("[data-sector-row]")],
  }));
  const returnAt = (row, horizon) => {
    const raw = row.cells[horizon + 1]?.dataset.return;
    if (!raw?.trim()) return -Infinity;
    const value = Number(raw);
    return Number.isFinite(value) ? value : -Infinity;
  };
  select.addEventListener("change", () => {
    const horizon = Number(select.value);
    for (const {body, original} of groups) {
      if (original.length < 2) continue;
      const rows = [...original];
      if (select.value !== "") {
        rows.sort((a, b) => returnAt(b, horizon) - returnAt(a, horizon));
      }
      body.append(...rows);
    }
  });
  document.getElementById("sector-sort-control").hidden = false;
})();
