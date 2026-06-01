// ==UserScript==
// @name         Auto Forge v1.0
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Continuous toggle forge with modern UI and smart filtering
// @author       gufrie01
// @match        https://case-clicker.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // API INTERCEPTOR (For URL Capture)
    // =========================================================================
    const interceptorCode = `
        (function() {
            window.__capturedInventoryUrl = '';
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(...args) {
                const url = args[1];
                if (typeof url === 'string' && url.includes('/api/inventory?')) {
                    window.__capturedInventoryUrl = url;
                }
                return originalXhrOpen.apply(this, args);
            };
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                let url = args[0] instanceof Request ? args[0].url : args[0];
                if (typeof url === 'string' && url.includes('/api/inventory?')) {
                    window.__capturedInventoryUrl = url;
                }
                return originalFetch.apply(this, args);
            };
        })();
    `;
    const scriptElement = document.createElement('script');
    scriptElement.textContent = interceptorCode;
    document.documentElement.appendChild(scriptElement);
    scriptElement.remove();

    // =========================================================================
    // STYLES
    // =========================================================================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        :root {
            --forge-bg: #09090b;
            --forge-panel: #18181b;
            --forge-border: #27272a;
            --forge-text: #e4e4e7;
            --forge-dim: #a1a1aa;
            --forge-accent: #f97316;
            --forge-success: #10b981;
            --forge-danger: #ef4444;
        }

        #af_root {
            position: fixed;
            display: flex;
            flex-direction: column;
            background: rgba(9, 9, 11, 0.98);
            backdrop-filter: blur(12px);
            border: 1px solid var(--forge-border);
            border-radius: 12px;
            box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.8);
            font-family: 'Inter', sans-serif;
            color: var(--forge-text);
            z-index: 2147483645;
            min-width: 400px;
            min-height: 500px;
        }

        #af_root.minimized {
            display: none !important;
        }

        #af_header {
            padding: 12px 16px;
            background: var(--forge-panel);
            border-bottom: 1px solid var(--forge-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
            border-radius: 12px 12px 0 0;
        }

        .af_title {
            font-weight: 700;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--forge-accent);
        }

        .af_icon_btn {
            background: transparent;
            border: none;
            color: var(--forge-dim);
            cursor: pointer;
            padding: 4px;
            font-size: 14px;
            margin-left: 8px;
            transition: 0.2s;
        }

        .af_icon_btn:hover {
            color: #fff;
        }

        #af_body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .af_section {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .af_label {
            font-size: 11px;
            font-weight: 600;
            color: var(--forge-dim);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
        }

        .af_select {
            width: 100%;
            background: var(--forge-bg);
            border: 1px solid var(--forge-border);
            color: var(--forge-text);
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
            cursor: pointer;
            transition: 0.2s;
            outline: none;
        }

        .af_select:hover {
            border-color: var(--forge-dim);
        }

        .af_select:focus {
            border-color: var(--forge-accent);
        }

        .af_btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 700;
            font-family: 'Inter', sans-serif;
            cursor: pointer;
            transition: 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .af_btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .af_btn.start {
            background: var(--forge-success);
            color: #000;
        }

        .af_btn.start:hover:not(:disabled) {
            background: #059669;
        }

        .af_btn.stop {
            background: var(--forge-danger);
            color: #fff;
        }

        .af_btn.stop:hover:not(:disabled) {
            background: #dc2626;
        }

        .af_btn.secondary {
            background: var(--forge-panel);
            border: 1px solid var(--forge-border);
            color: var(--forge-text);
        }

        .af_btn.secondary:hover:not(:disabled) {
            border-color: var(--forge-dim);
            color: #fff;
        }

        .af_status_box {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--forge-border);
            border-radius: 6px;
            padding: 12px;
        }

        .af_status_title {
            font-size: 10px;
            font-weight: 600;
            color: var(--forge-dim);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .af_status_text {
            font-size: 12px;
            font-family: 'JetBrains Mono', monospace;
            color: var(--forge-accent);
            font-weight: 500;
        }

        .af_stats_grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 8px;
        }

        .af_stat_item {
            font-size: 11px;
            color: var(--forge-dim);
        }

        .af_stat_value {
            font-weight: 700;
            color: var(--forge-text);
        }

        .af_toolbar_btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 30px;
            padding: 0 16px;
            font-size: 12px;
            margin-left: 1rem !important;
            border-radius: 4px;
            cursor: pointer;
            background: #333;
            border: 1px solid #555;
            color: var(--forge-dim);
            font-weight: bold;
            letter-spacing: 1px;
            transition: all 0.2s;
            font-family: 'Inter', sans-serif;
        }

        .af_toolbar_btn:hover {
            background: var(--forge-accent);
            color: #fff;
            border-color: var(--forge-accent);
        }

        .af_resize_handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 15px;
            height: 15px;
            cursor: se-resize;
            opacity: 0.5;
            background: linear-gradient(135deg, transparent 50%, var(--forge-dim) 50%);
            border-radius: 0 0 12px 0;
        }

        .af_divider {
            height: 1px;
            background: var(--forge-border);
            margin: 15px 0;
        }

        .af_input_group {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .af_input {
            background: var(--forge-bg);
            border: 1px solid var(--forge-border);
            color: var(--forge-text);
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
            outline: none;
            width: 60px;
            text-align: center;
        }

        .af_input:focus {
            border-color: var(--forge-accent);
        }
    `);

    // =========================================================================
    // STATE
    // =========================================================================
    let isRunning = false;
    let loopTimeout = null;
    const DELAY_MS = 600;
    let forgedCount = 0;
    let skippedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let availableItems = {};
    let selectedItemName = 'ALL';
    let lastLoadedUrl = '';
    let allLoadedItems = [];
    let chainForgeItem = null; // Track item being chain-forged

    const API_URL_KEY = 'af_last_api_url';

    // =========================================================================
    // FILTERING LOGIC
    // =========================================================================
    function isItemForgeable(item) {
        // Skip if favorited or doesn't have pattern
        if (item.isFavorite || !item.hasPattern) {
            return false;
        }
        return true;
    }

    function shouldForgeItem(item) {
        if (!isItemForgeable(item)) return false;

        // Check StatTrak filter
        const skinType = document.getElementById('af_type_select')?.value || 'any';
        if (skinType === 'stattrak' && !item.statTrak) return false;
        if (skinType === 'normal' && item.statTrak) return false;
        // 'any' accepts both

        // Check quality filter
        const quality = document.getElementById('af_quality_select')?.value || '0';
        if (quality === 'all') {
            // Chain mode: accept any quality that's not legendary yet
            if (item.quality >= 3) return false;
        } else {
            // Specific quality mode: only forge items of that exact quality
            if (item.quality !== parseInt(quality)) return false;
        }

        // If "ALL" is selected, forge everything that's forgeable
        if (selectedItemName === 'ALL') return true;

        // Otherwise, only forge if name matches selection
        return item.name === selectedItemName;
    }

    // =========================================================================
    // MULTI-PAGE LOADING
    // =========================================================================
    async function loadMultiplePages(pageCount, quality, type) {
        // Try to get captured URL first
        let capturedUrl = unsafeWindow.__capturedInventoryUrl;

        // If no captured URL, build one from scratch
        if (!capturedUrl) {
            capturedUrl = `/api/inventory?favoriteSkinsFilter=none&page=1&sort=true&quality=${quality}&showStickers=true&showUpgradedSkins=true`;
            // Only add trade-up filters if specifically StatTrak mode
            if (type === "stattrak") {
                capturedUrl += "&isTradeUp=true&tradeUpStatTrak=true";
            }
        }

        // Make URL absolute if needed
        lastLoadedUrl = capturedUrl.startsWith('http') ? capturedUrl : window.location.origin + capturedUrl;
        await GM_setValue(API_URL_KEY, lastLoadedUrl);

        allLoadedItems = [];
        const baseUrl = new URL(lastLoadedUrl);

        // Ensure favoriteSkinsFilter is in the URL
        if (!baseUrl.searchParams.has('favoriteSkinsFilter')) {
            baseUrl.searchParams.set('favoriteSkinsFilter', 'none');
        }

        // Remove trade-up filters if type is not stattrak
        if (type !== 'stattrak') {
            baseUrl.searchParams.delete('isTradeUp');
            baseUrl.searchParams.delete('tradeUpStatTrak');
        }

        console.log(`[Auto Forge] Starting to load ${pageCount === 999 ? 'ALL' : pageCount} pages...`);
        console.log(`[Auto Forge] Base URL: ${baseUrl.toString()}`);

        let emptyPagesCount = 0;
        let totalPages = pageCount;

        for (let page = 1; page <= totalPages; page++) {
            baseUrl.searchParams.set('page', page);

            // Wait for the request to complete before continuing
            const pageResult = await new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: baseUrl.toString(),
                    onload: (res) => {
                        if (res.status === 200) {
                            try {
                                const data = JSON.parse(res.responseText);

                                // On first page, check if we should load all pages
                                if (page === 1 && pageCount === 999 && data.pages) {
                                    totalPages = data.pages;
                                    console.log(`[Auto Forge] Found ${data.pages} total pages (${data.count || '?'} items)`);
                                }

                                if (data.skins && data.skins.length > 0) {
                                    allLoadedItems = allLoadedItems.concat(data.skins);
                                    console.log(`[Auto Forge] Page ${page}/${totalPages}: Loaded ${data.skins.length} items (Total: ${allLoadedItems.length})`);
                                    emptyPagesCount = 0; // Reset counter on successful page
                                    resolve({ success: true, count: data.skins.length });
                                } else {
                                    emptyPagesCount++;
                                    console.log(`[Auto Forge] Page ${page}/${totalPages}: Empty page (${emptyPagesCount} consecutive empty)`);
                                    resolve({ success: true, count: 0 });
                                }
                            } catch (e) {
                                console.error("[Auto Forge] Parse error:", e);
                                console.error("[Auto Forge] Response text:", res.responseText);
                                resolve({ success: false, error: 'parse_error' });
                            }
                        } else {
                            console.error(`[Auto Forge] Page ${page}/${totalPages}: HTTP ${res.status}`);
                            if (res.status === 429) {
                                console.error("[Auto Forge] RATE LIMITED - Waiting longer before retry...");
                                resolve({ success: false, error: 'rate_limit' });
                            } else {
                                resolve({ success: false, error: 'http_error' });
                            }
                        }
                    },
                    onerror: (err) => {
                        console.error(`[Auto Forge] Page ${page}/${totalPages}: Network error`, err);
                        resolve({ success: false, error: 'network_error' });
                    }
                });
            });

            // If we hit rate limit, wait extra long before continuing
            if (pageResult.error === 'rate_limit') {
                console.log(`[Auto Forge] Waiting 4 seconds due to rate limit...`);
                await new Promise(r => setTimeout(r, 4000));
                page--; // Retry this page
                continue;
            }

            // Stop early if we hit 3 consecutive empty pages
            if (emptyPagesCount >= 3) {
                console.log(`[Auto Forge] Stopping early - ${emptyPagesCount} consecutive empty pages`);
                break;
            }

            // Always wait between requests
            if (page < totalPages) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        console.log(`[Auto Forge] ========================================`);
        console.log(`[Auto Forge] FINAL: Loaded ${allLoadedItems.length} total items`);
        console.log(`[Auto Forge] ========================================`);
        return allLoadedItems;
    }

    // =========================================================================
    // ITEM ANALYSIS
    // =========================================================================
    async function analyzeInventory(pageCount = 1) {
        const quality = document.getElementById('af_quality_select').value;
        const skinType = document.getElementById('af_type_select').value;

        const scanBtn = document.getElementById('af_scan_btn');
        const scanAllBtn = document.getElementById('af_scan_all_btn');

        const isScannigAll = pageCount === 999;

        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = isScannigAll ? '⏳ Scanning ALL...' : `⏳ Scanning ${pageCount} page${pageCount > 1 ? 's' : ''}...`;
        }
        if (scanAllBtn) {
            scanAllBtn.disabled = true;
        }

        const items = await loadMultiplePages(pageCount, quality, skinType);

        // Store ALL forgeable items (we'll filter in the dropdown)
        availableItems = {};
        items.forEach(item => {
            if (isItemForgeable(item)) {
                const itemKey = item.name;
                if (!availableItems[itemKey]) {
                    availableItems[itemKey] = {
                        count: 0,
                        isStatTrak: item.statTrak
                    };
                }
                availableItems[itemKey].count++;
            }
        });

        renderItemSelector();

        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '📊 Scan Pages';
        }
        if (scanAllBtn) {
            scanAllBtn.disabled = false;
        }
    }

    // =========================================================================
    // API FUNCTIONS
    // =========================================================================
    const postForge = async (skinId) => {
        try {
            const res = await fetch("https://case-clicker.com/api/inventory/forge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skinId: skinId })
            });

            if (res.status === 400) return "ALREADY_FORGED";
            if (!res.ok) return { success: false, message: "HTTP Error" };

            const data = await res.json();

            // Check for success based on message field
            if (data.message === "Reforge successful.") {
                return { success: true, skin: data.skin };
            } else if (data.message === "Reforge failed.") {
                return { success: false, message: "Reforge failed" };
            }

            return { success: false, message: "Unknown response" };
        } catch (e) {
            return { success: false, message: "Exception: " + e.message };
        }
    };

    // =========================================================================
    // CORE LOGIC
    // =========================================================================
    const processLoop = async () => {
        if (!isRunning) return;

        const statusEl = document.getElementById('af_status');
        const quality = document.getElementById('af_quality_select').value;
        const isChainMode = quality === 'all';

        let itemToForge = null;

        // Chain mode: prioritize the chain item if it exists
        if (isChainMode && chainForgeItem) {
            itemToForge = allLoadedItems.find(item => item._id === chainForgeItem._id);
            if (!itemToForge) {
                // Chain item no longer exists, clear it
                chainForgeItem = null;
            }
        }

        // If no chain item or not in chain mode, find next item
        if (!itemToForge) {
            itemToForge = allLoadedItems.find(item => shouldForgeItem(item));
        }

        if (itemToForge) {
            const skinId = itemToForge._id || itemToForge.id;
            const shortName = itemToForge.name.length > 35 ? itemToForge.name.substring(0, 35) + '...' : itemToForge.name;
            const qualityLabel = isChainMode ? `Q${itemToForge.quality}→Q${itemToForge.quality + 1}` : '';
            statusEl.innerText = `Status: Forging ${shortName} ${qualityLabel}`;

            const result = await postForge(skinId);

            if (result === "ALREADY_FORGED") {
                console.log(`[Auto Forge] Skipped duplicate: ${skinId}`);
                skippedCount++;
                // Remove from list
                allLoadedItems = allLoadedItems.filter(item => item._id !== skinId);
                chainForgeItem = null;
            } else if (result.success === true) {
                console.log(`[Auto Forge] Successfully forged: ${skinId}`);
                successCount++;

                // Remove old item from list
                allLoadedItems = allLoadedItems.filter(item => item._id !== skinId);

                // Handle chain forging
                if (isChainMode && result.skin) {
                    const newQuality = result.skin.quality;
                    if (newQuality < 3) {
                        // Not legendary yet, add back to list for re-forge
                        console.log(`[Auto Forge] Chain: Q${newQuality} - will forge again`);
                        allLoadedItems.unshift(result.skin); // Add to front of queue
                        chainForgeItem = result.skin;
                    } else {
                        // Reached legendary, clear chain
                        console.log(`[Auto Forge] Chain complete: Reached Legendary`);
                        chainForgeItem = null;
                    }
                } else {
                    chainForgeItem = null;
                }
            } else if (result.success === false) {
                console.log(`[Auto Forge] Failed to forge: ${skinId} - ${result.message}`);
                failedCount++;
                // Remove from list and clear chain on failure
                allLoadedItems = allLoadedItems.filter(item => item._id !== skinId);
                chainForgeItem = null;
            } else {
                console.log(`[Auto Forge] Unknown result for: ${skinId}`);
                skippedCount++;
                allLoadedItems = allLoadedItems.filter(item => item._id !== skinId);
                chainForgeItem = null;
            }

            updateStats();

            if (isRunning) loopTimeout = setTimeout(processLoop, DELAY_MS);
        } else {
            statusEl.innerText = selectedItemName === 'ALL'
                ? "Status: No more forgeable items in loaded pages"
                : `Status: No more ${selectedItemName} in loaded pages`;
            stopLoop();
        }
    };

    const startLoop = () => {
        if (isRunning) return;

        if (allLoadedItems.length === 0) {
            alert("Please scan inventory first!");
            return;
        }

        isRunning = true;
        forgedCount = 0;
        skippedCount = 0;
        successCount = 0;
        failedCount = 0;
        chainForgeItem = null; // Reset chain on start

        const btn = document.getElementById('af_toggle_btn');
        btn.innerHTML = '⏸ STOP FORGING';
        btn.className = 'af_btn stop';
        document.getElementById('af_status').innerText = "Status: Starting...";

        updateStats();
        processLoop();
    };

    const stopLoop = () => {
        isRunning = false;
        if (loopTimeout) {
            clearTimeout(loopTimeout);
            loopTimeout = null;
        }
        const btn = document.getElementById('af_toggle_btn');
        btn.innerHTML = '▶ START FORGING';
        btn.className = 'af_btn start';
        document.getElementById('af_status').innerText = "Status: Idle";
    };

    function updateStats() {
        const statsEl = document.getElementById('af_stats');
        if (statsEl) {
            const remaining = allLoadedItems.filter(item => shouldForgeItem(item)).length;
            statsEl.innerHTML = `
                <div class="af_stat_item">Success: <span class="af_stat_value" style="color: var(--forge-success);">${successCount}</span></div>
                <div class="af_stat_item">Failed: <span class="af_stat_value" style="color: var(--forge-danger);">${failedCount}</span></div>
                <div class="af_stat_item">Skipped: <span class="af_stat_value">${skippedCount}</span></div>
                <div class="af_stat_item">Remaining: <span class="af_stat_value">${remaining}</span></div>
            `;
        }
    }

    // =========================================================================
    // UI RENDERING
    // =========================================================================
    function renderItemSelector() {
        const dropdown = document.getElementById('af_item_select');
        if (!dropdown) return;

        const skinType = document.getElementById('af_type_select')?.value || 'any';

        // Filter items based on skin type selection
        let filteredItems = Object.entries(availableItems).filter(([name, data]) => {
            if (skinType === 'stattrak') return data.isStatTrak === true;
            if (skinType === 'normal') return data.isStatTrak === false;
            return true; // 'any' shows all
        });

        const totalCount = filteredItems.reduce((sum, [_, data]) => sum + data.count, 0);

        let html = `<option value="ALL">🔥 Forge All Items (${totalCount} total)</option>`;

        // Sort items by count (descending)
        const sortedItems = filteredItems.sort((a, b) => b[1].count - a[1].count);

        sortedItems.forEach(([name, data]) => {
            html += `<option value="${name}">${name} (${data.count}x)</option>`;
        });

        dropdown.innerHTML = html;
        dropdown.value = selectedItemName;

        updateStats();
    }

    // =========================================================================
    // UI CREATION
    // =========================================================================
    function initUI() {
        if (document.getElementById('af_root')) return;

        const root = document.createElement('div');
        root.id = 'af_root';

        let pos = GM_getValue('af_pos', { top: '100px', left: '100px' });
        root.style.top = pos.top;
        root.style.left = pos.left;

        root.innerHTML = `
            <div id="af_header">
                <div class="af_title">🛠️ AUTO FORGE</div>
                <div>
                    <button class="af_icon_btn" id="af_minimize" title="Minimize">_</button>
                </div>
            </div>
            <div id="af_body">
                <div class="af_section">
                    <label class="af_label">Inventory Scanning</label>
                    <button id="af_scan_all_btn" class="af_btn start" style="width: 100%; margin-bottom: 8px;">Scan All</button>
                    <div class="af_input_group">
                        <button id="af_scan_btn" class="af_btn secondary" style="flex: 1;">📊 Scan Pages</button>
                        <input type="number" id="af_page_count" class="af_input" value="1" min="1" max="50" title="Pages to scan">
                    </div>
                    <div style="font-size: 10px; color: var(--forge-dim); margin-top: 4px;">
                        💡 Each page = ~50 items. "Scan All" loads your entire inventory.
                    </div>
                </div>

                <div class="af_divider"></div>

                <div class="af_section">
                    <label class="af_label">Skin Type</label>
                    <select id="af_type_select" class="af_select">
                        <option value="any">Any (Normal + StatTrak)</option>
                        <option value="normal">Normal Skins</option>
                        <option value="stattrak">StatTrak</option>
                    </select>
                </div>

                <div class="af_section">
                    <label class="af_label">Target Quality</label>
                    <select id="af_quality_select" class="af_select">
                        <option value="0">Common to Rare</option>
                        <option value="1">Rare to Epic</option>
                        <option value="2">Epic to Legendary</option>
                        <option value="all">Any to Legendary</option>
                    </select>
                </div>

                <div class="af_section">
                    <label class="af_label">Item Selection</label>
                    <select id="af_item_select" class="af_select">
                        <option value="ALL">Click "Scan Inventory" to see items</option>
                    </select>
                </div>

                <div class="af_divider"></div>

                <button id="af_toggle_btn" class="af_btn start">▶ START FORGING</button>

                <div class="af_status_box">
                    <div class="af_status_title">Current Status</div>
                    <div id="af_status" class="af_status_text">Status: Idle</div>
                    <div id="af_stats" class="af_stats_grid"></div>
                </div>
            </div>
            <div class="af_resize_handle"></div>
        `;

        document.body.appendChild(root);

        // Event Listeners
        root.querySelector('#af_minimize').onclick = () => {
            root.classList.add('minimized');
            GM_setValue('af_minimized', true);
            manageToolbar();
        };

        root.querySelector('#af_toggle_btn').onclick = () => {
            if (isRunning) stopLoop();
            else startLoop();
        };

        root.querySelector('#af_scan_btn').onclick = async () => {
            const pageCount = parseInt(document.getElementById('af_page_count').value) || 1;
            await analyzeInventory(pageCount);
        };

        root.querySelector('#af_scan_all_btn').onclick = async () => {
            // Pass 999 as a signal to scan all pages
            await analyzeInventory(999);
        };

        root.querySelector('#af_item_select').onchange = (e) => {
            selectedItemName = e.target.value;
            GM_setValue('af_selected_item', selectedItemName);
            updateStats();
        };

        root.querySelector('#af_type_select').onchange = () => {
            // Re-render the item selector when skin type changes
            renderItemSelector();
        };

        // Load saved selection
        selectedItemName = GM_getValue('af_selected_item', 'ALL');

        setupWindowControl(root);
        setupToolbarPersistence();
        updateStats();

        // Check if should be minimized on load
        if (GM_getValue('af_minimized', false)) {
            root.classList.add('minimized');
        }

        manageToolbar();
    }

    // =========================================================================
    // WINDOW CONTROL
    // =========================================================================
    function setupWindowControl(panel) {
        const header = panel.querySelector('#af_header');
        const resizeHandle = panel.querySelector('.af_resize_handle');
        let isDragging = false, isResizing = false;
        let offset = { x: 0, y: 0 }, initialSize = { width: 0, height: 0 };

        const startDrag = (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            offset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop };
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', stopActions);
        };

        const startResize = (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            offset = { x: e.clientX, y: e.clientY };
            initialSize = { width: panel.offsetWidth, height: panel.offsetHeight };
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', stopActions);
        };

        const moveHandler = (e) => {
            if (isDragging) {
                panel.style.left = `${e.clientX - offset.x}px`;
                panel.style.top = `${e.clientY - offset.y}px`;
            }
            if (isResizing) {
                panel.style.width = `${initialSize.width + (e.clientX - offset.x)}px`;
                panel.style.height = `${initialSize.height + (e.clientY - offset.y)}px`;
            }
        };

        const stopActions = () => {
            if (isDragging) {
                isDragging = false;
                GM_setValue('af_pos', { top: panel.style.top, left: panel.style.left });
            }
            if (isResizing) {
                isResizing = false;
                GM_setValue('af_size', { width: panel.style.width, height: panel.style.height });
            }
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', stopActions);
        };

        header.addEventListener('mousedown', startDrag);
        if (resizeHandle) resizeHandle.addEventListener('mousedown', startResize);
    }

    // =========================================================================
    // TOOLBAR INTEGRATION
    // =========================================================================
    function setupToolbarPersistence() {
        new MutationObserver(() => manageToolbar()).observe(document.body, { childList: true, subtree: true });
    }

    function manageToolbar() {
        const anchorBtn = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Show Serverstats') || btn.textContent.includes('INV SCAN')
        );

        if (!anchorBtn?.parentElement) return;

        const toolbar = anchorBtn.parentElement;
        const btnId = 'af_toolbar_restore_btn';
        let restoreButton = document.getElementById(btnId);

        if (!restoreButton) {
            restoreButton = document.createElement('button');
            restoreButton.id = btnId;
            restoreButton.className = 'af_toolbar_btn';
            restoreButton.textContent = '🛠️ FORGE';
            restoreButton.onclick = () => {
                const panel = document.getElementById('af_root');
                if (panel) {
                    panel.classList.remove('minimized');
                    GM_setValue('af_minimized', false);
                    manageToolbar();
                }
            };
            toolbar.appendChild(restoreButton);
        }

        // Show button only when minimized, hide when panel is visible
        const panel = document.getElementById('af_root');
        const isMinimized = panel && panel.classList.contains('minimized');
        restoreButton.style.display = isMinimized ? 'inline-flex' : 'none';
    }

    // =========================================================================
    // INIT
    // =========================================================================
    const waitForBody = setInterval(() => {
        if (document.body) {
            clearInterval(waitForBody);
            initUI();
        }
    }, 200);

})();