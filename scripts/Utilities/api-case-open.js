// ==UserScript==
// @name         API case open
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       Zhiro
// @description  cases go brrr ^^ my discord: zhiro999.
// @match        https://case-clicker.com/*
// @grant        none
// ==/UserScript==

(async () => {
    'use strict';

    const INVENTORY_API = '/api/inventory';
    const OPEN_COUNT = 16;                     // change this value to how many cases you can open per 1 open (for 5k prem it's usually 19, for GE usually 16)
    const OPEN_MULTIPLIER = 1;                 // open multiplier, change this to 2 if you have 5k prem and skillmap upgraded (and actually want to use the multi ^^)
    const SELL_INTERVAL = 3000;                // how many skins the script will auto sell, if you type 4000, after 4000 skins opened it will first search for patterns (for 5 seconds) and then sell everything really fast. Don't put the max amount your inventory can have, it won't be able to keep up.
    const PATTERN_DELAY = 5000;                // how much time the script has to search for patterns in your inventory (be careful with the values, if too low it wont favorite most of the things, if too high you are wasting time)
    const CASE_SELL_DELAY = 100;               // how fast the script sells ALL your cases before starting to open, 100ms is already quick enough so don't change it tbh

    let isRunning = false;
    let shouldAbort = false;
    let caseList = [];

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const fetchJSON = async (url, options = {}) => {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        return response.ok ? response.json() : null;
    };

    const loadCaseList = async () => {
        try {
            const data = await fetchJSON('/api/cases/cases');
            if (data) caseList = data;
        } catch {}
    };

    const getBalance = () => fetchJSON('/api/me');

    const getCases = async () => {
        try {
            const res = await fetch('/api/cases', { credentials: 'include' });
            return res.ok ? res.json() : [];
        } catch {
            return [];
        }
    };

    const buyCase = (id, amount) =>
        fetch('/api/cases', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, amount, type: 'case' })
        });

    const openCase = (caseId, count) =>
        fetch('/api/open/case', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: caseId,
                quickOpen: true,
                count: String(count),
                useEventTickets: false,
                caseOpenMultiplier: OPEN_MULTIPLIER
            })
        });

    const sellSkins = () =>
        fetch(INVENTORY_API, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'price', value: 999999999, currency: 'money' })
        });

    const favoritePatterns = async () => {
        const payload = {
            type: 'filter',
            action: 'favorite',
            filters: { sort: 'price', patterns: 'only' }
        };

        const options = {
            method: 'PATCH',
            mode: 'cors',
            credentials: 'include',
            headers: {
                accept: '/',
                'content-type': 'application/json',
                'x-nextjs-data': '1'
            },
            body: JSON.stringify(payload)
        };

        try {
            await fetch(INVENTORY_API, options);
            await fetch(INVENTORY_API, { ...options, method: 'PUT' });
        } catch {}
    };

    const sellCases = async () => {
        const inventory = await getCases();
        for (const item of inventory) {
            if (shouldAbort) break;
            if (item.amount > 0) {
                await fetch('/api/cases', {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item._id, amount: item.amount, type: 'case' })
                });
                await delay(CASE_SELL_DELAY);
            }
        }
    };

    const sellAllSkins = async () => {
        await favoritePatterns();
        await delay(PATTERN_DELAY);
        try { await sellSkins(); } catch {}
    };

    const waitForRateLimit = async (failCount) => {
        await delay(Math.min(30000, 5000 * (failCount + 1)));
    };

    const startOpen = async (caseId, caseName, casePrice) => {
        if (isRunning) return;
        isRunning = true;
        shouldAbort = false;

        try {
            await sellCases();
            await delay(500);
            if (shouldAbort) return;

            const { money } = await getBalance();
            const quantity = Math.floor(money / casePrice);
            if (quantity <= 0) return;

            const purchase = await buyCase(caseId, quantity);
            if (!purchase.ok) return;
            await delay(500);

            let totalOpened = 0;
            let lastSellPoint = 0;
            let fails = 0;

            while (totalOpened < quantity && !shouldAbort) {
                const count = Math.min(OPEN_COUNT, quantity - totalOpened);
                const response = await openCase(caseId, count);

                if (response.status === 429) {
                    fails++;
                    await waitForRateLimit(fails);
                    continue;
                }

                if (!response.ok) {
                    fails++;
                    if (fails > 5) return;
                    await delay(3000);
                    continue;
                }

                await response.json();
                totalOpened += count;
                fails = 0;

                if (totalOpened - lastSellPoint >= SELL_INTERVAL) {
                    await sellAllSkins();
                    lastSellPoint = totalOpened;
                }
            }

        } catch {} finally {
            if (!shouldAbort) {
                await sellAllSkins();
            }
            isRunning = false;
        }
    };

    const parseCaseInfo = (card) => {
        const text = card.textContent.trim();
        if (/^\d+\.?\d*x\s*$/i.test(text)) return null;

        let match = text.match(/^\d+\s*(.+?)\s*\$([\d.]+)/);
        if (!match) match = text.match(/^(.+?)\s*\$([\d.]+)/);
        if (!match) return null;

        const name = match[1].trim().replace(/^\d+\s*/, '');
        const price = parseFloat(match[2]);
        const found = caseList.find(c => c.name === name);
        return found ? { id: found._id, name, price } : null;
    };

    const showConfirmWindow = (caseName, onYes) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 99999; display: flex;
            align-items: center; justify-content: center;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #1a1a2e; border: 1px solid #30363d; border-radius: 12px;
            padding: 24px; text-align: center; font-family: monospace; color: #c9d1d9;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5); min-width: 320px;
        `;

        box.innerHTML = `
            <div style="font-size:14px;margin-bottom:8px;">Do you really want to start opening</div>
            <div style="color:#58a6ff;font-size:16px;font-weight:bold;margin-bottom:20px;">${caseName}?</div>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="confirm-yes" style="padding:8px 24px;background:#3fb950;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-family:monospace;">Yes</button>
                <button id="confirm-no" style="padding:8px 24px;background:#da3633;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-family:monospace;">No</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        box.querySelector('#confirm-yes').onclick = () => {
            overlay.remove();
            onYes();
        };

        box.querySelector('#confirm-no').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    };

    const addOpenButton = (card, caseData) => {
        if (card.querySelector('.auto-open-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'auto-open-btn';
        btn.textContent = 'Auto Open';
        btn.title = 'Auto open this case';
        btn.style.cssText = `
            position: absolute; top: 4px; left: 4px; z-index: 998;
            cursor: pointer; font-size: 10px; color: #fff;
            background: #1f6feb; border: none; border-radius: 4px;
            padding: 3px 8px; font-family: monospace; font-weight: bold;
            transition: opacity .2s; opacity: 0.85;
        `;
        btn.onmouseenter = () => { btn.style.opacity = '1'; };
        btn.onmouseleave = () => { btn.style.opacity = '0.85'; };

        btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            showConfirmWindow(caseData.name, () => startOpen(caseData.id, caseData.name, caseData.price));
        };

        card.style.position = 'relative';
        card.appendChild(btn);
    };

    const scanCards = () => {
        const path = location.pathname;
        if (!path.includes('/cases')) return;
        if (path.match(/\/cases\/(cases|collections|capsules|keychainCollections)\/.+/i)) return;

        document.querySelectorAll('[class*="Card"]').forEach(card => {
            if (card.querySelector('.auto-open-btn')) return;
            const caseData = parseCaseInfo(card);
            if (!caseData) return;
            addOpenButton(card, caseData);
        });
    };

    await loadCaseList();
    setInterval(loadCaseList, 600000);
    setInterval(scanCards, 200);
    scanCards();
})();