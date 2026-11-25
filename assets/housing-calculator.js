(function () {
  "use strict";
  const root =
      typeof document === "undefined"
        ? null
        : document.querySelector("#housing-calculator"),
    MODEL_VERSION = 2,
    STORAGE_KEY = "ritvikmath.housing.public.v1";
  const HOUSE_PROFILES = Object.freeze({
    lower: {
      name: "Lower-priced home",
      price: 750000,
      rent: 3500,
      comparableRent: 3500,
      insurance: 280,
      hoa: 0,
      propertyTax: 1.15,
      maintenance: 1,
      sellingCost: 5.5,
      utilities: 150,
      repairAmount: 10000,
    },
    moderate: {
      name: "Moderately priced home",
      price: 1000000,
      rent: 4500,
      comparableRent: 4500,
      insurance: 350,
      hoa: 0,
      propertyTax: 1.15,
      maintenance: 1,
      sellingCost: 5.5,
      utilities: 200,
      repairAmount: 15000,
    },
    higher: {
      name: "Higher-priced home",
      price: 1400000,
      rent: 6000,
      comparableRent: 6000,
      insurance: 500,
      hoa: 100,
      propertyTax: 1.15,
      maintenance: 1,
      sellingCost: 5.5,
      utilities: 280,
      repairAmount: 22000,
    },
  });
  const FINANCIAL_PROFILES = Object.freeze({
    lower: {
      income: 6000,
      living: 3200,
      cash: 40000,
      taxable: 40000,
      taxableBasis: 35000,
      retirement: 50000,
      minimumAccessible: 10000,
      minimumSurplus: 250,
      reserveMonths: 4,
    },
    moderate: {
      income: 9500,
      living: 4500,
      cash: 130000,
      taxable: 130000,
      taxableBasis: 105000,
      retirement: 225000,
      minimumAccessible: 30000,
      minimumSurplus: 500,
      reserveMonths: 6,
    },
    higher: {
      income: 16000,
      living: 6500,
      cash: 250000,
      taxable: 400000,
      taxableBasis: 300000,
      retirement: 500000,
      minimumAccessible: 75000,
      minimumSurplus: 1500,
      reserveMonths: 9,
    },
  });
  const PUBLIC_DEFAULTS = Object.freeze({
    ...HOUSE_PROFILES.moderate,
    ...FINANCIAL_PROFILES.moderate,
    jurisdiction: "CA",
    gainTax: 18,
    incomeGrowth: 2,
    retirementMonth: -1,
    retirementIncome: 0,
    distributionYield: 0,
    distributionTax: 0,
    retirementReturn: 6,
    childPhases: [],
    downPayment: 20,
    mortgageSource: "benchmark",
    mortgageRate: 7.11,
    mortgageYears: 30,
    closingMode: "auto",
    closingFraction: 3.5,
    closingPoints: 0,
    closingCredits: 0,
    escrowDeposit: 0,
    prepaidInsurance: 0,
    prepaidPropertyTax: 0,
    manualClosingCosts: 25000,
    movingCosts: 0,
    extraPrincipal: 0,
    pmi: 0,
    horizon: 10,
    forecastYears: 30,
    affordabilityYears: 30,
    startMonth: new Date().toISOString().slice(0, 7),
    investmentReturn: 6,
    cashReturn: 2.5,
    inflation: 3,
    rentGrowth: 3,
    appreciation: 3,
    insuranceGrowth: 5,
    maintenanceGrowth: 3,
    hoaGrowth: 3,
    homeGainTax: 15,
    homeGainExclusion: 250000,
    homeGainEligible: 1,
    repairYear: 6,
    repairAmount: 12000,
    taxMode: "none",
    filingStatus: "mfj",
    magiAnnual: 150000,
    federalMarginalRate: 22,
    otherSaltAnnual: 10000,
    otherItemizedAnnual: 0,
    stateTaxBenefit: 0,
    annualTaxBenefit: 0,
    applyInflation: 0,
    applyRent: 0,
    applyHome: 0,
    applyCash: 0,
    cashTaxRate: 25,
  });
  const FORM_IDS = Object.keys(PUBLIC_DEFAULTS).filter(
      (x) => x !== "childPhases",
    ),
    HOUSE_PROFILE_IDS = new Set(Object.keys(HOUSE_PROFILES.moderate)),
    FINANCIAL_PROFILE_IDS = new Set(Object.keys(FINANCIAL_PROFILES.moderate)),
    money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  let result = null,
    chartKey = "netWorth",
    chartPoints = [],
    deletedSave = null,
    marketReferences = {
      mortgage: {
        series: "MORTGAGE30US",
        rate: 0.0711,
        observationDate: "2026-11-12",
        latestAvailableObservation: "2026-11-12",
        ageDays: 7,
        status: "Bundled latest complete observation",
        applied: true,
        source: "https://fred.stlouisfed.org/series/MORTGAGE30US",
      },
    };
  function input(id) {
    return typeof document === "undefined" ? null : document.getElementById(id);
  }
  function annual(p) {
    return Math.pow(1 + p / 100, 1 / 12) - 1;
  }
  function payment(principal, rate, months) {
    if (principal <= 0) return 0;
    const r = rate / 1200;
    return r === 0
      ? principal / months
      : (principal * r) / (1 - Math.pow(1 + r, -months));
  }
  function liquidation(value, basis, tax) {
    return value - Math.max(0, value - basis) * tax;
  }
  function escapeHTML(v) {
    return String(v).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  }
  function signed(v) {
    return (v >= 0 ? "+" : "−") + money.format(Math.abs(v));
  }
  function sellTaxable(s, needed, tax) {
    if (needed <= 0 || s.taxable <= 0) return 0;
    const gain = Math.max(0, 1 - s.basis / s.taxable),
      gross = Math.min(s.taxable, needed / Math.max(0.01, 1 - tax * gain)),
      due = gross * gain * tax,
      prior = s.taxable;
    s.taxable -= gross;
    s.basis *= Math.max(0, 1 - gross / prior);
    return gross - due;
  }
  function dateFor(start, month) {
    const [y, m] = start.split("-").map(Number),
      d = new Date(Date.UTC(y, m - 1 + month, 1));
    return d.toISOString().slice(0, 10);
  }
  function closingEstimate(c) {
    if (c.closingMode === "manual")
      return {
        mode: "manual",
        netFees: c.manualClosingCosts,
        grossBudget: c.manualClosingCosts,
        loanAmount: c.price * (1 - c.downPayment / 100),
        pointsCost: 0,
        separate: 0,
        credits: 0,
        low: null,
        high: null,
      };
    if (c.closingMode !== "auto")
      throw Error("Choose automatic or manual closing costs.");
    const loan = c.price * (1 - c.downPayment / 100),
      pointsCost = (loan * c.closingPoints) / 100,
      gross = (c.price * c.closingFraction) / 100 + pointsCost,
      separate = c.escrowDeposit + c.prepaidInsurance + c.prepaidPropertyTax;
    if (
      [
        c.price,
        c.downPayment,
        c.closingFraction,
        c.closingPoints,
        c.closingCredits,
        separate,
      ].some((v) => !Number.isFinite(v)) ||
      c.price <= 0 ||
      c.downPayment < 0 ||
      c.downPayment > 100 ||
      c.closingFraction < 0 ||
      c.closingFraction > 20 ||
      c.closingPoints < 0 ||
      c.closingPoints > 10 ||
      c.closingCredits < 0 ||
      separate < 0
    )
      throw Error("Check the automatic closing-cost inputs.");
    if (separate + c.closingCredits > gross)
      throw Error(
        "Credits plus separately entered escrow and prepaids exceed the gross closing budget. Increase the budget percentage or use a verified manual amount.",
      );
    return {
      mode: "auto",
      netFees: gross - separate - c.closingCredits,
      grossBudget: gross,
      loanAmount: loan,
      pointsCost,
      separate,
      credits: c.closingCredits,
      low: Math.max(
        0,
        c.price * 0.02 + pointsCost - separate - c.closingCredits,
      ),
      high: Math.max(
        0,
        c.price * 0.05 + pointsCost - separate - c.closingCredits,
      ),
    };
  }
  function standardDeduction(year, status) {
    const base =
      year <= 2026
        ? 32200
        : year === 2027
          ? 33200
          : 33200 * Math.pow(1.03, year - 2027);
    return status === "single" ? base / 2 : base;
  }
  function saltCap(year, magi, status) {
    let cap =
        year === 2026
          ? 40400
          : year === 2027
            ? 40804
            : year < 2030
              ? 40804 * Math.pow(1.01, year - 2027)
              : 10000,
      threshold =
        year === 2026
          ? 505000
          : 510050 * Math.pow(1.01, Math.max(0, year - 2027));
    if (status === "single") {
      cap /= 2;
      threshold /= 2;
    }
    return Math.max(
      status === "single" ? 5000 : 10000,
      cap - 0.3 * Math.max(0, magi - threshold),
    );
  }
  function annualTaxBenefit(c, year, interest, propertyTax, months) {
    if (c.taxMode === "none") return 0;
    if (c.taxMode === "fixed") return (c.annualTaxBenefit * months) / 12;
    const growth = Math.pow(1 + c.incomeGrowth / 100, year - 2026),
      magi = c.magiAnnual * growth,
      standard = standardDeduction(year, c.filingStatus),
      cap = saltCap(year, magi, c.filingStatus),
      otherSalt = c.otherSaltAnnual * growth,
      other = c.otherItemizedAnnual * growth,
      renter = Math.max(standard, Math.min(cap, otherSalt) + other),
      owner = Math.max(
        standard,
        Math.min(cap, otherSalt + propertyTax) + other + interest,
      );
    return (
      (Math.max(0, owner - renter) * c.federalMarginalRate) / 100 +
      (c.stateTaxBenefit * months) / 12
    );
  }
  function normalizeConfig(raw) {
    const c = { ...PUBLIC_DEFAULTS, ...raw };
    c.childPhases = Array.isArray(raw && raw.childPhases)
      ? raw.childPhases.map((p) => ({
          start: Number(p.start),
          end: Number(p.end),
          amount: Number(p.amount),
        }))
      : [];
    Object.keys(c).forEach((k) => {
      if (typeof PUBLIC_DEFAULTS[k] === "number") c[k] = Number(c[k]);
    });
    return c;
  }
  function validateConfig(raw) {
    const c = normalizeConfig(raw),
      fail = (message, section) => {
        const e = Error(message);
        e.section = section;
        throw e;
      };
    if (c.price < 10000 || c.price > 100000000)
      fail(
        "Enter a purchase price between $10,000 and $100,000,000.",
        "property",
      );
    if (c.horizon < 1 || c.forecastYears < c.horizon || c.forecastYears > 40)
      fail(
        "The forecast must be at least as long as the holding period and no longer than 40 years.",
        "growth",
      );
    if (c.affordabilityYears < 1 || c.affordabilityYears > 40)
      fail("The budget-check window must be between 1 and 40 years.", "growth");
    if (c.taxableBasis > c.taxable)
      fail(
        "Brokerage cost basis cannot exceed the current taxable investment value.",
        "household",
      );
    if (
      c.childPhases.some(
        (p) =>
          p.start < 0 ||
          p.end <= p.start ||
          p.amount < 0 ||
          !Number.isFinite(p.start + p.end + p.amount),
      )
    )
      fail(
        "Each dependent-cost phase needs a nonnegative amount and an end month after its start month.",
        "household",
      );
    const phases = [...c.childPhases].sort((a, b) => a.start - b.start);
    if (phases.some((p, i) => i && p.start < phases[i - 1].end))
      fail("Dependent-cost phases cannot overlap.", "household");
    [
      "cash",
      "taxable",
      "taxableBasis",
      "retirement",
      "rent",
      "income",
      "living",
      "downPayment",
      "insurance",
      "hoa",
      "propertyTax",
      "maintenance",
      "sellingCost",
      "mortgageRate",
      "mortgageYears",
      "reserveMonths",
      "minimumAccessible",
      "repairAmount",
      "movingCosts",
      "pmi",
    ].forEach((k) => {
      if (!Number.isFinite(c[k]) || c[k] < 0)
        fail(
          "Amounts and rates that represent costs must be finite and nonnegative.",
          k === "mortgageRate" ? "financing" : "household",
        );
    });
    if (c.jurisdiction !== "CA" && Math.abs(c.propertyTax - 1.15) < 0.0001)
      fail(
        "The 1.15% property tax rate is an example. Enter an estimate for the property.",
        "property",
      );
    try {
      closingEstimate(c);
    } catch (e) {
      fail(e.message, "closing");
    }
    return c;
  }
  function simulate(raw, buy, modifiers) {
    const c = validateConfig(raw);
    modifiers = modifiers || {};
    const months = c.forecastYears * 12,
      state = {
        cash: c.cash,
        taxable: c.taxable,
        basis: c.taxableBasis,
        retirement: c.retirement,
      };
    let home = buy ? c.price : 0,
      balance = buy ? c.price * (1 - c.downPayment / 100) : 0,
      homeBasis = home,
      yearInterest = 0,
      yearTax = 0,
      yearMonths = 0;
    const originalPrincipal = balance,
      note = payment(balance, c.mortgageRate, c.mortgageYears * 12),
      close = closingEstimate(c),
      closingOutflow = buy
        ? (c.price * c.downPayment) / 100 +
          close.netFees +
          c.escrowDeposit +
          c.prepaidInsurance +
          c.prepaidPropertyTax +
          c.movingCosts
        : 0;
    if (buy) {
      state.cash -= closingOutflow;
      if (state.cash < 0)
        state.cash += sellTaxable(state, -state.cash, c.gainTax / 100);
    }
    let feasible = state.cash >= -0.01;
    const rows = [];
    function record(month, flows) {
      const accessible =
          state.cash + liquidation(state.taxable, state.basis, c.gainTax / 100),
        equity = buy ? home - balance : 0,
        netWorth = accessible + state.retirement + equity,
        gain =
          buy && c.homeGainEligible
            ? Math.max(0, home - homeBasis - c.homeGainExclusion)
            : buy
              ? Math.max(0, home - homeBasis)
              : 0,
        saleLiquid =
          accessible +
          state.retirement +
          (buy
            ? home -
              (home * c.sellingCost) / 100 -
              balance -
              (gain * c.homeGainTax) / 100
            : 0);
      rows.push({
        month,
        date: dateFor(c.startMonth, month),
        cash: state.cash,
        taxable: state.taxable,
        taxableBasis: state.basis,
        retirement: state.retirement,
        netWorth,
        realNetWorth: netWorth / Math.pow(1 + c.inflation / 100, month / 12),
        accessible,
        equity,
        home,
        balance,
        saleLiquid,
        ...flows,
      });
    }
    record(0, {
      income: 0,
      living: 0,
      dependent: 0,
      housing: 0,
      spending: 0,
      surplus: 0,
      rent: 0,
      pi: 0,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      hoa: 0,
      utilities: 0,
      pmi: 0,
      taxBenefit: 0,
    });
    for (let month = 1; month <= months; month++) {
      const year = (month - 1) / 12,
        calendarYear = Number(dateFor(c.startMonth, month - 1).slice(0, 4));
      let income =
        c.retirementMonth >= 0 && month > c.retirementMonth
          ? c.retirementIncome
          : c.income * Math.pow(1 + c.incomeGrowth / 100, year);
      if (modifiers.incomeCut && month > 24 && month <= 48) income *= 0.5;
      const living = c.living * Math.pow(1 + c.inflation / 100, year),
        dependent = c.childPhases
          .filter((p) => p.start <= month - 1 && month - 1 < p.end)
          .reduce(
            (sum, p) => sum + p.amount * Math.pow(1 + c.inflation / 100, year),
            0,
          );
      let housing = 0,
        rent = 0,
        pi = 0,
        taxes = 0,
        insurance = 0,
        maintenance = 0,
        hoa = 0,
        pmi = 0,
        taxBenefit = 0;
      if (buy) {
        const interest = (balance * c.mortgageRate) / 1200,
          scheduled = Math.min(note, balance + interest);
        balance = Math.max(0, balance + interest - scheduled);
        const extra = Math.min(balance, c.extraPrincipal);
        balance -= extra;
        pi = scheduled + extra;
        home *= 1 + annual(c.appreciation);
        taxes = (home * c.propertyTax) / 100 / 12;
        insurance = c.insurance * Math.pow(1 + c.insuranceGrowth / 100, year);
        maintenance =
          ((c.price * c.maintenance) / 100 / 12) *
          Math.pow(1 + c.maintenanceGrowth / 100, year);
        hoa = c.hoa * Math.pow(1 + c.hoaGrowth / 100, year);
        pmi = balance > originalPrincipal * 0.8 ? c.pmi : 0;
        const repair = month === c.repairYear * 12 ? c.repairAmount : 0,
          stress = modifiers.repair && month === 24 ? 40000 : 0;
        housing =
          pi +
          taxes +
          insurance +
          maintenance +
          hoa +
          c.utilities +
          pmi +
          repair +
          stress;
        yearInterest += interest;
        yearTax += taxes;
        yearMonths++;
        if (month % 12 === 0) {
          taxBenefit = annualTaxBenefit(
            c,
            calendarYear,
            yearInterest,
            yearTax,
            yearMonths,
          );
          state.cash += taxBenefit;
          yearInterest = yearTax = yearMonths = 0;
        }
      } else {
        rent =
          (modifiers.comparableRent || c.rent) *
          Math.pow(1 + c.rentGrowth / 100, year);
        housing = rent;
      }
      const spending = living + dependent + housing,
        surplus = income - spending;
      state.cash += surplus;
      const reserve = spending * c.reserveMonths;
      if (state.cash < reserve)
        state.cash += sellTaxable(state, reserve - state.cash, c.gainTax / 100);
      if (state.cash > reserve) {
        const contribution = state.cash - reserve;
        state.cash -= contribution;
        state.taxable += contribution;
        state.basis += contribution;
      }
      const gain = state.taxable * annual(c.investmentReturn),
        distribution = (state.taxable * c.distributionYield) / 100 / 12,
        distributionTax = (distribution * c.distributionTax) / 100;
      state.taxable += gain - distributionTax;
      state.basis += Math.max(0, distribution - distributionTax);
      state.retirement *= 1 + annual(c.retirementReturn);
      state.cash *= 1 + annual(c.cashReturn);
      if (modifiers.marketShock && month === 24) {
        state.taxable *= 0.7;
        state.retirement *= 0.7;
      }
      if (state.cash < -0.01 && state.taxable < 0.01) feasible = false;
      record(month, {
        income,
        living,
        dependent,
        housing,
        spending,
        surplus,
        rent,
        pi,
        propertyTax: taxes,
        insurance,
        maintenance,
        hoa,
        utilities: buy ? c.utilities : 0,
        pmi,
        taxBenefit,
      });
    }
    const windowMonths = Math.min(c.forecastYears, c.affordabilityYears) * 12,
      window = rows.slice(1, windowMonths + 1),
      worst = window.reduce(
        (a, b) => (b.surplus < a.surplus ? b : a),
        window[0],
      );
    return {
      rows,
      closing: closingOutflow,
      closingEstimate: close,
      feasible,
      windowMonths,
      minSurplus: worst.surplus,
      minAccessible: Math.min(
        ...rows.slice(0, windowMonths + 1).map((r) => r.accessible),
      ),
      worstMonth: worst,
    };
  }
  function assumptionsWarnings(c) {
    const w = [];
    if (Math.abs(c.taxableBasis - c.taxable) < 0.01 && c.taxable > 0)
      w.push(
        "Brokerage cost basis equals market value, which implies no embedded taxable gain. Confirm this rather than inferring it.",
      );
    if (c.gainTax === 0)
      w.push(
        "Investment-sale tax is zero. Confirm both cost basis and the effective tax rate.",
      );
    if (c.homeGainTax === 0)
      w.push(
        "Home-sale gain tax is zero. Sale proceeds depend on this assumption.",
      );
    if (c.retirementMonth < 0)
      w.push(
        "Retirement timing is unset, so working income continues through the forecast.",
      );
    if (c.downPayment < 20 && c.pmi === 0)
      w.push(
        "Down payment is below 20% while PMI is zero. Verify the financing quote.",
      );
    if (c.homeGainEligible)
      w.push(
        "The model assumes home-sale exclusion eligibility. A holding period alone does not establish eligibility.",
      );
    if (c.distributionYield === 0)
      w.push(
        "Dividend distributions and their tax drag are not separately modeled because distribution yield is zero.",
      );
    w.push(
      "Insurance, special assessments, HOA dues, repairs, and local property taxes require property-specific verification.",
    );
    return w;
  }
  function evaluate(raw, light) {
    const c = validateConfig(raw),
      buy = simulate(c, true),
      rent = simulate(c, false),
      month = c.horizon * 12,
      b = buy.rows[month],
      r = rent.rows[month],
      output = {
        modelVersion: MODEL_VERSION,
        config: c,
        createdAt: new Date().toISOString(),
        marketReferences,
        buy,
        rent,
        warnings: assumptionsWarnings(c),
        metrics: {
          advantage: b.netWorth - r.netWorth,
          saleAdvantage: b.saleLiquid - r.netWorth,
          buyNetWorth: b.netWorth,
          rentNetWorth: r.netWorth,
          closing: buy.closing,
          minSurplus: buy.minSurplus,
          minAccessible: buy.minAccessible,
          feasible: buy.feasible,
          budgetPass:
            buy.feasible &&
            buy.minSurplus >= c.minimumSurplus &&
            buy.minAccessible >= c.minimumAccessible,
          worstMonth: buy.worstMonth,
          budgetWindowMonths: buy.windowMonths,
        },
      };
    if (light) return output;
    const periods = [1, 3, 5, 7, 10, 15, 20, 30, c.horizon].filter(
      (y) => y <= c.forecastYears,
    );
    output.periods = [...new Set(periods)]
      .sort((a, bv) => a - bv)
      .map((year) => ({
        year,
        buy: buy.rows[year * 12].netWorth,
        rent: rent.rows[year * 12].netWorth,
        difference:
          buy.rows[year * 12].netWorth - rent.rows[year * 12].netWorth,
      }));
    const defs = [
      ["Baseline", {}],
      ["Income cut", { incomeCut: true }],
      ["30% portfolio decline", { marketShock: true }],
      ["Additional $40,000 repair", { repair: true }],
      ["Combined stress", { incomeCut: true, marketShock: true, repair: true }],
    ];
    output.stress = defs.map(([name, mod]) => {
      const sb = simulate(c, true, mod),
        sr = simulate(c, false, mod),
        end = c.horizon * 12;
      return {
        name,
        advantage: sb.rows[end].netWorth - sr.rows[end].netWorth,
        minAccessible: sb.minAccessible,
        minSurplus: sb.minSurplus,
        feasible: sb.feasible,
      };
    });
    const returns = [3, 5, 7, 9],
      appreciation = [0, 2, 4, 6];
    output.sensitivity = {
      returns,
      appreciation,
      values: appreciation.map((a) =>
        returns.map(
          (ret) =>
            evaluate({ ...c, appreciation: a, investmentReturn: ret }, true)
              .metrics.advantage,
        ),
      ),
    };
    return output;
  }
  function migrateSave(save) {
    if (save.schemaVersion >= MODEL_VERSION) return save;
    const config = normalizeConfig(
      save.config || (save.result && save.result.config) || {},
    );
    Object.assign(config, {
      closingMode: "auto",
      closingFraction: 3.5,
      closingPoints: 0,
      closingCredits: 0,
      escrowDeposit: 0,
      prepaidInsurance: 0,
      prepaidPropertyTax: 0,
    });
    const recalculated = evaluate(config);
    return {
      ...save,
      schemaVersion: MODEL_VERSION,
      config,
      recalculatedAt: recalculated.createdAt,
      result: recalculated,
      migrationNote:
        "Closing costs migrated once to the automatic planning estimate and recalculated without refreshing live data.",
    };
  }
  function migrateSaves(items) {
    return (Array.isArray(items) ? items : []).map(migrateSave);
  }
  function parseFredCSV(text, spec, now) {
    const rows = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((x) => x.split(","))
      .filter(
        (p) => p[0] && p[1] && p[1] !== "." && Number.isFinite(Number(p[1])),
      )
      .map((p) => ({ date: p[0], value: Number(p[1]) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) throw Error("No valid observations.");
    const latest = rows.at(-1),
      today = new Date(now || Date.now()),
      lookup = new Map(rows.map((r) => [r.date, r]));
    let chosen = latest,
      comparison = null,
      rate = latest.value / 100;
    if (spec.lagMonths) {
      const eligible = rows.filter((r) => {
        const d = new Date(r.date + "T00:00:00Z");
        d.setUTCFullYear(d.getUTCFullYear() - 1);
        return lookup.has(d.toISOString().slice(0, 10));
      });
      if (!eligible.length)
        throw Error("No complete exact year-over-year observation pair.");
      chosen = eligible.at(-1);
      const d = new Date(chosen.date + "T00:00:00Z");
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      comparison = lookup.get(d.toISOString().slice(0, 10));
      rate = chosen.value / comparison.value - 1;
    }
    const age = Math.max(
      0,
      Math.floor((today - new Date(chosen.date + "T00:00:00Z")) / 86400000),
    );
    if (age > spec.maxAge)
      throw Error("Observation is stale (" + age + " days old).");
    return {
      series: spec.series,
      rate,
      observationDate: chosen.date,
      comparisonDate: comparison && comparison.date,
      latestAvailableObservation: latest.date,
      ageDays: age,
      status:
        chosen.date === latest.date
          ? "Latest complete observation"
          : "Earlier complete pair used because the latest observation lacks its year-earlier match",
      applied: false,
      source: "https://fred.stlouisfed.org/series/" + spec.series,
    };
  }
  globalThis.ritvikmathHousingPublic = {
    payment,
    closingEstimate,
    standardDeduction,
    saltCap,
    annualTaxBenefit,
    simulate,
    evaluate,
    parseFredCSV,
    migrateSaves,
    defaults: { ...PUBLIC_DEFAULTS },
    profiles: { house: HOUSE_PROFILES, financial: FINANCIAL_PROFILES },
  };
  if (!root) return;
  function phaseRows() {
    return [...document.querySelectorAll(".dependent-phase")].map((r) => ({
      start: Number(r.querySelector("[data-phase=start]").value),
      end: Number(r.querySelector("[data-phase=end]").value),
      amount: Number(r.querySelector("[data-phase=amount]").value),
    }));
  }
  function renderPhases(phases) {
    input("dependent-phases").innerHTML = (phases || [])
      .map(
        (p, i) =>
          '<div class="dependent-phase"><label>Start month<input data-phase="start" type="number" min="0" step="1" value="' +
          p.start +
          '"></label><label>End month (excluded)<input data-phase="end" type="number" min="1" step="1" value="' +
          p.end +
          '"></label><label>Monthly amount<input data-phase="amount" type="number" min="0" step="50" value="' +
          p.amount +
          '"></label><button type="button" data-remove-phase="' +
          i +
          '" aria-label="Remove dependent-cost phase">×</button></div>',
      )
      .join("");
  }
  function readConfig() {
    const c = {};
    FORM_IDS.forEach((id) => {
      const el = input(id);
      if (el)
        c[id] =
          el.type === "checkbox"
            ? el.checked
              ? 1
              : 0
            : el.tagName === "SELECT" ||
                el.type === "month" ||
                el.type === "text"
              ? el.value
              : Number(el.value);
    });
    c.childPhases = phaseRows();
    if (
      c.mortgageSource === "benchmark" &&
      !(marketReferences.mortgage && marketReferences.mortgage.applied)
    ) {
      const e = Error(
        "Check the current mortgage benchmark before running, or choose a manual quote.",
      );
      e.section = "growth";
      throw e;
    }
    return validateConfig(c);
  }
  function setValues(values) {
    const c = normalizeConfig(values);
    FORM_IDS.forEach((id) => {
      const el = input(id);
      if (el) {
        if (el.type === "checkbox") el.checked = Boolean(c[id]);
        else el.value = c[id];
      }
    });
    renderPhases(c.childPhases);
    syncConditional();
    updateClosingPreview();
  }
  function clearOutput() {
    result = null;
    input("housing-results").hidden = true;
    input("housing-error").hidden = true;
  }
  function showError(error) {
    const el = input("housing-error");
    el.textContent = error.message || error;
    el.hidden = false;
    if (error.section) {
      const panel = ["closing", "growth", "taxes"].includes(error.section)
        ? "financing"
        : error.section;
      document
        .querySelectorAll("[data-panel]")
        .forEach((p) => (p.hidden = p.dataset.panel !== panel));
      document
        .querySelectorAll(".housing-step-nav button")
        .forEach((b) => b.classList.toggle("active", b.dataset.step === panel));
      const d = document.querySelector("[data-advanced=" + error.section + "]");
      if (d) d.open = true;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function syncConditional() {
    input("manual-rate-wrap").hidden =
      input("mortgageSource").value !== "manual";
    input("manual-closing-wrap").hidden =
      input("closingMode").value !== "manual";
    document
      .querySelectorAll("[data-tax-approx]")
      .forEach((el) => (el.hidden = input("taxMode").value !== "approx"));
    input("fixed-tax-wrap").hidden = input("taxMode").value !== "fixed";
  }
  function updateClosingPreview() {
    try {
      const c = normalizeConfig(
          Object.fromEntries(
            FORM_IDS.map((id) => {
              const el = input(id);
              return [
                id,
                el
                  ? el.type === "checkbox"
                    ? el.checked
                      ? 1
                      : 0
                    : el.value || 0
                  : PUBLIC_DEFAULTS[id],
              ];
            }),
          ),
        ),
        x = closingEstimate(c);
      input("closing-preview").innerHTML =
        x.mode === "auto"
          ? "<strong>Estimated transaction fees " +
            money.format(x.netFees) +
            "</strong><span>" +
            money.format(c.price) +
            " × " +
            c.closingFraction.toFixed(1) +
            "% + " +
            money.format(x.pointsCost) +
            " points − " +
            money.format(x.credits) +
            " credits − " +
            money.format(x.separate) +
            " separately entered escrow/prepaids</span><span>Planning range: " +
            money.format(x.low) +
            "–" +
            money.format(x.high) +
            ". Down payment and moving costs are separate.</span>"
          : "<strong>Manual transaction fees " +
            money.format(x.netFees) +
            "</strong><span>Use a verified Loan Estimate or closing worksheet.</span>";
    } catch (e) {
      input("closing-preview").textContent = e.message;
    }
  }
  function renderAudit(o) {
    const c = o.config,
      x = o.buy.closingEstimate,
      groups = [
        [
          "Planning assumptions",
          "Inflation " +
            c.inflation +
            "%; rent growth " +
            c.rentGrowth +
            "%; home appreciation " +
            c.appreciation +
            "%; investment and retirement returns " +
            c.investmentReturn +
            "% / " +
            c.retirementReturn +
            "%.",
        ],
        [
          "User-provided facts",
          "Price, rent, assets, income, expenses, holding period, and dependent-cost phases.",
        ],
        [
          "Quote-required values",
          "Mortgage rate, insurance, PMI, HOA, property taxes, repairs, credits, points, escrow, and prepaids.",
        ],
        [
          "Inactive optional settings",
          c.retirementMonth < 0
            ? "Retirement timing is unset."
            : "Retirement timing is active.",
        ],
        [
          "Simplified legal/tax rules",
          "Tax calculations are scenario estimates, not a tax return. Home-sale exclusion eligibility is user-selected.",
        ],
        [
          "Closing-cost estimate",
          x.mode === "auto"
            ? money.format(x.netFees) +
              " net fees from a " +
              c.closingFraction +
              "% planning budget; CFPB’s 2–5% range is not a local average or quote."
            : money.format(x.netFees) + " manual override.",
        ],
        [
          "Data sources",
          Object.keys(o.marketReferences || {}).length
            ? "FRED references checked; applied status is shown above."
            : "Manual assumptions active; no external data requested.",
        ],
      ];
    return groups
      .map(
        (g) =>
          "<section><h4>" +
          g[0] +
          "</h4><p>" +
          escapeHTML(g[1]) +
          "</p></section>",
      )
      .join("");
  }
  function render(o) {
    result = o;
    const c = o.config,
      m = o.metrics,
      w = m.worstMonth;
    input("housing-results").hidden = false;
    input("housing-result-title").textContent =
      (m.advantage >= 0 ? "Buying leads by " : "Renting leads by ") +
      money.format(Math.abs(m.advantage)) +
      " after " +
      c.horizon +
      " years";
    input("housing-result-date").textContent =
      "Calculated " + new Date(o.createdAt).toLocaleString();
    const cards = [
      ["Buying minus renting", signed(m.advantage)],
      ["After hypothetical sale", signed(m.saleAdvantage)],
      ["Cash needed at closing", money.format(m.closing)],
      ["Lowest monthly surplus", money.format(m.minSurplus)],
      ["Minimum accessible assets", money.format(m.minAccessible)],
      ["Budget thresholds", m.budgetPass ? "Pass" : "Review"],
    ];
    input("housing-metrics").innerHTML = cards
      .map(
        (x) =>
          "<article><span>" +
          x[0] +
          "</span><strong>" +
          x[1] +
          "</strong></article>",
      )
      .join("");
    input("housing-worst-month").innerHTML =
      "<h3>Lowest monthly surplus</h3><p><strong>" +
      money.format(w.surplus) +
      " in " +
      new Date(w.date + "T00:00:00").toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }) +
      "</strong>. This is the worst modeled month in the " +
      m.budgetWindowMonths +
      "-month budget-check window—not an average.</p><dl><div><dt>Income</dt><dd>" +
      money.format(w.income) +
      "</dd></div><div><dt>Living costs</dt><dd>" +
      money.format(w.living) +
      "</dd></div><div><dt>Dependent costs</dt><dd>" +
      money.format(w.dependent) +
      "</dd></div><div><dt>Housing costs</dt><dd>" +
      money.format(w.housing) +
      "</dd></div><div><dt>Your surplus floor</dt><dd>" +
      money.format(c.minimumSurplus) +
      "</dd></div></dl><p>A negative value means expenses exceed take-home income that month and accessible assets must cover the difference; it does not by itself mean insolvency.</p>";
    input("housing-warning").innerHTML = o.warnings
      .map((x) => "<p>" + escapeHTML(x) + "</p>")
      .join("");
    input("housing-periods").innerHTML = o.periods
      .map(
        (p) =>
          "<tr><td>" +
          p.year +
          "</td><td>" +
          money.format(p.buy) +
          "</td><td>" +
          money.format(p.rent) +
          '</td><td class="' +
          (p.difference >= 0 ? "positive" : "negative") +
          '">' +
          signed(p.difference) +
          "</td></tr>",
      )
      .join("");
    input("housing-stress").innerHTML = o.stress
      .map(
        (s) =>
          "<article><div><strong>" +
          s.name +
          "</strong><span>Minimum accessible " +
          money.format(s.minAccessible) +
          '</span></div><b class="' +
          (s.advantage >= 0 ? "positive" : "negative") +
          '">' +
          signed(s.advantage) +
          "</b></article>",
      )
      .join("");
    const max = Math.max(...o.sensitivity.values.flat().map(Math.abs), 1);
    input("housing-sensitivity").innerHTML =
      '<div class="heat-head"><span>Appreciation ↓ / return →</span>' +
      o.sensitivity.returns.map((r) => "<b>" + r + "%</b>").join("") +
      "</div>" +
      o.sensitivity.values
        .map(
          (row, i) =>
            '<div class="heat-row"><b>' +
            o.sensitivity.appreciation[i] +
            "%</b>" +
            row
              .map(
                (v) =>
                  '<span style="--heat:' +
                  (Math.abs(v) / max).toFixed(3) +
                  '" class="' +
                  (v >= 0 ? "positive" : "negative") +
                  '">' +
                  signed(v) +
                  "</span>",
              )
              .join("") +
            "</div>",
        )
        .join("");
    input("housing-audit").innerHTML = renderAudit(o);
    drawChart();
    input("housing-results").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
  function chartSeries() {
    if (!result) return [];
    const b = result.buy.rows,
      r = result.rent.rows;
    if (chartKey === "equity")
      return [
        {
          name: "Home equity",
          color: "#315fba",
          values: b.map((x) => x.equity),
        },
      ];
    if (chartKey === "spending")
      return [
        {
          name: "Buy spending",
          color: "#315fba",
          values: b.map((x) => x.spending),
        },
        {
          name: "Rent spending",
          color: "#d96c54",
          values: r.map((x) => x.spending),
        },
      ];
    return [
      { name: "Buy", color: "#315fba", values: b.map((x) => x[chartKey]) },
      { name: "Rent", color: "#d96c54", values: r.map((x) => x[chartKey]) },
    ];
  }
  function drawChart(selected) {
    const canvas = input("housing-chart"),
      wrap = canvas.parentElement,
      ctx = canvas.getContext("2d"),
      w = wrap.clientWidth,
      h = w < 560 ? 330 : 410,
      ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const series = chartSeries();
    if (!series.length) return;
    const all = series.flatMap((s) => s.values);
    let min = Math.min(0, ...all),
      max = Math.max(...all);
    if (max === min) max = min + 1;
    const pad = { l: w < 560 ? 58 : 78, r: 18, t: 30, b: 42 },
      pw = w - pad.l - pad.r,
      ph = h - pad.t - pad.b,
      x = (i) => pad.l + (i / (series[0].values.length - 1)) * pw,
      y = (v) => pad.t + ((max - v) / (max - min)) * ph;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px "DM Mono",monospace';
    for (let i = 0; i <= 4; i++) {
      const v = max - ((max - min) * i) / 4,
        py = pad.t + (ph * i) / 4;
      ctx.strokeStyle = "rgba(25,37,59,.1)";
      ctx.beginPath();
      ctx.moveTo(pad.l, py);
      ctx.lineTo(w - pad.r, py);
      ctx.stroke();
      ctx.fillStyle = "#747b86";
      ctx.textAlign = "right";
      ctx.fillText(money.format(v), pad.l - 8, py);
    }
    series.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.values.forEach((v, i) =>
        i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)),
      );
      ctx.stroke();
    });
    chartPoints = { x, y, pad, pw, ph, series };
    if (selected != null) {
      const i = Math.max(0, Math.min(series[0].values.length - 1, selected));
      ctx.strokeStyle = "rgba(25,37,59,.3)";
      ctx.beginPath();
      ctx.moveTo(x(i), pad.t);
      ctx.lineTo(x(i), pad.t + ph);
      ctx.stroke();
    }
  }
  function readSaves() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || "[]",
        before = JSON.parse(raw),
        after = migrateSaves(before);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        if (!localStorage.getItem(STORAGE_KEY + ".pre-v2-backup"))
          localStorage.setItem(STORAGE_KEY + ".pre-v2-backup", raw);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(after));
      }
      return after;
    } catch (e) {
      return [];
    }
  }
  function writeSaves(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      showError(
        Error(
          "This browser could not save the comparison. Storage may be unavailable or full.",
        ),
      );
      return false;
    }
  }
  function renderSaves() {
    const saves = readSaves();
    input("housing-save-count").textContent = saves.length;
    input("housing-saved-list").innerHTML = saves.length
      ? saves
          .map(
            (s) =>
              "<article><div><strong>" +
              escapeHTML(s.name) +
              "</strong><span>Saved " +
              new Date(s.savedAt).toLocaleString() +
              (s.recalculatedAt
                ? " · recalculated " +
                  new Date(s.recalculatedAt).toLocaleString()
                : "") +
              ' · live rates not refreshed</span></div><button type="button" data-open="' +
              s.id +
              '">Open</button><button type="button" class="trash" data-delete="' +
              s.id +
              '" aria-label="Delete ' +
              escapeHTML(s.name) +
              '">×</button></article>',
          )
          .join("")
      : "<p>No saved comparisons on this device.</p>";
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function applyProfile(group, key) {
    if (key === "custom") return;
    Object.entries(
      group === "house" ? HOUSE_PROFILES[key] : FINANCIAL_PROFILES[key],
    ).forEach(([id, value]) => {
      if (input(id)) input(id).value = value;
    });
    clearOutput();
    updateClosingPreview();
  }
  document.querySelectorAll(".housing-step-nav button").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".housing-step-nav button")
        .forEach((x) => x.classList.toggle("active", x === b));
      document
        .querySelectorAll("[data-panel]")
        .forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.step));
    }),
  );
  document.querySelectorAll(".help-button").forEach((b) =>
    b.addEventListener("click", () => {
      const t = input(b.getAttribute("aria-controls")),
        open = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!open));
      t.hidden = open;
    }),
  );
  input("housing-form").addEventListener("submit", (e) => {
    e.preventDefault();
    input("housing-error").hidden = true;
    try {
      render(evaluate(readConfig()));
    } catch (err) {
      showError(err);
    }
  });
  input("housing-house-profile").addEventListener("change", (e) =>
    applyProfile("house", e.target.value),
  );
  input("housing-financial-profile").addEventListener("change", (e) =>
    applyProfile("financial", e.target.value),
  );
  input("housing-form").addEventListener("input", (e) => {
    if (HOUSE_PROFILE_IDS.has(e.target.id))
      input("housing-house-profile").value = "custom";
    if (FINANCIAL_PROFILE_IDS.has(e.target.id))
      input("housing-financial-profile").value = "custom";
    if (
      [
        "price",
        "downPayment",
        "closingMode",
        "closingFraction",
        "closingPoints",
        "closingCredits",
        "escrowDeposit",
        "prepaidInsurance",
        "prepaidPropertyTax",
        "manualClosingCosts",
      ].includes(e.target.id)
    )
      updateClosingPreview();
    syncConditional();
  });
  input("add-dependent-phase").addEventListener("click", () =>
    renderPhases([...phaseRows(), { start: 0, end: 12, amount: 0 }]),
  );
  input("dependent-phases").addEventListener("click", (e) => {
    if (e.target.dataset.removePhase !== undefined) {
      const p = phaseRows();
      p.splice(Number(e.target.dataset.removePhase), 1);
      renderPhases(p);
    }
  });
  input("housing-reset").addEventListener("click", () => {
    setValues(PUBLIC_DEFAULTS);
    input("housing-house-profile").value = "moderate";
    input("housing-financial-profile").value = "moderate";
    clearOutput();
    input("housing-live-refresh").click();
  });
  input("housing-save").addEventListener("click", () => {
    try {
      const current = result || evaluate(readConfig()),
        saves = readSaves(),
        snapshot = {
          id: String(Date.now()),
          schemaVersion: MODEL_VERSION,
          name: current.config.name,
          savedAt: new Date().toISOString(),
          config: current.config,
          result: current,
        };
      saves.unshift(snapshot);
      if (writeSaves(saves)) renderSaves();
    } catch (e) {
      showError(e);
    }
  });
  input("housing-saved-list").addEventListener("click", (e) => {
    const saves = readSaves(),
      open = e.target.dataset.open,
      del = e.target.dataset.delete;
    if (open) {
      const s = saves.find((x) => x.id === open);
      if (s) {
        setValues(s.config);
        input("housing-house-profile").value = "custom";
        input("housing-financial-profile").value = "custom";
        render(s.result);
      }
    }
    if (del) {
      const i = saves.findIndex((x) => x.id === del);
      if (i >= 0) {
        deletedSave = { item: saves[i], index: i };
        saves.splice(i, 1);
        if (writeSaves(saves)) {
          renderSaves();
          input("housing-undo-wrap").hidden = false;
        }
      }
    }
  });
  input("housing-undo").addEventListener("click", () => {
    if (!deletedSave) return;
    const saves = readSaves();
    saves.splice(deletedSave.index, 0, deletedSave.item);
    if (writeSaves(saves)) {
      deletedSave = null;
      renderSaves();
      input("housing-undo-wrap").hidden = true;
    }
  });
  input("housing-export").addEventListener("click", () => {
    try {
      const o = result || evaluate(readConfig());
      download(
        "housing-comparison.json",
        JSON.stringify(o, null, 2),
        "application/json",
      );
    } catch (e) {
      showError(e);
    }
  });
  input("housing-csv").addEventListener("click", () => {
    try {
      const o = result || evaluate(readConfig()),
        rows = [
          "month,date,buy_net_worth,rent_net_worth,buy_accessible,rent_accessible,home_equity,mortgage_balance",
        ];
      o.buy.rows.forEach((b, i) => {
        const r = o.rent.rows[i];
        rows.push(
          [
            i,
            b.date,
            b.netWorth,
            r.netWorth,
            b.accessible,
            r.accessible,
            b.equity,
            b.balance,
          ]
            .map((v) => (typeof v === "number" ? v.toFixed(2) : v))
            .join(","),
        );
      });
      download("housing-monthly.csv", rows.join("\n"), "text/csv");
    } catch (e) {
      showError(e);
    }
  });
  document.querySelectorAll(".housing-chart-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      chartKey = b.dataset.chart;
      document
        .querySelectorAll(".housing-chart-tabs button")
        .forEach((x) => x.classList.toggle("active", x === b));
      drawChart();
    }),
  );
  input("housing-chart").addEventListener("pointermove", (e) => {
    if (!chartPoints.series) return;
    const rect = e.target.getBoundingClientRect(),
      i = Math.round(
        ((e.clientX - rect.left - chartPoints.pad.l) / chartPoints.pw) *
          (chartPoints.series[0].values.length - 1),
      ),
      safe = Math.max(0, Math.min(chartPoints.series[0].values.length - 1, i)),
      tip = input("housing-tooltip");
    drawChart(safe);
    tip.innerHTML =
      "<strong>Month " +
      safe +
      "</strong>" +
      chartPoints.series
        .map(
          (s) =>
            "<span>" + s.name + " " + money.format(s.values[safe]) + "</span>",
        )
        .join("");
    tip.hidden = false;
    tip.style.left =
      Math.max(8, Math.min(rect.width - 180, e.clientX - rect.left + 12)) +
      "px";
    tip.style.top = "45px";
  });
  input("housing-chart").addEventListener("pointerleave", () => {
    input("housing-tooltip").hidden = true;
    drawChart();
  });
  window.addEventListener(
    "resize",
    () => {
      if (result) drawChart();
    },
    { passive: true },
  );
  input("housing-live-refresh").addEventListener("click", async () => {
    const status = input("housing-live-status");
    status.textContent = "Checking public FRED observations…";
    const specs = {
      mortgage: { series: "MORTGAGE30US", maxAge: 14 },
      inflation: { series: "CPIAUCSL", lagMonths: 12, maxAge: 75 },
      rent: { series: "CUSR0000SEHA", lagMonths: 12, maxAge: 75 },
      cash: { series: "DGS3MO", maxAge: 14 },
      home: { series: "USSTHPI", lagMonths: 12, maxAge: 160 },
    };
    try {
      marketReferences = Object.fromEntries(
        await Promise.all(
          Object.entries(specs).map(async ([name, spec]) => {
            const response = await fetch(
              "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" +
                spec.series,
              { cache: "no-store" },
            );
            if (!response.ok)
              throw Error(spec.series + " returned " + response.status);
            return [name, parseFredCSV(await response.text(), spec)];
          }),
        ),
      );
      if (input("mortgageSource").value === "benchmark") {
        input("mortgageRate").value = (
          marketReferences.mortgage.rate * 100
        ).toFixed(2);
        marketReferences.mortgage.applied = true;
      }
      [
        ["inflation", "applyInflation", "inflation"],
        ["rent", "applyRent", "rentGrowth"],
        ["home", "applyHome", "appreciation"],
        ["cash", "applyCash", "cashReturn"],
      ].forEach(([name, check, field]) => {
        if (input(check).checked) {
          let value = marketReferences[name].rate * 100;
          if (name === "cash")
            value *= 1 - Number(input("cashTaxRate").value) / 100;
          input(field).value = value.toFixed(2);
          marketReferences[name].applied = true;
        }
      });
      status.innerHTML = Object.entries(marketReferences)
        .map(
          ([name, o]) =>
            '<a href="' +
            o.source +
            '" target="_blank" rel="noopener">' +
            name +
            "</a>: " +
            (o.rate * 100).toFixed(2) +
            "% (" +
            o.observationDate +
            (o.comparisonDate ? " vs. " + o.comparisonDate : "") +
            ", " +
            (o.applied ? "applied" : "reference only") +
            ")</span>",
        )
        .join("<br>");
    } catch (e) {
      status.textContent =
        "Live refresh was unavailable. The validated FRED mortgage snapshot dated November 12, 2026 remains active; other market readings remain manual. " +
        e.message;
    }
  });
  setValues(PUBLIC_DEFAULTS);
  renderSaves();
  input("housing-live-refresh").click();
})();
