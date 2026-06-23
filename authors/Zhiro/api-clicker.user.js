// ==UserScript==
// @name         API clicker
// @version      1.0
// @author       Zhiro
// @description  clicks stuff
// @match        https://case-clicker.com/*
// @grant        none
// ==/UserScript==

(async () => {
    const BASE = 'https://case-clicker.com/api';
    let isRunning = true;
    let isMinimized = false;
    let autoRefresh = true;
    let currentCpc = 1;
    let lastGoodCpc = 0;
    let errorStreak = 0;
    let dynamicInterval = 60000;
    const MIN_INTERVAL = 60000;
    const MAX_INTERVAL = 300000;
    const REFRESH_INTERVAL = 600000;

    let totals = { money: 0, cases: 0 };
    let startTime = Date.now();

    try {
        const saved = localStorage.getItem('clicker_totals');
        if (saved) {
            const parsed = JSON.parse(saved);
            totals.money = parsed.money || 0;
            totals.cases = parsed.cases || 0;
        }
        const savedTime = localStorage.getItem('clicker_startTime');
        if (savedTime) startTime = parseInt(savedTime);
    } catch(e) {}

    try {
        const savedAutoRefresh = localStorage.getItem('clicker_autoRefresh');
        if (savedAutoRefresh !== null) autoRefresh = savedAutoRefresh === 'true';
    } catch(e) {}

    const saveData = () => {
        localStorage.setItem('clicker_totals', JSON.stringify(totals));
        localStorage.setItem('clicker_startTime', startTime.toString());
        localStorage.setItem('clicker_autoRefresh', autoRefresh.toString());
    };

    setInterval(saveData, 30000);

    let timerInterval = null;
    let refreshTimer = null;

    const PRICE_DB = {
        "Kilowatt Case": 3.10, "Recoil Case": 3.20, "Revolution Case": 3.20,
        "Fracture Case": 3.30, "Dreams And Nightmares Case": 3.80, "Snakebite Case": 3.80,
        "Fever Case": 4.00, "Clutch Case": 4.20, "Prisma Case": 4.50,
        "Prisma 2 Case": 4.60, "CS20 Case": 4.70, "Danger Zone Case": 4.80,
        "Falchion Case": 4.90, "Horizon Case": 4.90, "Shadow Case": 4.90,
        "Gallery Case": 5.30, "Operation Wildfire Case": 6.60, "Revolver Case": 6.60,
        "Spectrum 2 Case": 6.90, "Gamma 2 Case": 7.40, "Operation Vanguard Weapon Case": 7.50,
        "Gamma Case": 7.90, "Spectrum Case": 7.90, "Operation Phoenix Weapon Case": 8.10,
        "Chroma 2 Case": 8.30, "Chroma Case": 8.50, "Chroma 3 Case": 8.50,
        "Winter Offensive Weapon Case": 12.10, "Shattered Web Case": 13.30,
        "Operation Breakout Weapon Case": 13.30, "Operation Broken Fang Case": 13.80,
        "eSports 2013 Winter Case": 16.70, "Huntsman Weapon Case": 16.90,
        "CS:GO Weapon Case 3": 17.10, "CS:GO Weapon Case 2": 20.40,
        "Operation Riptide Case": 20.90, "eSports 2014 Summer Case": 26.60,
        "Glove Case": 28.10, "Operation Hydra Case": 47.80,
        "Operation Bravo Case": 74.30, "eSports 2013 Case": 119.80,
        "CS:GO Weapon Case": 142.90
    };

    const panel = document.createElement('div');
    panel.id = "main-panel";
    panel.style = `position:fixed; top:10px; right:10px; z-index:99999; background:#1a1a2e; color:#eee; padding:12px; border-radius:10px; font-family:monospace; font-size:12px; border:2px solid #f59e0b; width:380px; box-shadow:0 4px 15px rgba(0,0,0,0.5);`;
    panel.innerHTML = `
        <div id="mt-header" style="cursor:move; border-bottom:1px solid #30363d; padding-bottom:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#f59e0b; font-weight:bold">Clicker <span id="cpc-display" style="color:#8b949e; font-size:10px;">CPC:?</span></span>
            <div style="display:flex; align-items:center; gap:6px;">
                <button id="mt-reset" style="background:#8b5cf6; color:#fff; border:none; padding:2px 8px; border-radius:3px; cursor:pointer; font-size:10px; font-weight:bold; font-family:monospace;" title="Reset Stats">RST</button>
                <button id="mt-autorefresh" style="background:#22c55e; color:#000; border:none; padding:2px 8px; border-radius:3px; cursor:pointer; font-size:10px; font-weight:bold; font-family:monospace;">AUTO</button>
                <span id="mt-refresh-countdown" style="color:#f59e0b; font-size:10px;">R:10:00</span>
                <span id="mt-timer" style="color:#8b949e; font-size:11px;">00:00:00</span>
                <button id="mt-minimize" style="background:none; border:none; color:#f59e0b; cursor:pointer; font-weight:bold; font-size:14px; padding:0 5px;">[_]</button>
                <span id="mt-status" style="width:10px; height:10px; border-radius:50%; background:#4ade80"></span>
            </div>
        </div>
        <div id="panel-content">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px;">
                <div style="background:#161b22; padding:6px; border-radius:4px;">Profit: <b id="stat-money" style="color:#f2e05a">$0.00</b></div>
                <div style="background:#161b22; padding:6px; border-radius:4px;">Cases: <b id="stat-cases" style="color:#d299ff">0</b></div>
            </div>
            <div id="mt-console" style="background:#000; height:150px; padding:8px; border-radius:6px; overflow-y:auto; font-size:10px; color:#8b949e; display:flex; flex-direction:column-reverse; border:1px solid #30363d;"></div>
            <button id="mt-start" style="width:100%; margin-top:10px; background:#da3633; color:#fff; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">STOP</button>
        </div>
    `;
    document.body.appendChild(panel);

    let isDragging = false, offsetX, offsetY;
    document.getElementById('mt-header').addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        panel.style.transition = "none";
        offsetX = e.clientX - panel.getBoundingClientRect().left;
        offsetY = e.clientY - panel.getBoundingClientRect().top;
        const onMove = (e) => { panel.style.left = (e.clientX - offsetX) + 'px'; panel.style.top = (e.clientY - offsetY) + 'px'; panel.style.right = 'auto'; };
        const onUp = () => { isDragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    document.getElementById('mt-minimize').onclick = () => {
        isMinimized = !isMinimized;
        const content = document.getElementById('panel-content');
        const btn = document.getElementById('mt-minimize');
        if (isMinimized) { content.style.display = "none"; panel.style.width = "260px"; btn.textContent = "[+]"; }
        else { content.style.display = "block"; panel.style.width = "380px"; btn.textContent = "[_]"; }
    };

    document.getElementById('mt-reset').onclick = () => {
        if (confirm('Reset all stats? (Money: $' + totals.money.toFixed(2) + ', Cases: ' + totals.cases + ')')) {
            totals.money = 0;
            totals.cases = 0;
            startTime = Date.now();
            saveData();
            document.getElementById('stat-money').textContent = '$0.00';
            document.getElementById('stat-cases').textContent = '0';
            document.getElementById('mt-timer').textContent = '00:00:00';
            log('Stats reset', '#8b5cf6');
        }
    };

    const updateRefreshButton = () => {
        const btn = document.getElementById('mt-autorefresh');
        if (autoRefresh) {
            btn.style.background = "#22c55e"; btn.style.color = "#000"; btn.textContent = "AUTO";
        } else {
            btn.style.background = "#374151"; btn.style.color = "#9ca3af"; btn.textContent = "MAN";
        }
    };

    document.getElementById('mt-autorefresh').onclick = () => {
        autoRefresh = !autoRefresh;
        updateRefreshButton();
        saveData();
        if (autoRefresh) { scheduleRefresh(); log("Auto-refresh: ON", "#22c55e"); }
        else { if (refreshTimer) clearTimeout(refreshTimer); log("Auto-refresh: OFF", "#f87171"); }
    };

    const log = (msg, color = "#8b949e") => {
        const entry = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span style="color:#484f58">[${time}]</span> <span style="color:${color}">${msg}</span>`;
        const consoleEl = document.getElementById('mt-console');
        if (consoleEl) {
            consoleEl.prepend(entry);
            while (consoleEl.children.length > 50) consoleEl.lastChild.remove();
        }
    };

    const updateTimer = () => {
        if (!startTime) return;
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('mt-timer');
        if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
    };

    let refreshCountdown = REFRESH_INTERVAL / 1000;
    setInterval(() => {
        refreshCountdown--;
        if (refreshCountdown < 0) refreshCountdown = REFRESH_INTERVAL / 1000;
        const m = Math.floor(refreshCountdown / 60);
        const s = refreshCountdown % 60;
        const el = document.getElementById('mt-refresh-countdown');
        if (el) el.textContent = autoRefresh ? `R:${m}:${s.toString().padStart(2, '0')}` : 'R:OFF';
    }, 1000);

    const getMe = async () => {
        try {
            const r = await fetch(BASE + '/me');
            if (!r.ok) return null;
            const data = await r.json();
            if (data && typeof data.casesPerClick === 'number') return data;
            return null;
        }
        catch { return null; }
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const clickCases = async () => {
        const res = await fetch(BASE + '/caseClick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clicks: 500 })
        });

        if (res.ok) {
            const data = await res.json();
            let caseName = data?.case?.name || '';
            let casePrice = PRICE_DB[caseName] || 10;

            let caseCount = 0;
            for (let key in data) {
                const val = data[key];
                if (typeof val === 'number' && Number.isInteger(val) && val > 0 && val < 1000) {
                    const skip = ['status','code','money','added','balance','casesperclick','moneyperclick',
                                   'casesperclickmaxprice','tokens','xp','premierrating','ammu','premierRank'];
                    if (!skip.includes(key.toLowerCase()) && !key.startsWith('_')) {
                        caseCount = val; break;
                    }
                }
            }

            if (caseCount > 0) {
                let profit = caseCount * casePrice * 0.7;
                totals.cases += caseCount;
                totals.money += profit;
                errorStreak = 0;
                dynamicInterval = MIN_INTERVAL;
                log(`${caseName || 'Case'}: +${caseCount} (+$${profit.toFixed(2)})`, "#3fb950");
            } else {
                log(`0 cases (CPC: ${lastGoodCpc}%)`, "#f59e0b");
            }
            updateStatus('#4ade80');
            return true;
        } else if (res.status === 429) {
            errorStreak++;
            if (errorStreak >= 2) {
                dynamicInterval = Math.min(dynamicInterval * 1.5, MAX_INTERVAL);
            }
            log(`Rate limited (interval: ${Math.round(dynamicInterval/1000)}s)`, "#f87171");
            updateStatus('#f87171');
            return false;
        } else {
            log(`caseClick failed: ${res.status}`, "#f87171");
            updateStatus('#f87171');
            return false;
        }
    };

    const moneyClick = async () => {
        const moneyRes = await fetch(BASE + '/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clicks: 500 })
        });

        if (moneyRes.ok) {
            const moneyData = await moneyRes.json();
            const earned = moneyData.money || moneyData.added || 0;
            if (earned > 0.001) {
                totals.money += earned;
                errorStreak = 0;
                dynamicInterval = MIN_INTERVAL;
                log(`Money: +$${earned.toFixed(2)}`, "#f2e05a");
            }
            updateStatus('#4ade80');
            return true;
        } else if (moneyRes.status === 429) {
            errorStreak++;
            if (errorStreak >= 2) {
                dynamicInterval = Math.min(dynamicInterval * 1.5, MAX_INTERVAL);
            }
            log(`Money rate limited (interval: ${Math.round(dynamicInterval/1000)}s)`, "#f87171");
            updateStatus('#f87171');
            return false;
        } else {
            log(`Money click failed: ${moneyRes.status}`, "#f87171");
            updateStatus('#f87171');
            return false;
        }
    };

    const updateStatus = (color) => {
        const statusEl = document.getElementById('mt-status');
        if (statusEl) statusEl.style.background = color;
    };

    const tick = async () => {
        if (!isRunning) return;
        try {
            const meData = await getMe();

            if (meData && typeof meData.casesPerClick === 'number') {
                currentCpc = meData.casesPerClick;
                lastGoodCpc = currentCpc;
                const cpcEl = document.getElementById('cpc-display');
                if (cpcEl) cpcEl.textContent = `CPC:${currentCpc}%`;
            } else {
                currentCpc = lastGoodCpc || 1;
                log(`getMe failed, using cached CPC: ${currentCpc}%`, "#f59e0b");
            }

            if (meData) {
                const balBefore = meData.money || 0;
                const vRes = await fetch(BASE + '/vault', { method: 'POST' });
                if (vRes.ok) {
                    await sleep(1500);
                    const meAfter = await getMe();
                    if (meAfter) {
                        const diff = (meAfter.money || 0) - balBefore;
                        if (diff > 0.001) {
                            totals.money += diff;
                            log(`Vault: +$${diff.toFixed(2)}`, "#f2e05a");
                        }
                    }
                }
            }

            await sleep(500);

            if (currentCpc >= 10) {
                await clickCases();
            } else {
                const success = await moneyClick();
                if (!success && lastGoodCpc >= 10) {
                    log("Money click failing, switching to caseClick", "#f59e0b");
                    await clickCases();
                }
            }

            const moneyEl = document.getElementById('stat-money');
            const casesEl = document.getElementById('stat-cases');
            if (moneyEl) moneyEl.textContent = `$${totals.money.toFixed(2)}`;
            if (casesEl) casesEl.textContent = totals.cases;

        } catch (e) {
            log("Error: " + e.message, "#f87171");
            errorStreak++;
            if (errorStreak >= 2) {
                dynamicInterval = Math.min(dynamicInterval * 1.5, MAX_INTERVAL);
            }
        }

        if (isRunning) {
            const interval = errorStreak > 3 ? dynamicInterval : MIN_INTERVAL;
            setTimeout(tick, interval);
        }
    };

    const scheduleRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        if (!autoRefresh) return;
        refreshTimer = setTimeout(() => {
            saveData();
            location.reload();
        }, REFRESH_INTERVAL);
    };

    const toggle = () => {
        isRunning = !isRunning;
        const btn = document.getElementById('mt-start');
        if (isRunning) {
            btn.textContent = "STOP"; btn.style.background = "#da3633"; btn.style.color = "#fff";
            errorStreak = 0;
            dynamicInterval = MIN_INTERVAL;
            updateStatus('#4ade80');
            if (autoRefresh) scheduleRefresh();
            log("Resumed", "#f59e0b");
            tick();
        } else {
            btn.textContent = "START"; btn.style.background = "#f59e0b"; btn.style.color = "#000";
            if (refreshTimer) clearTimeout(refreshTimer);
            updateStatus('#555');
            saveData();
            log("Stopped", "#f59e0b");
        }
    };

    document.getElementById('mt-start').onclick = () => toggle();

    const initMe = await getMe();
    if (initMe && typeof initMe.casesPerClick === 'number') {
        currentCpc = initMe.casesPerClick;
        lastGoodCpc = currentCpc;
    }
    document.getElementById('cpc-display').textContent = `CPC:${currentCpc}%`;
    document.getElementById('stat-money').textContent = `$${totals.money.toFixed(2)}`;
    document.getElementById('stat-cases').textContent = totals.cases;
    updateRefreshButton();
    timerInterval = setInterval(updateTimer, 1000);

    log(`Started | CPC: ${currentCpc}% | $${totals.money.toFixed(2)} | ${totals.cases} cases`, "#f59e0b");
    scheduleRefresh();
    tick();
})();
