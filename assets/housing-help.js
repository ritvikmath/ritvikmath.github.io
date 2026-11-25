(() => {
  const root = document.getElementById("housing-calculator");
  if (!root) return;
  const help = {
    "housing-house-profile": "Load an example home price and ownership costs. You can edit those values afterward.",
    "housing-financial-profile": "Load an example household budget and savings balances. You can edit those values afterward.",
    name: "A label to help you recognize this comparison, especially if you save several scenarios.",
    price: "The full purchase price before the down payment, closing fees or moving costs.",
    rent: "The monthly rent in the main comparison. Leave utilities and other living costs in the household budget.",
    comparableRent: "The monthly rent for a similar home. To use it in the main comparison, enter it as current monthly rent.",
    jurisdiction: "Choose capped growth for the assessed value used to calculate property tax, or let the assessment grow with your home appreciation assumption.",
    insurance: "The monthly premium for homeowners insurance. Divide an annual quote by 12.",
    hoa: "Monthly dues paid to a homeowners association. Enter zero if the property has none.",
    propertyTax: "The annual property tax as a percentage of assessed value. For example, 1% of $1 million is $10,000 per year.",
    maintenance: "A regular upkeep budget as a percentage of the purchase price per year. Enter major one-time repairs separately.",
    sellingCost: "The share of the eventual sale price spent on selling costs. These costs are deducted in the hypothetical sale comparison.",
    utilities: "How much more you expect to pay for utilities each month as an owner. Enter a negative number if owning would cost less.",
    assessedGrowth: "Annual growth in the value used to calculate property tax when capped assessment growth is selected.",
    specialAssessment: "Yearly charges billed separately from the percentage-based property tax. Enter only amounts not already in your tax estimate.",
    assessmentGrowth: "The annual rate at which those separate assessment charges grow.",
    sellingFixedCost: "Dollar costs at sale in addition to the percentage-based selling cost.",
    capitalizableClosingCosts: "The portion of your closing costs you expect to add to the home's tax basis. This affects estimated gain at sale, not cash paid at closing.",
    sellerPointsBasisReduction: "Any seller-paid points that reduce your home's tax basis in your estimate. This does not add another closing bill.",
    renovationTotal: "The total amount you expect to spend on renovations, separate from maintenance and repairs.",
    renovationStart: "How many months after purchase renovation spending starts. Zero means the first month.",
    renovationMonths: "The number of months over which the renovation budget is spread.",
    renovationValueFraction: "How much home value you assume each renovation dollar adds. At 30%, $10,000 of work adds $3,000 in modeled value.",
    exclusionAfterMonths: "How long the calculator waits before applying your assumed home-sale exclusion. This alone does not establish eligibility.",
    plannedRepairsJson: "Enter a list such as [{\"month\":24,\"amount\":12000}]. Month zero is the first month. A nonempty list replaces the single repair setting.",
    income: "Monthly pay after taxes and payroll deductions. Include take-home income for everyone in the comparison.",
    living: "Monthly spending before rent or ownership costs. Leave out dependent expenses you enter in a separate phase.",
    cash: "Cash and savings available at the start. Enter taxable brokerage and retirement balances separately.",
    taxable: "The current market value of investments outside retirement accounts. Use the cost basis field for what you paid.",
    retirement: "The starting value of retirement accounts. These count toward net worth but are not used to pay bills.",
    gainTax: "Your assumed effective tax rate on positive gains when brokerage investments are sold. It applies to the gain, not the full sale amount.",
    incomeGrowth: "The annual percentage change in take-home pay before any retirement or temporary income changes.",
    retirementIncome: "Monthly take-home income after retirement, in starting-month dollars. The calculator increases it with inflation.",
    retirementReturn: "The assumed annual growth of retirement investments.",
    distributionTax: "The assumed effective tax rate on dividends and other payouts from taxable investments.",
    renterInsurance: "The part of your current living costs spent on renter insurance. The buyer path removes it because homeowner insurance is entered separately.",
    incomeWindowsJson: "Enter a list such as [{\"start\":24,\"end\":36,\"multiplier\":0.5}]. This uses half of modeled income from month 24 up to, but not including, month 36.",
    marketShocksJson: "Enter a list such as [{\"month\":24,\"percent\":-30}] to model a one-time portfolio drop. Month zero is the first month.",
    "phase-start": "First month this dependent expense applies. Zero means the first month of the comparison.",
    "phase-end": "First month the expense no longer applies. For a 12-month expense starting at zero, enter 12.",
    "phase-amount": "Monthly dependent expense in starting-month dollars. The calculator adjusts it for inflation.",
    horizon: "The year at which to compare wealth and the proceeds of a hypothetical sale.",
    downPayment: "The percentage of the home price you pay upfront. The mortgage covers the rest.",
    mortgageSource: "Use a published mortgage benchmark as a starting point or enter your own lender quote.",
    mortgageRate: "Your quoted annual mortgage interest rate. Use the note rate, not the APR.",
    closingMode: "Use an estimate based on the purchase price or enter your own transaction fees.",
    closingFraction: "The percentage of the purchase price used as the starting closing budget in automatic mode.",
    closingPoints: "Upfront costs for discount points, entered as a percentage of the loan. One point on a $400,000 loan costs $4,000.",
    closingCredits: "Confirmed dollar credits that reduce your estimated transaction fees.",
    prepaidInsurance: "Insurance paid at closing and applied to future premiums. Enter it separately from transaction fees.",
    prepaidPropertyTax: "Property tax paid ahead at closing and applied to future bills.",
    manualClosingCosts: "Transaction fees from your estimate. Leave out the down payment, moving costs, escrow and prepaids you enter separately.",
    movingCosts: "One-time moving costs paid from cash at purchase.",
    forecastYears: "The total number of years to project. The comparison year must fit inside this period.",
    startMonth: "The month the comparison starts and the assumed purchase takes place.",
    investmentReturn: "Assumed annual growth of taxable investments. Leave separately entered dividends and other payouts out of this rate.",
    cashReturn: "The assumed annual return on cash after tax. Enter zero for cash that does not earn interest.",
    inflation: "The assumed annual rise in general prices. It affects expenses such as living costs and the inflation-adjusted results.",
    rentGrowth: "The assumed annual increase in rent.",
    appreciation: "The assumed annual change in the home's market value. It can be negative.",
    insuranceGrowth: "The assumed annual increase in the homeowners insurance premium.",
    maintenanceGrowth: "The assumed annual increase in the routine maintenance budget.",
    hoaGrowth: "The assumed annual increase in homeowners association dues.",
    cashTaxRate: "The effective tax rate used to convert the published Treasury yield to an after-tax cash return if you apply that benchmark.",
    applyInflation: "Use the latest validated inflation reading instead of your manual growth assumption.",
    applyRent: "Use a national rent benchmark as your rent growth assumption. It may differ from increases in your lease.",
    applyHome: "Use a national house price reading as the home appreciation assumption. It may differ from your local market.",
    applyCash: "Use the published Treasury yield, reduced by the effective tax rate you entered, as the cash return assumption.",
    mortgageYears: "The original loan term in years. A 30-year mortgage schedules 360 monthly payments.",
    extraPrincipal: "An extra monthly payment applied directly to debt. It reduces the loan balance and uses cash that month.",
    pmi: "The monthly private mortgage insurance charge, if any. This is separate from homeowners insurance.",
    homeGainTax: "The effective tax rate you want to apply to estimated taxable home-sale gains.",
    homeGainExclusion: "The dollar amount of gain you assume is excluded if you qualify.",
    homeGainEligible: "Choose this only if you want to assume you qualify for an exclusion. The calculator cannot determine eligibility.",
    repairYear: "When to charge the single major repair. Enter zero to leave it out.",
    repairAmount: "The dollar cost of that single major repair, in addition to routine maintenance.",
    annualTaxBenefit: "Your annual estimate of the extra tax savings from owning compared with renting, not the total tax refund.",
    filingStatus: "The filing status used for the calculator's approximate federal deduction comparison.",
    magiAnnual: "Your estimated annual modified adjusted gross income. The model uses this for the deduction limit calculation, not as take-home pay.",
    federalMarginalRate: "The assumed federal rate used to estimate the value of extra deductions. It is not an average tax rate.",
    otherSaltAnnual: "Other deductible state and local taxes for the year. Leave out the home's property tax, which is calculated separately.",
    otherItemizedAnnual: "Other deductions you plan to itemize, apart from the modeled mortgage interest and state and local taxes.",
    stateTaxBenefit: "Your separate annual estimate of additional state tax savings from owning compared with renting.",
    extraUntilMonth: "The number of months to make the extra principal payment. Enter 36 for the first 36 payments.",
    pmiCancelLtv: "The scheduled loan balance as a percentage of the original home price at which the model stops charging mortgage insurance.",
    refinanceMonth: "When the replacement loan starts, measured from purchase. Zero is the first month; -1 disables refinancing.",
    refinanceRate: "The annual interest rate on the replacement mortgage.",
    refinanceTermMonths: "The number of payments on the replacement loan. Enter zero to keep the remaining term.",
    refinanceFixedFee: "A flat dollar charge when the loan is refinanced.",
    refinanceFeePercent: "An additional refinance cost as a percentage of the outstanding balance.",
    taxInputGrowth: "The annual growth assumption for income and other tax inputs in the deduction estimate.",
    standardDeductionGrowth: "The assumed annual increase in the standard deduction after the years with explicit values.",
    futureSaltCap: "The deduction cap for state and local taxes in years without an explicit entry.",
    unusedSubsidyPolicy: "Choose whether leftover temporary payment assistance reduces your loan, comes back as cash or stays with the lender.",
    buydownRatesJson: "Enter annual payment rates as a list, such as [4.5,5.5,6.5]. Leave it empty for the regular note rate throughout.",
    taxYearOverridesJson: "Enter calendar years and estimated annual tax benefits, such as {\"2027\":5000}.",
    saltCapsJson: "Enter deduction caps for specific calendar years, such as {\"2027\":40000}.",
    saltThresholdsJson: "Enter the income level at which each year's state and local tax deduction cap starts to shrink.",
  };

  let serial = 0;
  function decorate(container) {
    container.querySelectorAll("input, select, textarea").forEach((field) => {
      const label = field.closest("label");
      if (!label || label.dataset.helpReady) return;
      const old = label.querySelector(".help-button");
      const hint = help[field.id || "phase-" + field.dataset.phase] ||
        (old && document.getElementById(old.getAttribute("aria-controls"))?.textContent);
      if (!hint) return;
      label.dataset.helpReady = "true";
      label.querySelector(".field-help")?.remove();
      old?.remove();
      const row = label.querySelector(".field-label-row") || document.createElement("span");
      if (!row.parentNode) {
        row.className = "field-label-row";
        for (const child of [...label.childNodes]) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) row.append(child);
        }
        label.prepend(row);
      }
      const title = row.textContent.trim();
      const button = document.createElement("button");
      const note = document.createElement("span");
      note.id = "housing-input-help-" + ++serial;
      note.className = "field-help";
      note.textContent = hint;
      note.hidden = true;
      button.type = "button";
      button.className = "help-button housing-help-icon";
      button.setAttribute("aria-label", "Help: " + title);
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", note.id);
      button.innerHTML = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3.5 3.2a2.5 2.5 0 0 1 5 .1c0 1.9-2.5 2-2.5 3.6M6 9.7h.01" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const toggle = (show) => {
        note.hidden = !show;
        button.setAttribute("aria-expanded", String(show));
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        toggle(note.hidden);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Escape") toggle(false);
      });
      row.append(button);
      label.append(note);
    });
  }
  decorate(root);
  const phases = document.getElementById("dependent-phases");
  if (phases) new MutationObserver(() => decorate(phases)).observe(phases, {childList: true});
})();
