// ==UserScript==
// @name         Plinko Counter v1
// @namespace    hi
// @version      1.0
// @author       ZSB
// @description  numbers
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'plinko_mult_counts_v3';

  const RISK_DATA = {
    Low: {
      high: [[14.97,'yellow'],[8.42,'red'],[4.32,'red'],[2.67,'violet']],
      low:  [[1.3,'violet'],[1.12,'violet'],[1,'violet'],[0.8,'blue'],[0.5,'blue']],
    },
    Medium: {
      high: [[103,'yellow'],[24,'yellow'],[9,'red'],[5,'red']],
      low:  [[2.2,'violet'],[1.4,'violet'],[0.6,'blue'],[0.4,'blue'],[0.2,'blue']],
    },
    High: {
      high: [[250,'yellow'],[50,'yellow'],[25,'yellow'],[6.5,'red']],
      low:  [[2.2,'violet'],[1.22,'violet'],[0.03,'blue'],[0.02,'blue'],[0.01,'blue']],
    },
    Extreme: {
      high: [[1000,'yellow'],[165,'yellow'],[13,'yellow']],
      low:  [[0.06,'blue'],[0.05,'blue'],[0.04,'blue'],[0.03,'blue'],[0.02,'blue'],[0.01,'blue']],
    },
  };
  const RISKS = ['Low','Medium','High','Extreme'];

  function colorVar(c) { return `var(--mantine-color-${c}-text)`; }
  function fmt(m) {
    if (Number.isInteger(m) && m >= 1) return m + 'x';
    if (m >= 1) return parseFloat(m.toFixed(2)) + 'x';
    return m.toFixed(2) + 'x';
  }
  function loadCounts() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
  function saveCounts(c) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

  const sessionCounts = {};

  function getCurrentRisk() {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.trim() === 'Risk') {
        const wrapper = label.closest('.mantine-InputWrapper-root');
        if (wrapper) { const input = wrapper.querySelector('input'); if (input && input.value) return input.value; }
      }
    }
    return 'Extreme';
  }

  let nextId = 0;
  const pendingResults = [];
  function parseMult(text) { return parseFloat(text.trim().replace('x','')); }

  let lastMultContainer = null, lastMultObserver = null, knownCards = new Set();

  function findLastMultContainer() {
    for (const el of document.querySelectorAll('p')) {
      if (el.textContent.trim() === 'Last Multipliers') {
        const sa = el.nextElementSibling;
        if (sa) { const g = sa.querySelector('[class*="Group"]'); if (g) return g; }
      }
    }
    return null;
  }

  function onLastMultMutation() {
    if (!lastMultContainer) return;
    for (const child of lastMultContainer.children) {
      if (knownCards.has(child)) continue;
      knownCards.add(child);
      const pEl = child.querySelector('p'); if (!pEl) continue;
      const newMult = parseMult(pEl.textContent); if (isNaN(newMult)) continue;
      const idx = pendingResults.findIndex(p => p.multiplier === newMult);
      if (idx !== -1) { const r = pendingResults.splice(idx,1)[0]; incrementMultWithRisk(r.multiplier, r.risk); }
    }
    const current = new Set(lastMultContainer.children);
    for (const card of knownCards) { if (!current.has(card)) knownCards.delete(card); }
  }

  function watchLastMults() {
    const container = findLastMultContainer();
    if (!container || container === lastMultContainer) return;
    if (lastMultObserver) lastMultObserver.disconnect();
    lastMultContainer = container;
    knownCards = new Set(container.children);
    lastMultObserver = new MutationObserver(() => onLastMultMutation());
    lastMultObserver.observe(container, { childList: true });
  }

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return; stylesInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      #pc-wrapper { margin-top:calc(0.625rem * var(--mantine-scale,1)); padding-top:calc(0.625rem * var(--mantine-scale,1)); border-top:1px solid rgba(255,255,255,0.06); }
      #pc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
      #pc-header-label { font-size:var(--mantine-font-size-sm,14px); color:var(--mantine-color-text,#C1C2C5); margin:0; font-weight:500; }
      #pc-header-right { display:flex; align-items:center; gap:6px; }
      #pc-risk-badge { font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; background:rgba(255,255,255,0.06); color:var(--mantine-color-dark-2,#909296); }
      #pc-reset { background:none; border:none; color:var(--mantine-color-dark-2,#909296); font-size:var(--mantine-font-size-xs,12px); cursor:pointer; padding:2px 6px; border-radius:4px; font-family:inherit; }
      #pc-reset:hover { color:var(--mantine-color-text,#C1C2C5); background:rgba(255,255,255,0.05); }

      #pc-high { display:flex; gap:5px; justify-content:center; }
      .pc-cell { display:flex; flex-direction:column; align-items:center; flex:1 1 0; min-width:0; }
      .pc-mult { width:100%; text-align:center; font-size:10px; font-weight:800; padding:3px 0; border-radius:10px 10px 0 0; background:rgb(37,38,43); white-space:nowrap; }
      .pc-count { width:100%; text-align:center; font-size:13px; font-weight:700; padding:4px 0; background:rgba(37,38,43,0.5); border-radius:0 0 6px 6px; color:var(--mantine-color-text,#C1C2C5); }
      .pc-cell.flash .pc-count { animation:pc-pop 0.4s ease-out; }
      @keyframes pc-pop { 0%{transform:scale(1.35);color:#fff} 100%{transform:scale(1)} }

      #pc-low-wrap { position:relative; margin-top:5px; }
      #pc-low-trigger { width:100%; background:rgba(37,38,43,0.5); border:none; border-radius:6px; color:var(--mantine-color-dark-2,#909296); font-size:var(--mantine-font-size-xs,12px); font-family:inherit; padding:5px 10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.15s,color 0.15s; }
      #pc-low-trigger:hover { background:rgb(37,38,43); color:var(--mantine-color-text,#C1C2C5); }
      #pc-low-trigger svg { transition:transform 0.2s; }
      #pc-low-wrap:hover #pc-low-trigger svg { transform:rotate(180deg); }
      #pc-low-dropdown { display:none; margin-top:4px; gap:4px; }
      #pc-low-wrap:hover #pc-low-dropdown { display:grid; }

      #pc-total { text-align:center; font-size:var(--mantine-font-size-xs,12px); color:var(--mantine-color-dark-2,#909296); margin-top:6px; }

      .pc-stats-wrap { margin-top:6px; border-top:1px solid rgba(255,255,255,0.04); padding-top:6px; }
      .pc-stats-trigger { width:100%; background:none; border:none; border-radius:6px; color:var(--mantine-color-dark-2,#909296); font-size:var(--mantine-font-size-xs,12px); font-family:inherit; padding:4px 10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.15s,color 0.15s; }
      .pc-stats-trigger:hover { background:rgba(255,255,255,0.03); color:var(--mantine-color-text,#C1C2C5); }
      .pc-stats-trigger svg { transition:transform 0.2s; }
      .pc-stats-trigger[aria-expanded="true"] svg { transform:rotate(180deg); }
      .pc-stats-body { display:none; padding:6px 0 0; }
      .pc-stats-body.open { display:block; }

      .pc-filter-row { display:flex; gap:3px; margin-bottom:6px; flex-wrap:wrap; }
      .pc-filter-pill { font-size:9px; font-weight:600; padding:2px 7px; border-radius:10px; border:1px solid rgba(255,255,255,0.08); background:none; cursor:pointer; color:var(--mantine-color-dark-2,#909296); font-family:inherit; transition:all 0.15s; }
      .pc-filter-pill:hover { border-color:rgba(255,255,255,0.15); }
      .pc-filter-pill.active { background:rgba(255,255,255,0.08); color:var(--mantine-color-text,#C1C2C5); border-color:rgba(255,255,255,0.15); }

      .pc-stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:6px; }
      .pc-stat-item { background:rgba(37,38,43,0.4); border-radius:6px; padding:6px 8px; text-align:center; }
      .pc-stat-val { font-size:14px; font-weight:700; color:var(--mantine-color-text,#C1C2C5); }
      .pc-stat-val.green { color:var(--mantine-color-green-text); }
      .pc-stat-val.red { color:var(--mantine-color-red-text); }
      .pc-stat-label { font-size:9px; font-weight:600; color:var(--mantine-color-dark-2,#909296); margin-top:1px; }

      .pc-stats-mults-label { font-size:10px; font-weight:600; color:var(--mantine-color-dark-2,#909296); margin:6px 0 4px 2px; }
      .pc-stats-mult-grid { display:flex; gap:3px; justify-content:center; flex-wrap:wrap; }
      .pc-stats-mult-grid .pc-cell { max-width:52px; }
      .pc-stats-mult-grid .pc-mult { font-size:8px; padding:2px 0; }
      .pc-stats-mult-grid .pc-count { font-size:11px; padding:3px 0; }

      .pc-stats-low-wrap { margin-top:4px; }
      .pc-stats-low-trigger { width:100%; background:rgba(37,38,43,0.3); border:none; border-radius:6px; color:var(--mantine-color-dark-2,#909296); font-size:10px; font-family:inherit; padding:4px 8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.15s,color 0.15s; }
      .pc-stats-low-trigger:hover { background:rgba(37,38,43,0.6); color:var(--mantine-color-text,#C1C2C5); }
      .pc-stats-low-trigger svg { transition:transform 0.2s; }
      .pc-stats-low-wrap:hover .pc-stats-low-trigger svg { transform:rotate(180deg); }
      .pc-stats-low-dropdown { display:none; margin-top:3px; }
      .pc-stats-low-wrap:hover .pc-stats-low-dropdown { display:block; }
    `;
    document.head.appendChild(s);
  }

  function computeStats(source, riskFilter) {
    let drops=0, wins=0, losses=0;
    for (const r of (riskFilter==='All' ? RISKS : [riskFilter])) {
      const data = RISK_DATA[r]; if (!data) continue;
      const rc = source[r] || {};
      for (const [m] of [...data.high,...data.low]) {
        const c = rc[m.toString()]||0; drops+=c;
        if (m>=1) wins+=c; else losses+=c;
      }
    }
    return { drops, wins, losses, winRate: drops>0 ? ((wins/drops)*100).toFixed(1) : '0.0' };
  }

  function buildMultGrid(source, riskFilter) {
    const risks = riskFilter==='All' ? RISKS : [riskFilter];
    let html = '';
    const chevronSmall = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    for (const r of risks) {
      const data = RISK_DATA[r]; if (!data) continue;
      const rc = source[r] || {};
      const riskLabel = riskFilter==='All' ? `<div class="pc-stats-mults-label">${r}</div>` : '';
      let lowTotal = 0;

      const highCells = data.high.map(([m,col]) => {
        const c = rc[m.toString()]||0;
        return `<div class="pc-cell"><div class="pc-mult" style="color:${colorVar(col)}">${fmt(m)}</div><div class="pc-count">${c}</div></div>`;
      }).join('');

      const lowCells = data.low.map(([m,col]) => {
        const c = rc[m.toString()]||0; lowTotal+=c;
        return `<div class="pc-cell"><div class="pc-mult" style="color:${colorVar(col)}">${fmt(m)}</div><div class="pc-count">${c}</div></div>`;
      }).join('');

      html += `${riskLabel}<div class="pc-stats-mult-grid">${highCells}</div>
        <div class="pc-stats-low-wrap"><button class="pc-stats-low-trigger"><span>Low (${lowTotal})</span>${chevronSmall}</button>
        <div class="pc-stats-low-dropdown"><div class="pc-stats-mult-grid">${lowCells}</div></div></div>`;
    }
    return html;
  }

  function buildStatsHTML(prefix, source, activeFilter) {
    const filter = activeFilter||'All';
    const stats = computeStats(source, filter);
    const pills = ['All',...RISKS].map(r =>
      `<button class="pc-filter-pill ${r===filter?'active':''}" data-prefix="${prefix}" data-risk="${r}">${r}</button>`
    ).join('');
    return `
      <div class="pc-filter-row">${pills}</div>
      <div class="pc-stats-grid">
        <div class="pc-stat-item"><div class="pc-stat-val">${stats.drops}</div><div class="pc-stat-label">Drops</div></div>
        <div class="pc-stat-item"><div class="pc-stat-val">${stats.winRate}%</div><div class="pc-stat-label">Win Rate</div></div>
        <div class="pc-stat-item"><div class="pc-stat-val green">${stats.wins}</div><div class="pc-stat-label">Wins (≥1x)</div></div>
        <div class="pc-stat-item"><div class="pc-stat-val red">${stats.losses}</div><div class="pc-stat-label">Losses (&lt;1x)</div></div>
      </div>
      ${buildMultGrid(source, filter)}`;
  }

  let sessionStatsOpen=false, totalStatsOpen=false, sessionFilter='All', totalFilter='All';
  const chevron = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function buildWidget(risk) {
    const data = RISK_DATA[risk]; if (!data) return null;
    const allCounts = loadCounts();

    const sc = sessionCounts[risk] || {};
    let total=0, lowTotal=0;

    const highCells = data.high.map(([m,col],i) => {
      const c = sc[m.toString()]||0; total+=c;
      return `<div class="pc-cell" id="pc-h${i}"><div class="pc-mult" style="color:${colorVar(col)}">${fmt(m)}</div><div class="pc-count">${c}</div></div>`;
    }).join('');

    const lowCells = data.low.map(([m,col],i) => {
      const c = sc[m.toString()]||0; total+=c; lowTotal+=c;
      return `<div class="pc-cell" id="pc-l${i}"><div class="pc-mult" style="color:${colorVar(col)}">${fmt(m)}</div><div class="pc-count">${c}</div></div>`;
    }).join('');

    const w = document.createElement('div');
    w.id = 'pc-wrapper';
    w.dataset.risk = risk;
    w.innerHTML = `
      <div id="pc-header">
        <p id="pc-header-label">Session Hits</p>
        <div id="pc-header-right">
          <span id="pc-risk-badge">${risk}</span>
          <button id="pc-reset">Reset</button>
        </div>
      </div>
      <div id="pc-high">${highCells}</div>
      <div id="pc-low-wrap">
        <button id="pc-low-trigger"><span>Low multipliers <span id="pc-low-total" style="opacity:0.6">(${lowTotal})</span></span>${chevron}</button>
        <div id="pc-low-dropdown" style="grid-template-columns:repeat(${data.low.length},1fr)">${lowCells}</div>
      </div>
      <div id="pc-total">Session: ${total}</div>

      <div class="pc-stats-wrap">
        <button class="pc-stats-trigger" id="pc-session-trigger" aria-expanded="${sessionStatsOpen}"><span>Session Stats</span>${chevron}</button>
        <div class="pc-stats-body ${sessionStatsOpen?'open':''}" id="pc-session-body">${buildStatsHTML('session', sessionCounts, sessionFilter)}</div>
      </div>

      <div class="pc-stats-wrap">
        <button class="pc-stats-trigger" id="pc-total-trigger" aria-expanded="${totalStatsOpen}"><span>Total Stats</span>${chevron}</button>
        <div class="pc-stats-body ${totalStatsOpen?'open':''}" id="pc-total-body">${buildStatsHTML('total', allCounts, totalFilter)}</div>
      </div>`;
    return w;
  }

  function findCard() {
    for (const el of document.querySelectorAll('p')) { if (el.textContent.trim()==='Last Multipliers') return el.closest('[class*="Card-root"]'); }
    for (const el of document.querySelectorAll('p')) { if (el.textContent.trim()==='Wagered') return el.closest('[class*="Card-root"]'); }
    return null;
  }

  function attachListeners(widget) {
    widget.querySelector('#pc-reset')?.addEventListener('click', () => {
      const r = getCurrentRisk();

      sessionCounts[r] = {};
      replaceWidget(r);
    });

    widget.querySelector('#pc-session-trigger')?.addEventListener('click', () => {
      sessionStatsOpen = !sessionStatsOpen;
      const body = document.getElementById('pc-session-body');
      const trigger = document.getElementById('pc-session-trigger');
      if (body) body.classList.toggle('open', sessionStatsOpen);
      if (trigger) trigger.setAttribute('aria-expanded', sessionStatsOpen);
    });

    widget.querySelector('#pc-total-trigger')?.addEventListener('click', () => {
      totalStatsOpen = !totalStatsOpen;
      const body = document.getElementById('pc-total-body');
      const trigger = document.getElementById('pc-total-trigger');
      if (body) body.classList.toggle('open', totalStatsOpen);
      if (trigger) trigger.setAttribute('aria-expanded', totalStatsOpen);
    });

    widget.addEventListener('click', (e) => {
      const pill = e.target.closest('.pc-filter-pill');
      if (!pill) return;
      const prefix = pill.dataset.prefix, risk = pill.dataset.risk;
      if (prefix==='session') { sessionFilter=risk; const b=document.getElementById('pc-session-body'); if(b) b.innerHTML=buildStatsHTML('session',sessionCounts,sessionFilter); }
      else if (prefix==='total') { totalFilter=risk; const b=document.getElementById('pc-total-body'); if(b) b.innerHTML=buildStatsHTML('total',loadCounts(),totalFilter); }
    });
  }

  function replaceWidget(risk) {
    const existing = document.getElementById('pc-wrapper');
    const parent = existing?.parentNode || findCard();
    if (existing) existing.remove();
    if (!parent) return;
    const widget = buildWidget(risk); if (!widget) return;
    parent.appendChild(widget);
    attachListeners(widget);
  }

  function ensureWidget() {
    injectStyles(); watchLastMults();
    const risk = getCurrentRisk();
    const existing = document.getElementById('pc-wrapper');
    if (existing && existing.parentNode && existing.dataset.risk===risk) return;
    replaceWidget(risk);
  }

  function renderCounts(risk) {
    const data = RISK_DATA[risk]; if (!data) return;

    const sc = sessionCounts[risk] || {};
    let total=0, lowTotal=0;

    data.high.forEach(([m],i) => {
      const c = sc[m.toString()]||0; total+=c;
      const el = document.getElementById(`pc-h${i}`);
      if (el) el.querySelector('.pc-count').textContent = c;
    });
    data.low.forEach(([m],i) => {
      const c = sc[m.toString()]||0; total+=c; lowTotal+=c;
      const el = document.getElementById(`pc-l${i}`);
      if (el) el.querySelector('.pc-count').textContent = c;
    });

    const totalEl = document.getElementById('pc-total');
    if (totalEl) totalEl.textContent = `Session: ${total}`;
    const lowTotalEl = document.getElementById('pc-low-total');
    if (lowTotalEl) lowTotalEl.textContent = `(${lowTotal})`;

    if (sessionStatsOpen) { const b=document.getElementById('pc-session-body'); if(b) b.innerHTML=buildStatsHTML('session',sessionCounts,sessionFilter); }
    if (totalStatsOpen) { const b=document.getElementById('pc-total-body'); if(b) b.innerHTML=buildStatsHTML('total',loadCounts(),totalFilter); }
  }

  function flashCell(multiplier, risk) {
    const data = RISK_DATA[risk]; if (!data) return;
    const hi = data.high.findIndex(([m])=>m===multiplier);
    const lo = data.low.findIndex(([m])=>m===multiplier);
    const cellId = hi!==-1 ? `pc-h${hi}` : lo!==-1 ? `pc-l${lo}` : null;
    if (cellId) { const cell=document.getElementById(cellId); if(cell){cell.classList.remove('flash');void cell.offsetWidth;cell.classList.add('flash');} }
  }

  function incrementMultWithRisk(multiplier, risk) {

    const counts = loadCounts();
    if (!counts[risk]) counts[risk] = {};
    const key = multiplier.toString();
    counts[risk][key] = (counts[risk][key]||0) + 1;
    saveCounts(counts);

    if (!sessionCounts[risk]) sessionCounts[risk] = {};
    sessionCounts[risk][key] = (sessionCounts[risk][key]||0) + 1;

    ensureWidget();
    if (getCurrentRisk()===risk) { renderCounts(risk); flashCell(multiplier, risk); }
  }

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this,args);
    try {
      const url = typeof args[0]==='string' ? args[0] : args[0]?.url||'';
      if (url.includes('/api/casino/plinko')) {
        const riskAtBet = getCurrentRisk();
        const clone = response.clone();
        clone.json().then(data => {
          if (data && typeof data.multiplier==='number') {
            const id = nextId++;
            pendingResults.push({multiplier:data.multiplier, risk:riskAtBet, id});
            setTimeout(()=>{ const idx=pendingResults.findIndex(p=>p.id===id); if(idx!==-1){pendingResults.splice(idx,1);incrementMultWithRisk(data.multiplier,riskAtBet);} },8000);
          }
        }).catch(()=>{});
      }
    } catch(_){}
    return response;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m,url,...r){this._pUrl=url;return origOpen.call(this,m,url,...r);};
  XMLHttpRequest.prototype.send = function(...args){
    if(this._pUrl&&this._pUrl.includes('/api/casino/plinko')){
      const riskAtBet=getCurrentRisk();
      this.addEventListener('load',function(){
        try{const d=JSON.parse(this.responseText);if(d&&typeof d.multiplier==='number'){const id=nextId++;pendingResults.push({multiplier:d.multiplier,risk:riskAtBet,id});setTimeout(()=>{const idx=pendingResults.findIndex(p=>p.id===id);if(idx!==-1){pendingResults.splice(idx,1);incrementMultWithRisk(d.multiplier,riskAtBet);}},8000);}}catch(_){}
      });
    }
    return origSend.apply(this,args);
  };

  new MutationObserver(()=>ensureWidget()).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(ensureWidget,500);
  if(document.readyState!=='loading') ensureWidget(); else document.addEventListener('DOMContentLoaded',()=>ensureWidget());
})();