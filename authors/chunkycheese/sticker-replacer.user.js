// ==UserScript==
// @name         Sticker Replacer Manager
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Replace sticker images/cards and add sticker value to item cards
// @author       chunkycheese
// @match        https://case-clicker.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      csgoskins.gg
// ==/UserScript==

(function () {
    'use strict';

    const STICKERS_API_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json';
    const RULES_STORAGE_KEY = 'cc_sticker_replace_rules_v1';
    const API_CACHE_STORAGE_KEY = 'cc_sticker_api_cache_v3';
    const PRICE_CACHE_STORAGE_KEY = 'cc_sticker_price_cache_v1';

    const API_CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000;
    const PRICE_CACHE_RESET_MS = 30 * 24 * 60 * 60 * 1000;

    const ALT_PREFIX = 'Sticker | ';
    const REPLACEMENT_PREFIX = 'Sticker | ';

    let stickerApiMap = null;
    let stickerNameList = [];
    let observer = null;
    let editingIndex = -1;
    let ruleSearch = '';
    let replacementFetchTimer = null;
    let replacementFetchToken = 0;
    let backfillInProgress = false;
    let autocompleteTimers = {};

    const c = {
        def: "#ded6cc",
        blue: "#4b69ff",
        purp: "#8847ff",
        pink: "#d32ce6",
        red: "#eb4b4b",
        contra: "#e4ae39"
    };

    const CUSTOM_STICKERS = [
        {
            name: 'Sticker | mousesports | DreamHack 2014',
            image: 'https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL3N0aWNrZXJzL2RodzIwMTQvbW91c2VzcG9ydHMuYzM0NGQ3YWQ1MzM4ZjA3N2FmMTkyM2VmY2U1Zjc4ZmQ4ZGUzMDEzYi5wbmc-/auto/auto/85/notrim/b8c58bd58ca63932b2a4a2536304deda.webp',
            color: c.blue
        },
        {
            name: 'Sticker | London Conspiracy | DreamHack 2014',
            image: 'https://cdn.csgoskins.gg/public/uih/items/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL3N0aWNrZXJzL2RodzIwMTQvbG9uZG9uY29uc3BpcmFjeS4zOWI2YmUwYTFmMTYwNWVmYzEwMzk3NTYzNmIwNjQyOTA3MTVmZmY1LnBuZw--/auto/auto/85/notrim/74f76e8b4f2e274b4cefbb5851fbf3d7.webp',
            color: c.blue
        },
        {
            name: 'Sticker | 3DMAX | DreamHack 2014',
            image: 'https://cdn.csgoskins.gg/public/uih/items/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL3N0aWNrZXJzL2RodzIwMTQvM2RtYXguZmExMWUzOTE0MDIwMGYzYzQ0MWZjN2UwZmIwYjljZTg5MzkxODE2OS5wbmc-/auto/auto/85/notrim/474aa56490d6b8a81898dda953a59e2a.webp',
            color: c.blue
        },
        {
            name: 'Sticker | dAT team | DreamHack 2014',
            image: 'https://cdn.csgoskins.gg/public/uih/items/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL3N0aWNrZXJzL2RodzIwMTQvZGF0dGVhbS5kMmE2NTZhN2QwOWMxNGE0YTZlNjdlNTI0YWVkMGMzZDE5NGMyMGZiLnBuZw--/auto/auto/85/notrim/015de8a8b8a78f8ad88597617d96bd42.webp',
            color: c.blue
        },
        {
            name: 'Sticker | Titan | DreamHack 2014',
            image: 'https://static.wikia.nocookie.net/cswikia/images/d/d7/Csgo-dreamhack2014-titan_large.png/revision/latest?cb=20141121132308',
            color: c.blue
        },
        {
            name: 'Sticker | Epsilon eSports | DreamHack 2014',
            image: 'https://static.wikia.nocookie.net/cswikia/images/2/24/Csgo-dreamhack2014-epsilonesports_large.png/revision/latest?cb=20141121132004',
            color: c.blue
        },
        {
            name: 'Sticker | Epsilon eSports (Holo) | DreamHack 2014',
            image: 'https://static.wikia.nocookie.net/cswikia/images/a/a8/Csgo-dreamhack2014-epsilonesports_holo_large.png/revision/latest/scale-to-width-down/250?cb=20141121131057',
            color: c.purp
        },
        {
            name: 'Sticker | Epsilon eSports (Foil) | DreamHack 2014',
            image: 'https://static.wikia.nocookie.net/cswikia/images/6/6f/Csgo-dreamhack2014-epsilonesports_foil_large.png/revision/latest/scale-to-width-down/250?cb=20141121131049',
            color: c.pink
        }
    ];

    function formatPrice(value) {
        const num = Number(value) || 0;
        return '$' + num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function parsePrice(text) {
        if (!text) return 0;
        const cleaned = String(text).replace(/[^0-9.]/g, '');
        const value = parseFloat(cleaned);
        return Number.isFinite(value) ? value : 0;
    }

    function normalizeName(name) {
        return String(name || '').trim();
    }

    function collapseSpaces(text) {
        return String(text || '').replace(/\s{2,}/g, ' ').trim();
    }

    function withPrefix(value, prefix) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        return trimmed.startsWith(prefix) ? trimmed : prefix + trimmed;
    }

    function stripPrefix(value, prefix) {
        const trimmed = String(value || '').trim();
        return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
    }

    function loadRules() {
        try {
            const raw = localStorage.getItem(RULES_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveRules(rules) {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    }

    function exportRules() {
        const rules = loadRules();
        const json = JSON.stringify(rules, null, 2);

        navigator.clipboard.writeText(json).then(() => {
            setStatus('Rules copied to clipboard.');
        }).catch(() => {
            prompt('Copy your rules JSON:', json);
            setStatus('Clipboard failed, opened copy dialog instead.');
        });
    }

    async function importRules() {
        const input = prompt('Paste exported rules JSON here:');
        if (!input) {
            setStatus('Import cancelled.');
            return;
        }

        try {
            const parsed = JSON.parse(input);

            if (!Array.isArray(parsed)) {
                setStatus('Import failed: JSON must be an array of rules.', true);
                return;
            }

            const existing = loadRules();
            const merged = [...existing];

            for (const rule of parsed) {
                if (
                    !rule ||
                    typeof rule !== 'object' ||
                    typeof rule.matchAlt !== 'string' ||
                    typeof rule.replacementName !== 'string'
                ) {
                    continue;
                }

                const cleanedRule = {
                    matchAlt: withPrefix(collapseSpaces(rule.matchAlt), ALT_PREFIX),
                    replacementName: withPrefix(rule.replacementName, REPLACEMENT_PREFIX),
                    price: Number(rule.price) || 0
                };

                const index = merged.findIndex(r => r.matchAlt === cleanedRule.matchAlt);
                if (index >= 0) {
                    merged[index] = cleanedRule;
                } else {
                    merged.push(cleanedRule);
                }
            }

            saveRules(merged);
            clearForm();
            renderRulesList();
            refreshAll();
            setStatus(`Import complete. You now have ${merged.length} rule${merged.length === 1 ? '' : 's'}.`);

            await backfillMissingRulePrices();
        } catch {
            setStatus('Import failed: invalid JSON.', true);
        }
    }

    function deleteAllRules() {
        const rules = loadRules();
        if (rules.length === 0) {
            setStatus('No rules to delete.');
            return;
        }

        const confirmed = confirm(`Delete all ${rules.length} rule${rules.length === 1 ? '' : 's'}? This cannot be undone.`);
        if (!confirmed) {
            setStatus('Delete all cancelled.');
            return;
        }

        saveRules([]);
        clearForm();
        ruleSearch = '';
        const searchEl = document.getElementById('sr-search');
        if (searchEl) {
            searchEl.value = '';
        }
        renderRulesList();
        refreshAll();
        setStatus('All rules deleted.');
    }

    function getRuleByAlt(alt) {
        const normalizedAlt = String(alt || '').trim();
        return loadRules().find(rule => rule.matchAlt === normalizedAlt) || null;
    }

    function parseStickerDisplay(name) {
        const parts = String(name || '')
            .split('|')
            .map(part => part.trim())
            .filter(Boolean);

        if (parts.length === 2) {
            return {
                top: 'Sticker',
                bottom: parts[1]
            };
        }

        if (parts.length >= 3) {
            return {
                top: parts[1],
                bottom: parts.slice(2).join(' | ')
            };
        }

        return {
            top: 'Sticker',
            bottom: String(name || '').trim()
        };
    }

    function getTextEls(card) {
        return Array.from(card.querySelectorAll('p[data-truncate="end"]'));
    }

    function getCard(img) {
        return img.closest('.mantine-Card-root') || img.closest('[class*="Card-root"]');
    }

    function isStickerCard(card, img) {
        const parsed = parseStickerDisplay(img.alt);
        return getTextEls(card).some(el => {
            const text = el.textContent.trim();
            return text === parsed.top || text === 'Sticker';
        });
    }

    function getCachedApiData() {
        try {
            const raw = localStorage.getItem(API_CACHE_STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.ts || !parsed.map) return null;
            if (Date.now() - parsed.ts > API_CACHE_TTL_MS) return null;

            return parsed.map;
        } catch {
            return null;
        }
    }

    function setCachedApiData(map) {
        try {
            localStorage.setItem(API_CACHE_STORAGE_KEY, JSON.stringify({
                ts: Date.now(),
                map
            }));
        } catch {}
    }

    function loadPriceCache() {
        try {
            const raw = localStorage.getItem(PRICE_CACHE_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;

            if (!parsed || typeof parsed !== 'object') {
                return { prices: {} };
            }

            if (!parsed.prices || typeof parsed.prices !== 'object') {
                parsed.prices = {};
            }

            return parsed;
        } catch {
            const fallback = { prices: {} };
            savePriceCache(fallback);
            return fallback;
        }
    }

    function savePriceCache(cache) {
        localStorage.setItem(PRICE_CACHE_STORAGE_KEY, JSON.stringify(cache));
    }

    function getCachedPriceEntry(replacementName) {
        const cache = loadPriceCache();
        return cache.prices[replacementName] || null;
    }

    function getCachedPrice(replacementName) {
        const entry = getCachedPriceEntry(replacementName);
        if (!entry) return null;
        return Number.isFinite(Number(entry.price)) ? Number(entry.price) : null;
    }

    function setCachedPrice(replacementName, price) {
        const cache = loadPriceCache();
        cache.prices[replacementName] = {
            price: Number(price) || 0,
            ts: Date.now()
        };
        savePriceCache(cache);
    }

    function isPriceCacheStale(replacementName) {
        const entry = getCachedPriceEntry(replacementName);
        if (!entry || !entry.ts) return true;
        return Date.now() - entry.ts > PRICE_CACHE_RESET_MS;
    }

    function fetchStickerApiMap() {
        return new Promise(resolve => {
            const cached = getCachedApiData();
            if (cached) {
                resolve(cached);
                return;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: STICKERS_API_URL,
                onload(response) {
                    try {
                        const stickers = JSON.parse(response.responseText);
                        const map = {};

                        for (const sticker of stickers) {
                            if (!sticker?.name || !sticker?.image) continue;

                            map[normalizeName(sticker.name)] = {
                                name: sticker.name,
                                image: sticker.image,
                                color: sticker?.rarity?.color || null
                            };
                        }

                        for (const sticker of CUSTOM_STICKERS) {
                            if (!sticker?.name || !sticker?.image) continue;

                            map[normalizeName(sticker.name)] = {
                                name: sticker.name,
                                image: sticker.image,
                                color: sticker.color || null
                            };
                        }

                        setCachedApiData(map);
                        resolve(map);
                    } catch (error) {
                        console.error('Failed to parse sticker API:', error);
                        resolve({});
                    }
                },
                onerror(error) {
                    console.error('Failed to fetch sticker API:', error);
                    resolve({});
                }
            });
        });
    }

    function rebuildStickerNameList() {
        stickerNameList = Object.keys(stickerApiMap || {});
    }

    function getReplacementData(replacementName) {
        if (!stickerApiMap) return null;
        return stickerApiMap[replacementName] || null;
    }

    function buildPriceLookupUrl(replacementName) {
        let slug = stripPrefix(replacementName, REPLACEMENT_PREFIX);

        slug = slug.replace(/[()]/g, '');
        slug = slug.replace(/\./g, '');
        slug = slug.replace(/\s{2,}\|\s*/g, ' -2- ');
        slug = slug.replace(/\s*\|\s*/g, ' ');
        slug = slug.toLowerCase();
        slug = slug.replace(/[^a-z0-9]+/g, '-');
        slug = slug.replace(/-+/g, '-');
        slug = slug.replace(/^-+|-+$/g, '');

        return `https://csgoskins.gg/items/sticker-${slug}`;
    }

    function updateRulesUsingReplacementPrice(replacementName, price, shouldRefresh = true) {
        const rules = loadRules();
        let changed = false;

        for (const rule of rules) {
            if (rule.replacementName === replacementName && Number(rule.price) !== Number(price)) {
                rule.price = Number(price) || 0;
                changed = true;
            }
        }

        if (changed) {
            saveRules(rules);
            if (shouldRefresh) {
                refreshAll();
            } else {
                renderRulesList();
            }
        }
    }

    function setDisplayedPrice(price, note = '') {
        const priceDisplay = document.getElementById('sr-price-display');
        const priceNote = document.getElementById('sr-price-note');

        if (priceDisplay) {
            priceDisplay.textContent = formatPrice(price);
        }

        if (priceNote) {
            priceNote.textContent = note;
        }
    }

    function getCurrentReplacementName() {
        const inputEl = document.getElementById('sr-replacement-name');
        if (!inputEl) return null;

        const rawInput = inputEl.value.trim();
        if (!rawInput) return null;

        const exact = withPrefix(rawInput, REPLACEMENT_PREFIX);
        if (getReplacementData(exact)) {
            return exact;
        }

        const info = findAutocompleteMatches(rawInput, false);
        if (info.total === 1 && info.matches[0]) {
            return info.matches[0];
        }

        return null;
    }

    function fetchPriceFromSite(replacementName) {
        return new Promise(resolve => {
            const url = buildPriceLookupUrl(replacementName);
            const oldEntry = getCachedPriceEntry(replacementName);
            const oldPrice = oldEntry ? Number(oldEntry.price) || 0 : 0;

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const priceEl = doc.querySelector('.version-link .font-bold');

                        if (!priceEl) {
                            resolve(oldEntry ? oldPrice : 0);
                            return;
                        }

                        const price = parsePrice(priceEl.textContent);
                        setCachedPrice(replacementName, price);
                        resolve(price);
                    } catch (error) {
                        console.error('Price parse failed:', error);
                        resolve(oldEntry ? oldPrice : 0);
                    }
                },
                onerror(error) {
                    console.error('Price request failed:', error);
                    resolve(oldEntry ? oldPrice : 0);
                }
            });
        });
    }

    async function ensurePriceForReplacement(replacementName, forceFetch = false, shouldRefreshRules = true) {
        if (!replacementName) return 0;

        const cached = getCachedPrice(replacementName);
        const stale = isPriceCacheStale(replacementName);

        if (!forceFetch && cached !== null && !stale) {
            if (shouldRefreshRules) {
                updateRulesUsingReplacementPrice(replacementName, cached, true);
            }
            return cached;
        }

        const price = await fetchPriceFromSite(replacementName);

        if (getCachedPriceEntry(replacementName) === null) {
            setCachedPrice(replacementName, price);
        } else if (forceFetch || stale) {
            setCachedPrice(replacementName, price);
        }

        if (shouldRefreshRules) {
            updateRulesUsingReplacementPrice(replacementName, price, true);
        }

        return price;
    }

    async function refreshDisplayedPrice(forceFetch = false) {
        const replacementName = getCurrentReplacementName();

        if (!replacementName) {
            setDisplayedPrice(0, 'No single replacement match yet.');
            return 0;
        }

        const cached = getCachedPrice(replacementName);
        if (!forceFetch && cached !== null) {
            setDisplayedPrice(cached, cached === 0 ? 'Cached: no price found.' : 'Cached price.');
            return cached;
        }

        setDisplayedPrice(0, 'Fetching price...');
        const price = await ensurePriceForReplacement(replacementName, forceFetch, true);
        setDisplayedPrice(price, price === 0 ? 'No price found. Stored as $0.00.' : 'Price fetched.');
        return price;
    }

    function scheduleReplacementPriceFetch(immediate = false) {
        clearTimeout(replacementFetchTimer);

        const token = ++replacementFetchToken;
        const delay = immediate ? 0 : 500;

        replacementFetchTimer = setTimeout(async () => {
            if (token !== replacementFetchToken) return;

            const inputEl = document.getElementById('sr-replacement-name');
            const input = inputEl?.value || '';
            const exact = withPrefix(input, REPLACEMENT_PREFIX);

            if (getReplacementData(exact)) {
                const cached = getCachedPrice(exact);
                if (cached !== null) {
                    setDisplayedPrice(cached, cached === 0 ? 'Cached: no price found.' : 'Cached price.');
                } else {
                    setDisplayedPrice(0, 'Fetching price...');
                    const price = await ensurePriceForReplacement(exact, false, true);
                    if (token !== replacementFetchToken) return;
                    setDisplayedPrice(price, price === 0 ? 'No price found. Stored as $0.00.' : 'Price fetched.');
                }
                return;
            }

            const info = findAutocompleteMatches(input, false);

            if (info.total !== 1 || !info.matches[0]) {
                setDisplayedPrice(0, 'No single replacement match yet.');
                return;
            }

            const singleMatch = info.matches[0];
            const price = await ensurePriceForReplacement(singleMatch, false, true);
            if (token !== replacementFetchToken) return;

            setDisplayedPrice(price, price === 0 ? 'No price found. Stored as $0.00.' : 'Price fetched.');
        }, delay);
    }

    async function backfillMissingRulePrices() {
        if (backfillInProgress) return;
        backfillInProgress = true;

        try {
            const rules = loadRules();
            const uniqueReplacementNames = [...new Set(
                rules.map(rule => rule.replacementName).filter(Boolean)
            )];

            const toUpdate = uniqueReplacementNames.filter(name => {
                const cached = getCachedPrice(name);
                return cached === null || isPriceCacheStale(name);
            });

            if (toUpdate.length === 0) {
                return;
            }

            const total = toUpdate.length;
            let completed = 0;

            setStatus(`Updating prices... 0 / ${total}`);

            for (const replacementName of toUpdate) {
                const price = await ensurePriceForReplacement(replacementName, true, false);
                updateRulesUsingReplacementPrice(replacementName, price, false);

                completed++;
                setStatus(`Updating prices... ${completed} / ${total}`);

                await new Promise(resolve => setTimeout(resolve, 150));
            }

            refreshAll();
            setStatus('All prices updated.');
        } finally {
            backfillInProgress = false;
        }
    }

    async function refreshZeroPricesOnly() {
        if (backfillInProgress) return;
        backfillInProgress = true;

        try {
            const rules = loadRules();
            const uniqueReplacementNames = [...new Set(
                rules
                    .filter(rule => Number(rule.price) === 0)
                    .map(rule => rule.replacementName)
                    .filter(Boolean)
            )];

            if (uniqueReplacementNames.length === 0) {
                setStatus('No $0.00 prices to refresh.');
                return;
            }

            const total = uniqueReplacementNames.length;
            let completed = 0;

            setStatus(`Refreshing $0.00 prices... 0 / ${total}`);

            for (const replacementName of uniqueReplacementNames) {
                const price = await ensurePriceForReplacement(replacementName, true, false);
                updateRulesUsingReplacementPrice(replacementName, price, false);

                completed++;
                setStatus(`Refreshing $0.00 prices... ${completed} / ${total}`);

                await new Promise(resolve => setTimeout(resolve, 150));
            }

            refreshAll();
            setStatus('Finished refreshing $0.00 prices.');
        } finally {
            backfillInProgress = false;
        }
    }

    function updateStickerCard(card, img, rule, replacementData) {
        const originalParsed = parseStickerDisplay(img.alt);
        const replacementParsed = parseStickerDisplay(replacementData.name);

        const textEls = getTextEls(card);

        const topEl = textEls.find(el => {
            const text = el.textContent.trim();
            return text === originalParsed.top || text === 'Sticker';
        });

        const bottomEl = textEls.find(el => el.textContent.trim() === originalParsed.bottom);
        const priceEl = card.querySelector('.mantine-Badge-label');

        if (topEl) topEl.textContent = replacementParsed.top;
        if (bottomEl) bottomEl.textContent = replacementParsed.bottom;
        if (priceEl) priceEl.textContent = formatPrice(rule.price);

        if (replacementData.color) {
            if (topEl) topEl.style.color = replacementData.color;
            if (bottomEl) bottomEl.style.color = replacementData.color;
        }
    }

    function updateItemCardPrice(card) {
        const priceEl = card.querySelector('.mantine-Badge-label');
        if (!priceEl) return;

        const stickerImages = Array.from(card.querySelectorAll('img[alt]'))
            .filter(img => getRuleByAlt(img.alt));

        if (stickerImages.length === 0) return;

        if (!card.dataset.basePrice) {
            card.dataset.basePrice = String(parsePrice(priceEl.textContent));
        }

        const basePrice = parseFloat(card.dataset.basePrice) || 0;

        let stickerTotal = 0;
        for (const img of stickerImages) {
            const rule = getRuleByAlt(img.alt);
            if (rule) {
                stickerTotal += Number(rule.price) || 0;
            }
        }

        const newPrice = basePrice + stickerTotal;
        const formatted = formatPrice(newPrice);

        if (priceEl.textContent !== formatted) {
            priceEl.textContent = formatted;
        }
    }

    function processStickerImage(img) {
        const rule = getRuleByAlt(img.alt);
        if (!rule) return;

        const replacementData = getReplacementData(rule.replacementName);
        if (!replacementData) return;

        if (img.src !== replacementData.image) {
            img.src = replacementData.image;
        }

        const card = getCard(img);
        if (!card) return;

        if (isStickerCard(card, img)) {
            updateStickerCard(card, img, rule, replacementData);
        } else {
            updateItemCardPrice(card);
        }
    }

    function processRoot(root = document) {
        const stickerImages = root.querySelectorAll ? root.querySelectorAll('img[alt]') : [];
        for (const img of stickerImages) {
            processStickerImage(img);
        }
    }

    function refreshAll() {
        processRoot(document);
        renderRulesList();
    }

    function setStatus(message, isError = false) {
        const el = document.getElementById('sr-status');
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? '#ff7b7b' : '#9ad';
    }

    function clearForm() {
        editingIndex = -1;
        document.getElementById('sr-match-alt').value = '';
        document.getElementById('sr-replacement-name').value = '';
        document.getElementById('sr-add-btn').textContent = 'Add Rule';
        document.getElementById('sr-cancel-btn').style.display = 'none';
        hideSuggestions(document.getElementById('sr-match-alt-suggestions'));
        hideSuggestions(document.getElementById('sr-replacement-name-suggestions'));
        setDisplayedPrice(0, '');
    }

    async function populateFormForEdit(index) {
        const rules = loadRules();
        const rule = rules[index];
        if (!rule) return;

        editingIndex = index;
        document.getElementById('sr-match-alt').value = stripPrefix(rule.matchAlt, ALT_PREFIX);
        document.getElementById('sr-replacement-name').value = stripPrefix(rule.replacementName, REPLACEMENT_PREFIX);
        document.getElementById('sr-add-btn').textContent = 'Save';
        document.getElementById('sr-cancel-btn').style.display = 'inline-block';
        setStatus(`Editing rule ${index + 1}`);

        const cached = getCachedPrice(rule.replacementName);
        if (cached !== null) {
            setDisplayedPrice(cached, cached === 0 ? 'Cached: no price found.' : 'Cached price.');
        } else {
            setDisplayedPrice(0, 'Fetching price...');
            const price = await ensurePriceForReplacement(rule.replacementName, false, true);
            setDisplayedPrice(price, price === 0 ? 'No price found. Stored as $0.00.' : 'Price fetched.');
        }
    }

    function getTokenAliases(token) {
        const aliases = new Set([token]);

        const map = {
            vp: ['virtus', 'virtuspro', 'pro'],
            ibp: ['ibuypower', 'i', 'buy', 'power'],
            mouz: ['mousesports'],
            mouse: ['mousesports'],
            faze: ['faze', 'clan'],
            g2: ['g2'],
            navi: ['natus', 'vincere', 'navi'],
            nv: ['envy', 'envyus'],
            c9: ['cloud9'],
            lc: ['london', 'conspiracy'],
            dh: ['dreamhack'],
            kato: ['katowice'],
            col: ['complexity'],
            ldlc: ['ldlc'],
            nip: ['ninjas', 'pyjamas'],
            sk: ['sk'],
            tl: ['liquid'],
            gl: ['gamerlegion'],
            furia: ['furia'],
            ef: ['eternal', 'fire'],
            foi: ['foil'],
            hol: ['holo']
        };

        if (map[token]) {
            for (const alias of map[token]) {
                aliases.add(alias);
            }
        }

        if (token === 'holo') aliases.add('hol');
        if (token === 'foil') aliases.add('foi');
        if (token === 'katowice') aliases.add('kato');
        if (token === 'dreamhack') aliases.add('dh');
        if (token === 'virtuspro') aliases.add('vp');
        if (token === 'ibuypower') aliases.add('ibp');
        if (token === 'mousesports') aliases.add('mouz');
        if (token === 'londonconspiracy') aliases.add('lc');

        return [...aliases];
    }

    function tokenizeSearchText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[|()]/g, ' ')
            .replace(/\./g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    }

    function buildSearchIndex(text) {
        const baseTokens = tokenizeSearchText(text);
        const expanded = new Set();

        for (const token of baseTokens) {
            expanded.add(token);
            for (const alias of getTokenAliases(token)) {
                expanded.add(alias);
            }
        }

        return {
            tokens: [...expanded]
        };
    }

    function findAutocompleteMatches(inputValue, collapseForAlt = false) {
        const query = withPrefix(inputValue, ALT_PREFIX).trim();
        const visibleQuery = stripPrefix(query, ALT_PREFIX).trim();

        if (visibleQuery.length < 2) {
            return { matches: [], total: 0 };
        }

        const preparedQuery = collapseForAlt ? collapseSpaces(query) : query;
        const rawQueryTokens = tokenizeSearchText(preparedQuery).filter(token => token !== 'sticker');

        if (!rawQueryTokens.length) {
            return { matches: [], total: 0 };
        }

        function tokenMatches(queryToken, nameToken) {
            const aliases = getTokenAliases(queryToken);
            return aliases.some(alias =>
                                nameToken === alias || nameToken.startsWith(alias)
                               );
        }

        function matchesInOrder(queryTokens, nameTokens) {
            let searchStart = 0;

            for (const queryToken of queryTokens) {
                let foundAt = -1;

                for (let i = searchStart; i < nameTokens.length; i++) {
                    if (tokenMatches(queryToken, nameTokens[i])) {
                        foundAt = i;
                        break;
                    }
                }

                if (foundAt === -1) {
                    return false;
                }

                searchStart = foundAt + 1;
            }

            return true;
        }

        const ranked = [];

        for (const name of stickerNameList) {
            const comparableName = collapseForAlt ? collapseSpaces(name) : name;
            const visibleName = stripPrefix(name, ALT_PREFIX).toLowerCase();
            const nameTokens = tokenizeSearchText(comparableName).filter(token => token !== 'sticker');

            if (!matchesInOrder(rawQueryTokens, nameTokens)) {
                continue;
            }

            const exactVisibleMatch = visibleName === visibleQuery.toLowerCase();
            const startsWithVisible = visibleName.startsWith(visibleQuery.toLowerCase());

            let score = 0;

            if (exactVisibleMatch) score += 1000;
            if (startsWithVisible) score += 200;

            let cursor = 0;
            for (const queryToken of rawQueryTokens) {
                for (let i = cursor; i < nameTokens.length; i++) {
                    if (tokenMatches(queryToken, nameTokens[i])) {
                        if (nameTokens[i] === queryToken || getTokenAliases(queryToken).includes(nameTokens[i])) {
                            score += 25;
                        } else {
                            score += 10;
                        }
                        cursor = i + 1;
                        break;
                    }
                }
            }

            ranked.push({ name, score });
        }

        ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

        return {
            matches: ranked.slice(0, 5).map(entry => entry.name),
            total: ranked.length
        };
    }

    function hideSuggestions(container) {
        if (!container) return;
        container.innerHTML = '';
        container.style.display = 'none';
        container.dataset.highlightIndex = '-1';
    }

    function showSuggestions(inputEl, containerEl, matches, collapseForAlt = false, onSelect = null) {
        if (!containerEl) return;

        containerEl.innerHTML = '';
        containerEl.dataset.highlightIndex = '-1';

        if (!matches.length) {
            hideSuggestions(containerEl);
            return;
        }

        for (const [index, fullName] of matches.entries()) {
            const visibleText = stripPrefix(fullName, ALT_PREFIX);
            const filledText = collapseForAlt ? collapseSpaces(visibleText) : visibleText;

            const item = document.createElement('div');
            item.className = 'sr-suggestion';
            item.textContent = filledText;
            item.dataset.index = String(index);
            item.dataset.fullName = fullName;

            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
                if (onSelect) {
                    onSelect(fullName);
                }
            });

            containerEl.appendChild(item);
        }

        containerEl.style.display = 'block';
    }

    function setupAutocomplete(inputId, suggestionsId) {
        const inputEl = document.getElementById(inputId);
        const containerEl = document.getElementById(suggestionsId);

        if (!inputEl || !containerEl) return;

        const isAltField = inputId === 'sr-match-alt';
        const isReplacementField = inputId === 'sr-replacement-name';
        const debounceMs = 200;

        function getSuggestionItems() {
            return Array.from(containerEl.querySelectorAll('.sr-suggestion'));
        }

        function setHighlight(index) {
            const items = getSuggestionItems();
            if (!items.length) {
                containerEl.dataset.highlightIndex = '-1';
                return;
            }

            const clamped = Math.max(0, Math.min(index, items.length - 1));
            containerEl.dataset.highlightIndex = String(clamped);

            items.forEach((item, i) => {
                item.classList.toggle('active', i === clamped);
            });

            items[clamped].scrollIntoView({ block: 'nearest' });
        }

        function clearHighlight() {
            containerEl.dataset.highlightIndex = '-1';
            getSuggestionItems().forEach(item => item.classList.remove('active'));
        }

        function isExactVisibleMatch(value) {
            const target = String(value || '').trim().toLowerCase();
            if (!target) return false;

            return stickerNameList.some(name =>
                stripPrefix(name, ALT_PREFIX).toLowerCase() === target
            );
        }

        function getExactFullName(value) {
            const target = String(value || '').trim().toLowerCase();
            if (!target) return null;

            return stickerNameList.find(name =>
                stripPrefix(name, ALT_PREFIX).toLowerCase() === target
            ) || null;
        }

        function selectSuggestion(fullName) {
            if (isAltField) {
                inputEl.value = collapseSpaces(stripPrefix(fullName, ALT_PREFIX));
                hideSuggestions(containerEl);
                return true;
            }

            if (isReplacementField) {
                inputEl.value = stripPrefix(fullName, REPLACEMENT_PREFIX);
                hideSuggestions(containerEl);
                scheduleReplacementPriceFetch(true);
                return true;
            }

            return false;
        }

        function tryAcceptSuggestion() {
            const items = getSuggestionItems();
            const activeIndex = Number(containerEl.dataset.highlightIndex || '-1');

            if (activeIndex >= 0 && items[activeIndex]) {
                return selectSuggestion(items[activeIndex].dataset.fullName);
            }

            if (items.length === 1) {
                return selectSuggestion(items[0].dataset.fullName);
            }

            const exactFullName = getExactFullName(inputEl.value);
            if (exactFullName) {
                return selectSuggestion(exactFullName);
            }

            return false;
        }

        function refreshSuggestionsNow() {
            const trimmedValue = inputEl.value.trim();

            if (!trimmedValue) {
                hideSuggestions(containerEl);
                if (isReplacementField) {
                    setDisplayedPrice(0, '');
                }
                return;
            }

            if (isExactVisibleMatch(trimmedValue)) {
                hideSuggestions(containerEl);
                if (isReplacementField) {
                    scheduleReplacementPriceFetch(false);
                }
                return;
            }

            const info = findAutocompleteMatches(trimmedValue, isAltField);

            showSuggestions(
                inputEl,
                containerEl,
                info.matches,
                isAltField,
                (selectedFullName) => {
                    selectSuggestion(selectedFullName);
                }
            );

            if (containerEl.style.display !== 'none') {
                clearHighlight();
                if (info.matches.length > 0) {
                    setHighlight(0);
                }
            }

            if (isReplacementField) {
                scheduleReplacementPriceFetch(false);
            }
        }

        function scheduleRefresh(immediate = false) {
            clearTimeout(autocompleteTimers[inputId]);

            if (immediate) {
                refreshSuggestionsNow();
                return;
            }

            autocompleteTimers[inputId] = setTimeout(() => {
                refreshSuggestionsNow();
            }, debounceMs);
        }

        inputEl.addEventListener('input', () => {
            scheduleRefresh(false);
        });

        inputEl.addEventListener('focus', () => {
            scheduleRefresh(true);
        });

        inputEl.addEventListener('keydown', (event) => {
            const items = getSuggestionItems();
            const visible = containerEl.style.display !== 'none' && items.length > 0;

            if (event.key === 'ArrowDown') {
                if (!visible) {
                    scheduleRefresh(true);
                    return;
                }
                event.preventDefault();
                let highlightIndex = Number(containerEl.dataset.highlightIndex || '-1');
                highlightIndex = highlightIndex < items.length - 1 ? highlightIndex + 1 : 0;
                setHighlight(highlightIndex);
                return;
            }

            if (event.key === 'ArrowUp') {
                if (!visible) {
                    scheduleRefresh(true);
                    return;
                }
                event.preventDefault();
                let highlightIndex = Number(containerEl.dataset.highlightIndex || '-1');
                highlightIndex = highlightIndex > 0 ? highlightIndex - 1 : items.length - 1;
                setHighlight(highlightIndex);
                return;
            }

            if (event.key === 'Enter') {
                if (visible || isExactVisibleMatch(inputEl.value) || getSuggestionItems().length === 1) {
                    event.preventDefault();
                    tryAcceptSuggestion();
                }
                return;
            }

            if (event.key === 'Tab') {
                const accepted = tryAcceptSuggestion();
                if (accepted) {
                    event.preventDefault();
                    inputEl.blur();
                }
                return;
            }

            if (event.key === 'Escape') {
                clearTimeout(autocompleteTimers[inputId]);
                hideSuggestions(containerEl);
            }
        });

        inputEl.addEventListener('blur', () => {
            clearTimeout(autocompleteTimers[inputId]);
            setTimeout(() => hideSuggestions(containerEl), 120);
        });
    }

    function renderRulesList() {
        const listEl = document.getElementById('sr-list');
        if (!listEl) return;

        const rules = loadRules();
        const searchIndex = buildSearchIndex(ruleSearch);
        const searchTokens = searchIndex.tokens;

        const filteredRules = rules
            .map((rule, index) => ({ rule, index }))
            .filter(({ rule }) => {
                if (!ruleSearch) return true;

                const matchText = stripPrefix(rule.matchAlt, ALT_PREFIX);
                const replaceText = stripPrefix(rule.replacementName, REPLACEMENT_PREFIX);

                const matchIndex = buildSearchIndex(matchText);
                const replaceIndex = buildSearchIndex(replaceText);

                return searchTokens.every(searchToken => {
                    const aliases = getTokenAliases(searchToken);

                    return aliases.some(alias =>
                        matchIndex.tokens.some(token =>
                            token === alias ||
                            token.includes(alias) ||
                            alias.includes(token)
                        )
                    ) || aliases.some(alias =>
                        replaceIndex.tokens.some(token =>
                            token === alias ||
                            token.includes(alias) ||
                            alias.includes(token)
                        )
                    );
                });
            });

        listEl.innerHTML = '';

        if (filteredRules.length === 0) {
            listEl.innerHTML = `<div class="sr-rule-line" style="color:#999;">No matching rules found.</div>`;
            return;
        }

        for (const { rule, index } of filteredRules) {
            const wrapper = document.createElement('div');
            wrapper.className = 'sr-rule';

            wrapper.innerHTML = `
                <div class="sr-rule-line"><strong>Match:</strong> ${escapeHtml(stripPrefix(rule.matchAlt, ALT_PREFIX))}</div>
                <div class="sr-rule-line"><strong>Replace with:</strong> ${escapeHtml(stripPrefix(rule.replacementName, REPLACEMENT_PREFIX))}</div>
                <div class="sr-rule-line"><strong>Price:</strong> ${formatPrice(rule.price)}</div>
                <div class="sr-rule-actions">
                    <button class="sr-edit-btn" type="button" data-rule-index="${index}">Edit</button>
                    <button class="sr-remove-btn" type="button" data-rule-index="${index}">Remove</button>
                </div>
            `;

            listEl.appendChild(wrapper);
        }

        listEl.querySelectorAll('.sr-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                populateFormForEdit(Number(btn.dataset.ruleIndex));
            });
        });

        listEl.querySelectorAll('.sr-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.ruleIndex);
                const rules = loadRules();
                rules.splice(index, 1);
                saveRules(rules);

                if (editingIndex === index) clearForm();
                if (editingIndex > index) editingIndex--;

                renderRulesList();
                refreshAll();
                setStatus('Rule removed.');
            });
        });
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    async function handleAddOrUpdateRule() {
        const matchAltEl = document.getElementById('sr-match-alt');
        const replacementNameEl = document.getElementById('sr-replacement-name');

        const matchAltInput = matchAltEl.value.trim();
        const replacementInput = replacementNameEl.value.trim();

        if (!matchAltInput) {
            setStatus('Enter the sticker alt to match.', true);
            return;
        }

        if (!replacementInput) {
            setStatus('Enter the replacement sticker name.', true);
            return;
        }

        const matchAlt = withPrefix(collapseSpaces(matchAltInput), ALT_PREFIX);

        let replacementName = withPrefix(replacementInput, REPLACEMENT_PREFIX);
        let replacementData = getReplacementData(replacementName);

        if (!replacementData) {
            const info = findAutocompleteMatches(replacementInput, false);
            if (info.total === 1 && info.matches[0]) {
                replacementName = info.matches[0];
                replacementData = getReplacementData(replacementName);
            }
        }

        if (!replacementData) {
            setStatus('Replacement name not found in the sticker API. Use the exact sticker name.', true);
            return;
        }

        setDisplayedPrice(0, 'Fetching price...');
        const price = await ensurePriceForReplacement(replacementName, false, true);
        setDisplayedPrice(price, price === 0 ? 'No price found. Stored as $0.00.' : 'Price fetched.');

        const rules = loadRules();
        const newRule = {
            matchAlt,
            replacementName: replacementData.name,
            price
        };

        if (editingIndex >= 0) {
            rules[editingIndex] = newRule;
            saveRules(rules);
            clearForm();
            renderRulesList();
            refreshAll();
            setStatus('Rule updated.');
            return;
        }

        const existingIndex = rules.findIndex(rule => rule.matchAlt === matchAlt);
        if (existingIndex >= 0) {
            rules[existingIndex] = newRule;
            setStatus('Existing rule updated.');
        } else {
            rules.push(newRule);
            setStatus('Rule saved.');
        }

        saveRules(rules);
        clearForm();
        renderRulesList();
        refreshAll();
    }

    function createManagerUI() {
        if (document.getElementById('sticker-rule-manager-root')) return;

        const root = document.createElement('div');
        root.id = 'sticker-rule-manager-root';
        root.innerHTML = `
            <button id="sticker-rule-toggle" type="button" title="Sticker Rules">♻</button>
            <div id="sticker-rule-panel" style="display:none;">
                <div id="sticker-rule-header">Sticker Rule Manager</div>

                <label class="sr-label">Match sticker alt</label>
                <div class="sr-autocomplete-wrap">
                    <input id="sr-match-alt" class="sr-input" placeholder="MOUZ | Paris 2023" autocomplete="off" />
                    <div id="sr-match-alt-suggestions" class="sr-suggestions"></div>
                </div>

                <label class="sr-label">Replacement sticker name</label>
                <div class="sr-autocomplete-wrap">
                    <input id="sr-replacement-name" class="sr-input" placeholder="iBUYPOWER | Katowice 2014" autocomplete="off" />
                    <div id="sr-replacement-name-suggestions" class="sr-suggestions"></div>
                </div>

                <label class="sr-label">Replacement price</label>
                <div class="sr-price-row">
                    <div id="sr-price-display" class="sr-price-display">$0.00</div>
                    <button id="sr-fetch-price-btn" type="button">Retry</button>
                </div>
                <div id="sr-price-note" class="sr-price-note"></div>

                <div class="sr-prefix-hint">“Sticker | ” is added automatically.</div>

                <div class="sr-actions">
                    <button id="sr-add-btn" type="button">Add Rule</button>
                    <button id="sr-cancel-btn" type="button" style="display:none;">Cancel</button>
                    <button id="sr-refresh-btn" type="button">⟳</button>
                    <button id="sr-refresh-zero-btn" type="button">⟳ $0.00</button>
                    <button id="sr-export-btn" type="button">Export</button>
                    <button id="sr-import-btn" type="button">Import</button>
                </div>

                <div id="sr-status"></div>

                <label class="sr-label" for="sr-search">Search rules</label>
                <div class="sr-search-row">
                    <input id="sr-search" class="sr-input" placeholder="Search match alt or replacement..." />
                    <button id="sr-delete-all-btn" type="button" title="Delete all rules">🗑️</button>
                </div>
                <div id="sr-list"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #sticker-rule-manager-root {
                position: fixed;
                right: 0;
                bottom: 0;
                z-index: 999999;
                font-family: Arial, sans-serif;
            }

            #sticker-rule-toggle {
                position: fixed;
                right: 0;
                bottom: 0;
                width: 36px;
                height: 36px;
                padding: 0;
                margin: 0;
                border: 1px solid #444;
                border-bottom: 0;
                border-right: 0;
                border-top-left-radius: 10px;
                border-top-right-radius: 0;
                border-bottom-left-radius: 0;
                border-bottom-right-radius: 0;
                background: #111;
                color: #fff;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                box-shadow: 0 4px 12px rgba(0,0,0,0.35);
                z-index: 1000002;
            }

            #sticker-rule-panel {
                position: fixed;
                right: 16px;
                bottom: 16px;
                width: 400px;
                background: rgba(20, 20, 20, 0.97);
                color: #eee;
                border: 1px solid #444;
                border-radius: 10px;
                padding: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                box-sizing: border-box;
                z-index: 1000001;
            }

            #sticker-rule-header {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 10px;
            }

            .sr-label {
                display: block;
                font-size: 12px;
                color: #bbb;
                margin: 8px 0 4px;
            }

            .sr-input {
                width: 100%;
                box-sizing: border-box;
                padding: 8px;
                border-radius: 6px;
                border: 1px solid #555;
                background: #111;
                color: #fff;
                font-size: 13px;
            }

            .sr-autocomplete-wrap {
                position: relative;
            }

            .sr-suggestions {
                position: absolute;
                top: calc(100% + 2px);
                left: 0;
                right: 0;
                background: #111;
                border: 1px solid #555;
                border-radius: 6px;
                box-shadow: 0 8px 18px rgba(0,0,0,0.35);
                z-index: 1000003;
                max-height: 180px;
                overflow-y: auto;
                display: none;
            }

            .sr-suggestion {
                padding: 8px 10px;
                font-size: 12px;
                color: #eee;
                cursor: pointer;
                border-bottom: 1px solid #2a2a2a;
            }

            .sr-suggestion:last-child {
                border-bottom: 0;
            }

            .sr-suggestion:hover,
            .sr-suggestion.active {
                background: #222;
            }

            .sr-price-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .sr-price-display {
                flex: 1;
                min-height: 36px;
                display: flex;
                align-items: center;
                padding: 0 10px;
                border-radius: 6px;
                border: 1px solid #555;
                background: #111;
                color: #fff;
                box-sizing: border-box;
                font-size: 13px;
            }

            .sr-price-note {
                font-size: 11px;
                color: #888;
                margin-top: 6px;
                min-height: 14px;
            }

            .sr-prefix-hint {
                font-size: 11px;
                color: #888;
                margin-top: 6px;
            }

            .sr-actions,
            .sr-rule-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 10px;
            }

            .sr-actions {
                align-items: stretch;
            }

            .sr-actions button,
            .sr-rule-actions button,
            #sr-fetch-price-btn,
            #sr-delete-all-btn {
                background: #222;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                padding: 7px 9px;
                cursor: pointer;
                font-size: 13px;
                line-height: 1.2;
                box-sizing: border-box;
            }

            #sr-add-btn,
            #sr-cancel-btn,
            #sr-refresh-btn,
            #sr-refresh-zero-btn {
                flex: 1 1 auto;
                min-width: 0;
                text-align: center;
            }

            #sr-export-btn,
            #sr-import-btn {
                padding: 6px 8px;
                font-size: 11px;
            }

            #sr-fetch-price-btn {
                padding: 10px 10px;
                font-size: 13px;
            }

            .sr-rule-actions button {
                padding: 6px 8px;
                font-size: 13px;
            }

            .sr-search-row {
                display: flex;
                align-items: stretch;
                gap: 8px;
            }

            .sr-search-row #sr-search {
                flex: 1;
                min-width: 0;
            }

            .sr-search-row {
                margin-top: 2px;
            }

            #sr-delete-all-btn {
                width: 36px;
                min-width: 36px;
                height: 36px;
                padding: 0;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
            }

            #sr-status {
                margin-top: 10px;
                font-size: 12px;
                min-height: 16px;
                color: #9ad;
            }

            #sr-list {
                margin-top: 12px;
                max-height: 240px;
                overflow: auto;
                border-top: 1px solid #333;
                padding-top: 10px;
            }

            .sr-rule {
                border: 1px solid #333;
                border-radius: 8px;
                padding: 8px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.03);
            }

            .sr-rule-line {
                font-size: 12px;
                margin-bottom: 4px;
                word-break: break-word;
            }
        `;

        document.body.appendChild(style);
        document.body.appendChild(root);

        const toggleBtn = document.getElementById('sticker-rule-toggle');
        const panel = document.getElementById('sticker-rule-panel');
        const addBtn = document.getElementById('sr-add-btn');
        const cancelBtn = document.getElementById('sr-cancel-btn');
        const refreshBtn = document.getElementById('sr-refresh-btn');
        const refreshZeroBtn = document.getElementById('sr-refresh-zero-btn');
        const exportBtn = document.getElementById('sr-export-btn');
        const importBtn = document.getElementById('sr-import-btn');
        const fetchPriceBtn = document.getElementById('sr-fetch-price-btn');
        const searchEl = document.getElementById('sr-search');
        const deleteAllBtn = document.getElementById('sr-delete-all-btn');
        const replacementInput = document.getElementById('sr-replacement-name');

        toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            toggleBtn.style.zIndex = panel.style.display === 'none' ? '1000002' : '1000004';
        });

        addBtn.addEventListener('click', handleAddOrUpdateRule);

        cancelBtn.addEventListener('click', () => {
            clearForm();
            setStatus('Edit cancelled.');
        });

        refreshBtn.addEventListener('click', async () => {
            setStatus('Re-applying rules...');
            refreshAll();
            await backfillMissingRulePrices();
            setStatus('Rules re-applied.');
        });

        refreshZeroBtn.addEventListener('click', refreshZeroPricesOnly);
        exportBtn.addEventListener('click', exportRules);
        importBtn.addEventListener('click', importRules);
        deleteAllBtn.addEventListener('click', deleteAllRules);

        fetchPriceBtn.addEventListener('click', async () => {
            const replacementName = getCurrentReplacementName();

            if (!replacementName) {
                setStatus('No single replacement match to fetch.', true);
                return;
            }

            setDisplayedPrice(0, 'Fetching price...');
            const price = await ensurePriceForReplacement(replacementName, true, true);
            setDisplayedPrice(price, price === 0 ? 'No price found. Stored as $0.00.' : 'Price fetched.');
            setStatus('Price refreshed.');
        });

        searchEl.addEventListener('input', () => {
            ruleSearch = searchEl.value.trim().toLowerCase();
            renderRulesList();
        });

        replacementInput.addEventListener('change', () => {
            scheduleReplacementPriceFetch(true);
        });

        setupAutocomplete('sr-match-alt', 'sr-match-alt-suggestions');
        setupAutocomplete('sr-replacement-name', 'sr-replacement-name-suggestions');

        renderRulesList();
        setDisplayedPrice(0, '');
    }

    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    if (node.matches?.('img[alt]')) {
                        processStickerImage(node);
                    } else if (node.querySelectorAll) {
                        processRoot(node);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async function init() {
        while (!document.body) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        loadPriceCache();
        stickerApiMap = await fetchStickerApiMap();
        rebuildStickerNameList();
        createManagerUI();
        refreshAll();
        startObserver();
        await backfillMissingRulePrices();
    }

    init();
})();