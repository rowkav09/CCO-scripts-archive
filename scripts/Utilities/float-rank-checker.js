// ==UserScript==
// @name         cco float rank highlighter v3
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Find and rank item floats
// @author       ZSB
// @match        https://case-clicker.com/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
    MAX_CONCURRENT_REQUESTS: 5,
    REQUEST_DELAY: 150,
    CACHE_LIMIT: 500,
    ENABLED: true
};

const PANEL_ID = 'float-rank-panel-v124';
const STATE = { processedCount: 0, lastScanTime: 'Never' };
let BUILD_ID = null;

const DEFAULTS = {
    st:    { mode: 'solid', c1: '#ffa500', c2: '#ffffff' },
    sv:    { mode: 'solid', c1: '#ffff00', c2: '#ffffff' },
    hf:    { mode: 'solid', c1: '#FF69B4', c2: '#ffffff' },
    event: { mode: 'solid', c1: '#87CEEB', c2: '#ffffff' },
    rank1: { mode: 'glint', c1: '#FFD700', c2: '#FFF8DC' },
    rank2: { mode: 'glint', c1: '#C0C0C0', c2: '#FFFFFF' },
    rank3: { mode: 'glint', c1: '#CD7F32', c2: '#FFDAB9' },
    rank4: { mode: 'solid', c1: '#B4C7DC', c2: '#ffffff' },
    rank6: { mode: 'solid', c1: '#A97142', c2: '#ffffff' },
    plus:  { mode: 'solid', c1: '#FFD700', c2: '#ffffff' },
    val:   { mode: 'solid', c1: '#AAAAAA', c2: '#ffffff' }
};

const getSavedSettings = () => {
    const saved = GM_getValue('float_colors_v4', DEFAULTS);
    return { ...DEFAULTS, ...saved };
};

const createManagedCache = (limit) => {
    const map = new Map();
    return {
        has: (key) => map.has(key),
        get: (key) => map.get(key),
        set: (key, value) => {
            if (map.size >= limit) map.delete(map.keys().next().value);
            map.set(key, value);
        },
        clear: () => map.clear()
    };
};

const skinTypeIdCache = createManagedCache(CONFIG.CACHE_LIMIT);
const leaderboardCache = createManagedCache(CONFIG.CACHE_LIMIT);
const patternIdCache = createManagedCache(CONFIG.CACHE_LIMIT);

let latestInventoryData = [];
let processingDebounceTimer = null;
let isProcessing = false;
let isNextProcessATrade = false;
const requestQueue = [];
let isQueueProcessing = false;

const HIJACK_FLAG = '__floatHighlighterHijack';

