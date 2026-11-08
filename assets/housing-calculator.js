(function () {
  'use strict';
  const root = typeof document === 'undefined' ? null : document.querySelector('#housing-calculator');

  // Public-only configuration. Every model input is explicitly declared here.
  // These values were invented for this page and have no dependency on the local research app.
  const PUBLIC_DEFAULTS = Object.freeze({
    name: 'Fictional two-bedroom home', price: 640000, rent: 2950, comparableRent: '',
    insurance: 240, hoa: 0, propertyTax: 1.15, maintenance: 1.0, sellingCost: 5.5, utilities: 140,
    income: 10800, living: 4100, cash: 95000, taxable: 165000, taxableBasis: 140000,
    retirement: 210000, minimumAccessible: 30000, minimumSurplus: 500, reserveMonths: 6,
    gainTax: 18, incomeGrowth: 2.5, childCost: 0, childStart: 3, childYears: 0,
    downPayment: 20, mortgageRate: 6.4, mortgageYears: 30, closingCosts: 2.5,
    extraPrincipal: 0, pmi: 0, horizon: 10, forecastYears: 30, investmentReturn: 6.0,
    cashReturn: 2.5, inflation: 2.5, rentGrowth: 3.0, appreciation: 3.0,
    insuranceGrowth: 3.0, maintenanceGrowth: 2.5, homeGainTax: 15,
    homeGainExclusion: 250000, repairYear: 6, repairAmount: 12000,
    taxMode: 'none', annualTaxBenefit: 0
  });
  const INPUT_IDS = Object.keys(PUBLIC_DEFAULTS);
  const STORAGE_KEY = 'ritvikmath.housing.public.v1';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  let result = null;
  let chartKey = 'netWorth';
  let deletedSave = null;
  let chartPoints = [];

  function input(id) { return document.getElementById(id); }
  function number(id) { return Number(input(id).value); }
  function annual(decimalPercent) { return Math.pow(1 + decimalPercent / 100, 1 / 12) - 1; }
  function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function payment(principal, ratePercent, months) {
    if (principal <= 0) return 0;
    const r = ratePercent / 1200;
    return r === 0 ? principal / months : principal * r / (1 - Math.pow(1 + r, -months));
  }
  function liquidation(value, basis, taxRate) { return value - Math.max(0, value - basis) * taxRate; }
  function sellTaxable(state, netNeeded, taxRate) {
    if (netNeeded <= 0 || state.taxable <= 0) return 0;
    const gainShare = Math.max(0, 1 - state.basis / state.taxable);
    const gross = Math.min(state.taxable, netNeeded / Math.max(0.01, 1 - taxRate * gainShare));
    const tax = gross * gainShare * taxRate;
    const prior = state.taxable;
    state.taxable -= gross;
    state.basis *= Math.max(0, 1 - gross / prior);
    return gross - tax;
  }

  function readConfig() {
    const config = {};
    INPUT_IDS.forEach(id => { config[id] = id === 'name' || id === 'taxMode' || id === 'comparableRent' ? input(id).value : number(id); });
    const required = INPUT_IDS.filter(id => id !== 'comparableRent');
    required.forEach(id => {
      if (config[id] === '' || (typeof config[id] === 'number' && !Number.isFinite(config[id]))) throw new Error('Complete every required field before running the comparison.');
    });
    if (config.price < 10000 || config.price > 100000000) throw new Error('Enter a purchase price between $10,000 and $100,000,000.');
    if (config.horizon < 1 || config.forecastYears < config.horizon || config.forecastYears > 40) throw new Error('The forecast must be at least as long as the holding period and no longer than 40 years.');
    if (config.taxableBasis > config.taxable) throw new Error('Taxable cost basis cannot exceed the current taxable investment value in this simplified model.');
    ['cash','taxable','taxableBasis','retirement','rent','income','living','downPayment','closingCosts','insurance','hoa','propertyTax','maintenance','sellingCost','mortgageRate','mortgageYears','reserveMonths','minimumAccessible','repairAmount'].forEach(id => { if (config[id] < 0) throw new Error('Amounts and rates that represent costs cannot be negative.'); });
    if (config.downPayment > 100 || config.sellingCost >= 100 || config.gainTax >= 100 || config.homeGainTax >= 100) throw new Error('Check percentage inputs.');
    return config;
  }

  function simulate(config, buy, modifiers) {
    modifiers = modifiers || {};
    const months = config.forecastYears * 12;
    const state = { cash: config.cash, taxable: config.taxable, basis: config.taxableBasis, retirement: config.retirement };
    let home = buy ? config.price : 0;
    let homeBasis = home;
    let balance = buy ? config.price * (1 - config.downPayment / 100) : 0;
    const originalPrincipal = balance;
    const note = payment(balance, config.mortgageRate, config.mortgageYears * 12);
    const closing = buy ? config.price * (config.downPayment + config.closingCosts) / 100 : 0;
    if (buy) {
      state.cash -= closing;
      if (state.cash < 0) state.cash += sellTaxable(state, -state.cash, config.gainTax / 100);
    }
    let feasible = state.cash >= -0.01;
    const rows = [];
    let minSurplus = Infinity, minAccessible = Infinity;
    function record(month, spending, surplus, income, rentCost) {
      const accessible = state.cash + liquidation(state.taxable, state.basis, config.gainTax / 100);
      const equity = buy ? home - balance : 0;
      const netWorth = accessible + state.retirement + equity;
      const gain = buy ? Math.max(0, home - homeBasis - config.homeGainExclusion) : 0;
      const saleLiquid = accessible + state.retirement + (buy ? home - home * config.sellingCost / 100 - balance - gain * config.homeGainTax / 100 : 0);
      rows.push({ month, netWorth, realNetWorth: netWorth / Math.pow(1 + config.inflation / 100, month / 12), accessible, equity, home, balance, spending, surplus, income, rent: rentCost, saleLiquid });
      if (month > 0) {
        minSurplus = Math.min(minSurplus, surplus);
        minAccessible = Math.min(minAccessible, accessible);
      }
    }
    record(0, 0, 0, 0, 0);
    for (let month = 1; month <= months; month += 1) {
      const year = (month - 1) / 12;
      let income = config.income * Math.pow(1 + config.incomeGrowth / 100, year);
      if (modifiers.incomeCut && month > 24 && month <= 48) income *= 0.5;
      const living = config.living * Math.pow(1 + config.inflation / 100, year);
      const child = config.childYears > 0 && month > config.childStart * 12 && month <= (config.childStart + config.childYears) * 12 ? config.childCost * Math.pow(1 + config.inflation / 100, year) : 0;
      let housing = 0, rentCost = 0;
      if (buy) {
        const interest = balance * config.mortgageRate / 1200;
        const scheduled = Math.min(note, balance + interest);
        balance = Math.max(0, balance + interest - scheduled);
        const extra = Math.min(balance, config.extraPrincipal);
        balance -= extra;
        home *= 1 + annual(config.appreciation);
        const taxes = home * config.propertyTax / 100 / 12;
        const insurance = config.insurance * Math.pow(1 + config.insuranceGrowth / 100, year);
        const maintenance = config.price * config.maintenance / 100 / 12 * Math.pow(1 + config.maintenanceGrowth / 100, year);
        const pmi = balance > originalPrincipal * 0.80 ? config.pmi : 0;
        const repair = month === config.repairYear * 12 ? config.repairAmount : 0;
        const stressRepair = modifiers.repair && month === 24 ? 40000 : 0;
        housing = scheduled + extra + taxes + insurance + maintenance + config.hoa + config.utilities + pmi + repair + stressRepair;
        if (config.taxMode === 'fixed') state.cash += config.annualTaxBenefit / 12;
      } else {
        rentCost = (modifiers.comparableRent || config.rent) * Math.pow(1 + config.rentGrowth / 100, year);
        housing = rentCost;
      }
      const spending = living + child + housing;
      const surplus = income - spending;
      state.cash += surplus;
      const reserve = (living + child + housing) * config.reserveMonths;
      if (state.cash < reserve) state.cash += sellTaxable(state, reserve - state.cash, config.gainTax / 100);
      if (state.cash > reserve) {
        const contribution = state.cash - reserve;
        state.cash -= contribution; state.taxable += contribution; state.basis += contribution;
      }
      state.taxable *= 1 + annual(config.investmentReturn);
      state.retirement *= 1 + annual(config.investmentReturn);
      state.cash *= 1 + annual(config.cashReturn);
      if (modifiers.marketShock && month === 24) { state.taxable *= 0.70; state.retirement *= 0.70; }
      if (state.cash < -0.01 && state.taxable < 0.01) feasible = false;
      record(month, spending, surplus, income, rentCost);
    }
    return { rows, closing, feasible, minSurplus, minAccessible };
  }

  function evaluate(config, light) {
    const buy = simulate(config, true), rent = simulate(config, false);
    const month = config.horizon * 12;
    const b = buy.rows[month], r = rent.rows[month];
    const output = { config, createdAt: new Date().toISOString(), buy, rent, metrics: {
      advantage: b.netWorth - r.netWorth, saleAdvantage: b.saleLiquid - r.netWorth,
      buyNetWorth: b.netWorth, rentNetWorth: r.netWorth, closing: buy.closing,
      minSurplus: buy.minSurplus, minAccessible: buy.minAccessible, feasible: buy.feasible,
      budgetPass: buy.feasible && buy.minSurplus >= config.minimumSurplus && buy.minAccessible >= config.minimumAccessible
    }};
    if (light) return output;
    const periods = [1,3,5,7,10,15,20,30,config.horizon].filter(y => y <= config.forecastYears);
    output.periods = [...new Set(periods)].sort((a,bv) => a-bv).map(year => ({ year, buy: buy.rows[year*12].netWorth, rent: rent.rows[year*12].netWorth, difference: buy.rows[year*12].netWorth-rent.rows[year*12].netWorth }));
    const stressDefs = [
      ['Baseline', {}], ['Income cut', { incomeCut: true }], ['30% market decline', { marketShock: true }], ['Additional $40,000 repair', { repair: true }], ['Combined stress', { incomeCut: true, marketShock: true, repair: true }]
    ];
    output.stress = stressDefs.map(([name, mod]) => { const sb=simulate(config,true,mod), sr=simulate(config,false,mod), end=config.horizon*12; return { name, advantage:sb.rows[end].netWorth-sr.rows[end].netWorth, minAccessible:sb.minAccessible, minSurplus:sb.minSurplus, feasible:sb.feasible }; });
    const returns = [3,5,7,9], appreciation = [0,2,4,6];
    output.sensitivity = { returns, appreciation, values: appreciation.map(a => returns.map(ret => { const c={...config,appreciation:a,investmentReturn:ret}; return evaluate(c,true).metrics.advantage; })) };
    return output;
  }

  function setDefaults(values) { INPUT_IDS.forEach(id => { if (input(id)) input(id).value = values[id]; }); }
  function signedMoney(value) { return (value >= 0 ? '+' : '−') + money.format(Math.abs(value)); }
  function render(output) {
    result = output; const c=output.config, m=output.metrics;
    document.querySelector('#housing-results').hidden = false;
    document.querySelector('#housing-result-title').textContent = (m.advantage >= 0 ? 'Buying leads by ' : 'Renting leads by ') + money.format(Math.abs(m.advantage)) + ' after ' + c.horizon + ' years';
    document.querySelector('#housing-result-date').textContent = 'Calculated ' + new Date(output.createdAt).toLocaleString();
    const cards = [
      ['Buying minus renting', signedMoney(m.advantage)], ['After hypothetical sale', signedMoney(m.saleAdvantage)],
      ['Cash needed at closing', money.format(m.closing)], ['Minimum monthly surplus', money.format(m.minSurplus)],
      ['Minimum accessible assets', money.format(m.minAccessible)], ['Budget thresholds', m.budgetPass ? 'Pass' : 'Review']
    ];
    document.querySelector('#housing-metrics').innerHTML = cards.map(x => '<article><span>'+x[0]+'</span><strong>'+x[1]+'</strong></article>').join('');
    const warnings=[];
    if (!m.feasible) warnings.push('The buying path exhausts accessible resources during the forecast. Later values are not practically fundable without changing an assumption.');
    if (!m.budgetPass) warnings.push('The buying path falls below at least one surplus or accessible-assets threshold you entered.');
    warnings.push('These are scenario outputs, not forecasts or financial advice.');
    document.querySelector('#housing-warning').innerHTML = warnings.map(w=>'<p>'+w+'</p>').join('');
    document.querySelector('#housing-periods').innerHTML = output.periods.map(p=>'<tr><td>'+p.year+'</td><td>'+money.format(p.buy)+'</td><td>'+money.format(p.rent)+'</td><td class="'+(p.difference>=0?'positive':'negative')+'">'+signedMoney(p.difference)+'</td></tr>').join('');
    document.querySelector('#housing-stress').innerHTML = output.stress.map(s=>'<article><div><strong>'+s.name+'</strong><span>Minimum accessible '+money.format(s.minAccessible)+'</span></div><b class="'+(s.advantage>=0?'positive':'negative')+'">'+signedMoney(s.advantage)+'</b></article>').join('');
    const max=Math.max(...output.sensitivity.values.flat().map(Math.abs),1);
    document.querySelector('#housing-sensitivity').innerHTML = '<div class="heat-head"><span>Appreciation ↓ / return →</span>'+output.sensitivity.returns.map(r=>'<b>'+r+'%</b>').join('')+'</div>'+output.sensitivity.values.map((row,i)=>'<div class="heat-row"><b>'+output.sensitivity.appreciation[i]+'%</b>'+row.map(v=>'<span style="--heat:'+(Math.abs(v)/max).toFixed(3)+'" class="'+(v>=0?'positive':'negative')+'">'+signedMoney(v)+'</span>').join('')+'</div>').join('');
    document.querySelector('#housing-audit').textContent = JSON.stringify({ architecture:'Browser-local calculation; no financial inputs transmitted', model:'ritvikmath public housing model 1.0', assumptions:c, dataSources:{ userInputs:'Manual', fred:window.housingFredReferences||'Not requested; manual values active' } },null,2);
    drawChart(); document.querySelector('#housing-results').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function chartSeries() {
    if (!result) return [];
    const buy=result.buy.rows, rent=result.rent.rows;
    if (chartKey==='equity') return [{name:'Home equity',color:'#315fba',values:buy.map(x=>x.equity)}];
    if (chartKey==='spending') return [{name:'Buy spending',color:'#315fba',values:buy.map(x=>x.spending)},{name:'Rent spending',color:'#d96c54',values:rent.map(x=>x.spending)}];
    const key=chartKey;
    return [{name:'Buy',color:'#315fba',values:buy.map(x=>x[key])},{name:'Rent',color:'#d96c54',values:rent.map(x=>x[key])}];
  }
  function drawChart(selected) {
    const canvas=document.querySelector('#housing-chart'), wrap=canvas.parentElement, ctx=canvas.getContext('2d');
    const w=wrap.clientWidth, h=w<560?330:410, ratio=Math.min(devicePixelRatio||1,2); canvas.width=w*ratio;canvas.height=h*ratio;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(ratio,0,0,ratio,0,0);
    const series=chartSeries(); if(!series.length)return; const all=series.flatMap(s=>s.values); let min=Math.min(0,...all),max=Math.max(...all); if(max===min)max=min+1; const pad={l:w<560?58:78,r:18,t:30,b:42}, pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    const x=i=>pad.l+i/(series[0].values.length-1)*pw,y=v=>pad.t+(max-v)/(max-min)*ph;
    ctx.clearRect(0,0,w,h);ctx.font='10px "DM Mono",monospace';ctx.fillStyle='#747b86';
    for(let i=0;i<=4;i++){const v=max-(max-min)*i/4,py=pad.t+ph*i/4;ctx.strokeStyle='rgba(25,37,59,.1)';ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(w-pad.r,py);ctx.stroke();ctx.textAlign='right';ctx.fillText(money.format(v),pad.l-8,py);}
    series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.beginPath();s.values.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke();});
    [0,Math.floor((series[0].values.length-1)/2),series[0].values.length-1].forEach(i=>{ctx.fillStyle='#747b86';ctx.textAlign=i===0?'left':i===series[0].values.length-1?'right':'center';ctx.fillText('Year '+Math.round(i/12),x(i),h-16);});
    ctx.textAlign='left';series.forEach((s,i)=>{ctx.fillStyle=s.color;ctx.fillRect(pad.l+i*105,8,12,3);ctx.fillStyle='#4f5661';ctx.fillText(s.name,pad.l+18+i*105,10);});
    chartPoints={x,y,pad,pw,ph,w,h,series}; if(selected!=null){const i=Math.max(0,Math.min(series[0].values.length-1,selected));ctx.strokeStyle='rgba(25,37,59,.3)';ctx.beginPath();ctx.moveTo(x(i),pad.t);ctx.lineTo(x(i),pad.t+ph);ctx.stroke();}
  }

  function readSaves(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch(e){return [];}}
  function writeSaves(items){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(items));return true;}catch(e){showError('This browser could not save the comparison. Storage may be unavailable or full.');return false;}}
  function renderSaves(){const saves=readSaves();document.querySelector('#housing-save-count').textContent=saves.length;document.querySelector('#housing-saved-list').innerHTML=saves.length?saves.map(s=>'<article><div><strong>'+escapeHTML(s.name)+'</strong><span>'+new Date(s.savedAt).toLocaleDateString()+' · '+s.config.horizon+' years</span></div><button type="button" data-open="'+s.id+'">Open</button><button type="button" class="trash" data-delete="'+s.id+'" aria-label="Delete '+escapeHTML(s.name)+'">×</button></article>').join(''):'<p>No saved comparisons on this device.</p>';}
  function showError(message){const el=document.querySelector('#housing-error');el.textContent=message;el.hidden=false;}
  function download(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  globalThis.ritvikmathHousingPublic = { payment, simulate, evaluate, defaults: { ...PUBLIC_DEFAULTS } };
  if (!root) return;

  document.querySelectorAll('.housing-step-nav button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.housing-step-nav button').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==button.dataset.step);}));
  document.querySelector('#housing-form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('#housing-error').hidden=true;try{render(evaluate(readConfig()));}catch(error){showError(error.message);}});
  document.querySelector('#housing-reset').addEventListener('click',()=>{setDefaults(PUBLIC_DEFAULTS);result=null;document.querySelector('#housing-results').hidden=true;document.querySelector('#housing-error').hidden=true;});
  document.querySelector('#housing-save').addEventListener('click',()=>{try{if(!result)result=evaluate(readConfig());const saves=readSaves(),snapshot={id:String(Date.now()),name:result.config.name, savedAt:new Date().toISOString(),config:result.config,result};saves.unshift(snapshot);if(writeSaves(saves))renderSaves();}catch(error){showError(error.message);}});
  document.querySelector('#housing-saved-list').addEventListener('click',event=>{const open=event.target.dataset.open,del=event.target.dataset.delete,saves=readSaves();if(open){const saved=saves.find(x=>x.id===open);if(saved){setDefaults(saved.config);render(saved.result);}}if(del){const index=saves.findIndex(x=>x.id===del);if(index>=0){deletedSave={item:saves[index],index};saves.splice(index,1);if(writeSaves(saves)){renderSaves();document.querySelector('#housing-undo-wrap').hidden=false;}}}});
  document.querySelector('#housing-undo').addEventListener('click',()=>{if(!deletedSave)return;const saves=readSaves();saves.splice(deletedSave.index,0,deletedSave.item);if(writeSaves(saves)){deletedSave=null;renderSaves();document.querySelector('#housing-undo-wrap').hidden=true;}});
  document.querySelector('#housing-export').addEventListener('click',()=>{try{if(!result)result=evaluate(readConfig());download('housing-comparison.json',JSON.stringify(result,null,2),'application/json');}catch(error){showError(error.message);}});
  document.querySelector('#housing-csv').addEventListener('click',()=>{try{if(!result)result=evaluate(readConfig());const rows=['month,buy_net_worth,rent_net_worth,buy_accessible,rent_accessible,home_equity,mortgage_balance'];result.buy.rows.forEach((b,i)=>{const r=result.rent.rows[i];rows.push([i,b.netWorth,r.netWorth,b.accessible,r.accessible,b.equity,b.balance].map(v=>typeof v==='number'?v.toFixed(2):v).join(','));});download('housing-monthly.csv',rows.join('\n'),'text/csv');}catch(error){showError(error.message);}});
  document.querySelectorAll('.housing-chart-tabs button').forEach(button=>button.addEventListener('click',()=>{chartKey=button.dataset.chart;document.querySelectorAll('.housing-chart-tabs button').forEach(x=>x.classList.toggle('active',x===button));drawChart();}));
  document.querySelector('#housing-chart').addEventListener('pointermove',event=>{if(!chartPoints.series)return;const rect=event.target.getBoundingClientRect(),i=Math.round((event.clientX-rect.left-chartPoints.pad.l)/chartPoints.pw*(chartPoints.series[0].values.length-1));drawChart(i);const tip=document.querySelector('#housing-tooltip'),safe=Math.max(0,Math.min(chartPoints.series[0].values.length-1,i));tip.innerHTML='<strong>Year '+(safe/12).toFixed(1)+'</strong>'+chartPoints.series.map(s=>'<span>'+s.name+' '+money.format(s.values[safe])+'</span>').join('');tip.hidden=false;tip.style.left=Math.max(8,Math.min(rect.width-180,event.clientX-rect.left+12))+'px';tip.style.top='45px';});
  document.querySelector('#housing-chart').addEventListener('pointerleave',()=>{document.querySelector('#housing-tooltip').hidden=true;drawChart();});
  window.addEventListener('resize',()=>{if(result)drawChart();},{passive:true});

  document.querySelector('#housing-live-refresh').addEventListener('click',async()=>{
    const status=document.querySelector('#housing-live-status');status.textContent='Checking public FRED observations…';
    const specs=[['Mortgage benchmark','MORTGAGE30US'],['CPI','CPIAUCSL'],['Rent index','CUSR0000SEHA'],['Treasury reference','DGS3MO'],['House-price index','USSTHPI']];
    try{
      const observations=await Promise.all(specs.map(async([label,series])=>{const response=await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+series,{cache:'no-store'});if(!response.ok)throw new Error('FRED returned '+response.status);const lines=(await response.text()).trim().split(/\r?\n/);for(let i=lines.length-1;i>0;i--){const parts=lines[i].split(',');if(parts[1]&&parts[1]!=='.')return {label,series,date:parts[0],value:Number(parts[1]),source:'https://fred.stlouisfed.org/series/'+series,applied:false};}throw new Error('No observation for '+series);}));
      window.housingFredReferences=observations;status.innerHTML=observations.map(o=>'<a href="'+o.source+'" target="_blank" rel="noopener">'+o.label+'</a>: '+o.value+' ('+o.date+', reference only)').join('<br>');
    }catch(error){status.textContent='FRED data is unavailable in this browser. Manual assumptions remain active. '+error.message;}
  });

  setDefaults(PUBLIC_DEFAULTS); renderSaves();
}());
