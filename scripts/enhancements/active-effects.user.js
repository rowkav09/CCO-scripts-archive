// ==UserScript==
// @name         Active Effects Overlay
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       ZSB
// @description  effects and stuff
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const POLL_INTERVAL = 60000;
  const COLLAPSED_KEY = 'cc_effects_collapsed';
  const POS_KEY = 'cc_effects_pos';

  let effects = [];
  let collapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';

  const style = document.createElement('style');
  style.textContent = `
    #cc-effects-panel {
      position: fixed; z-index: 9999; width: 280px;
      background: rgb(37, 38, 43);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      font-family: inherit;
      color: var(--mantine-color-text, #C1C2C5);
      overflow: hidden; user-select: none;
    }
    #cc-effects-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; cursor: grab;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    #cc-effects-header:active { cursor: grabbing; }
    #cc-effects-title {
      font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 6px;
    }
    #cc-effects-title .effect-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--mantine-color-green-text, #51cf66);
      animation: cc-pulse 2s ease-in-out infinite;
    }
    @keyframes cc-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    #cc-effects-count {
      font-size: 11px; font-weight: 600; padding: 1px 7px;
      border-radius: 10px; background: rgba(255,255,255,0.06);
      color: var(--mantine-color-dark-2, #909296);
    }
    #cc-effects-header-right { display: flex; align-items: center; gap: 4px; }
    .cc-effects-btn {
      background: none; border: none;
      color: var(--mantine-color-dark-2, #909296);
      cursor: pointer; padding: 4px; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .cc-effects-btn:hover {
      background: rgba(255,255,255,0.06);
      color: var(--mantine-color-text, #C1C2C5);
    }
    #cc-effects-body {
      max-height: 400px; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    #cc-effects-body.collapsed { display: none; }

    .cc-effect-item {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.15s, opacity 0.3s;
    }
    .cc-effect-item:last-child { border-bottom: none; }
    .cc-effect-item:hover { background: rgba(255,255,255,0.02); }
    .cc-effect-item.expired-item {
      opacity: 0.45;
    }
    .cc-effect-item.expired-item:hover { opacity: 0.7; }

    .cc-effect-row1 {
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
    }
    .cc-effect-name {
      font-size: 12px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
    }
    .cc-effect-rarity {
      font-size: 9px; font-weight: 700; padding: 1px 6px;
      border-radius: 4px; white-space: nowrap; flex-shrink: 0;
    }
    .cc-effect-row2 {
      display: flex; justify-content: space-between; align-items: center; margin-top: 4px;
    }
    .cc-effect-value {
      font-size: 11px; color: var(--mantine-color-dark-2, #909296);
    }
    .cc-effect-value span {
      color: var(--mantine-color-text, #C1C2C5); font-weight: 600;
    }
    .cc-effect-timer {
      font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;
      padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.04);
    }
    .cc-effect-timer.urgent { color: var(--mantine-color-red-text, #ff6b6b); background: rgba(255,107,107,0.08); }
    .cc-effect-timer.ok { color: var(--mantine-color-green-text, #51cf66); }
    .cc-effect-timer.warn { color: var(--mantine-color-yellow-text, #fcc419); }
    .cc-effect-timer.expired { color: var(--mantine-color-dark-2, #909296); }

    .cc-effect-row3 {
      display: flex; justify-content: space-between; align-items: center; margin-top: 4px;
    }
    .cc-effect-amount {
      font-size: 10px; color: var(--mantine-color-dark-2, #909296);
    }
    .cc-effect-amount span { color: var(--mantine-color-text, #C1C2C5); font-weight: 600; }

    .cc-reactivate-btn {
      background: none; border: 1px solid rgba(255,255,255,0.1);
      color: var(--mantine-color-dark-2, #909296);
      font-size: 10px; font-weight: 600; font-family: inherit;
      padding: 2px 8px; border-radius: 4px;
      cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; gap: 4px;
    }
    .cc-reactivate-btn:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.2);
      color: var(--mantine-color-text, #C1C2C5);
    }
    .cc-reactivate-btn.loading { opacity: 0.5; pointer-events: none; }
    .cc-reactivate-btn.success {
      border-color: var(--mantine-color-green-text, #51cf66);
      color: var(--mantine-color-green-text, #51cf66);
    }
    .cc-reactivate-btn.error {
      border-color: var(--mantine-color-red-text, #ff6b6b);
      color: var(--mantine-color-red-text, #ff6b6b);
    }

    #cc-effects-empty {
      padding: 20px 14px; text-align: center; font-size: 12px;
      color: var(--mantine-color-dark-2, #909296);
    }
    #cc-effects-footer {
      padding: 6px 14px; text-align: center; font-size: 10px;
      color: var(--mantine-color-dark-2, #909296); opacity: 0.5;
      border-top: 1px solid rgba(255,255,255,0.04);
    }
    #cc-effects-body.collapsed ~ #cc-effects-footer { display: none; }
  `;
  document.head.appendChild(style);

  // ── Effect meta ──
  const EFFECT_META = {
    moneyPerClickBoost:         { label: 'Click Money',        fmt: 'dollar' },
    vaultCapacityBoost:         { label: 'Vault Capacity',     fmt: 'dollar' },
    vaultMoneyPerMinuteBoost:   { label: 'Vault $/min',        fmt: 'dollar' },
    xpBoost:                    { label: 'XP Boost',           fmt: 'percent' },
    casesPerClickBoost:         { label: 'Cases/Click',        fmt: 'percent' },
    casesPerClickMaxPriceBoost: { label: 'Case Click Money',   fmt: 'dollar' },
    caseOpenXpBoost:            { label: 'Case XP Boost',      fmt: 'percent' },
    caseOpenCashback:           { label: 'Case Cashback',      fmt: 'percent' },
    casebattleCashback:         { label: 'Battle Cashback',    fmt: 'percent' },
    caseOpenCountBoost:         { label: 'Extra Cases/Open',   fmt: 'flat' },
    caseOpenMultiplierBoost:    { label: 'Open Multiplier',    fmt: 'flat' },
    moneyMultiplier:            { label: 'Money Multiplier',   fmt: 'multiplier' },
    xpMultiplier:               { label: 'XP Multiplier',      fmt: 'multiplier' },
    caseOpenDiscount:           { label: 'Case Discount',      fmt: 'percent' },
    luckBoost:                  { label: 'Luck Boost',         fmt: 'percent' },
    moneyBoost:                 { label: 'Money Boost',        fmt: 'percent' },
  };

  function effectLabel(effect) {
    return EFFECT_META[effect]?.label || effect.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }

  function formatValue(effect, value) {
    const meta = EFFECT_META[effect];
    if (!meta) return `+${value}`;
    switch (meta.fmt) {
      case 'dollar':     return `+$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0 })}`;
      case 'percent':    return `+${value}%`;
      case 'multiplier': return `×${value}`;
      case 'flat':       return `+${value}`;
      default:           return `+${value}`;
    }
  }

  function formatTime(ms) {
    if (ms <= 0) return 'Expired';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  }

  function timerClass(ms) {
    if (ms <= 0) return 'expired';
    if (ms < 5 * 60 * 1000) return 'urgent';
    if (ms < 30 * 60 * 1000) return 'warn';
    return 'ok';
  }

  // ── Reactivate ──
  async function reactivateEffect(name, btnEl) {
    btnEl.classList.add('loading');
    btnEl.textContent = '...';
    try {
      const resp = await fetch('/api/inventory/specialEffects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (resp.ok) {
        btnEl.classList.remove('loading');
        btnEl.classList.add('success');
        btnEl.textContent = 'Activated!';
        setTimeout(() => fetchEffects(), 500);
      } else {
        const data = await resp.json().catch(() => ({}));
        btnEl.classList.remove('loading');
        btnEl.classList.add('error');
        btnEl.textContent = data.message || 'Failed';
        setTimeout(() => { btnEl.classList.remove('error'); btnEl.innerHTML = reactivateLabel(); }, 3000);
      }
    } catch (e) {
      btnEl.classList.remove('loading');
      btnEl.classList.add('error');
      btnEl.textContent = 'Error';
      setTimeout(() => { btnEl.classList.remove('error'); btnEl.innerHTML = reactivateLabel(); }, 3000);
    }
  }

  const reactivateIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2 11.5a10 10 0 0118.8-4.3"/></svg>`;
  function reactivateLabel() { return `${reactivateIcon} Reactivate`; }

  // ── Panel ──
  const chevronDown = `<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const chevronUp = `<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const refreshIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>`;

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'cc-effects-panel';
    const savedPos = getSavedPos();
    panel.style.top = savedPos.top + 'px';
    panel.style.right = savedPos.right + 'px';

    panel.innerHTML = `
      <div id="cc-effects-header">
        <div id="cc-effects-title">
          <div class="effect-dot"></div>
          Active Effects
          <span id="cc-effects-count">0</span>
        </div>
        <div id="cc-effects-header-right">
          <button class="cc-effects-btn" id="cc-effects-refresh" title="Refresh">${refreshIcon}</button>
          <button class="cc-effects-btn" id="cc-effects-collapse" title="Toggle">${collapsed ? chevronDown : chevronUp}</button>
        </div>
      </div>
      <div id="cc-effects-body" class="${collapsed ? 'collapsed' : ''}"></div>
      <div id="cc-effects-footer">Updates every 60s</div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#cc-effects-collapse').addEventListener('click', (e) => {
      e.stopPropagation();
      collapsed = !collapsed;
      localStorage.setItem(COLLAPSED_KEY, collapsed);
      document.getElementById('cc-effects-body')?.classList.toggle('collapsed', collapsed);
      document.getElementById('cc-effects-collapse').innerHTML = collapsed ? chevronDown : chevronUp;
    });

    panel.querySelector('#cc-effects-refresh').addEventListener('click', (e) => {
      e.stopPropagation();
      fetchEffects();
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('.cc-reactivate-btn');
      if (!btn) return;
      e.stopPropagation();
      const name = btn.dataset.name;
      if (name) reactivateEffect(name, btn);
    });

    makeDraggable(panel, panel.querySelector('#cc-effects-header'));
    return panel;
  }

  function getSavedPos() {
    try { const p = JSON.parse(localStorage.getItem(POS_KEY)); if (p && typeof p.top === 'number') return p; } catch {}
    return { top: 80, right: 16 };
  }

  function makeDraggable(panel, handle) {
    let dragging = false, startX, startY, startTop, startRight;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.cc-effects-btn')) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startTop = rect.top; startRight = window.innerWidth - rect.right;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.top = Math.max(0, Math.min(window.innerHeight - 50, startTop + (e.clientY - startY))) + 'px';
      panel.style.right = Math.max(0, Math.min(window.innerWidth - 100, startRight - (e.clientX - startX))) + 'px';
      panel.style.left = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return; dragging = false;
      const rect = panel.getBoundingClientRect();
      localStorage.setItem(POS_KEY, JSON.stringify({ top: rect.top, right: window.innerWidth - rect.right }));
    });
  }

  // ── Render ──
  function renderEffects() {
    const body = document.getElementById('cc-effects-body');
    const countEl = document.getElementById('cc-effects-count');
    if (!body) return;

    const now = Date.now();

    // Sort: active first (soonest expiry), then expired (most recently expired first)
    const sorted = [...effects].sort((a, b) => {
      const aMs = new Date(a.activeTill).getTime() - now;
      const bMs = new Date(b.activeTill).getTime() - now;
      const aActive = aMs > 0;
      const bActive = bMs > 0;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (aActive && bActive) return aMs - bMs; // soonest first
      return bMs - aMs; // most recently expired first
    });

    const activeCount = sorted.filter(e => new Date(e.activeTill).getTime() > now).length;
    if (countEl) countEl.textContent = activeCount;

    if (sorted.length === 0) {
      body.innerHTML = `<div id="cc-effects-empty">No effects</div>`;
      return;
    }

    body.innerHTML = sorted.map(e => {
      const ms = new Date(e.activeTill).getTime() - now;
      const isActive = ms > 0;
      const isExpired = !isActive;
      const hasStock = e.amount > 0;

      return `
        <div class="cc-effect-item ${isExpired ? 'expired-item' : ''}" data-id="${e._id}">
          <div class="cc-effect-row1">
            <div class="cc-effect-name">${e.name}</div>
            <div class="cc-effect-rarity" style="background:${e.rarityColor}20; color:${e.rarityColor}">${e.rarity.replace(' Grade', '')}</div>
          </div>
          <div class="cc-effect-row2">
            <div class="cc-effect-value">${effectLabel(e.effect)}: <span>${formatValue(e.effect, e.value)}</span></div>
            <div class="cc-effect-timer ${timerClass(ms)}" data-till="${e.activeTill}">${formatTime(ms)}</div>
          </div>
          <div class="cc-effect-row3">
            <div class="cc-effect-amount">${hasStock ? `Stock: <span>${e.amount}</span>` : '<span style="opacity:0.4">No stock</span>'}</div>
            ${isExpired && hasStock ? `<button class="cc-reactivate-btn" data-name="${e.name.replace(/"/g, '&quot;')}">${reactivateLabel()}</button>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function tickTimers() {
    const now = Date.now();
    let needsRerender = false;

    document.querySelectorAll('.cc-effect-timer[data-till]').forEach(el => {
      const ms = new Date(el.dataset.till).getTime() - now;
      const newText = formatTime(ms);
      if (el.textContent !== newText) el.textContent = newText;
      const newClass = `cc-effect-timer ${timerClass(ms)}`;
      if (el.className !== newClass) el.className = newClass;

      // If just expired, trigger a re-render to show the reactivate button
      if (ms <= 0) {
        const item = el.closest('.cc-effect-item');
        if (item && !item.classList.contains('expired-item')) needsRerender = true;
      }
    });

    const activeCount = effects.filter(e => new Date(e.activeTill).getTime() > now).length;
    const countEl = document.getElementById('cc-effects-count');
    if (countEl) countEl.textContent = activeCount;

    if (needsRerender) renderEffects();
  }

  // ── Fetch ──
  async function fetchEffects() {
    try {
      const resp = await fetch('/api/me', { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.activeSpecialEffects)) {
        effects = data.activeSpecialEffects;
        renderEffects();
      }
    } catch (e) { console.error('[CC Effects]', e); }
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/api/me')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (Array.isArray(data.activeSpecialEffects)) { effects = data.activeSpecialEffects; renderEffects(); }
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  createPanel();
  fetchEffects();
  setInterval(tickTimers, 1000);
  setInterval(fetchEffects, POLL_INTERVAL);
})();