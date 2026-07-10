// ==UserScript==
// @name         Case Clicker Pricedata Overlay
// @namespace    cco-pricedata
// @version      4.5
// @author       rowan
// @credits      zhiro for basescript, chunkycheese for pricedata
// @description  shows inv/su calculated value (pricedata x quality x event multiplier + stickers), optional pricedata-based sort toggle, calculated price on cards (hover for original QS price), a copy-link button on trade/chat/other-SU cards, and an opt-out inventory-value leaderboard with Premier tracking.
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/Utilities/Case%20Clicker%20Pricedata%20Overlay-2.7.user.js
// @downloadURL  https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/Utilities/Case%20Clicker%20Pricedata%20Overlay-2.7.user.js
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
    // Fill this in once you've deployed the Vercel API (see the two files provided alongside
    // this script: api/submit-score.js and api/leaderboard.js). Leave blank to disable the
    // leaderboard feature entirely (no submissions, no custom category on /leaderboard).
    LEADERBOARD_API_BASE: 'https://cco-leaderboard-api.vercel.app',
  };

  const EXT_COL = { 'Factory New': 4, 'Minimal Wear': 5, 'Field-Tested': 6, 'Well-Worn': 7, 'Battle-Scarred': 8 };

  const origFetch = window.fetch.bind(window);

  let priceDataByName = new Map();
  let listByPatternId = new Map();
  // PatternIds sourced from the Doppler tab specifically ("phases" — Ruby/Sapphire/Black
  // Pearl/Emerald/Tier 1-3/Diamond Gem/etc.). Excluded from the pattern-level 1/1 bonus below
  // per explicit instruction — the float-rank-#1 concept doesn't apply the same way to phases.
  let phasePatternIds = new Set();
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
    // Some rows give a flat set price instead of a multiplier/adjustment — e.g. an EV cell of
    // "3.0M" rather than "x3". No leading x/+/- means it's not a multiplier or an offset, it's
    // the final dollar figure to use outright. Confirmed live: several EV cells in the Doppler
    // tab mix "x3"-style multipliers with bare "3.0M"-style set values in the same column —
    // the bare ones were silently falling through to null (no bonus applied at all) before.
    const setVal = parseMagnitude(str);
    if (setVal != null) return { type: 'set', value: setVal };
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
      const newPhaseIds = new Set();
      patternTexts.forEach((text, i) => {
        const gid = CONFIG.PATTERN_TAB_GIDS[i];
        for (const row of parsePatternTabToListRows(text)) {
          newListMap.set(row[30], row);
          if (gid === 1523542442) newPhaseIds.add(row[30]); // Doppler tab = phases
        }
      });
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
      phasePatternIds = newPhaseIds;
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

  // Some patterns are correctly flagged as real event drops (skin.event truthy) but their
  // specific pattern has no EV multiplier documented anywhere in the sheet — e.g. Talon Knife
  // Fade '100% Fade'/'80% Fade' during Halloween 2025: every other knife pattern in that same
  // "Fade(Knife)" tab has an EV value (x3), these two rows are just blank. Rather than silently
  // falling through to no event bonus at all, use explicit fallback base values (pre quality
  // scaling, same slot as the sheet's own extVal) given directly for these two patterns.
  const EVENT_EV_FALLBACK_BY_PATTERN_ID = {
    '65a652a7fdd7ea906a8f8767': 3000000,  // Talon Knife | Fade '100% Fade'
    '65a652acfdd7ea906a8f8768': 800000,   // Talon Knife | Fade '80% Fade'
  };

  // Applies a parsed ST/SV/EV cell to a running base price. 'mult' (e.g. "x3") multiplies,
  // 'add' (e.g. "+50000"/"-50000") offsets, and 'set' (a bare value like "3.0M" with no
  // leading x/+/-) replaces the base outright — some sheet rows give a flat final price for
  // an adjustment instead of a multiplier, and treating a "set" value as if it were "add"
  // (the old fallback for anything non-'mult') would have produced a wildly wrong total.
  function applyAdjustment(base, adj) {
    if (adj.type === 'mult') return base * adj.value;
    if (adj.type === 'set') return adj.value;
    return base + adj.value; // 'add'
  }

  // "1/1" bonus: a copy that is simultaneously the LOWEST-float AND HIGHEST-float instance
  // for its pattern/skingroup within an event is effectively one-of-one — no other copy can
  // hold both extremes at once. Ranks come straight off skin.floatRanks (the game's own
  // per-item field), read positionally in the exact order the API actually returns them
  // (verified live): index 6/7 = lowestFloatbyEventSkingroupRank / highestFloatbyEventSkingroupRank
  // (non-pattern skins), index 18/19 = lowestFloatbyEventPatternRank / highestFloatbyEventPatternRank
  // (pattern skins). Phases (Doppler-tab patterns) are excluded from the pattern-level bonus
  // per explicit instruction. "Tier" Skin Group patterns (the generic "Tier 1"-"Tier 5"
  // buckets, native/QS-priced with no sheet FN/MW value) get a flat $5M instead of the 15x
  // multiplier since there's no calculated price to multiply in the first place.
  function getFloatRanks(skin) {
    return skin.floatRanks ? Object.values(skin.floatRanks) : [];
  }
  function apply1of1Bonus(skin, calc, ranks, skinGroupValue) {
    if (skin.hasPattern) {
      if (phasePatternIds.has(skin.patternId)) return calc;
      if (ranks[18] === 1 && ranks[19] === 1) {
        return skinGroupValue === 'Tier' ? 5000000 : Math.max(5000000, calc * 15);
      }
      return calc;
    }
    if (ranks[6] === 1 && ranks[7] === 1) return calc + 5000000;
    return calc;
  }

  function calcPrice(skin) {
    const native = (typeof skin.price === 'number' ? skin.price : skin.weaponPrice) || 0;
    if (!dataReady) return { calc: native, native, source: 'loading' };

    const ranks = getFloatRanks(skin);
    let base = null;
    let skinGroupValue = '';

    if (skin.hasPattern && skin.patternId && listByPatternId.has(skin.patternId)) {
      const row = listByPatternId.get(skin.patternId);
      skinGroupValue = String(row[3] || '').trim();
      const col = EXT_COL[skin.exterior];
      let extVal = col != null ? parseMagnitude(row[col]) : null;
      if (extVal == null) extVal = parseMagnitude(row[2]);
      if (extVal != null) {
        base = extVal;
        if (skin.statTrak) { const adj = parseAdjustment(row[9]); if (adj) base = applyAdjustment(base, adj); }
        else if (skin.souvenir) { const adj = parseAdjustment(row[10]); if (adj) base = applyAdjustment(base, adj); }
        // EV (event) multiplier ONLY applies to actual event skins. Confirmed via /price
        // ground truth: a non-event Crimson Web 'Centered Web' Stiletto Knife (BS, quality 2)
        // priced at exactly base*7^quality with NO EV applied ($7.84M) — applying EV
        // unconditionally was tried and contradicted by the bot, so this stays gated.
        if (skin.event) {
          const ev = parseAdjustment(row[11]);
          if (ev) base = applyAdjustment(base, ev);
          else if (EVENT_EV_FALLBACK_BY_PATTERN_ID[skin.patternId] != null) base = EVENT_EV_FALLBACK_BY_PATTERN_ID[skin.patternId];
        }
      }
    }

    // The generic PriceData sheet (flat name -> price) holds Steam-market-style prices for
    // BASE skins with no notable pattern — it is NOT a substitute for per-pattern data. Bug:
    // this used to run for ANY skin once `base` was still null, including patterned items
    // whose specific patternId just isn't one we have sheet data for (e.g. the game's own
    // low/common "Tier 1"-"Tier 5" pattern buckets, which never appear in any pattern tab).
    // stripPatternFromName() strips the quoted "'Tier 4'" label right back off, so it was
    // matching the flat base-skin row and overriding the correct native/QS price with an
    // unrelated Steam market number. Patterned items with no per-pattern sheet match should
    // fall straight through to native/QS below instead — only NON-patterned items (plain gun
    // skins, gloves, agents, etc.) are meant to use this flat lookup.
    if (base == null && !skin.hasPattern) {
      const cleanName = stripPatternFromName(skin.name || '');
      if (priceDataByName.has(skin.name)) base = priceDataByName.get(skin.name);
      else if (priceDataByName.has(cleanName)) base = priceDataByName.get(cleanName);
    }

    // No sheet match: native price already includes any applied stickers. A standalone
    // Katowice sticker item lands here too (no patternId, no PriceData row) — apply the 3x.
    // "Tier" patterns land here too (their FN/MW cells are literally "QS", so extVal parsing
    // fails above) — the 1/1 bonus still needs to apply to them, hence the call below rather
    // than returning straight through un-checked.
    if (base == null) {
      const mult = isKatowiceSticker(skin.name) ? 3 : 1;
      const calc = apply1of1Bonus(skin, native * mult, ranks, skinGroupValue);
      return { calc, native, source: mult > 1 ? 'katowice-3x' : 'fallback-native' };
    }

    const quality = typeof skin.quality === 'number' ? skin.quality : 0;
    base *= Math.pow(CONFIG.QUALITY_BASE, quality);

    // Sheet base is the bare weapon — add the value of any applied stickers. The 3x only
    // applies to a standalone/unapplied Katowice sticker (handled above); once it's applied
    // to a skin, its contribution here is left at native/base value as-is.
    const stickerVal = Array.isArray(skin.stickers)
      ? skin.stickers.reduce((s, st) => s + (typeof st.price === 'number' ? st.price : 0), 0) : 0;
    base += stickerVal;

    base = apply1of1Bonus(skin, base, ranks, skinGroupValue);

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

  // ---------- Generic price overlay (trade board + "Add skins to trade" modal) ----------
  // The trade page (both my side and the other player's side of the board) and the
  // "Add skins to trade" picker modal never go through our own window.fetch takeover —
  // the board updates over what looks like a websocket/live-sync channel, and the modal's
  // item list is entirely client-side (opening it and paging through it fires zero network
  // requests), so there's no response body for us to intercept or pair against
  // `currentPageSkins` like on /inventory and storage-unit pages. Instead we read the skin
  // object straight off each card's own React fiber (Mantine Card components receive it as
  // a `skin` prop a few hops up) — this works regardless of route, pagination style, or
  // how the card's data got there. Cards already handled by the index-paired
  // updateCardPrices() above are skipped (they already carry the ccoTooltip marker), so this
  // is purely a fallback for surfaces that function can't reach.
  function getSkinFromCardFiber(card) {
    const key = Object.keys(card).find(k => k.startsWith('__reactFiber'));
    if (!key) return null;
    let fiber = card[key];
    let hops = 0;
    while (fiber && hops < 30) {
      const props = fiber.memoizedProps;
      if (props && props.skin && typeof props.skin === 'object') return props.skin;
      fiber = fiber.return;
      hops++;
    }
    return null;
  }

  function updateExtraCardPrices() {
    const cards = document.querySelectorAll('.mantine-Card-root');
    cards.forEach(card => {
      if (!card.offsetParent) return; // skip hidden/duplicate nodes (e.g. trade board's offscreen animation copies)
      const badge = [...card.querySelectorAll('.mantine-Badge-label')].find(e => /^\$[\d,]+\.\d{2}$/.test(e.textContent.trim()));
      if (!badge || badge.dataset.ccoTooltip) return; // no price badge here, or already handled
      const skin = getSkinFromCardFiber(card);
      if (!skin) return;
      const { calc, native } = calcPrice(skin);
      const calcText = fmtFull(calc);
      if (badge.textContent.trim() !== calcText) badge.textContent = calcText;
      badge.dataset.ccoTooltip = '1';
      attachTooltip(badge, () => `Native price: ${fmtFull(native)}`);
    });
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
    onProgress && onProgress('Fetching Premier stats…');
    const premier = await fetchPremierStats();
    return { inv, sus: suResults, grandCalc, grandNative, premier };
  }

  // Premier rank/rating live on /api/me (the game-stats endpoint) alongside money/xp/etc —
  // fetched fresh on every Scan All so the modal and leaderboard submission both reflect
  // your current Premier standing, not whatever it was on page load.
  async function fetchPremierStats() {
    try {
      const me = await origFetch('/api/me', { credentials: 'include' }).then(r => r.json());
      return {
        premierRating: typeof me.premierRating === 'number' ? me.premierRating : null,
        premierRankId: me.premierRank && typeof me.premierRank.id === 'number' ? me.premierRank.id : null,
      };
    } catch (e) {
      console.error('[cco-pricedata] failed to fetch Premier stats', e);
      return { premierRating: null, premierRankId: null };
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Persisted (unlike the per-card include toggle) since this is a one-time privacy choice
  // about broadcasting your name/avatar/net worth, not a per-scan ephemeral setting. Defaults
  // ON per explicit request — still an easy per-user opt-out via the modal's toggle.
  function lbSubmitEnabled() { return localStorage.getItem('cco_lbSubmitEnabled') !== 'false'; }
  function setLbSubmitEnabled(on) { localStorage.setItem('cco_lbSubmitEnabled', on ? 'true' : 'false'); }

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
      ${results.premier && results.premier.premierRating != null ? `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0 0;opacity:.75;font-size:12px;">
        <span>Premier rating</span><span>${results.premier.premierRating.toLocaleString('en-US')}</span>
      </div>` : ''}
    `;

    // Leaderboard opt-in row. Only shown once you've actually configured an API base — no
    // point offering a toggle that has nowhere to send data.
    if (CONFIG.LEADERBOARD_API_BASE) {
      const lbRow = document.createElement('div');
      lbRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;' +
        'padding:10px 0 0;margin-top:10px;border-top:1px solid #444;';
      const label = document.createElement('div');
      label.innerHTML = '<div>Submit to Leaderboard</div>' +
        '<div style="opacity:.6;font-size:11px;">Shares your name, avatar, and this total publicly</div>';
      const toggle = document.createElement('div');
      toggle.style.cssText = 'width:40px;height:22px;border-radius:11px;cursor:pointer;flex-shrink:0;' +
        'border:2px solid #f60;box-sizing:border-box;position:relative;transition:background .15s;';
      const knob = document.createElement('div');
      knob.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#f60;position:absolute;' +
        'top:2px;left:2px;transition:left .15s;';
      toggle.appendChild(knob);
      const status = document.createElement('div');
      status.style.cssText = 'font-size:11px;opacity:.7;margin-top:6px;text-align:right;';

      function paint(on) {
        knob.style.left = on ? '20px' : '2px';
        toggle.style.background = on ? 'rgba(255,102,0,.3)' : 'transparent';
      }

      async function doSubmit() {
        status.textContent = 'Submitting…';
        await submitToLeaderboard(results.grandCalc, results.grandNative, results.premier);
        if (lbSubmitEnabled()) status.textContent = 'Submitted ✓';
      }

      paint(lbSubmitEnabled());
      if (lbSubmitEnabled()) doSubmit(); // already opted in from a previous scan — submit this run's fresh total too

      toggle.addEventListener('click', () => {
        const next = !lbSubmitEnabled();
        setLbSubmitEnabled(next);
        paint(next);
        if (next) doSubmit(); else status.textContent = '';
      });

      lbRow.appendChild(label);
      lbRow.appendChild(toggle);
      panel.appendChild(lbRow);
      panel.appendChild(status);
    }

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

  // ---------- Inventory-value leaderboard (backed by your own Vercel API) ----------
  // Contract (see api/submit-score.js + api/leaderboard.js shipped alongside this script):
  //   POST {LEADERBOARD_API_BASE}/api/submit-score
  //     body: { userId, username, avatarUrl, totalValue, nativeValue }  -> { ok: true }
  //   GET  {LEADERBOARD_API_BASE}/api/leaderboard?limit=50
  //     -> { entries: [{ rank, userId, username, avatarUrl, totalValue, nativeValue, updatedAt }] }
  // /api/me is the game-stats endpoint (money, xp, limits, etc.) — it has no user identity
  // fields at all. Identity (id/name/image) actually lives on the auth session endpoint,
  // confirmed live: GET /api/auth/get-session -> { session, user: { id, name, image, ... } }.
  let meCache = null;
  async function getMe() {
    if (meCache) return meCache;
    try {
      const session = await origFetch('/api/auth/get-session', { credentials: 'include' }).then(r => r.json());
      meCache = session && session.user ? session.user : null;
    } catch (e) { meCache = null; }
    return meCache;
  }

  async function submitToLeaderboard(grandCalc, grandNative, premier) {
    if (!CONFIG.LEADERBOARD_API_BASE) return; // feature disabled until a base URL is configured
    try {
      const me = await getMe();
      const userId = me && me.id;
      if (!userId) return;
      const username = (me && me.name) || 'Unknown';
      const avatarUrl = (me && me.image) || null;
      const premierRating = premier && typeof premier.premierRating === 'number' ? premier.premierRating : null;
      const premierRankId = premier && typeof premier.premierRankId === 'number' ? premier.premierRankId : null;
      await origFetch(CONFIG.LEADERBOARD_API_BASE.replace(/\/$/, '') + '/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, username, avatarUrl, totalValue: grandCalc, nativeValue: grandNative, premierRating, premierRankId }),
      });
    } catch (e) {
      console.error('[cco-pricedata] leaderboard submit failed', e);
    }
  }

  async function fetchLeaderboard(limit) {
    if (!CONFIG.LEADERBOARD_API_BASE) return [];
    try {
      const data = await origFetch(
        CONFIG.LEADERBOARD_API_BASE.replace(/\/$/, '') + '/api/leaderboard?limit=' + (limit || 50)
      ).then(r => r.json());
      return (data && data.entries) || [];
    } catch (e) {
      console.error('[cco-pricedata] leaderboard fetch failed', e);
      return [];
    }
  }

  const SCAN_BTN_LABEL = 'Scan All (Inventory + Storage Units)';
  let scanning = false;
  async function onScanButtonClick(e) {
    if (scanning) return;
    scanning = true;
    const btn = e.currentTarget;
    try {
      const results = await scanAll((msg) => setButtonLabel(btn, msg));
      showScanResultsModal(results); // leaderboard submission is opt-in via the modal's own toggle
    } catch (err) {
      console.error('[cco-pricedata] scan failed', err);
    } finally {
      setButtonLabel(btn, SCAN_BTN_LABEL);
      scanning = false;
    }
  }

  // Opens the raw @updateURL in a new tab. Tampermonkey intercepts .user.js URLs itself and,
  // if a script with the same @namespace/@name is already installed, shows its own "Update"
  // (rather than "Install") prompt when the remote @version is newer — confirmed live, this
  // is exactly what happens navigating to raw.githubusercontent.com/.../*.user.js. So this
  // button is a real manual "check now" trigger, not just a link to the source.
  function onUpdateButtonClick() {
    window.open('https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/Utilities/Case%20Clicker%20Pricedata%20Overlay-2.7.user.js', '_blank');
  }

  // Cloning the existing button row (Float Rank Management / Custom Sell / Storage Units /
  // Special Effects) keeps identical Mantine classes, so our buttons match the site's own
  // look exactly without having to hand-reconstruct it. Kept at 2 columns (Scan All + Update
  // Script) instead of collapsing to 1.
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
    cols.forEach((c, i) => { if (i > 1) c.remove(); });
    if (cols[1]) {
      cols[0].style.flex = '1 1 70%';
      cols[0].style.maxWidth = '70%';
      cols[1].style.flex = '1 1 30%';
      cols[1].style.maxWidth = '30%';
    } else {
      cols[0].style.flex = '1 1 100%';
      cols[0].style.maxWidth = '100%';
    }

    const scanBtn = cols[0].querySelector('button');
    scanBtn.removeAttribute('id');
    scanBtn.style.width = '100%';
    setButtonLabel(scanBtn, SCAN_BTN_LABEL);
    scanBtn.addEventListener('click', onScanButtonClick);

    if (cols[1]) {
      const updateBtn = cols[1].querySelector('button');
      updateBtn.removeAttribute('id');
      updateBtn.style.width = '100%';
      setButtonLabel(updateBtn, 'Update Script');
      updateBtn.addEventListener('click', onUpdateButtonClick);
    }

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
    // Same reasoning as the Category dropdown's "Pricedata Value" entry below: it's appended
    // after every real option, so on reopen it can sit below the fold with no automatic
    // scroll bringing it into view the way Mantine does for its own options.
    if (active) custom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  // ---------- /leaderboard page: custom "Pricedata Value" category ----------
  // The site's own leaderboard (Category select: XP / Premier rating / Clicks / Clicked
  // cases / Vault money collected / Money earned / Money spent / ...) is backed by stats the
  // site's own backend computes — it has no concept of our pricedata valuation. We add a
  // "Pricedata Value" entry to that same Category dropdown (same clone-a-real-option pattern
  // as the inventory Sort dropdown's "Pricedata" entry). Must look pixel-identical to every
  // other category — podium (top 3) + table (rest) — so instead of hand-building markup we
  // reuse the site's own rendered structure.
  //
  // Earlier version of this mutated the SITE's own live podium/table nodes in place. That
  // broke on click: mutating textContent/img.src only changes what's displayed — it never
  // touches React's actual props for those nodes, so any click handler React still owns kept
  // referencing whichever real player was there before we overwrote it, navigating to a
  // stale/wrong profile. Fix: clone the podium Group and the table wholesale (cloneNode does
  // NOT copy React's internal fiber/prop references or any addEventListener-bound handlers —
  // only real DOM attributes), hide the live originals, and populate the detached clones
  // instead. Same exact styling, zero stale bindings.
  let leaderboardActive = false;
  let leaderboardOverlay = null; // { liveGroup, liveTable, cloneGroup, cloneTable, cloneTbody, rowTemplate }

  function findCategorySelectRoot() {
    const label = [...document.querySelectorAll('label')].find(e => e.textContent.trim() === 'Category');
    return label ? label.closest('.mantine-Select-root') : null;
  }

  function hookCategoryDropdown() {
    const root = findCategorySelectRoot();
    if (!root) return;
    const input = root.querySelector('input');
    if (!input || input.dataset.ccoHooked) { if (input) refreshCategoryInputLabel(input); return; }
    input.dataset.ccoHooked = '1';
    input.addEventListener('mousedown', () => {
      setTimeout(injectLeaderboardOption, 30);
      setTimeout(injectLeaderboardOption, 150);
    });
    refreshCategoryInputLabel(input);
  }

  function injectLeaderboardOption() {
    const root = findCategorySelectRoot();
    if (!root) return;
    const input = root.querySelector('input');
    const dropdownId = input && input.getAttribute('aria-controls');
    const dropdown = dropdownId && document.getElementById(dropdownId);
    if (!dropdown) return;
    const nativeOptions = [...dropdown.querySelectorAll('[role="option"]')].filter(o => !o.dataset.ccoOption);
    if (!nativeOptions.length) return;
    if (!dropdown.dataset.ccoNativeHook) {
      dropdown.dataset.ccoNativeHook = '1';
      nativeOptions.forEach(o => o.addEventListener('click', () => { leaderboardActive = false; hideCustomLeaderboard(); }));
    }
    let custom = dropdown.querySelector('[data-cco-option]');
    if (!custom) {
      custom = nativeOptions[0].cloneNode(true);
      custom.dataset.ccoOption = '1';
      custom.removeAttribute('data-combobox-option');
      custom.removeAttribute('id');
      custom.textContent = 'Pricedata Value';
      custom.addEventListener('click', (e) => {
        e.stopPropagation();
        leaderboardActive = true;
        renderCustomLeaderboard();
      });
      dropdown.appendChild(custom);
    }
    const active = leaderboardActive;
    custom.setAttribute('aria-selected', active ? 'true' : 'false');
    if (active) { custom.setAttribute('data-checked', 'true'); custom.setAttribute('data-combobox-active', 'true'); }
    else { custom.removeAttribute('data-checked'); custom.removeAttribute('data-combobox-active'); }
    // It's appended after every real category, so on a dropdown with this many entries it can
    // sit below the fold. Mantine's own combobox scrolls the actually-active option into view
    // on open — since it has no idea ours exists, do the same ourselves so it behaves like
    // every other option instead of staying pinned off-screen with no indication it's there.
    if (active) custom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function refreshCategoryInputLabel(input) {
    if (leaderboardActive && input.value !== 'Pricedata Value') input.value = 'Pricedata Value';
  }

  // Finds the live podium Group + table, clones both, hides the live ones, and inserts the
  // clones in the exact same spot — so layout/position/styling stay pixel-identical while the
  // clones themselves carry no React bindings to go stale.
  function showCustomLeaderboardClone() {
    hideCustomLeaderboard();
    // .mantine-Stack-root and .mantine-Group-root are generic Mantine layout primitives used
    // all over this page (chat messages, the profile widget, etc. — 60+ of each), so the
    // podium can only be reliably identified as the one Group whose DIRECT children are
    // exactly the three podium Stacks (verified live: exactly one such match on this page).
    const group = [...document.querySelectorAll('.mantine-Group-root')].find(g =>
      [...g.children].filter(c => c.classList.contains('mantine-Stack-root')).length === 3
    );
    const tbody = document.querySelector('.mantine-Table-tbody');
    const table = tbody && tbody.closest('table');
    if (!group || !tbody || !table || !tbody.firstElementChild) return null;

    const rowTemplate = tbody.firstElementChild.cloneNode(true); // pristine row template, from the live (untouched) table
    const cloneGroup = group.cloneNode(true);
    const cloneTable = table.cloneNode(true);
    const cloneTbody = cloneTable.querySelector('tbody') || cloneTable.querySelector('.mantine-Table-tbody');

    group.insertAdjacentElement('afterend', cloneGroup);
    group.style.display = 'none';
    table.insertAdjacentElement('afterend', cloneTable);
    table.style.display = 'none';

    leaderboardOverlay = { liveGroup: group, liveTable: table, cloneGroup, cloneTable, cloneTbody, rowTemplate };
    return leaderboardOverlay;
  }

  function hideCustomLeaderboard() {
    if (!leaderboardOverlay) return;
    const { liveGroup, liveTable, cloneGroup, cloneTable } = leaderboardOverlay;
    if (liveGroup) liveGroup.style.display = '';
    if (liveTable) liveTable.style.display = '';
    if (cloneGroup && cloneGroup.parentElement) cloneGroup.remove();
    if (cloneTable && cloneTable.parentElement) cloneTable.remove();
    leaderboardOverlay = null;
  }

  // Sets an avatar <img>'s src with a plain fallback on load failure — some submitted avatar
  // URLs (e.g. a Tenor GIF someone set as their case-clicker profile picture) get region/
  // hotlink-blocked and render as a "Content not viewable in your region" placeholder image
  // instead of erroring cleanly. This is a site-wide quirk (the native leaderboard shows the
  // exact same broken image for those users), not something introduced here — but we can at
  // least fall back to a blank avatar instead of showing that placeholder ourselves.
  function setAvatarSrc(img, url) {
    if (!img) return;
    if (!url) { img.removeAttribute('src'); return; }
    img.onerror = () => { img.onerror = null; img.removeAttribute('src'); };
    img.src = url;
  }

  async function renderCustomLeaderboard() {
    const overlay = showCustomLeaderboardClone();
    if (!overlay) return;
    const entries = await fetchLeaderboard(50);
    if (!leaderboardActive) return; // user switched category (or left the page) while this was in flight

    const { cloneGroup, cloneTbody, rowTemplate } = overlay;
    // Podium DOM order is 2nd/1st/3rd place (tallest stack in the middle) — only the 3 DIRECT
    // Stack children of this Group are podium slots (see showCustomLeaderboardClone).
    const stacks = [...cloneGroup.children].filter(c => c.classList.contains('mantine-Stack-root'));
    const podiumSlots = [entries[1], entries[0], entries[2]];
    stacks.forEach((stack, i) => {
      const entry = podiumSlots[i];
      const texts = [...stack.querySelectorAll('p.mantine-Text-root')];
      const avatarImg = stack.querySelector('img.mantine-Avatar-image');
      if (!entry) { texts.forEach(p => { p.textContent = '—'; }); setAvatarSrc(avatarImg, null); return; }
      if (texts[0]) texts[0].textContent = entry.username || 'Unknown';
      if (texts[1]) texts[1].textContent = Math.round(entry.totalValue).toLocaleString('en-US');
      if (texts[2]) texts[2].textContent = fmtFull(entry.totalValue);
      setAvatarSrc(avatarImg, entry.avatarUrl);
    });

    cloneTbody.innerHTML = '';
    entries.slice(3).forEach((entry, i) => {
      const tr = rowTemplate.cloneNode(true);
      const tds = [...tr.querySelectorAll('td')];
      if (tds[0]) tds[0].textContent = '#' + (i + 4);
      if (tds[1]) {
        const avatarImg = tds[1].querySelector('img.mantine-Avatar-image');
        const nameP = tds[1].querySelector('p.mantine-Text-root');
        setAvatarSrc(avatarImg, entry.avatarUrl);
        if (nameP) nameP.textContent = entry.username || 'Unknown';
        else tds[1].textContent = entry.username || 'Unknown';
      }
      if (tds[3]) tds[3].textContent = Math.round(entry.totalValue).toLocaleString('en-US');
      if (tds[4]) tds[4].textContent = fmtFull(entry.totalValue);
      cloneTbody.appendChild(tr);
    });
  }

  function hookLeaderboardPage() {
    if (location.pathname !== '/leaderboard') {
      leaderboardActive = false;
      hideCustomLeaderboard();
      return;
    }
    hookCategoryDropdown();
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
    const ctx = currentContext();
    const cards = document.querySelectorAll('.mantine-Card-root');
    // Only the real /inventory and storage-unit list pages have a Sort dropdown our
    // takeover can actually drive. Elsewhere (e.g. the trade page's "Add skins to trade"
    // modal, which has its own unrelated "Sort" control) hijacking it just showed a fake
    // "Pricedata" label that didn't sort anything, and reloaded the whole page on click.
    if (ctx) {
      if (cards.length && cards.length !== nativePageSkins.length) primeCurrentPage();
      hookSortDropdown();
      applySort();
      updateCardPrices();
    }
    updateExtraCardPrices();
    addCopyBtns();
    renderInlineTotal();
    if (ctx && ctx.type === 'inv') injectScanButton();
    if (ctx) getCachedTotals().then(() => { renderInlineTotal(); }).catch(() => {});
    hookLeaderboardPage();
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
