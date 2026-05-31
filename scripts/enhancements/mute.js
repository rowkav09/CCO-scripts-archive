// ==UserScript==
// @name         mute
// @version      1.0
// @author       Zhiro
// @description  /mute /unmute - mute people locally in chat. my discord: zhiro999.
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'local_muted';
    const INPUT_SEL = 'input.mantine-TextInput-input[placeholder="Send a message"]';
    const MSG_SEL = 'div.mantine-ScrollArea-viewport > div > div > div[class*="mantine-Group-root"]';

    let muted = {};
    let dropdown = null;
    let selectedIndex = -1;
    let currentSuggestions = [];

    function load() {
        try { muted = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { muted = {}; }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(muted));
    }

    function getMsgData(node) {
        try {
            const key = Object.keys(node).find(function(k) { return k.startsWith('__reactFiber$'); });
            if (!key) return null;
            let fiber = node[key];
            let depth = 0;
            while (fiber && depth < 20) {
                const props = fiber.memoizedProps || fiber.props;
                const msg = props && (props.message || props.msg || props.chatMessage);
                if (msg && typeof msg === 'object' && msg.user && msg.user._id && msg._id) return msg;
                fiber = fiber.return;
                depth++;
            }
        } catch {}
        return null;
    }

    function processNode(node) {
        const data = getMsgData(node);
        if (!data || !data.user) return;
        if (muted[data.user._id]) node.style.display = 'none';
    }

    function processAll() {
        document.querySelectorAll(MSG_SEL).forEach(processNode);
    }

    function muteUser(userId, name) {
        muted[userId] = name;
        save();
        processAll();
    }

    function unmuteUser(userId) {
        delete muted[userId];
        save();
        document.querySelectorAll(MSG_SEL).forEach(function(node) {
            const data = getMsgData(node);
            if (data && data.user && data.user._id === userId) node.style.display = '';
        });
    }

    function getMutedList() {
        return Object.entries(muted);
    }

    function getChatUsers() {
        const users = {};
        document.querySelectorAll(MSG_SEL).forEach(function(node) {
            const data = getMsgData(node);
            if (data && data.user && data.user._id && data.user.name) {
                users[data.user._id] = data.user.name;
            }
        });
        return Object.entries(users).map(function(e) { return { id: e[0], name: e[1] }; });
    }

    function findByName(name) {
        const all = getChatUsers();
        return all.find(function(u) { return u.name.toLowerCase() === name.toLowerCase(); }) || null;
    }

    function searchByPrefix(prefix) {
        const all = getChatUsers();
        return all.filter(function(u) {
            return u.name.toLowerCase().startsWith(prefix.toLowerCase()) && !muted[u.id];
        });
    }

    function searchMutedByPrefix(prefix) {
        return getMutedList().filter(function(e) {
            return e[1].toLowerCase().startsWith(prefix.toLowerCase());
        });
    }


    function removeDropdown() {
        if (dropdown) { dropdown.remove(); dropdown = null; }
        currentSuggestions = [];
        selectedIndex = -1;
    }

    function showDropdown(input, items, onPick) {
        removeDropdown();
        if (!items.length) return;

        currentSuggestions = items;
        selectedIndex = -1;

        const rect = input.getBoundingClientRect();

        dropdown = document.createElement('div');
        dropdown.style.cssText = [
            'position:fixed',
            'left:' + rect.left + 'px',
            'bottom:' + (window.innerHeight - rect.top + 4) + 'px',
            'min-width:' + rect.width + 'px',
            'background:#18181b',
            'border:1px solid #3f3f46',
            'border-radius:6px',
            'z-index:999999',
            'font-family:monospace',
            'font-size:12px',
            'overflow:hidden',
            'box-shadow:0 4px 16px rgba(0,0,0,0.5)'
        ].join(';');

        items.forEach(function(item, i) {
            const row = document.createElement('div');
            row.style.cssText = 'padding:6px 10px;cursor:pointer;color:#e4e4e7;';
            row.textContent = item.label;
            row.dataset.idx = i;

            row.onmouseenter = function() { setSelected(i); };
            row.onmousedown = function(e) {
                e.preventDefault();
                onPick(item);
            };

            dropdown.appendChild(row);
        });

        document.body.appendChild(dropdown);
    }

    function setSelected(idx) {
        if (!dropdown) return;
        const rows = dropdown.querySelectorAll('div');
        rows.forEach(function(r, i) {
            r.style.background = i === idx ? '#27272a' : '';
            r.style.color = i === idx ? '#fff' : '#e4e4e7';
        });
        selectedIndex = idx;
    }

    function updateDropdownFromInput(input) {
        const val = input.value;

        const muteM = val.match(/^\/mute\s+(.+)$/i);
        if (muteM) {
            const prefix = muteM[1];
            const matches = searchByPrefix(prefix);

            if (matches.length === 1 && matches[0].name.toLowerCase() === prefix.toLowerCase()) {
                showDropdown(input, [{ label: matches[0].name + ' will get muted', name: matches[0].name, id: matches[0].id }], function(item) {
                    doMute(input, item.id, item.name);
                });
            } else if (matches.length) {
                showDropdown(input, matches.map(function(u) {
                    return { label: u.name, name: u.name, id: u.id };
                }), function(item) {
                    setInputVal(input, '/mute ' + item.name);
                });
            } else {
                removeDropdown();
            }
            return;
        }

        const unmuteM = val.match(/^\/unmute\s+(.+)$/i);
        if (unmuteM) {
            const prefix = unmuteM[1];
            const matches = searchMutedByPrefix(prefix);

            if (matches.length) {
                showDropdown(input, matches.map(function(e) {
                    return { label: e[1] + ' - click to unmute', name: e[1], id: e[0] };
                }), function(item) {
                    doUnmute(input, item.id, item.name);
                });
            } else {
                removeDropdown();
            }
            return;
        }

        if (/^\/unmute\s*$/i.test(val)) {
            const list = getMutedList();
            if (list.length) {
                showDropdown(input, list.map(function(e) {
                    return { label: e[1] + ' - click to unmute', name: e[1], id: e[0] };
                }), function(item) {
                    doUnmute(input, item.id, item.name);
                });
            }
            return;
        }

        removeDropdown();
    }

    function showNotice(input, msg) {
        const notice = document.createElement('div');
        notice.style.cssText = 'padding:4px 8px;font-size:12px;font-family:monospace;color:#a1a1aa;';
        notice.textContent = msg;
        const wrap = input.closest('form') || input.parentElement;
        if (wrap && wrap.parentElement) {
            wrap.parentElement.insertBefore(notice, wrap);
            setTimeout(function() { notice.remove(); }, 3500);
        }
    }

    function clearInput(input) {
        try {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch {}
    }

    function setInputVal(input, val) {
        try {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
        } catch {}
    }

    function doMute(input, userId, name) {
        removeDropdown();
        muteUser(userId, name);
        showNotice(input, 'muted ' + name);
        clearInput(input);
    }

    function doUnmute(input, userId, name) {
        removeDropdown();
        unmuteUser(userId);
        showNotice(input, 'unmuted ' + name);
        clearInput(input);
    }

    function handleCommand(input, text) {
        const t = text.trim();

        if (t === '/unmute') {
            const list = getMutedList();
            if (!list.length) { showNotice(input, 'nobody is muted'); }
            return true;
        }

        const muteM = t.match(/^\/mute\s+(.+)$/i);
        if (muteM) {
            const name = muteM[1].trim();
            const found = findByName(name);
            if (!found) { showNotice(input, 'cant find ' + name + ' in chat'); }
            else { doMute(input, found.id, found.name); }
            return true;
        }

        const unmuteM = t.match(/^\/unmute\s+(.+)$/i);
        if (unmuteM) {
            const name = unmuteM[1].trim();
            const entry = getMutedList().find(function(e) {
                return e[1].toLowerCase() === name.toLowerCase();
            });
            if (!entry) { showNotice(input, name + ' is not muted'); }
            else { doUnmute(input, entry[0], entry[1]); }
            return true;
        }

        return false;
    }

    function attachInput(input) {
        if (input.dataset.localMute) return;
        input.dataset.localMute = '1';

        input.addEventListener('input', function() {
            updateDropdownFromInput(input);
        });

        input.addEventListener('keydown', function(e) {
            if (dropdown && currentSuggestions.length) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelected(Math.min(selectedIndex + 1, currentSuggestions.length - 1));
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelected(Math.max(selectedIndex - 1, 0));
                    return;
                }
                if (e.key === 'Tab' || (e.key === 'Enter' && selectedIndex >= 0)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const item = currentSuggestions[selectedIndex >= 0 ? selectedIndex : 0];
                    if (item) {
                        const isMuteCmd = input.value.match(/^\/mute\s/i);
                        const isUnmuteCmd = input.value.match(/^\/unmute\s/i);
                        if (isMuteCmd) {
                            if (item.label.includes('will get muted')) doMute(input, item.id, item.name);
                            else setInputVal(input, '/mute ' + item.name);
                        } else if (isUnmuteCmd) {
                            doUnmute(input, item.id, item.name);
                        }
                    }
                    return;
                }
                if (e.key === 'Escape') { removeDropdown(); return; }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
                if (handleCommand(input, input.value)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    removeDropdown();
                    clearInput(input);
                }
            }
        }, true);

        input.addEventListener('blur', function() {
            setTimeout(removeDropdown, 150);
        });
    }

    new MutationObserver(function(muts) {
        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches && node.matches('[class*="mantine-Group-root"]')) processNode(node);
                const inp = node.querySelector && node.querySelector(INPUT_SEL);
                if (inp) attachInput(inp);
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

    const inp = document.querySelector(INPUT_SEL);
    if (inp) attachInput(inp);

    load();
    processAll();
})();