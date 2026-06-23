// ==UserScript==
// @name         Effects Script
// @namespace    http://tampermonkey.net/
// @version      1.30
// @description  auto use, sell and buy effects
// @author       chunkycheese
// @match        https://case-clicker.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const RARITIES = [
        'Extraordinary',
        'Covert',
        'Classified',
        'Restricted',
        'Mil-Spec Grade'
    ];

    const RARITY_INFO = {
        'Extraordinary': { color: '#e4ae39', buy: 1600 },
        'Covert': { color: '#eb4b4b', buy: 400 },
        'Classified': { color: '#d32ce6', buy: 80 },
        'Restricted': { color: '#8847ff', buy: 40 },
        'Mil-Spec Grade': { color: '#4b69ff', buy: 20 }
    };

    const LOOP_SYMBOL = '⟳';

    const state = {
        effects: [],
        activeByType: {},
        ammu: 0,
        busy: false
    };

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function getEffects() {
         while (true) {
             try {
                 const res = await fetch(`/api/inventory/specialEffects`, {
                     credentials: "include",
                     headers: { "Content-Type": "application/json", "Accept": "*/*" },
                     method: "GET",
                     mode: "cors"
                 });

                 if (res.status === 200) {
                     const data = await res.json();
                     return data.map(s => ({
                         name:s.name,
                         type:s.effect,
                         rarity:s.rarity,
                         rarityColor:s.rarityColor,
                         amount:s.amount,
                         duration:s.durationMinutes,
                         id:s._id
                     }));
                 }
                 await delay(150);
             } catch (err) {
                 //console.error('[Effects Script] getEffects failed', err);
             }
         }
    }

    async function getAmmu() {
         while (true) {
             try {
                 const res = await fetch(`/api/me`, {
                     method: "GET",
                     headers: { "Content-Type": "application/json" },
                 });

                 if (res.status === 200) {
                     const data = await res.json();
                     return data.ammu;
                 }
                 await delay(150);
             } catch (err) {
                 //console.error('[Effects Script] getAmmu failed', err);
             }
         }
    }

    async function sellEffect(name, amount) {
         while (true) {
             try {
                 const res = await fetch(`/api/inventory/specialEffects`, {
                     credentials: "include",
                     headers: { "Content-Type": "application/json", "Accept": "*/*" },
                     body: JSON.stringify({ name, amount }),
                     method: "DELETE",
                     mode: "cors"
                 });

                 if (res.status === 200) {
                     return;
                 }
                 await delay(150);
             } catch (err) {
                 //console.error('[Effects Script] sellEffect failed', err);
             }
         }
    }

    async function buyEffect(name) {
         while (true) {
             try {
                 const res = await fetch(`/api/inventory/specialEffects`, {
                     credentials: "include",
                     headers: { "Content-Type": "application/json", "Accept": "*/*" },
                     body: JSON.stringify({ name }),
                     method: "PUT",
                     mode: "cors"
                 });

                 if (res.status === 200) {
                     return;
                 }
                 await delay(150);
             } catch (err) {
                 //console.error('[Effects Script] buyEffect failed', err);
             }
         }
    }

    async function useEffect(name) {
         while (true) {
             try {
                 const res = await fetch(`/api/inventory/specialEffects`, {
                     credentials: "include",
                     headers: { "Content-Type": "application/json", "Accept": "*/*" },
                     body: JSON.stringify({ name }),
                     method: "POST",
                     mode: "cors"
                 });

                 if (res.status === 200) {
                     return;
                 }
                 await delay(150);
             } catch (err) {
                 //console.error('[Effects Script] useEffect failed', err);
             }
         }
    }

    function rarityRank(rarity) {
        const index = RARITIES.indexOf(rarity);
        return index === -1 ? 999 : index;
    }

    function rarityInfo(effect) {
        const fallback = { color: effect.rarityColor || '#b0c3d9', buy: 0 };
        return RARITY_INFO[effect.rarity] || fallback;
    }

    function buyPrice(effect) {
        return rarityInfo(effect).buy;
    }

    function sellPrice(effect) {
        return Math.floor(buyPrice(effect) / 4);
    }

    function price(value) {
        return String(Math.floor(Number(value || 0)));
    }

    function humanType(type) {
        return String(type || 'Unknown')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function changeEffectAmount(name, delta) {
        const effect = state.effects.find(item => item.name === name);
        if (!effect) return;

        effect.amount = Math.max(0, Number(effect.amount || 0) + delta);
    }

    function changeAmmu(delta) {
        state.ammu = Math.max(0, Number(state.ammu || 0) + delta);
        renderAmmu();
    }

    function formatDuration(minutes) {
        const total = Number(minutes || 0);
        if (total < 60) return `${total}m`;

        const hours = Math.floor(total / 60);
        const mins = total % 60;
        return mins ? `${hours}h ${mins}m` : `${hours}h`;
    }

    function formatTimeLeft(ms) {
        const seconds = Math.max(0, Math.ceil(ms / 1000));
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;

        if (hours) return `${hours}h ${String(remMins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
        return `${remMins}m ${String(secs).padStart(2, '0')}s`;
    }

    function sortedEffects() {
        return [...state.effects].sort((a, b) => {
            const typeCompare = String(a.type).localeCompare(String(b.type));
            if (typeCompare) return typeCompare;

            const rarityCompare = rarityRank(a.rarity) - rarityRank(b.rarity);
            if (rarityCompare) return rarityCompare;

            return String(a.name).localeCompare(String(b.name));
        });
    }

    function uniqueTypes() {
        return [...new Set(state.effects.map(effect => effect.type))].sort();
    }

    function selectedType() {
        return document.getElementById('se-type-filter').value;
    }

    function selectedRarity() {
        return document.getElementById('se-rarity-filter').value;
    }

    function filteredEffects() {
        const type = selectedType();
        const rarity = selectedRarity();

        return sortedEffects().filter(effect => {
            if (type && effect.type !== type) return false;
            if (rarity && effect.rarity !== rarity) return false;
            return true;
        });
    }

    function setStatus(message, isError) {
        const status = document.getElementById('se-status');
        if (!status) return;

        status.textContent = message || '';
        status.style.color = isError ? '#ff8e8e' : '#9ad';
    }

    function setBusy(value) {
        state.busy = value;
        document.getElementById('special-effects-manager-root').classList.toggle('se-busy', value);
    }

    function renderAmmu() {
        const node = document.getElementById('se-ammu');
        if (!node) return;

        node.textContent = `Current Ammu: ${price(state.ammu)}`;
    }

    async function runAction(message, fn) {
        if (state.busy) return;

        setBusy(true);
        setStatus(message);
        try {
            await fn();
            renderFilters();
            renderEffects();
            renderAmmu();
            renderActivePopout();
        } catch (err) {
            console.error('[Effects Script] action failed', err);
            setStatus(`Error: ${err && err.message ? err.message : err}`, true);
        } finally {
            setBusy(false);
        }
    }

    function createManagerUI() {
        if (document.getElementById('special-effects-manager-root')) return;

        const root = document.createElement('div');
        root.id = 'special-effects-manager-root';
        root.innerHTML = `
            <button id="special-effects-toggle" type="button" title="Special Effects">✦</button>
            <div id="special-effects-panel" style="display:none;">
                <div id="se-header">Special Effects</div>

                <div class="se-filter-row">
                    <select id="se-type-filter" class="se-input"></select>
                    <select id="se-rarity-filter" class="se-input"></select>
                </div>

                <div class="se-actions">
                    <button id="se-refresh-btn" type="button">⟳</button>
                    <button id="se-sell-matching-btn" class="se-sell-btn" type="button">Sell Matching</button>
                    <button id="se-active-popout-btn" type="button">Active</button>
                    <div id="se-ammu">Current Ammu: 0</div>
                </div>

                <div id="se-status"></div>
                <div id="se-list"></div>
            </div>
            <div id="se-active-popout" style="display:none;">
                <div id="se-active-popout-header">
                    <span>Active Effects</span>
                    <button id="se-active-popout-close" type="button">x</button>
                </div>
                <div id="se-active-popout-list"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #special-effects-manager-root {
                position: fixed;
                right: 0;
                bottom: 0;
                z-index: 999999;
                font-family: Arial, sans-serif;
            }

            #special-effects-toggle {
                position: fixed;
                right: 0;
                bottom: 80px;
                width: 32px;
                height: 32px;
                padding: 0;
                margin: 0;
                border: 1px solid #444;
                border-right: 0;
                border-top-left-radius: 10px;
                border-bottom-left-radius: 10px;
                background: #111;
                color: #fff;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                box-shadow: 0 4px 12px rgba(0,0,0,0.35);
                z-index: 1000002;
            }

            #special-effects-panel {
                position: fixed;
                right: 16px;
                bottom: 16px;
                width: min(500px, calc(100vw - 32px));
                max-height: calc(100vh - 48px);
                flex-direction: column;
                background: rgba(20, 20, 20, 0.97);
                color: #eee;
                border: 1px solid #444;
                border-radius: 10px;
                padding: 10px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                box-sizing: border-box;
                overflow: hidden;
                z-index: 1000001;
            }

            #se-header {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 8px;
            }

            .se-filter-row,
            .se-actions,
            .se-effect-actions {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: stretch;
            }

            .se-filter-row {
                margin-bottom: 6px;
            }

            .se-actions {
                margin-top: 8px;
                align-items: center;
            }

            .se-input {
                min-width: 0;
                box-sizing: border-box;
                padding: 5px 7px;
                border-radius: 6px;
                border: 1px solid #555;
                background: #111;
                color: #fff;
                font-size: 12px;
            }

            #se-type-filter,
            #se-rarity-filter {
                flex: 1 1 150px;
            }

            #se-ammu {
                margin-left: auto;
                display: flex;
                align-items: center;
                min-height: 28px;
                color: #e4ae39;
                font-size: 12px;
                font-weight: bold;
            }

            #se-status {
                margin-top: 8px;
                font-size: 11px;
                min-height: 14px;
                color: #9ad;
            }

            #se-list {
                margin-top: 8px;
                flex: 1 1 auto;
                min-height: 0;
                overflow: auto;
                border-top: 1px solid #333;
                padding-top: 10px;
            }

            .se-type-group {
                border: 1px solid #333;
                border-radius: 8px;
                margin-bottom: 7px;
                background: rgba(255,255,255,0.03);
                overflow: hidden;
            }

            .se-type-header {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 8px;
                background: rgba(255,255,255,0.045);
                border-bottom: 1px solid #333;
                font-size: 12px;
                font-weight: bold;
            }

            .se-active {
                color: #9ad;
                font-weight: normal;
                text-align: right;
            }

            .se-effect {
                display: grid;
                grid-template-columns: minmax(150px, 1fr) auto;
                gap: 6px;
                align-items: center;
                padding: 5px 8px;
                border-bottom: 1px solid #2a2a2a;
            }

            .se-effect:last-child {
                border-bottom: 0;
            }

            .se-effect-name {
                font-size: 12px;
                font-weight: bold;
                word-break: break-word;
            }

            .se-effect-meta {
                margin-top: 2px;
                font-size: 10px;
                color: #aaa;
            }

            .se-effect-actions {
                justify-content: flex-end;
            }

            #special-effects-panel button {
                background: #222;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                padding: 4px 6px;
                cursor: pointer;
                font-size: 11px;
                line-height: 1.2;
                box-sizing: border-box;
            }

            #special-effects-panel button:disabled,
            .se-busy #special-effects-panel button,
            .se-busy #special-effects-panel input,
            .se-busy #special-effects-panel select {
                opacity: 0.55;
                cursor: default;
            }

            #se-refresh-btn {
                min-width: 28px;
            }

            .se-buy-btn {
                color: #9dffb5 !important;
            }

            .se-sell-btn {
                color: #ff9a9a !important;
            }

            .se-use-btn {
                color: #a9d5ff !important;
            }

            #special-effects-panel .se-loop-btn {
                color: #aaa;
                opacity: 0.55;
            }

            #special-effects-panel .se-loop-btn.se-loop-on {
                color: #fff3a0;
                opacity: 1;
            }

            .se-buy-count {
                width: 42px;
            }

            #se-active-popout {
                position: fixed;
                right: 16px;
                bottom: 16px;
                width: min(360px, calc(100vw - 32px));
                max-height: 220px;
                overflow: hidden;
                background: rgba(20, 20, 20, 0.97);
                color: #eee;
                border: 1px solid #444;
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                box-sizing: border-box;
                z-index: 1000003;
                font-size: 11px;
            }

            #se-active-popout-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 8px;
                border-bottom: 1px solid #333;
                cursor: move;
                user-select: none;
                font-weight: bold;
            }

            #se-active-popout-close {
                width: 22px;
                height: 22px;
                padding: 0;
                background: #222;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                cursor: pointer;
                font-size: 11px;
            }

            #se-active-popout-list {
                max-height: 182px;
                overflow: auto;
                padding: 6px 8px;
            }

            .se-active-row {
                display: grid;
                grid-template-columns: 16px minmax(0, 1fr) auto auto;
                gap: 6px;
                align-items: center;
                padding: 3px 0;
                border-bottom: 1px solid #2a2a2a;
            }

            .se-active-row:last-child {
                border-bottom: 0;
            }

            .se-active-name {
                font-weight: bold;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .se-active-time,
            .se-active-amount,
            .se-active-mode {
                color: #aaa;
                white-space: nowrap;
            }

            @media (max-width: 720px) {
                #special-effects-panel {
                    right: 8px;
                    bottom: 8px;
                    width: calc(100vw - 16px);
                }

                .se-effect {
                    grid-template-columns: 1fr;
                }

                .se-effect-actions {
                    justify-content: flex-start;
                }
            }
        `;

        document.body.appendChild(style);
        document.body.appendChild(root);

        const toggleBtn = document.getElementById('special-effects-toggle');
        const panel = document.getElementById('special-effects-panel');

        toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
            toggleBtn.style.zIndex = panel.style.display === 'none' ? '1000002' : '1000004';
        });

        document.getElementById('se-active-popout-btn').addEventListener('click', () => {
            const popout = document.getElementById('se-active-popout');
            popout.style.display = popout.style.display === 'none' ? 'block' : 'none';
            renderActivePopout();
        });

        document.getElementById('se-active-popout-close').addEventListener('click', () => {
            document.getElementById('se-active-popout').style.display = 'none';
        });

        makeActivePopoutDraggable();

        document.getElementById('se-refresh-btn').addEventListener('click', () => {
            runAction('Refreshing effects and ammu...', refreshAll);
        });

        document.getElementById('se-type-filter').addEventListener('change', renderEffects);
        document.getElementById('se-rarity-filter').addEventListener('change', renderEffects);

        document.getElementById('se-sell-matching-btn').addEventListener('click', () => {
            const type = selectedType();
            const rarity = selectedRarity();
            const label = `${type ? humanType(type) : 'all types'} / ${rarity || 'all rarities'}`;

            if (!confirm(`Sell all owned effects matching ${label}?`)) return;

            runAction('Selling matching effects...', async () => {
                const matches = filteredEffects().filter(effect => Number(effect.amount) > 0);

                for (let i = 0; i < matches.length; i++) {
                    const effect = matches[i];
                    setStatus(`Selling ${effect.amount}x ${effect.name} (${i + 1}/${matches.length})...`);
                    await sellEffect(effect.name, effect.amount);
                    changeAmmu(sellPrice(effect) * Number(effect.amount || 0));
                    changeEffectAmount(effect.name, -Number(effect.amount || 0));
                }
            });
        });

        renderFilters();
        renderEffects();
        renderActivePopout();
    }

    function renderFilters() {
        const typeSelect = document.getElementById('se-type-filter');
        const raritySelect = document.getElementById('se-rarity-filter');
        const oldType = typeSelect.value;
        const oldRarity = raritySelect.value;

        typeSelect.innerHTML = '<option value="">All types</option>';
        uniqueTypes().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = humanType(type);
            typeSelect.appendChild(option);
        });

        raritySelect.innerHTML = '<option value="">All rarities</option>';
        RARITIES.forEach(rarity => {
            const option = document.createElement('option');
            option.value = rarity;
            option.textContent = rarity;
            raritySelect.appendChild(option);
        });

        typeSelect.value = uniqueTypes().includes(oldType) ? oldType : '';
        raritySelect.value = RARITIES.includes(oldRarity) ? oldRarity : '';
    }

    function renderEffects() {
        const list = document.getElementById('se-list');
        const effects = filteredEffects();
        const groups = {};

        effects.forEach(effect => {
            if (!groups[effect.type]) groups[effect.type] = [];
            groups[effect.type].push(effect);
        });

        list.innerHTML = '';

        if (!effects.length) {
            list.innerHTML = '<div class="se-effect-meta">No effects found.</div>';
            return;
        }

        Object.keys(groups).sort().forEach(type => {
            const group = document.createElement('div');
            group.className = 'se-type-group';

            const header = document.createElement('div');
            header.className = 'se-type-header';

            const title = document.createElement('div');
            title.textContent = humanType(type);

            const active = document.createElement('div');
            active.className = 'se-active';
            active.dataset.activeType = type;

            header.appendChild(title);
            header.appendChild(active);
            group.appendChild(header);

            groups[type].forEach(effect => {
                group.appendChild(createEffectRow(effect));
            });

            list.appendChild(group);
        });

        updateActiveDisplays();
    }

    function createEffectRow(effect) {
        const info = rarityInfo(effect);
        const active = state.activeByType[effect.type];
        const typeActive = active && active.endAt > Date.now();
        const thisActive = typeActive && active.name === effect.name;
        const amount = Number(effect.amount || 0);

        const row = document.createElement('div');
        row.className = 'se-effect';

        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'se-effect-name';
        name.textContent = effect.name;
        name.style.color = info.color;

        const meta = document.createElement('div');
        meta.className = 'se-effect-meta';
        meta.textContent = `${effect.rarity} | ${formatDuration(effect.duration)} | Amount: ${amount}`;

        left.appendChild(name);
        left.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'se-effect-actions';

        let loopWanted = Boolean(thisActive && active.loop);
        const loopBtn = document.createElement('button');
        loopBtn.type = 'button';
        loopBtn.className = `se-loop-btn${loopWanted ? ' se-loop-on' : ''}`;
        loopBtn.textContent = 'Loop';
        loopBtn.title = 'Loop after expiry';
        loopBtn.disabled = (amount <= 0 && !thisActive) || (typeActive && !thisActive);
        loopBtn.addEventListener('click', () => {
            loopWanted = !loopWanted;
            loopBtn.classList.toggle('se-loop-on', loopWanted);

            const current = state.activeByType[effect.type];
            if (current && current.name === effect.name) {
                current.loop = loopWanted;
                updateActiveDisplays();
                renderActivePopout();
            }
        });

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'se-use-btn';
        useBtn.textContent = thisActive ? 'Active' : 'Use';
        useBtn.disabled = amount <= 0 || typeActive;
        useBtn.addEventListener('click', () => {
            runAction(`Using ${effect.name}...`, async () => {
                await useEffect(effect.name);
                changeEffectAmount(effect.name, -1);
                state.activeByType[effect.type] = {
                    name: effect.name,
                    type: effect.type,
                    loop: loopWanted,
                    durationMs: Number(effect.duration || 0) * 60 * 1000,
                    endAt: Date.now() + (Number(effect.duration || 0) * 60 * 1000)
                };
            });
        });

        const buyCount = document.createElement('input');
        buyCount.type = 'number';
        buyCount.className = 'se-input se-buy-count';
        buyCount.min = '1';
        buyCount.max = '999';
        buyCount.value = '1';

        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'se-buy-btn';
        buyBtn.textContent = price(buyPrice(effect));
        buyBtn.title = 'Buy';
        buyBtn.addEventListener('click', () => {
            const count = Math.max(1, Math.floor(Number(buyCount.value) || 1));

            runAction(`Buying ${count}x ${effect.name}...`, async () => {
                for (let i = 0; i < count; i++) {
                    setStatus(`Buying ${effect.name} (${i + 1}/${count})...`);
                    await buyEffect(effect.name);
                    changeEffectAmount(effect.name, 1);
                    changeAmmu(-buyPrice(effect));
                }
            });
        });

        const sellBtn = document.createElement('button');
        sellBtn.type = 'button';
        sellBtn.className = 'se-sell-btn';
        sellBtn.textContent = price(sellPrice(effect));
        sellBtn.title = 'Sell one';
        sellBtn.disabled = amount <= 0;
        sellBtn.addEventListener('click', () => {
            runAction(`Selling ${effect.name}...`, async () => {
                await sellEffect(effect.name, 1);
                changeEffectAmount(effect.name, -1);
                changeAmmu(sellPrice(effect));
            });
        });

        const sellAllBtn = document.createElement('button');
        sellAllBtn.type = 'button';
        sellAllBtn.className = 'se-sell-btn';
        sellAllBtn.textContent = price(sellPrice(effect) * amount);
        sellAllBtn.title = 'Sell all';
        sellAllBtn.disabled = amount <= 0;
        sellAllBtn.addEventListener('click', () => {
            runAction(`Selling all ${effect.name}...`, async () => {
                await sellEffect(effect.name, amount);
                changeEffectAmount(effect.name, -amount);
                changeAmmu(sellPrice(effect) * amount);
            });
        });

        actions.appendChild(loopBtn);
        actions.appendChild(useBtn);
        actions.appendChild(buyCount);
        actions.appendChild(buyBtn);
        actions.appendChild(sellBtn);
        actions.appendChild(sellAllBtn);

        row.appendChild(left);
        row.appendChild(actions);
        return row;
    }

    async function refreshEffects() {
        state.effects = await getEffects();
        renderFilters();
        renderEffects();
        setStatus(`Loaded ${state.effects.length} effects.`);
    }

    async function refreshAll() {
        const [effects, ammu] = await Promise.all([getEffects(), getAmmu()]);
        state.effects = effects;
        state.ammu = ammu;
        renderFilters();
        renderEffects();
        renderAmmu();
        renderActivePopout();
        setStatus(`Loaded ${state.effects.length} effects.`);
    }

    async function tickLoops() {
        const now = Date.now();

        for (const type of Object.keys(state.activeByType)) {
            const active = state.activeByType[type];
            if (!active || active.endAt > now || state.busy) continue;

            if (!active.loop) {
                delete state.activeByType[type];
                continue;
            }

            const effect = state.effects.find(item => item.name === active.name);
            if (!effect || Number(effect.amount || 0) <= 0) {
                delete state.activeByType[type];
                setStatus(`Loop stopped: no ${active.name} left.`, true);
                continue;
            }

            setBusy(true);
            setStatus(`Looping ${active.name}...`);
            await useEffect(active.name);
            changeEffectAmount(active.name, -1);
            active.endAt = Date.now() + active.durationMs;
            setBusy(false);
            renderFilters();
            renderEffects();
            renderActivePopout();
        }

        updateActiveDisplays();
        renderActivePopout();
    }

    function updateActiveDisplays() {
        document.querySelectorAll('.se-active').forEach(node => {
            const active = state.activeByType[node.dataset.activeType];

            if (!active) {
                node.textContent = '';
                return;
            }

            const left = formatTimeLeft(active.endAt - Date.now());
            node.textContent = `${active.name}: ${left}${active.loop ? ` ${LOOP_SYMBOL}` : ''}`;
        });
    }

    function makeActivePopoutDraggable() {
        const popout = document.getElementById('se-active-popout');
        const header = document.getElementById('se-active-popout-header');
        if (!popout || !header) return;

        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener('mousedown', event => {
            if (event.target && event.target.id === 'se-active-popout-close') return;

            const rect = popout.getBoundingClientRect();
            dragging = true;
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            popout.style.left = `${rect.left}px`;
            popout.style.top = `${rect.top}px`;
            popout.style.right = 'auto';
            popout.style.bottom = 'auto';
            event.preventDefault();
        });

        document.addEventListener('mousemove', event => {
            if (!dragging) return;

            const maxLeft = window.innerWidth - popout.offsetWidth;
            const maxTop = window.innerHeight - popout.offsetHeight;
            const left = Math.max(0, Math.min(maxLeft, event.clientX - offsetX));
            const top = Math.max(0, Math.min(maxTop, event.clientY - offsetY));

            popout.style.left = `${left}px`;
            popout.style.top = `${top}px`;
        });

        document.addEventListener('mouseup', () => {
            dragging = false;
        });
    }

    function renderActivePopout() {
        const list = document.getElementById('se-active-popout-list');
        if (!list) return;

        const now = Date.now();
        const activeItems = Object.keys(state.activeByType)
            .map(type => state.activeByType[type])
            .filter(active => active && active.endAt > now)
            .sort((a, b) => a.name.localeCompare(b.name));

        list.innerHTML = '';

        if (!activeItems.length) {
            const empty = document.createElement('div');
            empty.className = 'se-active-time';
            empty.textContent = 'No active effects.';
            list.appendChild(empty);
            return;
        }

        activeItems.forEach(active => {
            const effect = state.effects.find(item => item.name === active.name);
            const info = effect ? rarityInfo(effect) : { color: '#b0c3d9' };
            const row = document.createElement('div');
            row.className = 'se-active-row';

            const mode = document.createElement('div');
            mode.className = 'se-active-mode';
            mode.textContent = active.loop ? LOOP_SYMBOL : '>';
            mode.title = active.loop ? 'Looping' : 'Single use';

            const name = document.createElement('div');
            name.className = 'se-active-name';
            name.textContent = active.name;
            name.style.color = info.color;

            const time = document.createElement('div');
            time.className = 'se-active-time';
            time.textContent = formatTimeLeft(active.endAt - now);

            const amount = document.createElement('div');
            amount.className = 'se-active-amount';
            amount.textContent = `x${effect ? Number(effect.amount || 0) : 0}`;

            row.appendChild(mode);
            row.appendChild(name);
            row.appendChild(time);
            row.appendChild(amount);
            list.appendChild(row);
        });
    }

    createManagerUI();
    refreshAll();
    setInterval(tickLoops, 1000);
    setInterval(refreshAll, 60 * 60 * 1000);
})();