function applyBaseStyles() {
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Roboto+Mono:wght@500&display=swap');
        :root {
            --panel-bg: #121019; --panel-border: rgba(128, 0, 255, 0.5);
            --accent-purple: #A020F0; --header-bg: #1C1A25;
            --text-primary: #F0F0F0; --text-secondary: #a0a0b0;
            --font-body: 'Poppins', sans-serif; --font-mono: 'Roboto Mono', monospace;
            --z-success: #10b981; --z-danger: #ef4444;
        }
        #${PANEL_ID} {
            position: fixed; z-index: 10000; min-width: 320px; max-width: 95vw;
            overflow: hidden; display: flex; flex-direction: column; font-family: var(--font-body);
            border: 1px solid var(--panel-border); border-radius: 8px;
            color: var(--text-primary); background: rgba(18, 16, 25, 0.98);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        #${PANEL_ID}.alt-drag-mode { cursor: move; }
        #${PANEL_ID}.minimized { display: none !important; }
        .panel-header { padding: 10px 16px; background: var(--header-bg); font-weight: 700; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--panel-border); user-select: none; }
        .panel-header-text { cursor: move; flex-grow: 1; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-primary); }
        .panel-minimize-button { cursor: pointer; font-size: 20px; color: var(--text-secondary); }
        .panel-minimize-button:hover { color: var(--accent-purple); }
        .panel-tabs { display: flex; border-bottom: 1px solid #333; background: #16141d; flex-shrink: 0; }
        .panel-tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; font-size: 12px; color: var(--text-secondary); background: transparent; border: none; border-bottom: 2px solid transparent; transition: 0.2s; }
        .panel-tab:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .panel-tab.active { color: var(--accent-purple); border-bottom-color: var(--accent-purple); font-weight: bold; }
        .panel-content { flex-grow: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 10px; max-height: 450px; }
        .panel-content.active { display: flex !important; }
        .scan-button { padding: 10px; border-radius: 6px; border: none; background-color: var(--accent-purple); color: #fff; font-weight: bold; font-size: 13px; cursor: pointer; transition: background-color 0.2s; text-align: center; }
        .scan-button:hover { background-color: #8A1CBF; }
        .scan-button.secondary { background-color: #2a2a2a; color: #ccc; border: 1px solid #444; }
        .scan-button.secondary:hover { border-color: #666; background-color: #333; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary); }
        .stat-val { font-family: var(--font-mono); color: #fff; }
        .control-row { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; border-bottom: 1px solid #222; }
        .control-header { font-size: 12px; color: #ddd; font-weight: 600; }
        .control-inputs { display: flex; gap: 8px; align-items: center; }
        select.mode-select { background: #111; color: #ccc; border: 1px solid #444; padding: 2px 4px; border-radius: 4px; font-size: 11px; outline: none; flex: 1; }
        input[type="color"] { -webkit-appearance: none; border: none; width: 30px; height: 22px; cursor: pointer; background: none; padding: 0; flex-shrink: 0; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: 1px solid #444; border-radius: 4px; }
        .color-section-title { font-size: 11px; text-transform: uppercase; color: var(--accent-purple); font-weight: bold; margin-top: 12px; margin-bottom: 2px; }
        .keybind-hint { text-align: center; font-size: 11px; color: #666; margin-top: 5px; border-top: 1px solid #333; padding-top: 8px; }
        .script-toolbar-button { display: inline-flex; align-items: center; justify-content: center; height: 30px; padding: 0 16px; font-size: 12px; margin-left: 1rem !important; border-radius: 4px; cursor: pointer; background: #333; border: 1px solid #555; color: var(--text-secondary); font-weight: bold; letter-spacing: 1px; transition: all 0.2s; }
        .script-toolbar-button:hover { background: var(--accent-purple); color: #fff; }
        .float-rank-text { font-weight: bold; }
        .float-rank-container { cursor: help; display: inline-block; }
        .float-rank-line { text-align: left; margin-bottom: 4px; margin-top: 8px; font-weight: 700; padding-left: 2px; line-height: 1.2; }
        .float-plus-glowing { animation: glow 2s infinite ease-in-out; display: inline-block; font-weight: bold; margin-left: 4px; }
        @keyframes glow {
            0%   { text-shadow: 0 0 3px #000, 0 0 4px currentColor; }
            50%  { text-shadow: 0 0 3px #000, 0 0 10px currentColor, 0 0 12px currentColor; }
            100% { text-shadow: 0 0 3px #000, 0 0 4px currentColor; }
        }
        .float-tooltip { position: fixed; background-color: rgba(15, 15, 15, 0.98); color: white; padding: 10px; border-radius: 8px; border: 1px solid #555; font-size: 12px; z-index: 999999; pointer-events: none; display: none; box-shadow: 0 8px 16px rgba(0,0,0,0.6); backdrop-filter: blur(8px); opacity: 0; transition: opacity 0.1s ease-in-out; min-width: 120px; font-family: 'Inter', sans-serif; }
        .float-tooltip-list { margin: 0; padding: 0; list-style: none; text-align: left; }
        .float-tooltip-list li { padding: 3px 0; white-space: nowrap; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); }
    `);
}

function updateDynamicCSS() {
    const settings = getSavedSettings();
    let css = '';
    for (const [key, s] of Object.entries(settings)) {
        let rule = '';
        if (s.mode === 'solid') {
            rule = `color: ${s.c1} !important; background: none; -webkit-text-fill-color: initial;`;
        } else if (s.mode === 'gradient') {
            rule = `background: linear-gradient(135deg, ${s.c1}, ${s.c2}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;`;
        } else if (s.mode === 'glint') {
            rule = `background: linear-gradient(135deg, ${s.c1} 0%, ${s.c2} 50%, ${s.c1} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;`;
        }
        css += `.float-style-${key} { ${rule} }\n`;
        if (key === 'plus') css += `.float-plus-glowing { color: ${s.c1} !important; }\n`;
    }
    let styleEl = document.getElementById('float-dynamic-css');
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'float-dynamic-css'; document.head.appendChild(styleEl); }
    styleEl.innerHTML = css;
}

async function processQueue() {
    if (requestQueue.length === 0) { isQueueProcessing = false; updateUIStats(); return; }
    isQueueProcessing = true;
    updateUIStats();
    const batch = requestQueue.splice(0, CONFIG.MAX_CONCURRENT_REQUESTS);
    const tasks = batch.map(task => fetch(task.url).then(r => task.resolve(r)).catch(e => task.reject(e)));
    await Promise.allSettled(tasks);
    if (requestQueue.length > 0) setTimeout(processQueue, CONFIG.REQUEST_DELAY);
    else { isQueueProcessing = false; updateUIStats(); }
}

function managedFetch(url) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ url, resolve, reject });
        updateUIStats();
        if (!isQueueProcessing) processQueue();
    });
}

if (!unsafeWindow[HIJACK_FLAG]) {
    const OriginalWebSocket = unsafeWindow.WebSocket;
    class InterceptedWebSocket extends OriginalWebSocket {
         constructor(...args) {
            super(...args);
            this.addEventListener('message', (event) => {
                try {
                    if (typeof event.data !== 'string' || !event.data.startsWith('42[')) return;
                    const dataArray = JSON.parse(event.data.substring(2));
                    const [eventName, payload] = dataArray;
                    if (eventName === 'tradeInfo' && payload) {
                        const skinsInTrade = [...(payload.offeredSkins || []), ...(payload.guestSkins || [])];
                        if (skinsInTrade.length > 0) {
                            latestInventoryData = skinsInTrade;
                            isNextProcessATrade = true;
                            scheduleProcessing(300);
                        }
                    }
                } catch (e) { }
            });
        }
    }
    unsafeWindow.WebSocket = InterceptedWebSocket;
    unsafeWindow[HIJACK_FLAG] = true;
}

const toComparisonString = (numStr) => parseFloat(numStr)?.toString() || "";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createSpan(text, key) { return `<span class="float-rank-text float-style-${key}">${text}</span>`; }
function getRankKey(rank) {
    if (rank === 1) return 'rank1'; if (rank === 2) return 'rank2'; if (rank === 3) return 'rank3';
    if (rank <= 5) return 'rank4'; if (rank <= 10) return 'rank6'; return null;
}

async function getSkinTypeId(classId) {
    if (skinTypeIdCache.has(classId)) return skinTypeIdCache.get(classId);
    try {
        const res = await managedFetch(`https://case-clicker.com/_next/data/${BUILD_ID}/en/skindb.json?sort=price&page=1&classId=${classId}`);
        if (!res.ok) return null;
        const data = await res.json();
        const skinId = new URLSearchParams(data.pageProps.__N_REDIRECT.split('?')[1]).get('skin');
        if (skinId) skinTypeIdCache.set(classId, skinId);
        return skinId;
    } catch (error) { return null; }
}

async function findAndCachePatternIdByName(skinTypeId, patternName) {
    const cacheKey = `${skinTypeId}-${patternName}`;
    if (patternIdCache.has(cacheKey)) return patternIdCache.get(cacheKey);
    try {
        const res = await managedFetch(`https://case-clicker.com/_next/data/${BUILD_ID}/en/skindb.json?skin=${skinTypeId}`);
        if (!res.ok) return null;
        const data = await res.json();
        const pattern = data.pageProps.skin.patterns.find(p => p.patternName === patternName);
        const patternId = pattern ? pattern.id : null;
        patternIdCache.set(cacheKey, patternId);
        return patternId;
    } catch(error) { return null; }
}

async function getLeaderboards(skinId, patternId = null, sort = 'lFloat', eventName = null) {
    const cacheKey = `${skinId}_${patternId || 'overall'}_${sort}_${eventName || 'none'}`;
    if (leaderboardCache.has(cacheKey)) return leaderboardCache.get(cacheKey);
    let url = `https://case-clicker.com/_next/data/${BUILD_ID}/en/skindb.json?sort=${sort}&page=1&skin=${skinId}`;
    if (patternId) url += `&pattern=${patternId}`;
    if (eventName) url += `&event=${encodeURIComponent(eventName).replace(/%20/g, '+')}`;
    try {
        const res = await managedFetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const mixed = JSON.parse(data.pageProps.filteredSkins).slice(0, 50);
        const result = { mixed, st: mixed.filter(s => s.name.trim().includes('StatTrak™')), sv: mixed.filter(s => s.name.includes('Souvenir')) };
        leaderboardCache.set(cacheKey, result);
        return result;
    } catch (error) { return null; }
}

async function findFloatParagraphWithRetry(card, floatValue) {
    let attempts = 0;
    while (attempts < 25) {
        const p = Array.from(card.querySelectorAll('p')).find(el => toComparisonString(el.textContent) === toComparisonString(floatValue));
        if (p) return p;
        await sleep(100);
        attempts++;
    }
    return null;
}

const getRank = (boardList, item, sortType, isTrade) => {
    if (!boardList || boardList.length === 0) return 0;
    const myFloat = parseFloat(item.float);
    if (!isTrade) {
        const index = boardList.findIndex(s => toComparisonString(s.float) === toComparisonString(item.float));
        return index !== -1 ? index + 1 : 0;
    }
    if (isTrade) {
        let insertionIndex = boardList.length;
        for (let i = 0; i < boardList.length; i++) {
            const boardFloat = parseFloat(boardList[i].float);
            if (sortType === 'hFloat' ? myFloat > boardFloat : myFloat < boardFloat) { insertionIndex = i; break; }
        }
        const rank = insertionIndex + 1;
        return rank > 50 ? 0 : rank;
    }
    return 0;
};

async function processCard(item, cardData, isTrade) {
    if(!CONFIG.ENABLED) return;
    cardData.card.dataset.floatProcessed = 'true';
    const floatParagraph = await findFloatParagraphWithRetry(cardData.card, item.float);
    if (!floatParagraph) return;
    floatParagraph.title = '';

    try {
        if (!BUILD_ID) return;
        const skinTypeId = await getSkinTypeId(item.classId);
        if (!skinTypeId) return;

        let patternIdToUse = item.patternId;
        if (!patternIdToUse && item.name.includes("'")) {
            const patternName = item.name.match(/'(.*?)'/)?.[1];
            if (patternName) patternIdToUse = await findAndCachePatternIdByName(skinTypeId, patternName);
        }
        const isPatternItem = !!patternIdToUse;
        const eventName = item.event?.name;

        const [oL, oH, pL, pH, eL, eH, epL, epH] = await Promise.all([
            getLeaderboards(skinTypeId, null, 'lFloat'), getLeaderboards(skinTypeId, null, 'hFloat'),
            isPatternItem ? getLeaderboards(skinTypeId, patternIdToUse, 'lFloat') : null,
            isPatternItem ? getLeaderboards(skinTypeId, patternIdToUse, 'hFloat') : null,
            eventName ? getLeaderboards(skinTypeId, null, 'lFloat', eventName) : null,
            eventName ? getLeaderboards(skinTypeId, null, 'hFloat', eventName) : null,
            (isPatternItem && eventName) ? getLeaderboards(skinTypeId, patternIdToUse, 'lFloat', eventName) : null,
            (isPatternItem && eventName) ? getLeaderboards(skinTypeId, patternIdToUse, 'hFloat', eventName) : null
        ]);

        const rankedCategories = [];
        const addRank = (fn, textPrefix, tooltipTitle, key) => {
            const r = fn();
            if (r > 0) rankedCategories.push({ rank: r, html: createSpan(`${textPrefix} #${r}`, key), tooltip: tooltipTitle, key: key });
        };

        if (isPatternItem && eventName) {
            addRank(() => getRank(epL?.mixed, item, 'lFloat', isTrade), 'Ev Pat', 'Event Pattern', 'event');
            if (item.statTrak) addRank(() => getRank(epL?.st, item, 'lFloat', isTrade), 'Ev Pat ST', 'Event Pattern ST', 'st');
            if (item.souvenir) addRank(() => getRank(epL?.sv, item, 'lFloat', isTrade), 'Ev Pat SV', 'Event Pattern SV', 'sv');
            addRank(() => getRank(epH?.mixed, item, 'hFloat', isTrade), 'Ev Pat HF', 'Event Pattern HF', 'hf');
            if (item.statTrak) addRank(() => getRank(epH?.st, item, 'hFloat', isTrade), 'Ev Pat ST HF', 'Event Pattern ST HF', 'st');
            if (item.souvenir) addRank(() => getRank(epH?.sv, item, 'hFloat', isTrade), 'Ev Pat SV HF', 'Event Pattern SV HF', 'hf');
        }
        if (eventName) {
            addRank(() => getRank(eL?.mixed, item, 'lFloat', isTrade), 'Ev', 'Event', 'event');
            if (item.statTrak) addRank(() => getRank(eL?.st, item, 'lFloat', isTrade), 'Ev ST', 'Event ST', 'st');
            if (item.souvenir) addRank(() => getRank(eL?.sv, item, 'lFloat', isTrade), 'Ev SV', 'Event SV', 'sv');
            addRank(() => getRank(eH?.mixed, item, 'hFloat', isTrade), 'Ev HF', 'Event HF', 'hf');
            if (item.statTrak) addRank(() => getRank(eH?.st, item, 'hFloat', isTrade), 'Ev ST HF', 'Event ST HF', 'st');
            if (item.souvenir) addRank(() => getRank(eH?.sv, item, 'hFloat', isTrade), 'Ev SV HF', 'Event SV HF', 'hf');
        }
        if (isPatternItem) {
            const r = getRank(pL?.mixed, item, 'lFloat', isTrade);
            if (r > 0) rankedCategories.push({ rank: r, html: createSpan(`Pat #${r}`, getRankKey(r)), tooltip: 'Pattern', key: getRankKey(r) });
            if (item.statTrak) addRank(() => getRank(pL?.st, item, 'lFloat', isTrade), 'Pat ST', 'Pattern ST', 'st');
            if (item.souvenir) addRank(() => getRank(pL?.sv, item, 'lFloat', isTrade), 'Pat SV', 'Pattern SV', 'sv');
            addRank(() => getRank(pH?.mixed, item, 'hFloat', isTrade), 'Pat HF', 'Pattern HF', 'hf');
            if (item.statTrak) addRank(() => getRank(pH?.st, item, 'hFloat', isTrade), 'Pat ST HF', 'Pattern ST HF', 'st');
            if (item.souvenir) addRank(() => getRank(pH?.sv, item, 'hFloat', isTrade), 'Pat SV HF', 'Pattern SV HF', 'hf');
        }
        const rOverall = getRank(oL?.mixed, item, 'lFloat', isTrade);
        if (rOverall > 0) rankedCategories.push({ rank: rOverall, html: createSpan(`Overall #${rOverall}`, getRankKey(rOverall)), tooltip: 'Overall', key: getRankKey(rOverall) });

        if (item.statTrak) addRank(() => getRank(oL?.st, item, 'lFloat', isTrade), 'ST', 'Overall ST', 'st');
        if (item.souvenir) addRank(() => getRank(oL?.sv, item, 'lFloat', isTrade), 'SV', 'Overall SV', 'sv');
        addRank(() => getRank(oH?.mixed, item, 'hFloat', isTrade), 'HF', 'Overall HF', 'hf');
        if (item.statTrak) addRank(() => getRank(oH?.st, item, 'hFloat', isTrade), 'ST HF', 'Overall ST HF', 'st');
        if (item.souvenir) addRank(() => getRank(oH?.sv, item, 'hFloat', isTrade), 'SV HF', 'Overall SV HF', 'hf');

        let prefixHtml;
        let bestRank = 0;
        if (rankedCategories.length === 0) {
            prefixHtml = `<span class="float-rank-text float-style-val">#50+</span>`;
        } else {
            rankedCategories.sort((a, b) => a.rank - b.rank);
            bestRank = rankedCategories[0].rank;
            let primaryHtml = rankedCategories[0].html;
            if (rankedCategories.length > 1) primaryHtml += `<span class="float-plus-glowing float-style-plus">+</span>`;

            let tooltipContent = '<ul class="float-tooltip-list">';
            rankedCategories.forEach(c => {
                const c1 = c.key ? getSavedSettings()[c.key].c1 : '#fff';
                tooltipContent += `<li style="color: ${c1};">${c.tooltip} #${c.rank}</li>`
            });
            tooltipContent += `<li class="float-style-val" style="border-top: 1px solid #444; margin-top: 4px; padding-top: 4px;">${item.float}</li></ul>`;
            prefixHtml = `<span class="float-rank-container" data-tooltip-html="${encodeURIComponent(tooltipContent)}">${primaryHtml}</span>`;
        }

        const metaContainer = floatParagraph.parentElement;
        if (metaContainer && metaContainer.parentElement && !cardData.card.querySelector('.float-rank-line')) {
            const rankElement = document.createElement('div');
            rankElement.className = 'float-rank-line';
            rankElement.innerHTML = prefixHtml;
            rankElement.style.fontSize = window.getComputedStyle(floatParagraph).fontSize;
            metaContainer.parentElement.insertBefore(rankElement, metaContainer);
        }
        floatParagraph.innerHTML = createSpan(floatParagraph.textContent, getRankKey(bestRank));
        STATE.processedCount++;
        updateUIStats();
    } catch (error) { console.error(`[Float Highlighter] Error`, error); }
}

function processVisibleInventory(isTrade) {
    if (!latestInventoryData.length || !CONFIG.ENABLED) return;
    const unprocessedCards = Array.from(document.querySelectorAll('div[class*="mantine-Card-root"]:not([data-float-processed])'));
    if (unprocessedCards.length === 0) return;
    isProcessing = true;
    STATE.lastScanTime = new Date().toLocaleTimeString();
    updateUIStats();
    try {
        const cardDataMap = new Map();
        for (const card of unprocessedCards) {
            const h2 = card.querySelector('h2'), h3 = card.querySelector('h3');
            const renderedName = ((h2?.textContent || '') + ' ' + (h3?.textContent || '')).trim();
            for (const p of card.querySelectorAll('p')) {
                const text = p.textContent.trim();
                if (text.match(/^\d*\.\d+(e[-+]?\d+)?$/i)) {
                    const floatKey = toComparisonString(text);
                    if (floatKey) {
                        if (!cardDataMap.has(floatKey)) cardDataMap.set(floatKey, []);
                        cardDataMap.get(floatKey).push({ card, renderedName });
                    }
                    break;
                }
            }
        }
        for (const item of latestInventoryData) {
            const floatKey = toComparisonString(item.float);
            const cardDatas = cardDataMap.get(floatKey);
            if (cardDatas?.length > 0) processCard(item, cardDatas.shift(), isTrade);
        }
    } finally { isProcessing = false; updateUIStats(); }
}

function runProcessing() { processVisibleInventory(isNextProcessATrade); }
function scheduleProcessing(delay) { clearTimeout(processingDebounceTimer); processingDebounceTimer = setTimeout(runProcessing, delay); }

function createUI() {
    if (document.getElementById(PANEL_ID)) return;
    applyBaseStyles();
    updateDynamicCSS();
    const mainPanel = document.createElement('div');
    mainPanel.id = PANEL_ID;
    mainPanel.className = 'floating-panel';
    const savedSettings = getSavedSettings();
    const createControl = (label, key) => {
        const s = savedSettings[key];
        const isSolid = s.mode === 'solid';
        return `
        <div class="control-row">
            <div class="control-header">${label}</div>
            <div class="control-inputs">
                <select class="mode-select" data-key="${key}">
                    <option value="solid" ${s.mode === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="gradient" ${s.mode === 'gradient' ? 'selected' : ''}>Gradient</option>
                    <option value="glint" ${s.mode === 'glint' ? 'selected' : ''}>Glint</option>
                </select>
                <input type="color" data-key="${key}" data-slot="c1" value="${s.c1}" title="Start Color">
                <input type="color" data-key="${key}" data-slot="c2" value="${s.c2}" title="End Color" style="display:${isSolid?'none':'block'}">
            </div>
        </div>`;
    };
    mainPanel.innerHTML = `
        <div class="panel-header">
            <span class="panel-header-text">FLOAT RANK HIGHLIGHTER</span>
            <span class="panel-minimize-button" title="Minimize">−</span>
        </div>
        <div class="panel-tabs">
            <button class="panel-tab active" data-tab="dashboard">Dashboard</button>
            <button class="panel-tab" data-tab="colors">Colors</button>
        </div>
        <div class="panel-content active" id="tab-dashboard">
            <div class="stat-row"><span>Processed</span><span class="stat-val" id="fr-count">0</span></div>
            <div class="stat-row"><span>Requests</span><span class="stat-val" style="color:var(--accent-purple);" id="fr-queue">0</span></div>
            <div class="control-group" style="margin-top:10px;"><button id="fr-toggle-enable" class="scan-button secondary" style="width:100%;">Enable: ON</button></div>
            <div class="keybind-hint">Keybind: <strong>Ctrl + B</strong> to Reset/Rescan</div>
        </div>
        <div class="panel-content" id="tab-colors" style="display:none;">
            <div class="color-section-title">Categories</div>
            ${createControl('StatTrak™', 'st')}
            ${createControl('Souvenir', 'sv')}
            ${createControl('High Float', 'hf')}
            ${createControl('Events', 'event')}
            <div class="color-section-title">Ranks</div>
            ${createControl('Rank #1', 'rank1')}
            ${createControl('Rank #2', 'rank2')}
            ${createControl('Rank #3', 'rank3')}
            ${createControl('Top 5 (4-5)', 'rank4')}
            ${createControl('Top 10 (6-10)', 'rank6')}
            <div class="color-section-title">Misc</div>
            ${createControl('Plus Symbol (+)', 'plus')}
            ${createControl('Float Value', 'val')}
            <button id="fr-reset-colors" class="scan-button secondary" style="width:100%; margin-top:10px;">Reset Defaults</button>
        </div>
        <div class="panel-resize-handle" style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; cursor: se-resize; border-bottom: 2px solid var(--panel-border); border-right: 2px solid var(--panel-border); opacity: 0.3;"></div>
    `;
    document.body.appendChild(mainPanel);
    const tabs = mainPanel.querySelectorAll('.panel-tab');
    const contents = mainPanel.querySelectorAll('.panel-content');
    tabs.forEach(t => t.onclick = () => { tabs.forEach(x => x.classList.remove('active')); contents.forEach(x => { x.classList.remove('active'); x.style.display = 'none'; }); t.classList.add('active'); const target = mainPanel.querySelector(`#tab-${t.dataset.tab}`); target.style.display = 'flex'; target.classList.add('active'); });
    const updateSettings = (key, slot, value) => { const current = getSavedSettings(); if (!current[key]) current[key] = { ...DEFAULTS[key] }; current[key][slot] = value; GM_setValue('float_colors_v4', current); updateDynamicCSS(); };
    mainPanel.querySelectorAll('input[type="color"]').forEach(input => { input.oninput = (e) => updateSettings(e.target.dataset.key, e.target.dataset.slot, e.target.value); });
    mainPanel.querySelectorAll('select.mode-select').forEach(select => { select.onchange = (e) => { const key = e.target.dataset.key; const mode = e.target.value; updateSettings(key, 'mode', mode); const c2Input = mainPanel.querySelector(`input[data-key="${key}"][data-slot="c2"]`); if (c2Input) c2Input.style.display = mode === 'solid' ? 'none' : 'block'; }; });
    document.getElementById('fr-reset-colors').onclick = () => { GM_setValue('float_colors_v4', DEFAULTS); location.reload(); };
    document.getElementById('fr-toggle-enable').onclick = function() { CONFIG.ENABLED = !CONFIG.ENABLED; this.innerText = `Enable: ${CONFIG.ENABLED ? 'ON' : 'OFF'}`; this.style.color = CONFIG.ENABLED ? 'var(--z-success)' : 'var(--z-danger)'; };
    setupPanelFunctionality(mainPanel); setupToolbarPersistence(); updateUIStats();
}
function updateUIStats() {
    const elCount = document.getElementById('fr-count');
    const elQueue = document.getElementById('fr-queue');
    if(elCount) elCount.innerText = STATE.processedCount;
    if(elQueue) elQueue.innerText = requestQueue.length;
}
function setupPanelFunctionality(panel) {
    const id = panel.id; const header = panel.querySelector('.panel-header-text'); const minimizeButton = panel.querySelector('.panel-minimize-button'); const resizeHandle = panel.querySelector('.panel-resize-handle');
    let isDragging = false, isResizing = false; let offset = { x: 0, y: 0 }, initialSize = { width: 0, height: 0 };
    const startDrag = (e) => { isDragging = true; offset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop }; document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', stopActions); };
    const stopActions = () => { if (isDragging) { isDragging = false; GM_setValue(`${id}Position`, { top: panel.style.top, left: panel.style.left }); } if (isResizing) { isResizing = false; GM_setValue(`${id}Dimensions`, { width: panel.style.width, height: panel.style.height }); } document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', stopActions); };
    const moveHandler = (e) => { if (isDragging) { panel.style.left = `${e.clientX - offset.x}px`; panel.style.top = `${e.clientY - offset.y}px`; } if (isResizing) { panel.style.width = `${initialSize.width + (e.clientX - offset.x)}px`; panel.style.height = `${initialSize.height + (e.clientY - offset.y)}px`; } };
    header.addEventListener('mousedown', startDrag); resizeHandle.addEventListener('mousedown', (e) => { e.stopPropagation(); isResizing = true; offset = { x: e.clientX, y: e.clientY }; initialSize = { width: panel.offsetWidth, height: panel.offsetHeight }; document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', stopActions); });
    const savedPos = GM_getValue(`${id}Position`, { top: '100px', left: '20px' }); panel.style.top = savedPos.top; panel.style.left = savedPos.left;
    const savedDims = GM_getValue(`${id}Dimensions`); if (savedDims) { panel.style.width = savedDims.width; panel.style.height = savedDims.height; }
    minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue(`${id}Minimized`, true); syncToolbar(); });
    if (GM_getValue(`${id}Minimized`, false)) panel.classList.add('minimized');
}
function setupToolbarPersistence() { new MutationObserver(() => syncToolbar()).observe(document.body, { childList: true, subtree: true }); }
function syncToolbar() {
    const anchorBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Show Serverstats') || btn.textContent.includes('INV SCAN'));
    if (!anchorBtn?.parentElement) return;
    const toolbar = anchorBtn.parentElement; const btnId = 'restore-float-btn-v124';
    let restoreButton = document.getElementById(btnId);
    if (!restoreButton) {
        restoreButton = document.createElement('button'); restoreButton.id = btnId; restoreButton.className = 'script-toolbar-button'; restoreButton.textContent = 'FLOATS v3';
        restoreButton.onclick = () => { const panel = document.getElementById(PANEL_ID); if (panel) panel.classList.remove('minimized'); GM_setValue(`${PANEL_ID}Minimized`, false); syncToolbar(); };
        toolbar.appendChild(restoreButton);
    }
    restoreButton.style.display = GM_getValue(`${PANEL_ID}Minimized`, false) ? 'inline-flex' : 'none';
}

function initialize() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.code === 'KeyB') {
            e.preventDefault();
            const header = document.querySelector('.panel-header-text');
            if(header) {
                const t = header.innerText; header.innerText = "RESETTING..."; header.style.color = "#ff5555";
                setTimeout(() => { header.innerText = t; header.style.color = ""; }, 800);
            }
            skinTypeIdCache.clear(); leaderboardCache.clear(); patternIdCache.clear();
            document.querySelectorAll('[data-float-processed]').forEach(el => {
                delete el.dataset.floatProcessed;
                const rankLine = el.querySelector('.float-rank-line');
                if(rankLine) rankLine.remove();
            });
            STATE.processedCount = 0; updateUIStats();
            scheduleProcessing(0);
        }
    });

    const interval = setInterval(() => {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl?.textContent) {
            try {
                const json = JSON.parse(nextDataEl.textContent);
                BUILD_ID = json.buildId;
                if (BUILD_ID) {
                    clearInterval(interval);
                    if (json.props?.pageProps?.skins) latestInventoryData = json.props.pageProps.skins;
                    createUI();
                    const tooltip = document.createElement('div'); tooltip.className = 'float-tooltip'; document.body.appendChild(tooltip);
                    document.body.addEventListener('mouseover', (e) => {
                        const container = e.target.closest('.float-rank-container');
                        if (container && container.dataset.tooltipHtml) {
                            tooltip.innerHTML = decodeURIComponent(container.dataset.tooltipHtml);
                            tooltip.style.display = 'block';
                            const rect = container.getBoundingClientRect();
                            let top = rect.bottom + 8, left = rect.left;
                            if (top + tooltip.offsetHeight > window.innerHeight) top = rect.top - tooltip.offsetHeight - 8;
                            if (left + tooltip.offsetWidth > window.innerWidth) left = window.innerWidth - tooltip.offsetWidth - 10;
                            tooltip.style.top = `${top}px`; tooltip.style.left = `${left}px`;
                            requestAnimationFrame(() => tooltip.style.opacity = '1');
                        }
                    });
                    document.body.addEventListener('mouseout', (e) => { const container = e.target.closest('.float-rank-container'); if (container) { tooltip.style.opacity = '0'; setTimeout(() => { if (tooltip.style.opacity === '0') tooltip.style.display = 'none'; }, 150); } });
                    scheduleProcessing(1000);
                    setInterval(() => { if (latestInventoryData.length > 0) scheduleProcessing(0); }, 2000);
                }
            } catch (e) {}
        }
    }, 500);

    const originalFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = async function(...args) {
        const response = await originalFetch(...args);
        const url = args[0];
        if (typeof url === 'string' && (url.includes('/api/inventory') || url.includes('/api/openedSkin/'))) {
            response.clone().json().then(data => {
                const skins = data?.skins || (data?.float && data.classId ? [data] : null);
                if (skins) { latestInventoryData = skins; isNextProcessATrade = false; scheduleProcessing(300); }
            }).catch(() => {});
        }
        return response;
    };
    new MutationObserver(() => scheduleProcessing(300)).observe(document.body, { childList: true, subtree: true });
}

initialize();
})();