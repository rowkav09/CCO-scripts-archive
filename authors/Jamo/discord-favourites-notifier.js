// ==UserScript==
// @name         CCO Favourites notifier
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Discord notifications for favorited skins via API interception. One-time GUI setup.
// @author       Jamo
// @match        https://case-clicker.com/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant unsafeWindow
// @connect      discord.com
// @connect      discordapp.com
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const BOT_NAME = "CCO Autofavourite notifier";
    const BOT_AVATAR = "https://lh3.googleusercontent.com/a/ACg8ocJkongVbvAgUgHie_W66n8pAEAf7sMiOAmTS8WqfmW504xgxV0=s96-c";
    const TARGET_ENDPOINT = "/api/open/case";
    const STEAM_IMG_BASE = "https://community.cloudflare.steamstatic.com/economy/image/";

    let WEBHOOK_URL = GM_getValue('webhook_url', '');

    // --- GUI STYLES ---
    GM_addStyle(`
        #cco-setup-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
            font-family: sans-serif;
        }
        #cco-setup-modal {
            background: #25262b; border: 1px solid #373a40; border-radius: 8px;
            padding: 24px; width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            color: #C1C2C5;
        }
        #cco-setup-modal h2 { margin-top: 0; color: #fff; font-size: 18px; }
        #cco-setup-modal p { font-size: 13px; line-height: 1.4; color: #909296; }
        #cco-webhook-input {
            width: 100%; padding: 10px; margin: 15px 0;
            background: #1a1b1e; border: 1px solid #373a40; border-radius: 4px;
            color: #fff; font-size: 12px; box-sizing: border-box;
        }
        #cco-save-btn {
            width: 100%; padding: 10px; background: #4c6ef5; border: none;
            border-radius: 4px; color: #fff; cursor: pointer; font-weight: 600;
            transition: background 0.2s;
        }
        #cco-save-btn:hover { background: #3b5bdb; }
    `);

    function showSetupGUI() {
        const tryMount = () => {
            if (!document.body) { setTimeout(tryMount, 50); return; }
            const overlay = document.createElement('div');
            overlay.id = 'cco-setup-overlay';
            overlay.innerHTML = `
                <div id="cco-setup-modal">
                    <h2>Setup Required</h2>
                    <p>Please enter your Discord Webhook URL to begin receiving notifications for favorited skins.</p>
                    <input type="text" id="cco-webhook-input" placeholder="https://discord.com/api/webhooks/..." />
                    <button id="cco-save-btn">Save & Start</button>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('cco-save-btn').onclick = function() {
                const val = document.getElementById('cco-webhook-input').value.trim();
                if (val.startsWith('https://discord.com/api/webhooks/')) {
                    GM_setValue('webhook_url', val);
                    WEBHOOK_URL = val;
                    overlay.remove();
                    console.log(`%c[CCO] Webhook saved. Notifier active.`, "color: #00ff00; font-weight: bold;");
                } else {
                    alert("Please enter a valid Discord Webhook URL.");
                }
            };
        };
        tryMount();
    }

    function buildPayload(item) {
        // rarityColor is a hex string like "eb4b4b" — parse to int for Discord
        let embedColor = 5814783; // fallback blurple
        if (item.rarityColor) {
            const parsed = parseInt(item.rarityColor, 16);
            if (!isNaN(parsed)) embedColor = parsed;
        }

        const isKnife = item.type === "Knife" || item.knifeType !== null;
        const hasStickers = Array.isArray(item.stickers) && item.stickers.length > 0;

        let displayTitle = item.name || "Unknown Item";
        if (hasStickers) displayTitle += " (event)";

        const priceStr = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : "Unknown";
        const floatStr = typeof item.float === 'number' ? item.float.toFixed(10) : "Unknown";

        const fields = [
            { name: "Wear", value: item.exterior || "Unknown", inline: true },
            { name: "Price", value: `**${priceStr}**`, inline: true },
            { name: "Rarity", value: item.rarity || "Unknown", inline: true }
        ];

        if (hasStickers) {
            // Stickers shape is unknown in this dataset — handle both string array and object array defensively
            const stickerNames = item.stickers.map(s => {
                if (typeof s === 'string') return s;
                return s.name || s.stickerName || JSON.stringify(s);
            });
            fields.push({ name: "Stickers", value: stickerNames.join(' • '), inline: false });
        }

        fields.push({ name: "Float", value: `\`${floatStr}\``, inline: false });

        if (item.origin && item.origin.name) {
            fields.push({ name: "From", value: item.origin.name, inline: true });
        }

        const imgUrl = item.iconUrl ? STEAM_IMG_BASE + item.iconUrl : null;

        const embed = {
            title: displayTitle,
            color: embedColor,
            fields: fields,
            footer: { text: `${BOT_NAME} • ${new Date().toLocaleTimeString()}`, icon_url: BOT_AVATAR }
        };
        if (imgUrl) embed.thumbnail = { url: imgUrl };

        // Mark knives/StatTrak in author field for visibility
        const tags = [];
        if (isKnife) tags.push("★ Knife");
        if (item.statTrak) tags.push("StatTrak™");
        if (item.souvenir) tags.push("Souvenir");
        if (tags.length > 0) embed.author = { name: tags.join(" • ") };

        return {
            username: BOT_NAME,
            avatar_url: BOT_AVATAR,
            embeds: [embed]
        };
    }

    function sendToDiscord(item) {
        if (!WEBHOOK_URL) return;
        const payload = buildPayload(item);
        GM_xmlhttpRequest({
            method: "POST",
            url: WEBHOOK_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(payload),
            onerror: (e) => console.error("[CCO] Discord webhook error:", e)
        });
    }

