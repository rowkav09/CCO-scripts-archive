// ==UserScript==
// @name         !price , !pc , !su pricebot
// @version      1.0
// @author       Zhiro
// @description  !price !pc !su for CCO (i hope it works) . If something goes wrong, check console please. I made the script debug every single thing it does into the console, so if something happens you can dm me the error. (My discord: zhiro999. , don't forget the " . " at the end)
// @match        https://case-clicker.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[PriceBot] LOADED');

    const CMD_PREFIXES = ["!price", "!pc"];
    const SU_PREFIXES = ["!su", "!storage", "!storageunit"];
    const API_BASE = "https://prices.zsb-2bc.workers.dev/api";
    const SITE_BASE = "https://case-clicker.com";

    let PRICE_DB = {};
    let chatSocket = null;
    let allSockets = [];
    const processedIds = new Set();
    const COOLDOWN_MS = 2000;
    let lastReply = 0;

    const getOrigWS = () => {
        try {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.WebSocket) return unsafeWindow.WebSocket;
            if (window.WebSocket) return window.WebSocket;
            if (window.wrappedJSObject?.WebSocket) return window.wrappedJSObject.WebSocket;
        } catch(e) {}
        return null;
    };

    const OrigWS = getOrigWS();
    if (!OrigWS) {
        console.error('[PriceBot] Couldnt hook WebSocket');
        return;
    }

    const wsProxy = function(...args) {
        const ws = new OrigWS(...args);
        allSockets.push(ws);

        ws.addEventListener('message', (evt) => {
            if (typeof evt.data !== 'string' || !evt.data.startsWith('42')) return;
            let json, eventName;
            try {
                json = JSON.parse(evt.data.slice(2));
                eventName = json[0];
            } catch(e) { return; }

            if (eventName === 'newChatMessage' || eventName === 'chatMessage') {
                if (chatSocket !== ws) {
                    chatSocket = ws;
                    console.log('[PriceBot] Chat socket found');
                }

                const payload = json[1];
                if (!payload?.message) return;

                const msg = payload.message;
                const msgId = payload._id || payload.id || null;

                const hasCommand = CMD_PREFIXES.some(cmd => msg.includes(cmd));
                if (hasCommand && msg.includes('openedSkin/')) {
                    handleMessage(msg, msgId);
                }

                const hasSuCommand = SU_PREFIXES.some(cmd => msg.startsWith(cmd));
                if (hasSuCommand) {
                    handleSuCommand(msg, msgId);
                }
            }
        });

        return ws;
    };

    try {
        if (typeof unsafeWindow !== 'undefined') {
            unsafeWindow.WebSocket = wsProxy;
        } else {
            window.WebSocket = wsProxy;
        }
    } catch(e) {
        console.error('[PriceBot] WebSocket hook failed:', e);
        return;
    }

    const loadPrices = () => {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/prices?v=3`,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        PRICE_DB = {};
                        for (const [name, val] of Object.entries(data)) {
                            PRICE_DB[name] = (typeof val === 'object' && val.price != null) ? val.price : val;
                        }
                        console.log('[PriceBot] Prices loaded:', Object.keys(PRICE_DB).length);
                    } catch(e) {
                        console.error('[PriceBot] Parsing error');
                    }
                    resolve();
                },
                onerror: () => {
                    console.error('[PriceBot] Price fetch failed');
                    resolve();
                }
            });
        });
    };

    const getSkinData = async (skinId) => {
        const gmResult = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${SITE_BASE}/api/openedSkin/${skinId}`,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText));
                            return;
                        } catch(e) {}
                    }
                    resolve(null);
                },
                onerror: () => resolve(null),
                timeout: 5000
            });
        });

        if (gmResult) return gmResult;

        try {
            const res = await fetch(`${SITE_BASE}/api/openedSkin/${skinId}`);
            if (res.ok) return await res.json();
        } catch(e) {}

        return null;
    };

    const getStorageUnitSkins = async (suId) => {
        const gmResult = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${SITE_BASE}/api/inventory/storageUnits/skins?id=${suId}&page=1&sort=`,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText));
                            return;
                        } catch(e) {}
                    }
                    resolve(null);
                },
                onerror: () => resolve(null),
                timeout: 5000
            });
        });

        if (gmResult) return gmResult;

        try {
            const res = await fetch(`${SITE_BASE}/api/inventory/storageUnits/skins?id=${suId}&page=1&sort=`);
            if (res.ok) return await res.json();
        } catch(e) {}

        return null;
    };

    const findPrice = (itemName) => {
        let clean = itemName
            .replace(/^★\s?/, '')
            .replace(/\s+/g, ' ')
            .trim();

        const isST = /StatTrak™?/i.test(clean);
        const isSV = /Souvenir/i.test(clean);

        clean = clean
            .replace(/StatTrak™?\s*/i, '')
            .replace(/Souvenir\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        let prefix = '';
        if (isST) prefix = 'ST ';
        if (isSV) prefix = 'SV ';

        if (clean.includes("'")) {
            clean = clean.replace(/'([^']+)'/g, '($1)');
        }

        const full = (prefix + clean).trim();
        const generic = (prefix + clean.replace(/\s\([^)]+\)$/, '')).trim();

        if (PRICE_DB[full]) return PRICE_DB[full];
        if (PRICE_DB[generic]) return PRICE_DB[generic];

        const noPrefixFull = clean.trim();
        const noPrefixGeneric = clean.replace(/\s\([^)]+\)$/, '').trim();

        if (PRICE_DB[noPrefixFull]) return PRICE_DB[noPrefixFull];
        if (PRICE_DB[noPrefixGeneric]) return PRICE_DB[noPrefixGeneric];

        return null;
    };

    const formatPrice = (n) => {
        if (!n || n < 10) return 'QS';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + Math.floor(n).toLocaleString();
    };

    const sendMessage = (msg) => {
        const inp = [...document.querySelectorAll('input')].find(i => i.placeholder === 'Send a message');
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send');

        if (inp && btn) {
            try {
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(inp, msg);
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => btn.click(), 100);
                console.log('[PriceBot] Sent:', msg);
                return true;
            } catch(e) {
                console.error('[PriceBot] DOM send error:', e);
            }
        }

        if (chatSocket?.readyState === 1) {
            chatSocket.send('42["chatMessage", {"message": "' + msg.replace(/"/g, '\\"') + '"}]');
            console.log('[PriceBot] Sent via socket:', msg);
            return true;
        }

        return false;
    };

    let processingMessage = false;

    async function handleMessage(text, msgId) {
        if (msgId && processedIds.has(msgId)) return;
        if (msgId) processedIds.add(msgId);
        if (processedIds.size > 100) processedIds.clear();

        if (Date.now() - lastReply < COOLDOWN_MS) return;
        if (processingMessage) return;

        const skinId = text.match(/openedSkin\/([a-f0-9]{24})/i)?.[1];
        if (!skinId) return;

        console.log('[PriceBot] Processing skin:', skinId);

        processingMessage = true;
        lastReply = Date.now();

        try {
            const skin = await getSkinData(skinId);

            if (!skin || !skin.name) {
                console.error('[PriceBot] Failed to get skin data');
                processingMessage = false;
                return;
            }

            console.log('[PriceBot] Skin:', skin.name);

            const communityPrice = findPrice(skin.name);
            const serverPrice = skin.price || 0;

            if (communityPrice) {
                sendMessage('That skin costs ' + formatPrice(communityPrice));
            } else if (serverPrice > 0) {
                sendMessage('That skin costs ' + formatPrice(serverPrice));
            } else {
                console.log('[PriceBot] No price available');
            }
        } catch(e) {
            console.error('[PriceBot] Error:', e);
        }

        processingMessage = false;
    }

async function handleSuCommand(text, msgId) {
    if (msgId && processedIds.has(msgId)) return;
    if (msgId) processedIds.add(msgId);
    if (processedIds.size > 100) processedIds.clear();

    if (Date.now() - lastReply < COOLDOWN_MS) return;
    if (processingMessage) return;

    const suId = text.match(/([a-f0-9]{24})/i)?.[1];
    if (!suId) return;

    console.log('[PriceBot] Processing SU:', suId);

    processingMessage = true;
    lastReply = Date.now();

    try {
        const data = await getStorageUnitSkins(suId);

        if (!data || !data.skins) {
            console.error('[PriceBot] Failed to get SU data');
            processingMessage = false;
            return;
        }

        const skins = data.skins;

        let totalPrice = 0;

        for (const skin of skins) {
            const communityPrice = findPrice(skin.name);
            if (communityPrice) {
                totalPrice += communityPrice;
            } else {
                totalPrice += (skin.price || 0);
            }
        }

        sendMessage('That su costs ' + formatPrice(totalPrice));

    } catch(e) {
        console.error('[PriceBot] SU error:', e);
    }

    processingMessage = false;
}

    async function init() {
        await loadPrices();

        const waitBody = setInterval(() => {
            if (document.body) {
                clearInterval(waitBody);
                console.log('[PriceBot] Ready, Commands: !price, !pc, !su');
                console.log('[PriceBot] Community prices:', Object.keys(PRICE_DB).length);
            }
        }, 100);

        setInterval(loadPrices, 5 * 60 * 1000);
    }

    init();
})();