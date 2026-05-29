// ==UserScript==
// @name         Case Clicker - P/L Tracker v1
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  profit/loss tracker
// @author       ZSB
// @match        https://case-clicker.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'cc_tracker_start_values';
    const STORAGE_POS_KEY = 'cc_tracker_ui_pos';
    const API_URL = 'https://case-clicker.com/api/me';

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');
        :root {
            --pl-bg: #09090b;
            --pl-panel: #18181b;
            --pl-border: #27272a;
            --pl-text: #e4e4e7;
            --pl-accent: #6366f1;
            --pl-green: #10b981;
            --pl-red: #ef4444;
            --pl-font: 'Inter', sans-serif;
            --pl-mono: 'JetBrains Mono', monospace;
        }
        #pl-tracker-root {
            position: fixed;
            /* Default position if no save is found */
            top: 20px;
            left: 20px;
            width: 280px;
            background: var(--pl-bg);
            border: 1px solid var(--pl-border);
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            color: var(--pl-text);
            font-family: var(--pl-font);
            z-index: 999999;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        #pl-header {
            padding: 12px 16px;
            background: var(--pl-panel);
            border-bottom: 1px solid var(--pl-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: grab;
            user-select: none;
        }
        #pl-header:active { cursor: grabbing; }
        #pl-title { font-weight: 600; font-size: 13px; letter-spacing: 0.5px; }
        #pl-reset-btn {
            background: transparent;
            border: 1px solid var(--pl-border);
            color: var(--pl-text);
            padding: 4px 8px;
            font-size: 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: 0.2s;
        }
        #pl-reset-btn:hover { background: var(--pl-border); color: #fff; }
        #pl-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .pl-row { display: flex; flex-direction: column; gap: 4px; }
        .pl-label { font-size: 11px; color: #a1a1aa; text-transform: uppercase; font-weight: 600; }
        .pl-value { font-family: var(--pl-mono); font-size: 14px; color: #fff; }
        .pl-diff { font-family: var(--pl-mono); font-size: 12px; margin-top: 2px; }
        .pl-diff.positive { color: var(--pl-green); }
        .pl-diff.negative { color: var(--pl-red); }
        .pl-diff.neutral { color: #71717a; }
    `);

    function createUI() {
        const div = document.createElement('div');
        div.id = 'pl-tracker-root';
        div.innerHTML = `
            <div id="pl-header">
                <span id="pl-title">SESSION TRACKER</span>
                <button id="pl-reset-btn">RESET</button>
            </div>
            <div id="pl-content">
                <div class="pl-row">
                    <span class="pl-label">Money</span>
                    <span id="pl-money-curr" class="pl-value">Loading...</span>
                    <span id="pl-money-diff" class="pl-diff neutral">+0</span>
                </div>
                <div class="pl-row">
                    <span class="pl-label">Tokens</span>
                    <span id="pl-tokens-curr" class="pl-value">Loading...</span>
                    <span id="pl-tokens-diff" class="pl-diff neutral">+0</span>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        restorePosition(div);

        div.querySelector('#pl-reset-btn').addEventListener('click', () => {
            resetTracking();
        });

        makeDraggable(div);
    }

    function restorePosition(element) {
        const storedPos = localStorage.getItem(STORAGE_POS_KEY);
        if (storedPos) {
            try {
                const pos = JSON.parse(storedPos);
                if (pos.top && pos.left) {
                    element.style.top = pos.top;
                    element.style.left = pos.left;
                }
            } catch (e) {
                console.error('Error parsing UI position');
            }
        }
    }

    function savePosition(element) {
        const pos = {
            top: element.style.top,
            left: element.style.left
        };
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
    }

    let startData = null;

    function loadStartData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                startData = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse stored tracking data');
            }
        }
    }

    function saveStartData(data) {
        startData = {
            money: data.money,
            tokens: data.tokens,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(startData));
    }

    function resetTracking() {
        startData = null;
        localStorage.removeItem(STORAGE_KEY);
        fetchData();
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function updateUI(currentData) {
        if (!startData) {
            saveStartData(currentData);
        }

        const moneyDiff = currentData.money - startData.money;
        const moneyElem = document.getElementById('pl-money-curr');
        const moneyDiffElem = document.getElementById('pl-money-diff');

        moneyElem.textContent = `$${formatNumber(currentData.money)}`;
        moneyDiffElem.textContent = (moneyDiff >= 0 ? '+' : '') + `$${formatNumber(moneyDiff)}`;
        moneyDiffElem.className = `pl-diff ${moneyDiff > 0 ? 'positive' : moneyDiff < 0 ? 'negative' : 'neutral'}`;

        const tokenDiff = currentData.tokens - startData.tokens;
        const tokenElem = document.getElementById('pl-tokens-curr');
        const tokenDiffElem = document.getElementById('pl-tokens-diff');

        tokenElem.textContent = formatNumber(currentData.tokens);
        tokenDiffElem.textContent = (tokenDiff >= 0 ? '+' : '') + formatNumber(tokenDiff);
        tokenDiffElem.className = `pl-diff ${tokenDiff > 0 ? 'positive' : tokenDiff < 0 ? 'negative' : 'neutral'}`;
    }

    async function fetchData() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();

            if(data && typeof data.money !== 'undefined') {
                updateUI(data);
            }
        } catch (err) {
            console.error('Tracker Error:', err);
        }
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = document.getElementById('pl-header');

        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;

            savePosition(element);
        }
    }

    function init() {
        loadStartData();
        createUI();
        fetchData();
        setInterval(fetchData, 5000);
    }

    init();
})();