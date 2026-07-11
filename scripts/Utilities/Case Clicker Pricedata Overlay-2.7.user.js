// ==UserScript==
// @name         Case Clicker Pricedata Overlay
// @namespace    cco-pricedata
// @version      5.6
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
    // The List tab specifically is now served from a "Publish to web" CSV link instead of the
    // gviz/tq export — per explicit instruction. Note this pub link is scoped to just the List
    // sheet (Google's per-sheet publish, not "entire document") — confirmed live that the same
    // pub ID does NOT resolve other gids (PriceData, pattern tabs), so those still go through
    // csvUrl()/gviz below. If those get published too, give this the new pub ID and this can
    // be generalized the same way.
    LIST_PUB_ID: '2PACX-1vQHX9j8A3dRJrJS-J7Zs7PcIAC-5CgBydhFVOELd92PqPZY2VdJXEDtk4AIDgVl1-lnO_JcV3pBGouy',
    // Per explicit instruction: List is now the ONLY pattern-price source — the 12 per-pattern
    // "theme" tabs (Case Hardened, Doppler, Fade, etc.) that used to be merged in underneath it
    // are no longer fetched at all. Known tradeoff (flagged and accepted): any pattern that
    // isn't actually present in List — e.g. Karambit | Marble Fade 'Fire and Ice' was missing
    // at one point, which is specifically why the theme tabs got pulled in originally — will
    // fall through to native/QS pricing instead of resolving a sheet price. Fewer requests
    // either way, which also helps with the rate-limit issues this version is fixing.
    REFRESH_MS: 5 * 60 * 1000,
    CACHE_MS: 60 * 1000,
    // Persisted (localStorage-backed) cache for the inline "Pricedata value" total — survives
    // page navigation, unlike totalsCache/globalSortedCache which are in-memory only and reset
    // on every reload. Long TTL on purpose: this number is only ever refreshed by an explicit
    // click now (see triggerTotalsCalculation), so there's no harm showing a slightly-stale
    // cached figure instantly rather than re-scanning every visit.
    LOCAL_CACHE_MS: 10 * 60 * 1000,
    // Delay between successive page fetches in fetchAllSkins — a full inventory/storage-unit
    // scan used to fire every page request at once (Promise.all), which was tripping the
    // site's rate limiter on larger inventories/storage units. Sequential + a small gap is
    // slower but reliable. Applies to both inventory and storage-unit scans (same function).
    FETCH_DELAY_MS: 350,
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
  function listCsvUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${CONFIG.LIST_PUB_ID}/pub?gid=${CONFIG.LIST_GID}&single=true&output=csv`;
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

  async function loadData() {
    try {
      const [pdText, listText] = await Promise.all([
        origFetch(csvUrl(CONFIG.PRICE_DATA_GID)).then(r => r.text()),
        origFetch(listCsvUrl()).then(r => r.text()),
      ]);
      const pdRows = parseCSV(pdText);
      const newPriceMap = new Map();
      for (let i = 1; i < pdRows.length; i++) {
        const row = pdRows[i];
        if (!row || !row[3]) continue;
        const price = parseFloat(row[11]);
        if (!isNaN(price)) newPriceMap.set(row[3].trim(), price);
      }

      // List is now the sole pattern-price source (the 12 theme tabs are no longer fetched
      // or merged in — per explicit instruction). Anything not present here falls through to
      // native/QS pricing in calcPrice() instead of resolving a sheet price.
      const newListMap = new Map();
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
      console.log('[cco-pricedata] loaded', newPriceMap.size, 'PriceData rows,', newListMap.size, 'pattern rows (List only)');
      scheduleTick();
    } catch (e) {
      console.error('[cco-pricedata] failed to load sheet data', e);
    }
  }

  // ---------- Pricing ----------
  // Rewritten to mirror the reference bot's calculateSkinPrice() line-for-line (given verbatim):
  // ordering matters — the 1/1 bonus applies BEFORE ST/SV/EV (so those stack on top of it, not
  // the other way around), ST/SV/EV/quality all run unconditionally off whatever `price`
  // currently holds (no gating on whether a sheet wear-price was actually found), quality
  // scaling resets to the bare skin.weaponPrice when no wear price was found (discarding
  // whatever the initial skin.price carried), and the sticker contribution is restored at the
  // very end as (skin.price - skin.weaponPrice) rather than resummed from skin.stickers[].
  // priceDataByName (flat name -> price, from the PriceData tab) is still fetched/parsed above
  // but intentionally no longer consulted here — the reference's non-pattern branch has no
  // equivalent flat lookup at all, so this now matches it exactly rather than overriding with
  // an extra data source it never asked for.

  // Some patterns are correctly flagged as real event drops (skin.event truthy) but their
  // specific pattern has no EV multiplier documented anywhere in the sheet — e.g. Talon Knife
  // Fade '100% Fade'/'80% Fade' during Halloween 2025: every other knife pattern in that same
  // "Fade(Knife)" tab has an EV value (x3), these two rows are just blank. Rather than silently
  // falling through to no event bonus at all, use explicit fallback base values (pre quality
  // scaling, same slot as the sheet's own wearPrice) given directly for these two patterns.
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
  // (pattern skins — Doppler phases included, no exclusion). "Tier" Skin Group patterns (the
  // generic "Tier 1"-"Tier 5" buckets, native/QS-priced with no sheet FN/MW value) get a flat
  // $5M instead of the 15x multiplier since there's no calculated price to multiply at all.
  function getFloatRanks(skin) {
    return skin.floatRanks ? Object.values(skin.floatRanks) : [];
  }

  function calcPrice(skin) {
    const native = (typeof skin.price === 'number' ? skin.price : skin.weaponPrice) || 0;
    if (!dataReady) return { calc: native, native, source: 'loading' };

    const ranks = getFloatRanks(skin);
    const weaponPrice = typeof skin.weaponPrice === 'number' ? skin.weaponPrice : 0;
    const skinPrice = typeof skin.price === 'number' ? skin.price : weaponPrice;
    let price = skinPrice;
    let source = 'fallback-native';

    if (skin.patternId && listByPatternId.has(skin.patternId)) {
      const row = listByPatternId.get(skin.patternId);
      const skinGroupValue = String(row[3] || '').trim();
      const col = EXT_COL[skin.exterior];
      let wearPrice = col != null ? parseMagnitude(row[col]) : null;
      if (wearPrice == null) wearPrice = parseMagnitude(row[2]);
      let hasPrice = false;
      if (wearPrice != null) { price = wearPrice; hasPrice = true; }

      // 1/1 bonus applies first — ST/SV/EV below stack on top of it, per the reference.
      if (ranks[18] === 1 && ranks[19] === 1) {
        price = skinGroupValue === 'Tier' ? 5000000 : Math.max(5000000, price * 15);
      }

      // Skin Group "Knife08" (e.g. Nomad Knife | Fade '100% Fade') is a documented exception
      // straight from the reference bot: its ST column ("ST (MW)" in the sheet) is only ever
      // populated for the Minimal Wear copy — applying it to Factory New too (as this used to
      // do) inflated FN StatTrak cards by the MW-only multiplier. Confirmed live: FN ST 100%
      // Fade Nomad Knife should price the same as the non-ST FN copy, not FN base * ST * EV.
      const skipStForKnife08FN = skinGroupValue === 'Knife08' && skin.exterior === 'Factory New';
      if (skin.statTrak) {
        if (!skipStForKnife08FN) { const adj = parseAdjustment(row[9]); if (adj) price = applyAdjustment(price, adj); }
      } else if (skin.souvenir) {
        const adj = parseAdjustment(row[10]); if (adj) price = applyAdjustment(price, adj);
      }

      // EV (event) multiplier ONLY applies to actual event skins. Confirmed via /price
      // ground truth: a non-event Crimson Web 'Centered Web' Stiletto Knife (BS, quality 2)
      // priced at exactly base*7^quality with NO EV applied ($7.84M) — applying EV
      // unconditionally was tried and contradicted by the bot, so this stays gated.
      if (skin.event) {
        const ev = parseAdjustment(row[11]);
        if (ev) price = applyAdjustment(price, ev);
        else if (EVENT_EV_FALLBACK_BY_PATTERN_ID[skin.patternId] != null) price = EVENT_EV_FALLBACK_BY_PATTERN_ID[skin.patternId];
      }

      const quality = typeof skin.quality === 'number' ? skin.quality : 0;
      if (quality) {
        // No valid wear price found: reset to the bare weapon price (discarding whatever
        // `price` held so far) before applying quality scaling — matches the reference exactly.
        price = hasPrice ? price : weaponPrice;
        price = price * (quality > 0 ? Math.pow(CONFIG.QUALITY_BASE, quality) : 1);
      }

      // The sheet price is for the bare weapon — restore whatever sticker value the game itself
      // already baked into skin.price (skin.price - skin.weaponPrice), since `price` above may
      // have replaced skin.price entirely with the sheet's own number.
      if (skinPrice !== weaponPrice) price = price + (skinPrice - weaponPrice);

      source = hasPrice ? 'calculated' : 'calculated-no-wear-price';
    } else if (!skin.patternId) {
      // No patternId at all: flat non-pattern 1/1 bonus only, nothing else — matches the
      // reference's `else` branch exactly. (patternId present but no matching sheet row falls
      // through here too, per the reference: price stays at raw skin.price, no bonus at all.)
      if (ranks[6] === 1 && ranks[7] === 1) price += 5000000;
    }

    // Final unconditional overrides, applied regardless of branch above.
    if (typeof skin.name === 'string' && skin.name.includes('Terminal')) { price = 25000; source = 'terminal-flat'; }

    // Unapplied/standalone Katowice 2014 holo stickers aren't real skins — no patternId, no
    // per-pattern sheet row — so they'd otherwise fall through to raw native price. Priced
    // instead at 3x their own quality-scaled ("QS") base: weaponPrice*7^quality if this copy
    // carries a quality tier, otherwise just its own price as-is (quality 0 is the norm for a
    // standalone sticker item, so this is usually just skinPrice*3).
    if (typeof skin.name === 'string' && skin.name.includes('(Holo) | Katowice 2014')) {
      const kQuality = typeof skin.quality === 'number' ? skin.quality : 0;
      const qsBase = kQuality > 0 ? weaponPrice * Math.pow(CONFIG.QUALITY_BASE, kQuality) : skinPrice;
      price = qsBase * 3;
      source = 'katowice-3x';
    }

    return { calc: price, native, source };
  }

  function fmtFull(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- Display rounding (Pricedata Scan menu only) ----------
  // Persisted display preference for the scan menu's own numbers — Full (exact, with cents),
  // Rounded (nearest whole dollar), or abbreviated to 2/3 significant figures (e.g. $1.8M /
  // $1.82M). Doesn't touch card badges or the leaderboard — this only affects the menu.
  function getNumberFormat() {
    const v = localStorage.getItem('cco_numberFormat');
    return (v === 'rounded' || v === '2sf' || v === '3sf') ? v : 'full';
  }
  function setNumberFormat(mode) { localStorage.setItem('cco_numberFormat', mode); }

  // Formats n to the given number of significant figures, abbreviating with a K/M/B/T suffix
  // once the magnitude warrants one (mirrors how the site itself shows big numbers, e.g. the
  // header's "$47.103M").
  function toSigFigString(n, sigFigs) {
    if (n === 0) return '0';
    const neg = n < 0;
    const abs = Math.abs(n);
    const SUFFIXES = [{ v: 1e12, s: 'T' }, { v: 1e9, s: 'B' }, { v: 1e6, s: 'M' }, { v: 1e3, s: 'K' }];
    const suf = SUFFIXES.find(x => abs >= x.v);
    let str;
    if (!suf) {
      const mag = Math.floor(Math.log10(abs));
      const decimals = Math.max(0, sigFigs - 1 - mag);
      str = abs.toFixed(decimals);
    } else {
      const scaled = abs / suf.v;
      const mag = Math.floor(Math.log10(scaled));
      const decimals = Math.max(0, sigFigs - 1 - mag);
      str = scaled.toFixed(decimals) + suf.s;
    }
    return (neg ? '-' : '') + str;
  }

  function fmtByMode(n, mode) {
    if (n == null || isNaN(n)) return '$0.00';
    if (mode === 'rounded') return '$' + Math.round(n).toLocaleString('en-US');
    if (mode === '2sf') return '$' + toSigFigString(n, 2);
    if (mode === '3sf') return '$' + toSigFigString(n, 3);
    return fmtFull(n);
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
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Sequential with a small delay between requests — this used to fire every page of a
  // scan at once via Promise.all, which was tripping the site's rate limiter on bigger
  // inventories/storage units (missing prices, broken sort — the response for a burst
  // request would come back empty/erroring and we'd silently rank it wrong). Slower, but
  // it actually finishes correctly. Shared by both inventory and storage-unit scans.
  async function fetchAllSkins(ctx, onProgress) {
    const first = await origFetch(listUrlFor(ctx, 1), { credentials: 'include' }).then(r => r.json());
    const pages = first.pages || 1;
    const all = [...(first.skins || [])];
    onProgress && onProgress(1, pages);
    for (let p = 2; p <= pages; p++) {
      await sleep(CONFIG.FETCH_DELAY_MS);
      const d = await origFetch(listUrlFor(ctx, p), { credentials: 'include' }).then(r => r.json());
      all.push(...(d.skins || []));
      onProgress && onProgress(p, pages);
    }
    return all;
  }

  // Shared per-context in-flight fetchAllSkins() promise. getGlobalSorted (below) and
  // triggerTotalsCalculation each independently need a full fetchAllSkins(ctx) result —
  // without sharing the actual in-flight fetch, triggering both around the same time (e.g.
  // Pricedata sort is active on a page AND you click the inline total) launched two full
  // parallel scans of the exact same data: duplicate requests against precisely the rate
  // limit this whole cache system exists to protect (flagged by zhiro — thanks!). A caller
  // that joins an already-in-flight fetch doesn't get progress callbacks — only whichever
  // call actually started the fetch does — but the result itself is shared correctly.
  const inFlightFetches = new Map(); // key -> promise
  function fetchAllSkinsShared(ctx, onProgress) {
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const existing = inFlightFetches.get(key);
    if (existing) return existing;
    const promise = fetchAllSkins(ctx, onProgress).finally(() => {
      if (inFlightFetches.get(key) === promise) inFlightFetches.delete(key);
    });
    inFlightFetches.set(key, promise);
    return promise;
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
      try {
        const all = await fetchAllSkinsShared(ctx);
        const sorted = all.slice().sort((a, b) => calcPrice(b).calc - calcPrice(a).calc);
        globalSortedCache.set(key, { items: sorted, ts: Date.now(), pending: false });
        return sorted;
      } catch (e) {
        // A failed/rate-limited fetch (e.g. a non-JSON response body) must not leave this
        // cache entry permanently "pending" on an already-rejected promise — every future
        // call would just replay the same dead promise until a full page reload, silently
        // breaking Pricedata sort until then. Clear it so the next call actually retries.
        console.error('[cco-pricedata] global sort failed', e);
        globalSortedCache.delete(key);
        throw e;
      }
    })();
    globalSortedCache.set(key, Object.assign({}, cached, { pending: true, promise }));
    return promise;
  }
  // Persisted (localStorage) sibling of totalsCache — survives navigation/reloads, unlike the
  // in-memory Map. Read-only helpers; only triggerTotalsCalculation() ever writes to it.
  function loadPersistedTotals(key) {
    try {
      const raw = localStorage.getItem('cco_totals_' + key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.calc !== 'number' || typeof obj.native !== 'number' || typeof obj.ts !== 'number') return null;
      return obj;
    } catch (e) { return null; }
  }
  function savePersistedTotals(key, calc, native) {
    try { localStorage.setItem('cco_totals_' + key, JSON.stringify({ calc, native, ts: Date.now() })); } catch (e) { /* storage full/blocked — cache is best-effort */ }
  }

  // Read-only: never fetches. Inventory/storage-unit scans used to run automatically on
  // every tick (every few seconds while the page was open), which was hammering the site's
  // API hard enough to get rate-limited — that's what was breaking both the price display
  // and the global sort. Now the only things that ever call fetchAllSkins are explicit user
  // actions (this click, the Sort dropdown's "Pricedata" option, or the Scan All button).
  // This just answers "do we already know the total" from memory or a fresh-enough
  // localStorage cache — if not, the caller (renderInlineTotal) shows a click prompt instead.
  function getCachedTotals() {
    const ctx = currentContext();
    if (!ctx) return null;
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const cached = totalsCache.get(key);
    if (cached && !cached.pending && Date.now() - cached.ts < CONFIG.CACHE_MS) return cached;
    const persisted = loadPersistedTotals(key);
    if (persisted && Date.now() - persisted.ts < CONFIG.LOCAL_CACHE_MS) {
      totalsCache.set(key, Object.assign({}, persisted, { pending: false }));
      return persisted;
    }
    return cached && cached.pending ? cached : null;
  }

  // The actual fetch-and-compute, only ever run from an explicit click (see renderInlineTotal).
  async function triggerTotalsCalculation() {
    const ctx = currentContext();
    if (!ctx) return null;
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const already = totalsCache.get(key);
    if (already && already.pending) return already.pending;
    const promise = (async () => {
      try {
        const all = await fetchAllSkinsShared(ctx);
        let calc = 0, native = 0;
        all.forEach(s => { if (!isIncluded(s._id)) return; const r = calcPrice(s); calc += r.calc; native += r.native; });
        const res = { calc, native, ts: Date.now(), pending: false };
        totalsCache.set(key, res);
        savePersistedTotals(key, calc, native);
        renderInlineTotal();
        return res;
      } catch (e) {
        console.error('[cco-pricedata] totals failed', e);
        totalsCache.delete(key);
        renderInlineTotal();
        return null;
      }
    })();
    totalsCache.set(key, { pending: promise });
    renderInlineTotal();
    return promise;
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

  // Persists both the in-memory totalsCache and the localStorage-backed cache for a given
  // key, exactly like triggerTotalsCalculation() already does for whichever single page
  // you're currently viewing — scanAll uses the same two caches so a full scan updates the
  // stored value for EVERY storage unit (and inventory), not just whichever one is on screen.
  // This is what lets the scan menu (and the inline per-page total) show a fresh number for
  // any unit without re-fetching it.
  function cacheTotal(key, calc, native) {
    totalsCache.set(key, { calc, native, ts: Date.now(), pending: false });
    savePersistedTotals(key, calc, native);
  }

  async function scanAll(onProgress) {
    onProgress && onProgress('Scanning inventory…');
    const invSkins = await fetchAllSkins({ type: 'inv' });
    const inv = sumSkins(invSkins);
    cacheTotal('inv', inv.calc, inv.native);

    const sus = await fetchStorageUnitsList();
    const suResults = [];
    for (let i = 0; i < sus.length; i++) {
      const su = sus[i];
      onProgress && onProgress(`Scanning storage unit ${i + 1}/${sus.length}: ${su.name || su._id}…`);
      const skins = await fetchAllSkins({ type: 'su', id: su._id });
      const result = Object.assign({ id: su._id, name: su.name || '(unnamed)' }, sumSkins(skins));
      suResults.push(result);
      cacheTotal('su:' + su._id, result.calc, result.native);
    }

    const grandCalc = inv.calc + suResults.reduce((s, r) => s + r.calc, 0);
    const grandNative = inv.native + suResults.reduce((s, r) => s + r.native, 0);
    onProgress && onProgress('Fetching Premier stats…');
    const premier = await fetchPremierStats();
    renderInlineTotal(); // reflect the freshly-cached inventory total immediately, if we're on /inventory
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
        // X-CCO-Client: the API now rejects submissions without this tag (added after someone
        // posted forged entries — "ROWAN"/userId "7" and "Demo" with a 999-trillion total —
        // straight to the endpoint with curl/devtools). Must match CLIENT_TAG in submit-score.js.
        headers: { 'Content-Type': 'application/json', 'X-CCO-Client': 'cco-overlay-v1' },
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

  let scanning = false;

  // ---------- Scan menu (replaces the old immediate-scan + results-modal flow) ----------
  // Opens as a dropdown panel below the button instead of blocking on a full scan. Shows
  // whatever's already cached locally (loadPersistedTotals — the same localStorage cache the
  // inline per-page total uses) for inventory and every storage unit immediately, lets you
  // trigger a fresh Scan All from inside the menu with live progress, toggle leaderboard
  // submission, and click any storage unit row to open it.
  let scanMenuEl = null;
  let scanMenuBtn = null;

  function closeScanMenu() {
    if (scanMenuEl) { scanMenuEl.remove(); scanMenuEl = null; }
    document.removeEventListener('click', onScanMenuOutsideClick, true);
  }

  function onScanMenuOutsideClick(e) {
    if (scanMenuEl && !scanMenuEl.contains(e.target) && scanMenuBtn && !scanMenuBtn.contains(e.target)) {
      closeScanMenu();
    }
  }

  function cachedRawValue(key) {
    const persisted = loadPersistedTotals(key);
    return persisted ? persisted.calc : null;
  }

  // rawValue is a number (formatted per the current display-format setting, and reformatted
  // in place whenever that setting changes — see reformatScanMenuValues) or null (nothing
  // scanned yet, shown as plain text with nothing to reformat).
  function buildScanMenuRow(label, rawValue, onClick) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;' +
      'padding:7px 2px;border-bottom:1px solid #333;font-size:13px;';
    if (onClick) {
      row.style.cursor = 'pointer';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,102,0,.08)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', onClick);
    }
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameSpan.textContent = label;
    const valueSpan = document.createElement('span');
    valueSpan.style.cssText = 'color:#f60;white-space:nowrap;flex-shrink:0;';
    if (rawValue == null) {
      valueSpan.textContent = 'Not scanned yet';
    } else {
      valueSpan.dataset.rawValue = String(rawValue);
      valueSpan.textContent = fmtByMode(rawValue, getNumberFormat());
    }
    row.appendChild(nameSpan);
    row.appendChild(valueSpan);
    return row;
  }

  // Re-renders every value currently shown in the menu using whatever display-format is
  // selected right now — called once when the format buttons are toggled, so switching
  // Full/Rounded/2SF/3SF doesn't require a re-scan or reopening the menu.
  function reformatScanMenuValues() {
    if (!scanMenuEl) return;
    const mode = getNumberFormat();
    scanMenuEl.querySelectorAll('[data-raw-value]').forEach(el => {
      const raw = parseFloat(el.dataset.rawValue);
      if (!isNaN(raw)) el.textContent = fmtByMode(raw, mode);
    });
  }

  // (Re)populates the storage-unit list from whatever's cached locally right now — called on
  // open, and again after a scan completes so the fresh totals show immediately.
  async function refreshScanMenuStorageUnits() {
    const listEl = scanMenuEl && scanMenuEl.querySelector('#cco-scan-menu-su-list');
    if (!listEl) return;
    const sus = await fetchStorageUnitsList();
    listEl.innerHTML = '';
    if (!sus.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:8px 2px;opacity:.6;font-size:12px;';
      empty.textContent = 'No storage units.';
      listEl.appendChild(empty);
      return;
    }
    sus.forEach(su => {
      const row = buildScanMenuRow(su.name || '(unnamed)', cachedRawValue('su:' + su._id), () => {
        window.location.href = '/inventory/storageUnits/' + su._id;
      });
      listEl.appendChild(row);
    });
  }

  async function openScanMenu(btn) {
    closeScanMenu();
    scanMenuBtn = btn;

    const panel = document.createElement('div');
    panel.id = 'cco-scan-menu';
    panel.style.cssText = 'background:#1a1a1e;border:1px solid #f60;border-radius:8px;padding:14px 16px;' +
      'max-width:420px;width:100%;max-height:70vh;overflow:auto;color:#fff;font-size:14px;font-family:inherit;' +
      'margin-top:8px;box-shadow:0 4px 16px rgba(0,0,0,.5);';
    panel.addEventListener('click', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;';
    title.textContent = 'Pricedata Scan';
    panel.appendChild(title);

    // Display-format toggle (Full / Rounded / 2SF / 3SF) — affects every value shown in this
    // menu only (card badges and the leaderboard are unaffected), persisted across opens.
    const formatRow = document.createElement('div');
    formatRow.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;';
    const FORMAT_OPTIONS = [['full', 'Full'], ['rounded', 'Rounded'], ['2sf', '2SF'], ['3sf', '3SF']];
    function paintFormatButtons() {
      const current = getNumberFormat();
      [...formatRow.children].forEach(b => {
        const active = b.dataset.formatMode === current;
        b.style.background = active ? '#f60' : 'transparent';
        b.style.color = active ? '#000' : '#f60';
      });
    }
    FORMAT_OPTIONS.forEach(([mode, label]) => {
      const fBtn = document.createElement('button');
      fBtn.textContent = label;
      fBtn.dataset.formatMode = mode;
      fBtn.style.cssText = 'flex:1;padding:5px 0;font-size:11px;font-weight:600;border-radius:4px;' +
        'cursor:pointer;border:1px solid #f60;background:transparent;color:#f60;';
      fBtn.addEventListener('click', () => {
        setNumberFormat(mode);
        paintFormatButtons();
        reformatScanMenuValues();
      });
      formatRow.appendChild(fBtn);
    });
    paintFormatButtons();
    panel.appendChild(formatRow);

    // Cached (last-scanned) inventory total, shown instantly — no fetch needed to open this.
    const invRow = buildScanMenuRow('Inventory', cachedRawValue('inv'));
    invRow.style.fontWeight = '600';
    invRow.style.borderBottom = '1px solid #444';
    panel.appendChild(invRow);

    const suListEl = document.createElement('div');
    suListEl.id = 'cco-scan-menu-su-list';
    suListEl.style.cssText = 'margin-top:2px;';
    panel.appendChild(suListEl);

    // Leaderboard opt-in toggle — always visible here now (previously only shown in the
    // post-scan modal, so there was no way to see/change it without running a scan first).
    if (CONFIG.LEADERBOARD_API_BASE) {
      const lbRow = document.createElement('div');
      lbRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;' +
        'padding:10px 0 0;margin-top:10px;border-top:1px solid #444;';
      const label = document.createElement('div');
      label.innerHTML = '<div>Submit to Leaderboard</div>' +
        '<div style="opacity:.6;font-size:11px;">Shares your name, avatar, and total publicly</div>';
      const toggle = document.createElement('div');
      toggle.style.cssText = 'width:40px;height:22px;border-radius:11px;cursor:pointer;flex-shrink:0;' +
        'border:2px solid #f60;box-sizing:border-box;position:relative;transition:background .15s;';
      const knob = document.createElement('div');
      knob.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#f60;position:absolute;' +
        'top:2px;left:2px;transition:left .15s;';
      toggle.appendChild(knob);
      const paint = (on) => {
        knob.style.left = on ? '20px' : '2px';
        toggle.style.background = on ? 'rgba(255,102,0,.3)' : 'transparent';
      };
      paint(lbSubmitEnabled());
      toggle.addEventListener('click', () => {
        const next = !lbSubmitEnabled();
        setLbSubmitEnabled(next);
        paint(next);
      });
      lbRow.appendChild(label);
      lbRow.appendChild(toggle);
      panel.appendChild(lbRow);
    }

    const scanRow = document.createElement('div');
    scanRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:12px;';
    const scanBtn = document.createElement('button');
    scanBtn.textContent = 'Scan All';
    scanBtn.style.cssText = 'background:#f60;color:#000;border:none;border-radius:4px;' +
      'padding:8px 14px;cursor:pointer;font-weight:600;font-size:13px;';
    const statusEl = document.createElement('span');
    statusEl.style.cssText = 'font-size:12px;opacity:.75;';
    scanRow.appendChild(scanBtn);
    scanRow.appendChild(statusEl);
    panel.appendChild(scanRow);

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:12px;padding-top:8px;border-top:1px solid #333;text-align:right;';
    const updateLink = document.createElement('a');
    updateLink.textContent = 'Check for script updates';
    updateLink.href = 'javascript:void(0)';
    updateLink.style.cssText = 'color:#f60;font-size:11px;opacity:.75;text-decoration:none;cursor:pointer;';
    updateLink.addEventListener('click', () => onUpdateButtonClick());
    footer.appendChild(updateLink);
    panel.appendChild(footer);

    scanMenuEl = panel;
    btn.closest('.mantine-Grid-root').insertAdjacentElement('afterend', panel);
    setTimeout(() => document.addEventListener('click', onScanMenuOutsideClick, true), 0);

    refreshScanMenuStorageUnits();

    scanBtn.addEventListener('click', async () => {
      if (scanning) return;
      scanning = true;
      scanBtn.disabled = true;
      try {
        const results = await scanAll((msg) => { statusEl.textContent = msg; });
        const invValSpan = invRow.querySelector('span:last-child');
        invValSpan.dataset.rawValue = String(results.inv.calc);
        invValSpan.textContent = fmtByMode(results.inv.calc, getNumberFormat());
        await refreshScanMenuStorageUnits();
        statusEl.textContent = `Done — grand total ${fmtByMode(results.grandCalc, getNumberFormat())}`;
        if (lbSubmitEnabled()) {
          statusEl.textContent += ' — submitting to leaderboard…';
          await submitToLeaderboard(results.grandCalc, results.grandNative, results.premier);
          statusEl.textContent = `Done — grand total ${fmtByMode(results.grandCalc, getNumberFormat())} (submitted ✓)`;
        }
      } catch (err) {
        console.error('[cco-pricedata] scan failed', err);
        statusEl.textContent = 'Scan failed — see console.';
      } finally {
        scanBtn.disabled = false;
        scanning = false;
      }
    });
  }

  function toggleScanMenu(btn) {
    if (scanMenuEl) { closeScanMenu(); return; }
    openScanMenu(btn);
  }

  // Opens the raw @updateURL in a new tab. Tampermonkey intercepts .user.js URLs itself and,
  // if a script with the same @namespace/@name is already installed, shows its own "Update"
  // (rather than "Install") prompt when the remote @version is newer — confirmed live, this
  // is exactly what happens navigating to raw.githubusercontent.com/.../*.user.js. So this
  // link is a real manual "check now" trigger, not just a link to the source.
  function onUpdateButtonClick() {
    window.open('https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/Utilities/Case%20Clicker%20Pricedata%20Overlay-2.7.user.js', '_blank');
  }

  // Cloning one of the native columns (Float Rank Management / Custom Sell / Storage Units /
  // Special Effects) and appending it into the SAME row — rather than the old approach of
  // cloning the whole row into a second row underneath — keeps identical Mantine classes and
  // puts everything in one bar, per explicit request. All columns (native + ours) are then
  // force-resized to an even share so the row still fits. Re-run every tick (cheap, and
  // self-healing if the site ever re-renders this row and drops our appended column).
  function injectScanButton() {
    const srcBtn = [...document.querySelectorAll('button')].find(b => /Float Rank Management|Storage Units|Special Effects|Custom Sell/.test(b.textContent));
    if (!srcBtn) return;
    const gridRoot = srcBtn.closest('.mantine-Grid-root');
    const inner = gridRoot && gridRoot.querySelector('.mantine-Grid-inner');
    if (!gridRoot || !inner) return;

    let scanCol = inner.querySelector('[data-cco-scan-col]');
    if (!scanCol) {
      const template = inner.querySelector('.mantine-Grid-col');
      if (!template) return;
      scanCol = template.cloneNode(true);
      scanCol.dataset.ccoScanCol = '1';
      const btn = scanCol.querySelector('button');
      btn.removeAttribute('id');
      btn.style.width = '100%';
      setButtonLabel(btn, 'Pricedata Scan');
      btn.addEventListener('click', (e) => { e.stopPropagation(); toggleScanMenu(btn); });
      inner.appendChild(scanCol);
    }

    // Evenly distribute width across every real column in the row (native + ours) so it all
    // fits as one bar instead of overflowing or wrapping onto a second line.
    const allCols = [...inner.querySelectorAll('.mantine-Grid-col')];
    const pct = (100 / allCols.length).toFixed(4) + '%';
    allCols.forEach(c => { c.style.flex = `1 1 ${pct}`; c.style.maxWidth = pct; });

    // If the scan menu is open, keep it anchored right after this row — a re-render of the
    // row could otherwise leave the menu orphaned next to a stale/detached node.
    if (scanMenuEl && scanMenuEl.previousElementSibling !== gridRoot) {
      gridRoot.insertAdjacentElement('afterend', scanMenuEl);
    }
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

  // No longer auto-fetches (see getCachedTotals/triggerTotalsCalculation above) — a full
  // inventory or storage-unit scan only ever runs from an explicit click now, to avoid
  // hammering the site's API (and getting rate-limited) just from having the page open.
  // Three states: a fresh cached/persisted number (click to refresh), a scan in flight
  // ("calculating…"), or nothing yet (click prompt).
  let inlineTotalEl = null;
  function renderInlineTotal() {
    const ctx = currentContext();
    if (!ctx) return;
    const valueEl = findValueEl();
    if (!valueEl) return;
    if (!inlineTotalEl || !inlineTotalEl.isConnected) {
      inlineTotalEl = document.createElement('p');
      inlineTotalEl.className = 'mantine-Text-root';
      inlineTotalEl.style.cssText = 'font-size:12px;opacity:.85;margin-top:2px;color:#f60;cursor:pointer;';
      inlineTotalEl.addEventListener('click', () => { triggerTotalsCalculation(); });
      valueEl.insertAdjacentElement('afterend', inlineTotalEl);
    }
    const key = ctx.type === 'su' ? 'su:' + ctx.id : 'inv';
    const raw = totalsCache.get(key);
    const cached = getCachedTotals();
    if (raw && raw.pending) {
      inlineTotalEl.textContent = 'Pricedata value: calculating…';
      inlineTotalEl.title = '';
    } else if (cached && cached.calc != null) {
      inlineTotalEl.textContent = `Pricedata value: ${fmtFull(cached.calc)} (click to refresh)`;
      inlineTotalEl.title = `Native: ${fmtFull(cached.native)}`;
    } else {
      inlineTotalEl.textContent = 'Pricedata value: click to calculate';
      inlineTotalEl.title = 'Fetches every page of this inventory/storage unit — click when ready.';
    }
  }

  // ---------- /leaderboard page: Pricedata leaderboard as its own separate link ----------
  // Per explicit instruction, this is no longer folded into the native Category dropdown as
  // an extra option — instead there's a button on /leaderboard that navigates to a distinct
  // URL (a #pricedata hash on the same page, so it's a real bookmarkable/shareable link and
  // the browser back button works) which shows a copy of the SAME podium+table format the
  // native leaderboard uses, just backed by our own data.
  //
  // Earlier version mutated the SITE's own live podium/table nodes in place. That broke on
  // click: mutating textContent/img.src only changes what's displayed — it never touches
  // React's actual props for those nodes, so any click handler React still owns kept
  // referencing whichever real player was there before we overwrote it, navigating to a
  // stale/wrong profile. Fix: clone the podium Group and the table wholesale (cloneNode does
  // NOT copy React's internal fiber/prop references or any addEventListener-bound handlers —
  // only real DOM attributes), hide the live originals (and the Category select itself, while
  // our view is up, so changing it can't leave stale content showing), and populate the
  // detached clones instead. Same exact styling, zero stale bindings.
  const PRICEDATA_LEADERBOARD_HASH = '#pricedata';
  let leaderboardActive = false;
  let leaderboardOverlay = null; // { liveGroup, liveTable, cloneGroup, cloneTable, cloneTbody, rowTemplate, categoryRoot }
  let leaderboardToolbarEl = null;

  function findCategorySelectRoot() {
    const label = [...document.querySelectorAll('label')].find(e => e.textContent.trim() === 'Category');
    return label ? label.closest('.mantine-Select-root') : null;
  }

  // A single persistent bar inserted right after the native Category select — shows a
  // "Pricedata Value Leaderboard" button when browsing the native leaderboard, or a "Back to
  // Leaderboard" button + title once you've followed it to the #pricedata link.
  function ensureLeaderboardToolbar(categoryRoot) {
    if (leaderboardToolbarEl && leaderboardToolbarEl.isConnected) return leaderboardToolbarEl;
    const bar = document.createElement('div');
    bar.id = 'cco-leaderboard-toolbar';
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;margin:10px 0;';
    categoryRoot.insertAdjacentElement('afterend', bar);
    leaderboardToolbarEl = bar;
    return bar;
  }

  function renderLeaderboardToolbar() {
    const categoryRoot = findCategorySelectRoot();
    if (!categoryRoot) return;
    const bar = ensureLeaderboardToolbar(categoryRoot);
    bar.innerHTML = '';
    if (leaderboardActive) {
      const backBtn = document.createElement('button');
      backBtn.textContent = '← Back to Leaderboard';
      backBtn.style.cssText = 'background:transparent;color:#f60;border:1px solid #f60;border-radius:4px;' +
        'padding:6px 12px;cursor:pointer;font-size:13px;font-weight:600;';
      backBtn.addEventListener('click', () => { location.hash = ''; exitPricedataLeaderboard(); });
      const title = document.createElement('div');
      title.textContent = 'Pricedata Value Leaderboard';
      title.style.cssText = 'font-weight:600;font-size:14px;';
      bar.appendChild(backBtn);
      bar.appendChild(title);
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Pricedata Value Leaderboard →';
      btn.style.cssText = 'background:#f60;color:#000;border:none;border-radius:4px;' +
        'padding:6px 12px;cursor:pointer;font-size:13px;font-weight:600;';
      btn.addEventListener('click', () => { location.hash = PRICEDATA_LEADERBOARD_HASH.slice(1); enterPricedataLeaderboard(); });
      bar.appendChild(btn);
    }
  }

  function enterPricedataLeaderboard() {
    if (leaderboardActive) return;
    leaderboardActive = true;
    renderLeaderboardToolbar();
    renderCustomLeaderboard();
  }

  function exitPricedataLeaderboard() {
    if (!leaderboardActive) return;
    leaderboardActive = false;
    hideCustomLeaderboard();
    renderLeaderboardToolbar();
  }

  // Finds the live podium Group + table, clones both, hides the live ones (plus the Category
  // select, so it can't be changed to show stale content underneath), and inserts the clones
  // in the exact same spot — so layout/position/styling stay pixel-identical while the clones
  // themselves carry no React bindings to go stale.
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

    const categoryRoot = findCategorySelectRoot();
    if (categoryRoot) categoryRoot.style.display = 'none';

    leaderboardOverlay = { liveGroup: group, liveTable: table, cloneGroup, cloneTable, cloneTbody, rowTemplate, categoryRoot };
    return leaderboardOverlay;
  }

  function hideCustomLeaderboard() {
    if (!leaderboardOverlay) return;
    const { liveGroup, liveTable, cloneGroup, cloneTable, categoryRoot } = leaderboardOverlay;
    if (liveGroup) liveGroup.style.display = '';
    if (liveTable) liveTable.style.display = '';
    if (categoryRoot) categoryRoot.style.display = '';
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

  // cloneNode(true) copies markup only — none of React's click handlers survive, which is why
  // clicking a user on this cloned leaderboard has never done anything (confirmed live: this
  // is equally true of the site's own native categories right now, not something we broke).
  // Profile URLs are plain /profile/<userId> (confirmed live), so wire up real navigation by
  // hand on both the podium and the table rows.
  function makeClickable(el, userId) {
    if (!el || !userId) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => { window.location.href = '/profile/' + userId; });
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
      // texts[1] (the big yellow-bar number) is left untouched — it's the account's XP, not
      // a per-category value, and Premier rating didn't belong there either (removed per
      // explicit instruction — it read as wrong/confusing next to a $ total).
      if (texts[2]) texts[2].textContent = fmtFull(entry.totalValue);
      setAvatarSrc(avatarImg, entry.avatarUrl);
      makeClickable(stack, entry.userId);
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
      // tds[3] (the big yellow-bar number) is left untouched — see the podium comment above.
      if (tds[4]) tds[4].textContent = fmtFull(entry.totalValue);
      makeClickable(tr, entry.userId);
      cloneTbody.appendChild(tr);
    });
  }

  function hookLeaderboardPage() {
    if (location.pathname !== '/leaderboard') {
      if (leaderboardActive) { leaderboardActive = false; hideCustomLeaderboard(); }
      return;
    }
    renderLeaderboardToolbar();
    const wantPricedata = location.hash === PRICEDATA_LEADERBOARD_HASH;
    if (wantPricedata && !leaderboardActive) enterPricedataLeaderboard();
    else if (!wantPricedata && leaderboardActive) exitPricedataLeaderboard();
  }

  // ---------- Bulk include/exclude (Select All / Deselect All) ----------
  // Sits directly below the native Search box on storage-unit pages (Search lives alone in
  // its own single-column Grid row there, an easy anchor to insert after). Operates on every
  // item in the WHOLE unit — fetches every page via fetchAllSkins rather than just the
  // current page — since that's the same "one unit" scanAll/triggerTotalsCalculation already
  // treat as a single total; a per-page-only toggle would silently leave other pages' items
  // in whatever state they were already in.
  async function setAllIncluded(ctx, included) {
    const skins = await fetchAllSkins(ctx);
    skins.forEach(s => { if (s && s._id) { if (included) excludedIds.delete(s._id); else excludedIds.add(s._id); } });
    totalsCache.clear();
    scheduleTick();
  }

  function findSearchGridRoot() {
    const input = [...document.querySelectorAll('input')].find(i => i.placeholder === 'Search');
    return input ? input.closest('.mantine-Grid-root') : null;
  }

  function injectBulkIncludeToggle() {
    const ctx = currentContext();
    if (!ctx || ctx.type !== 'su') {
      const old = document.getElementById('cco-bulk-include-row');
      if (old) old.remove();
      return;
    }
    if (document.getElementById('cco-bulk-include-row')) return;
    const searchRoot = findSearchGridRoot();
    if (!searchRoot) return;

    const row = document.createElement('div');
    row.id = 'cco-bulk-include-row';
    row.style.cssText = 'display:flex;gap:8px;margin:8px 0;';

    function makeBtn(label) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'background:transparent;color:#f60;border:1px solid #f60;border-radius:4px;' +
        'padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;';
      return b;
    }
    const selectAllBtn = makeBtn('Select All');
    const deselectAllBtn = makeBtn('Deselect All');

    async function run(btn, included) {
      selectAllBtn.disabled = true;
      deselectAllBtn.disabled = true;
      const original = btn.textContent;
      btn.textContent = included ? 'Selecting…' : 'Deselecting…';
      try {
        await setAllIncluded(ctx, included);
      } finally {
        btn.textContent = original;
        selectAllBtn.disabled = false;
        deselectAllBtn.disabled = false;
      }
    }
    selectAllBtn.addEventListener('click', () => run(selectAllBtn, true));
    deselectAllBtn.addEventListener('click', () => run(deselectAllBtn, false));

    row.appendChild(selectAllBtn);
    row.appendChild(deselectAllBtn);
    searchRoot.insertAdjacentElement('afterend', row);
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
  // The leaderboard's #pricedata hash route needs to react to browser back/forward too, not
  // just clicks on our own buttons — hashchange doesn't touch the DOM so the MutationObserver
  // driving scheduleTick() elsewhere would never see it otherwise.
  window.addEventListener('hashchange', scheduleTick);

  // Auto-scan once per storage-unit visit. Inventory intentionally stays click-only (per
  // explicit prior instruction — inventories can be large and this is what caused the
  // rate-limit problems this whole cache system was built to fix), but storage units are
  // opened one at a time and a single SU's scan is a much smaller, already-throttled request
  // burst (see fetchAllSkins' FETCH_DELAY_MS), so it's safe to fire automatically on open
  // rather than making every SU visit start with a manual click. Keyed by su id so navigating
  // between different storage units re-triggers, but repeat ticks on the SAME one don't.
  let autoScannedSuKey = null;
  function autoScanStorageUnitIfNeeded(ctx) {
    const key = 'su:' + ctx.id;
    if (autoScannedSuKey === key) return;
    autoScannedSuKey = key;
    const cached = getCachedTotals();
    if (cached && !cached.pending) return; // already fresh (in-memory or a recent localStorage cache) — no refetch needed
    triggerTotalsCalculation();
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
    // renderInlineTotal() is now a plain (synchronous, non-fetching) render — it shows
    // whatever's already cached/persisted, or a click prompt if nothing's been calculated
    // yet. The actual scan (fetchAllSkins) only runs from that click now, not from every tick.
    renderInlineTotal();
    if (ctx && ctx.type === 'inv') injectScanButton();
    if (ctx && ctx.type === 'su') autoScanStorageUnitIfNeeded(ctx);
    injectBulkIncludeToggle(); // no-ops (and cleans up) when not on a storage-unit page
    hookLeaderboardPage();
  }

  // ---------- Bootstrap ----------
  function init() {
    // Observing document.body meant ANY DOM mutation anywhere on the page scheduled a tick —
    // including every single Global Chat message arriving, since chat lives in its own
    // <aside>/complementary panel that's a SIBLING of <main>, not inside it. The 50ms debounce
    // in scheduleTick() kept this from being catastrophic, but an active chat still meant
    // near-constant re-querying of the DOM for work that's only ever relevant inside <main>
    // (cards, totals, buttons, etc.). Scoping the observer to <main> alone means chat activity
    // no longer triggers a tick at all (flagged by zhiro — thanks!).
    const observeRoot = document.querySelector('main') || document.body;
    const observer = new MutationObserver(() => {
      scheduleTick();
    });
    observer.observe(observeRoot, { childList: true, subtree: true });
    loadData();
    setInterval(loadData, CONFIG.REFRESH_MS);
    primeCurrentPage();
    scheduleTick();
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);
})();
