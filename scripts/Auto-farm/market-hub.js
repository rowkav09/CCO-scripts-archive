// ==UserScript==
// @name         ZSB Market Hub v3
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Trading hub, prices, overpay tracking, price votes, Higher or Lower game, Collectors list, Item Offers, and more
// @author       ZSB
// @match        https://case-clicker.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // 1. CONFIGURATION
    // =========================================================================
    const API_BASE = "https://prices.zsb-2bc.workers.dev/api";
    const REFRESH_RATE = 60000;

    // =========================================================================
    // 2. STATE & DATA
    // =========================================================================
    const STATE = {
        prices: {},
        voteData: {},
        patternImages: {},
        patternMeta: {},
        instanceMap: {},
        latestSkins: [],
        knownItems: [],
        tradeData: {
            active: false,
            host: { id: null, commVal: 0, gameVal: 0 },
            guest: { id: null, commVal: 0, gameVal: 0 }
        },
        overlayEnabled: GM_getValue('overlayEnabled', true),
        user: GM_getValue('cachedUser', { id: null, name: 'Guest', authenticated: false }),
        currentTab: 'market',
        marketFilter: '',
        isMinimized: GM_getValue('zsb_minimized', false),
        currentRandomItem: null,
        highTierFilter: GM_getValue('zsb_high_tier', false),
        // Higher or Lower state
        hol: {
            itemA: null,
            itemB: null,
            score: 0,
            streak: 0,
            bestScore: 0,
            bestStreak: 0,
            gameOver: false,
            leaderboard: [],
            personalStats: null
        },
        // Collectors state
        collectors: {
            searchResults: [],
            allProfiles: [],
            myProfile: null,
            viewingProfile: null,
            editMode: false
        },
        // Updates state
        updates: {
            list: [],
            unreadCount: 0
        },
        // Offers state
        offers: {
            received: [],
            sent: [],
            unreadReceived: 0,
            unreadSent: 0
        }
    };

    // =========================================================================
    // 3. UTILS
    // =========================================================================
    const formatMoney = (n) => {
        if (!n) return "0";
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
        return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const formatPrice = (n) => {
        if (!n) return "QS";
        if (n < 1000) return "QS";
        return '$' + formatMoney(n);
    };

    const parseMoney = (str) => {
        if (!str) return 0;
        let s = str.toString().toUpperCase().replace(/[^0-9.,KM]/g, '').trim();
        let mult = 1;
        if (s.includes('K')) { mult = 1000; s = s.replace('K',''); }
        else if (s.includes('M')) { mult = 1000000; s = s.replace('M',''); }
        return (parseFloat(s.replace(/,/g, '')) || 0) * mult;
    };

    function getItemNames(apiName) {
        let clean = apiName.replace(/^★\s?/, '');
        if(clean.includes("'")) clean = clean.replace(/'([^']+)'/g, '($1)');
        return { fullSpecific: clean.trim(), baseGeneric: clean.replace(/\s\([^)]+\)$/, '').trim() };
    }

    const toComparisonString = (numStr) => parseFloat(numStr)?.toString() || "";

    function isClose(a, b) {
        if (a === b) return true;
        if (a === 0 || b === 0) return false;
        return (Math.abs(a - b) / Math.max(a, b)) < 0.01;
    }

    function isMatch(text, query){
        if(!query)return true;
        const t=query.toLowerCase().split(' ').filter(x=>x);
        const l=text.toLowerCase();
        return t.every(k=>l.includes(k));
    }

    // =========================================================================
    // 4. IMAGE & META FETCHER
    // =========================================================================
    async function fetchPatternImages() {
        try {
            if (!unsafeWindow.__NEXT_DATA__) {
                setTimeout(fetchPatternImages, 1000);
                return;
            }

            const buildId = unsafeWindow.__NEXT_DATA__.buildId;
            if (!buildId) return console.error("ZSB: Build ID missing.");

            const url = `https://case-clicker.com/_next/data/${buildId}/en/help/patterns.json`;

            const response = await fetch(url);
            const json = await response.json();
            const rawGroups = json.pageProps?.skingroups;

            if (!rawGroups) return;

            const groups = JSON.parse(rawGroups);
            let count = 0;

            groups.forEach(group => {
                if (group.patterns && Array.isArray(group.patterns)) {
                    group.patterns.forEach(pattern => {
                        const fullName = `${group.name} (${pattern.name})`;
                        STATE.patternImages[fullName] = `https://case-clicker.com/pictures/skins/${pattern.iconUrl}`;
                        if (pattern.probability) {
                            STATE.patternMeta[fullName] = {
                                prob: pattern.probability
                            };
                        }
                        count++;
                    });
                }
            });

            console.log(`ZSB: Loaded ${count} pattern images & meta.`);
            if (document.getElementById('market-list')) updateMarketList();

        } catch (e) {
            console.error("ZSB: Error fetching patterns", e);
        }
    }

    // =========================================================================
    // 5. CORE PROCESSORS
    // =========================================================================
    function processSkinData(skinsArray, isTrade = false, tradePayload = null) {
        if (!skinsArray || !Array.isArray(skinsArray)) return;

        const newSkins = skinsArray.filter(s => !STATE.latestSkins.some(existing => existing._id === s._id));
        STATE.latestSkins = [...STATE.latestSkins, ...newSkins];

        skinsArray.forEach(skin => {
            const { fullSpecific, baseGeneric } = getItemNames(skin.name);
            if (STATE.prices[fullSpecific]) STATE.instanceMap[skin._id] = STATE.prices[fullSpecific];
            else if (STATE.prices[baseGeneric]) STATE.instanceMap[skin._id] = STATE.prices[baseGeneric];
        });

        if (isTrade && tradePayload) {
            STATE.tradeData.active = true;
            const hostId = tradePayload.host?.user?.userId;
            const guestId = tradePayload.guest?.user?.userId;

            STATE.tradeData.host.id = hostId; STATE.tradeData.guest.id = guestId;
            STATE.tradeData.host.commVal = 0; STATE.tradeData.host.gameVal = 0;
            STATE.tradeData.guest.commVal = 0; STATE.tradeData.guest.gameVal = 0;

            skinsArray.forEach(skin => {
                let price = STATE.instanceMap[skin._id];
                if (!price) {
                    const { fullSpecific, baseGeneric } = getItemNames(skin.name);
                    price = STATE.prices[fullSpecific] || STATE.prices[baseGeneric];
                }
                const gamePrice = skin.price || skin.weaponPrice || skin.value || 0;
                const finalCommPrice = price || gamePrice;

                if (skin.userId === hostId) {
                    STATE.tradeData.host.commVal += finalCommPrice;
                    STATE.tradeData.host.gameVal += gamePrice;
                } else if (skin.userId === guestId) {
                    STATE.tradeData.guest.commVal += finalCommPrice;
                    STATE.tradeData.guest.gameVal += gamePrice;
                }
            });
            setTimeout(injectTradeHeaders, 200);
        }
        setTimeout(scanAndInject, 100);
    }

    function injectTradeHeaders() {
        if (!STATE.tradeData.active) return;
        const valueTexts = Array.from(document.querySelectorAll('p')).filter(el => el.textContent.includes("Skins Value"));

        valueTexts.forEach(el => {
            let sideKey = el.dataset.ccoOwner;
            if (!sideKey) {
                let textContent = "";
                el.childNodes.forEach(n => { if (n.nodeType === 3) textContent += n.textContent; });
                const visibleVal = parseMoney(textContent.split(':')[1] || "0");
                if (isClose(visibleVal, STATE.tradeData.host.gameVal)) sideKey = 'host';
                else if (isClose(visibleVal, STATE.tradeData.guest.gameVal)) sideKey = 'guest';
                if (sideKey) el.dataset.ccoOwner = sideKey;
            }
            if (sideKey) updateHeaderUI(el, STATE.tradeData[sideKey].commVal, STATE.tradeData[sideKey].gameVal);
        });
    }

    function updateHeaderUI(el, commVal, gameVal) {
        const diff = commVal - gameVal;
        const existingBadge = el.querySelector('.cco-trade-badge');
        if (existingBadge) { existingBadge._updateData(commVal, gameVal, diff); return; }

        el.innerHTML = ''; el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.gap = '6px';
        const labelSpan = document.createElement('span'); labelSpan.textContent = "Skins Value: "; el.appendChild(labelSpan);

        const badge = document.createElement('span');
        badge.className = 'cco-trade-badge';
        Object.assign(badge.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: '4px', cursor: 'help', fontWeight: '700', border: '1px solid', minWidth: '80px', transition: 'all 0.2s ease' });

        badge._updateData = (cVal, gVal, difference) => {
            const cFmt = `💎 ${formatPrice(cVal)}`; const gFmt = `$${gVal.toLocaleString()}`;
            let color = '#ccc'; let bg = 'rgba(255,255,255,0.05)';
            if (difference > 0) { color = '#10b981'; bg = 'rgba(16, 185, 129, 0.15)'; }
            else if (difference < 0) { color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.15)'; }

            const showComm = () => { badge.textContent = cFmt; badge.style.color = color; badge.style.borderColor = color; badge.style.backgroundColor = bg; };
            const showGame = () => { badge.textContent = gFmt; badge.style.color = '#fff'; badge.style.borderColor = '#555'; badge.style.backgroundColor = '#222'; };
            badge.onmouseenter = showGame; badge.onmouseleave = showComm;
            if (!badge.matches(':hover')) showComm();
        };
        badge._updateData(commVal, gameVal, diff); el.appendChild(badge);
    }

    function scanAndInject() {
        if (!STATE.overlayEnabled || STATE.latestSkins.length === 0) return;
        const cards = Array.from(document.querySelectorAll('div[class*="mantine-Card-root"]:not([data-cco-swapped])'));
        const cardMap = new Map();

        cards.forEach(card => {
            const ps = card.querySelectorAll('p');
            for (const p of ps) {
                const text = p.textContent.trim();
                if (text.match(/^\d*\.\d+(e[-+]?\d+)?$/i)) {
                    const floatKey = toComparisonString(text);
                    if (floatKey) { if (!cardMap.has(floatKey)) cardMap.set(floatKey, []); cardMap.get(floatKey).push(card); }
                    break;
                }
            }
        });

        STATE.latestSkins.forEach(skin => {
            const floatKey = toComparisonString(skin.float);
            const domMatches = cardMap.get(floatKey);
            if (domMatches && domMatches.length > 0) {
                let price = STATE.instanceMap[skin._id];
                let itemName = skin.name;
                if (!price) {
                    const { fullSpecific, baseGeneric } = getItemNames(skin.name);
                    price = STATE.prices[fullSpecific] || STATE.prices[baseGeneric];
                    itemName = STATE.prices[fullSpecific] ? fullSpecific : baseGeneric;
                }
                if (price) { swapPriceTag(domMatches.shift(), price, itemName); }
            }
        });
    }

    function swapPriceTag(card, communityPrice, dbItemName) {
        card.dataset.ccoSwapped = 'true';
        const badgeRoot = card.querySelector('.mantine-Badge-root');
        if (!badgeRoot) return;

        const badgeLabel = badgeRoot.querySelector('.mantine-Badge-label') || badgeRoot;
        const originalText = badgeLabel.textContent;

        const originalColor = badgeRoot.style.getPropertyValue('--badge-color') || 'var(--mantine-color-orange-light-color)';
        const originalBg = badgeRoot.style.getPropertyValue('--badge-bg') || 'var(--mantine-color-orange-light)';

        const communityText = `💎 ${formatPrice(communityPrice)}`;
        const communityColor = '#10b981'; const communityBg = 'rgba(16, 185, 129, 0.15)';

        badgeLabel.textContent = communityText;
        badgeRoot.style.setProperty('--badge-color', communityColor);
        badgeRoot.style.setProperty('--badge-bg', communityBg);
        badgeRoot.style.setProperty('border-color', communityColor);
        badgeRoot.style.opacity = '1';

        badgeRoot.addEventListener('mouseenter', () => {
            badgeLabel.textContent = originalText;
            badgeRoot.style.setProperty('--badge-color', originalColor);
            badgeRoot.style.setProperty('--badge-bg', originalBg);
            badgeRoot.style.setProperty('border-color', 'transparent');
        });
        badgeRoot.addEventListener('mouseleave', () => {
            badgeLabel.textContent = communityText;
            badgeRoot.style.setProperty('--badge-color', communityColor);
            badgeRoot.style.setProperty('--badge-bg', communityBg);
            badgeRoot.style.setProperty('border-color', communityColor);
        });

        card.addEventListener('contextmenu', (e) => {
            if(e.ctrlKey) { e.preventDefault(); const p = prompt(`Vote price for: ${dbItemName}`, communityPrice); if(p) submitVote(dbItemName, p); }
        });
    }

    // =========================================================================
    // 6. INTERCEPTORS
    // =========================================================================
    const OriginalWebSocket = unsafeWindow.WebSocket;
    unsafeWindow.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
            super(...args);
            this.addEventListener('message', (event) => {
                try {
                    if (typeof event.data === 'string' && event.data.startsWith('42["tradeInfo"')) {
                        const json = JSON.parse(event.data.substring(2));
                        const payload = json[1];
                        if (payload) {
                            STATE.latestSkins = [];
                            const allSkins = [ ...(payload.offeredSkins || []), ...(payload.guestSkins || []) ];
                            if (allSkins.length > 0) processSkinData(allSkins, true, payload);
                        }
                    }
                } catch (e) {}
            });
        }
    };

    try {
        const origFetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function(...args) {
            const response = await origFetch(...args);
            try {
                const url = args[0] ? args[0].toString() : '';
                if (url.includes('/api/auth/get-session')) { response.clone().json().then(d => { if (d?.user?.id) registerUser(d.user.id, d.user.name); }).catch(()=>{}); }
                if (url.includes('/api/inventory') || url.includes('/storageUnits') || url.includes('/api/openedSkin')) {
                    response.clone().json().then(d => { if(url.includes('/inventory')) STATE.latestSkins = []; const skins = d.skins || (d.float ? [d] : null); if (skins) processSkinData(skins); }).catch(()=>{});
                }
                if(url.includes('/api/trade')) { response.clone().json().then(d => { const t = d.trade || (d.offeredSkins ? d : null); if(t) processSkinData([...(t.offeredSkins||[]), ...(t.guestSkins||[])], true, t); }).catch(()=>{}); }
            } catch(e) {}
            return response;
        };
    } catch(e) {}

    function initTradeFromDOM() {
        try {
            const nextData = document.getElementById('__NEXT_DATA__');
            if (nextData) {
                const json = JSON.parse(nextData.textContent);
                const trade = json.props?.pageProps?.trade;
                if (trade) processSkinData([...(trade.offeredSkins || []), ...(trade.guestSkins || [])], true, trade);
            }
        } catch(e) {}
    }

    function registerUser(id, name) { STATE.user = { id, name: name || 'Player', authenticated: true }; GM_setValue('cachedUser', STATE.user); updateWelcomeHeader(); }

    // =========================================================================
    // 7. API & UI RENDER
    // =========================================================================
    function syncDatabase() { GM_xmlhttpRequest({ method: "GET", url: `${API_BASE}/items`, onload: (res) => { try { const d = JSON.parse(res.responseText); if(Array.isArray(d)) STATE.knownItems = d; } catch(e){} } }); }

    async function fetchPrices() {
        try {
            const response = await fetch(`${API_BASE}/prices?v=3`);
            const data = await response.json();

            STATE.prices = {};
            STATE.voteData = {};

            Object.entries(data).forEach(([name, val]) => {
                if (typeof val === 'object' && val !== null && val.price !== undefined) {
                    STATE.prices[name] = val.price;
                    STATE.voteData[name] = { count: val.count || 0, history: val.history || [] };
                } else {
                    STATE.prices[name] = val;
                }
            });

            STATE.lastUpdate = new Date();
            if(document.getElementById('zsb-root')?.classList.contains('visible') && STATE.currentTab === 'market') updateMarketList();
            scanAndInject();
        } catch(e) { console.error("Price Fetch Error", e); }
    }

    const apiCall = (endpoint, method = 'GET', body = null) => new Promise((resolve, reject) => {
        const opts = {
            method,
            url: `${API_BASE}${endpoint}`,
            onload: res => { try { if(res.status < 300) resolve(JSON.parse(res.responseText)); else reject(res.status); } catch(e){ reject("Invalid JSON"); } },
            onerror: () => reject("Network Error")
        };
        if (body && method !== 'GET' && method !== 'DELETE') {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.data = JSON.stringify(body);
        }
        GM_xmlhttpRequest(opts);
    });

    async function submitVote(itemId, price) {
        if(!STATE.user.authenticated) return alert("Refresh page to login.");

        const finalPrice = typeof price === 'string' ? parseMoney(price) : price;
        if(!finalPrice || finalPrice <= 0) return alert("Invalid price.");

        try {
            await apiCall('/vote', 'POST', { cco_id: STATE.user.id, username: STATE.user.name, level: 1, game_item_id: itemId, price: finalPrice });
            alert(`Vote Submitted!`);
            fetchPrices();
        } catch(e) {
            alert("Vote Failed: " + e);
        }
    }

    function updateWelcomeHeader() { const t = document.querySelector('.zsb-title'); if (t) t.innerHTML = `MARKET HUB 💎 Welcome, ${STATE.user.name} <span style="font-size:11px;color:#666;">3.0</span>`; }

    const STYLE_CSS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;900&display=swap'); :root { --z-bg: #09090b; --z-panel: #18181b; --z-border: #27272a; --z-text: #e4e4e7; --z-dim: #a1a1aa; --z-accent: #10b981; --z-purple: #8b5cf6; --z-warning: #f59e0b; }
    #zsb-root { position: fixed; display: none; flex-direction: column; background: rgba(9, 9, 11, 0.98); backdrop-filter: blur(12px); border: 1px solid var(--z-border); border-radius: 12px; box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.8); font-family: 'Inter', sans-serif; color: var(--z-text); z-index: 2147483647; min-width: 850px; min-height: 550px; top: 100px; left: 100px; }
    #zsb-root.visible { display: flex !important; }
    #zsb-root.minimized { display: none !important; }

    #zsb-header { padding: 12px 16px; background: var(--z-panel); border-bottom: 1px solid var(--z-border); display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; border-radius: 12px 12px 0 0; }
    .zsb-title { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; color: var(--z-accent); }
    .zsb-icon-btn { background: transparent; border: none; color: var(--z-dim); cursor: pointer; padding: 4px; font-size: 14px; margin-left: 8px; }
    .zsb-icon-btn:hover { color: #fff; }

    #zsb-body { flex: 1; display: flex; overflow: hidden; position: relative; }
    #zsb-sidebar { width: 160px; background: rgba(0,0,0,0.2); border-right: 1px solid var(--z-border); padding: 10px; display: flex; flex-direction: column; gap: 4px; }
    .zsb-nav-item { padding: 10px 12px; border-radius: 6px; cursor: pointer; color: var(--z-dim); font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: 0.15s; position: relative; }
    .zsb-nav-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
    .zsb-nav-item.active { background: var(--z-panel); color: var(--z-accent); border: 1px solid var(--z-border); }
    .nav-badge { background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-left: 4px; min-width: 18px; text-align: center; }
    #zsb-content { flex: 1; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
    .zsb-scroll-area { flex: 1; overflow-y: auto; padding: 20px; }
    .zsb-btn { background: var(--z-accent); color: #000; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; }
    .zsb-btn.secondary { background: var(--z-panel); border: 1px solid var(--z-border); color: var(--z-text); }
    .zsb-btn.purple { background: var(--z-purple); color: #fff; }
    .zsb-btn.danger { background: #ef4444; color: #fff; }
    .zsb-input-group { position: relative; width: 100%; margin-bottom: 10px; z-index: 101; }
    .zsb-input { background: var(--z-bg); border: 1px solid var(--z-border); color: #fff; padding: 8px 10px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; outline: none; width: 100%; box-sizing: border-box; }

    /* DROPDOWN FIXES */
    .zsb-search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--z-panel); border: 1px solid var(--z-border); display: none; z-index: 150; max-height: 250px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .zsb-search-dropdown.visible { display: block; }
    .zsb-search-item { padding: 8px 10px; font-size: 11px; cursor: pointer; color: var(--z-dim); border-bottom: 1px solid rgba(255,255,255,0.05); }
    .zsb-search-item:hover { background: var(--z-accent); color: #000; }

    #market-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; position: relative; z-index: 1; }
    .market-card { position: relative; background: rgba(255,255,255,0.03); border: 1px solid var(--z-border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; transition: 0.2s; }
    .market-card:hover { background: var(--z-panel); border-color: var(--z-accent); transform: translateY(-2px); }
    .market-card.is-st { border: 1px solid #d97706; box-shadow: inset 0 0 10px rgba(217, 119, 6, 0.1); }
    .st-badge { position: absolute; top: 6px; left: 6px; background: #d97706; color: #000; font-weight: 900; font-size: 10px; padding: 1px 4px; border-radius: 3px; z-index: 2; box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
    .market-img { width: 100px; height: 80px; object-fit: contain; margin-bottom: 8px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
    .market-name { font-size: 10px; color: #fff; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 26px; line-height: 13px; font-weight: 600; }
    .market-wear { font-size: 9px; color: var(--z-dim); margin-bottom: 6px; font-weight: 500; }
    .market-price { font-size: 13px; font-weight: 700; color: var(--z-accent); margin-bottom: 8px; font-family: 'JetBrains Mono'; }

    /* FEATURED CARD */
    .zsb-featured-card { width: 240px; background: #0c0c0e; border: 1px solid #333; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 25px; }
    .zsb-featured-card.is-st { border: 2px solid #d97706; }
    .zsb-featured-st { position: absolute; top: 12px; left: 12px; background: #d97706; color: #000; font-weight: 900; font-size: 14px; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
    .zsb-featured-img { width: 160px; height: 120px; object-fit: contain; margin-bottom: 15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); }
    .zsb-featured-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px; line-height: 1.4; }
    .zsb-featured-wear { font-size: 12px; color: #71717a; margin-bottom: 4px; font-weight: 500; }
    .zsb-featured-prob { font-size: 11px; color: #60a5fa; font-weight: 700; margin-bottom: 15px; font-family: 'JetBrains Mono'; background: rgba(96, 165, 250, 0.1); padding: 2px 6px; border-radius: 4px; }
    .zsb-featured-price { font-size: 28px; font-weight: 800; color: var(--z-accent); font-family: 'JetBrains Mono'; letter-spacing: 1px; }

    /* VOTE COUNT & TOOLTIP */
    .zsb-vote-count { font-size: 10px; color: #666; margin-left: 4px; cursor: help; position: relative; font-weight: 400; }
    .zsb-vote-tooltip { visibility: hidden; width: 140px; background: #000; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 100; bottom: 120%; left: 50%; transform: translateX(-50%); border: 1px solid #333; pointer-events: none; opacity: 0; transition: 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.8); font-family: 'Inter', sans-serif; }
    .zsb-vote-count:hover .zsb-vote-tooltip { visibility: visible; opacity: 1; }
    .zsb-tooltip-title { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 4px; display: block; border-bottom: 1px solid #333; padding-bottom: 4px; }
    .zsb-history-item { display: block; font-size: 10px; color: #ccc; margin-bottom: 2px; }

    .zsb-toolbar-btn { display: inline-flex; align-items: center; justify-content: center; height: 30px; padding: 0 16px; font-size: 12px; margin-left: 1rem !important; border-radius: 4px; cursor: pointer; background: #333; border: 1px solid #555; color: #ccc; font-weight: bold; letter-spacing: 1px; transition: all 0.2s; position: relative; }
    .zsb-toolbar-btn:hover { background: var(--z-accent); color: #fff; }
    .zsb-toolbar-badge { position: absolute; top: -6px; right: -6px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
    .zsb-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize; opacity: 0.5; background: linear-gradient(135deg, transparent 50%, var(--z-dim) 50%); border-radius: 0 0 12px 0; }
    .cco-trade-badge { font-family: 'JetBrains Mono'; font-weight: bold; margin-left: 8px; font-size: 12px; cursor: help; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }

    /* HIGHER OR LOWER STYLES */
    .hol-container { display: flex; flex-direction: column; align-items: center; padding: 20px; }
    .hol-score-bar { display: flex; justify-content: center; gap: 40px; margin-bottom: 20px; padding: 15px 30px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--z-border); }
    .hol-score-item { text-align: center; }
    .hol-score-label { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
    .hol-score-value { font-size: 24px; font-weight: 800; color: var(--z-accent); font-family: 'JetBrains Mono'; }
    .hol-score-value.streak { color: #f59e0b; }
    .hol-cards { display: flex; gap: 30px; align-items: center; margin-bottom: 25px; }
    .hol-card { width: 200px; background: #0c0c0e; border: 2px solid #333; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.3s; position: relative; }
    .hol-card:hover { border-color: var(--z-accent); transform: scale(1.02); box-shadow: 0 0 20px rgba(16, 185, 129, 0.2); }
    .hol-card.is-st { border-color: #d97706; }
    .hol-card.correct { border-color: #10b981 !important; background: rgba(16, 185, 129, 0.1); }
    .hol-card.incorrect { border-color: #ef4444 !important; background: rgba(239, 68, 68, 0.1); }
    .hol-card.revealed .hol-price { opacity: 1 !important; }
    .hol-st-badge { position: absolute; top: 8px; left: 8px; background: #d97706; color: #000; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 3px; }
    .hol-card-img { width: 120px; height: 90px; object-fit: contain; margin: 0 auto 10px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); }
    .hol-card-name { font-size: 11px; color: #fff; font-weight: 600; margin-bottom: 4px; min-height: 28px; display: flex; align-items: center; justify-content: center; }
    .hol-card-wear { font-size: 10px; color: #666; margin-bottom: 8px; }
    .hol-price { font-size: 18px; font-weight: 800; color: var(--z-accent); font-family: 'JetBrains Mono'; }
    .hol-price.hidden { opacity: 0; }
    .hol-vs { font-size: 24px; font-weight: 900; color: #666; }
    .hol-question { font-size: 14px; color: #888; margin-bottom: 15px; }
    .hol-btn-row { display: flex; gap: 15px; }
    .hol-choice-btn { padding: 12px 30px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; transition: 0.2s; }
    .hol-choice-btn.higher { background: #10b981; color: #000; border: none; }
    .hol-choice-btn.lower { background: #ef4444; color: #fff; border: none; }
    .hol-choice-btn:hover { transform: scale(1.05); }
    .hol-choice-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .hol-result { font-size: 28px; font-weight: 900; margin: 20px 0; }
    .hol-result.correct { color: #10b981; }
    .hol-result.incorrect { color: #ef4444; }
    .hol-gameover { text-align: center; padding: 30px; }
    .hol-gameover-title { font-size: 32px; font-weight: 900; color: #ef4444; margin-bottom: 10px; }
    .hol-gameover-score { font-size: 48px; font-weight: 900; color: var(--z-accent); font-family: 'JetBrains Mono'; margin-bottom: 20px; }
    .hol-leaderboard { margin-top: 20px; width: 100%; max-width: 400px; }
    .hol-lb-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .hol-lb-row { display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 4px; font-size: 12px; }
    .hol-lb-row.you { background: rgba(16, 185, 129, 0.15); border: 1px solid var(--z-accent); }
    .hol-lb-rank { color: #888; width: 30px; }
    .hol-lb-name { flex: 1; color: #fff; }
    .hol-lb-score { color: var(--z-accent); font-weight: 700; font-family: 'JetBrains Mono'; }

    /* LEADERBOARDS TAB STYLES */
    .lb-container { padding: 0; }
    .lb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
    .lb-controls { display: flex; gap: 10px; align-items: center; }
    .lb-content { background: var(--z-panel); border: 1px solid var(--z-border); border-radius: 10px; overflow: hidden; }
    .lb-table { width: 100%; }
    .lb-table-header { display: flex; padding: 12px 16px; background: rgba(0,0,0,0.3); border-bottom: 1px solid var(--z-border); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--z-dim); }
    .lb-table-row { display: flex; padding: 14px 16px; border-bottom: 1px solid var(--z-border); align-items: center; transition: 0.15s; }
    .lb-table-row:last-child { border-bottom: none; }
    .lb-table-row:hover { background: rgba(255,255,255,0.03); }
    .lb-table-row.is-you { background: rgba(139, 92, 246, 0.1); border-left: 3px solid var(--z-purple); }
    .lb-col-rank { width: 60px; }
    .lb-col-name { flex: 1; font-weight: 500; color: #fff; }
    .lb-col-score { width: 120px; font-weight: 700; color: var(--z-accent); font-family: 'JetBrains Mono', monospace; }
    .lb-col-score.streak { color: var(--z-warning, #f59e0b); }
    .lb-col-games { width: 80px; color: var(--z-dim); font-size: 13px; text-align: right; }
    .lb-rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); font-weight: 700; font-size: 12px; }
    .lb-rank-badge.gold { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000; }
    .lb-rank-badge.silver { background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%); color: #000; }
    .lb-rank-badge.bronze { background: linear-gradient(135deg, #d97706 0%, #92400e 100%); color: #fff; }
    .you-tag { font-size: 10px; color: var(--z-purple); font-weight: 400; }
    .lb-personal-stats { margin-top: 20px; }
    .lb-personal-card { background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 10px; padding: 16px; }
    .lb-personal-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--z-purple); margin-bottom: 12px; font-weight: 600; }
    .lb-personal-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .lb-personal-item { text-align: center; }
    .lb-personal-value { font-size: 24px; font-weight: 800; color: #fff; font-family: 'JetBrains Mono', monospace; }
    .lb-personal-value.streak { color: var(--z-warning, #f59e0b); font-size: 20px; }
    .lb-personal-label { font-size: 10px; color: var(--z-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

    /* UPDATES TAB STYLES */
    .updates-container { padding: 0; }
    .updates-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .updates-list { display: flex; flex-direction: column; gap: 12px; }
    .update-card { background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 10px; padding: 16px; transition: 0.2s; }
    .update-card:hover { border-color: var(--z-purple); }
    .update-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .update-title { font-size: 16px; font-weight: 700; color: #fff; }
    .update-date { font-size: 11px; color: var(--z-dim); white-space: nowrap; }
    .update-description { font-size: 13px; color: #ccc; line-height: 1.5; margin-bottom: 10px; white-space: pre-wrap; }
    .update-link { font-size: 12px; color: var(--z-purple); text-decoration: none; font-weight: 600; }
    .update-link:hover { text-decoration: underline; }

    /* OFFERS TAB STYLES */
    .offers-container { padding: 0; }
    .offers-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .offers-tab { padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; background: var(--z-panel); border: 1px solid var(--z-border); color: var(--z-dim); transition: 0.2s; position: relative; }
    .offers-tab:hover { border-color: var(--z-purple); color: #fff; }
    .offers-tab.active { background: var(--z-purple); border-color: var(--z-purple); color: #fff; }
    .offers-tab .tab-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .offers-list { display: flex; flex-direction: column; gap: 12px; }
    .offer-card { background: linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 10px; padding: 16px; }
    .offer-card.accepted { border-color: rgba(16, 185, 129, 0.5); background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); }
    .offer-card.denied { border-color: rgba(239, 68, 68, 0.3); background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(0,0,0,0.1) 100%); opacity: 0.7; }
    .offer-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .offer-user { display: flex; align-items: center; gap: 10px; }
    .offer-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
    .offer-avatar-fallback { width: 36px; height: 36px; border-radius: 50%; background: var(--z-purple); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; }
    .offer-user-info { }
    .offer-username { font-size: 14px; font-weight: 600; color: #fff; }
    .offer-user-link { color: #fff; text-decoration: none; transition: 0.2s; }
    .offer-user-link:hover { color: var(--z-purple); text-decoration: underline; }
    .offer-date { font-size: 11px; color: var(--z-dim); }
    .offer-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; }
    .offer-status.pending { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
    .offer-status.accepted { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .offer-status.denied { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .offer-item-card { background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(0,0,0,0.3) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 10px; padding: 15px; margin-bottom: 12px; display: flex; gap: 15px; align-items: center; }
    .offer-item-card.stattrak { border-color: rgba(217, 119, 6, 0.5); background: linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(0,0,0,0.3) 100%); }
    .offer-item-card.souvenir { border-color: rgba(255, 204, 0, 0.5); background: linear-gradient(135deg, rgba(255, 204, 0, 0.1) 0%, rgba(0,0,0,0.3) 100%); }
    .offer-item-image-wrap { flex-shrink: 0; width: 120px; height: 90px; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .offer-item-image-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5)); }
    .offer-item-info { flex: 1; min-width: 0; }
    .offer-item-name { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 8px; line-height: 1.3; }
    .offer-item-name .st-badge { color: #f59e0b; font-size: 11px; }
    .offer-item-name .sv-badge { color: #fcd34d; font-size: 11px; }
    .offer-item-stats { display: flex; flex-wrap: wrap; gap: 8px 16px; }
    .offer-item-stat { display: flex; flex-direction: column; }
    .offer-item-stat-label { font-size: 9px; color: var(--z-dim); text-transform: uppercase; letter-spacing: 0.5px; }
    .offer-item-stat-value { font-size: 13px; font-weight: 600; color: #fff; font-family: 'JetBrains Mono', monospace; }
    .offer-item-stat-value.price { color: var(--z-accent); }
    .offer-item-stat-value.float { color: #a78bfa; font-size: 11px; word-break: break-all; }
    .offer-item-stickers { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
    .offer-item-sticker { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 9px; color: #ccc; }
    .offer-sticker-img { width: 48px; height: 36px; object-fit: contain; background: rgba(255,255,255,0.05); border-radius: 4px; padding: 2px; }
    .offer-wanted { font-size: 12px; color: var(--z-dim); margin-bottom: 10px; }
    .offer-wanted strong { color: var(--z-accent); }
    .offer-actions { display: flex; gap: 10px; margin-top: 12px; }
    .offer-trade-link { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px 12px; margin-top: 12px; }
    .offer-trade-link-label { font-size: 11px; color: var(--z-dim); margin-bottom: 4px; }
    .offer-trade-link a { font-size: 13px; color: #10b981; word-break: break-all; }

    /* Offer Modal */
    .offer-modal-content { max-width: 500px; }
    .offer-input-section { margin-bottom: 15px; }
    .offer-input-label { font-size: 12px; color: var(--z-dim); margin-bottom: 6px; }
    .offer-preview { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 15px; margin-top: 15px; }
    .offer-preview-title { font-size: 11px; color: var(--z-dim); margin-bottom: 10px; text-transform: uppercase; }

    /* Clickable wishlist items */
    .profile-item-card.clickable { cursor: pointer; }
    .profile-item-card.clickable:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(139, 92, 246, 0.3); }
    .profile-item-card .offer-hint { font-size: 9px; color: var(--z-dim); margin-top: 5px; opacity: 0; transition: 0.2s; }
    .profile-item-card.clickable:hover .offer-hint { opacity: 1; }

    /* COLLECTORS STYLES */
    .collectors-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .collectors-search-box { display: flex; gap: 10px; flex: 1; max-width: 500px; }
    .collectors-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }

    /* New Collector Card V2 */
    .collector-card-v2 { background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 12px; padding: 14px; cursor: pointer; transition: all 0.25s ease; overflow: hidden; position: relative; }
    .collector-card-v2:hover { border-color: var(--card-accent, var(--z-purple)); transform: translateY(-3px); box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2); }
    .collector-card-v2.on-hold { opacity: 0.6; filter: grayscale(0.5); }
    .collector-card-v2.on-hold:hover { opacity: 0.8; }
    .collector-hold-badge { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: #fbbf24; font-size: 9px; font-weight: 700; padding: 3px 6px; border-radius: 4px; }
    .collector-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .collector-card-info { flex: 1; }
    .collector-card-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 3px; }
    .collector-card-discord { font-size: 12px; color: #5865F2; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
    .collector-card-discord .discord-icon { font-size: 11px; }
    .collector-card-count { font-size: 11px; color: var(--z-dim); }
    .collector-card-rep { text-align: center; min-width: 40px; }
    .collector-rep-value { font-size: 16px; font-weight: 800; color: #888; font-family: 'JetBrains Mono', monospace; }
    .collector-rep-value.positive { color: var(--z-accent); }
    .collector-rep-value.negative { color: #ef4444; }
    .collector-rep-label { font-size: 9px; color: var(--z-dim); text-transform: uppercase; }
    .collector-card-arrow { color: var(--z-purple); font-size: 18px; opacity: 0; transition: all 0.2s; transform: translateX(-5px); }
    .collector-card-v2:hover .collector-card-arrow { opacity: 1; transform: translateX(0); }
    .collector-card-items { display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
    .collector-thumb { width: 48px; height: 36px; background: rgba(0,0,0,0.3); border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); }
    .collector-thumb-img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); }
    .collector-thumb-placeholder { color: #444; font-size: 14px; }
    .collector-thumb-more { width: 48px; height: 36px; background: var(--z-purple); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }

    /* Legacy card styles (keep for backwards compat) */
    .collector-card { background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 10px; padding: 15px; cursor: pointer; transition: 0.2s; }
    .collector-card:hover { border-color: var(--z-purple); background: rgba(139, 92, 246, 0.1); transform: translateY(-2px); }
    .collector-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .collector-name { font-size: 16px; font-weight: 700; color: #fff; }
    .collector-discord { font-size: 12px; color: #5865F2; display: flex; align-items: center; gap: 4px; }
    .collector-items-preview { display: flex; flex-wrap: wrap; gap: 6px; }
    .collector-item-tag { background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; font-size: 10px; color: #ccc; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .collector-item-count { font-size: 11px; color: #888; margin-top: 8px; }

    /* Profile View Modal */
    .profile-modal { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.8) !important; z-index: 2147483647 !important; display: flex !important; justify-content: center !important; align-items: center !important; backdrop-filter: blur(5px); }
    .profile-modal-content { background: var(--z-bg); border: 1px solid var(--z-border); border-radius: 12px; width: 90%; max-width: 700px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
    .profile-modal-header { padding: 20px; background: var(--z-panel); border-bottom: 1px solid var(--z-border); display: flex; justify-content: space-between; align-items: center; }
    .profile-modal-body { padding: 20px; overflow-y: auto; flex: 1; min-height: 0; }
    .profile-modal-close { background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer; }
    .profile-modal-close:hover { color: #fff; }
    .profile-info { flex: 1; }
    .profile-username { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 5px; }
    .profile-username-link { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 5px; text-decoration: none; display: inline-block; transition: 0.2s; }
    .profile-username-link:hover { color: var(--z-accent); text-decoration: underline; }
    .profile-discord-big { font-size: 16px; color: #5865F2; display: flex; align-items: center; gap: 6px; }

    /* Enhanced Profile Styles */
    .profile-custom { border: 1px solid rgba(255,255,255,0.1); }
    .profile-hold-banner { background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.5); color: #fbbf24; padding: 10px 15px; border-radius: 8px; font-size: 12px; margin-bottom: 15px; text-align: center; }
    .profile-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 15px; }
    .profile-avatar-large { flex-shrink: 0; }
    .profile-avatar-large img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid var(--profile-accent, var(--z-purple)); }
    .profile-rep-section { text-align: center; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px 20px; min-width: 100px; }
    .profile-rep-title { font-size: 10px; text-transform: uppercase; color: var(--z-dim); letter-spacing: 1px; margin-bottom: 5px; }
    .profile-rep-total { font-size: 28px; font-weight: 900; color: #888; font-family: 'JetBrains Mono', monospace; }
    .profile-rep-total.positive { color: var(--z-accent); }
    .profile-rep-total.negative { color: #ef4444; }
    .profile-rep-breakdown { font-size: 11px; color: var(--z-dim); margin-bottom: 8px; }
    .profile-rep-buttons { display: flex; gap: 8px; justify-content: center; }
    .rep-btn { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--z-border); background: transparent; font-size: 18px; font-weight: 900; cursor: pointer; transition: 0.2s; }
    .rep-btn.pos { color: var(--z-accent); }
    .rep-btn.pos:hover, .rep-btn.pos.active { background: var(--z-accent); color: #000; border-color: var(--z-accent); }
    .rep-btn.neg { color: #ef4444; }
    .rep-btn.neg:hover, .rep-btn.neg.active { background: #ef4444; color: #fff; border-color: #ef4444; }
    .profile-bio { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px 15px; margin-bottom: 20px; }
    .profile-bio-title { font-size: 10px; text-transform: uppercase; color: var(--z-dim); letter-spacing: 1px; margin-bottom: 6px; }
    .profile-bio-text { font-size: 13px; color: #ccc; line-height: 1.5; white-space: pre-wrap; }
    .profile-comments-section { margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
    .profile-comments-title { font-size: 14px; font-weight: 700; color: var(--profile-accent, var(--z-purple)); margin-bottom: 15px; }
    .profile-comment-form { display: flex; gap: 10px; margin-bottom: 15px; }
    .profile-comment-form textarea { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid var(--z-border); border-radius: 6px; padding: 10px; color: #fff; font-size: 12px; resize: none; height: 60px; font-family: inherit; }
    .profile-comment-form textarea:focus { border-color: var(--profile-accent, var(--z-purple)); outline: none; }
    .profile-comment-form button { align-self: flex-end; }
    .profile-comments-list { display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto; }
    .profile-comment { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px 12px; position: relative; display: flex; gap: 10px; align-items: flex-start; }
    .comment-avatar-wrap { flex-shrink: 0; }
    .comment-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .comment-avatar-fallback { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--z-purple), var(--z-accent)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
    .comment-content { flex: 1; min-width: 0; padding-right: 25px; }
    .comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap; }
    .comment-author { font-size: 12px; font-weight: 600; color: #fff; }
    .comment-date { font-size: 10px; color: var(--z-dim); }
    .comment-text { font-size: 12px; color: #ccc; line-height: 1.4; word-break: break-word; }
    .comment-delete { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.3); border: none; color: #888; cursor: pointer; font-size: 14px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; line-height: 1; }
    .comment-delete:hover { color: #ef4444; background: rgba(239, 68, 68, 0.2); }
    .profile-items-title { font-size: 14px; font-weight: 700; color: var(--z-purple); margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
    .profile-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; max-height: 400px; overflow-y: auto; padding: 5px; }
    .profile-item-card { position: relative; background: rgba(255,255,255,0.03); border: 1px solid var(--z-border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; transition: 0.2s; }
    .profile-item-card:hover { background: var(--z-panel); border-color: var(--z-purple); }
    .profile-item-card.is-st { border-color: #d97706; box-shadow: inset 0 0 8px rgba(217, 119, 6, 0.1); }
    .profile-item-st { position: absolute; top: 4px; left: 4px; background: #d97706; color: #000; font-weight: 900; font-size: 8px; padding: 1px 3px; border-radius: 2px; }
    .profile-item-card-name { font-size: 9px; color: #fff; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 24px; line-height: 12px; font-weight: 600; }
    .profile-item-card-wear { font-size: 8px; color: var(--z-dim); margin-top: 2px; }
    .profile-item-prices { margin-top: 8px; width: 100%; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; }
    .profile-item-price { display: flex; justify-content: space-between; align-items: center; font-size: 9px; margin-bottom: 2px; }
    .profile-item-price .price-label { color: #666; }
    .profile-item-price.collector .price-value { color: var(--z-purple); font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .profile-item-price.market .price-value { color: var(--z-accent); font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .profile-items-list { display: flex; flex-direction: column; gap: 8px; }
    .profile-item-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--z-border); }
    .profile-item-name { font-size: 12px; color: #fff; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px; }
    .profile-item-row-prices { display: flex; gap: 10px; margin-right: 10px; }
    .profile-item-row-prices .collector-price { color: var(--z-purple); font-weight: 700; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
    .profile-item-row-prices .market-price { color: var(--z-accent); font-weight: 700; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
    .profile-item-actions { display: flex; gap: 6px; }
    .profile-item-edit { background: var(--z-panel); color: #fff; border: 1px solid var(--z-border); padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; transition: 0.15s; }
    .profile-item-edit:hover { border-color: var(--z-purple); background: rgba(139, 92, 246, 0.2); }
    .profile-item-remove { background: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; }
    .profile-item-remove:hover { background: #dc2626; }

    /* Add Item Preview */
    .add-item-preview { margin-top: 10px; margin-bottom: 5px; }
    .preview-card { display: flex; align-items: center; gap: 12px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 10px 12px; }
    .preview-card.is-st { border-color: #d97706; background: rgba(217, 119, 6, 0.1); }
    .preview-img { width: 60px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .preview-img-placeholder { width: 60px; height: 45px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 4px; color: #444; font-size: 16px; }
    .preview-info { flex: 1; }
    .preview-name { font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 2px; }
    .preview-wear { font-size: 10px; color: var(--z-dim); margin-bottom: 4px; }
    .preview-market { font-size: 11px; color: #888; }
    .preview-market span { color: var(--z-accent); font-weight: 700; font-family: 'JetBrains Mono', monospace; }

    /* Item Picker Multi-Select */
    .profile-modal-content.expanded { max-width: 900px; }
    .item-picker-container { background: rgba(0,0,0,0.3); border: 1px solid var(--z-border); border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
    .item-picker-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--z-border); }
    .item-picker-selected-count { font-size: 13px; color: var(--z-purple); font-weight: 600; }
    .item-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 15px; max-height: 350px; overflow-y: auto; }
    .picker-tile { position: relative; background: rgba(255,255,255,0.03); border: 2px solid var(--z-border); border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.15s; text-align: center; }
    .picker-tile:hover { border-color: var(--z-purple); background: rgba(139, 92, 246, 0.1); }
    .picker-tile.selected { border-color: var(--z-accent); background: rgba(16, 185, 129, 0.15); }
    .picker-tile.is-st { border-color: rgba(217, 119, 6, 0.5); }
    .picker-tile.is-st.selected { border-color: var(--z-accent); }
    .picker-tile-check { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; background: var(--z-accent); color: #000; border-radius: 50%; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.15s; }
    .picker-tile.selected .picker-tile-check { opacity: 1; }
    .picker-tile-st { position: absolute; top: 6px; left: 6px; background: #d97706; color: #000; font-weight: 900; font-size: 8px; padding: 2px 4px; border-radius: 3px; }
    .picker-tile-img { width: 70px; height: 50px; object-fit: contain; margin: 0 auto 6px; display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .picker-tile-img-placeholder { width: 70px; height: 50px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 4px; color: #444; font-size: 16px; margin: 0 auto 6px; }
    .picker-tile-name { font-size: 9px; color: #fff; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 22px; line-height: 11px; margin-bottom: 2px; }
    .picker-tile-wear { font-size: 8px; color: var(--z-dim); margin-bottom: 4px; }
    .picker-tile-price { font-size: 10px; color: var(--z-accent); font-weight: 700; font-family: 'JetBrains Mono', monospace; }

    /* Bulk Edit Controls */
    .bulk-edit-controls { background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 15px; }
    .bulk-edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .bulk-edit-select-all { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; }
    .bulk-edit-select-all input { width: 16px; height: 16px; cursor: pointer; }
    .bulk-edit-count { font-size: 12px; color: var(--z-purple); font-weight: 600; }
    .bulk-edit-actions { display: flex; gap: 8px; align-items: center; }
    .bulk-edit-actions .zsb-input { font-size: 12px; }
    .zsb-btn.danger { background: #ef4444; }
    .zsb-btn.danger:hover { background: #dc2626; }
    .profile-item-checkbox { display: flex; align-items: center; margin-right: 10px; }
    .profile-item-checkbox input { width: 16px; height: 16px; cursor: pointer; }

    /* Profile Editor Styles */
    .profile-editor-wide { max-width: 800px; }
    .edit-section-title { font-size: 12px; font-weight: 700; color: var(--z-purple); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 5px; padding-bottom: 8px; border-bottom: 1px solid var(--z-border); }
    .edit-profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px; }
    .edit-profile-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
    .edit-profile-textarea { width: 100%; background: var(--z-panel); border: 1px solid var(--z-border); border-radius: 6px; padding: 10px; color: #fff; font-size: 12px; resize: vertical; min-height: 80px; font-family: inherit; }
    .edit-profile-textarea:focus { border-color: var(--z-purple); outline: none; }
    .color-input-wrap { display: flex; gap: 8px; align-items: center; }
    .color-input-wrap input[type="color"] { width: 36px; height: 36px; border: none; border-radius: 6px; cursor: pointer; padding: 0; background: none; }
    .color-input-wrap input[type="color"]:disabled { opacity: 0.3; cursor: not-allowed; }
    .color-input-wrap input[type="text"] { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .color-clear-btn { background: var(--z-panel); border: 1px solid var(--z-border); color: #888; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: 0.15s; }
    .color-clear-btn:hover { border-color: var(--z-purple); color: #fff; }
    .optional-label { font-size: 9px; color: #666; font-weight: 400; }
    .edit-profile-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .hold-toggle { display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 6px; }
    .hold-toggle input { width: 18px; height: 18px; cursor: pointer; }
    .hold-toggle label { font-size: 12px; color: #fbbf24; cursor: pointer; }

    /* Profile Picture Editor */
    .profile-pic-editor { display: flex; gap: 12px; align-items: flex-start; }
    .profile-pic-preview { width: 64px; height: 64px; border-radius: 50%; background: var(--z-panel); border: 2px solid var(--z-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .profile-pic-preview img { width: 100%; height: 100%; object-fit: cover; }
    .profile-pic-preview span { color: #666; font-size: 24px; }
    .profile-pic-controls { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .profile-pic-controls .edit-profile-input { width: 100%; }

    /* Edit Profile */
    .edit-profile-section { margin-bottom: 20px; }
    .edit-profile-label { font-size: 12px; color: #888; margin-bottom: 6px; display: block; }
    .edit-profile-input { width: 100%; padding: 10px; background: var(--z-panel); border: 1px solid var(--z-border); color: #fff; border-radius: 6px; font-size: 14px; }
    .add-item-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--z-border); }
    .no-profile-message { text-align: center; padding: 40px; }
    .no-profile-message h3 { color: #fff; margin-bottom: 10px; }
    .no-profile-message p { color: #888; margin-bottom: 20px; }
    `;

    function createSearchInput(p,cb){const w=document.createElement('div');w.className='zsb-input-group';const i=document.createElement('input');i.className='zsb-input';i.placeholder=p;const d=document.createElement('div');d.className='zsb-search-dropdown';i.addEventListener('input',()=>{const v=i.value.toLowerCase();d.innerHTML='';if(v.length<2){d.classList.remove('visible');return;}const m=STATE.knownItems.filter(x=>isMatch(x,v)).slice(0,20);if(m.length>0){d.classList.add('visible');m.forEach(x=>{const el=document.createElement('div');el.className='zsb-search-item';el.innerText=x;el.onclick=()=>{i.value=x;d.classList.remove('visible');if(cb)cb(x);};d.appendChild(el);});}else d.classList.remove('visible');});document.addEventListener('click',e=>{if(!w.contains(e.target))d.classList.remove('visible');});w.appendChild(i);w.appendChild(d);return {wrapper:w,input:i};}

    function initUI(){
        if(document.getElementById('zsb-root')) return;
        GM_addStyle(STYLE_CSS);

        let pos = GM_getValue('zsb_price_pos', {top:'100px', left:'100px'});
        let size = GM_getValue('zsb_price_size', {width:'850px', height:'550px'});

        const root = document.createElement('div');
        root.id = 'zsb-root';
        root.style.top = pos.top; root.style.left = pos.left;
        root.style.width = size.width;
        root.style.height = size.height;

        root.innerHTML = `
            <div id="zsb-header">
                <div class="zsb-title">💎 Price Tracker <span style="font-size:11px;color:#666;">v2.2</span></div>
                <div>
                    <button class="zsb-icon-btn" id="zsb-minimize" title="Minimize to Toolbar">_</button>
                    <button class="zsb-icon-btn" id="zsb-close" title="Hide (Close)">✕</button>
                </div>
            </div>
            <div id="zsb-body">
                <div id="zsb-sidebar">
                    <div class="zsb-nav-item active" data-tab="market">📊 Market</div>
                    <div class="zsb-nav-item" data-tab="vote">🗳️ Vote</div>
                    <div class="zsb-nav-item" data-tab="random">🎲 Random</div>
                    <div class="zsb-nav-item" data-tab="hol">⬆️⬇️ H or L</div>
                    <div class="zsb-nav-item" data-tab="leaderboards">🏆 Leaderboards</div>
                    <div class="zsb-nav-item" data-tab="collectors">👥 Collectors</div>
                    <div class="zsb-nav-item" data-tab="updates">📢 Updates<span class="nav-badge" id="updates-badge" style="display:none;">0</span></div>
                    <div class="zsb-nav-item" data-tab="offers">🎁 Offers<span class="nav-badge" id="offers-badge" style="display:none;">0</span></div>
                    <div class="zsb-nav-item" data-tab="settings">⚙️ Config</div>
                </div>
                <div id="zsb-content"><div class="zsb-scroll-area"></div></div>
            </div>
            <div class="zsb-resize-handle"></div>
        `;

        document.body.appendChild(root);

        root.querySelector('#zsb-close').onclick = () => root.classList.remove('visible');
        root.querySelector('#zsb-minimize').onclick = () => {
            root.classList.add('minimized');
            GM_setValue('zsb_minimized', true);
            manageToolbar();
        };

        if (GM_getValue('zsb_minimized', false)) root.classList.add('minimized');

        setupWindowControl(root);
        setupToolbarPersistence();
        manageToolbar();

        root.querySelectorAll('.zsb-nav-item').forEach(nav => nav.onclick = () => {
            root.querySelectorAll('.zsb-nav-item').forEach(n => n.classList.remove('active'));
            nav.classList.add('active');
            STATE.currentTab = nav.dataset.tab;
            renderTab(STATE.currentTab);
        });

        if(STATE.user.authenticated) updateWelcomeHeader();
        renderTab(STATE.currentTab);

        // Fetch updates and offers for badges
        fetchUpdates();
        fetchOffers();
    }

    function setupWindowControl(panel) {
        const header = panel.querySelector('#zsb-header');
        const resizeHandle = panel.querySelector('.zsb-resize-handle');
        let isDragging = false, isResizing = false;
        let offset = { x: 0, y: 0 }, initialSize = { width: 0, height: 0 };
        const startDrag = (e) => { if(e.target.closest('button')) return; isDragging = true; offset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop }; document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', stopActions); };
        const startResize = (e) => { e.stopPropagation(); e.preventDefault(); isResizing = true; offset = { x: e.clientX, y: e.clientY }; initialSize = { width: panel.offsetWidth, height: panel.offsetHeight }; document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', stopActions); };
        const moveHandler = (e) => { if (isDragging) { panel.style.left = `${e.clientX - offset.x}px`; panel.style.top = `${e.clientY - offset.y}px`; } if (isResizing) { panel.style.width = `${initialSize.width + (e.clientX - offset.x)}px`; panel.style.height = `${initialSize.height + (e.clientY - offset.y)}px`; } };
        const stopActions = () => { if (isDragging) { isDragging = false; GM_setValue('zsb_price_pos', { top: panel.style.top, left: panel.style.left }); } if (isResizing) { isResizing = false; GM_setValue('zsb_price_size', { width: panel.style.width, height: panel.style.height }); } document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', stopActions); };
        header.addEventListener('mousedown', startDrag);
        if(resizeHandle) resizeHandle.addEventListener('mousedown', startResize);
    }

    function setupToolbarPersistence() { new MutationObserver(() => manageToolbar()).observe(document.body, { childList: true, subtree: true }); }
    function manageToolbar() {
        const anchorBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Show Serverstats') || btn.textContent.includes('INV SCAN'));
        if (!anchorBtn?.parentElement) return;
        const toolbar = anchorBtn.parentElement; const btnId = 'zsb-restore-btn';
        let restoreButton = document.getElementById(btnId);
        if (!restoreButton) {
            restoreButton = document.createElement('button');
            restoreButton.id = btnId;
            restoreButton.className = 'zsb-toolbar-btn';
            restoreButton.style.position = 'relative';
            restoreButton.innerHTML = '💎 PRICES<span id="zsb-toolbar-badge" class="zsb-toolbar-badge" style="display:none;">0</span>';
            restoreButton.onclick = () => { const panel = document.getElementById('zsb-root'); if (panel) { panel.classList.remove('minimized'); panel.classList.add('visible'); GM_setValue('zsb_minimized', false); fetchPrices(); } };
            toolbar.appendChild(restoreButton);
            // Update badge after button is created
            updateToolbarBadge();
        }
        restoreButton.style.display = 'inline-flex';
    }

    function updateToolbarBadge() {
        const badge = document.getElementById('zsb-toolbar-badge');
        if (badge) {
            const updatesCount = STATE.updates.unreadCount || 0;
            const offersCount = (STATE.offers.unreadReceived || 0) + (STATE.offers.unreadSent || 0);
            const total = updatesCount + offersCount;

            if (total > 0) {
                badge.textContent = total;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    function renderTab(tab){
        const c=document.querySelector('.zsb-scroll-area');
        c.innerHTML='';

        if(tab==='market'){
            const count=Object.keys(STATE.prices).length;const mapped=Object.keys(STATE.instanceMap).length;
            c.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:15px;"><div><div style="font-size:16px;font-weight:700;color:#fff;">Market Overview</div><div style="color:var(--z-dim);font-size:11px;">${count} prices • ${mapped} matches</div></div><button id="btn-refresh" class="zsb-btn secondary">↻ Refresh</button></div><div id="market-search-container"></div><div id="market-list"></div>`;
            const s=createSearchInput("Search...",x=>{STATE.marketFilter=x;updateMarketList();}); s.input.value=STATE.marketFilter; s.input.addEventListener('input',e=>{STATE.marketFilter=e.target.value;updateMarketList();}); c.querySelector('#market-search-container').appendChild(s.wrapper);
            const btn=c.querySelector('#btn-refresh');btn.onclick=async()=>{btn.innerText="...";await fetchPrices();btn.innerText="↻ Refresh";};
            updateMarketList();
        }
        else if(tab==='vote'){
            c.innerHTML=`<div style="max-width:400px;margin:20px auto;"><div style="text-align:center;font-weight:700;margin-bottom:15px;">Submit Vote</div><div style="margin-bottom:15px;"><label style="color:#666;font-size:11px;">Item Name</label><div id="vote-search-container"></div></div><div style="margin-bottom:20px;"><label style="color:#666;font-size:11px;">Price</label><input type="text" inputmode="numeric" id="vote-price" class="zsb-input" placeholder="0"></div><button id="btn-submit-manual" class="zsb-btn" style="width:100%;">SUBMIT</button></div>`;
            const v=createSearchInput("Item Name...",null); c.querySelector('#vote-search-container').appendChild(v.wrapper);
            const pInput=c.querySelector('#vote-price'); pInput.addEventListener('input',e=>{let r=e.target.value.replace(/[^\d.kKm]/g,''); e.target.value=r;});
            c.querySelector('#btn-submit-manual').onclick=()=>submitVote(v.input.value, parseMoney(pInput.value));
        }
        else if(tab==='random'){
            renderRandomTab(c);
        }
        else if(tab==='hol'){
            renderHOLTab(c);
        }
        else if(tab==='leaderboards'){
            renderLeaderboardsTab(c);
        }
        else if(tab==='collectors'){
            renderCollectorsTab(c);
        }
        else if(tab==='updates'){
            renderUpdatesTab(c);
        }
        else if(tab==='offers'){
            renderOffersTab(c);
        }
        else if(tab==='settings'){
            c.innerHTML=`<div style="text-align:center;padding:20px;"><button id="btn-sync-db" class="zsb-btn secondary">Resync DB</button></div>`;
            c.querySelector('#btn-sync-db').onclick=()=>{syncDatabase();alert("Syncing...");};
        }
    }

    // =========================================================================
    // 8. RANDOM TAB
    // =========================================================================
    function renderRandomTab(container) {
        if (!STATE.knownItems || STATE.knownItems.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">Loading items database...</div>';
            return;
        }

        let pool = STATE.knownItems;
        if (STATE.highTierFilter) {
            const excludeRegex = /\((Tier [1-4]|Phase [1-4])\)/i;
            pool = pool.filter(name => !excludeRegex.test(name));
        }
        if (pool.length === 0) pool = STATE.knownItems;

        if (!STATE.currentRandomItem || (STATE.highTierFilter && /\((Tier [1-4]|Phase [1-4])\)/i.test(STATE.currentRandomItem))) {
            STATE.currentRandomItem = pool[Math.floor(Math.random() * pool.length)];
        }

        const item = STATE.currentRandomItem;
        let displayName = item;
        let wear = "";
        let isSt = false;

        if (displayName.includes("StatTrak™") || displayName.includes("★ StatTrak™")) {
            isSt = true;
            displayName = displayName.replace("StatTrak™", "").replace("★", "").trim();
        } else if (displayName.includes("Souvenir")) {
            displayName = displayName.replace("Souvenir", "").trim();
        }
        displayName = displayName.replace(/^★\s?/, "");

        const wearMatch = displayName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
        if (wearMatch) {
            wear = wearMatch[1];
            displayName = displayName.replace(wearMatch[0], "").trim();
        }

        let cleanId = displayName.trim();
        if (cleanId.includes("'")) cleanId = cleanId.replace(/'([^']+)'/g, '($1)');

        let imgTag = `<div style="width:100px;height:80px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:8px;color:#333;font-size:20px;">?</div>`;
        let probHtml = "";

        if (STATE.patternImages[cleanId]) {
            imgTag = `<img src="${STATE.patternImages[cleanId]}" class="zsb-featured-img" onerror="this.style.display='none'">`;
            if (STATE.patternMeta[cleanId] && STATE.patternMeta[cleanId].prob) {
                probHtml = `<div class="zsb-featured-prob">⚖️ 1 / ${STATE.patternMeta[cleanId].prob.toLocaleString()}</div>`;
            }
        }

        const currentPrice = STATE.prices[item];
        const priceDisplay = currentPrice ? formatPrice(currentPrice) : "???";

        let agreeBtnHtml = '';
        if (currentPrice && currentPrice > 0) {
            agreeBtnHtml = `<button id="rnd-agree" class="zsb-btn secondary" style="flex:1;padding:12px;font-size:14px;justify-content:center;border:1px solid var(--z-accent);color:var(--z-accent);font-weight:700;">AGREE</button>`;
        }

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;padding-top:10px;text-align:center;">
                <div style="font-size:11px;color:var(--z-dim);margin-bottom:15px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">How much would you pay for:</div>
                <label style="font-size:11px;color:#888;cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:15px;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:4px;">
                    <input type="checkbox" id="rnd-filter" ${STATE.highTierFilter ? 'checked' : ''} style="accent-color:var(--z-accent);">
                    <span>High Tier Only (No Phases/Tiers)</span>
                </label>
                <div class="zsb-featured-card ${isSt ? 'is-st' : ''}">
                    ${isSt ? '<div class="zsb-featured-st">ST</div>' : ''}
                    ${imgTag}
                    <div class="zsb-featured-name" title="${item}">${displayName}</div>
                    <div class="zsb-featured-wear">${wear}</div>
                    ${probHtml}
                    <div class="zsb-featured-price">${priceDisplay}</div>
                </div>
                <div style="width:100%;max-width:320px;margin-bottom:20px;">
                    <input id="rnd-input" class="zsb-input" placeholder="Price (e.g. 1.5k, 5m)..." style="text-align:center;font-size:16px;padding:12px;font-family:'JetBrains Mono';">
                </div>
                <div style="display:flex;gap:10px;width:100%;max-width:320px;">
                    <button id="rnd-skip" class="zsb-btn secondary" style="flex:1;padding:12px;font-size:14px;justify-content:center;">Skip ➔</button>
                    ${agreeBtnHtml}
                    <button id="rnd-vote" class="zsb-btn" style="flex:1;padding:12px;font-size:14px;justify-content:center;">VOTE</button>
                </div>
            </div>
        `;

        const input = container.querySelector('#rnd-input');
        input.focus();

        container.querySelector('#rnd-filter').onchange = (e) => {
            STATE.highTierFilter = e.target.checked;
            GM_setValue('zsb_high_tier', e.target.checked);
            STATE.currentRandomItem = null;
            renderTab('random');
        };

        const refresh = () => { STATE.currentRandomItem = null; renderTab('random'); };
        container.querySelector('#rnd-skip').onclick = refresh;

        const agreeBtn = container.querySelector('#rnd-agree');
        if(agreeBtn) {
            agreeBtn.onclick = async () => {
                await submitVote(item, currentPrice);
                refresh();
            };
        }

        container.querySelector('#rnd-vote').onclick = async () => {
            const val = parseMoney(input.value);
            if (val > 0) {
                await submitVote(item, val);
                refresh();
            } else {
                input.style.borderColor = '#ef4444';
            }
        };

        input.onkeydown = (e) => { if(e.key === 'Enter') container.querySelector('#rnd-vote').click(); };
    }

    // =========================================================================
    // 9. HIGHER OR LOWER GAME
    // =========================================================================
    function getItemsWithPrices() {
        return Object.entries(STATE.prices)
            .filter(([name, price]) => price && price > 0)
            .map(([name, price]) => ({ name, price }));
    }

    function getRandomHOLItem(exclude = null) {
        const items = getItemsWithPrices();
        if (items.length < 2) return null;
        let filtered = exclude ? items.filter(i => i.name !== exclude.name) : items;
        return filtered[Math.floor(Math.random() * filtered.length)];
    }

    function parseItemDisplay(itemName) {
        let displayName = itemName;
        let wear = "";
        let isSt = false;

        if (displayName.includes("StatTrak™") || displayName.includes("★ StatTrak™")) {
            isSt = true;
            displayName = displayName.replace("StatTrak™", "").replace("★", "").trim();
        } else if (displayName.includes("Souvenir")) {
            displayName = displayName.replace("Souvenir", "").trim();
        }
        displayName = displayName.replace(/^★\s?/, "");

        const wearMatch = displayName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
        if (wearMatch) {
            wear = wearMatch[1];
            displayName = displayName.replace(wearMatch[0], "").trim();
        }

        let cleanId = displayName.trim();
        if (cleanId.includes("'")) cleanId = cleanId.replace(/'([^']+)'/g, '($1)');

        return { displayName, wear, isSt, cleanId };
    }

    function createHOLCard(item, showPrice = true, side = 'left') {
        const { displayName, wear, isSt, cleanId } = parseItemDisplay(item.name);

        let imgHtml = `<div class="hol-card-img" style="display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);border-radius:4px;color:#333;font-size:24px;">?</div>`;
        if (STATE.patternImages[cleanId]) {
            imgHtml = `<img src="${STATE.patternImages[cleanId]}" class="hol-card-img" onerror="this.parentElement.querySelector('.hol-card-img').style.display='none'">`;
        }

        return `
            <div class="hol-card ${isSt ? 'is-st' : ''}" data-side="${side}" data-price="${item.price}">
                ${isSt ? '<div class="hol-st-badge">ST</div>' : ''}
                ${imgHtml}
                <div class="hol-card-name" title="${item.name}">${displayName}</div>
                <div class="hol-card-wear">${wear}</div>
                <div class="hol-price ${showPrice ? '' : 'hidden'}">${formatPrice(item.price)}</div>
            </div>
        `;
    }

    async function fetchHOLLeaderboard() {
        try {
            const data = await apiCall('/hol/leaderboard?limit=10');
            STATE.hol.leaderboard = data || [];
        } catch (e) {
            console.error("Failed to fetch leaderboard:", e);
        }
    }

    async function fetchHOLPersonalStats() {
        if (!STATE.user.authenticated) return;
        try {
            const data = await apiCall(`/hol/stats/${STATE.user.id}`);
            if (data && data.found) {
                STATE.hol.personalStats = data;
                STATE.hol.bestScore = data.best_score || 0;
                STATE.hol.bestStreak = data.best_streak || 0;
            }
        } catch (e) {
            console.error("Failed to fetch personal stats:", e);
        }
    }

    async function submitHOLScore(score, streak) {
        if (!STATE.user.authenticated) return;
        try {
            await apiCall('/hol/score', 'POST', {
                cco_id: STATE.user.id,
                username: STATE.user.name,
                score: score,
                streak: streak
            });
            console.log(`🎮 HOL Score submitted: ${score} (streak: ${streak})`);
        } catch (e) {
            console.error("Failed to submit HOL score:", e);
        }
    }

    function startNewHOLGame() {
        STATE.hol.score = 0;
        STATE.hol.streak = 0;
        STATE.hol.gameOver = false;
        STATE.hol.itemA = getRandomHOLItem();
        STATE.hol.itemB = getRandomHOLItem(STATE.hol.itemA);
    }

    function renderHOLTab(container) {
        const items = getItemsWithPrices();

        if (items.length < 10) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <div style="font-size:48px;margin-bottom:20px;">⬆️⬇️</div>
                    <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:10px;">Higher or Lower</div>
                    <div style="color:#666;font-size:13px;">Not enough priced items yet.<br>Need at least 10 items with community prices.</div>
                    <div style="color:#888;font-size:12px;margin-top:10px;">Current: ${items.length} items</div>
                </div>
            `;
            return;
        }

        if (!STATE.hol.itemA || !STATE.hol.itemB) {
            startNewHOLGame();
            fetchHOLLeaderboard();
            fetchHOLPersonalStats();
        }

        if (STATE.hol.gameOver) {
            renderHOLGameOver(container);
            return;
        }

        const { itemA, itemB, score, streak, bestScore, bestStreak } = STATE.hol;

        container.innerHTML = `
            <div class="hol-container">
                <div class="hol-score-bar">
                    <div class="hol-score-item">
                        <div class="hol-score-label">Score</div>
                        <div class="hol-score-value">${score}</div>
                    </div>
                    <div class="hol-score-item">
                        <div class="hol-score-label">Streak</div>
                        <div class="hol-score-value streak">🔥 ${streak}</div>
                    </div>
                    <div class="hol-score-item">
                        <div class="hol-score-label">Best</div>
                        <div class="hol-score-value" style="color:#888;">${bestScore}</div>
                    </div>
                </div>

                <div class="hol-question">Which skin is worth <strong>MORE</strong>?</div>

                <div class="hol-cards">
                    ${createHOLCard(itemA, true, 'left')}
                    <div class="hol-vs">VS</div>
                    ${createHOLCard(itemB, false, 'right')}
                </div>

                <div class="hol-btn-row">
                    <button class="hol-choice-btn higher" data-choice="higher">⬆️ HIGHER</button>
                    <button class="hol-choice-btn lower" data-choice="lower">⬇️ LOWER</button>
                </div>

                <div id="hol-result" style="min-height:50px;"></div>
            </div>
        `;

        const higherBtn = container.querySelector('[data-choice="higher"]');
        const lowerBtn = container.querySelector('[data-choice="lower"]');
        const rightCard = container.querySelector('[data-side="right"]');

        const handleChoice = async (choice) => {
            higherBtn.disabled = true;
            lowerBtn.disabled = true;

            const priceEl = rightCard.querySelector('.hol-price');
            priceEl.classList.remove('hidden');
            rightCard.classList.add('revealed');

            const priceA = itemA.price;
            const priceB = itemB.price;
            const isHigher = priceB > priceA;
            const isEqual = priceB === priceA;
            const correct = isEqual || (choice === 'higher' && isHigher) || (choice === 'lower' && !isHigher);

            const resultEl = container.querySelector('#hol-result');

            if (correct) {
                STATE.hol.score++;
                STATE.hol.streak++;
                rightCard.classList.add('correct');
                resultEl.innerHTML = `<div class="hol-result correct">✓ CORRECT!</div>`;

                if (STATE.hol.score > STATE.hol.bestScore) STATE.hol.bestScore = STATE.hol.score;
                if (STATE.hol.streak > STATE.hol.bestStreak) STATE.hol.bestStreak = STATE.hol.streak;

                setTimeout(() => {
                    STATE.hol.itemA = itemB;
                    STATE.hol.itemB = getRandomHOLItem(STATE.hol.itemA);
                    renderHOLTab(container);
                }, 1200);
            } else {
                rightCard.classList.add('incorrect');
                resultEl.innerHTML = `<div class="hol-result incorrect">✗ WRONG!</div>`;

                await submitHOLScore(STATE.hol.score, STATE.hol.streak);

                setTimeout(() => {
                    STATE.hol.gameOver = true;
                    fetchHOLLeaderboard();
                    fetchHOLPersonalStats();
                    renderHOLTab(container);
                }, 1500);
            }
        };

        higherBtn.onclick = () => handleChoice('higher');
        lowerBtn.onclick = () => handleChoice('lower');
        rightCard.onclick = () => { if (!higherBtn.disabled) handleChoice('higher'); };
    }

    function renderHOLGameOver(container) {
        const { score, streak, bestScore, bestStreak } = STATE.hol;

        container.innerHTML = `
            <div class="hol-gameover">
                <div class="hol-gameover-title">GAME OVER</div>
                <div style="color:#888;font-size:14px;margin-bottom:10px;">Final Score</div>
                <div class="hol-gameover-score">${score}</div>
                <div style="color:#888;font-size:13px;margin-bottom:20px;">
                    🔥 Streak: ${streak} &nbsp;|&nbsp; 🏆 Best: ${bestScore}
                </div>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                    <button id="hol-play-again" class="zsb-btn" style="padding:15px 40px;font-size:16px;">PLAY AGAIN</button>
                    <button id="hol-view-lb" class="zsb-btn secondary" style="padding:15px 30px;font-size:14px;">🏆 Leaderboards</button>
                </div>
            </div>
        `;

        container.querySelector('#hol-play-again').onclick = () => {
            startNewHOLGame();
            renderHOLTab(container);
        };

        container.querySelector('#hol-view-lb').onclick = () => {
            // Switch to leaderboards tab
            document.querySelectorAll('.zsb-nav-item').forEach(n => n.classList.remove('active'));
            document.querySelector('[data-tab="leaderboards"]').classList.add('active');
            STATE.currentTab = 'leaderboards';
            renderTab('leaderboards');
        };
    }

    // =========================================================================
    // 10. LEADERBOARDS TAB
    // =========================================================================
    async function renderLeaderboardsTab(container) {
        container.innerHTML = `
            <div class="lb-container">
                <div class="lb-header">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#fff;">🏆 Leaderboards</div>
                        <div style="color:var(--z-dim);font-size:11px;">See who's on top</div>
                    </div>
                    <div class="lb-controls">
                        <select id="lb-type-select" class="zsb-input" style="width:220px;">
                            <option value="hol-score">⬆️⬇️ H or L - Top Scores</option>
                            <option value="skin-votes">🗳️ Skin Votes - Most Votes</option>
                        </select>
                        <button id="lb-refresh" class="zsb-btn secondary">↻</button>
                    </div>
                </div>
                <div id="lb-content" class="lb-content">
                    <div style="text-align:center;padding:40px;color:#666;">Loading...</div>
                </div>
                <div id="lb-personal-stats" class="lb-personal-stats"></div>
            </div>
        `;

        const select = container.querySelector('#lb-type-select');
        const refreshBtn = container.querySelector('#lb-refresh');

        const loadLeaderboard = async () => {
            const type = select.value;
            const contentDiv = container.querySelector('#lb-content');
            const statsDiv = container.querySelector('#lb-personal-stats');

            contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">Loading...</div>';

            if (type === 'hol-score') {
                const data = await apiCall(`/hol/leaderboard?limit=20&sort=score`);

                if (data && data.length > 0) {
                    contentDiv.innerHTML = `
                        <div class="lb-table">
                            <div class="lb-table-header">
                                <div class="lb-col-rank">Rank</div>
                                <div class="lb-col-name">Player</div>
                                <div class="lb-col-score">Best Score</div>
                                <div class="lb-col-games">Games</div>
                            </div>
                            ${data.map((entry, i) => {
                                const isYou = STATE.user.authenticated && entry.cco_id === STATE.user.id;
                                let rankClass = '';
                                if (i === 0) rankClass = 'gold';
                                else if (i === 1) rankClass = 'silver';
                                else if (i === 2) rankClass = 'bronze';

                                return `
                                    <div class="lb-table-row ${isYou ? 'is-you' : ''}">
                                        <div class="lb-col-rank"><span class="lb-rank-badge ${rankClass}">${i + 1}</span></div>
                                        <div class="lb-col-name">${entry.username || 'Anonymous'}${isYou ? ' <span class="you-tag">(You)</span>' : ''}</div>
                                        <div class="lb-col-score">${entry.best_score}</div>
                                        <div class="lb-col-games">${entry.total_games || 0}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                } else {
                    contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">No data yet. Be the first to play!</div>';
                }

                // Load personal stats for HOL
                if (STATE.user.authenticated) {
                    await fetchHOLPersonalStats();
                    const ps = STATE.hol.personalStats;
                    if (ps) {
                        statsDiv.innerHTML = `
                            <div class="lb-personal-card">
                                <div class="lb-personal-title">Your Stats</div>
                                <div class="lb-personal-grid">
                                    <div class="lb-personal-item">
                                        <div class="lb-personal-value">#${ps.rank || '?'}</div>
                                        <div class="lb-personal-label">Rank</div>
                                    </div>
                                    <div class="lb-personal-item">
                                        <div class="lb-personal-value">${ps.best_score || 0}</div>
                                        <div class="lb-personal-label">Best Score</div>
                                    </div>
                                    <div class="lb-personal-item">
                                        <div class="lb-personal-value">${ps.total_games || 0}</div>
                                        <div class="lb-personal-label">Games Played</div>
                                    </div>
                                    <div class="lb-personal-item">
                                        <div class="lb-personal-value">${ps.total_correct || 0}</div>
                                        <div class="lb-personal-label">Total Correct</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        statsDiv.innerHTML = '';
                    }
                } else {
                    statsDiv.innerHTML = '<div style="text-align:center;padding:15px;color:#666;font-size:12px;">Log in to see your stats</div>';
                }
            } else if (type === 'skin-votes') {
                const data = await apiCall(`/leaderboard/votes?limit=20`);

                if (data && data.length > 0) {
                    contentDiv.innerHTML = `
                        <div class="lb-table">
                            <div class="lb-table-header">
                                <div class="lb-col-rank">Rank</div>
                                <div class="lb-col-name">Player</div>
                                <div class="lb-col-score">Total Votes</div>
                                <div class="lb-col-games">Last Vote</div>
                            </div>
                            ${data.map((entry, i) => {
                                const isYou = STATE.user.authenticated && entry.cco_id === STATE.user.id;
                                let rankClass = '';
                                if (i === 0) rankClass = 'gold';
                                else if (i === 1) rankClass = 'silver';
                                else if (i === 2) rankClass = 'bronze';

                                const lastVote = entry.last_vote ? new Date(entry.last_vote).toLocaleDateString() : '-';

                                return `
                                    <div class="lb-table-row ${isYou ? 'is-you' : ''}">
                                        <div class="lb-col-rank"><span class="lb-rank-badge ${rankClass}">${i + 1}</span></div>
                                        <div class="lb-col-name">${entry.username || 'Anonymous'}${isYou ? ' <span class="you-tag">(You)</span>' : ''}</div>
                                        <div class="lb-col-score">${entry.total_votes}</div>
                                        <div class="lb-col-games">${lastVote}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                } else {
                    contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">No votes yet. Be the first to vote!</div>';
                }

                // Load personal vote stats
                if (STATE.user.authenticated) {
                    try {
                        const voteStats = await apiCall(`/leaderboard/votes/stats/${STATE.user.id}`);
                        if (voteStats && voteStats.found) {
                            statsDiv.innerHTML = `
                                <div class="lb-personal-card">
                                    <div class="lb-personal-title">Your Voting Stats</div>
                                    <div class="lb-personal-grid" style="grid-template-columns: repeat(2, 1fr);">
                                        <div class="lb-personal-item">
                                            <div class="lb-personal-value">#${voteStats.rank || '?'}</div>
                                            <div class="lb-personal-label">Rank</div>
                                        </div>
                                        <div class="lb-personal-item">
                                            <div class="lb-personal-value">${voteStats.total_votes || 0}</div>
                                            <div class="lb-personal-label">Total Votes</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        } else {
                            statsDiv.innerHTML = '<div style="text-align:center;padding:15px;color:#666;font-size:12px;">Vote on skins to appear on the leaderboard!</div>';
                        }
                    } catch(e) {
                        statsDiv.innerHTML = '';
                    }
                } else {
                    statsDiv.innerHTML = '<div style="text-align:center;padding:15px;color:#666;font-size:12px;">Log in to see your stats</div>';
                }
            }
        };

        select.onchange = loadLeaderboard;
        refreshBtn.onclick = loadLeaderboard;

        // Load initial
        await loadLeaderboard();
    }

    // =========================================================================
    // 10.5 UPDATES TAB
    // =========================================================================
    async function fetchUpdates() {
        try {
            const ccoId = STATE.user.authenticated ? STATE.user.id : '';
            const data = await apiCall(`/updates?cco_id=${ccoId}`);
            STATE.updates.list = data.updates || [];
            STATE.updates.unreadCount = data.unread_count || 0;
            updateBadge();
            return data;
        } catch(e) {
            console.error("Failed to fetch updates:", e);
            return { updates: [], unread_count: 0 };
        }
    }

    function updateBadge() {
        // Update nav badge
        const badge = document.getElementById('updates-badge');
        if (badge) {
            if (STATE.updates.unreadCount > 0) {
                badge.textContent = STATE.updates.unreadCount;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
        // Update toolbar badge
        updateToolbarBadge();
    }

    async function renderUpdatesTab(container) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">Loading updates...</div>';

        const data = await fetchUpdates();
        const updates = data.updates || [];

        let updatesHtml = '';
        if (updates.length > 0) {
            updatesHtml = updates.map(update => {
                const date = new Date(update.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });

                return `
                    <div class="update-card" data-update-id="${update.id}">
                        <div class="update-header">
                            <div class="update-title">📢 ${escapeHtml(update.title)}</div>
                            <div class="update-date">${date}</div>
                        </div>
                        ${update.description ? `<div class="update-description">${escapeHtml(update.description)}</div>` : ''}
                        ${update.link_url ? `<a href="${update.link_url.startsWith('http') ? update.link_url : 'https://' + update.link_url}" target="_blank" class="update-link">${update.link_text || 'Learn more'} →</a>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            updatesHtml = '<div style="text-align:center;padding:40px;color:#666;">No updates yet. Check back later!</div>';
        }

        container.innerHTML = `
            <div class="updates-container">
                <div class="updates-header">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#fff;">📢 Updates & Announcements</div>
                        <div style="color:var(--z-dim);font-size:11px;">Latest news and updates from the developers</div>
                    </div>
                    ${STATE.user.authenticated && STATE.updates.unreadCount > 0 ? `
                        <button id="mark-all-read-btn" class="zsb-btn secondary">✓ Mark All Read</button>
                    ` : ''}
                </div>
                <div class="updates-list">
                    ${updatesHtml}
                </div>
            </div>
        `;

        // Mark all as read handler
        const markAllBtn = container.querySelector('#mark-all-read-btn');
        if (markAllBtn) {
            markAllBtn.onclick = async () => {
                try {
                    await apiCall('/updates/read-all', 'POST', { cco_id: STATE.user.id });
                    STATE.updates.unreadCount = 0;
                    updateBadge();
                    markAllBtn.remove();
                } catch(e) {
                    console.error("Failed to mark all read:", e);
                }
            };
        }

        // Auto-mark as read when viewing
        if (STATE.user.authenticated && updates.length > 0) {
            for (const update of updates) {
                try {
                    await apiCall(`/updates/${update.id}/read`, 'POST', { cco_id: STATE.user.id });
                } catch(e) {}
            }
            STATE.updates.unreadCount = 0;
            updateBadge();
        }
    }

    // =========================================================================
    // 10.6 OFFERS TAB
    // =========================================================================
    async function fetchOffers() {
        if (!STATE.user.authenticated) return;
        try {
            const [received, sent, unread] = await Promise.all([
                apiCall(`/collectors/offers/received?cco_id=${STATE.user.id}`),
                apiCall(`/collectors/offers/sent?cco_id=${STATE.user.id}`),
                apiCall(`/collectors/offers/unread?cco_id=${STATE.user.id}`)
            ]);
            STATE.offers.received = received.offers || [];
            STATE.offers.sent = sent.offers || [];
            STATE.offers.unreadReceived = unread.received || 0;
            STATE.offers.unreadSent = unread.sent || 0;
            updateOffersBadge();
        } catch(e) {
            console.error("Failed to fetch offers:", e);
        }
    }

    function updateOffersBadge() {
        const total = (STATE.offers.unreadReceived || 0) + (STATE.offers.unreadSent || 0);
        const badge = document.getElementById('offers-badge');
        if (badge) {
            if (total > 0) {
                badge.textContent = total;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
        // Also update toolbar badge (combines updates + offers)
        updateToolbarBadge();
    }

    async function renderOffersTab(container, activeTab = 'received') {
        if (!STATE.user.authenticated) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">Please login to view offers</div>';
            return;
        }

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">Loading offers...</div>';
        await fetchOffers();

        const receivedCount = STATE.offers.received.filter(o => o.status === 'pending').length;
        const sentPending = STATE.offers.sent.filter(o => o.status === 'pending').length;
        const sentResponded = STATE.offers.sent.filter(o => o.status !== 'pending').length;

        container.innerHTML = `
            <div class="offers-container">
                <div style="margin-bottom: 20px;">
                    <div style="font-size:18px;font-weight:700;color:#fff;">🎁 Item Offers</div>
                    <div style="color:var(--z-dim);font-size:11px;">Trade offers for your wishlist items</div>
                </div>

                <div class="offers-tabs">
                    <div class="offers-tab ${activeTab === 'received' ? 'active' : ''}" data-tab="received">
                        📥 Received
                        ${STATE.offers.unreadReceived > 0 ? `<span class="tab-badge">${STATE.offers.unreadReceived}</span>` : ''}
                    </div>
                    <div class="offers-tab ${activeTab === 'sent' ? 'active' : ''}" data-tab="sent">
                        📤 Sent
                        ${STATE.offers.unreadSent > 0 ? `<span class="tab-badge">${STATE.offers.unreadSent}</span>` : ''}
                    </div>
                </div>

                <div class="offers-list" id="offers-list">
                    ${activeTab === 'received' ? renderReceivedOffers() : renderSentOffers()}
                </div>
            </div>
        `;

        // Tab switching
        container.querySelectorAll('.offers-tab').forEach(tab => {
            tab.onclick = () => renderOffersTab(container, tab.dataset.tab);
        });

        // Mark as read
        if (activeTab === 'received' && STATE.offers.unreadReceived > 0) {
            await apiCall('/collectors/offers/mark-read', 'POST', { cco_id: STATE.user.id, type: 'received' });
            STATE.offers.unreadReceived = 0;
            updateOffersBadge();
        } else if (activeTab === 'sent' && STATE.offers.unreadSent > 0) {
            await apiCall('/collectors/offers/mark-read', 'POST', { cco_id: STATE.user.id, type: 'sent' });
            STATE.offers.unreadSent = 0;
            updateOffersBadge();
        }

        // Action handlers
        setupOfferHandlers(container, activeTab);
    }

    function renderReceivedOffers() {
        const pending = STATE.offers.received.filter(o => o.status === 'pending');
        const responded = STATE.offers.received.filter(o => o.status !== 'pending');

        if (STATE.offers.received.length === 0) {
            return '<div style="text-align:center;padding:40px;color:#666;">No offers received yet.<br><small>When someone offers an item for your wishlist, it will appear here.</small></div>';
        }

        let html = '';

        if (pending.length > 0) {
            html += '<div style="font-size:12px;color:var(--z-dim);margin-bottom:10px;text-transform:uppercase;">Pending Offers</div>';
            html += pending.map(o => renderOfferCard(o, 'received')).join('');
        }

        if (responded.length > 0) {
            if (pending.length > 0) html += '<div style="margin-top:20px;"></div>';
            html += '<div style="font-size:12px;color:var(--z-dim);margin-bottom:10px;text-transform:uppercase;">Past Offers</div>';
            html += responded.map(o => renderOfferCard(o, 'received')).join('');
        }

        return html;
    }

    function renderSentOffers() {
        if (STATE.offers.sent.length === 0) {
            return '<div style="text-align:center;padding:40px;color:#666;">No offers sent yet.<br><small>Click on items in collector wishlists to send offers.</small></div>';
        }

        const pending = STATE.offers.sent.filter(o => o.status === 'pending');
        const responded = STATE.offers.sent.filter(o => o.status !== 'pending');

        let html = '';

        if (pending.length > 0) {
            html += '<div style="font-size:12px;color:var(--z-dim);margin-bottom:10px;text-transform:uppercase;">Pending</div>';
            html += pending.map(o => renderOfferCard(o, 'sent')).join('');
        }

        if (responded.length > 0) {
            if (pending.length > 0) html += '<div style="margin-top:20px;"></div>';
            html += '<div style="font-size:12px;color:var(--z-dim);margin-bottom:10px;text-transform:uppercase;">Responded</div>';
            html += responded.map(o => renderOfferCard(o, 'sent')).join('');
        }

        return html;
    }

    function renderOfferCard(offer, type) {
        const itemData = offer.item_data;
        const date = new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

        const avatarHtml = offer.sender_avatar
            ? `<img src="${offer.sender_avatar}" class="offer-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';

        const statusClass = offer.status;
        const statusLabel = offer.status.charAt(0).toUpperCase() + offer.status.slice(1);

        // Item image from CCO - use pictures/skins path like pattern images
        const itemImage = itemData.iconUrl
            ? `https://case-clicker.com/pictures/skins/${itemData.iconUrl}`
            : '';

        // Format float - show full value
        const floatDisplay = itemData.float ? itemData.float.toString() : 'N/A';

        // Quality mapping
        const qualityMap = {
            0: { name: 'Common', color: '#9ca3af' },
            1: { name: 'Rare', color: '#3b82f6' },
            2: { name: 'Epic', color: '#a855f7' },
            3: { name: 'Legendary', color: '#f59e0b' }
        };
        const quality = qualityMap[itemData.quality] || null;

        // Card type class
        const cardTypeClass = itemData.statTrak ? 'stattrak' : (itemData.souvenir ? 'souvenir' : '');

        // Build name with badges
        let nameHtml = itemData.name;
        if (itemData.statTrak) {
            nameHtml = `<span class="st-badge">★ StatTrak™</span> ${nameHtml.replace(/StatTrak™?\s*/i, '')}`;
        }
        if (itemData.souvenir) {
            nameHtml = `<span class="sv-badge">★ Souvenir</span> ${nameHtml.replace(/Souvenir\s*/i, '')}`;
        }

        // Stickers with images - check if iconUrl is already a full URL or just filename
        const stickersHtml = itemData.stickers && itemData.stickers.length > 0
            ? `<div class="offer-item-stickers">${itemData.stickers.map(s => {
                const stickerImg = s.iconUrl
                    ? (s.iconUrl.startsWith('http') ? s.iconUrl : `https://case-clicker.com/pictures/stickers/${s.iconUrl}`)
                    : '';
                return stickerImg
                    ? `<img src="${stickerImg}" class="offer-sticker-img" title="${s.name || ''}" onerror="this.outerHTML='<span class=offer-item-sticker>${s.name || 'Sticker'}</span>'">`
                    : `<span class="offer-item-sticker">${s.name || 'Sticker'}</span>`;
            }).join('')}</div>`
            : '';

        // Format reputation with color
        const formatRep = (rep) => {
            const repNum = parseInt(rep) || 0;
            const color = repNum > 0 ? '#10b981' : (repNum < 0 ? '#ef4444' : '#666');
            const sign = repNum > 0 ? '+' : '';
            return `<span style="color:${color};font-size:11px;font-weight:600;">(${sign}${repNum} rep)</span>`;
        };

        // Text depends on perspective (received vs sent)
        const senderProfileUrl = `https://case-clicker.com/profile/${offer.sender_cco_id}`;
        const recipientProfileUrl = offer.recipient_cco_id ? `https://case-clicker.com/profile/${offer.recipient_cco_id}` : '#';

        const userInfo = type === 'received'
            ? `<div class="offer-username"><a href="${senderProfileUrl}" target="_blank" class="offer-user-link">${offer.sender_username || 'Anonymous'}</a> ${formatRep(offer.sender_rep)} <span style="color:var(--z-dim);font-weight:400;">is offering:</span></div>`
            : `<div class="offer-username">To: <a href="${recipientProfileUrl}" target="_blank" class="offer-user-link">${offer.recipient_username || 'Unknown'}</a> ${formatRep(offer.recipient_rep)}</div>`;

        const wantedText = type === 'received'
            ? `<span style="font-size:11px;color:#666;">as <strong style="color:#888;">${offer.wanted_item_name}</strong> is on your wishlist</span>`
            : `For their: <strong>${offer.wanted_item_name}</strong>`;

        return `
            <div class="offer-card ${statusClass}" data-offer-id="${offer.id}">
                <div class="offer-header">
                    <div class="offer-user">
                        ${avatarHtml}
                        <div class="offer-avatar-fallback" ${avatarHtml ? 'style="display:none;"' : ''}>${getInitials(offer.sender_username)}</div>
                        <div class="offer-user-info">
                            ${userInfo}
                            <div class="offer-date">${date}</div>
                        </div>
                    </div>
                    <span class="offer-status ${statusClass}">${statusLabel}</span>
                </div>

                ${type === 'sent' ? `<div class="offer-wanted">${wantedText}</div>` : ''}

                <div class="offer-item-card ${cardTypeClass}">
                    <div class="offer-item-image-wrap">
                        ${itemImage ? `<img src="${itemImage}" onerror="this.parentElement.innerHTML='<span style=\\'color:#333;font-size:24px;\\'>?</span>'">` : '<span style="color:#333;font-size:24px;">?</span>'}
                    </div>
                    <div class="offer-item-info">
                        <div class="offer-item-name">${nameHtml}</div>
                        <div class="offer-item-stats">
                            <div class="offer-item-stat">
                                <span class="offer-item-stat-label">Float</span>
                                <span class="offer-item-stat-value float">${floatDisplay}</span>
                            </div>
                            <div class="offer-item-stat">
                                <span class="offer-item-stat-label">Price</span>
                                <span class="offer-item-stat-value price">$${(itemData.price || 0).toLocaleString()}</span>
                            </div>
                            ${itemData.exterior ? `
                                <div class="offer-item-stat">
                                    <span class="offer-item-stat-label">Wear</span>
                                    <span class="offer-item-stat-value">${itemData.exterior}</span>
                                </div>
                            ` : ''}
                            ${quality ? `
                                <div class="offer-item-stat">
                                    <span class="offer-item-stat-label">Quality</span>
                                    <span class="offer-item-stat-value" style="color:${quality.color};">${quality.name}</span>
                                </div>
                            ` : ''}
                        </div>
                        ${stickersHtml}
                    </div>
                </div>

                ${type === 'received' ? `<div class="offer-wanted">${wantedText}</div>` : ''}

                ${offer.status === 'accepted' && offer.trade_link ? `
                    <div class="offer-trade-link">
                        <div class="offer-trade-link-label">Trade Link:</div>
                        <a href="${offer.trade_link.startsWith('http') ? offer.trade_link : 'https://' + offer.trade_link}" target="_blank">${offer.trade_link}</a>
                    </div>
                ` : ''}

                ${type === 'received' && offer.status === 'pending' ? `
                    <div class="offer-actions">
                        <button class="zsb-btn" data-action="accept" data-offer-id="${offer.id}">✓ Accept</button>
                        <button class="zsb-btn danger" data-action="deny" data-offer-id="${offer.id}">✕ Deny</button>
                    </div>
                ` : ''}

                ${type === 'sent' && offer.status === 'pending' ? `
                    <div class="offer-actions">
                        <button class="zsb-btn secondary" data-action="cancel" data-offer-id="${offer.id}">Cancel Offer</button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function showTradeLinkModal(offerId) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'profile-modal';
            modal.innerHTML = `
                <div class="profile-modal-content" style="max-width: 450px;">
                    <div class="profile-modal-header">
                        <div style="font-size:16px;font-weight:700;color:#fff;">✓ Accept Offer</div>
                        <button class="profile-modal-close">✕</button>
                    </div>
                    <div class="profile-modal-body">
                        <div style="margin-bottom:15px;color:#ccc;font-size:13px;">
                            Enter a trade link to complete the trade.
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="font-size:11px;color:var(--z-dim);display:block;margin-bottom:6px;">Trade Link</label>
                            <input type="text" id="trade-link-input" class="zsb-input" placeholder="https://case-clicker.com/trade/..." style="width:100%;">
                        </div>
                        <div style="display:flex;gap:10px;">
                            <button id="trade-link-cancel" class="zsb-btn secondary" style="flex:1;">Cancel</button>
                            <button id="trade-link-confirm" class="zsb-btn" style="flex:1;">✓ Confirm</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const input = modal.querySelector('#trade-link-input');
            const confirmBtn = modal.querySelector('#trade-link-confirm');
            const cancelBtn = modal.querySelector('#trade-link-cancel');
            const closeBtn = modal.querySelector('.profile-modal-close');

            // Focus input
            setTimeout(() => input.focus(), 100);

            const close = (result) => {
                modal.remove();
                resolve(result);
            };

            confirmBtn.onclick = () => {
                const value = input.value.trim();
                if (!value) {
                    input.style.borderColor = '#ef4444';
                    input.placeholder = 'Trade link is required';
                    return;
                }
                close(value);
            };

            cancelBtn.onclick = () => close(null);
            closeBtn.onclick = () => close(null);
            modal.onclick = (e) => { if (e.target === modal) close(null); };

            // Enter key to confirm
            input.onkeydown = (e) => {
                if (e.key === 'Enter') confirmBtn.click();
                if (e.key === 'Escape') close(null);
            };
        });
    }

    function showConfirmModal(title, message, btnType = 'primary') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'profile-modal';

            const btnClass = btnType === 'danger' ? 'zsb-btn danger' : (btnType === 'secondary' ? 'zsb-btn secondary' : 'zsb-btn');
            const confirmText = btnType === 'danger' ? '✕ Deny' : '✓ Confirm';

            modal.innerHTML = `
                <div class="profile-modal-content" style="max-width: 400px;">
                    <div class="profile-modal-header">
                        <div style="font-size:16px;font-weight:700;color:#fff;">${title}</div>
                        <button class="profile-modal-close">✕</button>
                    </div>
                    <div class="profile-modal-body">
                        <div style="margin-bottom:20px;color:#ccc;font-size:13px;line-height:1.5;">
                            ${message}
                        </div>
                        <div style="display:flex;gap:10px;">
                            <button id="confirm-cancel" class="zsb-btn secondary" style="flex:1;">Cancel</button>
                            <button id="confirm-ok" class="${btnClass}" style="flex:1;">${confirmText}</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const okBtn = modal.querySelector('#confirm-ok');
            const cancelBtn = modal.querySelector('#confirm-cancel');
            const closeBtn = modal.querySelector('.profile-modal-close');

            const close = (result) => {
                modal.remove();
                resolve(result);
            };

            okBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            closeBtn.onclick = () => close(false);
            modal.onclick = (e) => { if (e.target === modal) close(false); };

            // Keyboard shortcuts
            document.addEventListener('keydown', function handler(e) {
                if (e.key === 'Enter') { close(true); document.removeEventListener('keydown', handler); }
                if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', handler); }
            });
        });
    }

    function setupOfferHandlers(container, activeTab) {
        // Accept button
        container.querySelectorAll('[data-action="accept"]').forEach(btn => {
            btn.onclick = async () => {
                const offerId = btn.dataset.offerId;
                const tradeLink = await showTradeLinkModal(offerId);
                if (!tradeLink) return;

                btn.disabled = true;
                btn.textContent = 'Accepting...';

                try {
                    await apiCall(`/collectors/offer/${offerId}/respond`, 'POST', {
                        cco_id: STATE.user.id,
                        action: 'accept',
                        trade_link: tradeLink
                    });
                    renderOffersTab(container, activeTab);
                } catch(e) {
                    alert('Failed to accept offer: ' + e);
                    btn.disabled = false;
                    btn.textContent = '✓ Accept';
                }
            };
        });

        // Deny button
        container.querySelectorAll('[data-action="deny"]').forEach(btn => {
            btn.onclick = async () => {
                const confirmed = await showConfirmModal('Deny Offer', 'Are you sure you want to deny this offer? This cannot be undone.', 'danger');
                if (!confirmed) return;

                const offerId = btn.dataset.offerId;
                btn.disabled = true;

                try {
                    await apiCall(`/collectors/offer/${offerId}/respond`, 'POST', {
                        cco_id: STATE.user.id,
                        action: 'deny'
                    });
                    renderOffersTab(container, activeTab);
                } catch(e) {
                    alert('Failed to deny offer: ' + e);
                    btn.disabled = false;
                }
            };
        });

        // Cancel button
        container.querySelectorAll('[data-action="cancel"]').forEach(btn => {
            btn.onclick = async () => {
                const confirmed = await showConfirmModal('Cancel Offer', 'Are you sure you want to cancel this offer?', 'secondary');
                if (!confirmed) return;

                const offerId = btn.dataset.offerId;
                btn.disabled = true;

                try {
                    await apiCall(`/collectors/offer/${offerId}?cco_id=${STATE.user.id}`, 'DELETE');
                    renderOffersTab(container, activeTab);
                } catch(e) {
                    alert('Failed to cancel offer: ' + e);
                    btn.disabled = false;
                }
            };
        });
    }

    async function showOfferModal(collectorItem, profileCcoId) {
        // collectorItem has: id, game_item_id, collector_price
        const modal = document.createElement('div');
        modal.className = 'profile-modal';
        modal.innerHTML = `
            <div class="profile-modal-content offer-modal-content">
                <div class="profile-modal-header">
                    <div style="font-size:18px;font-weight:700;color:#fff;">🎁 Send Item Offer</div>
                    <button class="profile-modal-close">✕</button>
                </div>
                <div class="profile-modal-body">
                    <div class="offer-wanted" style="margin-bottom:15px;">
                        Offering for: <strong>${collectorItem.game_item_id}</strong>
                        ${collectorItem.collector_price > 0 ? `<br><span style="font-size:11px;color:var(--z-accent);">Collector's price: $${parseInt(collectorItem.collector_price).toLocaleString()}</span>` : ''}
                    </div>

                    <div class="offer-input-section">
                        <div class="offer-input-label">Paste your item link from CCO:</div>
                        <input type="text" id="offer-item-link" class="zsb-input" placeholder="https://case-clicker.com/api/openedSkin/..." style="width:100%;">
                        <div style="font-size:10px;color:var(--z-dim);margin-top:5px;">
                            Right-click your item → Copy link address, or get it from the item page URL
                        </div>
                    </div>

                    <div id="offer-preview" class="offer-preview" style="display:none;">
                        <div class="offer-preview-title">Item Preview</div>
                        <div id="offer-preview-content"></div>
                    </div>

                    <div id="offer-error" style="color:#ef4444;font-size:12px;margin-top:10px;display:none;"></div>

                    <div style="display:flex;gap:10px;margin-top:20px;">
                        <button id="offer-load-btn" class="zsb-btn secondary" style="flex:1;">🔍 Load Item</button>
                        <button id="offer-submit-btn" class="zsb-btn" style="flex:1;" disabled>📤 Send Offer</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let loadedItemData = null;

        const linkInput = modal.querySelector('#offer-item-link');
        const loadBtn = modal.querySelector('#offer-load-btn');
        const submitBtn = modal.querySelector('#offer-submit-btn');
        const previewDiv = modal.querySelector('#offer-preview');
        const previewContent = modal.querySelector('#offer-preview-content');
        const errorDiv = modal.querySelector('#offer-error');

        loadBtn.onclick = async () => {
            const link = linkInput.value.trim();
            errorDiv.style.display = 'none';

            // Extract item ID
            const match = link.match(/openedSkin\/([a-f0-9]+)/i);
            if (!match) {
                errorDiv.textContent = 'Invalid link format. Please paste a valid CCO item link.';
                errorDiv.style.display = 'block';
                return;
            }

            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';

            try {
                const itemData = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://case-clicker.com/api/openedSkin/${match[1]}`,
                        onload: (r) => {
                            if (r.status >= 200 && r.status < 300) {
                                resolve(JSON.parse(r.responseText));
                            } else {
                                reject(new Error('Item not found'));
                            }
                        },
                        onerror: () => reject(new Error('Network error'))
                    });
                });

                loadedItemData = itemData;

                // Check ownership
                if (itemData.userId !== STATE.user.id) {
                    errorDiv.textContent = 'This item doesn\'t belong to you!';
                    errorDiv.style.display = 'block';
                    loadedItemData = null;
                    submitBtn.disabled = true;
                } else {
                    // Show preview - use pictures/skins path like pattern images
                    const itemImage = itemData.iconUrl
                        ? `https://case-clicker.com/pictures/skins/${itemData.iconUrl}`
                        : '';

                    // Stickers with images - check if iconUrl is already a full URL or just filename
                    const stickersHtml = itemData.stickers && itemData.stickers.length > 0
                        ? `<div class="offer-item-stickers">${itemData.stickers.map(s => {
                            const stickerImg = s.iconUrl
                                ? (s.iconUrl.startsWith('http') ? s.iconUrl : `https://case-clicker.com/pictures/stickers/${s.iconUrl}`)
                                : '';
                            return stickerImg
                                ? `<img src="${stickerImg}" class="offer-sticker-img" title="${s.name || ''}" onerror="this.outerHTML='<span class=offer-item-sticker>${s.name || 'Sticker'}</span>'">`
                                : `<span class="offer-item-sticker">${s.name || 'Sticker'}</span>`;
                        }).join('')}</div>`
                        : '';

                    // Quality mapping
                    const qualityMap = {
                        0: { name: 'Common', color: '#9ca3af' },
                        1: { name: 'Rare', color: '#3b82f6' },
                        2: { name: 'Epic', color: '#a855f7' },
                        3: { name: 'Legendary', color: '#f59e0b' }
                    };
                    const quality = qualityMap[itemData.quality] || null;

                    previewContent.innerHTML = `
                        <div class="offer-item-card ${itemData.statTrak ? 'stattrak' : ''} ${itemData.souvenir ? 'souvenir' : ''}">
                            <div class="offer-item-image-wrap">
                                ${itemImage ? `<img src="${itemImage}" onerror="this.parentElement.innerHTML='<span style=\\'color:#333;font-size:24px;\\'>?</span>'">` : '<span style="color:#333;font-size:24px;">?</span>'}
                            </div>
                            <div class="offer-item-info">
                                <div class="offer-item-name">${itemData.statTrak ? '<span class="st-badge">★ ST</span> ' : ''}${itemData.souvenir ? '<span class="sv-badge">★ SV</span> ' : ''}${itemData.name.replace(/StatTrak™?\s*/i, '').replace(/Souvenir\s*/i, '')}</div>
                                <div class="offer-item-stats">
                                    <div class="offer-item-stat">
                                        <span class="offer-item-stat-label">Float</span>
                                        <span class="offer-item-stat-value float">${itemData.float ? itemData.float.toString() : 'N/A'}</span>
                                    </div>
                                    <div class="offer-item-stat">
                                        <span class="offer-item-stat-label">Price</span>
                                        <span class="offer-item-stat-value price">$${(itemData.price || 0).toLocaleString()}</span>
                                    </div>
                                    ${itemData.exterior ? `
                                        <div class="offer-item-stat">
                                            <span class="offer-item-stat-label">Wear</span>
                                            <span class="offer-item-stat-value">${itemData.exterior}</span>
                                        </div>
                                    ` : ''}
                                    ${quality ? `
                                        <div class="offer-item-stat">
                                            <span class="offer-item-stat-label">Quality</span>
                                            <span class="offer-item-stat-value" style="color:${quality.color};">${quality.name}</span>
                                        </div>
                                    ` : ''}
                                </div>
                                ${stickersHtml}
                            </div>
                        </div>
                    `;
                    previewDiv.style.display = 'block';
                    submitBtn.disabled = false;
                }
            } catch(e) {
                errorDiv.textContent = 'Failed to load item: ' + e.message;
                errorDiv.style.display = 'block';
                loadedItemData = null;
            }

            loadBtn.disabled = false;
            loadBtn.textContent = '🔍 Load Item';
        };

        submitBtn.onclick = async () => {
            if (!loadedItemData) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            errorDiv.style.display = 'none';

            // Get sender avatar
            let senderAvatar = STATE.collectors.myProfile?.profile_picture_url || null;
            if (!senderAvatar) {
                senderAvatar = await fetchCCOProfileImage(STATE.user.id);
            }

            try {
                await apiCall('/collectors/offer', 'POST', {
                    sender_cco_id: STATE.user.id,
                    sender_username: STATE.user.name,
                    sender_avatar: senderAvatar,
                    collector_item_id: collectorItem.id,
                    item_link: linkInput.value.trim(),
                    item_data: loadedItemData
                });

                modal.remove();
                alert('Offer sent successfully!');
            } catch(e) {
                const errMsg = typeof e === 'object' ? (e.error || e.message || 'Unknown error') : e;
                errorDiv.textContent = 'Failed to send offer: ' + errMsg;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Send Offer';
            }
        };

        modal.querySelector('.profile-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    // =========================================================================
    // 11. COLLECTORS TAB
    // =========================================================================
    async function fetchCCOProfileImage(ccoId) {
        try {
            return await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://case-clicker.com/api/user/information?userId=${ccoId}`,
                    onload: (r) => {
                        if (r.status >= 200 && r.status < 300) {
                            const data = JSON.parse(r.responseText);
                            resolve(data.image || null);
                        } else {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        } catch(e) {
            console.error("Failed to fetch CCO profile image:", e);
            return null;
        }
    }

    async function fetchMyProfile() {
        if (!STATE.user.authenticated) return;
        try {
            const data = await apiCall(`/collectors/my-profile?cco_id=${STATE.user.id}`);
            STATE.collectors.myProfile = data.exists ? data : null;
        } catch (e) {
            console.error("Failed to fetch my profile:", e);
            STATE.collectors.myProfile = null;
        }
    }

    async function searchCollectors(query) {
        if (!query || query.length < 2) {
            STATE.collectors.searchResults = [];
            return;
        }
        try {
            const data = await apiCall(`/collectors/search?q=${encodeURIComponent(query)}`);
            STATE.collectors.searchResults = data || [];
        } catch (e) {
            console.error("Collector search failed:", e);
            STATE.collectors.searchResults = [];
        }
    }

    async function fetchCollectorProfile(cco_id) {
        try {
            const data = await apiCall(`/collectors/profile/${cco_id}`);
            return data;
        } catch (e) {
            console.error("Failed to fetch collector profile:", e);
            return null;
        }
    }

    async function saveProfile(profileData) {
        if (!STATE.user.authenticated) return alert("Please refresh to login.");
        try {
            await apiCall('/collectors/profile', 'POST', {
                cco_id: STATE.user.id,
                username: STATE.user.name,
                ...profileData
            });
            await fetchMyProfile();
            return true;
        } catch (e) {
            console.error("Failed to save profile:", e);
            alert("Failed to save profile: " + e);
            return false;
        }
    }

    async function addItemToProfile(game_item_id, collector_price = 0) {
        if (!STATE.user.authenticated) return alert("Please refresh to login.");
        try {
            await apiCall('/collectors/items/add', 'POST', {
                cco_id: STATE.user.id,
                game_item_id: game_item_id,
                collector_price: collector_price
            });
            await fetchMyProfile();
            return true;
        } catch (e) {
            console.error("Failed to add item:", e);
            alert("Failed to add item: " + e);
            return false;
        }
    }

    async function removeItemFromProfile(itemId) {
        if (!STATE.user.authenticated) return;
        try {
            await apiCall('/collectors/items/remove', 'POST', {
                cco_id: STATE.user.id,
                item_id: itemId
            });
            await fetchMyProfile();
            return true;
        } catch (e) {
            console.error("Failed to remove item:", e);
            return false;
        }
    }

    async function fetchAllCollectors(searchQuery = '') {
        try {
            let url = '/collectors/all';
            if (searchQuery && searchQuery.length >= 2) {
                url += `?search=${encodeURIComponent(searchQuery)}`;
            }
            const data = await apiCall(url);
            STATE.collectors.allProfiles = data || [];
        } catch (e) {
            console.error("Failed to fetch all collectors:", e);
            STATE.collectors.allProfiles = [];
        }
    }

    function renderCollectorsTab(container) {
        fetchMyProfile().then(async () => {
            const hasProfile = STATE.collectors.myProfile && STATE.collectors.myProfile.exists;
            const profileBtnText = hasProfile ? '✏️ Edit Profile' : '➕ Setup Profile';

            container.innerHTML = `
                <div class="collectors-header">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:#fff;">👥 Collectors List</div>
                        <div style="color:var(--z-dim);font-size:11px;">Browse collectors or search by item</div>
                    </div>
                    <button id="profile-btn" class="zsb-btn purple">${profileBtnText}</button>
                </div>

                <div class="collectors-search-box" style="margin-bottom:20px;">
                    <input type="text" id="collector-filter-input" class="zsb-input" placeholder="Search by username, item, discord..." style="flex:1;">
                    <button id="clear-filter-btn" class="zsb-btn secondary">✕ Clear</button>
                </div>

                <div id="collectors-results" class="collectors-results">
                    <div style="text-align:center;padding:40px;color:#666;grid-column:1/-1;">
                        Loading collectors...
                    </div>
                </div>
            `;

            container.querySelector('#profile-btn').onclick = async () => {
                STATE.collectors.editMode = true;
                await showProfileEditor(container);
            };

            const resultsDiv = container.querySelector('#collectors-results');
            const filterInput = container.querySelector('#collector-filter-input');

            // Load initial collectors
            await fetchAllCollectors();
            renderAllCollectors(resultsDiv);

            // Setup filter with debounce for server-side search
            let filterTimeout;
            filterInput.oninput = () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(async () => {
                    resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#666;grid-column:1/-1;">Searching...</div>';
                    await fetchAllCollectors(filterInput.value);
                    renderAllCollectors(resultsDiv);
                }, 300);
            };

            container.querySelector('#clear-filter-btn').onclick = async () => {
                filterInput.value = '';
                resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#666;grid-column:1/-1;">Loading...</div>';
                await fetchAllCollectors();
                renderAllCollectors(resultsDiv);
            };
        });
    }

    function renderAllCollectors(resultsDiv) {
        let profiles = STATE.collectors.allProfiles || [];

        if (!profiles || profiles.length === 0) {
            resultsDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#666;grid-column:1/-1;">
                No collector profiles found
            </div>`;
            return;
        }

        resultsDiv.innerHTML = profiles.map(collector => {
            // Build item preview thumbnails
            let itemsPreviewHtml = '';
            const sampleItems = collector.sample_items || [];

            if (sampleItems.length > 0) {
                const previewItems = sampleItems.slice(0, 4);
                itemsPreviewHtml = previewItems.map(itemName => {
                    const { displayName, cleanId } = parseItemDisplay(itemName);
                    let imgHtml = `<div class="collector-thumb-placeholder">?</div>`;
                    if (STATE.patternImages[cleanId]) {
                        imgHtml = `<img src="${STATE.patternImages[cleanId]}" class="collector-thumb-img" title="${displayName}">`;
                    }
                    return `<div class="collector-thumb">${imgHtml}</div>`;
                }).join('');

                if (collector.item_count > 4) {
                    itemsPreviewHtml += `<div class="collector-thumb-more">+${collector.item_count - 4}</div>`;
                }
            } else {
                itemsPreviewHtml = '<div style="color:#666;font-size:11px;">No items yet</div>';
            }

            const isOnHold = collector.is_on_hold;
            const voteTotal = collector.vote_total || 0;
            const accentColor = collector.accent_color || '#8b5cf6';

            return `
                <div class="collector-card-v2 ${isOnHold ? 'on-hold' : ''}" data-cco-id="${collector.cco_id}" style="--card-accent: ${accentColor};">
                    ${isOnHold ? '<div class="collector-hold-badge">⏸️ ON HOLD</div>' : ''}
                    <div class="collector-card-top">
                        <div class="collector-card-info">
                            <div class="collector-card-name">${collector.username || 'Anonymous'}</div>
                            ${collector.discord_handle
                                ? `<div class="collector-card-discord"><span class="discord-icon">🎮</span> ${collector.discord_handle}</div>`
                                : ''}
                            <div class="collector-card-count">looking for ${collector.item_count} item${collector.item_count !== 1 ? 's' : ''}</div>
                        </div>
                        <div class="collector-card-rep">
                            <div class="collector-rep-value ${voteTotal > 0 ? 'positive' : voteTotal < 0 ? 'negative' : ''}">${voteTotal > 0 ? '+' : ''}${voteTotal}</div>
                            <div class="collector-rep-label">rep</div>
                        </div>
                    </div>
                    <div class="collector-card-items">
                        ${itemsPreviewHtml}
                    </div>
                </div>
            `;
        }).join('');

        resultsDiv.querySelectorAll('.collector-card-v2').forEach(card => {
            card.onclick = () => {
                const ccoId = card.dataset.ccoId;
                showCollectorProfileModal(ccoId);
            };
        });
    }

    function renderCollectorResults(resultsDiv) {
        const results = STATE.collectors.searchResults;

        if (!results || results.length === 0) {
            resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#666;grid-column:1/-1;">No collectors found for this item</div>';
            return;
        }

        resultsDiv.innerHTML = results.map(collector => `
            <div class="collector-card" data-cco-id="${collector.cco_id}">
                <div class="collector-card-header">
                    <div class="collector-name">${collector.username || 'Anonymous'}</div>
                    ${collector.discord_handle ? `<div class="collector-discord">🎮 ${collector.discord_handle}</div>` : ''}
                </div>
                <div class="collector-items-preview">
                    ${collector.matching_items.slice(0, 3).map(item => `<span class="collector-item-tag">${item}</span>`).join('')}
                </div>
                <div class="collector-item-count">${collector.item_count} items in wishlist</div>
            </div>
        `).join('');

        resultsDiv.querySelectorAll('.collector-card').forEach(card => {
            card.onclick = () => {
                const ccoId = card.dataset.ccoId;
                showCollectorProfileModal(ccoId);
            };
        });
    }

    async function showCollectorProfileModal(ccoId) {
        // Fetch profile with voter info
        let profileUrl = `${API_BASE}/collectors/profile/${ccoId}`;
        if (STATE.user.authenticated) {
            profileUrl += `?voter_cco_id=${STATE.user.id}`;
        }

        let profile;
        try {
            profile = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: profileUrl,
                    onload: (r) => {
                        if (r.status >= 200 && r.status < 300) {
                            resolve(JSON.parse(r.responseText));
                        } else {
                            reject(new Error(r.responseText));
                        }
                    },
                    onerror: reject
                });
            });
        } catch(e) {
            console.error("Failed to fetch profile:", e);
            return alert("Failed to load profile");
        }

        const ccoProfileUrl = `https://case-clicker.com/profile/${ccoId}`;

        // If no profile picture set, try to fetch from CCO API
        let profilePicture = profile.profile_picture_url;
        if (!profilePicture) {
            profilePicture = await fetchCCOProfileImage(ccoId);
        }

        // Build background style
        let bgStyle = '';
        if (profile.bg_image_url) {
            bgStyle = `background: linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url('${profile.bg_image_url}') center/cover; `;
        } else if (profile.gradient_start && profile.gradient_end) {
            bgStyle = `background: linear-gradient(135deg, ${profile.gradient_start} 0%, ${profile.gradient_end} 100%); `;
        } else {
            bgStyle = `background: ${profile.bg_color || '#18181b'}; `;
        }

        const accentColor = profile.accent_color || '#8b5cf6';
        const votes = profile.votes || { total: 0, positive: 0, negative: 0 };
        const userVote = profile.user_vote;
        const comments = profile.comments || [];
        const isOnHold = profile.is_on_hold;

        // Check if viewing someone else's profile (can send offers)
        const canSendOffer = STATE.user.authenticated && ccoId !== STATE.user.id;

        // Build item cards HTML
        let itemCardsHtml = '';
        if (profile.items && profile.items.length > 0) {
            itemCardsHtml = profile.items.map(item => {
                const { displayName, wear, isSt, cleanId } = parseItemDisplay(item.game_item_id);

                let imgHtml = `<div style="width:80px;height:60px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:4px;color:#333;font-size:16px;">?</div>`;
                if (STATE.patternImages[cleanId]) {
                    imgHtml = `<img src="${STATE.patternImages[cleanId]}" style="width:80px;height:60px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));" onerror="this.style.display='none'">`;
                }

                const marketPrice = STATE.prices[item.game_item_id] || 0;
                const collectorPrice = item.collector_price || 0;

                return `
                    <div class="profile-item-card ${isSt ? 'is-st' : ''} ${canSendOffer ? 'clickable' : ''}"
                         style="--accent: ${accentColor};"
                         data-item-id="${item.id}"
                         data-item-name="${item.game_item_id}"
                         data-item-price="${collectorPrice}">
                        ${isSt ? '<div class="profile-item-st">ST</div>' : ''}
                        ${imgHtml}
                        <div class="profile-item-card-name" title="${item.game_item_id}">${displayName}</div>
                        <div class="profile-item-card-wear">${wear}</div>
                        <div class="profile-item-prices">
                            <div class="profile-item-price collector">
                                <span class="price-label">Collector:</span>
                                <span class="price-value" style="color: ${accentColor};">${collectorPrice > 0 ? formatPrice(collectorPrice) : 'Any'}</span>
                            </div>
                            <div class="profile-item-price market">
                                <span class="price-label">Market:</span>
                                <span class="price-value">${marketPrice > 0 ? formatPrice(marketPrice) : '???'}</span>
                            </div>
                        </div>
                        ${canSendOffer ? '<div class="offer-hint">Click to send offer</div>' : ''}
                    </div>
                `;
            }).join('');
        } else {
            itemCardsHtml = '<div style="color:#666;padding:30px;text-align:center;grid-column:1/-1;">No items in wishlist</div>';
        }

        // Build comments HTML with profile pictures
        const getInitials = (name) => {
            if (!name) return '?';
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || name[0]?.toUpperCase() || '?';
        };

        let commentsHtml = comments.map(c => {
            const avatarHtml = c.commenter_avatar
                ? `<img src="${c.commenter_avatar}" class="comment-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="comment-avatar-fallback" style="display:none;">${getInitials(c.commenter_username)}</div>`
                : `<div class="comment-avatar-fallback">${getInitials(c.commenter_username)}</div>`;

            return `
                <div class="profile-comment" data-comment-id="${c.id}" data-commenter="${c.commenter_cco_id}">
                    <div class="comment-avatar-wrap">${avatarHtml}</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${c.commenter_username || 'Anonymous'}</span>
                            <span class="comment-date">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="comment-text">${escapeHtml(c.comment_text)}</div>
                    </div>
                    ${(STATE.user.authenticated && (c.commenter_cco_id === STATE.user.id || ccoId === STATE.user.id))
                        ? '<button class="comment-delete">✕</button>' : ''}
                </div>
            `;
        }).join('') || '<div style="color:#666;padding:15px;text-align:center;font-size:12px;">No comments yet</div>';

        const modal = document.createElement('div');
        modal.className = 'profile-modal';
        modal.innerHTML = `
            <div class="profile-modal-content profile-custom" style="${bgStyle} --profile-accent: ${accentColor};">
                <div class="profile-modal-header">
                    <div style="font-size:18px;font-weight:700;color:#fff;">👤 Collector Profile</div>
                    <button class="profile-modal-close">✕</button>
                </div>
                <div class="profile-modal-body">
                    ${isOnHold ? '<div class="profile-hold-banner">⏸️ This collector is currently on hold and not actively buying</div>' : ''}

                    <div class="profile-header-row">
                        ${profilePicture ? `
                            <div class="profile-avatar-large">
                                <img src="${profilePicture}" onerror="this.parentElement.style.display='none'">
                            </div>
                        ` : ''}
                        <div class="profile-info">
                            <a href="${ccoProfileUrl}" target="_blank" class="profile-username-link" style="color: ${accentColor};">${profile.username || 'Anonymous'}</a>
                            ${profile.discord_handle ? `<div class="profile-discord-big">🎮 ${profile.discord_handle}</div>` : '<div style="color:#666;font-size:13px;">No Discord set</div>'}
                        </div>

                        <div class="profile-rep-section">
                            <div class="profile-rep-title">Trader Rep</div>
                            <div class="profile-rep-total ${votes.total > 0 ? 'positive' : votes.total < 0 ? 'negative' : ''}">${votes.total > 0 ? '+' : ''}${votes.total}</div>
                            <div class="profile-rep-breakdown">(+${votes.positive} / -${votes.negative})</div>
                            ${STATE.user.authenticated && ccoId !== STATE.user.id ? `
                                <div class="profile-rep-buttons">
                                    <button class="rep-btn pos ${userVote === 1 ? 'active' : ''}" data-vote="1">+</button>
                                    <button class="rep-btn neg ${userVote === -1 ? 'active' : ''}" data-vote="-1">−</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${profile.bio ? `
                        <div class="profile-bio">
                            <div class="profile-bio-title">About</div>
                            <div class="profile-bio-text">${escapeHtml(profile.bio)}</div>
                        </div>
                    ` : ''}

                    <div class="profile-items-title" style="color: ${accentColor};">🎯 Looking For (${profile.items.length} items)</div>
                    <div class="profile-items-grid">
                        ${itemCardsHtml}
                    </div>

                    <div class="profile-comments-section">
                        <div class="profile-comments-title">💬 Comments (${comments.length})</div>
                        ${STATE.user.authenticated ? `
                            <div class="profile-comment-form">
                                <textarea id="new-comment-text" placeholder="Leave a comment..." maxlength="500"></textarea>
                                <button id="submit-comment-btn" class="zsb-btn" style="background: ${accentColor};">Post</button>
                            </div>
                        ` : '<div style="color:#666;font-size:11px;margin-bottom:10px;">Log in to comment</div>'}
                        <div class="profile-comments-list" id="comments-list">
                            ${commentsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Vote handlers
        modal.querySelectorAll('.rep-btn').forEach(btn => {
            btn.onclick = async () => {
                const voteType = parseInt(btn.dataset.vote);
                const currentVote = userVote;

                try {
                    if (currentVote === voteType) {
                        // Remove vote
                        await apiCall(`/collectors/profile/${profile.profile_id}/vote?voter_cco_id=${STATE.user.id}`, 'DELETE');
                    } else {
                        // Add/change vote
                        await apiCall(`/collectors/profile/${profile.profile_id}/vote`, 'POST', {
                            voter_cco_id: STATE.user.id,
                            vote_type: voteType
                        });
                    }
                    // Refresh modal
                    modal.remove();
                    showCollectorProfileModal(ccoId);
                } catch(e) {
                    alert("Failed to vote: " + e);
                }
            };
        });

        // Comment submission
        const submitBtn = modal.querySelector('#submit-comment-btn');
        if (submitBtn) {
            submitBtn.onclick = async () => {
                const text = modal.querySelector('#new-comment-text').value.trim();
                if (!text) return;

                // Get commenter's avatar (from their profile or CCO API)
                let commenterAvatar = STATE.collectors.myProfile?.profile_picture_url || null;
                if (!commenterAvatar) {
                    commenterAvatar = await fetchCCOProfileImage(STATE.user.id);
                }

                try {
                    await apiCall(`/collectors/profile/${profile.profile_id}/comment`, 'POST', {
                        commenter_cco_id: STATE.user.id,
                        commenter_username: STATE.user.name,
                        commenter_avatar: commenterAvatar,
                        comment_text: text
                    });
                    modal.remove();
                    showCollectorProfileModal(ccoId);
                } catch(e) {
                    alert("Failed to post comment: " + e);
                }
            };
        }

        // Comment deletion
        modal.querySelectorAll('.comment-delete').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const commentEl = btn.closest('.profile-comment');
                const commentId = commentEl.dataset.commentId;

                if (!confirm("Delete this comment?")) return;

                try {
                    await apiCall(`/collectors/comment/${commentId}?cco_id=${STATE.user.id}`, 'DELETE');
                    commentEl.remove();
                } catch(e) {
                    alert("Failed to delete comment: " + e);
                }
            };
        });

        // Item click handlers for sending offers
        modal.querySelectorAll('.profile-item-card.clickable').forEach(card => {
            card.onclick = () => {
                const collectorItem = {
                    id: card.dataset.itemId,
                    game_item_id: card.dataset.itemName,
                    collector_price: parseInt(card.dataset.itemPrice) || 0
                };
                showOfferModal(collectorItem, ccoId);
            };
        });

        modal.querySelector('.profile-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function showProfileEditor(container) {
        const profile = STATE.collectors.myProfile;
        const discordValue = profile ? (profile.discord_handle || '') : '';
        const bioValue = profile ? (profile.bio || '') : '';
        const bgColor = profile ? (profile.bg_color || '#18181b') : '#18181b';
        const accentColor = profile ? (profile.accent_color || '#8b5cf6') : '#8b5cf6';
        const gradientStart = profile ? (profile.gradient_start || '') : '';
        const gradientEnd = profile ? (profile.gradient_end || '') : '';
        const bgImageUrl = profile ? (profile.bg_image_url || '') : '';

        // Auto-fetch CCO profile picture if none is set
        let profilePictureUrl = profile ? (profile.profile_picture_url || '') : '';
        let ccoImageFetched = false;
        if (!profilePictureUrl && STATE.user.authenticated) {
            profilePictureUrl = await fetchCCOProfileImage(STATE.user.id) || '';
            ccoImageFetched = !!profilePictureUrl;
        }

        const isOnHold = profile ? (profile.is_on_hold || 0) : 0;
        const items = profile ? (profile.items || []) : [];

        // Build item rows with prices and edit button
        let itemRowsHtml = '';
        if (items.length > 0) {
            itemRowsHtml = items.map(item => {
                const marketPrice = STATE.prices[item.game_item_id] || 0;
                const collectorPrice = item.collector_price || 0;
                return `
                    <div class="profile-item-row" data-item-id="${item.id}" data-item-name="${item.game_item_id}" data-item-price="${collectorPrice}">
                        <div class="profile-item-checkbox" style="display:none;"><input type="checkbox" class="item-select-cb"></div>
                        <div class="profile-item-name">${item.game_item_id}</div>
                        <div class="profile-item-row-prices">
                            <span class="collector-price" title="Your price">${collectorPrice > 0 ? formatPrice(collectorPrice) : 'Any'}</span>
                            <span class="market-price" title="Market price">${marketPrice > 0 ? formatPrice(marketPrice) : '???'}</span>
                        </div>
                        <div class="profile-item-actions">
                            <button class="profile-item-edit" title="Edit price">✏️</button>
                            <button class="profile-item-remove" title="Remove">✕</button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            itemRowsHtml = '<div style="color:#666;padding:20px;text-align:center;">No items yet. Add items you\'re looking for!</div>';
        }

        const modal = document.createElement('div');
        modal.className = 'profile-modal';
        modal.innerHTML = `
            <div class="profile-modal-content profile-editor-wide" id="profile-modal-content">
                <div class="profile-modal-header">
                    <div style="font-size:18px;font-weight:700;color:#fff;">${profile ? '✏️ Edit Profile' : '➕ Setup Profile'}</div>
                    <button class="profile-modal-close">✕</button>
                </div>
                <div class="profile-modal-body">
                    <!-- Basic Info -->
                    <div class="edit-section-title">📝 Basic Info</div>
                    <div class="edit-profile-grid">
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Discord Handle</label>
                            <input type="text" id="edit-discord" class="edit-profile-input" placeholder="YourName#1234 or @username" value="${discordValue}">
                        </div>
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Status</label>
                            <div class="hold-toggle">
                                <input type="checkbox" id="edit-on-hold" ${isOnHold ? 'checked' : ''}>
                                <label for="edit-on-hold">⏸️ On Hold (not actively buying)</label>
                            </div>
                        </div>
                    </div>

                    <div class="edit-profile-section">
                        <label class="edit-profile-label">Bio / Description</label>
                        <textarea id="edit-bio" class="edit-profile-textarea" placeholder="Tell traders about yourself, what you're collecting, trade preferences, etc...">${bioValue}</textarea>
                    </div>

                    <!-- Customization -->
                    <div class="edit-section-title">🎨 Profile Customization</div>
                    <div class="edit-profile-grid cols-2">
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Background Color</label>
                            <div class="color-input-wrap">
                                <input type="color" id="edit-bg-color" value="${bgColor}">
                                <input type="text" id="edit-bg-color-text" class="edit-profile-input" value="${bgColor}" placeholder="#18181b">
                            </div>
                        </div>
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Accent Color</label>
                            <div class="color-input-wrap">
                                <input type="color" id="edit-accent-color" value="${accentColor}">
                                <input type="text" id="edit-accent-color-text" class="edit-profile-input" value="${accentColor}" placeholder="#8b5cf6">
                            </div>
                        </div>
                    </div>
                    <div class="edit-profile-grid cols-2">
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Gradient Start <span class="optional-label">(optional)</span></label>
                            <div class="color-input-wrap">
                                <input type="color" id="edit-gradient-start" value="${gradientStart || '#8b5cf6'}" ${!gradientStart ? 'disabled' : ''}>
                                <input type="text" id="edit-gradient-start-text" class="edit-profile-input" value="${gradientStart}" placeholder="None">
                                <button type="button" class="color-clear-btn" id="clear-gradient-start" title="${gradientStart ? 'Clear' : 'Enable'}">
                                    ${gradientStart ? '✕' : '+'}
                                </button>
                            </div>
                        </div>
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Gradient End <span class="optional-label">(optional)</span></label>
                            <div class="color-input-wrap">
                                <input type="color" id="edit-gradient-end" value="${gradientEnd || '#10b981'}" ${!gradientEnd ? 'disabled' : ''}>
                                <input type="text" id="edit-gradient-end-text" class="edit-profile-input" value="${gradientEnd}" placeholder="None">
                                <button type="button" class="color-clear-btn" id="clear-gradient-end" title="${gradientEnd ? 'Clear' : 'Enable'}">
                                    ${gradientEnd ? '✕' : '+'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style="font-size:10px;color:#666;margin-bottom:15px;">Tip: Set both gradient colors to create a gradient background. Leave empty to use solid background color.</div>

                    <div class="edit-profile-grid">
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Profile Picture</label>
                            <div class="profile-pic-editor">
                                <div class="profile-pic-preview" id="profile-pic-preview">
                                    ${profilePictureUrl ? `<img src="${profilePictureUrl}" onerror="this.style.display='none'">` : '<span>?</span>'}
                                </div>
                                <div class="profile-pic-controls">
                                    <input type="text" id="edit-profile-picture" class="edit-profile-input" placeholder="Image URL or sync from game" value="${profilePictureUrl}">
                                    <button type="button" id="sync-profile-pic-btn" class="zsb-btn secondary" style="white-space:nowrap;">🔄 Sync from Game</button>
                                </div>
                            </div>
                            <div style="font-size:10px;color:#666;margin-top:4px;">
                                ${ccoImageFetched ? '<span style="color:var(--z-accent);">✓ Auto-synced from your in-game profile.</span> ' : ''}
                                Click "Sync from Game" to update, or paste a custom URL.
                            </div>
                        </div>
                        <div class="edit-profile-section">
                            <label class="edit-profile-label">Background Image URL</label>
                            <input type="text" id="edit-bg-image" class="edit-profile-input" placeholder="https://i.imgur.com/example.jpg" value="${bgImageUrl}">
                            <div style="font-size:10px;color:#666;margin-top:4px;">Shows behind a dark overlay on your profile.</div>
                        </div>
                    </div>

                    <button id="reset-colors-btn" type="button" class="zsb-btn secondary" style="width:100%;margin-bottom:10px;">🔄 Reset Colors to Default</button>
                    <button id="save-profile-btn" class="zsb-btn" style="width:100%;margin-bottom:20px;">💾 Save Profile</button>

                    ${profile ? `
                        <div class="add-item-section">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                                <div class="profile-items-title" style="margin-bottom:0;">🎯 Your Wishlist (${items.length} items)</div>
                                ${items.length > 0 ? `<button id="toggle-edit-mode-btn" class="zsb-btn secondary" style="padding:6px 12px;font-size:11px;">✏️ Edit All</button>` : ''}
                            </div>

                            <!-- Bulk Edit Controls (hidden by default) -->
                            <div id="bulk-edit-controls" class="bulk-edit-controls" style="display:none;">
                                <div class="bulk-edit-header">
                                    <div class="bulk-edit-select-all">
                                        <input type="checkbox" id="select-all-cb"> <label for="select-all-cb">Select All</label>
                                    </div>
                                    <div class="bulk-edit-count"><span id="bulk-selected-count">0</span> selected</div>
                                </div>
                                <div class="bulk-edit-actions">
                                    <input type="text" id="bulk-edit-price" class="zsb-input" placeholder="New price for selected" style="flex:1;">
                                    <button id="bulk-update-btn" class="zsb-btn secondary" disabled>Update Price</button>
                                    <button id="bulk-delete-btn" class="zsb-btn danger" disabled>Delete</button>
                                </div>
                            </div>

                            <div id="item-picker-section">
                                <div style="display:flex;gap:8px;margin-bottom:10px;">
                                    <input type="text" id="item-picker-search" class="zsb-input" placeholder="Search items to add..." style="flex:1;">
                                    <button id="toggle-picker-btn" class="zsb-btn secondary">➕ Add Items</button>
                                </div>

                                <div id="item-picker-container" class="item-picker-container" style="display:none;">
                                    <div class="item-picker-header">
                                        <div class="item-picker-selected-count"><span id="selected-count">0</span> selected</div>
                                        <div style="display:flex;gap:8px;align-items:center;">
                                            <input type="text" id="bulk-price-input" class="zsb-input" placeholder="Price (optional)" style="width:120px;font-size:11px;">
                                            <button id="add-selected-btn" class="zsb-btn" disabled>Add Selected</button>
                                        </div>
                                    </div>
                                    <div id="item-picker-grid" class="item-picker-grid">
                                        <div style="grid-column:1/-1;text-align:center;padding:30px;color:#666;">Type to search for items...</div>
                                    </div>
                                </div>
                            </div>

                            <div class="profile-items-list" id="my-items-list">
                                ${itemRowsHtml}
                            </div>
                        </div>
                    ` : `
                        <div style="color:#888;font-size:12px;text-align:center;padding:20px;background:rgba(255,255,255,0.03);border-radius:8px;">
                            Save your profile first, then you can add items to your wishlist.
                        </div>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Track selected items
        const selectedItems = new Set();
        const selectedForEdit = new Set();
        let editModeActive = false;

        // Setup item picker if profile exists
        if (profile) {
            const searchInput = modal.querySelector('#item-picker-search');
            const pickerContainer = modal.querySelector('#item-picker-container');
            const pickerGrid = modal.querySelector('#item-picker-grid');
            const toggleBtn = modal.querySelector('#toggle-picker-btn');
            const addSelectedBtn = modal.querySelector('#add-selected-btn');
            const selectedCountEl = modal.querySelector('#selected-count');
            const modalContent = modal.querySelector('#profile-modal-content');

            // Bulk edit elements
            const toggleEditModeBtn = modal.querySelector('#toggle-edit-mode-btn');
            const bulkEditControls = modal.querySelector('#bulk-edit-controls');
            const selectAllCb = modal.querySelector('#select-all-cb');
            const bulkSelectedCountEl = modal.querySelector('#bulk-selected-count');
            const bulkUpdateBtn = modal.querySelector('#bulk-update-btn');
            const bulkDeleteBtn = modal.querySelector('#bulk-delete-btn');
            const itemCheckboxes = modal.querySelectorAll('.profile-item-checkbox');
            const itemActions = modal.querySelectorAll('.profile-item-actions');

            // Get existing item names for filtering
            const existingItems = new Set(items.map(i => i.game_item_id));

            // Toggle Edit Mode
            if (toggleEditModeBtn) {
                toggleEditModeBtn.onclick = () => {
                    editModeActive = !editModeActive;

                    if (editModeActive) {
                        toggleEditModeBtn.textContent = '✕ Cancel';
                        toggleEditModeBtn.classList.add('danger');
                        bulkEditControls.style.display = 'block';
                        itemCheckboxes.forEach(cb => cb.style.display = 'flex');
                        itemActions.forEach(a => a.style.display = 'none');
                    } else {
                        toggleEditModeBtn.textContent = '✏️ Edit All';
                        toggleEditModeBtn.classList.remove('danger');
                        bulkEditControls.style.display = 'none';
                        itemCheckboxes.forEach(cb => {
                            cb.style.display = 'none';
                            cb.querySelector('input').checked = false;
                        });
                        itemActions.forEach(a => a.style.display = 'flex');
                        selectedForEdit.clear();
                        if (selectAllCb) selectAllCb.checked = false;
                        updateBulkEditCount();
                    }
                };
            }

            const updateBulkEditCount = () => {
                if (bulkSelectedCountEl) {
                    bulkSelectedCountEl.textContent = selectedForEdit.size;
                    if (bulkUpdateBtn) bulkUpdateBtn.disabled = selectedForEdit.size === 0;
                    if (bulkDeleteBtn) bulkDeleteBtn.disabled = selectedForEdit.size === 0;
                }
            };

            // Select All checkbox
            if (selectAllCb) {
                selectAllCb.onchange = () => {
                    const checkboxes = modal.querySelectorAll('.item-select-cb');
                    checkboxes.forEach(cb => {
                        cb.checked = selectAllCb.checked;
                        const row = cb.closest('.profile-item-row');
                        const itemId = row.dataset.itemId;
                        if (selectAllCb.checked) {
                            selectedForEdit.add(itemId);
                        } else {
                            selectedForEdit.delete(itemId);
                        }
                    });
                    updateBulkEditCount();
                };
            }

            // Individual checkboxes
            modal.querySelectorAll('.item-select-cb').forEach(cb => {
                cb.onchange = () => {
                    const row = cb.closest('.profile-item-row');
                    const itemId = row.dataset.itemId;
                    if (cb.checked) {
                        selectedForEdit.add(itemId);
                    } else {
                        selectedForEdit.delete(itemId);
                        if (selectAllCb) selectAllCb.checked = false;
                    }
                    updateBulkEditCount();
                };
            });

            // Bulk Update Price
            if (bulkUpdateBtn) {
                bulkUpdateBtn.onclick = async () => {
                    if (selectedForEdit.size === 0) return;

                    const newPrice = parseMoney(modal.querySelector('#bulk-edit-price').value);
                    bulkUpdateBtn.disabled = true;
                    bulkUpdateBtn.textContent = 'Updating...';

                    for (const itemId of selectedForEdit) {
                        const row = modal.querySelector(`[data-item-id="${itemId}"]`);
                        if (row) {
                            const itemName = row.dataset.itemName;
                            try {
                                await apiCall('/collectors/items/add', 'POST', {
                                    cco_id: STATE.user.id,
                                    game_item_id: itemName,
                                    collector_price: newPrice
                                });
                            } catch (e) {
                                console.error(`Failed to update ${itemName}:`, e);
                            }
                        }
                    }

                    await fetchMyProfile();
                    modal.remove();
                    await showProfileEditor(container);
                };
            }

            // Bulk Delete
            if (bulkDeleteBtn) {
                bulkDeleteBtn.onclick = async () => {
                    if (selectedForEdit.size === 0) return;

                    if (!confirm(`Delete ${selectedForEdit.size} item(s) from your wishlist?`)) return;

                    bulkDeleteBtn.disabled = true;
                    bulkDeleteBtn.textContent = 'Deleting...';

                    for (const itemId of selectedForEdit) {
                        try {
                            await apiCall('/collectors/items/remove', 'POST', {
                                cco_id: STATE.user.id,
                                item_id: itemId
                            });
                        } catch (e) {
                            console.error(`Failed to delete item ${itemId}:`, e);
                        }
                    }

                    await fetchMyProfile();
                    modal.remove();
                    await showProfileEditor(container);
                };
            }

            toggleBtn.onclick = () => {
                const isOpen = pickerContainer.style.display !== 'none';
                if (isOpen) {
                    pickerContainer.style.display = 'none';
                    modalContent.classList.remove('expanded');
                    toggleBtn.textContent = '➕ Add Items';
                } else {
                    pickerContainer.style.display = 'block';
                    modalContent.classList.add('expanded');
                    toggleBtn.textContent = '✕ Close';
                    searchInput.focus();
                }
            };

            const updateSelectedCount = () => {
                selectedCountEl.textContent = selectedItems.size;
                addSelectedBtn.disabled = selectedItems.size === 0;
            };

            const renderItemTiles = (searchTerm) => {
                if (!searchTerm || searchTerm.length < 2) {
                    pickerGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#666;">Type at least 2 characters to search...</div>';
                    return;
                }

                const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
                const matchingItems = STATE.knownItems.filter(itemName => {
                    if (existingItems.has(itemName)) return false;
                    const lower = itemName.toLowerCase();
                    return keywords.every(k => lower.includes(k));
                }).slice(0, 50);

                if (matchingItems.length === 0) {
                    pickerGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#666;">No items found</div>';
                    return;
                }

                pickerGrid.innerHTML = matchingItems.map(itemName => {
                    const { displayName, wear, isSt, cleanId } = parseItemDisplay(itemName);
                    const marketPrice = STATE.prices[itemName] || 0;

                    let imgHtml = `<div class="picker-tile-img-placeholder">?</div>`;
                    if (STATE.patternImages[cleanId]) {
                        imgHtml = `<img src="${STATE.patternImages[cleanId]}" class="picker-tile-img">`;
                    }

                    const isSelected = selectedItems.has(itemName);

                    return `
                        <div class="picker-tile ${isSt ? 'is-st' : ''} ${isSelected ? 'selected' : ''}" data-item-name="${itemName}">
                            <div class="picker-tile-check">${isSelected ? '✓' : ''}</div>
                            ${isSt ? '<div class="picker-tile-st">ST</div>' : ''}
                            ${imgHtml}
                            <div class="picker-tile-name" title="${itemName}">${displayName}</div>
                            <div class="picker-tile-wear">${wear}</div>
                            <div class="picker-tile-price">${marketPrice > 0 ? formatPrice(marketPrice) : '???'}</div>
                        </div>
                    `;
                }).join('');

                pickerGrid.querySelectorAll('.picker-tile').forEach(tile => {
                    tile.onclick = () => {
                        const itemName = tile.dataset.itemName;
                        if (selectedItems.has(itemName)) {
                            selectedItems.delete(itemName);
                            tile.classList.remove('selected');
                            tile.querySelector('.picker-tile-check').textContent = '';
                        } else {
                            selectedItems.add(itemName);
                            tile.classList.add('selected');
                            tile.querySelector('.picker-tile-check').textContent = '✓';
                        }
                        updateSelectedCount();
                    };
                });
            };

            let searchTimeout;
            searchInput.oninput = () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    renderItemTiles(searchInput.value);
                }, 200);
            };

            addSelectedBtn.onclick = async () => {
                if (selectedItems.size === 0) return;

                const bulkPrice = parseMoney(modal.querySelector('#bulk-price-input').value);
                addSelectedBtn.disabled = true;
                addSelectedBtn.textContent = 'Adding...';

                for (const itemName of selectedItems) {
                    try {
                        await apiCall('/collectors/items/add', 'POST', {
                            cco_id: STATE.user.id,
                            game_item_id: itemName,
                            collector_price: bulkPrice
                        });
                    } catch (e) {
                        console.error(`Failed to add ${itemName}:`, e);
                    }
                }

                await fetchMyProfile();
                modal.remove();
                await showProfileEditor(container);
            };

            // Edit price handlers
            modal.querySelectorAll('.profile-item-edit').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const row = btn.closest('.profile-item-row');
                    const itemName = row.dataset.itemName;
                    const currentPrice = row.dataset.itemPrice;

                    const newPrice = prompt(`Set your price for:\n${itemName}\n\nCurrent: ${currentPrice > 0 ? '$' + parseInt(currentPrice).toLocaleString() : 'Any'}\n\nEnter new price (or leave blank for "Any"):`, currentPrice > 0 ? currentPrice : '');

                    if (newPrice !== null) {
                        const price = parseMoney(newPrice);
                        const success = await addItemToProfile(itemName, price);
                        if (success) {
                            modal.remove();
                            await showProfileEditor(container);
                        }
                    }
                };
            });

            // Remove item handlers
            modal.querySelectorAll('.profile-item-remove').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const row = btn.closest('.profile-item-row');
                    const itemId = row.dataset.itemId;
                    if (confirm("Remove this item from your wishlist?")) {
                        await removeItemFromProfile(itemId);
                        modal.remove();
                        await showProfileEditor(container);
                    }
                };
            });
        }

        // Save profile handler
        // Color picker sync
        const syncColorInputs = (colorId, textId) => {
            const colorInput = modal.querySelector(`#${colorId}`);
            const textInput = modal.querySelector(`#${textId}`);
            if (colorInput && textInput) {
                colorInput.oninput = () => { if (!colorInput.disabled) textInput.value = colorInput.value; };
                textInput.oninput = () => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(textInput.value)) {
                        colorInput.value = textInput.value;
                        colorInput.disabled = false;
                    }
                };
            }
        };
        syncColorInputs('edit-bg-color', 'edit-bg-color-text');
        syncColorInputs('edit-accent-color', 'edit-accent-color-text');
        syncColorInputs('edit-gradient-start', 'edit-gradient-start-text');
        syncColorInputs('edit-gradient-end', 'edit-gradient-end-text');

        // Clear/Enable buttons for optional color fields
        const setupClearBtn = (btnId, colorId, textId) => {
            const btn = modal.querySelector(`#${btnId}`);
            const colorInput = modal.querySelector(`#${colorId}`);
            const textInput = modal.querySelector(`#${textId}`);
            if (btn && colorInput && textInput) {
                btn.onclick = () => {
                    if (textInput.value) {
                        // Clear it
                        textInput.value = '';
                        colorInput.disabled = true;
                        btn.textContent = '+';
                        btn.title = 'Enable';
                    } else {
                        // Enable it
                        colorInput.disabled = false;
                        textInput.value = colorInput.value;
                        btn.textContent = '✕';
                        btn.title = 'Clear';
                    }
                };
            }
        };
        setupClearBtn('clear-gradient-start', 'edit-gradient-start', 'edit-gradient-start-text');
        setupClearBtn('clear-gradient-end', 'edit-gradient-end', 'edit-gradient-end-text');

        // Reset colors to default
        const resetColorsBtn = modal.querySelector('#reset-colors-btn');
        if (resetColorsBtn) {
            resetColorsBtn.onclick = () => {
                // Reset background color
                modal.querySelector('#edit-bg-color').value = '#18181b';
                modal.querySelector('#edit-bg-color-text').value = '#18181b';

                // Reset accent color
                modal.querySelector('#edit-accent-color').value = '#8b5cf6';
                modal.querySelector('#edit-accent-color-text').value = '#8b5cf6';

                // Clear gradients
                modal.querySelector('#edit-gradient-start').disabled = true;
                modal.querySelector('#edit-gradient-start-text').value = '';
                modal.querySelector('#clear-gradient-start').textContent = '+';

                modal.querySelector('#edit-gradient-end').disabled = true;
                modal.querySelector('#edit-gradient-end-text').value = '';
                modal.querySelector('#clear-gradient-end').textContent = '+';

                // Clear background image
                modal.querySelector('#edit-bg-image').value = '';
            };
        }

        // Sync profile picture from game
        const syncPicBtn = modal.querySelector('#sync-profile-pic-btn');
        const profilePicInput = modal.querySelector('#edit-profile-picture');
        const profilePicPreview = modal.querySelector('#profile-pic-preview');

        const updatePicPreview = (url) => {
            if (url) {
                profilePicPreview.innerHTML = `<img src="${url}" onerror="this.parentElement.innerHTML='<span>?</span>'">`;
            } else {
                profilePicPreview.innerHTML = '<span>?</span>';
            }
        };

        // Update preview on input change
        if (profilePicInput) {
            profilePicInput.oninput = () => updatePicPreview(profilePicInput.value.trim());
        }

        if (syncPicBtn) {
            syncPicBtn.onclick = async () => {
                syncPicBtn.disabled = true;
                syncPicBtn.textContent = '⏳ Syncing...';

                const ccoImage = await fetchCCOProfileImage(STATE.user.id);

                if (ccoImage) {
                    profilePicInput.value = ccoImage;
                    updatePicPreview(ccoImage);
                    syncPicBtn.textContent = '✓ Synced!';
                    setTimeout(() => {
                        syncPicBtn.textContent = '🔄 Sync from Game';
                        syncPicBtn.disabled = false;
                    }, 1500);
                } else {
                    syncPicBtn.textContent = '✕ Failed';
                    setTimeout(() => {
                        syncPicBtn.textContent = '🔄 Sync from Game';
                        syncPicBtn.disabled = false;
                    }, 1500);
                }
            };
        }

        modal.querySelector('#save-profile-btn').onclick = async () => {
            const profileData = {
                discord_handle: modal.querySelector('#edit-discord').value.trim(),
                bio: modal.querySelector('#edit-bio')?.value.trim() || null,
                bg_color: modal.querySelector('#edit-bg-color-text')?.value.trim() || '#18181b',
                accent_color: modal.querySelector('#edit-accent-color-text')?.value.trim() || '#8b5cf6',
                gradient_start: modal.querySelector('#edit-gradient-start-text')?.value.trim() || null,
                gradient_end: modal.querySelector('#edit-gradient-end-text')?.value.trim() || null,
                bg_image_url: modal.querySelector('#edit-bg-image')?.value.trim() || null,
                profile_picture_url: modal.querySelector('#edit-profile-picture')?.value.trim() || null,
                is_on_hold: modal.querySelector('#edit-on-hold')?.checked ? 1 : 0
            };

            const success = await saveProfile(profileData);
            if (success) {
                modal.remove();
                if (!profile) {
                    await showProfileEditor(container);
                } else {
                    renderCollectorsTab(container);
                }
            }
        };

        modal.querySelector('.profile-modal-close').onclick = () => {
            modal.remove();
            STATE.collectors.editMode = false;
            renderCollectorsTab(container);
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                STATE.collectors.editMode = false;
                renderCollectorsTab(container);
            }
        };
    }

    // =========================================================================
    // 12. MARKET LIST
    // =========================================================================
    function updateMarketList() {
        const list = document.getElementById('market-list');
        if (!list) return;
        list.innerHTML = "";
        const f = STATE.marketFilter;
        Object.entries(STATE.prices).sort((a, b) => b[1] - a[1]).forEach(([id, p]) => {
            if (!isMatch(id, f)) return;
            const r = document.createElement('div');

            let displayName = id;
            let wear = "";
            let isSt = false;

            if (displayName.includes("StatTrak™") || displayName.includes("★ StatTrak™")) {
                isSt = true;
                displayName = displayName.replace("StatTrak™", "").replace("★", "").trim();
            } else if (displayName.includes("Souvenir")) {
                displayName = displayName.replace("Souvenir", "").trim();
            }
            displayName = displayName.replace(/^★\s?/, "");

            const wearMatch = displayName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
            if (wearMatch) {
                wear = wearMatch[1];
                displayName = displayName.replace(wearMatch[0], "").trim();
            }

            let cleanId = displayName.trim();
            if (cleanId.includes("'")) cleanId = cleanId.replace(/'([^']+)'/g, '($1)');

            let imgTag = `<div style="width:100px;height:80px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:8px;color:#333;font-size:20px;">?</div>`;
            if (STATE.patternImages[cleanId]) {
                imgTag = `<img src="${STATE.patternImages[cleanId]}" class="market-img" onerror="this.style.display='none'">`;
            }

            let voteHtml = '';
            const vData = STATE.voteData[id];
            if (vData && vData.count > 0) {
                let historyHtml = '';
                if(vData.history && vData.history.length > 0) {
                    historyHtml = `<span class="zsb-tooltip-title">History</span>` + vData.history.map(v => `<span class="zsb-history-item">$${formatMoney(v)}</span>`).join('');
                }
                voteHtml = `<span class="zsb-vote-count">(${vData.count})<div class="zsb-vote-tooltip">${historyHtml}</div></span>`;
            }

            r.className = `market-card ${isSt ? 'is-st' : ''}`;
            let stBadge = isSt ? `<div class="st-badge">ST</div>` : '';

            r.innerHTML = `
                ${stBadge}
                ${imgTag}
                <div class="market-name" title="${id}">${displayName}</div>
                <div class="market-wear">${wear}</div>
                <div class="market-price">${formatPrice(p)} ${voteHtml}</div>
                <button class="zsb-btn secondary" style="width:100%;justify-content:center;font-size:10px;padding:4px;">VOTE</button>
            `;

            r.querySelector('button').onclick = () => { const pr = prompt(`Vote: ${id}`, p); if (pr) submitVote(id, pr); };
            list.appendChild(r);
        });
    }

    document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.code==='Space'){e.preventDefault();const r=document.getElementById('zsb-root');if(r){r.classList.toggle('visible');if(r.classList.contains('visible'))fetchPrices();}}});

    // --- STARTUP LOGIC ---
    syncDatabase();
    fetchPrices();

    setInterval(()=>{if(!document.hidden)fetchPrices();}, REFRESH_RATE);
    new MutationObserver(()=>scanAndInject()).observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{if(STATE.overlayEnabled) { scanAndInject(); injectTradeHeaders(); }}, 1000);

    const w = setInterval(()=>{
        if(document.body){
            clearInterval(w);
            initUI();
            initTradeFromDOM();
            fetchPatternImages();
        }
    }, 200);

})();