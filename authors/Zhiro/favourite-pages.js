// ==UserScript==
// @name         Case Clicker Favorites Manager
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Add, organize, rename, and quickly access your favorite cases and game modes with a draggable favorites menu.
// @author       Zhiro
// @match        https://case-clicker.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const storageKey = 'cc_favs';
    let favs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const save = () => localStorage.setItem(storageKey, JSON.stringify(favs));

    const box = document.createElement('div');
    box.id = 'fav-box';
    const s = box.style;
    s.position = 'fixed'; s.top = '10px'; s.right = '10px'; s.zIndex = '9999';
    s.width = '220px'; s.maxHeight = 'calc(100vh - 140px)';
    s.background = 'rgba(13, 17, 23, 0.95)'; s.border = '1px solid #30363d';
    s.borderRadius = '10px'; s.padding = '10px'; s.display = 'flex';
    s.flexDirection = 'column'; s.gap = '6px';
    s.fontFamily = 'monospace'; s.fontSize = '11px'; s.color = '#c9d1d9';
    s.overflowY = 'auto'; s.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    s.userSelect = 'none';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:move';
    const headTitle = document.createElement('span');
    headTitle.textContent = '★ Favorites';
    headTitle.style.cssText = 'color:#f0883e;font-weight:bold;font-size:13px;pointer-events:none';
    head.appendChild(headTitle);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'margin-left:auto;background:#da3633;color:#fff;border:none;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:10px;opacity:0.7';
    clearBtn.onmouseenter = () => clearBtn.style.opacity = '1';
    clearBtn.onmouseleave = () => clearBtn.style.opacity = '0.7';
    clearBtn.onclick = () => { favs = []; save(); render(); refreshStars(); };
    head.appendChild(clearBtn);
    box.appendChild(head);

    const list = document.createElement('div');
    list.id = 'fav-list';
    list.style.cssText = 'display:flex;flex-direction:column;gap:3px';
    box.appendChild(list);
    document.body.appendChild(box);

    const MAX_VISIBLE = 3;
    let expanded = false;

    let dragging = false, offX = 0, offY = 0;
    box.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('#fav-list')) return;
        dragging = true;
        const r = box.getBoundingClientRect();
        offX = e.clientX - r.left;
        offY = e.clientY - r.top;
        box.style.transition = 'none';
        box.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const x = e.clientX - offX;
        const y = e.clientY - offY;
        box.style.left = Math.max(10, Math.min(x, window.innerWidth - box.offsetWidth - 10)) + 'px';
        box.style.top = Math.max(10, Math.min(y, window.innerHeight - box.offsetHeight - 10)) + 'px';
        box.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        box.style.cursor = '';
        box.style.transition = '';
        localStorage.setItem('fav-box-pos', JSON.stringify({ left: box.style.left, top: box.style.top }));
    });
    (() => {
        const saved = JSON.parse(localStorage.getItem('fav-box-pos') || 'null');
        if (saved) { box.style.left = saved.left; box.style.top = saved.top; box.style.right = 'auto'; }
    })();

    function startRename(f, row) {
        const existingInput = row.querySelector('.rename-input');
        if (existingInput) return;

        const nameEl = row.querySelector('.fav-name');
        const oldText = nameEl.textContent;
        nameEl.style.display = 'none';

        const input = document.createElement('input');
        input.className = 'rename-input';
        input.type = 'text';
        input.value = f.name;
        input.style.cssText = 'flex:1;background:#0d1117;border:1px solid #58a6ff;border-radius:5px;padding:4px 8px;font-size:11px;color:#c9d1d9;font-family:monospace;outline:none';

        const confirmBtn = document.createElement('span');
        confirmBtn.textContent = 'Y';
        confirmBtn.style.cssText = 'color:#3fb950;cursor:pointer;font-size:14px;margin-left:4px';
        confirmBtn.title = 'confirm rename';

        const cancelBtn = document.createElement('span');
        cancelBtn.textContent = 'N';
        cancelBtn.style.cssText = 'color:#f85149;cursor:pointer;font-size:14px;margin-left:4px';
        cancelBtn.title = 'cancel rename';

        const finishRename = (newName) => {
            const trimmed = newName.trim();
            if (trimmed && trimmed !== f.name && !favs.some(fv => fv.name === trimmed && fv.url === f.url)) {
                f.name = trimmed;
                save();
                render();
                refreshStars();
            } else {
                nameEl.style.display = '';
                input.remove();
                confirmBtn.remove();
                cancelBtn.remove();
            }
        };

        confirmBtn.onclick = () => finishRename(input.value);
        cancelBtn.onclick = () => {
            nameEl.style.display = '';
            input.remove();
            confirmBtn.remove();
            cancelBtn.remove();
        };
        input.onkeydown = e => {
            if (e.key === 'Enter') finishRename(input.value);
            if (e.key === 'Escape') {
                nameEl.style.display = '';
                input.remove();
                confirmBtn.remove();
                cancelBtn.remove();
            }
        };

        row.insertBefore(input, nameEl.nextSibling);
        row.insertBefore(confirmBtn, input.nextSibling);
        row.insertBefore(cancelBtn, confirmBtn.nextSibling);
        input.focus();
        input.select();
    }

    function render() {
        list.innerHTML = '';
        if (!favs.length) {
            list.innerHTML = '<span style="color:#484f58;font-style:italic;font-size:11px">no favorites yet</span>';
            return;
        }
        const shown = expanded ? favs : favs.slice(0, MAX_VISIBLE);
        shown.forEach(f => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0';

            const nameEl = document.createElement('span');
            nameEl.className = 'fav-name';
            nameEl.textContent = f.name;
            nameEl.title = 'click to open, right click to remove, double click to rename';
            nameEl.style.cssText = 'flex:1;background:#161b22;border:1px solid #30363d;border-radius:5px;padding:4px 8px;font-size:11px;color:#58a6ff;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            nameEl.onclick = () => go(f.name);
            nameEl.oncontextmenu = e => {
                e.preventDefault();
                favs = favs.filter(x => !(x.name === f.name && x.url === f.url));
                save(); render(); refreshStars();
            };
            nameEl.ondblclick = () => startRename(f, row);

            const renameBtn = document.createElement('span');
            renameBtn.textContent = '❤';
            renameBtn.title = 'rename';
            renameBtn.style.cssText = 'color:#8b949e;cursor:pointer;font-size:12px;margin-left:2px';
            renameBtn.onclick = e => {
                e.stopPropagation();
                startRename(f, row);
            };
            renameBtn.onmouseenter = () => renameBtn.style.color = '#58a6ff';
            renameBtn.onmouseleave = () => renameBtn.style.color = '#8b949e';

            const del = document.createElement('span');
            del.textContent = '✕';
            del.title = 'remove';
            del.style.cssText = 'color:#484f58;cursor:pointer;font-size:10px';
            del.onclick = e => {
                e.stopPropagation();
                favs = favs.filter(x => !(x.name === f.name && x.url === f.url));
                save(); render(); refreshStars();
            };

            row.appendChild(nameEl);
            row.appendChild(renameBtn);
            row.appendChild(del);
            list.appendChild(row);
        });

        if (favs.length > MAX_VISIBLE) {
            const tRow = document.createElement('div');
            tRow.style.cssText = 'text-align:center;padding:4px 0';
            const tgl = document.createElement('span');
            tgl.style.cssText = 'color:#8b949e;cursor:pointer;font-size:10px;padding:3px 8px;border-radius:4px';
            tgl.textContent = expanded ? '▲ Show less' : `▼ Show more (${favs.length - MAX_VISIBLE})`;
            tgl.onmouseenter = () => tgl.style.color = '#58a6ff';
            tgl.onmouseleave = () => tgl.style.color = '#8b949e';
            tgl.onclick = () => { expanded = !expanded; render(); };
            tRow.appendChild(tgl);
            list.appendChild(tRow);
        }
    }

    function go(name) {
        const f = favs.find(x => x.name === name);
        location.href = (f && f.url) ? f.url : 'https://case-clicker.com/cases/cases';
    }

    function buildUrl(name) {
        const n = name.toLowerCase();
        if (n.includes('casebattle') || n === 'case battle') return 'https://case-clicker.com/game/casebattle';
        if (n.includes('jackpot')) return 'https://case-clicker.com/game/jackpot';
        if (n.includes('coinflip') || n.includes('coin flip')) return 'https://case-clicker.com/game/coinflip';
        if (n.includes('upgrade')) return 'https://case-clicker.com/game/upgrade';
        if (n.includes('dice')) return 'https://case-clicker.com/game/dice';
        if (n.includes('guess the rank') || n.includes('guess rank')) return 'https://case-clicker.com/game/guess-the-rank';
        if (n.includes('blackjack') || n.includes('black jack')) return 'https://case-clicker.com/game/blackjack';
        if (n.includes('plinko')) return 'https://case-clicker.com/game/plinko';
        if (n.includes('crash')) return 'https://case-clicker.com/game/crash';

        let type = 'cases';
        if (n.includes('collection') && !n.includes('sticker') && !n.includes('keychain') && !n.includes('charm')) type = 'collections';
        if (n.includes('charm') || n.includes('keychain')) type = 'keychainCollections';
        if (n.includes('capsule') || n.includes('sticker') || n.includes('holo') || n.includes('foil')) type = 'capsules';

        return `https://case-clicker.com/cases/${type}/${encodeURIComponent(name)}`;
    }

    function parseName(card) {
        const t = card.textContent.trim();

        if (/^\d+\.?\d*x\s*$/i.test(t)) return '';

        let m = t.match(/^\d+\s*(.+?)\s*\$[\d.]+/);
        if (m) return m[1].trim();
        m = t.match(/^(.+?)\s*\$[\d.]+/);
        if (m) return m[1].trim().replace(/^\d+\s*/, '').replace(/\s+(Silver|Gold Nova|Master Guardian|Distinguished Master|Legendary Eagle|Supreme Master|Global Elite).*$/i, '');
        const lines = t.split(/[\n\r]+/);
        return lines[0] ? lines[0].trim().replace(/^\d+\s*/, '').replace(/\s+(Silver|Gold Nova|Master Guardian|Distinguished Master|Legendary Eagle|Supreme Master|Global Elite).*$/i, '') : '';
    }

    function addStar(card, name) {
        if (card.querySelector('.fav-star')) return;
        const url = buildUrl(name);
        const exists = favs.some(f => f.name === name);
        const star = document.createElement('span');
        star.className = 'fav-star';
        star.textContent = exists ? '★' : '☆';
        star.title = exists ? 'remove' : 'add';
        star.style.cssText = `position:absolute;top:4px;right:4px;z-index:999;cursor:pointer;font-size:18px;color:${exists?'#f0883e':'#484f58'};background:rgba(0,0,0,0.6);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;transition:color .2s`;
        star.onclick = e => {
            e.stopPropagation(); e.preventDefault();
            if (favs.some(f => f.name === name)) favs = favs.filter(f => f.name !== name);
            else favs.push({ name, url });
            save(); render(); refreshStars();
        };
        card.style.position = 'relative';
        card.appendChild(star);
    }

    function refreshStars() {
        document.querySelectorAll('.fav-star').forEach(star => {
            const card = star.parentElement;
            const name = parseName(card);
            const on = favs.some(f => f.name === name);
            star.textContent = on ? '★' : '☆';
            star.style.color = on ? '#f0883e' : '#484f58';
            star.title = on ? 'remove' : 'add';
        });
    }

    function scan() {
        const path = location.pathname;
        if (!path.includes('/cases') && !path.includes('/game')) return;

        const caseDetailMatch = path.match(/\/cases\/(cases|collections|capsules|keychainCollections)\/.+/i);
        if (caseDetailMatch) return;

        document.querySelectorAll('[class*="Card"], [class*="card"]').forEach(card => {
            const name = parseName(card);
            if (!name || name.length < 2 || name.length > 80) return;
            const hasPrice = /\$\d/.test(card.textContent);
            if (path.includes('/game') && hasPrice) return;
            if (path.includes('/cases') && !hasPrice) return;
            addStar(card, name);
        });
    }

    setInterval(scan, 100);
    scan();
    render();
})();