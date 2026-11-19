# Public housing calculator boundary

The calculator in `assets/housing-calculator.js` is a separate public implementation. It does not import from, bundle, or call the private `housing_decision` package, its defaults, notebooks, Flask routes, SQLite database, saved comparisons, or local server.

## Privacy architecture

- Calculation happens in the visitor's browser.
- Comparisons are stored in that browser's `localStorage` under `ritvikmath.housing.public.v1`.
- New visitors start with no saved comparisons.
- Inputs never appear in a URL and no financial-input API exists.
- JSON and CSV exports are created locally with `Blob` URLs.
- The optional FRED action makes GET requests containing only public series identifiers. It is reference-only and never includes calculator inputs.
- Property information is manual entry only.

## Public configuration

`PUBLIC_DEFAULTS` explicitly defines every field accepted by the public model. The fictional values were created independently for this page. There is no fallback to private configuration.

## Keeping implementations aligned

The public model deliberately ports reviewed calculation behavior without importing private configuration: plain fixed-rate amortization, automatic or manual closing costs, equity, accessible assets, effective investment-sale tax, home-sale proceeds, inflation, recurring ownership costs, household cash flow, reserve funding, holding periods, dependent-cost phases, simplified ownership-tax scenarios, retirement timing, distribution tax drag, budget windows, reference-data validation, and synthetic stresses. Changes to those concepts should be reviewed in the private Python engine first, then ported deliberately to the public JavaScript model and checked with `python scripts/test_housing_public_model.py`.

Saved comparisons use a versioned browser-local schema. The version-2 migration preserves a one-time backup under `ritvikmath.housing.public.v1.pre-v2-backup`, switches legacy saves to the public automatic closing-cost estimate, and recalculates with the rates already stored in each save. It never requests fresh market data during migration.

The test compares the browser mortgage formula with an independent Python calculation and uses only the public synthetic fixture. It also covers amortization/equity identities, taxable withdrawals, sale proceeds, infeasibility, stresses, and sensitivity direction.
