// ==UserScript==
// @name         Terminal Dashboard
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Fully automates opening Terminals, full credits to Chicken for the Basecode.
// @author       gufrie01
// @credits      Chicken for the Basecode
// @match        https://case-clicker.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      case-clicker.com
// ==/UserScript==

(function() {
    'use strict';

    let currentTerminalId = null;
    let offerCount = 0;
    let currentlyOfferedItem = null;
    let declinedItemsSession = [];
    let acceptedItemsSession = [];
    const MAX_OFFERS = 5;

    const TERMINAL_OPTIONS = [
        { label: 'Genesis Terminal', value: 'Genesis Terminal' },
        { label: 'Dead Hand Terminal', value: 'Dead Hand Terminal' }
    ];

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        :root {
            --terminal-bg: #09090b;
            --terminal-panel: #18181b;
            --terminal-border: #27272a;
            --terminal-text: #e4e4e7;
            --terminal-dim: #a1a1aa;
            --terminal-accent: #00fddc;
        }

        #terminal-helper-container {
            position: fixed; display: flex; flex-direction: column;
            width: 1024px; min-width: 800px; height: 576px; min-height: 450px;
            background: rgba(9, 9, 11, 0.98);
            backdrop-filter: blur(12px);
            border: 1px solid var(--terminal-border);
            z-index: 10001;
            border-radius: 12px;
            box-shadow: inset 0 0 25px rgba(0,0,0,0.7), 0 20px 50px -10px rgba(0, 253, 220, 0.15);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        .helper-header {
            background: var(--terminal-panel);
            padding: 12px 16px; cursor: move; border-top-left-radius: 12px;
            border-top-right-radius: 12px; display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0; border-bottom: 1px solid var(--terminal-border); color: var(--terminal-text);
        }
        .helper-header h3 {
            margin: 0; font-size: 13px; font-weight: 700;
            color: var(--terminal-accent); text-transform: uppercase; letter-spacing: 0.5px;
        }
        .header-right {
            display: flex; align-items: center; gap: 10px;
        }
        .header-btn {
            cursor: pointer; font-weight: bold; font-size: 14px; padding: 4px;
            transition: color 0.2s; color: var(--terminal-dim); background: none; border: none;
        }
        .header-btn:hover { color: var(--terminal-accent); }

        #terminal-select {
            background: var(--terminal-bg);
            border: 1px solid var(--terminal-border);
            color: var(--terminal-text);
            font-size: 12px;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 6px;
            cursor: pointer;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            appearance: none;
            -webkit-appearance: none;
            padding-right: 24px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23a1a1aa'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
        }
        #terminal-select:hover, #terminal-select:focus {
            border-color: var(--terminal-accent);
            box-shadow: 0 0 8px rgba(0, 253, 220, 0.2);
        }
        #terminal-select option {
            background: var(--terminal-bg);
            color: var(--terminal-text);
        }

        #helper-content {
            flex-grow: 1; display: grid; grid-template-columns: 250px 1fr 250px;
            gap: 15px; padding: 15px; overflow: hidden;
        }
        .history-column {
            background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px;
            display: flex; flex-direction: column; overflow: hidden;
            border: 1px solid var(--terminal-border);
        }
        .history-column h4 {
            margin: 0 0 12px 0; padding-bottom: 10px; text-align: center;
            border-bottom: 1px solid var(--terminal-border);
            color: var(--terminal-text); font-size: 11px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        .history-list {
            list-style: none; padding: 0; margin: 0; overflow-y: auto;
            scrollbar-width: thin; scrollbar-color: var(--terminal-accent) var(--terminal-bg);
        }
        .history-list::-webkit-scrollbar { width: 6px; }
        .history-list::-webkit-scrollbar-track { background: var(--terminal-bg); }
        .history-list::-webkit-scrollbar-thumb { background: var(--terminal-accent); border-radius: 3px; }
        .history-item {
            background: var(--terminal-panel); border-radius: 6px; padding: 10px; margin-bottom: 8px;
            border-left: 3px solid; font-size: 0.9em; transition: transform 0.2s, box-shadow 0.2s;
        }
        .history-item:hover { transform: translateX(3px); box-shadow: 0 0 10px rgba(0, 253, 220, 0.2); }
        .history-item-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--terminal-text); }
        .history-item-details { color: var(--terminal-dim); display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.85em; }

        #main-content-area { display: flex; flex-direction: column; }
        .continuous-switch-container {
            padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--terminal-border);
            color: var(--terminal-text); font-size: 13px; font-weight: 500; flex-shrink: 0;
            display: flex; justify-content: center; align-items: center; gap: 12px;
        }
        #dynamic-content-area { flex-grow: 1; display: flex; flex-direction: column; }

        .congrats-header {
            text-align: center; color: var(--terminal-accent); font-size: 1.6em;
            font-weight: 700; margin-bottom: 15px;
            text-shadow: 0 0 20px rgba(0, 253, 220, 0.5);
            letter-spacing: 1px;
        }
        .terminal-btn {
            width: 100%; padding: 12px; font-size: 13px; cursor: pointer;
            border: 1px solid var(--terminal-border); border-radius: 6px;
            transition: all 0.2s;
            background-color: transparent; color: var(--terminal-text);
            text-transform: uppercase; letter-spacing: 1px; font-weight: 700;
            font-family: 'Inter', sans-serif;
        }
        .terminal-btn:hover:not(:disabled) {
            border-color: var(--terminal-accent);
            background-color: rgba(0, 253, 220, 0.1);
            box-shadow: 0 0 15px rgba(0, 253, 220, 0.3);
            color: var(--terminal-accent);
        }
        .terminal-btn:disabled { color: #555; border-color: #333; cursor: not-allowed; opacity: 0.5; }

        #buy-btn { border-color: #10b981; color: #10b981; }
        #buy-btn:hover:not(:disabled) {
            background-color: rgba(16, 185, 129, 0.15);
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
        }
        #pass-btn { border-color: #f59e0b; color: #f59e0b; }
        #pass-btn:hover:not(:disabled) {
            background-color: rgba(245, 158, 11, 0.15);
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
        }
        #discard-btn { border-color: #ef4444; color: #ef4444; }
        #discard-btn:hover:not(:disabled) {
            background-color: rgba(239, 68, 68, 0.15);
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
        }
        .button-group { display: flex; gap: 10px; flex-shrink: 0; margin-top: 15px; }

        .item-card-wrapper {
            flex-grow: 1; display: flex; flex-direction: column; min-height: 0;
            padding: 20px; background: rgba(0,0,0,0.4); border-radius: 8px;
            border: 1px solid var(--terminal-border);
        }
        .item-card-wrapper.stattrak-border {
            border-color: #f59e0b;
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
        }
        .item-image-area { flex-grow: 1; display: flex; align-items: center; justify-content: center; min-height: 0; margin-bottom: 15px; }
        .item-image { max-width: 100%; max-height: 100%; height: auto; filter: drop-shadow(0 0 15px rgba(0,0,0,0.8)); }
        .item-text-area { text-align: center; flex-shrink: 0; }
        .item-name { font-size: 1.5em; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
        .skin-name { font-size: 1.3em; font-weight: 500; margin: 0; }
        .wear-text { font-size: 1em; color: var(--terminal-dim); margin-top: 8px; font-weight: 500; }
        .bottom-info { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 20px; flex-shrink: 0; }
        .float-text { font-size: 1.1em; color: var(--terminal-dim); font-family: 'JetBrains Mono', 'Courier New', monospace; font-weight: 500; }
        .price-pill {
            background: var(--terminal-bg); border-radius: 6px; padding: 6px 12px;
            font-size: 1.1em; font-weight: 700; color: var(--terminal-accent);
            border: 1px solid var(--terminal-border);
        }

        #resize-handle {
            position: absolute; bottom: 0; right: 0; width: 15px; height: 15px;
            cursor: se-resize; opacity: 0.5;
            background: linear-gradient(135deg, transparent 50%, var(--terminal-dim) 50%);
            border-radius: 0 0 12px 0;
        }
        .no-select { user-select: none; }
        .terminal-toolbar-button {
            display: inline-flex; align-items: center; justify-content: center;
            height: 30px; padding: 0 16px; font-size: 12px; margin-left: 1rem !important;
            border-radius: 6px; cursor: pointer;
            background: var(--terminal-panel); border: 1px solid var(--terminal-border);
            color: var(--terminal-text); font-weight: 700; letter-spacing: 0.5px;
            transition: all 0.2s; font-family: 'Inter', sans-serif;
        }
        .terminal-toolbar-button:hover {
            background: var(--terminal-accent);
            border-color: var(--terminal-accent);
            color: var(--terminal-bg);
        }
        .terminal-toolbar-button span { margin-left: 8px; }

        .modal {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(9, 9, 11, 0.98); backdrop-filter: blur(12px);
            border: 1px solid var(--terminal-border); border-radius: 12px;
            box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.8);
            z-index: 10002; width: 90%; max-width: 500px; display: none;
        }
        .modal-header {
            padding: 12px 16px; font-size: 13px; font-weight: 700;
            border-bottom: 1px solid var(--terminal-border);
            display: flex; justify-content: space-between; align-items: center;
            color: var(--terminal-accent); background: var(--terminal-panel);
            text-transform: uppercase; letter-spacing: 0.5px; border-radius: 12px 12px 0 0;
        }
        .modal-content { padding: 20px; color: var(--terminal-dim); max-height: 500px; overflow-y: auto; }
        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: var(--terminal-bg); }
        .modal-content::-webkit-scrollbar-thumb { background: var(--terminal-accent); border-radius: 3px; }
        .modal-footer { padding: 12px 16px; border-top: 1px solid var(--terminal-border); text-align: right; }
        .modal-btn {
            padding: 10px 20px; border: 1px solid var(--terminal-accent); border-radius: 6px;
            cursor: pointer; color: var(--terminal-accent); background-color: transparent;
            transition: all 0.2s; font-weight: 700; font-size: 13px;
            font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .modal-btn:hover {
            background: var(--terminal-accent);
            color: var(--terminal-bg);
            box-shadow: 0 0 15px rgba(0, 253, 220, 0.4);
        }
        .settings-input, .settings-textarea {
            width: 100%; background: var(--terminal-bg); border: 1px solid var(--terminal-border);
            color: var(--terminal-text); padding: 10px 12px; border-radius: 6px;
            margin-top: 8px; font-family: 'Inter', sans-serif; font-size: 13px;
            transition: border-color 0.2s; outline: none;
        }
        .settings-input:focus, .settings-textarea:focus {
            border-color: var(--terminal-accent);
        }

        .switch { position: relative; display: inline-block; width: 52px; height: 28px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: var(--terminal-border); border-radius: 28px; transition: .3s;
            border: 1px solid var(--terminal-border);
        }
        .slider:before {
            position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px;
            background-color: var(--terminal-dim); border-radius: 50%; transition: .3s;
        }
        input:checked + .slider {
            background-color: var(--terminal-accent);
            box-shadow: 0 0 10px rgba(0, 253, 220, 0.5);
            border-color: var(--terminal-accent);
        }
        input:checked + .slider:before {
            transform: translateX(24px);
            background-color: var(--terminal-bg);
        }

        .rarity-float-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            padding: 8px 12px;
            background-color: var(--terminal-panel);
            border-radius: 6px;
            border: 1px solid var(--terminal-border);
        }
        .rarity-float-row label {
            flex: 1;
            min-width: 140px;
            font-size: 13px;
            color: var(--terminal-text);
            font-weight: 500;
        }
        .rarity-float-input {
            width: 100px;
            background: var(--terminal-bg);
            border: 1px solid var(--terminal-border);
            color: var(--terminal-text);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
            outline: none;
            transition: border-color 0.2s;
        }
        .rarity-float-input:focus {
            border-color: var(--terminal-accent);
        }
        .settings-section {
            margin-bottom: 20px;
        }
        .settings-section h4 {
            font-size: 11px;
            font-weight: 600;
            color: var(--terminal-text);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 12px 0;
        }
        .settings-section label {
            display: block;
            font-size: 13px;
            color: var(--terminal-dim);
            margin-bottom: 8px;
        }
        .settings-section p {
            font-size: 12px;
            color: var(--terminal-dim);
            line-height: 1.5;
        }
        .float-mode-toggle {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .mode-btn {
            flex: 1;
            padding: 10px;
            background: var(--terminal-panel);
            border: 1px solid var(--terminal-border);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--terminal-dim);
            font-size: 13px;
            font-weight: 600;
            font-family: 'Inter', sans-serif;
        }
        .mode-btn:hover {
            border-color: var(--terminal-accent);
            color: var(--terminal-text);
        }
        .mode-btn.active {
            background: var(--terminal-accent);
            color: var(--terminal-bg);
            border-color: var(--terminal-accent);
            font-weight: 700;
            box-shadow: 0 0 10px rgba(0, 253, 220, 0.3);
        }
    `);

    const container = document.createElement('div');
    container.id = 'terminal-helper-container';
    container.innerHTML = `
        <div class="helper-header">
            <h3>⚡ Terminal Dashboard</h3>
            <div class="header-right">
                <select id="terminal-select">
                    ${TERMINAL_OPTIONS.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
                <span id="settings-btn" class="header-btn" title="Settings">⚙️</span>
                <span id="minimize-btn" class="header-btn" title="Minimize">_</span>
            </div>
        </div>
        <div id="helper-content">
            <div id="declined-history-container" class="history-column">
                <h4>Declined</h4>
                <ul id="declined-history-list" class="history-list"></ul>
            </div>
            <div id="main-content-area">
                <div class="continuous-switch-container">
                    <span>Auto Open</span>
                    <label class="switch">
                        <input type="checkbox" id="continuous-mode-toggle">
                        <span class="slider"></span>
                    </label>
                </div>
                <div id="dynamic-content-area"></div>
            </div>
            <div id="accepted-history-container" class="history-column">
                <h4>Accepted</h4>
                <ul id="accepted-history-list" class="history-list"></ul>
            </div>
        </div>
        <div id="resize-handle"></div>

        <div id="settings-modal" class="modal">
            <div class="modal-header"><span>Auto-Decision Settings</span></div>
            <div class="modal-content">
                <div class="settings-section">
                    <label><input type="checkbox" id="enable-auto-buy"> Enable Auto-Decision (Offers 1-4)</label>
                </div>

                <hr style="border-color: var(--terminal-border); margin: 15px 0;">

                <div class="settings-section">
                    <h4>Float Settings Mode</h4>
                    <div class="float-mode-toggle">
                        <button class="mode-btn" id="simple-mode-btn">Simple Mode</button>
                        <button class="mode-btn" id="advanced-mode-btn">Per-Rarity Mode</button>
                    </div>
                </div>

                <div id="simple-float-settings" style="display: none;">
                    <div class="settings-section">
                        <h4>Simple Float Settings</h4>
                        <label for="float-threshold">Low Float (Buy if BELOW):</label>
                        <input type="number" id="float-threshold" step="0.0001" placeholder="e.g., 0.01" class="settings-input">
                        <label for="high-float-threshold" style="margin-top: 10px; display: block;">High Float (Buy if ABOVE):</label>
                        <input type="number" id="high-float-threshold" step="0.0001" placeholder="e.g., 0.99" class="settings-input">
                        <div id="rarity-selections" style="margin-top: 15px;"></div>
                    </div>
                </div>

                <div id="advanced-float-settings" style="display: none;">
                    <div class="settings-section">
                        <h4>Per-Rarity Float Thresholds</h4>
                        <p style="font-size: 0.85em; margin-bottom: 10px;">Set custom float thresholds for each rarity. Leave blank to ignore.</p>
                        <div id="per-rarity-float-settings"></div>
                    </div>
                </div>

                <hr style="border-color: var(--terminal-border); margin: 15px 0;">

                <div class="settings-section">
                    <h4>Custom Floats</h4>
                    <label for="custom-floats-textarea">Buy if float EXACTLY matches (comma-separated):</label>
                    <textarea id="custom-floats-textarea" class="settings-textarea" rows="3" placeholder="0.69, 0.007, 0.12345"></textarea>
                </div>

                <hr style="border-color: var(--terminal-border); margin: 20px 0;">

                <div class="settings-section">
                    <h4>Final Offer Settings (Offer 5/5)</h4>
                    <label><input type="checkbox" id="enable-auto-accept-final"> Auto-decide final offer</label>
                    <div id="final-offer-mode" style="margin-top: 10px; margin-left: 20px; display: none;">
                        <label style="display: block; margin-bottom: 5px;">
                            <input type="radio" name="final-offer-mode" value="criteria" checked> Use same criteria as offers 1-4
                        </label>
                        <label style="display: block;">
                            <input type="radio" name="final-offer-mode" value="always-accept"> Always accept final offer
                        </label>
                        <p style="font-size: 0.85em; margin-top: 8px;">
                            <strong>Criteria mode:</strong> Accept if meets float/rarity requirements, discard otherwise.<br>
                            <strong>Always accept:</strong> Accept final offer no matter what.
                        </p>
                    </div>
                </div>
            </div>
            <div class="modal-footer"><button id="save-settings-btn" class="modal-btn">Save & Close</button></div>
        </div>
        `;
    document.body.appendChild(container);

    const dynamicContent = container.querySelector('#dynamic-content-area');
    // "Extraordinary" added after Covert as it is rarer
    const rarities = ['Mil-Spec Grade', 'Restricted', 'Classified', 'Covert', 'Extraordinary'];

    // --- Terminal Selection ---
    function getSelectedTerminal() {
        return GM_getValue('terminal_selectedTerminal', 'Genesis Terminal');
    }

    function setSelectedTerminal(value) {
        GM_setValue('terminal_selectedTerminal', value);
    }

    function loadTerminalSelector() {
        const select = document.getElementById('terminal-select');
        select.value = getSelectedTerminal();
        select.addEventListener('change', (e) => {
            setSelectedTerminal(e.target.value);
            // Reset the UI so the new terminal type is used on next start
            renderInitialView();
        });
    }

    // --- Core Functions ---
    function renderInitialView() {
        currentTerminalId = null; offerCount = 0; currentlyOfferedItem = null;
        const selectedTerminal = getSelectedTerminal();
        dynamicContent.innerHTML = `<button id="start-btn" class="terminal-btn">Open ${selectedTerminal}</button><div style="flex-grow: 1; display:flex; align-items:center; justify-content:center; color: #586574;">Waiting for terminal...</div>`;
        if (GM_getValue('terminal_continuousMode', false) && document.getElementById('start-btn')) {
            dynamicContent.querySelector('div').textContent = "Continuous mode: Starting next terminal...";
            setTimeout(() => document.getElementById('start-btn').click(), 2000);
        }
    }

    function renderContent(isPurchaseScreen) {
        if (!currentlyOfferedItem) return;
        const { skin, price } = currentlyOfferedItem;
        let [weaponName, skinName] = skin.name.split(' | ');
        if (!skinName) { skinName = weaponName; weaponName = skin.gunType || skin.type; }
        skinName = skinName.replace(`(${skin.exterior})`, '').trim();
        const headerHTML = isPurchaseScreen ? `<h2 class="congrats-header">🎉 Item Acquired! 🎉</h2>` : '';
        const buttonsHTML = isPurchaseScreen
            ? `<div class="button-group"><button id="reset-btn" class="terminal-btn">Continue</button></div>`
            : `<div class="button-group"><button id="buy-btn" class="terminal-btn">Buy</button><button id="${(offerCount < MAX_OFFERS - 1) ? 'pass-btn' : 'discard-btn'}" class="terminal-btn">${(offerCount < MAX_OFFERS - 1) ? `Pass (${offerCount + 1}/${MAX_OFFERS})` : 'Discard Terminal'}</button></div>`;
        dynamicContent.innerHTML = `${headerHTML}<div class="item-card-wrapper ${skin.statTrak ? 'stattrak-border' : ''}"><div class="item-image-area"><img src="${skin.iconUrl}" class="item-image"/></div><div class="item-text-area"><p class="item-name" style="color: #${skin.rarityColor};">${weaponName}</p><p class="skin-name" style="color: #${skin.rarityColor};">${skinName}</p><p class="wear-text">${skin.exterior}</p></div><div class="bottom-info"><span class="float-text">${skin.float ? skin.float.toFixed(14) : 'N/A'}</span><span class="price-pill">$${price.toFixed(2)}</span></div></div>${buttonsHTML}`;
    }

    function renderOfferView(apiResponse) {
        const terminalData = apiResponse.terminal || apiResponse;
        if (!terminalData || !Array.isArray(terminalData.offeredSkins)) {
            console.log('Invalid terminal data structure');
            renderInitialView();
            return;
        }

        offerCount = terminalData.offeredSkins.filter(o => o.accepted === false).length;

        let offer = null;
        if (offerCount < terminalData.offeredSkins.length) {
            offer = terminalData.offeredSkins[offerCount];
        }

        console.log(`Offer count: ${offerCount}, Total offers: ${terminalData.offeredSkins.length}`);
        console.log('Current offer:', offer);

        if (!offer) {
            console.log('No pending offer found, resetting');
            renderInitialView();
            return;
        }

        currentlyOfferedItem = { skin: offer.offeredSkin, price: offer.offeredPrice };
        checkAndAutoDecide(currentlyOfferedItem);
    }

    // --- Automation & API ---
    function checkItemMeetsCriteria(item) {
        const floatMode = GM_getValue('terminal_floatMode', 'simple');

        // Check custom exact floats first
        const customFloatsStr = GM_getValue('terminal_customFloats', '');
        const customFloats = customFloatsStr.split(',').map(f => parseFloat(f.trim())).filter(f => !isNaN(f));
        const meetsCustomFloat = customFloats.length > 0 && item.skin.float && customFloats.includes(item.skin.float);

        if (meetsCustomFloat) {
            console.log('Item meets custom float criteria');
            return true;
        }

        if (floatMode === 'advanced') {
            // Per-rarity mode
            const perRaritySettings = JSON.parse(GM_getValue('terminal_perRarityFloatSettings', '{}'));
            const raritySettings = perRaritySettings[item.skin.rarity];

            if (raritySettings) {
                const lowFloat = raritySettings.low;
                const highFloat = raritySettings.high;

                const meetsLowFloat = lowFloat !== '' && lowFloat !== null && item.skin.float < parseFloat(lowFloat);
                const meetsHighFloat = highFloat !== '' && highFloat !== null && item.skin.float > parseFloat(highFloat);

                if (meetsLowFloat || meetsHighFloat) {
                    console.log(`Item meets per-rarity float criteria for ${item.skin.rarity}: low=${lowFloat}, high=${highFloat}, float=${item.skin.float}`);
                    return true;
                }
            }
        } else {
            // Simple mode
            const lowFloatStr = GM_getValue('terminal_maxFloat', '');
            const highFloatStr = GM_getValue('terminal_highFloat', '');
            const allowedRarities = JSON.parse(GM_getValue('terminal_allowedRarities', '[]'));

            const meetsLowFloat = (lowFloatStr !== '' && item.skin.float < parseFloat(lowFloatStr));
            const meetsHighFloat = (highFloatStr !== '' && item.skin.float > parseFloat(highFloatStr));
            const meetsRarity = (allowedRarities.length > 0 && item.skin.rarity && allowedRarities.includes(item.skin.rarity));

            if (meetsLowFloat || meetsHighFloat || meetsRarity) {
                console.log(`Item meets simple mode criteria: lowFloat=${meetsLowFloat}, highFloat=${meetsHighFloat}, rarity=${meetsRarity}`);
                return true;
            }
        }

        return false;
    }

    function checkAndAutoDecide(item) {
        renderContent(false);
        const isFinalOffer = (offerCount === MAX_OFFERS - 1);
        const autoBuyEnabled = GM_getValue('terminal_autoBuyEnabled', false);
        const autoFinalEnabled = GM_getValue('terminal_autoAcceptFinalOfferEnabled', false);

        const shouldAutoDecide = isFinalOffer ? autoFinalEnabled : autoBuyEnabled;

        if (!shouldAutoDecide) {
            console.log(`Auto-decision disabled for this offer (final: ${isFinalOffer}, autoBuy: ${autoBuyEnabled}, autoFinal: ${autoFinalEnabled})`);
            return;
        }

        if (isFinalOffer) {
            const finalOfferMode = GM_getValue('terminal_finalOfferMode', 'criteria');

            if (finalOfferMode === 'always-accept') {
                console.log('Final offer - always accept mode enabled');
                dynamicContent.querySelectorAll('.terminal-btn').forEach(btn => btn.disabled = true);

                setTimeout(() => {
                    const buyBtn = dynamicContent.querySelector('#buy-btn');
                    if (buyBtn) {
                        buyBtn.style.color = '#fff';
                        buyBtn.style.backgroundColor = '#10b981';
                        buyBtn.textContent = 'Always Accepting Final!';
                    }
                    setTimeout(() => makeDecision(true), 150);
                }, 300);
                return;
            }
        }

        const meetsCriteria = checkItemMeetsCriteria(item);

        console.log(`Item evaluation: meets criteria = ${meetsCriteria}, isFinalOffer = ${isFinalOffer}`);

        dynamicContent.querySelectorAll('.terminal-btn').forEach(btn => btn.disabled = true);

        setTimeout(() => {
            if (meetsCriteria) {
                const buyBtn = dynamicContent.querySelector('#buy-btn');
                if (buyBtn) {
                    buyBtn.style.color = '#fff';
                    buyBtn.style.backgroundColor = '#10b981';
                    buyBtn.textContent = isFinalOffer ? 'Accepting Final Offer!' : 'Buying!';
                }
                setTimeout(() => makeDecision(true), 150);
            } else {
                const passBtn = dynamicContent.querySelector('#pass-btn, #discard-btn');
                if (passBtn) {
                    passBtn.style.color = '#fff';
                    passBtn.style.backgroundColor = isFinalOffer ? '#ef4444' : '#f59e0b';
                    passBtn.textContent = isFinalOffer ? 'Discarding Final Offer...' : 'Passing...';
                }
                setTimeout(() => makeDecision(false), 150);
            }
        }, 300);
    }

    function startProcess() {
        offerCount = 0; currentTerminalId = null; currentlyOfferedItem = null;
        if (dynamicContent.querySelector('#start-btn')) dynamicContent.querySelector('#start-btn').disabled = true;

        const selectedTerminal = getSelectedTerminal();
        const searchQuery = encodeURIComponent(selectedTerminal);

        GM_xmlhttpRequest({
            method: 'GET', url: `https://case-clicker.com/api/inventory?page=1&sort=price&search=${searchQuery}&showStickers=true&showUpgradedSkins=true`,
            onload: response => {
                try {
                    const data = JSON.parse(response.responseText);
                    console.log('Inventory data:', data);
                    if (!data.skins || data.skins.length === 0) {
                        renderInitialView();
                        dynamicContent.querySelector('div').textContent = `No ${selectedTerminal}s left.`;
                        return;
                    }
                    const terminal = data.skins[0];
                    currentTerminalId = terminal._id;
                    console.log('Terminal:', terminal);
                    console.log('Terminal sealed:', terminal.terminal.isSealed);
                    console.log('Offered skins:', terminal.terminal.offeredSkins);

                    const hasUnprocessedOffers = terminal.terminal.offeredSkins.some((o, idx) => {
                        const declinedCount = terminal.terminal.offeredSkins.filter(offer => offer.accepted === false).length;
                        return idx >= declinedCount && o.accepted !== true;
                    });

                    if (terminal.terminal.isSealed === false && hasUnprocessedOffers) {
                        renderOfferView(terminal);
                    } else {
                        handleFavoritedAndUnseal(terminal);
                    }
                } catch (e) {
                    console.error('Error parsing inventory response:', e);
                    renderInitialView();
                }
            },
            onerror: error => {
                console.error('Error fetching inventory:', error);
                renderInitialView();
            }
        });
    }

    function handleFavoritedAndUnseal(terminal) {
        if (terminal.isFavorite) {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://case-clicker.com/api/inventory/skin/favorite',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ skinId: terminal._id, isFavorite: false, inStorageUnit: false }),
                onload: () => unsealTerminal(terminal._id),
                onerror: error => {
                    console.error('Error unfavoriting terminal:', error);
                    renderInitialView();
                }
            });
        } else {
            unsealTerminal(terminal._id);
        }
    }

    function unsealTerminal(terminalId) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://case-clicker.com/api/inventory/terminal',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ terminalId }),
            onload: response => {
                try {
                    console.log('Unseal response:', response.responseText);
                    renderOfferView(JSON.parse(response.responseText));
                } catch (e) {
                    console.error('Error parsing unseal response:', e);
                    renderInitialView();
                }
            },
            onerror: error => {
                console.error('Error unsealing terminal:', error);
                renderInitialView();
            }
        });
    }

    function makeDecision(accepted) {
        if (!currentlyOfferedItem) return;
        if (accepted) {
            acceptedItemsSession.push(currentlyOfferedItem);
            renderAcceptedHistory();
        } else {
            declinedItemsSession.push(currentlyOfferedItem);
            renderDeclinedHistory();
        }
        GM_xmlhttpRequest({
            method: 'PUT',
            url: 'https://case-clicker.com/api/inventory/terminal',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ terminalId: currentTerminalId, accepted }),
            onload: response => {
                try {
                    console.log('Decision response:', response.responseText);
                    if (accepted) {
                        renderContent(true);
                        if (GM_getValue('terminal_continuousMode', false)) {
                            setTimeout(() => {
                                const continueBtn = dynamicContent.querySelector('#reset-btn');
                                if (continueBtn) continueBtn.click();
                                else renderInitialView();
                            }, 2000);
                        }
                    } else {
                        renderOfferView(JSON.parse(response.responseText));
                    }
                } catch (e) {
                    console.error('Error parsing decision response:', e);
                    renderInitialView();
                }
            },
            onerror: error => {
                console.error('Error making decision:', error);
                renderInitialView();
            }
        });
    }

    // --- UI, Settings & History ---
    function populateRarityCheckboxes(containerId, title, checkboxClass) {
        const rarityContainer = document.getElementById(containerId);
        rarityContainer.innerHTML = `<h4>${title}</h4>`;
        rarities.forEach(rarity => {
            rarityContainer.innerHTML += `<label style="display: block; margin-bottom: 5px;"><input type="checkbox" class="${checkboxClass}" value="${rarity}"> ${rarity}</label>`;
        });
    }

    function populatePerRarityFloatSettings() {
        const container = document.getElementById('per-rarity-float-settings');
        container.innerHTML = '';

        rarities.forEach(rarity => {
            const row = document.createElement('div');
            row.className = 'rarity-float-row';
            row.innerHTML = `
                <label>${rarity}:</label>
                <input type="number" class="rarity-float-input" id="low-${rarity}" step="0.0001" placeholder="Min">
                <span style="color: #666;">to</span>
                <input type="number" class="rarity-float-input" id="high-${rarity}" step="0.0001" placeholder="Max">
            `;
            container.appendChild(row);
        });
    }

    function saveSettings() {
        GM_setValue('terminal_autoBuyEnabled', document.getElementById('enable-auto-buy').checked);
        GM_setValue('terminal_autoAcceptFinalOfferEnabled', document.getElementById('enable-auto-accept-final').checked);
        GM_setValue('terminal_customFloats', document.getElementById('custom-floats-textarea').value);

        const finalOfferModeRadio = document.querySelector('input[name="final-offer-mode"]:checked');
        GM_setValue('terminal_finalOfferMode', finalOfferModeRadio ? finalOfferModeRadio.value : 'criteria');

        const floatMode = document.getElementById('advanced-mode-btn').classList.contains('active') ? 'advanced' : 'simple';
        GM_setValue('terminal_floatMode', floatMode);

        if (floatMode === 'simple') {
            GM_setValue('terminal_maxFloat', document.getElementById('float-threshold').value);
            GM_setValue('terminal_highFloat', document.getElementById('high-float-threshold').value);
            GM_setValue('terminal_allowedRarities', JSON.stringify(Array.from(document.querySelectorAll('.rarity-checkbox:checked')).map(cb => cb.value)));
        } else {
            const perRaritySettings = {};
            rarities.forEach(rarity => {
                const lowInput = document.getElementById(`low-${rarity}`);
                const highInput = document.getElementById(`high-${rarity}`);
                if (lowInput.value || highInput.value) {
                    perRaritySettings[rarity] = {
                        low: lowInput.value,
                        high: highInput.value
                    };
                }
            });
            GM_setValue('terminal_perRarityFloatSettings', JSON.stringify(perRaritySettings));
        }

        document.getElementById('settings-modal').style.display = 'none';
    }

    function loadAndApplySettings() {
        document.getElementById('continuous-mode-toggle').checked = GM_getValue('terminal_continuousMode', false);

        document.getElementById('enable-auto-buy').checked = GM_getValue('terminal_autoBuyEnabled', false);
        document.getElementById('enable-auto-accept-final').checked = GM_getValue('terminal_autoAcceptFinalOfferEnabled', false);
        document.getElementById('custom-floats-textarea').value = GM_getValue('terminal_customFloats', '');

        const finalOfferMode = GM_getValue('terminal_finalOfferMode', 'criteria');
        const finalOfferModeRadio = document.querySelector(`input[name="final-offer-mode"][value="${finalOfferMode}"]`);
        if (finalOfferModeRadio) finalOfferModeRadio.checked = true;

        document.getElementById('final-offer-mode').style.display =
            document.getElementById('enable-auto-accept-final').checked ? 'block' : 'none';

        const floatMode = GM_getValue('terminal_floatMode', 'simple');

        if (floatMode === 'advanced') {
            document.getElementById('advanced-mode-btn').classList.add('active');
            document.getElementById('simple-mode-btn').classList.remove('active');
            document.getElementById('advanced-float-settings').style.display = 'block';
            document.getElementById('simple-float-settings').style.display = 'none';

            const perRaritySettings = JSON.parse(GM_getValue('terminal_perRarityFloatSettings', '{}'));
            rarities.forEach(rarity => {
                const settings = perRaritySettings[rarity];
                if (settings) {
                    const lowInput = document.getElementById(`low-${rarity}`);
                    const highInput = document.getElementById(`high-${rarity}`);
                    if (lowInput) lowInput.value = settings.low || '';
                    if (highInput) highInput.value = settings.high || '';
                }
            });
        } else {
            document.getElementById('simple-mode-btn').classList.add('active');
            document.getElementById('advanced-mode-btn').classList.remove('active');
            document.getElementById('simple-float-settings').style.display = 'block';
            document.getElementById('advanced-float-settings').style.display = 'none';

            document.getElementById('float-threshold').value = GM_getValue('terminal_maxFloat', '');
            document.getElementById('high-float-threshold').value = GM_getValue('terminal_highFloat', '');
            const allowedRarities = JSON.parse(GM_getValue('terminal_allowedRarities', '[]'));
            document.querySelectorAll('.rarity-checkbox').forEach(cb => { cb.checked = allowedRarities.includes(cb.value); });
        }
    }

    function renderHistoryList(listId, items) {
        const listEl = document.getElementById(listId);
        listEl.innerHTML = items.slice().reverse().map(item => `
            <li class="history-item" style="border-left-color: #${item.skin.rarityColor};">
                <div class="history-item-name" title="${item.skin.name}">${item.skin.name.replace(`(${item.skin.exterior})`, '').trim()}</div>
                <div class="history-item-details">
                    <span>${item.skin.float ? item.skin.float.toFixed(6) : 'N/A'}</span>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
            </li>
        `).join('');
    }
    const renderDeclinedHistory = () => renderHistoryList('declined-history-list', declinedItemsSession);
    const renderAcceptedHistory = () => renderHistoryList('accepted-history-list', acceptedItemsSession);

    // --- Event Listeners ---
    container.querySelector('#continuous-mode-toggle').addEventListener('change', (e) => { GM_setValue('terminal_continuousMode', e.target.checked); if (e.target.checked && !currentTerminalId) renderInitialView(); });
    container.querySelector('#settings-btn').addEventListener('click', () => { document.getElementById('settings-modal').style.display = 'block'; });
    container.querySelector('#save-settings-btn').addEventListener('click', saveSettings);
    container.querySelector('#minimize-btn').addEventListener('click', () => { container.style.display = 'none'; GM_setValue('terminal_minimized', true); syncToolbar(); });

    document.getElementById('enable-auto-accept-final').addEventListener('change', (e) => {
        document.getElementById('final-offer-mode').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('simple-mode-btn').addEventListener('click', () => {
        document.getElementById('simple-mode-btn').classList.add('active');
        document.getElementById('advanced-mode-btn').classList.remove('active');
        document.getElementById('simple-float-settings').style.display = 'block';
        document.getElementById('advanced-float-settings').style.display = 'none';
    });

    document.getElementById('advanced-mode-btn').addEventListener('click', () => {
        document.getElementById('advanced-mode-btn').classList.add('active');
        document.getElementById('simple-mode-btn').classList.remove('active');
        document.getElementById('advanced-float-settings').style.display = 'block';
        document.getElementById('simple-float-settings').style.display = 'none';
    });

    dynamicContent.addEventListener('click', (event) => {
        const target = event.target.closest('.terminal-btn');
        if (!target || target.disabled) return;
        if (target.id === 'start-btn') startProcess();
        else if (target.id === 'reset-btn') renderInitialView();
        else if (target.id === 'buy-btn') makeDecision(true);
        else if (target.id === 'pass-btn' || target.id === 'discard-btn') makeDecision(false);
    });

    // --- Window Management & Toolbar ---
    function loadWindowSettings() {
        container.style.top = GM_getValue('terminal_posTop', '100px');
        container.style.left = GM_getValue('terminal_posLeft', '20px');
        container.style.width = GM_getValue('terminal_width', '1024px');
        container.style.height = GM_getValue('terminal_height', '576px');
        container.style.display = GM_getValue('terminal_minimized', false) ? 'none' : 'flex';
    }

    container.querySelector('.helper-header').addEventListener('mousedown', function(e) {
        if (e.target.closest('.header-btn') || e.target.id === 'terminal-select') return;
        document.body.classList.add('no-select');
        const oX=e.clientX-container.offsetLeft,oY=e.clientY-container.offsetTop;
        function move(e){
            let y=e.clientY-oY,x=e.clientX-oX;
            y=Math.max(0,Math.min(y,window.innerHeight-container.offsetHeight));
            x=Math.max(0,Math.min(x,window.innerWidth-container.offsetWidth));
            container.style.top=`${y}px`;
            container.style.left=`${x}px`;
        }
        function up(){
            document.removeEventListener('mousemove',move);
            document.removeEventListener('mouseup',up);
            document.body.classList.remove('no-select');
            GM_setValue('terminal_posTop',container.style.top);
            GM_setValue('terminal_posLeft',container.style.left);
        }
        document.addEventListener('mousemove',move);
        document.addEventListener('mouseup',up);
    });

    container.querySelector('#resize-handle').addEventListener('mousedown', function(e) {
        document.body.classList.add('no-select');
        const sX=e.clientX,sY=e.clientY,sW=parseInt(document.defaultView.getComputedStyle(container).width,10),sH=parseInt(document.defaultView.getComputedStyle(container).height,10);
        function move(e){
            let nW=sW+e.clientX-sX,nH=sH+e.clientY-sY;
            nW=Math.max(800,Math.min(nW,window.innerWidth-container.offsetLeft));
            nH=Math.max(450,Math.min(nH,window.innerHeight-container.offsetTop));
            container.style.width=`${nW}px`;
            container.style.height=`${nH}px`;
        }
        function up(){
            document.removeEventListener('mousemove',move);
            document.removeEventListener('mouseup',up);
            document.body.classList.remove('no-select');
            GM_setValue('terminal_width',container.style.width);
            GM_setValue('terminal_height',container.style.height);
        }
        document.addEventListener('mousemove',move);
        document.addEventListener('mouseup',up);
    });

    function syncToolbar() {
        const anchorBtn = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Show Serverstats') || btn.textContent.includes('INV SCAN')
        );
        if (!anchorBtn || !anchorBtn.parentElement) return;

        const toolbar = anchorBtn.parentElement;
        let btn = document.getElementById('terminal-restore-btn');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'terminal-restore-btn';
            btn.className = 'terminal-toolbar-button';
            btn.textContent = '⚡ TERMINAL';
            btn.onclick = () => {
                const panel = document.getElementById('terminal-helper-container');
                if (panel) {
                    panel.style.display = 'flex';
                    GM_setValue('terminal_minimized', false);
                    syncToolbar();
                }
            };
            toolbar.appendChild(btn);
        }

        const panel = document.getElementById('terminal-helper-container');
        const isMinimized = panel && (panel.style.display === 'none' || GM_getValue('terminal_minimized', false));
        btn.style.display = isMinimized ? 'inline-flex' : 'none';
    }

    function setupToolbarPersistence() {
        const observer = new MutationObserver(() => syncToolbar());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        loadWindowSettings();
        loadTerminalSelector();
        populateRarityCheckboxes('rarity-selections', 'Buy if rarity is one of these:', 'rarity-checkbox');
        populatePerRarityFloatSettings();
        loadAndApplySettings();
        renderInitialView();
        renderDeclinedHistory();
        renderAcceptedHistory();
        setupToolbarPersistence();
        syncToolbar();
    }
    init();
})();