// ==UserScript==
// @name         Case Clicker Pricedata Overlay
// @namespace    cco-pricedata
// @version      3.4
// @author       rowan
// @credits      zhiro for basescript, chunkycheese for pricedata
// @description  shows inv/su calculated value (pricedata x quality x event multiplier + stickers), optional pricedata-based sort toggle, calculated price on cards (hover for original QS price), and a copy-link button on trade/chat/other-SU cards.
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    SHEET_ID: '1DmJr6L6oIUZPDUZBg0DxnqZ8Xhk7nhzLOy6jv3yi02A',
    PRICE_DATA_GID: 1858636668,
    LIST_GID: 1167749951,
    // "List" is the flattened/curated sheet this script was originally built to read, but
    // it isn't kept fully in sync with the per-pattern "theme" tabs (e.g. it was missing
    // Karambit | Marble Fade (Fire and Ice), which does exist over in the Fade(Knife) tab).
    // We pull all of these in too and merge them, so any pattern present in ANY tab resolves.
    PATTERN_TAB_GIDS: [
      804117923,  // Case Hardened
      432507967,  // Crimson Web
      227423715,  // Slaughter
      505008107,  // Fade(Knife)
      1043476832, // Fade
      1523542442, // Doppler
      835833766,  // Misc
      1392766620, // Glove
      1701984234, // Case
      212043798,  // Collection
      1504192657, // LTD
      1549085063, // Golds
    ],
    REFRESH_MS: 5 * 60 * 1000,
    CACHE_MS: 60 * 1000,
    QUALITY_BASE: 7,
  };

  const EXT_COL = { 'Factory New': 4, 'Minimal Wear': 5, 'Field-Tested': 6, 'Well-Worn': 7, 'Battle-Scarred': 8 };

  const origFetch = window.fetch.bind(window);

  let priceDataByName = new Map();
  let listByPatternId = new Map();
  let dataReady = false;

  let sortMode = localStorage.getItem('cco_sortMode') === 'pricedata' ? 'pricedata' : 'native';
  let nativePageSkins = [];   // last skins array actually fetched for the visible page, in server order
  let currentPageSkins = [];  // mirrors nativePageSkins; index i always pairs with the i-th .mantine-Card-root
                              // in DOM order (visual sort uses CSS `order`, so DOM order never changes)
  const totalsCache = new Map();

  // Per-skin-instance "include in total" toggle. Deliberately in-memory only (never touches
  // localStorage) — resets to "everything included" on every reload, per spec. Keyed by the
  // skin's own _id from the API, since that's stable per-instance across re-renders.
  const excludedIds = new Set();
  function isIncluded(id) { return !id || !excludedIds.has(id); }
  function setIncluded(id, included) {
    if (!id) return;
    if (included) excludedIds.delete(id); else excludedIds.add(id);
    totalsCache.clear();
    scheduleTick();
  }

  // ---------- CSV helpers ----------
  function csvUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function parseMagnitude(str) {
    if (str == null) return null;
    str = String(str).trim();
    if (!str || str.toUpperCase() === 'N/A') return null;
    const m = str.match(/^([\-+]?[\d.,]+)\s*([kKmMbB])?$/);
    if (!m) { const n = parseFloat(str.replace(/,/g, '')); return isNaN(n) ? null : n; }
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(n)) return null;
    const suf = (m[2] || '').toLowerCase();
    if (suf === 'k') n *= 1e3; else if (suf === 'm') n *= 1e6; else if (suf === 'b') n *= 1e9;
    return n;
  }

  function parseAdjustment(str) {
    if (str == null) return null;
    str = String(str).trim();
    if (!str || str.toUpperCase() === 'N/A') return null;
    if (str[0] === 'x' || str[0] === 'X') { const v = parseFloat(str.slice(1)); return isNaN(v) ? null : { type: 'mult', value: v }; }
    if (str[0] === '+') { const v = parseMagnitude(str.slice(1)); return v == null ? null : { type: 'add', value: v }; }
    if (str[0] === '-') { const v = parseMagnitude(str.slice(1)); return v == null ? null : { type: 'add', value: -v }; }
    return null;
  }

  // The per-pattern "theme" tabs (Case Hardened, Fade, Doppler, etc.) don't share a fixed
  // column layout with each other or with "List" — some have FT/WW/BS columns, some don't,
  // some split ST/SV into two columns, some combine them ("ST (MW)", "ST/SV"). So instead of
  // fixed indices we read each tab's own header row and synthesize a "List"-shaped row
  // (same 31-slot layout calcPrice already expects) out of whichever columns exist.
  function parsePatternTabToListRows(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const idx = {};
    rows[0].forEach((h, i) => {
      const key = String(h).trim().toUpperCase();
      if (key === 'PATTERNID') idx.patternId = i;
      else if (key === 'FN') idx.fn = i;
      else if (key === 'MW') idx.mw = i;
      else if (key === 'FT') idx.ft = i;
      else if (key === 'WW') idx.ww = i;
      else if (key === 'BS') idx.bs = i;
      else if (key === 'EV') idx.ev = i;
      else if (idx.st == null && (key === 'ST' || key === 'ST (MW)' || key === 'ST/SV')) idx.st = i;
      else if (idx.sv == null && key === 'SV') idx.sv = i;
    });
    if (idx.patternId == null) return [];
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const pid = row[idx.patternId] && row[idx.patternId].trim();
      if (!pid) continue; // section-header / blank spacer rows carry no PatternId
      const listRow = new Array(31).fill('');
      if (idx.fn != null) listRow[4] = row[idx.fn];
      if (idx.mw != null) listRow[5] = row[idx.mw];
      if (idx.ft != null) listRow[6] = row[idx.ft];
      if (idx.ww != null) listRow[7] = row[idx.ww];
      if (idx.bs != null) listRow[8] = row[idx.bs];
      // Some tabs only have one combined ST/SV-style column; mirror it into both slots
      // since an item is only ever eligible for one of StatTrak/Souvenir anyway.
      const stVal = idx.st != null ? row[idx.st] : (idx.sv != null ? row[idx.sv] : '');
      const svVal = idx.sv != null ? row[idx.sv] : (idx.st != null ? row[idx.st] : '');
      listRow[9] = stVal;
      listRow[10] = svVal;
      if (idx.ev != null) listRow[11] = row[idx.ev];
      listRow[30] = pid;
      out.push(listRow);
    }
    return out;
  }

  async function loadData() {
    try {
      const patternFetches = CONFIG.PATTERN_TAB_GIDS.map(gid => origFetch(csvUrl(gid)).then(r => r.text()));
      const [pdText, listText, ...patternTexts] = await Promise.all([
        origFetch(csvUrl(CONFIG.PRICE_DATA_GID)).then(r => r.text()),
        origFetch(csvUrl(CONFIG.LIST_GID)).then(r => r.text()),
        ...patternFetches,
      ]);
      const pdRows = parseCSV(pdText);
      const newPriceMap = new Map();
      for (let i = 1; i < pdRows.length; i++) {
        const row = pdRows[i];
        if (!row || !row[3]) continue;
        const price = parseFloat(row[11]);
        if (!isNaN(price)) newPriceMap.set(row[3].trim(), price);
      }

      // Base layer: every theme tab, merged. Where the same PatternId shows up in more than
      // one theme tab they've matched exactly in spot checks so far, so last-in wins.
      const newListMap = new Map();
      for (const text of patternTexts) {
        for (const row of parsePatternTabToListRows(text)) newListMap.set(row[30], row);
      }
      // "List" is applied last and always wins ties — it's the sheet meant to back this
      // script — but anything it's missing now falls back to the theme-tab data above.
      const listRows = parseCSV(listText);
      for (let i = 1; i < listRows.length; i++) {
        const row = listRows[i];
        if (!row || !row[30]) continue;
        newListMap.set(row[30].trim(), row);
      }

      priceDataByName = newPriceMap;
      listByPatternId = newListMap;
      dataReady = true;
      globalSortedCache.clear();
      totalsCache.clear();
      console.log('[cco-pricedata] loaded', newPriceMap.size, 'PriceData rows,', newListMap.size, 'pattern rows (List + theme tabs)');
      scheduleTick();
    } catch (e) {
      console.error('[cco-pricedata] failed to load sheet data', e);
    }
  }

  // ---------- Pricing ----------
  function stripPatternFromName(name) {
    return name.replace(/\s*'[^']+'\s*/, ' ').replace(/\s+/g, ' ').trim();
  }

  // Katowice 2014 sticker holos aren't covered by any sheet (no patternId, and the
  // PriceData catalog has zero "Sticker" rows) — per explicit instruction, a standalone/
  // unapplied Katowice sticker item is worth 3x its native price. Once applied to a skin,
  // it's left at native/base value (see stickerVal below) — only the unapplied case gets 3x.
  function isKatowiceSticker(name) {
    return typeof name === 'string' && /katowice/i.test(name);
  }

  function calcPrice(skin) {
    const native = (typeof skin.price === 'number' ? skin.price : skin.weaponPrice) || 0;
    if (!dataReady) return { calc: native, native, source: 'loading' };

    let base = null;

    if (skin.hasPattern && skin.patternId && listByPatternId.has(skin.patternId)) {
      const row = listByPatternId.get(skin.patternId);
      const col = EXT_COL[skin.exterior];
      let extVal = col != null ? parseMagnitude(row[col]) : null;
      if (extVal == null) extVal = parseMagnitude(row[2]);
      if (extVal != null) {
        base = extVal;
        if (skin.statTrak) { const adj = parseAdjustment(row[9]); if (adj) base = adj.type === 'mult' ? base * adj.value : base + adj.value; }
        else if (skin.souvenir) { const adj = parseAdjustment(row[10]); if (adj) base = adj.type === 'mult' ? base * adj.value : base + adj.value; }
        // EV (event) multiplier ONLY applies to actual event skins. Confirmed via /price
        // ground truth: a non-event Crimson Web 'Centered Web' Stiletto Knife (BS, quality 2)
        // priced at exactly base*7^quality with NO EV applied ($7.84M) — applying EV
        // unconditionally was tried and contradicted by the bot, so this stays gated.
        if (skin.event) { const ev = parseAdjustment(row[11]); if (ev && ev.type === 'mult') base *= ev.value; }
      }
    }

    if (base == null) {
      const cleanName = stripPatternFromName(skin.name || '');
      if (priceDataByName.has(skin.name)) base = priceDataByName.get(skin.name);
      else if (priceDataByName.has(cleanName)) base = priceDataByName.get(cleanName);
    }

    // No sheet match: native price already includes any applied stickers. A standalone
    // Katowice sticker item lands here too (no patternId, no PriceData row) — apply the 3x.
    if (base == null) {
      const mult = isKatowiceSticker(skin.name) ? 3 : 1;
      return { calc: native * mult, native, source: mult > 1 ? 'katowice-3x' : 'fallback-native' };
    }

    const quality = typeof skin.quality === 'number' ? skin.quality : 0;
    base *= Math.pow(CONFIG.QUALITY_BASE, quality);

    // Sheet base is the bare weapon — add the value of any applied stickers. The 3x only
    // applies to a standalone/unapplied Katowice sticker (handled above); once it's applied
    // to a skin, its contribution here is left at native/base value as-is.
    const stickerVal = Array.isArray(skin.stickers)
      ? skin.stickers.reduce((s, st) => s + (typeof st.price === 'number' ? st.price : 0), 0) : 0;
    base += stickerVal;

    return { calc: base, native, source: 'calculated' };
  }

  function fmtFull(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- Tooltip ----------
  let tooltipEl = null;
  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = 'position:fixed;z-index:99999;background:#111;color:#fff;border:1px solid #f60;' +
      'padding:4px 8px;border-radius:4px;font-size:12px;pointer-events:none;display:none;white-space:nowrap;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.5);';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }
  function positionTooltip(e) { if (!tooltipEl) return; tooltipEl.style.left = (e.clientX + 12) + 'px'; tooltipEl.style.top = (e.clientY + 12) + 'px'; }
  function attachTooltip(el, textFn) {
    el.addEventListener('mouseenter', (e) => { const t = ensureTooltip(); t.textContent = textFn(); t.style.display = 'block'; positionTooltip(e); });
    el.addEventListener('mousemove', positionTooltip);
    el.addEventListener('mouseleave', () => { if (tooltipEl) tooltipEl.style.display = 'none'; });
  }

  // ---------- Card price overlay ----------
  function updateCardPrices() {
    if (!currentPageSkins.length) return;
    const cards = document.querySelectorAll('.mantine-Card-root');
    if (cards.length !== currentPageSkins.length) return;
    cards.forEach((card, i) => {
      const skin = currentPageSkins[i];
      if (!skin) return;
      const badge = [...card.querySelectorAll('.mantine-Badge-label')].find(e => /^\$[\d,]+\.\d{2}$/.test(e.textContent.trim()));
      if (badge) {
        const { calc, native } = calcPrice(skin);
        const calcText = fmtFull(calc);
        if (badge.textContent.trim() !== calcText) badge.textContent = calcText;
        if (!badge.dataset.ccoTooltip) { badge.dataset.ccoTooltip = '1'; attachTooltip(badge, () => `Native price: ${fmtFull(native)}`); }
      }
      injectIncludeToggle(card, skin);
    });
  }

  // ---------- Include-in-total toggle ----------
  // A small dot placed right below the card's own info ("i") button. The star (favorite)
  // and info buttons already live stacked in a flex column (.mantine-Stack-root) with
  // nothing else in it, so appending here just adds a third item below them — no absolute
  // positioning needed. Default state is "included" (untouched dot = filled/on).
  function injectIncludeToggle(card, skin) {
    if (!skin || !skin._id) return;
    const infoBtns = card.querySelectorAll('.mantine-ActionIcon-root[data-variant="transparent"]');
    const stack = infoBtns[infoBtns.length - 1] && infoBtns[infoBtns.length - 1].parentElement;
    if (!stack) return;
    let toggle = stack.querySelector('[data-cco-include-toggle]');
    if (!toggle) {
      toggle = document.createElement('div');
      toggle.dataset.ccoIncludeToggle = '1';
      toggle.style.cssText = 'width:14px;height:14px;border-radius:50%;margin:6px auto 0;cursor:pointer;' +
        'border:2px solid #f60;box-sizing:border-box;flex-shrink:0;transition:background .15s;';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIncluded(toggle.dataset.skinId, !isIncluded(toggle.dataset.skinId));
      });
      attachTooltip(toggle, () => isIncluded(toggle.dataset.skinId)
        ? 'Included in Pricedata total — click to exclude'
        : 'Excluded from Pricedata total — click to include');
      stack.appendChild(toggle);
    }
    toggle.dataset.skinId = skin._id;
    toggle.style.background = isIncluded(skin._id) ? '#f60' : 'transparent';
  }

  // ---------- Copy-link button ----------
  // NOTE: left as a stub on purpose — this is meant to hold the original addCopyBtns
  // behavior from the zhiro basescript (copy-link button on trade/chat/other-SU cards).
  // I don't have that original snippet, so paste it in here. Safe no-op until then.
  function addCopyBtns() { /* paste original copy-link behavior here */ }

  // ---------- Totals ----------
  function currentContext() {
    const su = location.pathname.match(/\/inventory\/storageUnits\/([a-f0-9]{24})/);
    if (su) return { type: 'su', id: su[1] };
    if (location.pathname === '/inventory') return { type: 'inv' };
    return null;
  }
  // The site remembers its own Sort selection (Latest/Price/Float/Float Ranks) and always
  // includes it as a `sort=` query param on its OWN fetches (confirmed by watching real
  // requests: Latest -> '', Price -> 'price', Float -> 'float', Float Ranks -> 'rank'). Any
  // fetch WE make ourselves has to use that same value, or the array we get back is ordered
  // differently than the cards actually on screen — pairing each card with the wrong skin's
  // price. We read the CURRENT selection straight off the native Sort dropdown (its input
  // shows the human label) rather than waiting to intercept a real request, since on a fresh
  // page load the site's own initial fetch can happen before our fetch patch even attaches —
  // waiting for interception would silently keep guessing wrong until the user manually
  // changed sort at least once.
  const SORT_LABEL_TO_PARAM = { 'Latest': '', 'Price': 'price', 'Float': 'float', 'Float Ranks': 'rank' };
  let lastKnownSort = null; // last value actually seen on a real, intercepted site request (cross-check only)
  function getCurrentSortParam() {
    const label = [...document.querySelectorAll('label')].find(e => e.textContent.trim() === 'Sort');
    const root = label && label.closest('.mantine-Select-root');
    const input = root && root.querySelector('input');
    const shown = input && input.value && input.value.trim();
    if (shown && Object.prototype.hasOwnProperty.call(SORT_LABEL_TO_PARAM, shown)) return SORT_LABEL_TO_PARAM[shown];
    return lastKnownSort != null ? lastKnownSort : '';
  }
  function listUrlFor(ctx, page, sort) {
    const s = sort != null ? sort : getCurrentSortParam();
    return ctx.type === 'su'
      ? `/api/inventory/storageUnits/skins?id=${ctx.id}&page=${page}&sort=${encodeURIComponent(s)}`
      : `/api/inventory?page=${page}&sort=${encodeURIComponent(s)}&showStickers=true&showUpgradedSkins=true`;
  }
  async function fetchAllSkins(ctx) {
    const first = await origFetch(listUrlFor(ctx, 1), { credentials: 'include' }).then(r => r.json());
    const pages = first.pages || 1;
    const all = [...(first.skins || [])];
    const fetches = [];
    for (let p = 2; p <= pages; p++) fetches.push(origFetch(listUrlFor(ctx, p), { credentials: 'include' }).then(r => r.json()));
    (await Promise.all(fetches)).forEach(d => all.push(...(d.skins || [])));
    return all;
  }

  // ---------- True global sort (Pricedata) ----------
  // Reordering only the items already on the current page (old approach) can't produce a
  // real top-to-bottom ranking, because WHICH items land on a given page is decided by the
  // site's own native sort before we ever see them — a $30M item can sit on page 3 while
  // page 1 shows $700k items. To fix that properly we fetch every page ourselves, rank
  // everything once, and hand the site back the correct slice for whatever page it asked
  // for (see the window.fetch patch below) so its own rendering shows the right items.
  const globalSortedCache = new Map();
  let knownPageSize = null;
  async function getGlobalSorted(ctx) {
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const cached = globalSortedCache.get(key);
    if (cached && !cached.pending && Date.now() - cached.ts < CONFIG.CACHE_MS) return cached.items;
    if (cached && cached.pending) return cached.promise;
    const promise = (async () => {
      const all = await fetchAllSkins(ctx);
      const sorted = all.slice().sort((a, b) => calcPrice(b).calc - calcPrice(a).calc);
      globalSortedCache.set(key, { items: sorted, ts: Date.now(), pending: false });
      return sorted;
    })();
    globalSortedCache.set(key, Object.assign({}, cached, { pending: true, promise }));
    return promise;
  }
  async function getCachedTotals() {
    const ctx = currentContext();
    if (!ctx) return null;
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const cached = totalsCache.get(key);
    if (cached && Date.now() - cached.ts < CONFIG.CACHE_MS) return cached;
    if (cached && cached.pending) return cached;
    totalsCache.set(key, Object.assign({}, cached, { pending: true }));
    try {
      const all = await fetchAllSkins(ctx);
      let calc = 0, native = 0;
      all.forEach(s => { if (!isIncluded(s._id)) return; const r = calcPrice(s); calc += r.calc; native += r.native; });
      const res = { calc, native, ts: Date.now(), pending: false };
      totalsCache.set(key, res);
      scheduleTick();
      return res;
    } catch (e) {
      console.error('[cco-pricedata] totals failed', e);
      totalsCache.set(key, Object.assign({}, cached, { pending: false }));
      return cached || null;
    }
  }
  // ---------- Full scan (inventory + every storage unit) ----------
  async function fetchStorageUnitsList() {
    try {
      const data = await origFetch('/api/inventory/storageUnits', { credentials: 'include' }).then(r => r.json());
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('[cco-pricedata] failed to list storage units', e);
      return [];
    }
  }

  function sumSkins(skins) {
    let calc = 0, native = 0, includedCount = 0;
    skins.forEach(s => {
      if (!isIncluded(s._id)) return;
      const r = calcPrice(s);
      calc += r.calc; native += r.native; includedCount++;
    });
    return { calc, native, count: skins.length, includedCount };
  }

  async function scanAll(onProgress) {
    onProgress && onProgress('Scanning inventory…');
    const invSkins = await fetchAllSkins({ type: 'inv' });
    const inv = sumSkins(invSkins);

    const sus = await fetchStorageUnitsList();
    const suResults = [];
    for (let i = 0; i < sus.length; i++) {
      const su = sus[i];
      onProgress && onProgress(`Scanning storage unit ${i + 1}/${sus.length}: ${su.name || su._id}…`);
      const skins = await fetchAllSkins({ type: 'su', id: su._id });
      suResults.push(Object.assign({ id: su._id, name: su.name || '(unnamed)' }, sumSkins(skins)));
    }

    const grandCalc = inv.calc + suResults.reduce((s, r) => s + r.calc, 0);
    const grandNative = inv.native + suResults.reduce((s, r) => s + r.native, 0);
    return { inv, sus: suResults, grandCalc, grandNative };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showScanResultsModal(results) {
    const old = document.getElementById('cco-scan-modal');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'cco-scan-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;' +
      'display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const panel = document.createElement('div');
    panel.style.cssText = 'background:#1a1a1e;border:1px solid #f60;border-radius:8px;padding:20px 24px;' +
      'max-width:480px;width:90%;max-height:80vh;overflow:auto;color:#fff;font-size:14px;font-family:inherit;';

    const rowsHtml = results.sus.map(su => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #333;">
        <span style="opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(su.name)} (${su.includedCount}/${su.count})</span>
        <span style="color:#f60;white-space:nowrap;">${fmtFull(su.calc)}</span>
      </div>`).join('');

    panel.innerHTML = `
      <div style="font-size:18px;font-weight:600;margin-bottom:12px;">Full Scan Results</div>
      <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #444;font-weight:600;">
        <span>Inventory (${results.inv.includedCount}/${results.inv.count})</span>
        <span style="color:#f60;">${fmtFull(results.inv.calc)}</span>
      </div>
      ${rowsHtml}
      <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0 0;margin-top:8px;border-top:2px solid #f60;font-weight:700;font-size:15px;">
        <span>Grand total (pricedata)</span><span style="color:#f60;">${fmtFull(results.grandCalc)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;opacity:.6;font-size:12px;">
        <span>Grand total (native)</span><span>${fmtFull(results.grandNative)}</span>
      </div>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'margin-top:16px;background:#f60;color:#000;border:none;border-radius:4px;' +
      'padding:8px 16px;cursor:pointer;font-weight:600;';
    closeBtn.addEventListener('click', () => overlay.remove());
    panel.appendChild(closeBtn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // Swaps a cloned button's visible label without touching its icon — walks to the first
  // text node that isn't inside the icon <svg>, so it works regardless of whether the label
  // is a bare text node or wrapped in its own span.
  function setButtonLabel(btn, text) {
    const inner = btn.querySelector('.mantine-Button-inner') || btn;
    const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest('svg')) continue;
      node.textContent = text;
      return;
    }
    inner.appendChild(document.createTextNode(text));
  }

  const SCAN_BTN_LABEL = 'Scan All (Inventory + Storage Units)';
  let scanning = false;
  async function onScanButtonClick(e) {
    if (scanning) return;
    scanning = true;
    const btn = e.currentTarget;
    try {
      const results = await scanAll((msg) => setButtonLabel(btn, msg));
      showScanResultsModal(results);
    } catch (err) {
      console.error('[cco-pricedata] scan failed', err);
    } finally {
      setButtonLabel(btn, SCAN_BTN_LABEL);
      scanning = false;
    }
  }

  // Cloning the existing button row (Float Rank Management / Custom Sell / Storage Units /
  // Special Effects) and collapsing it to one column keeps identical Mantine classes, so the
  // new button matches the site's own look exactly without having to hand-reconstruct it.
  function injectScanButton() {
    if (document.getElementById('cco-scan-row')) return;
    const srcBtn = [...document.querySelectorAll('button')].find(b => /Float Rank Management|Storage Units|Special Effects|Custom Sell/.test(b.textContent));
    if (!srcBtn) return;
    const gridRoot = srcBtn.closest('.mantine-Grid-root');
    const inner = gridRoot && gridRoot.querySelector('.mantine-Grid-inner');
    if (!gridRoot || !inner) return;

    const newRow = gridRoot.cloneNode(true);
    newRow.id = 'cco-scan-row';
    newRow.style.marginTop = '8px';
    const cols = [...newRow.querySelectorAll('.mantine-Grid-col')];
    cols.forEach((c, i) => { if (i > 0) c.remove(); });
    cols[0].style.flex = '1 1 100%';
    cols[0].style.maxWidth = '100%';
    const btn = cols[0].querySelector('button');
    btn.removeAttribute('id');
    btn.style.width = '100%';
    setButtonLabel(btn, SCAN_BTN_LABEL);
    btn.addEventListener('click', onScanButtonClick);
    gridRoot.insertAdjacentElement('afterend', newRow);
  }

  // ---------- Current-page skin capture ----------
  // The site fetches its inventory list via window.fetch itself; we patch it so we can
  // see the same response the page just rendered, instead of guessing. We only accept a
  // response as "the visible page" if both its route/context AND its page number match
  // what's actually on screen right now (the site prefetches other pages too, e.g. for
  // its own running total, so a length-only check isn't reliable).
  function parseListUrl(url) {
    try {
      const u = new URL(url, location.origin);
      const sort = u.searchParams.get('sort') || '';
      if (u.pathname === '/api/inventory') {
        return { type: 'inv', page: parseInt(u.searchParams.get('page') || '1', 10), sort };
      }
      if (u.pathname === '/api/inventory/storageUnits/skins') {
        return { type: 'su', id: u.searchParams.get('id'), page: parseInt(u.searchParams.get('page') || '1', 10), sort };
      }
    } catch (e) { /* ignore malformed urls */ }
    return null;
  }

  function getActivePage() {
    const btn = document.querySelector('button[data-active="true"][aria-current="page"]');
    const n = btn ? parseInt(btn.textContent.trim(), 10) : 1;
    return isNaN(n) ? 1 : n;
  }

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && (input.url || input.href)) || String(input);
    const meta = parseListUrl(url);

    // Pricedata sort is active: take over this request entirely. Fetch/rank everything
    // ourselves and swap the response body with the correct globally-ranked slice for the
    // page being requested, BEFORE React ever sees it — so the site's own rendering shows
    // the right cards in the right order, no DOM-fighting required.
    if (meta) {
      const ctxNow = currentContext();
      const ctxMatchesNow = ctxNow && (
        (meta.type === 'inv' && ctxNow.type === 'inv') ||
        (meta.type === 'su' && ctxNow.type === 'su' && ctxNow.id === meta.id)
      );
      if (ctxMatchesNow && meta.page === getActivePage() && sortMode === 'pricedata') {
        try {
          const res = await origFetch(input, init);
          if (!res.ok) return res;
          const data = await res.clone().json();
          if (!data || !Array.isArray(data.skins)) return res;
          const dataPages = data.pages || 1;
          if (meta.page < dataPages && data.skins.length) knownPageSize = data.skins.length;
          const pageSize = knownPageSize || data.skins.length || 24;
          const globalItems = await getGlobalSorted(ctxNow);
          const start = (meta.page - 1) * pageSize;
          const slice = globalItems.slice(start, start + pageSize);
          lastKnownSort = meta.sort;
          nativePageSkins = slice;
          scheduleTick();
          const newData = Object.assign({}, data, { skins: slice, pages: Math.max(1, Math.ceil(globalItems.length / pageSize)) });
          return new Response(JSON.stringify(newData), { status: res.status, statusText: res.statusText, headers: res.headers });
        } catch (e) {
          console.error('[cco-pricedata] global sort rewrite failed', e);
          return origFetch(input, init);
        }
      }
    }

    // Fast path (native sort modes / non-list requests): pass straight through and peek at
    // the parsed response asynchronously, without delaying the real page at all.
    const res = await origFetch(input, init);
    try {
      if (meta && res.ok) {
        res.clone().json().then(data => {
          if (!data || !Array.isArray(data.skins)) return;
          const ctx = currentContext();
          const ctxMatches = ctx && (
            (meta.type === 'inv' && ctx.type === 'inv') ||
            (meta.type === 'su' && ctx.type === 'su' && ctx.id === meta.id)
          );
          if (ctxMatches && meta.page === getActivePage()) {
            lastKnownSort = meta.sort;
            nativePageSkins = data.skins;
            scheduleTick();
          }
        }).catch(() => {});
      }
    } catch (e) { /* never let our patch break the real response */ }
    return res;
  };

  // Fallback / self-heal: if what's on screen doesn't match what we know, fetch it
  // ourselves directly. Covers the case where our fetch patch didn't attach in time
  // for the page's very first load, or a request we can't cleanly identify.
  let priming = false;
  async function primeCurrentPage() {
    if (priming) return;
    priming = true;
    try {
      const ctx = currentContext();
      if (!ctx) return;
      const page = getActivePage();
      // Keep this in sync with the fetch patch's Pricedata takeover — otherwise a self-heal
      // firing while Pricedata is active would overwrite the correct global-rank slice with
      // a raw native-order fetch and reintroduce the card/price mismatch.
      if (sortMode === 'pricedata') {
        const globalItems = await getGlobalSorted(ctx);
        const pageSize = knownPageSize || 24;
        const start = (page - 1) * pageSize;
        nativePageSkins = globalItems.slice(start, start + pageSize);
        scheduleTick();
        return;
      }
      const data = await origFetch(listUrlFor(ctx, page), { credentials: 'include' }).then(r => r.json());
      if (data && Array.isArray(data.skins)) { nativePageSkins = data.skins; scheduleTick(); }
    } catch (e) {
      console.error('[cco-pricedata] primeCurrentPage failed', e);
    } finally {
      priming = false;
    }
  }

  // ---------- Sort (native / pricedata) ----------
  // Sorting itself now happens at the data layer: when "Pricedata" is active, the
  // window.fetch patch above rewrites the actual server response to already be the
  // correct globally-ranked slice, so cards render in true rank order via the site's own
  // pipeline. No CSS reordering needed here anymore — just mirror the (already-correct)
  // page data and clear any leftover `order` from an older version of this script.
  function applySort() {
    const cards = [...document.querySelectorAll('.mantine-Card-root')];
    currentPageSkins = nativePageSkins.slice();
    if (!cards.length || cards.length !== nativePageSkins.length) return;
    cards.forEach(c => { if (c.parentElement.style.order) c.parentElement.style.order = ''; });
  }

  function setSortMode(mode) {
    sortMode = mode === 'pricedata' ? 'pricedata' : 'native';
    localStorage.setItem('cco_sortMode', sortMode);
    scheduleTick();
  }

  // ---------- Native "Sort" dropdown integration ----------
  // The site's own Sort control is a Mantine Select (Latest / Price / Float / Float Ranks)
  // that re-fetches from the server with a `sort=` param on selection. Pricedata sorting is
  // purely client-side, so instead of a separate toggle UI we add a "Pricedata" entry to
  // this same dropdown. Clicking a REAL option (Latest/Price/etc.) is left to the site;
  // clicking ours flips sortMode and re-closes the dropdown (clicking the input itself is
  // what actually toggles it open/closed here — outside clicks and Escape don't).
  function findSortSelectRoot() {
    const label = [...document.querySelectorAll('label')].find(e => e.textContent.trim() === 'Sort');
    return label ? label.closest('.mantine-Select-root') : null;
  }

  function hookSortDropdown() {
    const root = findSortSelectRoot();
    if (!root) return;
    const input = root.querySelector('input');
    if (!input || input.dataset.ccoHooked) { if (input) refreshSortInputLabel(input); return; }
    input.dataset.ccoHooked = '1';
    input.addEventListener('mousedown', () => {
      // Dropdown content renders asynchronously after opening; try a couple of times.
      setTimeout(injectPricedataOption, 30);
      setTimeout(injectPricedataOption, 150);
    });
    refreshSortInputLabel(input);
  }

  function injectPricedataOption() {
    const root = findSortSelectRoot();
    if (!root) return;
    const input = root.querySelector('input');
    const dropdownId = input && input.getAttribute('aria-controls');
    const dropdown = dropdownId && document.getElementById(dropdownId);
    if (!dropdown) return;
    const nativeOptions = [...dropdown.querySelectorAll('[role="option"]')].filter(o => !o.dataset.ccoOption);
    if (!nativeOptions.length) return;
    if (!dropdown.dataset.ccoNativeHook) {
      dropdown.dataset.ccoNativeHook = '1';
      nativeOptions.forEach(o => o.addEventListener('click', () => setSortMode('native')));
    }
    let custom = dropdown.querySelector('[data-cco-option]');
    if (!custom) {
      custom = nativeOptions[0].cloneNode(true);
      custom.dataset.ccoOption = '1';
      custom.removeAttribute('data-combobox-option');
      custom.removeAttribute('id');
      custom.textContent = 'Pricedata';
      custom.addEventListener('click', (e) => {
        e.stopPropagation();
        setSortMode('pricedata');
        // The currently-displayed page was fetched under whatever native sort was active
        // before; a reload forces the very first request to go through our fetch patch's
        // Pricedata takeover (see window.fetch above), so it's correct immediately rather
        // than only fixing itself on the next click/page-change.
        location.reload();
      });
      dropdown.appendChild(custom);
    }
    // Only one option should look "checked" at a time — the real options already carry
    // whichever one the site considers selected, so override that when ours is active.
    const active = sortMode === 'pricedata';
    custom.setAttribute('aria-selected', active ? 'true' : 'false');
    if (active) { custom.setAttribute('data-checked', 'true'); custom.setAttribute('data-combobox-active', 'true'); }
    else { custom.removeAttribute('data-checked'); custom.removeAttribute('data-combobox-active'); }
    nativeOptions.forEach(o => {
      if (active) { o.removeAttribute('data-checked'); o.setAttribute('aria-selected', 'false'); }
    });
  }

  // Best-effort: while pricedata sort is active, keep the (read-only) input showing
  // "Pricedata" so the dropdown reflects our state too. It isn't wired into the site's own
  // React state, so this is a plain re-assert each tick rather than a real controlled value.
  function refreshSortInputLabel(input) {
    if (sortMode === 'pricedata' && input.value !== 'Pricedata') input.value = 'Pricedata';
  }

  // ---------- Inline total next to the site's own "value" text ----------
  function findValueEl() {
    const candidates = document.querySelectorAll('p.mantine-Text-root');
    for (const p of candidates) {
      const t = p.textContent.trim();
      if (/\$[\d,]+\.\d{2}/.test(t) && /value/i.test(t)) return p;
    }
    return null;
  }

  let inlineTotalEl = null;
  function renderInlineTotal() {
    const ctx = currentContext();
    if (!ctx) return;
    const valueEl = findValueEl();
    if (!valueEl) return;
    if (!inlineTotalEl || !inlineTotalEl.isConnected) {
      inlineTotalEl = document.createElement('p');
      inlineTotalEl.className = 'mantine-Text-root';
      inlineTotalEl.style.cssText = 'font-size:12px;opacity:.85;margin-top:2px;color:#f60;';
      valueEl.insertAdjacentElement('afterend', inlineTotalEl);
    }
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const cached = totalsCache.get(key);
    if (cached && cached.calc != null) {
      inlineTotalEl.textContent = `Pricedata value: ${fmtFull(cached.calc)}`;
      inlineTotalEl.title = `Native: ${fmtFull(cached.native)}`;
    } else {
      inlineTotalEl.textContent = 'Pricedata value: calculating…';
    }
  }

  // ---------- Tick / scheduling ----------
  let tickTimer = null;
  function scheduleTick() {
    if (tickTimer) return;
    tickTimer = setTimeout(() => {
      tickTimer = null;
      tick();
    }, 50);
  }

  function tick() {
    const cards = document.querySelectorAll('.mantine-Card-root');
    if (cards.length && cards.length !== nativePageSkins.length) primeCurrentPage();
    hookSortDropdown();
    applySort();
    updateCardPrices();
    addCopyBtns();
    renderInlineTotal();
    const ctx = currentContext();
    if (ctx && ctx.type === 'inv') injectScanButton();
    getCachedTotals().then(() => { renderInlineTotal(); }).catch(() => {});
  }

  // ---------- Bootstrap ----------
  function init() {
    const observer = new MutationObserver(() => {
      scheduleTick();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    loadData();
    setInterval(loadData, CONFIG.REFRESH_MS);
    primeCurrentPage();
    scheduleTick();
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);
})();
