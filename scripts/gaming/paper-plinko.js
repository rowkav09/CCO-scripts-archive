// ==UserScript==
// @name         plinko simulator
// @version      1.0
// @description  creates a new tab in plinko, fully simulating real minigame
// @author       Zhiro
// @match        https://case-clicker.com/game/plinko
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const MULTIPLIERS = [1000, 165, 13, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 13, 165, 1000];
    const WEIGHTS = [0.0001, 0.0005, 0.0020, 0.0200, 0.0500, 0.1200, 0.1500, 0.1200, 0.0660, 0.1200, 0.1500, 0.1200, 0.0500, 0.0200, 0.0020, 0.0005, 0.0001];

    const S = {
        drop: Array.from({ length: 5 }, () => {
            const a = new Audio('https://case-clicker.com/sounds/ball.webm');
            a.volume = 0.3;
            return a;
        }),
        low: Array.from({ length: 8 }, () => {
            const a = new Audio('https://case-clicker.com/sounds/multiplier-low.webm');
            a.volume = 0.15;
            return a;
        }),
        reg: Array.from({ length: 5 }, () => {
            const a = new Audio('https://case-clicker.com/sounds/multiplier-regular.webm');
            a.volume = 0.4;
            return a;
        }),
        big: Array.from({ length: 5 }, () => {
            const a = new Audio('https://case-clicker.com/sounds/multiplier-good.webm');
            a.volume = 0.5;
            return a;
        }),
        _idx: { drop: 0, low: 0, reg: 0, big: 0 }
    };

    function play(k) {
        const list = S[k];
        if (!list) return;
        const audio = list[S._idx[k]];
        audio.pause();
        audio.currentTime = 0;
        audio.play().catch(() => {});
        S._idx[k] = (S._idx[k] + 1) % list.length;
    }

    let balance = 0;
    let initialBalance = 0;
    let bet = 1;
    let ballsCount = 1;
    let activeBalls = [];
    let drawing = false;
    let splashes = new Array(17).fill(0);

    const stats = {
        wagered: 0,
        profit: 0,
        wins: 0,
        losses: 0,
        recent: []
    };

    const buf = { 0: [], 1: [], 2: [], 14: [], 15: [], 16: [] };
    const CW = 760;
    const CH = 580;

    async function getMe() {
        try {
            const res = await fetch('/api/me', { credentials: 'include' }).then(r => r.json());
            balance = Math.floor(res.tokens || 0);
            initialBalance = balance;
            updBalanace();
        } catch {}
    }

    function getTarget() {
        const rng = Math.random();
        let s = 0;
        for (let i = 0; i < WEIGHTS.length; i++) {
            s += WEIGHTS[i];
            if (rng < s) return i;
        }
        return 8;
    }

    function getPeg(r, c) {
        const stepX = (CW - 90) / 16;
        const stepY = (CH - 130) / 17;
        const totalW = (r + 2) * stepX;
        const startX = (CW - totalW) / 2;
        return { x: startX + c * stepX, y: 55 + (r + 1) * stepY };
    }

    function moveBall(b) {
        b.vy += 0.09;
        if (b.vy > 3.4) b.vy = 3.4;
        if (b.vx > 3.4) b.vx = 3.4;
        if (b.vx < -3.4) b.vx = -3.4;

        b.x += b.vx;
        b.y += b.vy;

        const stepX = (CW - 90) / 16;
        const floorY = CH - 75;

        if (b.x - b.r < 45 - stepX / 2) {
            b.x = 45 - stepX / 2 + b.r;
            b.vx = -b.vx * 0.45;
        }
        if (b.x + b.r > CW - 45 + stepX / 2) {
            b.x = CW - 45 + stepX / 2 - b.r;
            b.vx = -b.vx * 0.45;
        }

        if (b.y >= floorY - 15 && b.y <= floorY + 30) {
            for (let i = 0; i <= 17; i++) {
                const wx = 45 + i * stepX - stepX / 2;
                if (Math.abs(b.x - wx) < b.r) {
                    b.vx = (b.x < wx ? -Math.abs(b.vx) : Math.abs(b.vx)) * 0.45;
                }
            }
        }

        for (let r = 0; r < 16; r++) {
            for (let p = 0; p < r + 3; p++) {
                const peg = getPeg(r, p);
                const dx = b.x - peg.x;
                const dy = b.y - peg.y;
                const len = Math.sqrt(dx * dx + dy * dy);

                if (len < 8.5) {
                    const nx = dx / len;
                    const ny = dy / len;
                    const dot = b.vx * nx + b.vy * ny;

                    b.vx = (b.vx - 2 * dot * nx) * 0.48;
                    b.vy = (b.vy - 2 * dot * ny) * 0.48;
                    b.x = peg.x + nx * 8.6;
                    b.y = peg.y + ny * 8.6;
                    b.vx += b.noise[b.nIdx] || 0;
                    b.nIdx++;
                }
            }
        }
    }

    function sim(sx, svx, arr) {
        const p = { x: sx, y: 15, vx: svx, vy: 0, r: 5.5, noise: [], nIdx: 0 };
        let l = 0;
        while (p.y < CH - 57 && l < 2500) {
            moveBall(p);
            l++;
        }
        p.noise.forEach(v => arr.push(v));
        let res = Math.round((p.x - 45) / ((CW - 90) / 16));
        return res < 0 ? 0 : (res > 16 ? 16 : res);
    }

    function check(sx, svx, arr) {
        const p = { x: sx, y: 15, vx: svx, vy: 0, r: 5.5, noise: [...arr], nIdx: 0 };
        let l = 0;
        while (p.y < CH - 57 && l < 2500) {
            moveBall(p);
            l++;
        }
        let res = Math.round((p.x - 45) / ((CW - 90) / 16));
        return res < 0 ? 0 : (res > 16 ? 16 : res);
    }

    function bg() {
        let target = -1;
        for (let t of [0, 1, 2, 14, 15, 16]) {
            if (buf[t].length < 4) { target = t; break; }
        }
        if (target === -1) {
            setTimeout(() => requestAnimationFrame(bg), 400);
            return;
        }
        const m = Math.random() < 0.3 ? 's' : 'c';
        for (let i = 0; i < 20; i++) {
            let cx, cvx;
            if (m === 's') {
                const left = target <= 2;
                cx = CW / 2 + (left ? -20 : 20) + (Math.random() * 8 - 4);
                cvx = left ? -0.6 : 0.6;
            } else {
                cx = CW / 2 + (Math.random() * 40 - 20);
                cvx = Math.random() * 0.6 - 0.3;
            }
            let mem = [];
            if (sim(cx, cvx, mem) === target) {
                buf[target].push({ x: cx, v: cvx, arr: mem });
                break;
            }
        }
        requestAnimationFrame(bg);
    }

    function addBall(canvas, cb) {
        play('drop');
        const slot = getTarget();
        const rare = (slot === 0 || slot === 1 || slot === 2 || slot === 14 || slot === 15 || slot === 16);
        let fx = CW / 2, fvx = 0, track = [];

        if (rare && buf[slot] && buf[slot].length > 0) {
            const d = buf[slot].shift();
            fx = d.x; fvx = d.v; track = d.arr;
        } else {
            fx = CW / 2 + (Math.random() * 25 - 12.5);
            fvx = Math.random() * 0.5 - 0.25;
            if (rare) { for(let n=0;n<100;n++) track.push(Math.random()*0.12-0.06); }
            else {
                let ok = false, c = 0;
                while (!ok && c < 400) {
                    c++;
                    let tx = CW / 2 + (Math.random() * 25 - 12.5);
                    let tvx = Math.random() * 0.5 - 0.25;
                    let tmp = [];
                    let out = sim(tx, tvx, tmp);
                    if (out !== 0 && out !== 1 && out !== 2 && out !== 14 && out !== 15 && out !== 16) {
                        fx = tx; fvx = tvx; track = tmp; ok = true;
                    }
                }
            }
        }

        const finalSlot = check(fx, fvx, track);
        const v = MULTIPLIERS[finalSlot];
        let col = '#3b82f6';
        if (v >= 165) col = '#f59e0b';
        else if (v >= 13) col = '#ef4444';
        else if (v >= 1) col = '#8b5cf6';

        activeBalls.push({ x: fx, y: 15, vx: fvx, vy: 0, r: 5.5, g: col, slot: finalSlot, noise: track, nIdx: 0, cb: cb, done: false });
        if (!drawing) anim(canvas);
    }

    function draw(canvas) {
        const ctx = canvas.getContext('2d');
        const stepX = (CW - 90) / 16;
        const floorY = CH - 75;

        ctx.fillStyle = '#0b0c10';
        ctx.fillRect(0, 0, CW, CH);

        ctx.strokeStyle = '#161920';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(45 - stepX / 2, 25); ctx.lineTo(45 - stepX / 2, floorY);
        ctx.moveTo(CW - 45 + stepX / 2, 25); ctx.lineTo(CW - 45 + stepX / 2, floorY);
        ctx.stroke();

        for (let r = 0; r < 16; r++) {
            for (let p = 0; p < r + 3; p++) {
                const peg = getPeg(r, p);
                ctx.beginPath(); ctx.arc(peg.x, peg.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1.0;
            }
        }

        for (let i = 0; i < 17; i++) {
            const x = 45 + i * stepX;
            const m = MULTIPLIERS[i];
            let col = '#3b82f6';
            if (m >= 165) col = '#f59e0b';
            else if (m >= 13) col = '#ef4444';
            else if (m >= 1) col = '#8b5cf6';

            ctx.fillStyle = col + '15';
            ctx.fillRect(x - (stepX - 5) / 2, floorY, stepX - 5, 40);

            if (splashes[i] > 0) {
                ctx.fillStyle = col + Math.floor(splashes[i] * 99).toString(16).padStart(2, '0');
                ctx.fillRect(x - (stepX - 5) / 2, floorY, stepX - 5, 40);
                ctx.save();
                ctx.shadowColor = col; ctx.shadowBlur = 30 * splashes[i];
                ctx.strokeStyle = col; ctx.lineWidth = 3 * splashes[i];
                ctx.strokeRect(x - (stepX - 5) / 2, floorY, stepX - 5, 40);
                ctx.restore();
            }

            ctx.fillStyle = splashes[i] > 0 ? '#ffffff' : col;
            ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(m + 'x', x, floorY + 24);

            ctx.fillStyle = '#111318';
            ctx.fillRect(x - stepX / 2 - 1, floorY - 15, 2, 55);
        }
    }

    function anim(canvas) {
        if (drawing) return;
        drawing = true;
        function f() {
            activeBalls.forEach(b => {
                if (b.done) return;
                moveBall(b);
                if (b.y >= CH - 53) {
                    b.done = true;
                    let t = Math.round((b.x - 45) / ((CW - 90) / 16));
                    t = t < 0 ? 0 : (t > 16 ? 16 : t);
                    splashes[t] = 1.0;
                    b.cb(t);
                }
            });
            activeBalls = activeBalls.filter(b => !b.done);
            for (let i = 0; i < 17; i++) { if (splashes[i] > 0) splashes[i] -= 0.02; }

            draw(canvas);
            const ctx = canvas.getContext('2d');
            activeBalls.forEach(b => {
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff'; ctx.shadowColor = b.g; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
            });

            if (!activeBalls.length && !splashes.some(s => s > 0)) { drawing = false; draw(canvas); return; }
            requestAnimationFrame(f);
        }
        requestAnimationFrame(f);
    }

    function drop(canvas) {
        const count = Math.min(ballsCount, 50);
        const cost = bet * count;
        if (cost > balance) { msg('not enough tokens', '#ef4444'); return; }

        balance -= cost;
        updBalanace();

        let ready = 0;
        function onEnd(id) {
            const m = MULTIPLIERS[id];
            if (m >= 13) play('big');
            else if (m >= 1) play('reg');
            else play('low');

            const w = Math.floor(bet * m);
            balance += w;
            updBalanace();
            ready++;

            stats.wagered += bet;
            stats.profit += (w - bet);
            if (m >= 1) stats.wins++; else stats.losses++;

            stats.recent.unshift(m);
            if (stats.recent.length > 5) stats.recent.pop();

            updStats();
        }

        anim(canvas);
        for (let i = 0; i < count; i++) { setTimeout(() => addBall(canvas, onEnd), i * 25); }
    }

    function msg(t, c) {
        const e = document.getElementById('psim-msg');
        if (!e) return; e.textContent = t; e.style.color = c || '#a1a1aa';
        clearTimeout(e._t); e._t = setTimeout(() => e.textContent = '', 2500);
    }

    function updBalanace() {
        const e = document.getElementById('psim-tokens');
        if (e) e.textContent = Math.floor(balance).toLocaleString() + " available";
    }

    function getMCol(m) {
        if (m >= 165) return '#f59e0b';
        if (m >= 13) return '#ef4444';
        if (m >= 1) return '#8b5cf6';
        return '#3b82f6';
    }

    function updStats() {
        const w = document.getElementById('st-wagered');
        const p = document.getElementById('st-profit');
        const wn = document.getElementById('st-wins');
        const ls = document.getElementById('st-losses');
        const r = document.getElementById('st-recent');

        if (w) w.textContent = stats.wagered.toLocaleString();
        if (p) {
            p.textContent = stats.profit.toLocaleString();
            p.style.color = stats.profit >= 0 ? '#4ade80' : '#ef4444';
        }
        if (wn) wn.textContent = stats.wins;
        if (ls) ls.textContent = stats.losses;
        if (r) {
            r.innerHTML = '';
            stats.recent.forEach(m => {
                const s = document.createElement('span');
                s.textContent = m + 'x';
                s.style.cssText = `color:${getMCol(m)};background:#1a1c23;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;`;
                r.appendChild(s);
            });
        }
    }

    function ui(root) {
        root.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:20px;padding:20px;background:#090a0f;border-radius:12px;box-sizing:border-box;width:100%;align-items:flex-start;';

        const side = document.createElement('div');
        side.style.cssText = 'width:260px;display:flex;flex-direction:column;gap:14px;font-family:sans-serif;font-size:13px;color:#94a3b8;background:#111319;padding:16px;border-radius:8px;box-sizing:border-box;flex-shrink:0;';

        const bal = document.createElement('div');
        bal.style.cssText = 'display:flex;align-items:center;gap:6px;font-weight:600;color:#f59e0b;font-size:14px;margin-bottom:4px;';
        bal.innerHTML = 'Balance: <span id="psim-tokens" style="color:#fff;">-</span>';
        side.appendChild(bal);

        const bBox = document.createElement('div');
        bBox.innerHTML = '<div style="margin-bottom:6px;font-size:12px;color:#64748b;font-weight:600;">Bet (tokens)</div>';
        const bInp = document.createElement('input');
        bInp.type = 'number'; bInp.min = 1; bInp.value = bet;
        bInp.style.cssText = 'width:100%;background:#090a0f;border:1px solid #222530;color:#fff;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;outline:none;';
        bInp.oninput = () => { bet = Math.max(1, parseInt(bInp.value) || 1); };
        bBox.appendChild(bInp);
        side.appendChild(bBox);

        const aBox = document.createElement('div');
        aBox.innerHTML = '<div style="margin-bottom:6px;font-size:12px;color:#64748b;font-weight:600;">Balls (max 50)</div>';
        const aInp = document.createElement('input');
        aInp.type = 'number'; aInp.min = 1; aInp.max = 50; aInp.value = ballsCount;
        aInp.style.cssText = bInp.style.cssText;
        aInp.oninput = () => { ballsCount = Math.max(1, Math.min(50, parseInt(aInp.value) || 1)); };
        aBox.appendChild(aInp);
        side.appendChild(aBox);

        const btn = document.createElement('button');
        btn.textContent = 'Drop Ball';
        btn.style.cssText = 'background:#f97316;border:none;color:#fff;padding:14px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;margin-top:6px;transition:0.15s;box-shadow:0 4px 12px rgba(249,115,22,0.2);';
        btn.onclick = () => { drop(canvas); };
        side.appendChild(btn);

        const div = document.createElement('div');
        div.style.cssText = 'height:1px;background:#222530;margin:4px 0;';
        side.appendChild(div);

        const stb = document.createElement('div');
        stb.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:13px;';
        stb.innerHTML =
            '<div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:-4px;">Last Multipliers</div>' +
            '<div id="st-recent" style="display:flex;gap:6px;min-height:20px;flex-wrap:wrap;"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">' +
                '<div><div style="color:#64748b;font-size:12px;">Wagered</div><div id="st-wagered" style="color:#fff;font-weight:600;margin-top:2px;">0</div></div>' +
                '<div><div style="color:#64748b;font-size:12px;">Profit</div><div id="st-profit" style="color:#fff;font-weight:600;margin-top:2px;">0</div></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                '<div><div style="color:#64748b;font-size:12px;">Wins</div><div id="st-wins" style="color:#4ade80;font-weight:600;margin-top:2px;">0</div></div>' +
                '<div><div style="color:#64748b;font-size:12px;">Loses</div><div id="st-losses" style="color:#ef4444;font-weight:600;margin-top:2px;">0</div></div>' +
            '</div>';
        side.appendChild(stb);

        const rBox = document.createElement('div');
        rBox.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;background:#0b0c10;border-radius:8px;padding:10px;box-sizing:border-box;border:1px solid #161920;';

        const canvas = document.createElement('canvas');
        canvas.width = CW; canvas.height = CH;
        canvas.style.cssText = 'border-radius:6px;display:block;width:100%;height:auto;max-width:760px;';
        rBox.appendChild(canvas);

        wrap.appendChild(side);
        wrap.appendChild(rBox);
        root.appendChild(wrap);

        draw(canvas);
        updBalanace();
        updStats();
    }

    function hook() {
        if (document.getElementById('psim-tab')) return;
        const anchor = document.getElementById('plinko');
        if (!anchor) return;

        const mainCard = anchor.parentElement && anchor.parentElement.parentElement;
        if (!mainCard) return;

        const grid = mainCard.parentElement;
        if (!grid) return;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;clear:both;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid #222530;';

        function makeTab(title, active) {
            const t = document.createElement('button');
            t.textContent = title;
            t.style.cssText = 'background:transparent;border:none;border-bottom:3px solid ' + (active ? '#f97316' : 'transparent') + ';color:' + (active ? '#fff' : '#64748b') + ';padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;';
            return t;
        }

        const t1 = makeTab('Plinko', true);
        const t2 = makeTab('PlinkoV2', false);
        t2.id = 'psim-tab';
        header.appendChild(t1);
        header.appendChild(t2);

        const view = document.createElement('div');
        view.id = 'psim-panel';
        view.style.display = 'none';

        wrapper.appendChild(header);
        wrapper.appendChild(view);
        grid.parentElement.insertBefore(wrapper, grid);

        t2.onclick = function() {
            grid.style.setProperty('display', 'none', 'important');
            view.style.display = 'block';
            t2.style.color = '#fff'; t2.style.borderBottomColor = '#f97316';
            t1.style.color = '#64748b'; t1.style.borderBottomColor = 'transparent';
            if (!view.children.length) ui(view);
        };

        t1.onclick = function() {
            grid.style.display = '';
            view.style.display = 'none';
            t1.style.color = '#fff'; t1.style.borderBottomColor = '#f97316';
            t2.style.color = '#64748b'; t2.style.borderBottomColor = 'transparent';
        };
    }

    requestAnimationFrame(bg);
    getMe();
    new MutationObserver(hook).observe(document.body, { childList: true, subtree: true });
    setTimeout(hook, 1000);
})();