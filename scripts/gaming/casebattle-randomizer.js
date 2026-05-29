// ==UserScript==
// @name         Case Battle Randomizer v3.4
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  CazeBattle RAonzmizer
// @author       ZSB
// @match        https://case-clicker.com/game/casebattle*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=case-clicker.com
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let areCasesLoaded = false;
    let ALL_CASES = [];
    let logHistory = [];
    let gameSocket = null;
    let isSocketOpen = false;
    let maxBattleCases = 50;

    function logStatus(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        logHistory.unshift(logMessage);
        if (logHistory.length > 50) logHistory.pop();
        const statusDisplay = document.getElementById('randomizer-status');
        if (statusDisplay) {
            statusDisplay.value = logHistory.join('\n');
            statusDisplay.style.color = isError ? '#ff479f' : '#00e5ff';
        }
    }

    function updateButtonState() {
        const createBtn = document.getElementById('create-battle-button');
        if (!createBtn) return;
        if (areCasesLoaded && isSocketOpen) {
            createBtn.disabled = false;
            logStatus("RANDOMIZER READY.");
        } else {
            createBtn.disabled = true;
        }
    }

    const OriginalWebSocket = unsafeWindow.WebSocket;
    class InterceptedWebSocket extends OriginalWebSocket {
        constructor(url, protocols) {
            super(url, protocols);
            if (url.includes('ws.case-clicker.com')) {
                gameSocket = this;
                this.addEventListener('open', () => {
                    console.log('%c[Randomizer] WebSocket connection is OPEN and READY.', 'color: #22c55e; font-weight: bold;');
                    isSocketOpen = true;
                    logStatus("WEBSOCKET LINK ESTABLISHED.");
                    updateButtonState();
                });
            }
        }
    }
    unsafeWindow.WebSocket = InterceptedWebSocket;

    function initialize() {
        logStatus("INITIALIZING...");
        const PLAYER_OPTIONS = [
            { text: '2 Players (1v1)', playerCount: 2 }, { text: '3 Players (1v1v1)', playerCount: 3 },
            { text: '4 Players (2v2 or FFA)', playerCount: 4 }, { text: '5 Players (FFA)', playerCount: 5 },
            { text: '6 Players (3v3 or FFA)', playerCount: 6 },
        ];

        const mainPanel = document.createElement('div');
        mainPanel.id = 'randomizer-panel';
        document.body.appendChild(mainPanel);
        mainPanel.innerHTML = `
            <div id="randomizer-header">
                <span class="header-decoration"></span>
                CASE BATTLE RANDOMIZER v3.4
                <span class="header-decoration"></span>
            </div>
            <div id="randomizer-content">
                <div class="setting-row"> <label for="player-count-select">PLAYERS</label> <select id="player-count-select" class="randomizer-input">${PLAYER_OPTIONS.map(opt => `<option value="${opt.playerCount}">${opt.text}</option>`).join('')}</select> </div>
                <div class="setting-row">
                    <label for="target-value-input">TARGET VAL</label>
                    <div class="input-with-button">
                        <input type="text" id="target-value-input" class="randomizer-input" value="1,000,000">
                        <button id="all-in-button" class="inline-button">ALL IN</button>
                    </div>
                </div>
                <div class="setting-row"> <label for="max-cases-input">MAX CASES</label> <input type="number" id="max-cases-input" class="randomizer-input" value="50" min="1" max="50"> </div>
                <div class="separator">MODIFIERS</div>
                <div id="modifier-grid">
                    <div class="checkbox-row"> <input type="checkbox" id="private-battle-toggle" checked> <label for="private-battle-toggle">PRIVATE</label> </div>
                    <div class="checkbox-row"> <input type="checkbox" id="autocall-bots-toggle" checked> <label for="autocall-bots-toggle">CALL BOTS</label> </div>
                    <div class="checkbox-row"> <input type="checkbox" id="cataclysm-mode-toggle"> <label for="cataclysm-mode-toggle">CATACLYSM</label> </div>
                    <div class="checkbox-row"> <input type="checkbox" id="timeshift-mode-toggle"> <label for="timeshift-mode-toggle">TIMESHIFT</label> </div>
                </div>
                <button id="create-battle-button" class="randomizer-button" disabled>CREATE BATTLE</button>
            </div>
            <textarea id="randomizer-status" readonly></textarea>`;

        GM_addStyle(`
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            :root {
                --pixel-font: 'Press Start 2P', cursive;
                --bg-main: #1a1a2e; --bg-panel: #16213e; --bg-input: #0f3460;
                --text-light: #e94560; --text-accent: #00e5ff; --text-header: #ffffff;
                --border-color: #00e5ff; --border-shadow: #e94560;
            }
            #randomizer-panel {
                position: fixed; top: 20px; right: 20px; width: 340px;
                background-color: var(--bg-main);
                border: 2px solid var(--border-color);
                box-shadow: 0 0 15px var(--border-shadow), 0 0 5px var(--border-color) inset;
                border-radius: 0; font-family: var(--pixel-font); z-index: 9999;
                color: var(--text-light); image-rendering: pixelated;
            }
            #randomizer-header {
                padding: 10px; text-align: center; font-size: 14px; text-transform: uppercase;
                background-color: var(--bg-panel); color: var(--text-header);
                border-bottom: 2px solid var(--border-color);
                user-select: none; cursor: move; text-shadow: 0 0 5px var(--border-shadow);
                display: flex; justify-content: space-between; align-items: center;
            }
            .header-decoration {
                display: block; width: 20px; height: 10px;
                background: linear-gradient(45deg, var(--text-accent) 25%, transparent 25%), linear-gradient(-45deg, var(--text-accent) 25%, transparent 25%);
                background-size: 10px 10px;
            }
            #randomizer-content { padding: 15px; display: flex; flex-direction: column; gap: 12px; }
            .randomizer-input {
                width: 100%; padding: 8px; border: 2px solid var(--border-color);
                background-color: var(--bg-input); color: var(--text-header);
                font-family: var(--pixel-font); font-size: 12px;
                caret-color: var(--text-light); border-radius: 0;
            }
            .randomizer-input:focus { outline: none; box-shadow: 0 0 8px var(--text-light); }
            .setting-row { display: flex; align-items: center; gap: 10px; }
            .setting-row label { font-size: 10px; width: 100px; text-shadow: 1px 1px 2px var(--bg-main); flex-shrink: 0; }
            .input-with-button { display: flex; width: 100%; }
            .input-with-button .randomizer-input { border-right: none; }
            .inline-button {
                font-family: var(--pixel-font); font-size: 10px;
                background-color: var(--bg-panel); color: var(--text-accent);
                border: 2px solid var(--border-color); padding: 0 10px;
                cursor: pointer; transition: all 0.1s ease;
            }
            .inline-button:hover { background-color: var(--text-accent); color: var(--bg-main); }

            .separator { text-align: center; font-size: 10px; color: var(--text-accent); margin: 5px 0; }
            #modifier-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

            .checkbox-row input[type="checkbox"] { display: none; }
            .checkbox-row label {
                font-size: 10px; cursor: pointer; user-select: none;
                display: block; text-align: center;
                padding: 8px; border: 2px solid var(--border-color);
                background-color: var(--bg-input);
                transition: all 0.1s ease;
            }
            .checkbox-row input:checked + label {
                background-color: var(--text-light); color: var(--bg-main);
                box-shadow: 0 0 10px var(--text-light);
            }
            .checkbox-row input:disabled + label {
                background-color: #333; border-color: #555; color: #777;
                cursor: not-allowed; text-decoration: line-through;
            }

            #create-battle-button {
                font-family: var(--pixel-font); font-size: 16px; text-transform: uppercase;
                padding: 12px; color: var(--text-header); border: 2px solid var(--border-color);
                background-color: var(--bg-panel); cursor: pointer;
                transition: all 0.2s ease; text-shadow: 0 0 5px var(--border-shadow);
                box-shadow: 0 0 10px var(--border-shadow) inset;
            }
            #create-battle-button:hover:not(:disabled) {
                background-color: var(--text-light); color: var(--bg-main);
                box-shadow: 0 0 20px var(--text-light);
            }
            #create-battle-button:disabled {
                background-color: #222; border-color: #555; color: #777;
                cursor: not-allowed; box-shadow: none; text-shadow: none;
            }

            #randomizer-status {
                height: 90px; background-color: #0c0c16; color: var(--text-accent);
                border: none; border-top: 2px solid var(--border-color);
                font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; font-size: 12px;
                resize: vertical; padding: 10px;
            }
        `);

        const elements = {
            createBattleButton: document.getElementById('create-battle-button'), playerCountSelect: document.getElementById('player-count-select'),
            targetValueInput: document.getElementById('target-value-input'), maxCasesInput: document.getElementById('max-cases-input'),
            privateBattleToggle: document.getElementById('private-battle-toggle'), autocallBotsToggle: document.getElementById('autocall-bots-toggle'),
            cataclysmToggle: document.getElementById('cataclysm-mode-toggle'), timeshiftToggle: document.getElementById('timeshift-mode-toggle'),
            allInButton: document.getElementById('all-in-button'), header: document.getElementById('randomizer-header'),
        };

        function fetchAPI(url, method = 'GET', data = null) { return new Promise((resolve, reject) => { GM_xmlhttpRequest({ method, url, data: data ? JSON.stringify(data) : null, headers: { "Content-Type": "application/json" }, onload: r => (r.status >= 200 && r.status < 300) ? resolve(r.response) : reject(`API Error: ${r.statusText} (${r.status})`), onerror: e => reject(`Request Failed: ${e.statusText}`) }); }); }
        async function getBuildId() { const html = await fetch(window.location.href).then(res => res.text()); const match = html.match(/"buildId":"([^"]+)"/); if (!match) throw new Error("Build ID not found."); return match[1]; }

        elements.targetValueInput.addEventListener('input', (e) => { const input = e.target; let value = input.value.replace(/[^0-9]/g, ''); input.value = value ? parseInt(value, 10).toLocaleString('en-US') : ''; });

        async function goAllIn() {
            logStatus("FETCHING YOUR BALANCE...");
            try {
                const meData = JSON.parse(await fetchAPI('https://case-clicker.com/api/me'));
                const money = meData?.money || 0;
                elements.targetValueInput.value = Math.floor(money).toLocaleString('en-US');
                logStatus("BALANCE LOADED!");
            } catch (error) {
                logStatus(`ERROR FETCHING BALANCE.`, true);
            }
        }
        elements.allInButton.addEventListener('click', goAllIn);

        function callBots(gameId, playerCount) {
            logStatus(`CALLING ${playerCount - 1} BOTS TO GAME ${gameId}...`);
            for (let i = 1; i < playerCount; i++) {
                setTimeout(() => { gameSocket.send(`42${JSON.stringify(["joinGame", { session: null, gameId, bot: true, index: i }])}`); }, i * 200);
            }
        }

        async function createRandomBattle() {
            logStatus("BUILDING BATTLE...");
            elements.createBattleButton.disabled = true;
            try {
                if (!isSocketOpen) { throw new Error("GAME WEBSOCKET NOT OPEN."); }
                const playerCount = parseInt(elements.playerCountSelect.value, 10);
                const isPrivate = elements.privateBattleToggle.checked;
                const isTimeshift = elements.timeshiftToggle.checked;
                let teams = 1;
                if ((playerCount === 4 || playerCount === 6) && Math.random() < 0.5) teams = 2;

                let mode = "standard", isCrazyMode = false;
                if (elements.cataclysmToggle.checked) {
                    isCrazyMode = Math.random() < 0.5;
                    mode = Math.random() < 0.5 ? "terminal" : "standard";
                    if (!isCrazyMode && mode === "standard") { isCrazyMode = Math.random() < 0.5; }
                    logStatus(`CATACLYSM: CRAZY=${isCrazyMode}, TERMINAL=${mode === "terminal"}`);
                }

                if (elements.autocallBotsToggle.checked) {
                    const findGameIdListener = (event) => {
                        try {
                            if (!event.data.startsWith('42')) return;
                            const data = JSON.parse(event.data.slice(2));
                            if ((data[0] === 'newGame' || data[0] === 'createGame') && data[1]?._id) {
                                logStatus(`GAME ID: ${data[1]._id}`);
                                callBots(data[1]._id, playerCount);
                                gameSocket.removeEventListener('message', findGameIdListener);
                            }
                        } catch (e) { /* Ignore */ }
                    };
                    gameSocket.addEventListener('message', findGameIdListener);
                }

                const targetValue = parseFloat(elements.targetValueInput.value.replace(/,/g, '')) || 0;
                const maxCasesInput = parseInt(elements.maxCasesInput.value, 10);
                if (maxCasesInput > maxBattleCases) { throw new Error(`CASE COUNT EXCEEDS LIMIT OF ${maxBattleCases}.`); }

                const affordableCases = ALL_CASES.filter(c => c.price > 0 && c.price <= targetValue);
                if (affordableCases.length === 0) { throw new Error(`NO CASES FOUND UNDER $${targetValue.toLocaleString()}`); }
                let selectedCases = [], currentValue = 0;
                for (let i = 0; i < maxCasesInput; i++) {
                    const remainingValue = targetValue - currentValue;
                    if (remainingValue <= 0) break;
                    const potentialPicks = affordableCases.filter(c => c.price <= remainingValue);
                    if (potentialPicks.length === 0) break;
                    const randomPick = potentialPicks[Math.floor(Math.random() * potentialPicks.length)];
                    selectedCases.push(randomPick);
                    currentValue += randomPick.price;
                }
                logStatus(`SELECTED ${selectedCases.length} CASES FOR $${currentValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}.`);

                const payload = { teams, playerCount, isPrivate, battlePrice: currentValue, cases: selectedCases.map(c => ({ ...c, count: 1 })), mode, isCrazyMode, isTimeshift };
                gameSocket.send(`42${JSON.stringify(["createGame", payload])}`);
                logStatus(`SENDING CREATE REQUEST...`);
                if (!elements.autocallBotsToggle.checked) { GM_notification({ title: 'BATTLE REQUEST SENT!', text: `BATTLE CREATED. BOTS NOT CALLED.`, timeout: 5000 }); }
            } catch (error) { logStatus(`ERROR: ${error.message || error}`, true); }
            finally { updateButtonState(); }
        }

        async function applyMembershipLimits() {
            try {
                const meData = JSON.parse(await fetchAPI('https://case-clicker.com/api/me'));
                const userIsPro = meData?.pro || false;
                const userHasCB = meData?.boughtPackages?.includes('casebattle_package') || false;
                if (userHasCB) { maxBattleCases = 200; }
                else if (userIsPro) { maxBattleCases = 100; }
                else { maxBattleCases = 50; }
                logStatus(`MEMBERSHIP: PRO=${userIsPro}, CB+=${userHasCB}. MAX CASES: ${maxBattleCases}.`);
                elements.maxCasesInput.max = maxBattleCases;
                if (elements.maxCasesInput.value > maxBattleCases) { elements.maxCasesInput.value = maxBattleCases; }
                if (!userHasCB) {
                    logStatus("CB+ NOT FOUND, DISABLING MODES.");
                    Array.from(elements.playerCountSelect.options).forEach(opt => { if (opt.value === '5' || opt.value === '6') opt.disabled = true; });
                    elements.timeshiftToggle.disabled = true;
                    elements.timeshiftToggle.checked = false;
                }
            } catch (error) { logStatus(`MEMBERSHIP CHECK FAILED: ${error.message || error}`, true); }
        }

        async function fetchCaseData() {
            try {
                logStatus("FETCHING CASE DATA...");
                const buildId = await getBuildId();
                const battleDataUrl = `https://case-clicker.com/_next/data/${buildId}/en/game/casebattle.json`;
                const response = await fetchAPI(battleDataUrl);
                const data = JSON.parse(response);
                if (data?.pageProps?.customCases) {
                    ALL_CASES = JSON.parse(data.pageProps.customCases);
                    areCasesLoaded = true;
                    logStatus(`LOADED ${ALL_CASES.length} PUBLIC CASES.`);
                    updateButtonState();
                } else { throw new Error("UNEXPECTED CASE DATA STRUCTURE."); }
            } catch (error) { logStatus(`ERROR: ${error.message || "A CRITICAL ERROR OCCURRED."}`, true); }
        }

        function makePanelDraggable(panel, header) { let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0; const savedPos = GM_getValue('randomizerPanelPosition'); if (savedPos) { panel.style.top = savedPos.top; panel.style.left = savedPos.left; } else { panel.style.top = '20px'; panel.style.left = '20px'; } header.onmousedown = dragMouseDown; function dragMouseDown(e) { e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; } function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; panel.style.top = (panel.offsetTop - pos2) + "px"; panel.style.left = (panel.offsetLeft - pos1) + "px"; } function closeDragElement() { document.onmouseup = null; document.onmousemove = null; GM_setValue('randomizerPanelPosition', { top: panel.style.top, left: panel.style.left }); } }

        makePanelDraggable(mainPanel, mainPanel.querySelector('#randomizer-header'));
        elements.createBattleButton.addEventListener('click', createRandomBattle);
        const themeObserver = new MutationObserver(() => { const theme = document.body.getAttribute('data-mantine-color-scheme') || 'dark'; mainPanel.setAttribute('data-theme', theme); });
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-mantine-color-scheme'] });
        mainPanel.setAttribute('data-theme', document.body.getAttribute('data-mantine-color-scheme') || 'dark');

        applyMembershipLimits();
        fetchCaseData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();