// ==UserScript==
// @name         the real and based CCO Experience beta v5
// @namespace    http://tampermonkey.net/
// @version      5.0
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
    const vpsDomain = 'https://wallpapers.gothgirlzsb.workers.dev/';
    const DEFAULT_THEME_CONFIG = {
        mainBackground: '#100d18',
        panelBackground: '#1a1527',
        scriptPanelBackground: 'rgba(26, 21, 39, 0.85)',
        primaryText: '#f4dfff',
        dimmedText: '#bba8d1',
        accentColor: '#79caff',
        usernameColor: '#ff8c00',
        canvasBackground: 'rgba(0, 0, 0, 0)',
        buttonGradientStart: '#4A3763',
        buttonGradientEnd: '#2C1D3D',
        buttonBorder: '#7a5a9b',
        buttonText: '#f4dfff',
        buttonHoverGlow: 'rgba(121, 202, 255, 0.5)',
        proTagColor: '#f78f8f',
        adminTagColor: '#f7d28f',
        modTagColor: '#8ff7d4'
    };

    const THEME_LABELS = {
        mainBackground: 'Page Background',
        panelBackground: 'Website Panels & Cards',
        scriptPanelBackground: 'Script Panel Background',
        primaryText: 'Accent & Chat text',
        dimmedText: 'Dimmed Text',
        accentColor: 'Primary Color',
        usernameColor: 'Username Color',
        canvasBackground: 'Plinko Background',
        buttonGradientStart: 'Button Gradient left',
        buttonGradientEnd: 'Button Gradient right',
        buttonBorder: 'Button Border',
        buttonText: 'Button Text',
        buttonHoverGlow: 'Button Hover Glow',
        proTagColor: '[Pro] Tag Color',
        adminTagColor: '[Admin] Tag Color',
        modTagColor: '[Mod] Tag Color'
    };

    const PANEL_IDS = ['wallpaper-panel', 'cb-teams-panel', 'theme-editor-panel', 'advanced-chat-panel', 'nav-editor-panel'];

    // =========================================================================
    // ===                 DYNAMIC THEME & STYLE INJECTION                   ===
    // =========================================================================
    function migrateTheme(theme) {
        if (!theme.scriptPanelBackground) {
            theme.scriptPanelBackground = theme.panelBackground;
        }
        return theme;
    }

    let currentTheme = migrateTheme({ ...DEFAULT_THEME_CONFIG, ...GM_getValue('lastLoadedTheme', {}) });

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

    const UI_THEMES = {
        'nano': 'Default (Nano)',
        'sleek': 'Sleek & Sharp',
        'retro': 'Retro Terminal',
        'light': 'Minimalist Light',
        'comic': 'Comic Book',
        'abyss': 'Deep Sea Abyss',
        'steampunk': 'Steampunk Inventor',
        'glacial': 'Glacial',
        'sakura': 'Cherry Blossom',
        'cyberpunk': 'Cyberpunk Grid',
        'wasteland': 'Wasteland Survivor'
    };

    function applyUiTheme(themeId) {
        const themeClass = `ui-theme-${themeId}`;
        for (const key of Object.keys(UI_THEMES)) {
            document.body.classList.remove(`ui-theme-${key}`);
        }
        document.body.classList.add(themeClass);
    }

    GM_addStyle(GM_getResourceText("PICKR_CSS"));
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bangers&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Sorts+Mill+Goudy&family=Press+Start+2P&display=swap');

        :root {
            --main-background: ${DEFAULT_THEME_CONFIG.mainBackground}; --panel-background: ${DEFAULT_THEME_CONFIG.panelBackground};
            --script-panel-background: ${DEFAULT_THEME_CONFIG.scriptPanelBackground};
            --primary-text: ${DEFAULT_THEME_CONFIG.primaryText}; --dimmed-text: ${DEFAULT_THEME_CONFIG.dimmedText};
            --accent-color: ${DEFAULT_THEME_CONFIG.accentColor}; --username-color: ${DEFAULT_THEME_CONFIG.usernameColor};
            --canvas-background: ${DEFAULT_THEME_CONFIG.canvasBackground};
            --button-gradient-start: ${DEFAULT_THEME_CONFIG.buttonGradientStart}; --button-gradient-end: ${DEFAULT_THEME_CONFIG.buttonGradientEnd};
            --button-border: ${DEFAULT_THEME_CONFIG.buttonBorder}; --button-text: ${DEFAULT_THEME_CONFIG.buttonText};
            --button-hover-glow: ${DEFAULT_THEME_CONFIG.buttonHoverGlow};

            --pro-tag-color: ${DEFAULT_THEME_CONFIG.proTagColor};
            --admin-tag-color: ${DEFAULT_THEME_CONFIG.adminTagColor};
            --mod-tag-color: ${DEFAULT_THEME_CONFIG.modTagColor};

            --mantine-color-orange-text: var(--username-color) !important;
            --mantine-color-dimmed: var(--dimmed-text) !important;
            --mantine-color-red-text: var(--pro-tag-color) !important;
            --mantine-color-yellow-text: var(--admin-tag-color) !important;
            --mantine-color-teal-4: var(--mod-tag-color) !important;
            --mantine-color-teal-text: var(--mod-tag-color) !important;
        }
        body { color: var(--primary-text) !important; }
        a { color: var(--accent-color) !important; }
        p[data-truncate="end"][style*="color: var(--mantine-color-orange-text)"] { color: var(--username-color) !important; }
        .text-gray-400, [data-mantine-color="dimmed"] { color: var(--dimmed-text) !important; }

        /* === FIX for Chat Font Size & Weight === */
        aside[class*="AppShell-aside"] p[data-truncate="end"] {
            font-size: var(--mantine-font-size-xs) !important;
            font-weight: normal !important;
        }

        body.wallpaper-ui-hidden:not(.wallpaper-disabled) #__next,
        body.wallpaper-ui-hidden:not(.wallpaper-disabled) .mantine-AppShell-main,
        body.wallpaper-ui-hidden:not(.wallpaper-disabled) .mantine-AppShell-header,
        body.wallpaper-ui-hidden:not(.wallpaper-disabled) .mantine-AppShell-navbar,
        body.wallpaper-ui-hidden:not(.wallpaper-disabled) .mantine-AppShell-aside,
        body.wallpaper-ui-hidden:not(.wallpaper-disabled) .mantine-Card-root,
        body.wallpaper-ui-hidden:not(.wallpaper-disabled) .mantine-Paper-root {
            background: none !important; background-color: transparent !important;
        }
        body:not(.wallpaper-ui-hidden) .mantine-AppShell-main, body.wallpaper-disabled .mantine-AppShell-main { background-color: var(--main-background) !important; }
        body:not(.wallpaper-ui-hidden) .mantine-Card-root, body:not(.wallpaper-ui-hidden) .mantine-Paper-root,
        body:not(.wallpaper-ui-hidden) .mantine-AppShell-header, body:not(.wallpaper-ui-hidden) .mantine-AppShell-navbar,
        body:not(.wallpaper-ui-hidden) .mantine-AppShell-aside, body.wallpaper-disabled .mantine-Card-root, body.wallpaper-disabled .mantine-Paper-root,
        body.wallpaper-disabled .mantine-AppShell-header, body.wallpaper-disabled .mantine-AppShell-navbar,
        body.wallpaper-disabled .mantine-AppShell-aside { background-color: var(--panel-background) !important; }

        #plinko canvas[style*="background"] { background: var(--canvas-background) !important; }
        #plinko ~ .mantine-Group-root .mantine-Card-root { background-color: var(--panel-background) !important; }
        .panel-content-inner { padding: 12px; }

        /* --- CORE PANEL STRUCTURE (NO VISUALS) --- */
        .floating-panel { position: fixed; z-index: 10000; min-width: 240px; max-width: 90vw; min-height: 100px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
        .floating-panel.minimized { display: none !important; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .panel-header-text { cursor: move; flex-grow: 1; user-select: none; }
        .panel-minimize-button { cursor: pointer; font-weight: bold; font-size: 1.2em; user-select: none; }
        .panel-content { flex-grow: 1; overflow-y: auto; padding: 0; }
        .panel-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize; background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%); }
        .floating-panel.snapping { transition: outline 0.1s ease; outline: 2px solid var(--accent-color) !important; }

        /* --- BUTTONS & INPUTS (BASE) - SCOPED --- */
        .cco-panel .userscript-btn, .cco-panel button, .cco-panel input:not([type=color]), .cco-panel select, .script-toolbar-button { transition: all 0.2s ease-in-out; }

        /* --- UI THEME: DEFAULT (NANO) - SCOPED --- */
        body.ui-theme-nano .floating-panel { font-family: 'Segoe UI', sans-serif; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); color: var(--primary-text); backdrop-filter: blur(10px); background: var(--script-panel-background); }
        body.ui-theme-nano .panel-header { padding: 12px 16px; background: rgba(255, 255, 255, 0.1); font-weight: bold; }
        body.ui-theme-nano .cco-panel .userscript-btn, body.ui-theme-nano .cco-panel button, body.ui-theme-nano .cco-panel input:not([type=color]), body.ui-theme-nano .cco-panel select, body.ui-theme-nano .script-toolbar-button { background: linear-gradient(145deg, var(--button-gradient-start), var(--button-gradient-end)) !important; border: 1px solid var(--button-border) !important; color: var(--button-text) !important; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-weight: bold; border-radius: 4px; }
        body.ui-theme-nano .cco-panel .userscript-btn:hover, body.ui-theme-nano .cco-panel button:hover, body.ui-theme-nano .script-toolbar-button:hover { transform: translateY(-1px); box-shadow: 0 0 15px 2px var(--button-hover-glow), 0 4px 8px rgba(0,0,0,0.4); filter: brightness(1.1); }

        /* --- UI THEME: SLEEK & SHARP (FIXED) - SCOPED --- */
        body.ui-theme-sleek .floating-panel { font-family: 'Inter', sans-serif; border-radius: 4px; backdrop-filter: none; border: 1px solid #333; background: #18181b; color: var(--primary-text); }
        body.ui-theme-sleek .panel-header { background: #222; padding: 8px 12px; font-weight: bold; }
        body.ui-theme-sleek .cco-panel .userscript-btn, body.ui-theme-sleek .cco-panel button, body.ui-theme-sleek .cco-panel input:not([type=color]), body.ui-theme-sleek .cco-panel select, body.ui-theme-sleek .script-toolbar-button { border-radius: 2px; box-shadow: none; font-weight: normal; background: #2a2a2e !important; border: 1px solid #444 !important; color: var(--button-text) !important; transition: background-color 0.2s, border-color 0.2s; }
        body.ui-theme-sleek .cco-panel .userscript-btn:hover, body.ui-theme-sleek .cco-panel button:hover, body.ui-theme-sleek .script-toolbar-button:hover { transform: none; box-shadow: none; filter: brightness(1.25); border-color: var(--accent-color) !important; }

        /* --- UI THEME: RETRO TERMINAL - SCOPED --- */
        body.ui-theme-retro .floating-panel { font-family: 'Fira Code', monospace; backdrop-filter: blur(1px); border: 1px solid #0F0; border-radius: 0; box-shadow: 0 0 15px #0F0 inset, 0 0 10px #0F0; text-shadow: 0 0 3px #0F0; color: #0F0 !important; background: rgba(0,20,0,0.9); }
        body.ui-theme-retro .panel-header { background: transparent; border-bottom: 1px solid #0F0; padding: 8px; font-weight: bold; }
        body.ui-theme-retro .panel-header-text, body.ui-theme-retro label { text-transform: uppercase; }
        body.ui-theme-retro ::-webkit-scrollbar-thumb { background: #0F0 !important; }
        body.ui-theme-retro .cco-panel .userscript-btn, body.ui-theme-retro .cco-panel button, body.ui-theme-retro .cco-panel input:not([type=color]), body.ui-theme-retro .cco-panel select, body.ui-theme-retro .script-toolbar-button { background: black !important; border: 1px solid #0F0 !important; border-radius: 0; box-shadow: none; color: #0F0 !important; text-shadow: 0 0 3px #0F0; font-weight: bold; }
        body.ui-theme-retro .cco-panel .userscript-btn:hover, body.ui-theme-retro .cco-panel button:hover, body.ui-theme-retro .script-toolbar-button:hover { transform: none; box-shadow: none; background: #0F0 !important; color: black !important; text-shadow: none; }
        body.ui-theme-retro .cco-panel select option { background: black !important; color: #0F0 !important; }

        /* --- UI THEME: MINIMALIST LIGHT - SCOPED --- */
        body.ui-theme-light .floating-panel { font-family: system-ui, sans-serif; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); color: #333 !important; backdrop-filter: none; background: rgba(245, 245, 245, 0.97); }
        body.ui-theme-light .panel-header { background: #eee; border-bottom: 1px solid #ccc; font-weight: 600; padding: 10px 14px; }
        body.ui-theme-light ::-webkit-scrollbar-thumb { background: #ccc !important; }
        body.ui-theme-light ::-webkit-scrollbar-track { background: #f0f0f0 !important; }
        body.ui-theme-light .cco-panel .userscript-btn, body.ui-theme-light .cco-panel button, body.ui-theme-light .cco-panel input:not([type=color]), body.ui-theme-light .cco-panel select, body.ui-theme-light .script-toolbar-button { background: #fff !important; border: 1px solid #bbb !important; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); color: #333 !important; font-weight: 600; }
        body.ui-theme-light .cco-panel .userscript-btn:hover, body.ui-theme-light .cco-panel button:hover, body.ui-theme-light .script-toolbar-button:hover { transform: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-color: var(--accent-color) !important; background: #fdfdfd !important; }
        body.ui-theme-light .cco-panel select option { background: white !important; color: #333 !important; }
        body.ui-theme-light #theme-editor-toggles, body.ui-theme-light .chat-settings-section, body.ui-theme-light #theme-profile-manager, body.ui-theme-light .ui-theme-manager, body.ui-theme-light .wallpaper-toggles, body.ui-theme-light #preset-theme-loader { border-color: #ddd; }

        /* --- UI THEME: COMIC BOOK - SCOPED --- */
        body.ui-theme-comic .floating-panel { font-family: 'Inter', sans-serif; border: 3px solid black; border-radius: 6px; box-shadow: 8px 8px 0px black; color: black !important; backdrop-filter: none; background: var(--script-panel-background); }
        body.ui-theme-comic .panel-header { font-family: 'Bangers', cursive; font-size: 1.5em; letter-spacing: 1px; background: #ffd700; border-bottom: 3px solid black; padding: 4px 12px; font-weight: normal; }
        body.ui-theme-comic .cco-panel .userscript-btn, body.ui-theme-comic .cco-panel button, body.ui-theme-comic .cco-panel input:not([type=color]), body.ui-theme-comic .cco-panel select, body.ui-theme-comic .script-toolbar-button { background: #ffeb3b !important; border: 2px solid black !important; border-radius: 4px; box-shadow: 3px 3px 0px #333; color: black !important; font-weight: bold; text-transform: uppercase; transition: transform 0.1s, box-shadow 0.1s; }
        body.ui-theme-comic .cco-panel .userscript-btn:hover, body.ui-theme-comic .cco-panel button:hover, body.ui-theme-comic .script-toolbar-button:hover { transform: translate(2px, 2px); box-shadow: 1px 1px 0px #333; filter: brightness(1.05); }
        body.ui-theme-comic .cco-panel select option { background: #fff8dc !important; color: black !important; }
        body.ui-theme-comic #theme-editor-toggles, body.ui-theme-comic .chat-settings-section, body.ui-theme-comic #theme-profile-manager, body.ui-theme-comic .ui-theme-manager, body.ui-theme-comic .wallpaper-toggles, body.ui-theme-comic #preset-theme-loader { border-color: #000; }

        /* --- UI THEME: DEEP SEA ABYSS - SCOPED --- */
        body.ui-theme-abyss .floating-panel { font-family: 'Inter', sans-serif; border: 1px solid #00c2c7; border-radius: 16px; box-shadow: 0 0 20px rgba(0, 194, 199, 0.3), inset 0 0 10px rgba(0,0,0,0.5); color: #c8ffff !important; backdrop-filter: blur(5px); background: var(--script-panel-background); }
        body.ui-theme-abyss .panel-header { background: linear-gradient(rgba(0,0,0,0.3), transparent); border-bottom: 1px solid rgba(0, 194, 199, 0.5); padding: 12px 16px; font-weight: bold; }
        body.ui-theme-abyss .cco-panel .userscript-btn, body.ui-theme-abyss .cco-panel button, body.ui-theme-abyss .cco-panel input:not([type=color]), body.ui-theme-abyss .cco-panel select, body.ui-theme-abyss .script-toolbar-button { background: rgba(0,0,0,0.3) !important; border: 1px solid rgba(0, 194, 199, 0.7) !important; border-radius: 8px; box-shadow: none; color: #c8ffff !important; transition: background 0.2s, box-shadow 0.2s; font-weight: bold; }
        body.ui-theme-abyss .cco-panel .userscript-btn:hover, body.ui-theme-abyss .cco-panel button:hover, body.ui-theme-abyss .script-toolbar-button:hover { background: rgba(0, 194, 199, 0.2) !important; box-shadow: 0 0 10px rgba(0, 194, 199, 0.5); transform: none; }
        body.ui-theme-abyss .cco-panel select option { background: #0b4e58 !important; color: #c8ffff !important; }

        /* --- UI THEME: STEAMPUNK INVENTOR - SCOPED --- */
        body.ui-theme-steampunk .floating-panel { font-family: 'Sorts Mill Goudy', serif; border: 3px double #a07d5a; border-radius: 3px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); color: #4a3c2a !important; backdrop-filter: none; background: var(--script-panel-background); }
        body.ui-theme-steampunk .panel-header { font-size: 1.2em; background: #c8bca7; border-bottom: 1px solid #a07d5a; box-shadow: inset 0 -2px 5px rgba(0,0,0,0.1); padding: 10px 14px; text-shadow: 1px 1px 0px #fff8; font-weight: bold; }
        body.ui-theme-steampunk .cco-panel .userscript-btn, body.ui-theme-steampunk .cco-panel button, body.ui-theme-steampunk .cco-panel input:not([type=color]), body.ui-theme-steampunk .cco-panel select, body.ui-theme-steampunk .script-toolbar-button { background: linear-gradient(to bottom, #c5a37f, #a07d5a) !important; border: 1px outset #a07d5a !important; border-radius: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); color: #3d2f1f !important; font-weight: bold; }
        body.ui-theme-steampunk .cco-panel .userscript-btn:hover, body.ui-theme-steampunk .cco-panel button:hover, body.ui-theme-steampunk .script-toolbar-button:hover { transform: none; filter: brightness(1.1); box-shadow: 0 0 8px rgba(255, 193, 7, 0.4); }
        body.ui-theme-steampunk .cco-panel select option { background: #e0d8c6 !important; color: #4a3c2a !important; }
        body.ui-theme-steampunk #theme-editor-toggles, body.ui-theme-steampunk .chat-settings-section, body.ui-theme-steampunk #theme-profile-manager, body.ui-theme-steampunk .ui-theme-manager, body.ui-theme-steampunk .wallpaper-toggles, body.ui-theme-steampunk #preset-theme-loader { border-color: #a07d5a; }

        /* --- UI THEME: GLACIAL - SCOPED --- */
        body.ui-theme-glacial .floating-panel { font-family: 'Inter', sans-serif; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 2px; box-shadow: 0 0 25px rgba(0, 150, 255, 0.2); color: #e0f8ff !important; backdrop-filter: blur(8px); background: linear-gradient(160deg, rgba(10, 25, 40, 0.85), rgba(20, 40, 60, 0.9)); }
        body.ui-theme-glacial .panel-header { background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding: 10px 14px; font-weight: 600; text-shadow: 0 0 5px rgba(0, 150, 255, 0.5); }
        body.ui-theme-glacial .cco-panel .userscript-btn, body.ui-theme-glacial .cco-panel button, body.ui-theme-glacial .cco-panel input:not([type=color]), body.ui-theme-glacial .cco-panel select, body.ui-theme-glacial .script-toolbar-button { background: rgba(0, 0, 0, 0.2) !important; border: 1px solid rgba(255, 255, 255, 0.3) !important; border-radius: 2px; box-shadow: none; color: #e0f8ff !important; font-weight: 600; }
        body.ui-theme-glacial .cco-panel .userscript-btn:hover, body.ui-theme-glacial .cco-panel button:hover, body.ui-theme-glacial .script-toolbar-button:hover { transform: none; background: rgba(0, 150, 255, 0.2) !important; border-color: #90d8ff !important; }
        body.ui-theme-glacial .cco-panel select option { background: #14283c !important; color: #e0f8ff !important; }

        /* --- UI THEME: CHERRY BLOSSOM (SAKURA) - SCOPED --- */
        body.ui-theme-sakura .floating-panel { font-family: 'Inter', sans-serif; border: 1px solid #c8a3b1; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); color: #3e2723 !important; backdrop-filter: none; }
        body.ui-theme-sakura .panel-header { background: #f8e8ee; border-bottom: 1px solid #e0c2cc; font-weight: 600; padding: 10px 14px; }
        body.ui-theme-sakura .cco-panel .userscript-btn, body.ui-theme-sakura .cco-panel button, body.ui-theme-sakura .cco-panel input:not([type=color]), body.ui-theme-sakura .cco-panel select, body.ui-theme-sakura .script-toolbar-button { background: #a5d6a7 !important; border: 1px solid #7a9c7b !important; border-radius: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); color: #1b3d1c !important; font-weight: 600; }
        body.ui-theme-sakura .cco-panel .userscript-btn:hover, body.ui-theme-sakura .cco-panel button:hover, body.ui-theme-sakura .script-toolbar-button:hover { transform: none; filter: brightness(1.05); box-shadow: 0 2px 5px rgba(0,0,0,0.15); }
        body.ui-theme-sakura .cco-panel select option { background: #f8f0f3 !important; color: #3e2723 !important; }
        body.ui-theme-sakura #theme-editor-toggles, body.ui-theme-sakura .chat-settings-section, body.ui-theme-sakura #theme-profile-manager, body.ui-theme-sakura .ui-theme-manager, body.ui-theme-sakura .wallpaper-toggles, body.ui-theme-sakura #preset-theme-loader { border-color: #e0c2cc; }

        /* --- UI THEME: CYBERPUNK GRID - SCOPED --- */
        body.ui-theme-cyberpunk .floating-panel { font-family: 'Fira Code', monospace; border: 1px solid #ff00ff; border-radius: 0; box-shadow: 0 0 20px #ff00ff, inset 0 0 15px rgba(255,0,255,0.3); color: #eeeeee !important; backdrop-filter: blur(2px); background-image: linear-gradient(rgba(0,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.2) 1px, transparent 1px); background-size: 20px 20px; }
        body.ui-theme-cyberpunk .panel-header { background: rgba(0,0,0,0.5); border-bottom: 1px solid #ff00ff; padding: 8px 12px; font-weight: bold; text-transform: uppercase; }
        body.ui-theme-cyberpunk .cco-panel .userscript-btn, body.ui-theme-cyberpunk .cco-panel button, body.ui-theme-cyberpunk .cco-panel input:not([type=color]), body.ui-theme-cyberpunk .cco-panel select, body.ui-theme-cyberpunk .script-toolbar-button { background: rgba(0,0,0,0.5) !important; border: 1px solid #00ffff !important; border-radius: 0; box-shadow: 0 0 5px #00ffff; color: #eeeeee !important; font-weight: bold; }
        body.ui-theme-cyberpunk .cco-panel .userscript-btn:hover, body.ui-theme-cyberpunk .cco-panel button:hover, body.ui-theme-cyberpunk .script-toolbar-button:hover { transform: none; box-shadow: 0 0 12px #00ffff; background: rgba(0, 255, 255, 0.2) !important; }
        body.ui-theme-cyberpunk .cco-panel select option { background: #1a092a !important; color: #eeeeee !important; }

        /* --- UI THEME: WASTELAND SURVIVOR - SCOPED --- */
        body.ui-theme-wasteland .floating-panel { font-family: 'Fira Code', monospace; border: 2px solid #5d4037; border-radius: 1px; box-shadow: 0 3px 8px rgba(0,0,0,0.4); color: #212121 !important; backdrop-filter: none; text-transform: uppercase; }
        body.ui-theme-wasteland .panel-header { background: #a1887f; border-bottom: 2px solid #5d4037; padding: 6px 10px; font-weight: bold; }
        body.ui-theme-wasteland .cco-panel .userscript-btn, body.ui-theme-wasteland .cco-panel button, body.ui-theme-wasteland .cco-panel input:not([type=color]), body.ui-theme-wasteland .cco-panel select, body.ui-theme-wasteland .script-toolbar-button { background: linear-gradient(#b0bec5, #90a4ae) !important; border: 1px solid #546e7a !important; border-style: outset !important; border-radius: 2px; box-shadow: none; color: #263238 !important; font-weight: bold; }
        body.ui-theme-wasteland .cco-panel .userscript-btn:hover, body.ui-theme-wasteland .cco-panel button:hover, body.ui-theme-wasteland .script-toolbar-button:hover { transform: none; filter: brightness(1.1); }
        body.ui-theme-wasteland .cco-panel select option { background: #d7ccc8 !important; color: #212121 !important; }
        body.ui-theme-wasteland #theme-editor-toggles, body.ui-theme-wasteland .chat-settings-section, body.ui-theme-wasteland #theme-profile-manager, body.ui-theme-wasteland .ui-theme-manager, body.ui-theme-wasteland .wallpaper-toggles, body.ui-theme-wasteland #preset-theme-loader { border-color: #5d4037; }

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
        #preset-theme-loader, .ui-theme-manager, #theme-profile-manager { border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 12px; }
        #preset-theme-loader label, .ui-theme-manager label, #theme-profile-manager label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 0.9em; }
        #preset-theme-select, #ui-theme-select, #theme-profile-select, #theme-profile-manager input { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 4px; }
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
        #theme-editor-toggles, .chat-settings-section, .wallpaper-toggles { border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
        .toggle-row, .setting-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.9em; }

        .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #3e3850; transition: .3s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--accent-color); }
        input:checked + .slider:before { transform: translateX(20px); }

        #master-chat-modal { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.7); z-index: 10002; justify-content: center; align-items: center; }
        #master-chat-modal-content { background: var(--panel-background); padding: 20px; border-radius: 12px; border: 1px solid var(--button-border); box-shadow: 0 5px 25px rgba(0,0,0,0.5); min-width: 250px; text-align: center; }
        #master-chat-modal-header { font-size: 1.2em; font-weight: bold; margin-bottom: 20px; color: var(--primary-text); }
        #master-chat-modal-header .username { color: var(--accent-color); }
        #master-chat-modal-body button { display: block; width: 100%; margin-bottom: 10px; padding: 10px; }
        .chat-keyword-highlight > div[class*="mantine-Paper-root"] { background: rgba(255, 215, 0, 0.15) !important; border-left: 3px solid #ffd700; }
        .chat-settings-list { list-style: none; padding: 0; margin: 0; max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 4px; padding: 5px; }
        .chat-settings-list li { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-size: 0.85em; }
        .chat-settings-list li:nth-child(even) { background-color: rgba(255,255,255,0.05); }
        .remove-item-btn { cursor: pointer; color: #ff6b6b; font-weight: bold; }
        .user-tag { font-size: 10px; padding: 1px 5px; border-radius: 8px; background-color: var(--accent-color); color: var(--panel-background); font-weight: bold; margin-left: 6px; text-shadow: none; display: inline-block; vertical-align: middle; }
        #tagged-users-list .tag-text { font-style: italic; background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; font-size: 0.9em; margin-left: 8px; }
    `);

    // =========================================================================
    // ===                         GLOBAL HELPERS                            ===
    // =========================================================================
    let activeWallpaperWindow = null;
    let isUiVisibleWhenWallpaperActive = GM_getValue('isUiVisibleWhenWallpaperActive', false);
    window.addEventListener('mousemove', (e) => { if (activeWallpaperWindow) activeWallpaperWindow.postMessage({ type: 'mousemove', x: e.clientX, y: e.clientY }, '*'); });

    function getContrastingTextColor(hexColor) {
        if (!hexColor || hexColor.length < 4) return '#FFFFFF';
        let r, g, b;
        if (hexColor.length === 4) { r = parseInt(hexColor[1] + hexColor[1], 16); g = parseInt(hexColor[2] + hexColor[2], 16); b = parseInt(hexColor[3] + hexColor[3], 16); }
        else { r = parseInt(hexColor.substr(1, 2), 16); g = parseInt(hexColor.substr(3, 2), 16); b = parseInt(hexColor.substr(5, 2), 16); }
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    function createDraggablePanel(id, headerText, innerHTML, defaultPos) {
        let container = document.getElementById(id);
        if (container) return { container, minimizeButton: container.querySelector('.panel-minimize-button'), contentArea: container.querySelector('.panel-content-inner') };

        container = document.createElement('div');
        container.id = id;
        // THE ONLY CHANGE IS ADDING 'cco-panel' HERE
        container.className = 'floating-panel cco-panel';
        container.innerHTML = `<div class="panel-header"><span class="panel-header-text">${headerText}</span><span class="panel-minimize-button" title="Minimize">−</span></div><div class="panel-content"><div class="panel-content-inner">${innerHTML}</div></div><div class="panel-resize-handle"></div>`;
        document.body.appendChild(container);

        const header = container.querySelector('.panel-header-text');
        const minimizeButton = container.querySelector('.panel-minimize-button');
        const contentArea = container.querySelector('.panel-content-inner');
        const resizeHandle = container.querySelector('.panel-resize-handle');

        let isDragging = false, isResizing = false;
        let offset = { x: 0, y: 0 };
        let initialSize = { width: 0, height: 0 };

        header.addEventListener('mousedown', (e) => { isDragging = true; offset = { x: e.clientX - container.offsetLeft, y: e.clientY - container.offsetTop }; });
        resizeHandle.addEventListener('mousedown', (e) => { e.stopPropagation(); isResizing = true; offset = { x: e.clientX, y: e.clientY }; initialSize = { width: container.offsetWidth, height: container.offsetHeight }; });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                let newLeft = e.clientX - offset.x; let newTop = e.clientY - offset.y;
                const snapThreshold = 20; let isSnapping = false;
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
                container.style.left = `${newLeft}px`; container.style.top = `${newTop}px`;
            }
            if (isResizing) { const newWidth = initialSize.width + (e.clientX - offset.x); const newHeight = initialSize.height + (e.clientY - offset.y); container.style.width = `${newWidth}px`; container.style.height = `${newHeight}px`; }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; container.classList.remove('snapping'); GM_setValue(`${id}Position`, { top: container.style.top, left: container.style.left }); }
            if (isResizing) { isResizing = false; GM_setValue(`${id}Dimensions`, { width: container.style.width, height: container.style.height }); }
        });

        const savedPos = GM_getValue(`${id}Position`, defaultPos); container.style.top = savedPos.top; container.style.left = savedPos.left;
        const savedDims = GM_getValue(`${id}Dimensions`); if (savedDims) { container.style.width = savedDims.width; container.style.height = savedDims.height; }
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
            if (!btn) { btn = document.createElement('button'); btn.id = id; btn.className = 'script-toolbar-button userscript-btn'; btn.innerHTML = text; btn.onclick = onClick; toolbar.appendChild(btn); }
            return btn;
        }
        const wpBtn = createOrGetButton('restore-wallpaper-btn', '🎨<span>Wallpapers</span>', () => { document.getElementById('wallpaper-panel')?.classList.remove('minimized'); GM_setValue('wallpaper-panelMinimized', false); syncToolbar(); });
        const cbBtn = createOrGetButton('restore-cb-teams-btn', '📊<span>CB Teams</span>', () => { document.getElementById('cb-teams-panel')?.classList.remove('minimized'); GM_setValue('cb-teams-panelMinimized', false); syncToolbar(); });
        const themeBtn = createOrGetButton('restore-theme-editor-btn', '🖌️<span>Theme</span>', () => { document.getElementById('theme-editor-panel')?.classList.remove('minimized'); GM_setValue('theme-editor-panelMinimized', false); syncToolbar(); });
        const chatBtn = createOrGetButton('restore-advanced-chat-btn', '💬<span>Chat</span>', () => { document.getElementById('advanced-chat-panel')?.classList.remove('minimized'); GM_setValue('advanced-chat-panelMinimized', false); syncToolbar(); });
        const navBtn = createOrGetButton('restore-nav-editor-btn', '⚙️<span>Nav</span>', () => { document.getElementById('nav-editor-panel')?.classList.remove('minimized'); GM_setValue('nav-editor-panelMinimized', false); syncToolbar(); }); // NEW Nav button

        wpBtn.style.display = GM_getValue('wallpaper-panelMinimized', false) ? 'inline-flex' : 'none';
        cbBtn.style.display = GM_getValue('cb-teams-panelMinimized', false) ? 'inline-flex' : 'none';
        themeBtn.style.display = GM_getValue('theme-editor-panelMinimized', false) ? 'inline-flex' : 'none';
        navBtn.style.display = GM_getValue('nav-editor-panelMinimized', false) ? 'inline-flex' : 'none'; // NEW visibility logic

        const chatPanelExists = !!document.getElementById('advanced-chat-panel');
        chatBtn.disabled = !chatPanelExists;
        chatBtn.style.opacity = chatPanelExists ? '1' : '0.5';
        chatBtn.style.cursor = chatPanelExists ? 'pointer' : 'not-allowed';
        chatBtn.title = chatPanelExists ? 'Show Advanced Chat Settings' : 'Chat settings are not available on this page.';
        chatBtn.style.display = chatPanelExists && GM_getValue('advanced-chat-panelMinimized', false) ? 'inline-flex' : 'none';
    }

    // =========================================================================
    // ===                        WALLPAPER MODULE                           ===
    // =========================================================================
    function initWallpaperModule() {
        let dynamicWallpapers = {};
        let favoriteWallpapers = GM_getValue('favoriteWallpapers', []);
        let privateWallpapers = GM_getValue('privateWallpapers', {});
        let currentView = 'all';
        function updateWallpaperUiVisibility() {
            const isWallpaperActive = !document.body.classList.contains('wallpaper-disabled');
            if (isWallpaperActive && !isUiVisibleWhenWallpaperActive) { document.body.classList.add('wallpaper-ui-hidden'); }
            else { document.body.classList.remove('wallpaper-ui-hidden'); }
        }
        function loadWallpaper(wallpaperId, isPrivate = false) {
            if (wallpaperId === 'random') {
                const visibleIds = Array.from(contentArea.querySelectorAll('.wallpaper-option[data-id]:not(.special-option)')).map(el => el.dataset.id).filter(id => id !== 'none');
                if (visibleIds.length > 0) { const randomId = visibleIds[Math.floor(Math.random() * visibleIds.length)]; loadWallpaper(randomId, !!privateWallpapers[randomId]); }
                return;
            }
            const currentIframe = document.querySelector('.wallpaper-engine-iframe');
            if (currentIframe) currentIframe.remove();
            activeWallpaperWindow = null;
            if (wallpaperId === 'none') {
                document.body.classList.add('wallpaper-disabled');
                GM_setValue('selectedWallpaper', 'none');
                updateWallpaperUiVisibility();
                return;
            }
            const wallpaperFolder = isPrivate ? wallpaperId : (dynamicWallpapers[wallpaperId]?.folder);
            if (!wallpaperFolder) { console.error(`[CCO] Wallpaper folder not found for ID: ${wallpaperId}`); return; }
            const newIframe = document.createElement('iframe');
            newIframe.className = 'wallpaper-engine-iframe';
            newIframe.style.opacity = '0';
            newIframe.style.transition = 'opacity 0.4s ease';
            newIframe.allow = 'autoplay; fullscreen';
            newIframe.addEventListener('load', () => { document.body.classList.remove('wallpaper-disabled'); activeWallpaperWindow = newIframe.contentWindow; newIframe.style.opacity = '1'; updateWallpaperUiVisibility(); }, { once: true });
            newIframe.src = `${vpsDomain}/${wallpaperFolder}/index.html`;
            document.body.appendChild(newIframe);
            GM_setValue('selectedWallpaper', isPrivate ? `private:${wallpaperId}` : wallpaperId);
        }
        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('wallpaper-panel', 'Wallpapers', '', { top: '20px', left: '20px' });
        contentArea.style.padding = "12px";
        function renderWallpaperList() {
            contentArea.innerHTML = '';
            const filterContainer = document.createElement('div');
            filterContainer.style.display = 'flex';
            filterContainer.style.marginBottom = '8px';
            filterContainer.innerHTML = `<button class="userscript-btn wallpaper-filter-btn ${currentView === 'all' ? 'active' : ''}" data-view="all" style="flex: 1; border-radius: 4px 0 0 4px; ${currentView !== 'all' ? 'filter: brightness(0.7);' : ''}">All</button><button class="userscript-btn wallpaper-filter-btn ${currentView === 'favorites' ? 'active' : ''}" data-view="favorites" style="flex: 1; border-radius: 0; margin-left: -1px !important; ${currentView !== 'favorites' ? 'filter: brightness(0.7);' : ''}">Favorites ★</button><button class="userscript-btn wallpaper-filter-btn ${currentView === 'private' ? 'active' : ''}" data-view="private" style="flex: 1; border-radius: 0 4px 4px 0; margin-left: -1px !important; ${currentView !== 'private' ? 'filter: brightness(0.7);' : ''}">Private 🔑</button>`;
            contentArea.appendChild(filterContainer);
            const listContainer = document.createElement('div');
            contentArea.appendChild(listContainer);
            if (currentView === 'private') {
                const privateEntries = Object.entries(privateWallpapers);
                if (privateEntries.length === 0) { listContainer.innerHTML = `<div style="text-align:center; padding: 10px; opacity: 0.7;">No private wallpapers added yet.</div>`; }
                else { privateEntries.forEach(([id, name]) => { listContainer.insertAdjacentHTML('beforeend', `<div class="wallpaper-option private-wallpaper" data-id="${id}"><span>${name}</span><span class="remove-private-wallpaper" data-id="${id}" title="Remove Private Wallpaper" style="cursor:pointer;color:#ff6b6b;font-weight:bold;">✖</span></div>`); }); }
                contentArea.insertAdjacentHTML('beforeend', `<div style="border-top: 1px solid #444; margin-top: 12px; padding-top: 12px;"><h5 style="text-align: center; margin: -5px 0 10px 0; color: var(--dimmed-text);">Add Private Wallpaper</h5><div style="display: flex; gap: 8px;"><input type="text" id="private-wallpaper-id-input" placeholder="Enter Private ID..." style="flex-grow: 1;"/><button id="add-private-wallpaper-btn" class="userscript-btn" style="flex-shrink: 0;">Add</button></div></div>`);
            } else {
                let wallpapersToRender = Object.values(dynamicWallpapers);
                if (currentView === 'favorites') { wallpapersToRender = wallpapersToRender.filter(wp => favoriteWallpapers.includes(wp.id)); }
                if (wallpapersToRender.length === 0) { listContainer.innerHTML = `<div style="text-align:center; padding: 10px; opacity: 0.7;">No favorites yet. Click the ★ to add some.</div>`; }
                else { wallpapersToRender.forEach(wp => { const isFavorited = favoriteWallpapers.includes(wp.id); listContainer.insertAdjacentHTML('beforeend', `<div class="wallpaper-option" data-id="${wp.id}"><span>${wp.name}</span><span class="favorite-star ${isFavorited ? 'favorited' : ''}" data-id="${wp.id}" title="Toggle Favorite">★</span></div>`); }); }
            }
            const togglesContainer = document.createElement('div');
            togglesContainer.className = 'wallpaper-toggles';
            togglesContainer.style.borderTop = '1px solid #333';
            togglesContainer.style.paddingTop = '12px';
            togglesContainer.style.marginTop = '8px';
            togglesContainer.innerHTML = `<div class="toggle-row"><span>Solid UI with Wallpaper</span><label class="switch"><input type="checkbox" id="ui-visibility-toggle"><span class="slider"></span></label></div>`;
            contentArea.appendChild(togglesContainer);
            const uiVisibilityToggle = contentArea.querySelector('#ui-visibility-toggle');
            uiVisibilityToggle.checked = isUiVisibleWhenWallpaperActive;
            uiVisibilityToggle.addEventListener('change', () => { isUiVisibleWhenWallpaperActive = uiVisibilityToggle.checked; GM_setValue('isUiVisibleWhenWallpaperActive', isUiVisibleWhenWallpaperActive); updateWallpaperUiVisibility(); });
            const specialOptionsContainer = document.createElement('div');
            specialOptionsContainer.innerHTML = `<div class="wallpaper-option special-option" data-id="none">Disable Wallpaper</div><div class="wallpaper-option special-option" data-id="random">✨ Select Random</div>`;
            contentArea.appendChild(specialOptionsContainer);
        }
        minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('wallpaper-panelMinimized', true); syncToolbar(); });
        if (GM_getValue('wallpaper-panelMinimized', false)) panel.classList.add('minimized');
        contentArea.addEventListener('click', (event) => {
            const filterBtn = event.target.closest('.wallpaper-filter-btn');
            if (filterBtn) { currentView = filterBtn.dataset.view; renderWallpaperList(); return; }
            if (event.target.id === 'add-private-wallpaper-btn') {
                const input = contentArea.querySelector('#private-wallpaper-id-input');
                const newId = input.value.trim();
                if (newId && !privateWallpapers[newId]) {
                    const name = prompt(`Enter a display name for the wallpaper ID "${newId}":`, newId);
                    if (name) { privateWallpapers[newId] = name; GM_setValue('privateWallpapers', privateWallpapers); renderWallpaperList(); }
                } else if (privateWallpapers[newId]) { alert('This private wallpaper ID has already been added.'); }
                return;
            }
            const removeBtn = event.target.closest('.remove-private-wallpaper');
            if (removeBtn) {
                event.stopPropagation();
                const idToRemove = removeBtn.dataset.id;
                if (confirm(`Are you sure you want to remove the private wallpaper "${privateWallpapers[idToRemove]}"?`)) { delete privateWallpapers[idToRemove]; GM_setValue('privateWallpapers', privateWallpapers); renderWallpaperList(); }
                return;
            }
            const star = event.target.closest('.favorite-star');
            if (star) {
                event.stopPropagation();
                const wallpaperId = star.dataset.id;
                if (favoriteWallpapers.includes(wallpaperId)) { favoriteWallpapers = favoriteWallpapers.filter(id => id !== wallpaperId); star.classList.remove('favorited'); }
                else { favoriteWallpapers.push(wallpaperId); star.classList.add('favorited'); }
                GM_setValue('favoriteWallpapers', favoriteWallpapers);
                if (currentView === 'favorites') renderWallpaperList();
                return;
            }
            const target = event.target.closest('.wallpaper-option');
            if (target) { const isPrivate = target.classList.contains('private-wallpaper'); loadWallpaper(target.dataset.id, isPrivate); }
        });
        GM_xmlhttpRequest({
            method: 'GET', url: `${vpsDomain}/wallpapers.json`,
            onload: (response) => {
                if (response.status !== 200) { contentArea.textContent = `Error: Server returned ${response.status}`; return; }
                try {
                    const wallpaperArray = JSON.parse(response.responseText);
                    dynamicWallpapers = wallpaperArray.reduce((acc, wp) => ({...acc, [wp.id]: wp }), {});
                    renderWallpaperList();
                    let savedWallpaper = GM_getValue('selectedWallpaper', 'punk_lord');
                    if (savedWallpaper.startsWith('private:')) {
                        const privateId = savedWallpaper.substring(8);
                        if (privateWallpapers[privateId]) { loadWallpaper(privateId, true); }
                    } else { loadWallpaper(savedWallpaper, false); }
                } catch (e) { contentArea.textContent = "Error processing wallpaper list."; }
            },
            onerror: () => { contentArea.textContent = "Error fetching wallpaper list."; }
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
            resultContainer.innerHTML = `<hr style="border-color: #333; margin: 12px 0;"><div style="border:1px solid #333;padding:10px;border-radius:8px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><strong style="color:${blueColor};">Blue Team</strong><strong style="color:${teamATotalDisplayColor};font-size:1.3em;">${formatCurrency(teamASumDollars)}</strong></div><div style="text-align:center;background:rgba(0,0,0,0.2);padding:5px 0;border-radius:8px;">${createPlayerList(teamAPercentages, playerImages, 0)}</div></div> <div style="border:1px solid #333;padding:10px;border-radius:8px;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><strong style="color:${redColor};">Red Team</strong><strong style="color:${teamBTotalDisplayColor};font-size:1.3em;">${formatCurrency(teamBSumDollars)}</strong></div><div style="text-align:center;background:rgba(0,0,0,0.2);padding:5px 0;border-radius:8px;">${createPlayerList(teamBPercentages, playerImages, midIndex)}</div></div> <div style="border-top:1px solid #333;margin-top:16px;padding-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;"> <div><div style="font-size:0.8em;color:#8899a6;">TOTAL POT</div><div style="font-weight:700;">${formatCurrency(totalValue)}</div></div> <div><div style="font-size:0.8em;color:#8899a6;">$ DIFF</div><div style="font-weight:700;color:${teamASumDollars>teamBSumDollars?blueColor:redColor};">${formatCurrency(Math.abs(teamASumDollars-teamBSumDollars))}</div></div> <div><div style="font-weight:700;color:#2ee071;">WIN VALUE</div><div style="font-weight:700;color:#2ee071;">${formatCurrency(totalValue / (midIndex || 1))}</div></div> </div>`;
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
        const PRESET_COLOR_THEMES = {
            'default': { name: "Default Dark", colors: { ...DEFAULT_THEME_CONFIG } },
            'wallpaper': {
                name: "Gameplay Friendly",
                colors: {
                    mainBackground: 'rgba(29, 29, 32, 0.31)', panelBackground: 'rgba(0, 0, 0, 0.44)', scriptPanelBackground: 'rgba(0, 0, 0, 0.44)',
                    primaryText: '#F4DFFF', dimmedText: '#BBA8D1', accentColor: '#FF8C00', usernameColor: '#FF8C00',
                    canvasBackground: 'rgba(255, 255, 255, 0.5)', buttonGradientStart: '#242321', buttonGradientEnd: '#3A3934',
                    buttonBorder: '#000000', buttonText: '#FFFFFF', buttonHoverGlow: 'rgba(237, 63, 8, 0.79)',
                    proTagColor: '#f78f8f', adminTagColor: '#f7d28f', modTagColor: '#8ff7d4'
                }
            },
            'comic': {
                name: "Comic Book Colors",
                colors: {
                    mainBackground: '#5c9bd8', panelBackground: '#d8c05c', scriptPanelBackground: 'rgba(255, 248, 220, 0.95)',
                    primaryText: '#000000', dimmedText: '#444444', accentColor: '#d85c5c', usernameColor: '#2a6a3b',
                    canvasBackground: 'rgba(255, 255, 255, 0.5)', buttonGradientStart: '#ffd700', buttonGradientEnd: '#f0c400',
                    buttonBorder: '#000000', buttonText: '#000000', buttonHoverGlow: 'rgba(255, 87, 34, 0.7)',
                    proTagColor: '#d85c5c', adminTagColor: '#d8c05c', modTagColor: '#5c9bd8'
                }
            },
            'abyss': {
                name: "Deep Sea Colors",
                colors: {
                    mainBackground: '#020a12', panelBackground: '#082830', scriptPanelBackground: 'rgba(11, 78, 88, 0.9)',
                    primaryText: '#b0f5ff', dimmedText: '#5f98a8', accentColor: '#00e5ff', usernameColor: '#f7ffb0',
                    canvasBackground: 'rgba(0,0,0,0)', buttonGradientStart: '#0d5c6a', buttonGradientEnd: '#0a4955',
                    buttonBorder: '#00c2c7', buttonText: '#b0f5ff', buttonHoverGlow: 'rgba(0, 229, 255, 0.5)',
                    proTagColor: '#00e5ff', adminTagColor: '#f7ffb0', modTagColor: '#00c2c7'
                }
            },
            'steampunk': {
                name: "Steampunk Colors",
                colors: {
                    mainBackground: '#5a4a3a', panelBackground: '#a08d7a', scriptPanelBackground: 'rgba(224, 216, 198, 0.96)',
                    primaryText: '#4a3c2a', dimmedText: '#6a5c4a', accentColor: '#8a4b08', usernameColor: '#6a0a0a',
                    canvasBackground: 'rgba(224, 216, 198, 0.2)', buttonGradientStart: '#c5a37f', buttonGradientEnd: '#a07d5a',
                    buttonBorder: '#6a5c4a', buttonText: '#2a1c0a', buttonHoverGlow: 'rgba(255, 193, 7, 0.4)',
                    proTagColor: '#8a4b08', adminTagColor: '#c5a37f', modTagColor: '#a08d7a'
                }
            },
            'glacial': {
                name: "Glacial Colors",
                colors: {
                    mainBackground: '#05080c', panelBackground: '#1a2430', scriptPanelBackground: 'rgba(10, 25, 40, 0.85)',
                    primaryText: '#e0f8ff', dimmedText: '#80a4b8', accentColor: '#00d9ff', usernameColor: '#a0ffc8',
                    canvasBackground: 'rgba(0, 0, 0, 0)', buttonGradientStart: '#1c2a38', buttonGradientEnd: '#121e2a',
                    buttonBorder: '#40a8d0', buttonText: '#e0f8ff', buttonHoverGlow: 'rgba(0, 217, 255, 0.5)',
                    proTagColor: '#00d9ff', adminTagColor: '#a0ffc8', modTagColor: '#80a4b8'
                }
            },
            'sakura': {
                name: "Cherry Blossom Colors",
                colors: {
                    mainBackground: '#3b2323', panelBackground: '#a1887f', scriptPanelBackground: 'rgba(255, 240, 245, 0.95)',
                    primaryText: '#3e2723', dimmedText: '#6d4c41', accentColor: '#ec407a', usernameColor: '#43a047',
                    canvasBackground: 'rgba(255, 240, 245, 0.3)', buttonGradientStart: '#a5d6a7', buttonGradientEnd: '#81c784',
                    buttonBorder: '#558b2f', buttonText: '#1b3d1c', buttonHoverGlow: 'rgba(255, 138, 101, 0.7)',
                    proTagColor: '#ec407a', adminTagColor: '#43a047', modTagColor: '#a1887f'
                }
            },
            'cyberpunk': {
                name: "Cyberpunk Colors",
                colors: {
                    mainBackground: '#0c0314', panelBackground: '#1a092a', scriptPanelBackground: 'rgba(26, 9, 42, 0.85)',
                    primaryText: '#eeeeee', dimmedText: '#892ca0', accentColor: '#00ffff', usernameColor: '#39ff14',
                    canvasBackground: 'rgba(0,0,0,0)', buttonGradientStart: '#2c003e', buttonGradientEnd: '#1e002b',
                    buttonBorder: '#00ffff', buttonText: '#eeeeee', buttonHoverGlow: 'rgba(255, 0, 255, 0.7)',
                    proTagColor: '#00ffff', adminTagColor: '#39ff14', modTagColor: '#ff00ff'
                }
            },
            'wasteland': {
                name: "Wasteland Colors",
                colors: {
                    mainBackground: '#3e3529', panelBackground: '#795548', scriptPanelBackground: 'rgba(215, 204, 200, 0.9)',
                    primaryText: '#212121', dimmedText: '#5d4037', accentColor: '#bf360c', usernameColor: '#556b2f',
                    canvasBackground: 'rgba(215, 204, 200, 0.2)', buttonGradientStart: '#b0bec5', buttonGradientEnd: '#90a4ae',
                    buttonBorder: '#546e7a', buttonText: '#263238', buttonHoverGlow: 'rgba(255, 235, 59, 0.5)',
                    proTagColor: '#bf360c', adminTagColor: '#556b2f', modTagColor: '#795548'
                }
            }
        };

        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('theme-editor-panel', 'Theme Editor', '', { top: '20px', left: '580px' });
        let isHighlightingEnabled = GM_getValue('highlightModeEnabled', true);
        let isRainbowModeEnabled = GM_getValue('rainbowModeEnabled', false);

        const uiThemeManager = document.createElement('div');
        uiThemeManager.className = 'ui-theme-manager';
        uiThemeManager.innerHTML = `<label for="ui-theme-select">UI Theme</label><select id="ui-theme-select"></select>`;
        contentArea.appendChild(uiThemeManager);
        const uiThemeSelect = uiThemeManager.querySelector('#ui-theme-select');
        for (const [id, name] of Object.entries(UI_THEMES)) { uiThemeSelect.add(new Option(name, id)); }
        const savedUiTheme = GM_getValue('selectedUiTheme', 'nano');
        uiThemeSelect.value = savedUiTheme;
        applyUiTheme(savedUiTheme);
        uiThemeSelect.onchange = () => { const selectedThemeId = uiThemeSelect.value; GM_setValue('selectedUiTheme', selectedThemeId); applyUiTheme(selectedThemeId); };

        const presetLoader = document.createElement('div');
        presetLoader.id = 'preset-theme-loader';
        presetLoader.innerHTML = `<label for="preset-theme-select">Load Preset Color Theme</label><div style="display: flex; gap: 8px;"><select id="preset-theme-select" style="flex-grow: 1;"></select><button id="load-preset-btn" class="userscript-btn" style="flex-shrink: 0;">Load</button></div>`;
        contentArea.appendChild(presetLoader);
        const presetSelect = presetLoader.querySelector('#preset-theme-select');
        for (const [id, data] of Object.entries(PRESET_COLOR_THEMES)) { presetSelect.add(new Option(data.name, id)); }
        presetLoader.querySelector('#load-preset-btn').onclick = () => {
            const presetId = presetSelect.value;
            const preset = PRESET_COLOR_THEMES[presetId];
            if (preset && confirm(`Are you sure you want to load the "${preset.name}" color preset? This will overwrite your current unsaved colors.`)) {
                currentTheme = { ...DEFAULT_THEME_CONFIG, ...preset.colors };
                applyTheme(currentTheme);
                // ADDED: Reprocess after action
                processAllMessages();
                populateColorPickers(currentTheme);
                alert(`Preset "${preset.name}" loaded! You can now customize it or save it as a new profile.`);
            }
        };

        const togglesContainer = document.createElement('div');
        togglesContainer.id = 'theme-editor-toggles';
        togglesContainer.innerHTML = `<div class="toggle-row"><span>Enable Hover Highlighting</span><label class="switch"><input type="checkbox" id="highlight-toggle"><span class="slider"></span></label></div><div class="toggle-row"><span>🌈 Rainbow Mode</span><label class="switch"><input type="checkbox" id="rainbow-toggle"><span class="slider"></span></label></div>`;
        contentArea.appendChild(togglesContainer);
        const highlightToggle = togglesContainer.querySelector('#highlight-toggle');
        highlightToggle.checked = isHighlightingEnabled;
        highlightToggle.onchange = () => { isHighlightingEnabled = highlightToggle.checked; GM_setValue('highlightModeEnabled', isHighlightingEnabled); };
        const rainbowToggle = togglesContainer.querySelector('#rainbow-toggle');
        rainbowToggle.checked = isRainbowModeEnabled;
        rainbowToggle.onchange = () => { isRainbowModeEnabled = rainbowToggle.checked; GM_setValue('rainbowModeEnabled', isRainbowModeEnabled); document.body.classList.toggle('rainbow-mode', isRainbowModeEnabled); };
        if (isRainbowModeEnabled) { document.body.classList.add('rainbow-mode'); }

        const profileManagerHTML = `<div id="theme-profile-manager"><label for="theme-profile-select">My Custom Color Profiles</label><select id="theme-profile-select"></select><input type="text" id="theme-profile-name" placeholder="New Custom Profile Name..." /><div><button id="theme-profile-save" class="userscript-btn">Save Current</button><button id="theme-profile-load" class="userscript-btn">Load Selected</button><button id="theme-profile-delete" class="userscript-btn">Delete Selected</button></div><div><button id="theme-profile-import" class="userscript-btn" style="background: linear-gradient(145deg, #375f63, #1d333d) !important;">Import</button><button id="theme-profile-export" class="userscript-btn" style="background: linear-gradient(145deg, #573763, #2d1d3d) !important;">Export Current</button></div></div>`;
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
                if (!THEME_LABELS[key]) continue; // Hide properties without a label
                const row = document.createElement('div');
                row.className = 'theme-editor-row';
                const labelText = THEME_LABELS[key] || key;
                row.innerHTML = `<label>${labelText}</label>`;
                row.addEventListener('mouseenter', () => { if (!isHighlightingEnabled) return; const highlightValue = key === 'buttonHoverGlow' ? HIGHLIGHT_GLOW : HIGHLIGHT_COLOR; setCssVariable(key, highlightValue); });
                row.addEventListener('mouseleave', () => { if (isHighlightingEnabled) { setCssVariable(key, currentTheme[key]); } });
                const swatch = document.createElement('div');
                swatch.className = 'pickr-swatch';
                row.appendChild(swatch);
                colorPickersContainer.appendChild(row);
                const pickr = Pickr.create({
                    el: swatch, theme: 'nano', default: value,
                    components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, hsla: false, hsva: false, cmyk: false, input: true, clear: true, save: true } }
                });
                pickr.on('save', (color, instance) => {
                    const newColor = color ? color.toRGBA().toString() : 'transparent';
                    currentTheme[key] = newColor;
                    applyTheme(currentTheme);
                    // ADDED: Reprocess after action
                    processAllMessages();
                    instance.getRoot().preview.style.backgroundColor = newColor;
                    pickr.hide();
                }).on('clear', (instance) => {
                    currentTheme[key] = 'transparent';
                    applyTheme(currentTheme);
                    // ADDED: Reprocess after action
                    processAllMessages();
                    instance.getRoot().preview.style.backgroundColor = 'transparent';
                    pickr.hide();
                });
                pickrInstances.push(pickr);
                pickr.setColor(value);
            }
        };
        const updateProfileDropdown = () => { const savedThemes = GM_getValue('savedThemes', {}); profileSelect.innerHTML = ''; for (const name of Object.keys(savedThemes)) { profileSelect.add(new Option(name, name)); } };
        contentArea.querySelector('#theme-profile-save').onclick = () => {
            const name = profileNameInput.value.trim();
            if (!name) { alert('Please enter a name for the custom profile.'); return; }
            const savedThemes = GM_getValue('savedThemes', {});
            savedThemes[name] = { ...currentTheme };
            GM_setValue('savedThemes', savedThemes);
            updateProfileDropdown();
            profileSelect.value = name;
            profileNameInput.value = '';
        };
        contentArea.querySelector('#theme-profile-load').onclick = () => {
            const name = profileSelect.value;
            if (!name) { alert('No custom profile selected to load.'); return; }
            const savedThemes = GM_getValue('savedThemes', {});
            currentTheme = migrateTheme({ ...DEFAULT_THEME_CONFIG, ...savedThemes[name] });
            applyTheme(currentTheme);
            // ADDED: Reprocess after action
            processAllMessages();
            populateColorPickers(currentTheme);
            GM_setValue('lastLoadedTheme', currentTheme);
        };
        contentArea.querySelector('#theme-profile-delete').onclick = () => {
            const name = profileSelect.value;
            if (!name) { alert('No custom profile selected to delete.'); return; }
            if (confirm(`Are you sure you want to delete the custom profile "${name}"?`)) {
                const savedThemes = GM_getValue('savedThemes', {});
                delete savedThemes[name];
                GM_setValue('savedThemes', savedThemes);
                updateProfileDropdown();
            }
        };
        contentArea.querySelector('#theme-profile-export').onclick = () => { try { const jsonString = JSON.stringify(currentTheme); prompt("Copy your current color theme code:", jsonString); } catch (e) { alert("Could not export theme. Error: " + e.message); } };
        contentArea.querySelector('#theme-profile-import').onclick = () => {
            const importString = prompt("Paste your theme code here:");
            if (!importString) return;
            try {
                const importedTheme = JSON.parse(importString);
                if (typeof importedTheme !== 'object' || importedTheme === null) { throw new Error("Imported data is not a valid object."); }
                const migratedImport = migrateTheme(importedTheme);
                for (const key of Object.keys(DEFAULT_THEME_CONFIG)) { if (!migratedImport.hasOwnProperty(key)) { throw new Error(`Imported theme is missing required key: "${key}"`); } }
                currentTheme = { ...DEFAULT_THEME_CONFIG, ...migratedImport };
                applyTheme(currentTheme);
                // ADDED: Reprocess after action
                processAllMessages();
                populateColorPickers(currentTheme);
                GM_setValue('lastLoadedTheme', currentTheme);
                alert("Theme imported successfully!");
            } catch (e) { alert("Import failed. The theme code is invalid or corrupted.\n\nError: " + e.message); }
        };
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset to Default Colors';
        resetButton.className = 'userscript-btn';
        resetButton.style.cssText = 'width: 100%; margin-top: 12px; filter: grayscale(30%);';
        resetButton.onclick = () => {
            if (confirm('Are you sure you want to reset the current colors to default?')) {
                currentTheme = { ...DEFAULT_THEME_CONFIG };
                applyTheme(currentTheme);
                // ADDED: Reprocess after action
                processAllMessages();
                populateColorPickers(currentTheme);
                GM_setValue('lastLoadedTheme', currentTheme);
            }
        };
        contentArea.appendChild(resetButton);
        populateColorPickers(currentTheme);
        updateProfileDropdown();
        minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('theme-editor-panelMinimized', true); pickrInstances.forEach(p => p.hide()); syncToolbar(); });
        if (GM_getValue('theme-editor-panelMinimized', false)) panel.classList.add('minimized');
    }

    // =========================================================================
    // ===                    ADVANCED CHAT HELPERS                          ===
    // =========================================================================

    function getChatMessageDataFromNode(msgNode) {
        try {
            const reactKey = Object.keys(msgNode).find(k => k.startsWith('__reactFiber$'));
            if (!reactKey) return null;

            let fiber = msgNode[reactKey];
            let depth = 0;
            const maxDepth = 20; // Safety break

            while (fiber && depth < maxDepth) {
                const props = fiber.memoizedProps || fiber.props;
                const msg = props?.message || props?.msg || props?.chatMessage;

                if (msg && typeof msg === 'object' && msg.user && msg.user._id && msg._id) {
                    return msg; // Return the complete message object
                }
                fiber = fiber.return;
                depth++;
            }
        } catch (e) {
            // This can happen on occasion, so we'll log it quietly.
        }
        return null;
    }

    function initMasterModal() {
    let modal = document.getElementById('master-chat-modal');
    if (modal) return;
    modal = document.createElement('div');
    modal.id = 'master-chat-modal';
    modal.innerHTML = `<div id="master-chat-modal-content"><div id="master-chat-modal-header"></div><div id="master-chat-modal-body"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target.id === 'master-chat-modal') { closeMasterModal(); } });
    modal.addEventListener('click', (e) => {
        const userId = modal.dataset.userId;
        const username = modal.dataset.username;
        if (!userId) return;

        switch (e.target.id) {
            case 'modal-mute-btn':
                if (confirm(`Are you sure you want to mute ${username}?`)) {
                    let mutedUsers = GM_getValue('mutedUsers', {});
                    mutedUsers[userId] = { lastSeenName: username };
                    GM_setValue('mutedUsers', mutedUsers); renderMutedUsersList(); processAllMessages();
                }
                closeMasterModal();
                break;
            case 'modal-tag-btn':
                openMasterModal(userId, username, 'tagging');
                break;
            case 'modal-color-btn':
                openMasterModal(userId, username, 'nameColoring');
                break;
            case 'modal-cancel-btn':
                closeMasterModal();
                break;
            case 'modal-save-tag-btn': {
                const userTags = GM_getValue('userTags', {});
                userTags[userId] = userTags[userId] || { lastSeenName: username };
                // Save custom tag
                const tagInput = modal.querySelector('#tag-editor-input');
                const newTagText = tagInput.value.trim();
                if (newTagText) {
                    userTags[userId].tag = newTagText;
                    userTags[userId].color = modal.pickrInstance.getColor().toHEXA().toString();
                }
                // Save in-game tag color override
                const newIngameTagColor = modal.pickrInstanceTag.getColor();
                if (newIngameTagColor) {
                    userTags[userId].tagColor = newIngameTagColor.toRGBA().toString();
                } else {
                    // CORRECTED: If color is cleared, delete the key.
                    delete userTags[userId].tagColor;
                }
                GM_setValue('userTags', userTags);
                renderTaggedUsersList(); processAllMessages(); closeMasterModal();
                break;
            }
            case 'modal-remove-tag-btn': {
                let userTags = GM_getValue('userTags', {});
                if (userTags[userId]) { delete userTags[userId].tag; delete userTags[userId].color; }
                GM_setValue('userTags', userTags);
                renderTaggedUsersList(); processAllMessages(); closeMasterModal();
                break;
            }
            case 'modal-remove-ingame-tag-color-btn': {
                let userTags = GM_getValue('userTags', {});
                if (userTags[userId]) { delete userTags[userId].tagColor; }
                GM_setValue('userTags', userTags);
                processAllMessages(); closeMasterModal();
                break;
            }
            case 'modal-save-color-btn': {
                const userTags = GM_getValue('userTags', {});
                userTags[userId] = userTags[userId] || { lastSeenName: username };
                userTags[userId].nameColor = modal.pickrInstance.getColor().toRGBA().toString();
                GM_setValue('userTags', userTags);
                processAllMessages(); closeMasterModal();
                break;
            }
            case 'modal-remove-color-btn': {
                let userTags = GM_getValue('userTags', {});
                if (userTags[userId]) { delete userTags[userId].nameColor; }
                GM_setValue('userTags', userTags);
                processAllMessages(); closeMasterModal();
                break;
            }
            case 'modal-back-btn':
                openMasterModal(userId, username, 'actions');
                break;
        }
    });
}

    function openMasterModal(userId, username, contentType) {
    const modal = document.getElementById('master-chat-modal');
    const header = modal.querySelector('#master-chat-modal-header');
    const body = modal.querySelector('#master-chat-modal-body');

    if (modal.pickrInstance) modal.pickrInstance.destroyAndRemove();
    if (modal.pickrInstanceTag) modal.pickrInstanceTag.destroyAndRemove();
    modal.pickrInstance = null;
    modal.pickrInstanceTag = null;

    modal.dataset.userId = userId;
    modal.dataset.username = username;

    let headerHTML = `Actions for <span class="username">${username}</span>`;
    let bodyHTML = '';
    const userTags = GM_getValue('userTags', {});
    const currentUserData = userTags[userId] || {};

    if (contentType === 'actions') {
        bodyHTML = `<button id="modal-mute-btn" class="userscript-btn">Mute User</button>
                    <button id="modal-tag-btn" class="userscript-btn">Tag / Edit Tag</button>
                    <button id="modal-color-btn" class="userscript-btn">Set Name Color</button>
                    <button id="modal-cancel-btn" class="userscript-btn" style="filter: grayscale(40%);">Cancel</button>`;
    } else if (contentType === 'tagging') {
        const currentTag = currentUserData.tag || '';
        headerHTML = `Edit Tag for <span class="username">${username}</span>`;
        bodyHTML = `<input type="text" id="tag-editor-input" placeholder="Enter custom tag text..." value="${currentTag}" style="width: 100%; margin-bottom: 15px; padding: 8px;">
                    <label style="display: block; text-align: left; margin-bottom: 5px; font-size: 0.9em;">Custom Tag Color:</label>
                    <div id="tag-color-picker" style="margin-bottom: 20px;"></div>

                    <hr style="border-color: #444; margin: 20px 0;">

                    <label style="display: block; text-align: left; margin-bottom: 5px; font-size: 0.9em;">In-Game Tag Color Override:</label>
                    <div id="ingame-tag-color-picker" style="margin-bottom: 20px;"></div>

                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button id="modal-save-tag-btn" class="userscript-btn" style="flex-grow: 2;">Save All</button>
                        <button id="modal-remove-tag-btn" class="userscript-btn" style="background: linear-gradient(145deg, #633737, #3d1d1d) !important; flex-grow: 1;">Remove Custom Tag</button>
                        <button id="modal-remove-ingame-tag-color-btn" class="userscript-btn" style="background: linear-gradient(145deg, #633737, #3d1d1d) !important; flex-grow: 1;">Remove Color Override</button>
                    </div>
                    <button id="modal-back-btn" class="userscript-btn" style="filter: grayscale(40%); width: 100%; margin-top: 8px;">Back</button>`;
    } else if (contentType === 'nameColoring') {
        headerHTML = `Set Name Color for <span class="username">${username}</span>`;
        bodyHTML = `<label style="display: block; text-align: left; margin-bottom: 5px; font-size: 0.9em;">Username Color:</label>
                    <div id="name-color-picker" style="margin-bottom: 20px;"></div>
                    <button id="modal-save-color-btn" class="userscript-btn">Save Color</button>
                    <button id="modal-remove-color-btn" class="userscript-btn" style="background: linear-gradient(145deg, #633737, #3d1d1d) !important;">Remove Custom Color</button>
                    <button id="modal-back-btn" class="userscript-btn" style="filter: grayscale(40%);">Back</button>`;
    }

    header.innerHTML = headerHTML;
    body.innerHTML = bodyHTML;

    if (contentType === 'tagging') {
        const customTagColor = currentUserData.color || currentTheme.accentColor;
        const picker1El = modal.querySelector('#tag-color-picker');
        modal.pickrInstance = Pickr.create({ el: picker1El, theme: 'nano', default: customTagColor, components: { preview: true, hue: true, interaction: { hex: true, input: true, save: true } } });

        const ingameTagColor = currentUserData.tagColor || '#ffffff'; // Default to white picker
        const picker2El = modal.querySelector('#ingame-tag-color-picker');
        modal.pickrInstanceTag = Pickr.create({ el: picker2El, theme: 'nano', default: ingameTagColor, components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, input: true, save: true, clear: true } } });

    } else if (contentType === 'nameColoring') {
        const currentNameColor = currentUserData.nameColor || currentTheme.usernameColor;
        const colorPickerEl = modal.querySelector('#name-color-picker');
        modal.pickrInstance = Pickr.create({ el: colorPickerEl, theme: 'nano', default: currentNameColor, components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, input: true, save: true } } });
    }

    modal.style.display = 'flex';
}

    function closeMasterModal() { const modal = document.getElementById('master-chat-modal'); if (modal) { if (modal.pickrInstance) { modal.pickrInstance.destroyAndRemove(); modal.pickrInstance = null; } modal.style.display = 'none'; } }
    function processAllMessages() { document.querySelectorAll('div.mantine-ScrollArea-viewport > div > div > div[class*="mantine-Group-root"]').forEach(processMessageNode); }
    function renderKeywordList() {
        const keywordList = document.getElementById('keyword-list'); if (!keywordList) return;
        const highlightKeywords = GM_getValue('highlightKeywords', []);
        keywordList.innerHTML = '';
        if (highlightKeywords.length === 0) { keywordList.innerHTML = '<li>No keywords added.</li>'; return; }
        highlightKeywords.forEach(kw => { const li = document.createElement('li'); li.innerHTML = `<span>${kw}</span><span class="remove-item-btn" data-keyword="${kw}" title="Remove">✖</span>`; keywordList.appendChild(li); });
    }
    function renderMutedUsersList() {
        const mutedUsersList = document.getElementById('muted-users-list'); if (!mutedUsersList) return;
        const mutedUsers = GM_getValue('mutedUsers', {});
        mutedUsersList.innerHTML = '';
        const userEntries = Object.entries(mutedUsers);
        if (userEntries.length === 0) { mutedUsersList.innerHTML = '<li>No users muted.</li>'; return; }
        userEntries.forEach(([userId, data]) => { const li = document.createElement('li'); li.innerHTML = `<span>${data.lastSeenName}</span><span class="remove-item-btn" data-userid="${userId}" title="Unmute">✖</span>`; mutedUsersList.appendChild(li); });
    }
    function renderTaggedUsersList() {
        const taggedUsersList = document.getElementById('tagged-users-list'); if (!taggedUsersList) return;
        const userTags = GM_getValue('userTags', {});
        taggedUsersList.innerHTML = '';
        const userEntries = Object.entries(userTags);
        if (userEntries.length === 0) { taggedUsersList.innerHTML = '<li>No users tagged. Click a user in chat to add one.</li>'; return; }
        userEntries.forEach(([userId, data]) => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.title = 'Click to edit';
            li.dataset.userId = userId;
            li.dataset.username = data.lastSeenName;
            li.innerHTML = `<span style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${data.color}; border: 1px solid #fff3;"></span><span>${data.lastSeenName}</span><span class="tag-text">${data.tag}</span></span><span class="remove-item-btn" data-userid="${userId}" title="Remove Tag">✖</span>`;
            taggedUsersList.appendChild(li);
        });
    }

const processMessageNode = (msgNode) => {
    const msgData = getChatMessageDataFromNode(msgNode);
    if (!msgData || !msgData.user) return;

    const userId = msgData.user._id;
    const username = msgData.user.name;
    const msgText = msgData.message.toLowerCase();

    const mutedUsers = GM_getValue('mutedUsers', {});
    const highlightKeywords = GM_getValue('highlightKeywords', []);
    const userTags = GM_getValue('userTags', {});

    // Mute Check
    if (mutedUsers[userId]) { msgNode.style.display = 'none'; return; }

    // Keyword Highlighting
    const isHighlighted = highlightKeywords.some(kw => kw && msgText.includes(kw.toLowerCase()));
    msgNode.classList.toggle('chat-keyword-highlight', isHighlighted);

    // Find key elements
    const authorContainer = msgData.isAdmin || msgData.isMod ? msgNode.querySelector('div[class*="Group-root"] > div[class*="Group-root"]') : msgNode.querySelector('div[class*="mantine-Paper-root"] div[class*="mantine-Group-root"] > div[class*="mantine-Group-root"]');
    const usernameNode = authorContainer?.querySelector('p[data-truncate="end"]');
    if (!usernameNode) return;

    // Make username clickable
    if (!usernameNode.classList.contains('username-clickable')) {
        usernameNode.classList.add('username-clickable');
        usernameNode.style.cssText = 'cursor: pointer; transition: filter 0.2s;';
        usernameNode.onmouseenter = () => { usernameNode.style.filter = 'brightness(1.2)'; };
        usernameNode.onmouseleave = () => { usernameNode.style.filter = 'none'; };
        usernameNode.onclick = (e) => { e.stopPropagation(); openMasterModal(userId, username, 'actions'); };
    }

    const userData = userTags[userId];

    // Apply custom username color
    usernameNode.style.color = (userData && userData.nameColor) ? userData.nameColor : currentTheme.usernameColor;

    // Apply custom user tag
    const existingTagEl = authorContainer.querySelector('.user-tag');
    if (existingTagEl) existingTagEl.remove();
    if (userData && userData.tag) {
        if (userData.lastSeenName !== username) { userTags[userId].lastSeenName = username; GM_setValue('userTags', userTags); renderTaggedUsersList(); }
        const tagElement = document.createElement('span');
        tagElement.className = 'user-tag';
        tagElement.textContent = userData.tag;
        tagElement.style.backgroundColor = userData.color || currentTheme.accentColor;
        tagElement.style.color = getContrastingTextColor(tagElement.style.backgroundColor);
        usernameNode.insertAdjacentElement('afterend', tagElement);
    }

    // --- FINAL & EXPLICIT LOGIC for In-Game Tag Color ---
    const allTextElements = authorContainer.querySelectorAll('p.mantine-Text-root');
    allTextElements.forEach(p_element => {
        const text = p_element.textContent;
        const isTag = text.includes('[Pro]') || text.includes('[Admin]') || text.includes('[Mod]');

        if (isTag) {
            const tagElement = p_element;
            let finalColorToApply = null;

            // Priority 1: Check for a per-user override.
            if (userData && userData.tagColor) {
                finalColorToApply = userData.tagColor;
            }
            // Priority 2: No override, so determine and apply the correct global theme color.
            else {
                if (text.includes('[Pro]')) {
                    finalColorToApply = currentTheme.proTagColor;
                } else if (text.includes('[Admin]')) {
                    finalColorToApply = currentTheme.adminTagColor;
                } else if (text.includes('[Mod]')) {
                    finalColorToApply = currentTheme.modTagColor;
                }
            }

            // Apply the determined color directly. This avoids all fallback/specificity issues.
            if (finalColorToApply) {
                tagElement.style.setProperty('color', finalColorToApply, 'important');
            }
        }
    });
};

    // =========================================================================
    // ===                      ADVANCED CHAT MODULE                         ===
    // =========================================================================
    function startAdvancedChatModule(chatContainer) {
        const userTags = GM_getValue('userTags', {});
        let needsUpdate = false;
        for (const username in userTags) {
            if (typeof userTags[username] === 'string') { needsUpdate = true; userTags[username] = { tag: userTags[username], color: currentTheme.accentColor }; }
        }
        if (needsUpdate) { GM_setValue('userTags', userTags); console.log('[MASTER SCRIPT] Migrated userTags to new format.'); }
        console.log('[MASTER SCRIPT] Chat container found. Initializing Advanced Chat panel...');
        const initialHTML = `<div class="chat-settings-section"><h5>Keyword Highlighting</h5><div class="setting-row"><input type="text" id="keyword-input" placeholder="Add a keyword..." style="width: 70%;" /><button id="add-keyword-btn" class="userscript-btn" style="width: 28%;">Add</button></div><ul id="keyword-list" class="chat-settings-list"></ul></div><div class="chat-settings-section"><h5>Muted Users</h5><ul id="muted-users-list" class="chat-settings-list"></ul></div><div class="chat-settings-section"><h5>Tagged Users</h5><ul id="tagged-users-list" class="chat-settings-list"></ul></div>`;
        const { container: panel, minimizeButton, contentArea } = createDraggablePanel('advanced-chat-panel', 'Advanced Chat', initialHTML, { top: '350px', left: '20px' });
        const keywordInput = contentArea.querySelector('#keyword-input');
        const addKeywordBtn = contentArea.querySelector('#add-keyword-btn');
        const keywordList = contentArea.querySelector('#keyword-list');
        const mutedUsersList = contentArea.querySelector('#muted-users-list');
        const taggedUsersList = contentArea.querySelector('#tagged-users-list');
        addKeywordBtn.addEventListener('click', () => {
            const newKeyword = keywordInput.value.trim();
            const highlightKeywords = GM_getValue('highlightKeywords', []);
            if (newKeyword && !highlightKeywords.find(kw => kw.toLowerCase() === newKeyword.toLowerCase())) { highlightKeywords.push(newKeyword); GM_setValue('highlightKeywords', highlightKeywords); renderKeywordList(); processAllMessages(); keywordInput.value = ''; }
        });
        keywordList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const kwToRemove = e.target.dataset.keyword;
                let highlightKeywords = GM_getValue('highlightKeywords', []);
                highlightKeywords = highlightKeywords.filter(kw => kw !== kwToRemove);
                GM_setValue('highlightKeywords', highlightKeywords); renderKeywordList(); processAllMessages();
            }
        });
        mutedUsersList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const userToUnmute = e.target.dataset.username;
                let mutedUsers = GM_getValue('mutedUsers', {});
                delete mutedUsers[userToUnmute];
                GM_setValue('mutedUsers', mutedUsers); renderMutedUsersList(); processAllMessages();
            }
        });
        taggedUsersList.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.remove-item-btn');
            if (removeButton) { e.stopPropagation(); const userToUntag = removeButton.dataset.username; let userTags = GM_getValue('userTags', {}); delete userTags[userToUntag]; GM_setValue('userTags', userTags); renderTaggedUsersList(); processAllMessages(); return; }
            const listItem = e.target.closest('li[data-username]');
            if (listItem) { const userToEdit = listItem.dataset.username; openMasterModal(userToEdit, 'tagging'); }
        });
        renderKeywordList();
        renderMutedUsersList();
        renderTaggedUsersList();
        minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('advanced-chat-panelMinimized', true); syncToolbar(); });
        if (GM_getValue('advanced-chat-panelMinimized', false)) panel.classList.add('minimized');
        initMasterModal();
    }
    function initAdvancedChatModuleWaiter() {
        console.log('[MASTER SCRIPT] Initializing Robust Advanced Chat Manager.');
        let uiInitialized = false;
        let workerObserver = null;
        const sentinelObserver = new MutationObserver(() => {
            const chatContainer = document.querySelector('aside[class*="mantine-AppShell-aside"]');
            if (!chatContainer) { if (workerObserver) { workerObserver.disconnect(); workerObserver = null; } return; }
            if (!uiInitialized) { uiInitialized = true; startAdvancedChatModule(chatContainer); }
            const chatViewport = chatContainer.querySelector('.mantine-ScrollArea-viewport > div > div');
            if (chatViewport && (!workerObserver || !document.body.contains(workerObserver.target))) {
                if (workerObserver) workerObserver.disconnect();
                console.log('[MASTER SCRIPT] Chat viewport (re)detected. Applying all rules and observing for new messages.');
                processAllMessages();
                workerObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) { for (const node of mutation.addedNodes) { if (node.nodeType === 1) { const messageNodes = node.matches('div[class*="mantine-Group-root"][style*="--group-align: flex-start"]') ? [node] : node.querySelectorAll('div[class*="mantine-Group-root"][style*="--group-align: flex-start"]'); messageNodes.forEach(processMessageNode); } } }
                });
                workerObserver.observe(chatViewport, { childList: true });
                workerObserver.target = chatViewport;
            }
        });
        sentinelObserver.observe(document.body, { childList: true, subtree: true });
    }

// =========================================================================
// ===                        NAV BAR EDITOR MODULE                      ===
// =========================================================================
function initNavEditorModule() {
    const { container: panel, minimizeButton, contentArea } = createDraggablePanel('nav-editor-panel', 'Nav Bar Editor', '', { top: '350px', left: '300px' });
    let lastProcessedNavBar = null; // Keep track of the nav element we've already processed

    function applyNavVisibility() {
        const navBar = document.querySelector('nav.mantine-AppShell-navbar');
        if (!navBar) return;

        let savedToggles = GM_getValue('navToggles', {});
        const links = navBar.querySelectorAll('a.mantine-NavLink-root');

        links.forEach(link => {
            const labelNode = link.querySelector('.mantine-NavLink-label');
            const labelText = labelNode?.textContent.trim();
            if (!labelText) return;

            // Find the correct parent element to hide (sometimes it's wrapped in another div)
            const itemToToggle = link.closest('div.mantine-Indicator-root') || link;
            if (savedToggles[labelText] === false) {
                itemToToggle.style.display = 'none';
            } else {
                itemToToggle.style.display = ''; // Use empty string to revert to default stylesheet behavior
            }
        });
    }

    function renderNavToggles() {
        const navBar = document.querySelector('nav.mantine-AppShell-navbar');
        if (!navBar) {
            contentArea.innerHTML = `<div style="text-align:center; padding: 10px; opacity: 0.7;">Nav bar not found. Waiting...</div>`;
            return;
        }

        contentArea.innerHTML = ''; // Clear previous content
        const togglesContainer = document.createElement('div');
        togglesContainer.className = 'chat-settings-section';
        togglesContainer.innerHTML = '<h5>Toggle Navigation Items</h5>';
        contentArea.appendChild(togglesContainer);

        const navLinks = navBar.querySelectorAll('a.mantine-NavLink-root');
        if (navLinks.length === 0) {
             togglesContainer.innerHTML += `<div style="text-align:center; padding: 10px; opacity: 0.7;">No navigation links found.</div>`;
             return;
        }

        navLinks.forEach(link => {
            const labelNode = link.querySelector('.mantine-NavLink-label');
            const labelText = labelNode?.textContent.trim();
            if (!labelText) return;

            let savedToggles = GM_getValue('navToggles', {});
            const isEnabled = savedToggles[labelText] !== false;

            const toggleRow = document.createElement('div');
            toggleRow.className = 'toggle-row';
            toggleRow.innerHTML = `<span>${labelText}</span><label class="switch"><input type="checkbox" data-nav-label="${labelText}"><span class="slider"></span></label>`;
            const checkbox = toggleRow.querySelector('input');
            checkbox.checked = isEnabled;

            checkbox.addEventListener('change', () => {
                let currentToggles = GM_getValue('navToggles', {});
                currentToggles[labelText] = checkbox.checked;
                GM_setValue('navToggles', currentToggles);
                applyNavVisibility(); // Immediately apply the change
            });
            togglesContainer.appendChild(toggleRow);
        });
    }

    minimizeButton.addEventListener('click', () => { panel.classList.add('minimized'); GM_setValue('nav-editor-panelMinimized', true); syncToolbar(); });
    if (GM_getValue('nav-editor-panelMinimized', false)) panel.classList.add('minimized');

    // --- THE FIX: Use a MutationObserver to detect when the nav bar is added or changed ---
    const navObserver = new MutationObserver(() => {
        const navBar = document.querySelector('nav.mantine-AppShell-navbar');

        // If a nav bar exists and it's a *new* one we haven't processed yet
        if (navBar && navBar !== lastProcessedNavBar) {
            console.log('[MASTER SCRIPT] New or changed Nav bar detected. Applying visibility and rendering toggles.');
            lastProcessedNavBar = navBar; // Mark this nav bar as processed
            applyNavVisibility();
            renderNavToggles();
        }
        // If the nav bar has been removed, reset our tracker so we can find the next one
        else if (!navBar && lastProcessedNavBar) {
            console.log('[MASTER SCRIPT] Nav bar removed.');
            lastProcessedNavBar = null;
            renderNavToggles(); // Update panel to show "Nav bar not found"
        }
    });

    // Start observing the entire document for additions or removals of elements
    navObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial check in case the nav bar is already present
    applyNavVisibility();
    renderNavToggles();
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

        // Modules are initialized here
        initWallpaperModule();
        initCbTeamsModule();
        initThemeEditorModule();
        initAdvancedChatModuleWaiter();
        initNavEditorModule(); // The logic is now self-contained within this function

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
            if (confirm('Are you sure you want to reset all panel positions and sizes to default?')) {
                PANEL_IDS.forEach(id => {
                    GM_deleteValue(`${id}Position`);
                    GM_deleteValue(`${id}Dimensions`);
                });
                location.reload();
            }
        }
    });

})();