// Tracks recently-sent item IDs to prevent fetch+XHR firing the same notification twice
const recentlySent = new Map();
const DEDUPE_WINDOW_MS = 10000; // 10s is plenty — a single case open finishes in <1s

function handleResponseBody(bodyText) {
    if (!bodyText) return;
    let data;
    try {
        data = JSON.parse(bodyText);
    } catch (e) {
        return;
    }

    const favorited = [];
    if (Array.isArray(data.favoritedSkins)) {
        favorited.push(...data.favoritedSkins);
    }
    if (Array.isArray(data.openedSkins)) {
        favorited.push(...data.openedSkins.filter(s => s && s.isFavorite));
    }

    if (favorited.length === 0) return;

    const now = Date.now();
    // Sweep expired entries
    for (const [id, ts] of recentlySent) {
        if (now - ts > DEDUPE_WINDOW_MS) recentlySent.delete(id);
    }

    favorited.forEach(item => {
        const id = item && item._id;
        if (id && recentlySent.has(id)) return; // already sent very recently
        if (id) recentlySent.set(id, now);
        try {
            sendToDiscord(item);
        } catch (e) {
            console.error("[CCO] Error sending item:", e, item);
        }
    });
}

// --- FETCH INTERCEPT ---
// Other userscripts on this site (cco-float-rank-highlighter, ZSB hubs) also wrap fetch.
// We need to hook unsafeWindow.fetch (the page's real fetch) and re-apply if anything overwrites us.
const targetWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

function installFetchHook() {
    const current = targetWindow.fetch;
    if (current && current.__ccoHooked) return; // already wrapped by us

    const original = current;
    const wrapped = function(input, init) {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        const isTarget = url.includes(TARGET_ENDPOINT);
        const promise = original.apply(this, arguments);
        if (!isTarget) return promise;

        return promise.then(response => {
            try {
                response.clone().text()
                    .then(text => handleResponseBody(text))
                    .catch(e => console.warn('[CCO] body read failed:', e));
            } catch (e) {
                console.warn('[CCO] clone failed:', e);
            }
            return response;
        });
    };
    wrapped.__ccoHooked = true;
    targetWindow.fetch = wrapped;
}

installFetchHook();
// Re-install periodically in case another script wraps over us later
setInterval(installFetchHook, 1000);

// --- XHR INTERCEPT ---
const xhrProto = targetWindow.XMLHttpRequest && targetWindow.XMLHttpRequest.prototype;
if (xhrProto && !xhrProto.__ccoHooked) {
    const origOpen = xhrProto.open;
    const origSend = xhrProto.send;
    xhrProto.open = function(method, url) {
        this._ccoUrl = url;
        return origOpen.apply(this, arguments);
    };
    xhrProto.send = function() {
        if (this._ccoUrl && this._ccoUrl.includes && this._ccoUrl.includes(TARGET_ENDPOINT)) {
            this.addEventListener('load', () => {
                try { handleResponseBody(this.responseText); } catch (e) { /* swallow */ }
            });
        }
        return origSend.apply(this, arguments);
    };
    xhrProto.__ccoHooked = true;
}
    // --- MAIN ENTRY POINT ---
    if (!WEBHOOK_URL) {
        // Defer GUI until DOM is ready, but interception is already live
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showSetupGUI);
        } else {
            showSetupGUI();
        }
    }
})();
