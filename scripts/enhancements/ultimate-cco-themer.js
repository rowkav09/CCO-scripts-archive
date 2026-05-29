// ==UserScript==
// @name         The definitive cco experience
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Wallpapers, themes, cb teams and chat features
// @author       ZSB
// @match        *://*.case-clicker.com/*
// @require      https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/pickr.min.js
// @resource     PICKR_CSS https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/themes/nano.min.css
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_getResourceText
// @connect      workers.dev
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';
    // =========================================================================
    // ===                           CONFIGURATION                           ===
    // =========================================================================
    const vpsDomain = 'https://walp.bobbyatthelobby.workers.dev';
    const DEFAULT_THEME_CONFIG = {
        mainBackground: '#100d18',
        panelBackground: '#1a1527',
        primaryText: '#f4dfff',
        dimmedText: '#bba8d1',
        accentColor: '#79caff',
        usernameColor: '#ff8c00',
        canvasBackground: 'rgba(0, 0, 0, 0)',
        buttonGradientStart: '#4A3763',
        buttonGradientEnd: '#2C1D3D',
        buttonBorder: '#7a5a9b',
        buttonText: '#f4dfff',
        buttonHoverGlow: 'rgba(121, 202, 255, 0.5)'
    };

    const THEME_LABELS = {
        mainBackground: 'Page Background',
        panelBackground: 'Panel & Card Background',
        primaryText: 'Accent & Chat text',
        dimmedText: 'Dimmed Text',
        accentColor: 'Primary Color',
        usernameColor: 'Username Color',
        canvasBackground: 'Plinko Background',
        buttonGradientStart: 'Button Gradient left',
        buttonGradientEnd: 'Button Gradient right',
        buttonBorder: 'Button Border',
        buttonText: 'Button Text',
        buttonHoverGlow: 'Button Hover Glow'
    };

    const PANEL_IDS = ['wallpaper-panel', 'cb-teams-panel', 'theme-editor-panel', 'advanced-chat-panel'];

    // =========================================================================
    // ===                 DYNAMIC THEME & STYLE INJECTION                   ===
    // =========================================================================
    let currentTheme = { ...DEFAULT_THEME_CONFIG, ...GM_getValue('lastLoadedTheme', {}) };

    function setCssVariable(key, value) {
        const cssVarName = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        document.documentElement.style.setProperty(cssVarName, value, 'important');
    }

    function applyTheme(theme) {
        for (const [key, value] of Object.entries(theme)) {
            setCssVariable(key, value);
        }
    }
    applyTheme(currentTheme);

    GM_addStyle(GM_getResourceText("PICKR_CSS"));
    GM_addStyle(`
        :root {
            --main-background: ${DEFAULT_THEME_CONFIG.mainBackground}; --panel-background: ${DEFAULT_THEME_CONFIG.panelBackground};
            --primary-text: ${DEFAULT_THEME_CONFIG.primaryText}; --dimmed-text: ${DEFAULT_THEME_CONFIG.dimmedText};
            --accent-color: ${DEFAULT_THEME_CONFIG.accentColor}; --username-color: ${DEFAULT_THEME_CONFIG.usernameColor};
            --canvas-background: ${DEFAULT_THEME_CONFIG.canvasBackground};
            --button-gradient-start: ${DEFAULT_THEME_CONFIG.buttonGradientStart}; --button-gradient-end: ${DEFAULT_THEME_CONFIG.buttonGradientEnd};
            --button-border: ${DEFAULT_THEME_CONFIG.buttonBorder}; --button-text: ${DEFAULT_THEME_CONFIG.buttonText};
            --button-hover-glow: ${DEFAULT_THEME_CONFIG.buttonHoverGlow};
            --mantine-color-orange-text: var(--username-color) !important;
            --mantine-color-dimmed: var(--dimmed-text) !important;
        }
        body { color: var(--primary-text) !important; }
        a { color: var(--accent-color) !important; }
        p[data-truncate="end"][style*="color: var(--mantine-color-orange-text)"] { color: var(--username-color) !important; }
        .text-gray-400, [data-mantine-color="dimmed"] { color: var(--dimmed-text) !important; }
        .userscript-btn, button, input:not([type=color]), select {
            background: linear-gradient(145deg, var(--button-gradient-start), var(--button-gradient-end)) !important;
            border: 1px solid var(--button-border) !important; color: var(--button-text) !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: all 0.2s ease-in-out; font-weight: bold; border-radius: 4px;
        }
        .userscript-btn:hover, button:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 15px 2px var(--button-hover-glow), 0 4px 8px rgba(0,0,0,0.4); filter: brightness(1.1);
        }
        body:not(.wallpaper-disabled) #__next, body:not(.wallpaper-disabled) .mantine-AppShell-main,
        body:not(.wallpaper-disabled) .mantine-AppShell-header, body:not(.wallpaper-disabled) .mantine-AppShell-navbar,
        body:not(.wallpaper-disabled) .mantine-AppShell-aside, body:not(.wallpaper-disabled) .mantine-Card-root,
        body:not(.wallpaper-disabled) .mantine-Paper-root { background: none !important; background-color: transparent !important; }
        body.wallpaper-disabled .mantine-AppShell-main { background-color: var(--main-background) !important; }
        body.wallpaper-disabled .mantine-Card-root, body.wallpaper-disabled .mantine-Paper-root,
        body.wallpaper-disabled .mantine-AppShell-header, body.wallpaper-disabled .mantine-AppShell-navbar,
        body.wallpaper-disabled .mantine-AppShell-aside { background-color: var(--panel-background) !important; }

        #plinko canvas[style*="background"] { background: var(--canvas-background) !important; }
        #plinko ~ .mantine-Group-root .mantine-Card-root { background-color: var(--panel-background) !important; }

        .floating-panel { position: fixed; z-index: 10000; font-family: 'Segoe UI', sans-serif; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); color: #f0f0f0; min-width: 240px; max-width: 90vw; min-height: 100px; max-height: 90vh; overflow: hidden; background: rgba(26, 21, 39, 0.85); backdrop-filter: blur(10px); display: flex; flex-direction: column; }
        .floating-panel.minimized { display: none !important; }
        .panel-header { padding: 12px 16px; background: rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; font-weight: bold; flex-shrink: 0; }
        .panel-header-text { cursor: move; flex-grow: 1; user-select: none; }
        .panel-minimize-button { cursor: pointer; font-weight: bold; font-size: 1.2em; user-select: none; }
        .panel-content { flex-grow: 1; overflow-y: auto; padding: 0; }
        .panel-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize; background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%); }
        .floating-panel.snapping { transition: outline 0.1s ease; outline: 2px solid var(--accent-color) !important; }

        .wallpaper-option { padding: 10px 14px; cursor: pointer; border-radius: 6px; font-size: 0.9em; margin-bottom: 4px; transition: background-color 0.2s ease; display: flex; justify-content: space-between; align-items: center; }
        .wallpaper-option:hover { background-color: rgba(121, 202, 255, 0.2); }
        .favorite-star { cursor: pointer; font-size: 1.2em; transition: color 0.2s, transform 0.2s; user-select: none; }
        .favorite-star:hover { transform: scale(1.2); }
        .favorite-star.favorited { color: #ffd700; }
        .special-option { border-top: 1px solid #333; margin-top: 4px; font-weight: bold; color: var(--accent-color); justify-content: center; }
        #team-value-sums { display: none; } #cb-teams-panel.enabled #team-value-sums { display: block; }
        #toggle-cb-button.on { border-color: #2ecc71 !important; box-shadow: inset 0 0 8px rgba(46, 204, 113, 0.5) !important; }
        #toggle-cb-button.off { filter: grayscale(50%); opacity: 0.8; }
        .wallpaper-engine-iframe { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; z-index: -9999; }
        .script-toolbar-button { display: inline-flex; align-items: center; justify-content: center; height: 30px; padding: 0 16px; font-size: var(--mantine-font-size-sm); margin-left: calc(1rem * var(--mantine-scale)) !important; border-radius: var(--mantine-radius-sm); cursor: pointer; }
        .script-toolbar-button span { margin-left: 8px; }
        .panel-content-inner { padding: 12px; }
        #theme-profile-manager { border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 12px; }
        #theme-profile-manager select, #theme-profile-manager input { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 4px; }
        #theme-profile-manager select option { background: var(--panel-background) !important; color: var(--primary-text) !important; }
        #theme-profile-manager div { display: flex; gap: 8px; flex-wrap: wrap; }
        #theme-profile-manager button { flex-grow: 1; }
        .theme-editor-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-radius: 4px; padding: 2px 4px; transition: background-color 0.2s ease; }
        .theme-editor-row:hover { background-color: rgba(121, 202, 255, 0.1); }
        .theme-editor-row label { font-size: 0.9em; flex-shrink: 0; margin-right: 8px; }
        .pickr-swatch { width: 80px; height: 25px; border: 1px solid #555; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
        .pcr-app { background: var(--panel-background) !important; border-radius: 8px !important; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important; z-index: 10003 !important; }
        .pcr-interaction input { color: var(--primary-text) !important; border-color: var(--button-border) !important; }
        .pcr-interaction .pcr-save { background: var(--button-gradient-start) !important; }

        .rainbow-mode .mantine-Text-root, .rainbow-mode a, .rainbow-mode p[data-truncate="end"][style*="color: var(--mantine-color-orange-text)"], .rainbow-mode [data-mantine-color="dimmed"] {
            background-image: linear-gradient(90deg, #ff00ff, #00ffff, #ffff00, #ff00ff) !important;
            -webkit-background-clip: text !important;
            background-clip: text !important;
            color: transparent !important;
            background-size: 200% 100% !important;
            animation: rainbow-scroll 3s linear infinite !important;
        }
        @keyframes rainbow-scroll {
            0% { background-position: 200% 0; }
            100% { background-position: 0 0; }
        }
        #theme-editor-toggles, .chat-settings-section { border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
        .toggle-row, .setting-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.9em; }

        .switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
            flex-shrink: 0;
        }
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #3e3850;
            transition: .3s;
            border-radius: 24px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: var(--accent-color);
        }
        input:checked + .slider:before {
            transform: translateX(20px);
        }

        /* --- ADVANCED CHAT STYLES --- */
        #master-chat-modal { /* The single modal container */
            display: none; /* Hidden by default */
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 10002; /* Highest priority */
            justify-content: center;
            align-items: center;
        }
        #master-chat-modal-content {
            background: var(--panel-background);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--button-border);
            box-shadow: 0 5px 25px rgba(0,0,0,0.5);
            min-width: 250px;
            text-align: center;
        }
        #master-chat-modal-header {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 20px;
            color: var(--primary-text);
        }
        #master-chat-modal-header .username {
            color: var(--accent-color);
        }
        #master-chat-modal-body button {
            display: block;
            width: 100%;
            margin-bottom: 10px;
            padding: 10px;
        }
        .chat-keyword-highlight > div[class*="mantine-Paper-root"] {
            background: rgba(255, 215, 0, 0.15) !important;
            border-left: 3px solid #ffd700;
        }
        .chat-settings-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 120px;
            overflow-y: auto;
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
            padding: 5px;
        }
        .chat-settings-list li {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            font-size: 0.85em;
        }
        .chat-settings-list li:nth-child(even) { background-color: rgba(255,255,255,0.05); }
        .remove-item-btn {
            cursor: pointer;
            color: #ff6b6b;
            font-weight: bold;
        }
        .user-tag {
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 8px;
            background-color: var(--accent-color);
            color: var(--panel-background);
            font-weight: bold;
            margin-left: 6px;
            text-shadow: none;
            display: inline-block;
            vertical-align: middle;
        }
        #tagged-users-list .tag-text {
            font-style: italic;
            background: rgba(255,255,255,0.1);
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-left: 8px;
        }
    `);

    // =========================================================================
    // ===                         GLOBAL HELPERS                            ===
    // =========================================================================
    let activeWallpaperWindow = null;
    window.addEventListener('mousemove', (e) => { if (activeWallpaperWindow) activeWallpaperWindow.postMessage({ type: 'mousemove', x: e.clientX, y: e.clientY }, '*'); });

    function getContrastingTextColor(hexColor) {
        if (!hexColor || hexColor.length < 4) return '#FFFFFF';
        let r, g, b;
        if (hexColor.length === 4) {
            r = parseInt(hexColor[1] + hexColor[1], 16);
            g = parseInt(hexColor[2] + hexColor[2], 16);
            b = parseInt(hexColor[3] + hexColor[3], 16);
        } else {
            r = parseInt(hexColor.substr(1, 2), 16);
            g = parseInt(hexColor.substr(3, 2), 16);
            b = parseInt(hexColor.substr(5, 2), 16);
        }
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    function createDraggablePanel(id, headerText, innerHTML, defaultPos) {
        let container = document.getElementById(id);
        if (container) return { container, minimizeButton: container.querySelector('.panel-minimize-button'), contentArea: container.querySelector('.panel-content-inner') };

        container = document.createElement('div');
        container.id = id;
        container.className = 'floating-panel';
        container.innerHTML = `<div class="panel-header"><span class="panel-header-text">${headerText}</span><span class="panel-minimize-button" title="Minimize">−</span></div><div class="panel-content"><div class="panel-content-inner">${innerHTML}</div></div><div class="panel-resize-handle"></div>`;
        document.body.appendChild(container);

        const header = container.querySelector('.panel-header-text');
        const minimizeButton = container.querySelector('.panel-minimize-button');
        const contentArea = container.querySelector('.panel-content-inner');
        const resizeHandle = container.querySelector('.panel-resize-handle');

        let isDragging = false, isResizing = false;
        let offset = { x: 0, y: 0 };
        let initialSize = { width: 0, height: 0 };

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset = { x: e.clientX - container.offsetLeft, y: e.clientY - container.offsetTop };
        });

        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            offset = { x: e.clientX, y: e.clientY };
            initialSize = { width: container.offsetWidth, height: container.offsetHeight };
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                let newLeft = e.clientX - offset.x;
                let newTop = e.clientY - offset.y;
                const snapThreshold = 20;
                let isSnapping = false;

                PANEL_IDS.forEach(otherId => {
                    if (otherId === id) return;
                    const otherPanel = document.getElementById(otherId);
                    if (!otherPanel || otherPanel.classList.contains('minimized')) return;

                    const otherRect = otherPanel.getBoundingClientRect();
                    const draggedRect = { left: newLeft, top: newTop, right: newLeft + container.offsetWidth, bottom: newTop + container.offsetHeight };

                    if (Math.abs(draggedRect.right - otherRect.left) < snapThreshold) { newLeft = otherRect.left - container.offsetWidth; isSnapping = true; }
                    if (Math.abs(draggedRect.left - otherRect.right) < snapThreshold) { newLeft = otherRect.right; isSnapping = true; }
                    if (Math.abs(draggedRect.left - otherRect.left) < snapThreshold) { newLeft = otherRect.left; isSnapping = true; }
                    if (Math.abs(draggedRect.right - otherRect.right) < snapThreshold) { newLeft = otherRect.right - container.offsetWidth; isSnapping = true; }
                    if (Math.abs(draggedRect.bottom - otherRect.top) < snapThreshold) { newTop = otherRect.top - container.offsetHeight; isSnapping = true; }
                    if (Math.abs(draggedRect.top - otherRect.bottom) < snapThreshold) { newTop = otherRect.bottom; isSnapping = true; }
                    if (Math.abs(draggedRect.top - otherRect.top) < snapThreshold) { newTop = otherRect.top; isSnapping = true; }
                    if (Math.abs(draggedRect.bottom - otherRect.bottom) < snapThreshold) { newTop = otherRect.bottom - container.offsetHeight; isSnapping = true; }
                });

                if (newLeft < snapThreshold) { newLeft = 0; isSnapping = true; }
                if (newTop < snapThreshold) { newTop = 0; isSnapping = true; }
                if (newLeft + container.offsetWidth > window.innerWidth - snapThreshold) { newLeft = window.innerWidth - container.offsetWidth; isSnapping = true; }
                if (newTop + container.offsetHeight > window.innerHeight - snapThreshold) { newTop = window.innerHeight - container.offsetHeight; isSnapping = true; }

                container.classList.toggle('snapping', isSnapping);
                container.style.left = `${newLeft}px`;
                container.style.top = `${newTop}px`;
            }
            if (isResizing) {
                const newWidth = initialSize.width + (e.clientX - offset.x);
                const newHeight = initialSize.height + (e.clientY - offset.y);
                container.style.width = `${newWidth}px`;
                container.style.height = `${newHeight}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.classList.remove('snapping');
                GM_setValue(`${id}Position`, { top: container.style.top, left: container.style.left });
            }
            if (isResizing) {
                isResizing = false;
                GM_setValue(`${id}Dimensions`, { width: container.style.width, height: container.style.height });
            }
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const scrollDirection = Math.sign(e.deltaY);
            const currentOpacity = parseFloat(container.style.opacity) || 1.0;
            let newOpacity = currentOpacity - (scrollDirection * 0.05);
            newOpacity = Math.max(0.2, Math.min(1, newOpacity));
            container.style.opacity = newOpacity;
            GM_setValue(`${id}Opacity`, newOpacity);
        }, { passive: false });

        const savedPos = GM_getValue(`${id}Position`, defaultPos);
        container.style.top = savedPos.top;
        container.style.left = savedPos.left;

        const savedDims = GM_getValue(`${id}Dimensions`);
        if (savedDims) {
            container.style.width = savedDims.width;
            container.style.height = savedDims.height;
        }

        const savedOpacity = GM_getValue(`${id}Opacity`, 1.0);
        container.style.opacity = savedOpacity;

        return { container, minimizeButton, contentArea };
    }

    // =========================================================================
    // ===                    TOOLBAR SYNC & STATE MGMT                      ===
    // =========================================================================
    function syncToolbar() {
        const serverStatsButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Show Serverstats'));
        if (!serverStatsButton || !serverStatsButton.parentElement) return;
        const toolbar = serverStatsButton.parentElement;
        function createOrGetButton(id, text, onClick) {
            let btn = document.getElementById(id);
            if (!btn) {
                btn = document.createElement('button');
                btn.id = id;
                btn.className = 'script-toolbar-button userscript-btn';
                btn.innerHTML = text;
                btn.onclick = onClick;
                toolbar.appendChild(btn);
            }
            return btn;
        }
        const wpBtn = createOrGetButton('restore-wallpaper-btn', '🎨<span>Wallpapers</span>', () => { document.getElementById('wallpaper-panel')?.classList.remove('minimized'); GM_setValue('wallpaper-panelMinimized', false); syncToolbar(); });
        const cbBtn = createOrGetButton('restore-cb-teams-btn', '📊<span>CB Teams</span>', () => { document.getElementById('cb-teams-panel')?.classList.remove('minimized'); GM_setValue('cb-teams-panelMinimized', false); syncToolbar(); });
        const themeBtn = createOrGetButton('restore-theme-editor-btn', '🖌️<span>Theme</span>', () => { document.getElementById('theme-editor-panel')?.classList.remove('minimized'); GM_setValue('theme-editor-panelMinimized', false); syncToolbar(); });
        const chatBtn = createOrGetButton('restore-advanced-chat-btn', '💬<span>Chat</span>', () => { document.getElementById('advanced-chat-panel')?.classList.remove('minimized'); GM_setValue('advanced-chat-panelMinimized', false); syncToolbar(); });

        wpBtn.style.display = GM_getValue('wallpaper-panelMinimized', false) ? 'inline-flex' : 'none';
        cbBtn.style.display = GM_getValue('cb-teams-panelMinimized', false) ? 'inline-flex' : 'none';
        themeBtn.style.display = GM_getValue('theme-editor-panelMinimized', false) ? 'inline-flex' : 'none';

        const chatPanelExists = !!document.getElementById('advanced-chat-panel');
        if (chatPanelExists) {
            chatBtn.disabled = false;
            chatBtn.style.opacity = '1';
            chatBtn.style.cursor = 'pointer';
            chatBtn.title = 'Show Advanced Chat Settings';
            chatBtn.style.display = GM_getValue('advanced-chat-panelMinimized', false) ? 'inline-flex' : 'none';
        } else {
            chatBtn.disabled = true;
            chatBtn.style.opacity = '0.5';
            chatBtn.style.cursor = 'not-allowed';
            chatBtn.title = 'Chat settings are not available on this page.';
            chatBtn.style.display = 'inline-flex';
        }
    }

    // =========================================================================
    // ===                        WALLPAPER MODULE                           ===
    // =========================================================================
    function initWallpaperModule() {
        let dynamicWallpapers = {};
        let favoriteWallpapers = GM_getValue('favoriteWallpapers', []);
        let currentView = 'all';

        function loadWallpaper(wallpaperId) {
            if (wallpaperId === 'random') {
                const visibleIds = Array.from(contentArea.querySelectorAll('.wallpaper-option[data-id]:not(.special-option)'))
                                      .map(el => el.dataset.id)
                                      .filter(id => id !== 'none');
                if (visibleIds.length > 0) {
                    const randomId = visibleIds[Math.floor(Math.random() * visibleIds.length)];
                    loadWallpaper(randomId);
                }
                return;
            }

            const currentIframe = document.querySelector('.wallpaper-engine-iframe');
            activeWallpaperWindow = null;
            if (wallpaperId === 'none') {
                if (currentIframe) currentIframe.remove();
                document.body.classList.add('wallpaper-disabled');
                GM_setValue('selectedWallpaper', 'none');
                return;
            }
            const wallpaper = dynamicWallpapers[wallpaperId];
            if (!wallpaper) return;

            GM_xmlhttpRequest({
                method: 'GET',
                url: `${vpsDomain}/${wallpaper.folder}`,
                onload: function(response) {
                    const newIframe = document.createElement('iframe');
                    newIframe.className = 'wallpaper-engine-iframe';
                    newIframe.style.opacity = '0';
                    newIframe.addEventListener('load', () => {
                        if (currentIframe) currentIframe.remove();
                        document.body.classList.remove('wallpaper-disabled');
                        activeWallpaperWindow = newIframe.contentWindow;
                        newIframe.style.transition = 'opacity 0.4s ease';
                        newIframe.style.opacity = '1';
                    }, { once: true });
                    const patchScript = `<script>window.addEventListener('message',e=>{if(e.data.type==='mousemove'){const c=document.querySelector('canvas');if(c)c.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:e.data.x,clientY:e.data.y}));}});<\/script>`;
                    newIframe.srcdoc = response.responseText.replace('<head>', `<head><base href="${vpsDomain}/${wallpaper.folder}/">${patchScript}`);
                    document.body.appendChild(newIframe);
                    GM_setValue('selectedWallpaper', wallpaperId);
                }
            });
        }

        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('wallpaper-panel', 'Wallpapers', '', { top: '20px', left: '20px' });
        contentArea.style.padding = "12px";

        function renderWallpaperList() {
            contentArea.innerHTML = '';

            const filterText = currentView === 'all' ? 'Show Favorites ★' : 'Show All';
            const filterButton = document.createElement('button');
            filterButton.textContent = filterText;
            filterButton.className = 'userscript-btn';
            filterButton.style.width = '100%';
            filterButton.style.marginBottom = '8px';
            filterButton.onclick = () => {
                currentView = (currentView === 'all' ? 'favorites' : 'all');
                renderWallpaperList();
            };
            contentArea.appendChild(filterButton);

            let wallpapersToRender = Object.values(dynamicWallpapers);
            if (currentView === 'favorites') {
                wallpapersToRender = wallpapersToRender.filter(wp => favoriteWallpapers.includes(wp.id));
            }

            if (wallpapersToRender.length === 0 && currentView === 'favorites') {
                 contentArea.insertAdjacentHTML('beforeend', `<div style="text-align:center; padding: 10px; opacity: 0.7;">No favorites yet. Click the ★ to add some.</div>`);
            } else {
                wallpapersToRender.forEach(wp => {
                    const isFavorited = favoriteWallpapers.includes(wp.id);
                    const optionHTML = `
                        <div class="wallpaper-option" data-id="${wp.id}">
                            <span>${wp.name}</span>
                            <span class="favorite-star ${isFavorited ? 'favorited' : ''}" data-id="${wp.id}" title="Toggle Favorite">★</span>
                        </div>`;
                    contentArea.insertAdjacentHTML('beforeend', optionHTML);
                });
            }

            contentArea.insertAdjacentHTML('beforeend', `<div class="wallpaper-option special-option" data-id="none">Disable Wallpaper</div>`);
            contentArea.insertAdjacentHTML('beforeend', `<div class="wallpaper-option special-option" data-id="random">✨ Select Random</div>`);
        }

        minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('wallpaper-panelMinimized', true); syncToolbar(); });
        if (GM_getValue('wallpaper-panelMinimized', false)) panel.classList.add('minimized');

        contentArea.addEventListener('click', (event) => {
            const star = event.target.closest('.favorite-star');
            if (star) {
                event.stopPropagation();
                const wallpaperId = star.dataset.id;
                if (favoriteWallpapers.includes(wallpaperId)) {
                    favoriteWallpapers = favoriteWallpapers.filter(id => id !== wallpaperId);
                    star.classList.remove('favorited');
                } else {
                    favoriteWallpapers.push(wallpaperId);
                    star.classList.add('favorited');
                }
                GM_setValue('favoriteWallpapers', favoriteWallpapers);
                if (currentView === 'favorites') renderWallpaperList();
                return;
            }

            const target = event.target.closest('.wallpaper-option');
            if (target) {
                loadWallpaper(target.dataset.id);
            }
        });

        GM_xmlhttpRequest({
            method: 'GET', url: `${vpsDomain}/wallpapers.json`,
            onload: (response) => {
                if (response.status !== 200) { contentArea.textContent = `Error: Server returned ${response.status}`; return; }
                try {
                    const wallpaperArray = JSON.parse(response.responseText);
                    dynamicWallpapers = wallpaperArray.reduce((acc, wp) => ({...acc, [wp.id]: wp }), {});
                    renderWallpaperList();
                    loadWallpaper(GM_getValue('selectedWallpaper', 'punk_lord'));
                } catch (e) { contentArea.textContent = "Error processing list."; }
            },
            onerror: () => { contentArea.textContent = "Error fetching list."; }
        });
    }

    // =========================================================================
    // ===                          CB TEAMS MODULE                          ===
    // =========================================================================
    function initCbTeamsModule() {
        let cbObserver = null; let debounceTimeout;
        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('cb-teams-panel', 'CB Teams', '', { top: '20px', left: '300px' });
        contentArea.innerHTML = `<div style="padding: 12px;"><button id="toggle-cb-button" class="userscript-btn"></button><div id="team-value-sums"></div></div>`;
        const resultContainer = contentArea.querySelector('#team-value-sums');
        const toggleButton = contentArea.querySelector('#toggle-cb-button');
        minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('cb-teams-panelMinimized', true); syncToolbar(); });
        if (GM_getValue('cb-teams-panelMinimized', false)) panel.classList.add('minimized');
        const evaluateXPathSingle = (xpath) => document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        const formatCurrency = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const extractValueInCents = (text) => { if (!text) return null; const match = text.match(/\$?([\d,]+(\.\d{1,2})?)/); if (!match || !match[1]) return null; return Math.round(parseFloat(match[1].replace(/,/g, '')) * 100); };
        function displayTotals(playerValuesCents, playerImages) {
            const midIndex = playerValuesCents.length / 2;
            const teamACents = playerValuesCents.slice(0, midIndex); const teamBCents = playerValuesCents.slice(midIndex);
            const teamASumCents = teamACents.reduce((a, b) => a + b, 0); const teamBSumCents = teamBCents.reduce((a, b) => a + b, 0);
            const teamASumDollars = teamASumCents / 100; const teamBSumDollars = teamBSumCents / 100;
            const crazyModeEl = evaluateXPathSingle('//*[@id="__next"]/div/main/div[2]/div[3]/p[1]');
            const isCrazyMode = crazyModeEl && crazyModeEl.textContent.includes('Crazy');
            let teamATotalDisplayColor = 'inherit', teamBTotalDisplayColor = 'inherit';
            if (teamASumDollars !== teamBSumDollars) {
                if (isCrazyMode) { [teamATotalDisplayColor, teamBTotalDisplayColor] = teamASumDollars < teamBSumDollars ? ['#2ee071', '#f74a5c'] : ['#f74a5c', '#2ee071']; }
                else { [teamATotalDisplayColor, teamBTotalDisplayColor] = teamASumDollars > teamBSumDollars ? ['#2ee071', 'inherit'] : ['inherit', '#2ee071']; }
            }
            const blueColor = '#483d8b', redColor = '#8b0000';
            const calculatePercentages = (cents, sum) => sum > 0 ? cents.map(v => (v/sum)*100) : [];
            const teamAPercentages = calculatePercentages(teamACents, teamASumCents);
            const teamBPercentages = calculatePercentages(teamBCents, teamBSumCents);
            const colorCodePlayer = (p, ps) => { if (!ps || ps.length <= 1) return '#2ee071'; const max=Math.max(...ps), min=Math.min(...ps); if (p.toFixed(1) === max.toFixed(1)) return '#2ee071'; if (p.toFixed(1) === min.toFixed(1)) return '#f74a5c'; return '#fcc63d'; };
            const createPlayerList = (percentages, images, startIndex) => percentages.map((p,i) => `<div style="display:inline-flex;align-items:center;margin:2px 5px;"><img src="${images[startIndex+i]}" alt="P" style="width:20px;height:20px;border-radius:50%;margin-right:5px;border:1px solid rgba(255,255,255,0.1);"><strong style="color:${colorCodePlayer(p,percentages)};font-size:0.9em;font-weight:600;">${p.toFixed(1)}%</strong></div>`).join('');
            const totalValue = teamASumDollars + teamBSumDollars;
            resultContainer.innerHTML = `<hr style="border-color: #333; margin: 12px 0;"><div style="border:1px solid #333;padding:10px;border-radius:8px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><strong style="color:${blueColor};">Blue Team</strong><strong style="color:${teamATotalDisplayColor};font-size:1.3em;">${formatCurrency(teamASumDollars)}</strong></div><div style="text-align:center;background:rgba(0,0,0,0.2);padding:5px 0;border-radius:8px;">${createPlayerList(teamAPercentages, playerImages, 0)}</div></div> <div style="border:1px solid #333;padding:10px;border-radius:8px;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><strong style="color:${redColor};">Red Team</strong><strong style="color:${teamBTotalDisplayColor};font-size:1.3em;">${formatCurrency(teamBSumDollars)}</strong></div><div style="text-align:center;background:rgba(0,0,0,0.2);padding:5px 0;border-radius:8px;">${createPlayerList(teamBPercentages, playerImages, midIndex)}</div></div> <div style="border-top:1px solid #333;margin-top:16px;padding-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;"> <div><div style="font-size:0.8em;color:#8899a6;">TOTAL POT</div><div style="font-weight:700;">${formatCurrency(totalValue)}</div></div> <div><div style="font-size:0.8em;color:#8899a6;">$ DIFF</div><div style="font-weight:700;color:${teamASumDollars>teamBSumDollars?blueColor:redColor};">${formatCurrency(Math.abs(teamASumDollars-teamBSumDollars))}</div></div> <div><div style="font-size:0.8em;color:#8899a6;">WIN VALUE</div><div style="font-weight:700;color:#2ee071;">${formatCurrency(totalValue / (midIndex || 1))}</div></div> </div>`;
        }
        function runCalculations() {
            const playerValueContainerXPathBase = '//*[@id="__next"]/div/main/div[5]/div/div';
            const playerSlots = document.evaluate(playerValueContainerXPathBase + '[not(self::style)]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            if (![4, 6].includes(playerSlots.snapshotLength)) { resultContainer.innerHTML = '<div class="placeholder" style="padding:12px 0;">Waiting for a 2v2 or 3v3 game...</div>'; return; }
            const playerValuesCents = [], playerImages = [];
            const playerImageContainerXPathBase = '//*[@id="__next"]/div/main/div[3]/div/div';
            for (let i = 0; i < playerSlots.snapshotLength; i++) {
                const valueEl = evaluateXPathSingle(`${playerValueContainerXPathBase}[${i + 1}]/div/a/div/p`);
                const imageEl = evaluateXPathSingle(`${playerImageContainerXPathBase}[${i + 1}]/div/div[1]/div[1]/a/div/img`);
                const valueCents = extractValueInCents(valueEl?.textContent); if (valueCents === null) return;
                playerValuesCents.push(valueCents); playerImages.push(imageEl ? imageEl.src : 'https://i.imgur.com/w6RcB0C.png');
            }
            displayTotals(playerValuesCents, playerImages);
        }
        function enable() { GM_setValue('cbTeamsEnabled', true); panel.classList.add('enabled'); toggleButton.textContent = 'CB Teams: ON'; toggleButton.className = 'on userscript-btn'; if (cbObserver) cbObserver.disconnect(); cbObserver = new MutationObserver(() => { clearTimeout(debounceTimeout); debounceTimeout = setTimeout(runCalculations, 250); }); cbObserver.observe(document.body, { childList: true, subtree: true }); runCalculations(); }
        function disable() { GM_setValue('cbTeamsEnabled', false); panel.classList.remove('enabled'); toggleButton.textContent = 'CB Teams: OFF'; toggleButton.className = 'off userscript-btn'; if (cbObserver) cbObserver.disconnect(); cbObserver = null; resultContainer.innerHTML = '<div class="placeholder" style="padding:12px 0;">CB Teams is disabled.</div>'; }
        toggleButton.addEventListener('click', () => { GM_getValue('cbTeamsEnabled', true) ? disable() : enable(); });
        if (GM_getValue('cbTeamsEnabled', true)) enable(); else disable();
    }

    // =========================================================================
    // ===                        THEME EDITOR MODULE                        ===
    // =========================================================================
    function initThemeEditorModule() {
        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('theme-editor-panel', 'Theme Editor', '', { top: '20px', left: '580px' });

        let isHighlightingEnabled = GM_getValue('highlightModeEnabled', true);
        let isRainbowModeEnabled = GM_getValue('rainbowModeEnabled', false);

        const togglesContainer = document.createElement('div');
        togglesContainer.id = 'theme-editor-toggles';
        togglesContainer.innerHTML = `
            <div class="toggle-row">
                <span>Enable Hover Highlighting</span>
                <label class="switch"><input type="checkbox" id="highlight-toggle"><span class="slider"></span></label>
            </div>
            <div class="toggle-row">
                <span>🌈 Rainbow Mode</span>
                <label class="switch"><input type="checkbox" id="rainbow-toggle"><span class="slider"></span></label>
            </div>`;
        const highlightToggle = togglesContainer.querySelector('#highlight-toggle');
        highlightToggle.checked = isHighlightingEnabled;
        highlightToggle.onchange = () => {
            isHighlightingEnabled = highlightToggle.checked;
            GM_setValue('highlightModeEnabled', isHighlightingEnabled);
        };

        const rainbowToggle = togglesContainer.querySelector('#rainbow-toggle');
        rainbowToggle.checked = isRainbowModeEnabled;
        rainbowToggle.onchange = () => {
            isRainbowModeEnabled = rainbowToggle.checked;
            GM_setValue('rainbowModeEnabled', isRainbowModeEnabled);
            document.body.classList.toggle('rainbow-mode', isRainbowModeEnabled);
        };
        contentArea.appendChild(togglesContainer);

        if (isRainbowModeEnabled) {
            document.body.classList.add('rainbow-mode');
        }

        const profileManagerHTML = `
            <div id="theme-profile-manager">
                <select id="theme-profile-select"></select>
                <input type="text" id="theme-profile-name" placeholder="New Theme Name..." />
                <div>
                    <button id="theme-profile-save" class="userscript-btn">Save</button>
                    <button id="theme-profile-load" class="userscript-btn">Load</button>
                    <button id="theme-profile-delete" class="userscript-btn">Delete</button>
                </div>
                <div>
                    <button id="theme-profile-import" class="userscript-btn" style="background: linear-gradient(145deg, #375f63, #1d333d) !important;">Import</button>
                    <button id="theme-profile-export" class="userscript-btn" style="background: linear-gradient(145deg, #573763, #2d1d3d) !important;">Export</button>
                </div>
            </div>`;
        contentArea.insertAdjacentHTML('beforeend', profileManagerHTML);
        const colorPickersContainer = document.createElement('div');
        contentArea.appendChild(colorPickersContainer);
        const profileSelect = contentArea.querySelector('#theme-profile-select');
        const profileNameInput = contentArea.querySelector('#theme-profile-name');
        let pickrInstances = [];

        const HIGHLIGHT_COLOR = '#00FFFF';
        const HIGHLIGHT_GLOW = 'rgba(0, 255, 255, 0.7)';

        const populateColorPickers = (theme) => {
            pickrInstances.forEach(p => p.destroyAndRemove());
            pickrInstances = [];
            colorPickersContainer.innerHTML = '';

            for (const [key, value] of Object.entries(theme)) {
                const row = document.createElement('div');
                row.className = 'theme-editor-row';
                const labelText = THEME_LABELS[key] || key;
                row.innerHTML = `<label>${labelText}</label>`;

                row.addEventListener('mouseenter', () => {
                    if (!isHighlightingEnabled) return;
                    const highlightValue = key === 'buttonHoverGlow' ? HIGHLIGHT_GLOW : HIGHLIGHT_COLOR;
                    setCssVariable(key, highlightValue);
                });

                row.addEventListener('mouseleave', () => {
                    if (isHighlightingEnabled) {
                        setCssVariable(key, currentTheme[key]);
                    }
                });

                const swatch = document.createElement('div');
                swatch.className = 'pickr-swatch';
                row.appendChild(swatch);
                colorPickersContainer.appendChild(row);

                const pickr = Pickr.create({
                    el: swatch,
                    theme: 'nano',
                    default: value,
                    components: {
                        preview: true, opacity: true, hue: true,
                        interaction: { hex: true, rgba: true, hsla: false, hsva: false, cmyk: false, input: true, clear: true, save: true }
                    }
                });

                pickr.on('show', () => setCssVariable(key, currentTheme[key]))
                     .on('hide', () => setCssVariable(key, currentTheme[key]))
                     .on('save', (color, instance) => {
                        const newColor = color.toRGBA().toString();
                        currentTheme[key] = newColor;
                        applyTheme(currentTheme);
                        instance.getRoot().preview.style.backgroundColor = newColor;
                        pickr.hide();
                     }).on('clear', (instance) => {
                        currentTheme[key] = 'transparent';
                        applyTheme(currentTheme);
                        instance.getRoot().preview.style.backgroundColor = 'transparent';
                        pickr.hide();
                     });

                pickrInstances.push(pickr);
                pickr.setColor(value);
            }
        };

        const updateProfileDropdown = () => {
            const savedThemes = GM_getValue('savedThemes', {});
            profileSelect.innerHTML = '';
            for (const name of Object.keys(savedThemes)) {
                profileSelect.add(new Option(name, name));
            }
        };

        contentArea.querySelector('#theme-profile-save').onclick = () => {
            const name = profileNameInput.value.trim();
            if (!name) { alert('Please enter a name for the theme.'); return; }
            const savedThemes = GM_getValue('savedThemes', {});
            savedThemes[name] = { ...currentTheme };
            GM_setValue('savedThemes', savedThemes);
            updateProfileDropdown();
            profileSelect.value = name;
            profileNameInput.value = '';
        };

        contentArea.querySelector('#theme-profile-load').onclick = () => {
            const name = profileSelect.value;
            if (!name) { alert('No theme selected to load.'); return; }
            const savedThemes = GM_getValue('savedThemes', {});
            currentTheme = { ...DEFAULT_THEME_CONFIG, ...savedThemes[name] };
            applyTheme(currentTheme);
            populateColorPickers(currentTheme);
            GM_setValue('lastLoadedTheme', currentTheme);
        };

        contentArea.querySelector('#theme-profile-delete').onclick = () => {
            const name = profileSelect.value;
            if (!name) { alert('No theme selected to delete.'); return; }
            if (confirm(`Are you sure you want to delete the theme "${name}"?`)) {
                const savedThemes = GM_getValue('savedThemes', {});
                delete savedThemes[name];
                GM_setValue('savedThemes', savedThemes);
                updateProfileDropdown();
            }
        };

        contentArea.querySelector('#theme-profile-export').onclick = () => {
            try {
                const jsonString = JSON.stringify(currentTheme);
                prompt("Copy your theme code:", jsonString);
            } catch (e) {
                alert("Could not export theme. Error: " + e.message);
            }
        };

        contentArea.querySelector('#theme-profile-import').onclick = () => {
            const importString = prompt("Paste your theme code here:");
            if (!importString) return;

            try {
                const importedTheme = JSON.parse(importString);

                if (typeof importedTheme !== 'object' || importedTheme === null) {
                    throw new Error("Imported data is not a valid object.");
                }
                for (const key of Object.keys(DEFAULT_THEME_CONFIG)) {
                    if (!importedTheme.hasOwnProperty(key)) {
                        throw new Error(`Imported theme is missing required key: "${key}"`);
                    }
                }

                currentTheme = { ...DEFAULT_THEME_CONFIG, ...importedTheme };
                applyTheme(currentTheme);
                populateColorPickers(currentTheme);
                GM_setValue('lastLoadedTheme', currentTheme);
                alert("Theme imported successfully!");

            } catch (e) {
                alert("Import failed. The theme code is invalid or corrupted.\n\nError: " + e.message);
            }
        };

        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset to Default';
        resetButton.className = 'userscript-btn';
        resetButton.style.cssText = 'width: 100%; margin-top: 12px; filter: grayscale(30%);';
        resetButton.onclick = () => {
            if (confirm('Are you sure you want to reset the current colors to default?')) {
                currentTheme = { ...DEFAULT_THEME_CONFIG };
                applyTheme(currentTheme);
                populateColorPickers(currentTheme);
                GM_setValue('lastLoadedTheme', currentTheme);
            }
        };
        contentArea.appendChild(resetButton);

        populateColorPickers(currentTheme);
        updateProfileDropdown();
        minimizeButton.addEventListener('click', () => {
            panel.classList.add('minimized');
            GM_setValue('theme-editor-panelMinimized', true);
            pickrInstances.forEach(p => p.hide());
            syncToolbar();
        });
        if (GM_getValue('theme-editor-panelMinimized', false)) panel.classList.add('minimized');
    }

    // =========================================================================
    // ===                    ADVANCED CHAT HELPERS                          ===
    // =========================================================================

    function processAllMessages() {
        document.querySelectorAll('div.mantine-ScrollArea-viewport > div > div > div[class*="mantine-Group-root"]').forEach(processMessageNode);
    }

    function renderKeywordList() {
        const keywordList = document.getElementById('keyword-list');
        if (!keywordList) return;
        const highlightKeywords = GM_getValue('highlightKeywords', []);
        keywordList.innerHTML = '';
        if (highlightKeywords.length === 0) {
            keywordList.innerHTML = '<li>No keywords added.</li>';
            return;
        }
        highlightKeywords.forEach(kw => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${kw}</span><span class="remove-item-btn" data-keyword="${kw}" title="Remove">✖</span>`;
            keywordList.appendChild(li);
        });
    }

    function renderMutedUsersList() {
        const mutedUsersList = document.getElementById('muted-users-list');
        if (!mutedUsersList) return;
        const mutedUsers = GM_getValue('mutedUsers', {});
        mutedUsersList.innerHTML = '';
        const userEntries = Object.entries(mutedUsers);
        if (userEntries.length === 0) {
            mutedUsersList.innerHTML = '<li>No users muted.</li>';
            return;
        }
        userEntries.forEach(([username, _]) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${username}</span><span class="remove-item-btn" data-username="${username}" title="Unmute">✖</span>`;
            mutedUsersList.appendChild(li);
        });
    }

    function renderTaggedUsersList() {
        const taggedUsersList = document.getElementById('tagged-users-list');
        if (!taggedUsersList) return;
        const userTags = GM_getValue('userTags', {});
        taggedUsersList.innerHTML = '';
        const userEntries = Object.entries(userTags);

        if (userEntries.length === 0) {
            taggedUsersList.innerHTML = '<li>No users tagged. Click a user in chat to add one.</li>';
            return;
        }

        userEntries.forEach(([username, data]) => {
            const tagText = typeof data === 'string' ? data : data.tag;
            const color = typeof data === 'string' ? currentTheme.accentColor : data.color;

            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.title = 'Click to edit';
            li.dataset.username = username;
            li.innerHTML = `
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${color}; border: 1px solid #fff3;"></span>
                    <span>${username}</span>
                    <span class="tag-text">${tagText}</span>
                </span>
                <span class="remove-item-btn" data-username="${username}" title="Remove Tag">✖</span>`;
            taggedUsersList.appendChild(li);
        });
    }

    // --- REBUILT MODAL SYSTEM ---

    function initMasterModal() {
        let modal = document.getElementById('master-chat-modal');
        if (modal) return; // Already initialized

        modal = document.createElement('div');
        modal.id = 'master-chat-modal';
        modal.innerHTML = `
            <div id="master-chat-modal-content">
                <div id="master-chat-modal-header"></div>
                <div id="master-chat-modal-body"></div>
            </div>`;
        document.body.appendChild(modal);

        // Close modal when clicking the background
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'master-chat-modal') {
                closeMasterModal();
            }
        });

        // Use event delegation for all button clicks within the modal
        modal.addEventListener('click', (e) => {
            const username = modal.dataset.username;
            if (!username) return;

            // --- Main Actions ---
            if (e.target.id === 'modal-mute-btn') {
                if (confirm(`Are you sure you want to mute ${username}?`)) {
                    let mutedUsers = GM_getValue('mutedUsers', {});
                    mutedUsers[username] = true;
                    GM_setValue('mutedUsers', mutedUsers);
                    renderMutedUsersList();
                    processAllMessages();
                }
                closeMasterModal();
            }
            else if (e.target.id === 'modal-tag-btn') {
                openMasterModal(username, 'tagging');
            }
            else if (e.target.id === 'modal-cancel-btn') {
                closeMasterModal();
            }

            // --- Tag Editor Actions ---
            else if (e.target.id === 'modal-save-tag-btn') {
                const userTags = GM_getValue('userTags', {});
                const tagInput = modal.querySelector('#tag-editor-input');
                const newTagText = tagInput.value.trim();
                const newColor = modal.pickrInstance.getColor().toHEXA().toString();

                if (newTagText) {
                    userTags[username] = { tag: newTagText, color: newColor };
                } else {
                    delete userTags[username];
                }
                GM_setValue('userTags', userTags);
                renderTaggedUsersList();
                processAllMessages();
                closeMasterModal();
            }
            else if (e.target.id === 'modal-remove-tag-btn') {
                const userTags = GM_getValue('userTags', {});
                delete userTags[username];
                GM_setValue('userTags', userTags);
                renderTaggedUsersList();
                processAllMessages();
                closeMasterModal();
            }
            else if (e.target.id === 'modal-back-btn') {
                 openMasterModal(username, 'actions');
            }
        });
    }

    function openMasterModal(username, contentType) {
        const modal = document.getElementById('master-chat-modal');
        const header = modal.querySelector('#master-chat-modal-header');
        const body = modal.querySelector('#master-chat-modal-body');

        // Clean up previous state
        if (modal.pickrInstance) {
            modal.pickrInstance.destroyAndRemove();
            modal.pickrInstance = null;
        }

        modal.dataset.username = username;
        let headerHTML = `Actions for <span class="username">${username}</span>`;
        let bodyHTML = '';

        if (contentType === 'actions') {
            bodyHTML = `
                <button id="modal-mute-btn" class="userscript-btn">Mute User</button>
                <button id="modal-tag-btn" class="userscript-btn">Tag / Edit Tag</button>
                <button id="modal-cancel-btn" class="userscript-btn" style="filter: grayscale(40%);">Cancel</button>`;
        }
        else if (contentType === 'tagging') {
            const userTags = GM_getValue('userTags', {});
            const currentUserData = userTags[username] || {};
            const currentTag = currentUserData.tag || '';

            headerHTML = `Edit Tag for <span class="username">${username}</span>`;
            bodyHTML = `
                <input type="text" id="tag-editor-input" placeholder="Enter tag text..." value="${currentTag}" style="width: 100%; margin-bottom: 15px; padding: 8px;">
                <label style="display: block; text-align: left; margin-bottom: 5px; font-size: 0.9em;">Tag Color:</label>
                <div id="tag-color-picker" style="margin-bottom: 20px;"></div>
                <button id="modal-save-tag-btn" class="userscript-btn">Save</button>
                <button id="modal-remove-tag-btn" class="userscript-btn" style="background: linear-gradient(145deg, #633737, #3d1d1d) !important;">Remove Tag</button>
                <button id="modal-back-btn" class="userscript-btn" style="filter: grayscale(40%);">Back</button>`;
        }

        header.innerHTML = headerHTML;
        body.innerHTML = bodyHTML;

        // Post-render setup for specific content
        if (contentType === 'tagging') {
            const userTags = GM_getValue('userTags', {});
            const currentUserData = userTags[username] || {};
            const currentColor = currentUserData.color || currentTheme.accentColor;
            const colorPickerEl = modal.querySelector('#tag-color-picker');

            modal.pickrInstance = Pickr.create({
                el: colorPickerEl,
                theme: 'nano',
                default: currentColor,
                components: {
                    preview: true, opacity: false, hue: true,
                    interaction: { hex: true, rgb: true, input: true, save: true }
                }
            });
        }
        modal.style.display = 'flex';
    }

    function closeMasterModal() {
        const modal = document.getElementById('master-chat-modal');
        if (modal) {
             if (modal.pickrInstance) {
                modal.pickrInstance.destroyAndRemove();
                modal.pickrInstance = null;
            }
            modal.style.display = 'none';
        }
    }


    const processMessageNode = (msgNode) => {
        const mutedUsers = GM_getValue('mutedUsers', {});
        const highlightKeywords = GM_getValue('highlightKeywords', []);
        const userTags = GM_getValue('userTags', {});

        const authorContainer = msgNode.querySelector('div[class*="mantine-Paper-root"] div[class*="mantine-Group-root"] > div[class*="mantine-Group-root"]');
        const usernameNode = authorContainer?.querySelector('p[data-truncate="end"]');
        const username = usernameNode?.textContent;
        const msgTextNode = msgNode.querySelector('p[style*="word-break: break-word"]');

        if (!username || !authorContainer || !msgTextNode) return;

        if (usernameNode && !usernameNode.classList.contains('username-clickable')) {
            usernameNode.classList.add('username-clickable');
            usernameNode.style.cursor = 'pointer';
            usernameNode.style.transition = 'filter 0.2s';
            usernameNode.title = `Actions for ${username}`;
            usernameNode.addEventListener('mouseenter', () => { usernameNode.style.filter = 'brightness(1.2)'; });
            usernameNode.addEventListener('mouseleave', () => { usernameNode.style.filter = 'none'; });
            usernameNode.onclick = (e) => {
                e.stopPropagation();
                openMasterModal(username, 'actions'); // Open the new master modal
            };
        }

        const existingTagEl = authorContainer.querySelector('.user-tag');
        if (existingTagEl) existingTagEl.remove();

        const userData = userTags[username];
        if (userData) {
            const tagText = typeof userData === 'object' ? userData.tag : userData;
            const bgColor = typeof userData === 'object' ? userData.color : currentTheme.accentColor;
            const textColor = getContrastingTextColor(bgColor);

            const tagElement = document.createElement('span');
            tagElement.className = 'user-tag';
            tagElement.textContent = tagText;
            tagElement.style.backgroundColor = bgColor;
            tagElement.style.color = textColor;

            if (authorContainer.querySelector('.username-clickable')) {
                 authorContainer.querySelector('.username-clickable').insertAdjacentElement('afterend', tagElement);
            } else {
                 usernameNode.insertAdjacentElement('afterend', tagElement);
            }
        }

        msgNode.style.display = mutedUsers[username] ? 'none' : '';

        const msgText = msgTextNode.textContent.toLowerCase();
        let isHighlighted = false;
        for (const kw of highlightKeywords) {
            if (kw && msgText.includes(kw.toLowerCase())) {
                msgNode.classList.add('chat-keyword-highlight');
                isHighlighted = true;
                break;
            }
        }
        if (!isHighlighted) msgNode.classList.remove('chat-keyword-highlight');
    };

    // =========================================================================
    // ===                      ADVANCED CHAT MODULE                         ===
    // =========================================================================
    function startAdvancedChatModule(chatContainer) {
        const userTags = GM_getValue('userTags', {});
        let needsUpdate = false;
        for (const username in userTags) {
            if (typeof userTags[username] === 'string') {
                needsUpdate = true;
                userTags[username] = {
                    tag: userTags[username],
                    color: currentTheme.accentColor
                };
            }
        }
        if (needsUpdate) {
            GM_setValue('userTags', userTags);
            console.log('[MASTER SCRIPT] Migrated userTags to new format.');
        }

        console.log('[MASTER SCRIPT] Chat container found. Initializing Advanced Chat panel...');

        const initialHTML = `
            <div class="chat-settings-section">
                <h5>Keyword Highlighting</h5>
                <div class="setting-row">
                    <input type="text" id="keyword-input" placeholder="Add a keyword..." style="width: 70%;" />
                    <button id="add-keyword-btn" class="userscript-btn" style="width: 28%;">Add</button>
                </div>
                <ul id="keyword-list" class="chat-settings-list"></ul>
            </div>
            <div class="chat-settings-section">
                <h5>Muted Users</h5>
                <ul id="muted-users-list" class="chat-settings-list"></ul>
            </div>
            <div class="chat-settings-section">
                <h5>Tagged Users</h5>
                <ul id="tagged-users-list" class="chat-settings-list"></ul>
            </div>`;
        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('advanced-chat-panel', 'Advanced Chat', initialHTML, { top: '350px', left: '20px' });

        const keywordInput = contentArea.querySelector('#keyword-input');
        const addKeywordBtn = contentArea.querySelector('#add-keyword-btn');
        const keywordList = contentArea.querySelector('#keyword-list');
        const mutedUsersList = contentArea.querySelector('#muted-users-list');
        const taggedUsersList = contentArea.querySelector('#tagged-users-list');

        addKeywordBtn.addEventListener('click', () => {
            const newKeyword = keywordInput.value.trim();
            const highlightKeywords = GM_getValue('highlightKeywords', []);
            if (newKeyword && !highlightKeywords.find(kw => kw.toLowerCase() === newKeyword.toLowerCase())) {
                highlightKeywords.push(newKeyword);
                GM_setValue('highlightKeywords', highlightKeywords);
                renderKeywordList();
                processAllMessages();
                keywordInput.value = '';
            }
        });

        keywordList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const kwToRemove = e.target.dataset.keyword;
                let highlightKeywords = GM_getValue('highlightKeywords', []);
                highlightKeywords = highlightKeywords.filter(kw => kw !== kwToRemove);
                GM_setValue('highlightKeywords', highlightKeywords);
                renderKeywordList();
                processAllMessages();
            }
        });

        mutedUsersList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const userToUnmute = e.target.dataset.username;
                let mutedUsers = GM_getValue('mutedUsers', {});
                delete mutedUsers[userToUnmute];
                GM_setValue('mutedUsers', mutedUsers);
                renderMutedUsersList();
                processAllMessages();
            }
        });

        taggedUsersList.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.remove-item-btn');
            if (removeButton) {
                e.stopPropagation();
                const userToUntag = removeButton.dataset.username;
                let userTags = GM_getValue('userTags', {});
                delete userTags[userToUntag];
                GM_setValue('userTags', userTags);
                renderTaggedUsersList();
                processAllMessages();
                return;
            }

            const listItem = e.target.closest('li[data-username]');
            if (listItem) {
                const userToEdit = listItem.dataset.username;
                openMasterModal(userToEdit, 'tagging');
            }
        });

        renderKeywordList();
        renderMutedUsersList();
        renderTaggedUsersList();

        minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('advanced-chat-panelMinimized', true); syncToolbar(); });
        if (GM_getValue('advanced-chat-panelMinimized', false)) panel.classList.add('minimized');

        // Initialize the master modal system as soon as the chat module starts
        initMasterModal();
    }

    function initAdvancedChatModuleWaiter() {
        console.log('[MASTER SCRIPT] Initializing Robust Advanced Chat Manager.');

        let uiInitialized = false;
        let workerObserver = null;

        const sentinelObserver = new MutationObserver(() => {
            const chatContainer = document.querySelector('aside[class*="mantine-AppShell-aside"]');

            if (!chatContainer) {
                if (workerObserver) {
                    workerObserver.disconnect();
                    workerObserver = null;
                }
                return;
            }

            if (!uiInitialized) {
                uiInitialized = true;
                startAdvancedChatModule(chatContainer);
            }

            const chatViewport = chatContainer.querySelector('.mantine-ScrollArea-viewport > div > div');

            if (chatViewport && (!workerObserver || !document.body.contains(workerObserver.target))) {
                if (workerObserver) workerObserver.disconnect();

                console.log('[MASTER SCRIPT] Chat viewport (re)detected. Applying all rules and observing for new messages.');
                processAllMessages();

                workerObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1) {
                                const messageNodes = node.matches('div[class*="mantine-Group-root"][style*="--group-align: flex-start"]') ? [node] : node.querySelectorAll('div[class*="mantine-Group-root"][style*="--group-align: flex-start"]');
                                messageNodes.forEach(processMessageNode);
                            }
                        }
                    }
                });

                workerObserver.observe(chatViewport, { childList: true });
                workerObserver.target = chatViewport;
            }
        });

        sentinelObserver.observe(document.body, { childList: true, subtree: true });
    }

    // =========================================================================
    // ===                 MASTER UI OBSERVER & ENTRY POINT                  ===
    // =========================================================================
    let isInitialized = false;
    function initializeMainScript() {
        if (isInitialized) return;
        const serverStatsButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Show Serverstats'));
        if (serverStatsButton) {
            isInitialized = true;
            console.log('[MASTER SCRIPT] UI Initialized.');
            initWallpaperModule();
            initCbTeamsModule();
            initThemeEditorModule();
            initAdvancedChatModuleWaiter();

            const toolbarObserver = new MutationObserver(syncToolbar);
            toolbarObserver.observe(document.body, { childList: true, subtree: true });
            syncToolbar();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMainScript);
    } else {
        initializeMainScript();
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            if (confirm('Are you sure you want to reset all panel positions, sizes, and opacity to default?')) {
                PANEL_IDS.forEach(id => {
                    GM_deleteValue(`${id}Position`);
                    GM_deleteValue(`${id}Dimensions`);
                    GM_deleteValue(`${id}Opacity`);
                });
                location.reload();
            }
        }
    });

})();