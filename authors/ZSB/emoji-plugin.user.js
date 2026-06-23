// ==UserScript==
// @name         CCO Emoji Plugin v1
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  emoji haha 😄
// @author       ZSB
// @match        *://*.case-clicker.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // ===                        EMOJI CONFIGURATION                        ===
    // =========================================================================
    const CUSTOM_EMOJI_MAP = {
        ':zsb:': 'https://i.imgur.com/yNz5ppW.gif',
        ':ultramad:': 'https://i.imgur.com/zWGAlu8.png',
        ':this:': 'https://i.imgur.com/MyL1FSA.png',
        ':catblush:': 'https://i.imgur.com/3EdlO17.png',
        ':thinker:': 'https://i.imgur.com/cQSfIRP.png',
        ':caught:': 'https://i.imgur.com/KjiuYqd.png',
        ':lowintelligence:': 'https://i.imgur.com/W8PdvFc.png',
        ':sadge:': 'https://i.imgur.com/l0sY6jd.png',
        ':shrug:': 'https://i.imgur.com/qCKWfYA.png',
        ':HUH:': 'https://i.imgur.com/uaXDAKB.png',
        ':scam:': 'https://i.imgur.com/202q7NK.png',
        ':mischievous:': 'https://i.imgur.com/P4z8FIX.png',
        ':cinema:': 'https://i.imgur.com/B3QNxiQ.png',
        ':intelligence:': 'https://i.imgur.com/pDc3wQu.png',
        ':LAAHburger:': 'https://i.imgur.com/FLlzSVc.png',
        ':mittensburger:': 'https://i.imgur.com/ThWOox8.png',
        ':best_friend_lost:': 'https://i.imgur.com/MawLY3y.png',
        ':baby:': 'https://i.imgur.com/5F10aQx.png',
        ':goodboy:': 'https://i.imgur.com/nSeHjDi.png',
        ':rules:': 'https://i.imgur.com/ZX2BzB1.png',
        ':bob:': 'https://i.imgur.com/oToueJv.png',
        ':clownskull:': 'https://i.imgur.com/VQIsxgh.png',
        ':pepesad:': 'https://i.imgur.com/So5GZMU.png',
        ':KEK:': 'https://i.imgur.com/lpc8EbC.png',
        ':mackingcheese:': 'https://i.imgur.com/s9jE3qg.png',
        ':catorb:': 'https://i.imgur.com/ZfXL3eq.png',
        ':something:': 'https://i.imgur.com/mwCKeTc.png',
        ':bobgf:': 'https://i.imgur.com/WwVDgce.png',
        ':catstare:': 'https://i.imgur.com/INmHPSg.png',
        ':think:': 'https://i.imgur.com/7OHUWOa.png',
        ':catconfused:': 'https://i.imgur.com/c4SQU8n.png',
        ':robloxcat:': 'https://i.imgur.com/Mw3zr0O.png',
        ':steamhappy:': 'https://i.imgur.com/cLwyGRL.png',
        ':fark_you:': 'https://i.imgur.com/wVlCqIh.png',
        ':yesyes:': 'https://i.imgur.com/M1r9a6b.gif',
        ':nono:': 'https://i.imgur.com/CBmlYsx.gif',
        ':qs:': 'https://i.imgur.com/2fN228K.gif',
        ':gulp:': 'https://i.imgur.com/1aYSJun.gif',
        ':homerhide:': 'https://i.imgur.com/6Q7pBwa.gif',
        ':shu:': 'https://i.imgur.com/pCz2S0G.gif',
        ':WAAA:': 'https://i.imgur.com/UeOV493.gif',
        ':duck:': 'https://i.imgur.com/ztjxhzj.gif',
        ':jamie:': 'https://i.imgur.com/6iQim99.gif',
        ':hellochat:': 'https://i.imgur.com/yxOL36Z.gif',
        ':byechat:': 'https://i.imgur.com/Eivh0Fa.gif',
        ':catkiss:': 'https://i.imgur.com/sfu1vWQ.gif',
        ':ragebaitpass:': 'https://i.imgur.com/1KALMHL.gif',
        ':ragebaitfail:': 'https://i.imgur.com/kFgpauK.gif',
        ':spin:': 'https://i.imgur.com/VM2vKTq.gif',
    };

    const DEFAULT_EMOJI_MAP = {
    ':joy:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f602.png',
    ':rofl:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f923.png',
    ':lol:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f606.png',
    ':sob:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f62d.png',
    ':pleading:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f97a.png',
    ':heart_eyes:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f60d.png',
    ':blush:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f60a.png',
    ':smile:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f604.png',
    ':zany:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f92a.png',
    ':slight_smile:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f642.png',
    ':upside_down:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f643.png',
    ':wink:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f609.png',
    ':kissing_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f618.png',
    ':smiling_face_with_hearts:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f970.png',
    ':star_struck:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f929.png',
    ':thinking:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f914.png',
    ':weary:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f629.png',
    ':cry:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f622.png',
    ':scream:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f631.png',
    ':facepalm:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f926.png',
    ':dshrug:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f937.png',
    ':neutral_face:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f610.png',
    ':expressionless:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f611.png',
    ':unamused:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f612.png',
    ':rolling_eyes:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f644.png',
    ':grimacing:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f62c.png',
    ':lying_face:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f925.png',
    ':relieved:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f60c.png',
    ':pensive:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f614.png',
    ':sleeping:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f634.png',
    ':drooling_face:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f924.png',
    ':nauseated_face:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f922.png',
    ':exploding_head:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f92f.png',
    ':sunglasses:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f60e.png',
    ':nerd:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f913.png',
    ':monocle:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f9d0.png',
    ':confused:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f615.png',
    ':worried:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f61f.png',
    ':frown:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/2639.png',
    ':open_mouth:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f62e.png',
    ':hushed:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f62f.png',
    ':astonished:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f632.png',
    ':flushed:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f633.png',
    ':dizzy_face:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f635.png',
    ':angry:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f620.png',
    ':rage:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f621.png',
    ':cursing:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f92c.png',
    ':cold_sweat:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f613.png',
    ':hot:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f975.png',
    ':cold:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f976.png',
    ':woozy:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f974.png',
    ':partying:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f973.png',
    ':cowboy:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f920.png',
    ':clown:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f921.png',
    ':hugging:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f917.png',
    ':shushing:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f92b.png',
    ':zipper_mouth:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f910.png',
    ':money_mouth:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f911.png',
    ':saluting:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1fae1.png',
    ':melting:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1fae0.png',
    ':pray:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f64f.png',
    ':ok_hand:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f44c.png',
    ':thumbsup:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f44d.png',
    ':thumbsdown:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f44e.png',
    ':clap:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f44f.png',
    ':raised_hands:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f64c.png',
    ':open_hands:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f450.png',
    ':palms_up:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f932.png',
    ':handshake:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f91d.png',
    ':fist:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/270a.png',
    ':wave:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f44b.png',
    ':muscle:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4aa.png',
    ':point_right:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f449.png',
    ':point_left:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f448.png',
    ':point_up:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/261d.png',
    ':point_down:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f447.png',
    ':eyes:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f440.png',
    ':brain:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f9e0.png',
    ':heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/2764.png',
    ':orange_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f9e1.png',
    ':yellow_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f49b.png',
    ':green_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f49a.png',
    ':blue_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f499.png',
    ':purple_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f49c.png',
    ':black_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f5a4.png',
    ':broken_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f494.png',
    ':revolving_hearts:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f49e.png',
    ':two_hearts:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f495.png',
    ':sparkling_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f496.png',
    ':heartbeat:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f493.png',
    ':cupid:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f498.png',
    ':gift_heart:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f49d.png',
    ':100:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4af.png',
    ':anger:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a2.png',
    ':boom:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a5.png',
    ':sweat_drops:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a6.png',
    ':fire:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f525.png',
    ':sparkles:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/2728.png',
    ':star:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/2b50.png',
    ':glowing_star:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f31f.png',
    ':skull:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f480.png',
    ':ghost:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f47b.png',
    ':alien:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f47d.png',
    ':robot:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f916.png',
    ':poop:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a9.png',
    ':see_no_evil:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f648.png',
    ':hear_no_evil:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f649.png',
    ':speak_no_evil:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f64a.png',
    ':gem:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f48e.png',
    ':rocket:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f680.png',
    ':moon:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f319.png',
    ':key:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f511.png',
    ':ok:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f197.png',
    ':cool:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f192.png',
    ':new:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f195.png',
    ':free:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f193.png',
    ':check:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/2705.png',
    ':x:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/274c.png',
    ':bug:': 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f41b.png',
};

    const EMOJI_MAP = { ...DEFAULT_EMOJI_MAP, ...CUSTOM_EMOJI_MAP };
    const CUSTOM_EMOJI_LIST = Object.keys(CUSTOM_EMOJI_MAP).map(key => ({ code: key, url: CUSTOM_EMOJI_MAP[key] }));
    const DEFAULT_EMOJI_LIST = Object.keys(DEFAULT_EMOJI_MAP).map(key => ({ code: key, url: DEFAULT_EMOJI_MAP[key] }));
    const ALL_EMOJI_LIST = Object.keys(EMOJI_MAP).map(key => ({ code: key, url: EMOJI_MAP[key] }));
    const ALL_CODES_REGEX = new RegExp(`(${Object.keys(EMOJI_MAP).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

    // =========================================================================
    // ===                          STYLE INJECTION                          ===
    // =========================================================================
    GM_addStyle(`
        .custom-chat-emoji { height: 22px; width: 22px; vertical-align: middle; margin: -2px 2px 0 2px; }
        #emoji-picker-button { position: absolute; right: 50px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; background: none; cursor: pointer; font-size: 20px; opacity: 0.6; transition: opacity 0.2s; z-index: 5; }
        #emoji-picker-button:hover { opacity: 1; }
        #emoji-panel { position: fixed; z-index: 10001; display: none; flex-direction: column; background-color: rgba(26, 21, 39, 0.95); border: 1px solid #7a5a9b; border-radius: 8px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(10px); min-width: 300px; min-height: 200px; }
        .emoji-panel-header { padding: 8px 12px; cursor: move; background-color: rgba(255, 255, 255, 0.1); color: #f4dfff; font-weight: bold; user-select: none; }
        .emoji-panel-tabs { display: flex; background-color: rgba(0,0,0,0.2); }
        .emoji-panel-tab { flex-grow: 1; padding: 8px; text-align: center; cursor: pointer; color: #bba8d1; font-weight: bold; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .emoji-panel-tab:hover { background-color: rgba(255,255,255,0.1); color: #f4dfff; }
        .emoji-panel-tab.active { color: #fff; border-bottom-color: #79caff; }
        #emoji-grid-container { flex-grow: 1; padding: 10px; display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; overflow-y: auto; }
        .emoji-grid-item { display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background-color 0.2s; }
        .emoji-grid-item:hover { background-color: #4A3763; }
        .emoji-grid-item img { width: 32px; height: 32px; }
        .emoji-panel-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize; background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%); }
    `);

    // =========================================================================
    // ===                             CHAT RENDERING                        ===
    // =========================================================================
    function replaceEmojiInTextElement(textElement) {
        textElement.dataset.emojified = "true";
        const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let currentNode;
        while (currentNode = walker.nextNode()) textNodes.push(currentNode);
        for (const textNode of textNodes) {
            if (textNode.textContent.includes(':')) {
                const parts = textNode.textContent.split(ALL_CODES_REGEX);
                if (parts.length > 1) {
                    const fragment = document.createDocumentFragment();
                    parts.forEach(part => {
                        if (EMOJI_MAP[part]) {
                            const img = document.createElement('img');
                            img.src = EMOJI_MAP[part];
                            img.alt = part;
                            img.className = 'custom-chat-emoji';
                            fragment.appendChild(img);
                        } else if (part) {
                            fragment.appendChild(document.createTextNode(part));
                        }
                    });
                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            }
        }
    }

    function scheduledCheck() {
        const allMessageTextElements = document.querySelectorAll('p[style*="word-break: break-word"]');
        for (const textElement of allMessageTextElements) {
            const parentMessage = textElement.closest('div[class*="mantine-Group-root"][style*="--group-align: flex-start"]');
            if (parentMessage && parentMessage.querySelector('.username-clickable') && !textElement.dataset.emojified) {
                replaceEmojiInTextElement(textElement);
            }
        }
    }


    // =========================================================================
    // ===                         CHAT INPUT                                ===
    // =========================================================================
    let chatInput = null;
    let emojiPanel = null;
    let gridContainer = null;
    let pickerButton = null;
    let panelVisible = false;
    let currentSearchTerm = '';
    let activeTab = 'default';

    function createResizableEmojiPanel() {
        if (document.getElementById('emoji-panel')) return;
        emojiPanel = document.createElement('div');
        emojiPanel.id = 'emoji-panel';
        emojiPanel.innerHTML = `
            <div class="emoji-panel-header">Emoji</div>
            <div class="emoji-panel-tabs">
                <div class="emoji-panel-tab active" data-tab="default">Default</div>
                <div class="emoji-panel-tab" data-tab="custom">Custom</div>
            </div>
            <div id="emoji-grid-container"></div>
            <div class="emoji-panel-resize-handle"></div>
        `;
        document.body.appendChild(emojiPanel);
        gridContainer = document.getElementById('emoji-grid-container');

        emojiPanel.querySelectorAll('.emoji-panel-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        const header = emojiPanel.querySelector('.emoji-panel-header');
        const resizeHandle = emojiPanel.querySelector('.emoji-panel-resize-handle');
        let isDragging = false, isResizing = false;
        let offset = { x: 0, y: 0 }, initialSize = { width: 0, height: 0 };

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset = { x: e.clientX - emojiPanel.offsetLeft, y: e.clientY - emojiPanel.offsetTop };
        });
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            offset = { x: e.clientX, y: e.clientY };
            initialSize = { width: emojiPanel.offsetWidth, height: emojiPanel.offsetHeight };
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                emojiPanel.style.left = `${e.clientX - offset.x}px`;
                emojiPanel.style.top = `${e.clientY - offset.y}px`;
            }
            if (isResizing) {
                const newWidth = initialSize.width + (e.clientX - offset.x);
                const newHeight = initialSize.height + (e.clientY - offset.y);
                emojiPanel.style.width = `${newWidth}px`;
                emojiPanel.style.height = `${newHeight}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                GM_setValue('emojiPanelPosition', { top: emojiPanel.style.top, left: emojiPanel.style.left });
            }
            if (isResizing) {
                isResizing = false;
                GM_setValue('emojiPanelDimensions', { width: emojiPanel.style.width, height: emojiPanel.style.height });
            }
        });

        const savedPos = GM_getValue('emojiPanelPosition');
        if (savedPos) { emojiPanel.style.top = savedPos.top; emojiPanel.style.left = savedPos.left; }
        const savedDims = GM_getValue('emojiPanelDimensions');
        if (savedDims) { emojiPanel.style.width = savedDims.width; emojiPanel.style.height = savedDims.height; }
    }

    function switchTab(tabName) {
        activeTab = tabName;
        emojiPanel.querySelectorAll('.emoji-panel-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        populateGrid('');
    }

    function populateGrid(searchTerm) {
        currentSearchTerm = searchTerm;
        let listToDisplay;

        if (searchTerm) {
            listToDisplay = ALL_EMOJI_LIST.filter(e => e.code.includes(`:${searchTerm}`));
        } else {
            listToDisplay = (activeTab === 'custom') ? CUSTOM_EMOJI_LIST : DEFAULT_EMOJI_LIST;
        }

        if (listToDisplay.length === 0) {
            gridContainer.innerHTML = `<div style="color: #bba8d1; padding: 20px; text-align: center; grid-column: 1 / -1;">No emojis found.</div>`;
            if (searchTerm) showPanel();
            return;
        }

        gridContainer.innerHTML = '';
        listToDisplay.forEach((emoji) => {
            const item = document.createElement('div');
            item.className = 'emoji-grid-item';
            item.title = emoji.code;
            item.innerHTML = `<img src="${emoji.url}" alt="${emoji.code}">`;
            item.addEventListener('click', () => selectEmoji(emoji.code, searchTerm !== ''));
            gridContainer.appendChild(item);
        });

        if (searchTerm) showPanel();
    }

    function showPanel() {
        if (!chatInput || !emojiPanel) return;
        if (!GM_getValue('emojiPanelPosition')) {
            const inputRect = chatInput.getBoundingClientRect();
            emojiPanel.style.top = `${inputRect.top - 310}px`;
            emojiPanel.style.left = `${inputRect.left}px`;
        }
        emojiPanel.style.display = 'flex';
        panelVisible = true;
    }

    function hidePanel() {
        if (!emojiPanel) return;
        emojiPanel.style.display = 'none';
        panelVisible = false;
    }

    function selectEmoji(emojiCode, isAutocomplete) {
        if (!chatInput) return;
        const currentValue = chatInput.value;
        let newValue;
        if (isAutocomplete) {
            const searchRegex = new RegExp(`:${currentSearchTerm}$`);
            newValue = currentValue.replace(searchRegex, emojiCode + ' ');
        } else {
            newValue = currentValue + emojiCode + ' ';
        }
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(chatInput, newValue);
        const event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event);
        hidePanel();
        chatInput.focus();
    }

    function handleKeyDown(e) {
        if (!panelVisible) return;
        if (e.key === 'Escape') { e.preventDefault(); hidePanel(); }
        if (currentSearchTerm && (e.key === 'Tab' || e.key === 'Enter')) {
            const firstResult = ALL_EMOJI_LIST.find(em => em.code.includes(`:${currentSearchTerm}`));
            if (firstResult) { e.preventDefault(); selectEmoji(firstResult.code, true); }
        }
    }

    function handleKeyUp(e) {
        if (['Tab', 'Enter', 'Escape'].includes(e.key)) return;
        const text = e.target.value;
        const cursorPos = e.target.selectionStart;
        const lastColon = text.lastIndexOf(':', cursorPos - 1);
        if (lastColon === -1 || text.substring(lastColon, cursorPos).includes(' ')) {
            if (panelVisible && currentSearchTerm) hidePanel();
            return;
        }
        const searchTerm = text.substring(lastColon + 1, cursorPos);
        if (searchTerm.length >= 1) {
            populateGrid(searchTerm);
        } else {
            hidePanel();
        }
    }

    // =========================================================================
    // ===                         SCRIPT ENTRY POINT                        ===
    // =========================================================================
    function initialize() {
        console.log('[CCO Emoji Suite] Loaded. Initializing all features.');
        setInterval(scheduledCheck, 250);
        createResizableEmojiPanel();

        const inputFinder = setInterval(() => {
            const inputEl = document.querySelector('input[placeholder*="message"]');
            if (inputEl) {
                clearInterval(inputFinder);
                chatInput = inputEl;
                const inputParent = chatInput.parentElement;
                if (inputParent) {
                    inputParent.style.position = 'relative';
                    pickerButton = document.createElement('div');
                    pickerButton.id = 'emoji-picker-button';
                    pickerButton.textContent = '😊';
                    pickerButton.title = 'Show Emoji List';
                    pickerButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (panelVisible) {
                            hidePanel();
                        } else {
                            switchTab(activeTab);
                            showPanel();
                        }
                        chatInput.focus();
                    });
                    inputParent.appendChild(pickerButton);
                }
                chatInput.addEventListener('keyup', handleKeyUp);
                chatInput.addEventListener('keydown', handleKeyDown, true);
                document.addEventListener('click', (e) => {
                    if (panelVisible && !emojiPanel.contains(e.target) && e.target !== pickerButton) {
                        hidePanel();
                    }
                });
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();