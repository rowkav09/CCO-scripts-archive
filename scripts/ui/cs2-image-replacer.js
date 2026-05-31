// ==UserScript==
// @name         CS2 Image Replacer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Replaces old CSGO Steam CDN images on case-clicker.com with wear-accurate CS2 images from the ByMykel API
// @author       ZSB
// @match        https://case-clicker.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
    'use strict';

    const STEAM_CDN = 'steamcommunity-a.akamaihd.net/economy/image/';
    const BYMYKEL_API = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json';

    const CACHE_KEY = 'cs2_skin_map_v9';
    const CACHE_TTL = 10 * 24 * 60 * 60 * 1000;

    const PREFIXES = ['StatTrak™ ', 'Souvenir ', '★ '];
    const WEAR_RE = /\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/;

    const iconToInfo = {};

    function stripPrefixes(raw) {
        if (!raw) return null;
        let name = raw.trim();
        for (const p of PREFIXES) {
            if (name.startsWith(p)) name = name.slice(p.length);
        }
        return name.trim();
    }

    function stripWear(name) {
        return name ? name.replace(WEAR_RE, '').trim() : null;
    }

    function buildSkinMaps(skins) {
        const wearMap = {};
        const baseMap = {};

        for (const skin of skins) {
            if (!skin.image) continue;

            const mhn = skin.market_hash_name;
            if (mhn && !wearMap[mhn]) {
                wearMap[mhn] = skin.image;
            }

            const base = stripWear(mhn);
            if (base && !baseMap[base]) {
                baseMap[base] = skin.image;
            }

            const nameKey = stripPrefixes(skin.name);
            if (nameKey) {
                if (!wearMap[nameKey]) wearMap[nameKey] = skin.image;
                const nameBase = stripWear(nameKey);
                if (nameBase && !baseMap[nameBase]) baseMap[nameBase] = skin.image;
            }
        }
        return { wearMap, baseMap };
    }

    function fetchSkinMaps() {
        return new Promise((resolve) => {
            const cached = GM_getValue(CACHE_KEY, null);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.ts < CACHE_TTL) {
                        console.log('[CS2] Using cached maps (%d wear, %d base)',
                            Object.keys(parsed.wearMap).length,
                            Object.keys(parsed.baseMap).length);
                        return resolve(parsed);
                    }
                } catch (_) {}
            }

            console.log('[CS2] Fetching skins_not_grouped from ByMykel API…');
            GM_xmlhttpRequest({
                method: 'GET',
                url: BYMYKEL_API,
                onload(res) {
                    try {
                        const skins = JSON.parse(res.responseText);
                        const { wearMap, baseMap } = buildSkinMaps(skins);
                        console.log('[CS2] Built maps: %d wear, %d base',
                            Object.keys(wearMap).length, Object.keys(baseMap).length);
                        const data = { ts: Date.now(), wearMap, baseMap };
                        GM_setValue(CACHE_KEY, JSON.stringify(data));
                        resolve(data);
                    } catch (e) {
                        console.error('[CS2] Parse error:', e);
                        resolve({ wearMap: {}, baseMap: {} });
                    }
                },
                onerror(e) {
                    console.error('[CS2] Fetch error:', e);
                    resolve({ wearMap: {}, baseMap: {} });
                },
            });
        });
    }

    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await origFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

        if (url.includes('/api/inventory') || url.includes('/api/skin')) {
            try {
                const clone = response.clone();
                clone.json().then((data) => processApiItems(data)).catch(() => {});
            } catch (_) {}
        }
        return response;
    };

    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._cs2Url = url;
        return origXHROpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        if (this._cs2Url && (this._cs2Url.includes('/api/inventory') || this._cs2Url.includes('/api/skin'))) {
            this.addEventListener('load', function () {
                try { processApiItems(JSON.parse(this.responseText)); } catch (_) {}
            });
        }
        return origXHRSend.apply(this, args);
    };

    function processApiItems(data) {
        const items = data?.skins || data?.items || (Array.isArray(data) ? data : []);
        let added = 0;
        for (const item of items) {
            if (item.iconUrl && item.name) {
                if (!iconToInfo[item.iconUrl]) {
                    iconToInfo[item.iconUrl] = {
                        baseName: stripWear(stripPrefixes(item.name)),
                        exterior: item.exterior || null,
                    };
                    added++;
                }
            }
        }
        if (added > 0 && window._cs2SkinMaps) {
            requestAnimationFrame(() => replaceImages(window._cs2SkinMaps));
        }
    }

    function lookupImage(baseName, exterior, maps) {
        if (exterior) {
            const wearKey = `${baseName} (${exterior})`;
            if (maps.wearMap[wearKey]) return maps.wearMap[wearKey];
        }
        if (maps.baseMap[baseName]) return maps.baseMap[baseName];
        return null;
    }

    function replaceImages(maps) {
        const images = document.querySelectorAll(`img[src*="${STEAM_CDN}"]`);
        let replaced = 0;

        for (const img of images) {
            if (img.dataset.cs2Replaced) continue;

            let baseName = null;
            let exterior = null;

            const src = img.src;
            const cdnIdx = src.indexOf(STEAM_CDN);
            if (cdnIdx !== -1) {
                const iconSuffix = src.slice(cdnIdx + STEAM_CDN.length);
                const info = iconToInfo[iconSuffix];
                if (info) {
                    baseName = info.baseName;
                    exterior = info.exterior;
                }
            }

            if (!baseName) {
                const alt = img.getAttribute('alt');
                if (alt) {
                    const stripped = stripPrefixes(alt);
                    const wearMatch = stripped ? stripped.match(WEAR_RE) : null;
                    if (wearMatch) {
                        exterior = wearMatch[1];
                        baseName = stripWear(stripped);
                    } else {
                        baseName = stripped;
                    }
                }
            }

            if (!baseName) continue;

            const newUrl = lookupImage(baseName, exterior, maps);
            if (newUrl) {
                img.src = newUrl;
                img.dataset.cs2Replaced = '1';
                replaced++;
            }
        }

        if (replaced > 0) {
            console.log('[CS2] Replaced %d image(s)', replaced);
        }
    }

    function observeDOM(maps) {
        let pending = false;
        const observer = new MutationObserver(() => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                replaceImages(maps);
                pending = false;
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src'],
        });
    }

    async function main() {
        while (!document.body) {
            await new Promise((r) => setTimeout(r, 50));
        }

        await new Promise((r) => setTimeout(r, 1500));

        const maps = await fetchSkinMaps();
        if (Object.keys(maps.wearMap).length === 0) {
            console.warn('[CS2] Skin maps are empty');
            return;
        }

        window._cs2SkinMaps = maps;

        replaceImages(maps);
        observeDOM(maps);

        for (const delay of [2000, 5000, 10000]) {
            setTimeout(() => replaceImages(maps), delay);
        }
    }

    main();
})();