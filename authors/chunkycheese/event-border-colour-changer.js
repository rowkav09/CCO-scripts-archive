// ==UserScript==
// @name         Event Border Color Manager
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Change electric border colors on event item cards using saved rules
// @author       chunkycheese
// @match        https://case-clicker.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const RULES_STORAGE_KEY = 'cc_event_border_rules_v1';
    const DEFAULT_COLOR = '#ffffff';
    const EVENT_GRADIENTS = [
        {
            name: 'Noir 2026',
            signature: normalizeGradientSignature('linear-gradient(to right, rgb(0, 0, 0), rgb(138, 134, 134))')
        },
        {
            name: 'Halloween 2025',
            signature: normalizeGradientSignature('linear-gradient(to right, rgb(243, 144, 79), rgb(59, 67, 113))')
        },
        {
            name: 'Valentines 2026',
            signature: normalizeGradientSignature('linear-gradient(to right, rgb(251, 194, 235), rgb(166, 193, 238))')
        },
        {
            name: 'Christmas 2025',
            signature: normalizeGradientSignature('linear-gradient(to right, rgb(221, 62, 84), rgb(107, 229, 133))')
        },
        {
            name: 'Wildfire 2025',
            signature: normalizeGradientSignature('linear-gradient(to right, rgb(235, 87, 87), rgb(0, 0, 0))')
        }
    ];

    let observer = null;
    let editingIndex = -1;
    let ruleSearch = '';
    let queuedRoots = new Set();
    let processQueueTimer = null;

    function collapseSpaces(text) {
        return String(text || '').replace(/\s{2,}/g, ' ').trim();
    }

    function normalizeText(text) {
        return collapseSpaces(text).toLowerCase();
    }

    function normalizeGradientSignature(value) {
        return collapseSpaces(value)
            .toLowerCase()
            .replace(/\s*,\s*/g, ', ')
            .replace(/\(\s*/g, '(')
            .replace(/\s*\)/g, ')');
    }

    function getEventNameFromGradientSignature(signature) {
        const normalizedSignature = normalizeGradientSignature(signature);
        if (!normalizedSignature) return 'Any Event';

        const event = EVENT_GRADIENTS.find(entry => entry.signature === normalizedSignature);
        return event?.name || 'Unknown Event';
    }

    function parseVisibleEventValue(value) {
        const text = collapseSpaces(value);
        const match = text.match(/^(.*?)\s+\[(.+)]$/);

        return {
            display: text,
            name: collapseSpaces(match ? match[1] : text),
            eventName: match ? collapseSpaces(match[2]) : ''
        };
    }

    function normalizeMatchMode(mode) {
        return mode === 'pattern' ? 'pattern' : 'exact';
    }

    function getMatchModeLabel(mode) {
        return normalizeMatchMode(mode) === 'pattern' ? 'Pattern' : 'Exact';
    }

    function getFinishPatterns(eventName) {
        const text = collapseSpaces(eventName);
        const regex = /(?:^|\s)([A-Za-z0-9][A-Za-z0-9 -]*?)\s+'([^']+)'/g;
        const patterns = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            const finishName = collapseSpaces(match[1]);
            const quotedPattern = collapseSpaces(match[2]);
            if (!finishName || !quotedPattern) continue;

            patterns.push(`${finishName} '${quotedPattern}'`);
        }

        return patterns;
    }

    function getBestPatternFromEventName(eventName) {
        return getFinishPatterns(eventName)[0] || '';
    }

    function isHexColor(value) {
        return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
    }

    function normalizeHexColor(value) {
        const trimmed = String(value || '').trim();
        return isHexColor(trimmed) ? trimmed.toLowerCase() : DEFAULT_COLOR;
    }

    function normalizeColorMode(mode) {
        return mode === 'gradient' ? 'gradient' : 'solid';
    }

    function getRuleTopLeftColor(rule) {
        return normalizeHexColor(rule?.topLeftColor || rule?.color);
    }

    function getRuleBottomRightColor(rule) {
        return normalizeHexColor(rule?.bottomRightColor || rule?.color);
    }

    function getRulePrimaryColor(rule) {
        return getRuleTopLeftColor(rule);
    }

    function getRuleColorSummary(rule) {
        const mode = normalizeColorMode(rule?.colorMode);
        const topLeftColor = getRuleTopLeftColor(rule);
        const bottomRightColor = getRuleBottomRightColor(rule);

        return mode === 'gradient' ? `${topLeftColor} to ${bottomRightColor}` : topLeftColor;
    }

    function getSwatchBackground(rule) {
        const mode = normalizeColorMode(rule?.colorMode);
        const topLeftColor = getRuleTopLeftColor(rule);
        const bottomRightColor = getRuleBottomRightColor(rule);

        return mode === 'gradient'
            ? `linear-gradient(135deg, ${topLeftColor}, ${bottomRightColor})`
            : topLeftColor;
    }

    function loadRules() {
        try {
            const raw = localStorage.getItem(RULES_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveRules(rules) {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function setStatus(message, isError = false) {
        const el = document.getElementById('eb-status');
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? '#ff7b7b' : '#9ad';
    }

    function setColorInputs(color, target = 'primary') {
        const normalizedColor = normalizeHexColor(color);
        const suffix = target === 'bottom-right' ? 'bottom-right' : 'top-left';
        const colorEl = document.getElementById(`eb-${suffix}-color`);
        const colorTextEl = document.getElementById(`eb-${suffix}-color-text`);

        if (colorEl) colorEl.value = normalizedColor;
        if (colorTextEl) colorTextEl.value = normalizedColor;

        if (target === 'primary') {
            updateColorModeUi();
        }
    }

    async function pickColorFromScreen(target = 'primary') {
        if (!window.EyeDropper) {
            setStatus('Screen color picker is not supported in this browser.', true);
            return;
        }

        try {
            setStatus('Pick a color from the screen.');
            const result = await new EyeDropper().open();
            setColorInputs(result.sRGBHex, target);
            setStatus(`Picked ${result.sRGBHex}.`);
        } catch {
            setStatus('Screen color pick cancelled.');
        }
    }

    function getElectricBorder(node) {
        if (!node || node.nodeType !== 1) return null;

        if (hasElectricBorderVars(node)) {
            return node;
        }

        return node.closest?.('[style*="--electric-border-color"]') ||
            node.closest?.('[class*="ElectricBorder_electric-border"]') ||
            null;
    }

    function getEventBorderTarget(node) {
        const electricBorder = getElectricBorder(node);
        if (electricBorder) return electricBorder;

        return node.closest?.('.mantine-Card-root, [class*="Card-root"]') || null;
    }

    function hasElectricBorderVars(el) {
        return !!el?.style?.getPropertyValue('--electric-border-color');
    }

    function isNormalCardBorderTarget(el) {
        return !!el?.matches?.('.mantine-Card-root[data-with-border="true"], [class*="Card-root"][data-with-border="true"]');
    }

    function isGradientEventText(el) {
        if (!el || el.tagName !== 'P') return false;

        const inlineBackground = el.style?.background || '';
        const computedBackground = getComputedStyle(el).backgroundImage || '';
        const fillColor = el.style?.webkitTextFillColor || getComputedStyle(el).webkitTextFillColor || '';

        return (
            el.matches('p[data-truncate="end"]') &&
            (
                inlineBackground.includes('linear-gradient') ||
                computedBackground.includes('linear-gradient') ||
                fillColor === 'transparent'
            )
        );
    }

    function getGradientSignatureFromTextEl(el) {
        if (!el) return '';

        const inlineBackground = el.style?.background || '';
        const computedBackground = getComputedStyle(el).backgroundImage || '';
        const background = inlineBackground.includes('linear-gradient')
            ? inlineBackground
            : computedBackground;

        const gradientMatch = background.match(/linear-gradient\((.+)\)/i);
        if (!gradientMatch) return '';

        return normalizeGradientSignature(`linear-gradient(${gradientMatch[1]})`);
    }

    function getEventNameFromBorder(borderEl) {
        return collapseSpaces(getEventTextPartsFromBorder(borderEl).join(' '));
    }

    function getEventGradientSignatureFromBorder(borderEl) {
        const card = borderEl.querySelector('.mantine-Card-root, [class*="Card-root"]') || borderEl;
        const gradientTextEl = Array.from(card.querySelectorAll('p[data-truncate="end"]'))
            .find(isGradientEventText);

        return getGradientSignatureFromTextEl(gradientTextEl);
    }

    function getEventTextPartsFromBorder(borderEl) {
        const card = borderEl.querySelector('.mantine-Card-root, [class*="Card-root"]') || borderEl;
        const gradientTextEls = Array.from(card.querySelectorAll('p[data-truncate="end"]'))
            .filter(isGradientEventText);

        return gradientTextEls
            .map(el => collapseSpaces(el.textContent))
            .filter(Boolean);
    }

    function getPatternCandidatesFromParts(parts) {
        const quotedPartsAfterItemName = parts
            .slice(1)
            .filter(part => part.includes("'"));

        const candidateParts = quotedPartsAfterItemName.length > 0
            ? quotedPartsAfterItemName
            : parts.filter(part => part.includes("'"));

        return candidateParts
            .map(part => getBestPatternFromEventName(part) || collapseSpaces(part))
            .filter(Boolean);
    }

    function getEventBorders(root = document) {
        const borders = new Set();

        if (root.nodeType === 1 && (hasElectricBorderVars(root) || isNormalCardBorderTarget(root))) {
            borders.add(root);
        }

        if (root.querySelectorAll) {
            root.querySelectorAll('[style*="--electric-border-color"], [class*="ElectricBorder_electric-border"], .mantine-Card-root[data-with-border="true"], [class*="Card-root"][data-with-border="true"]')
                .forEach(el => borders.add(el));

            root.querySelectorAll('p[data-truncate="end"]').forEach(textEl => {
                if (!isGradientEventText(textEl)) return;
                const border = getEventBorderTarget(textEl);
                if (border) borders.add(border);
            });
        }

        return [...borders];
    }

    function getRuleForEvent(borderEl) {
        const parts = getEventTextPartsFromBorder(borderEl);
        const eventName = collapseSpaces(parts.join(' '));
        const normalizedEventName = normalizeText(eventName);
        const gradientSignature = getEventGradientSignatureFromBorder(borderEl);
        if (!normalizedEventName) return null;

        function ruleMatchesGradient(rule, requireScoped = false) {
            const ruleGradient = normalizeGradientSignature(rule.gradientSignature);

            if (requireScoped) {
                return !!ruleGradient && ruleGradient === gradientSignature;
            }

            return !ruleGradient || ruleGradient === gradientSignature;
        }

        const rules = loadRules();
        const exactRule = rules.find(rule =>
            ruleMatchesGradient(rule, true) &&
            normalizeMatchMode(rule.matchMode) === 'exact' &&
            normalizeText(rule.matchText) === normalizedEventName
        ) || rules.find(rule =>
            ruleMatchesGradient(rule, false) &&
            normalizeMatchMode(rule.matchMode) === 'exact' &&
            normalizeText(rule.matchText) === normalizedEventName
        );

        if (exactRule) return exactRule;

        const patterns = getPatternCandidatesFromParts(parts).map(normalizeText);
        if (patterns.length === 0) return null;

        return rules.find(rule =>
            ruleMatchesGradient(rule, true) &&
            normalizeMatchMode(rule.matchMode) === 'pattern' &&
            patterns.includes(normalizeText(rule.matchText))
        ) || rules.find(rule =>
            ruleMatchesGradient(rule, false) &&
            normalizeMatchMode(rule.matchMode) === 'pattern' &&
            patterns.includes(normalizeText(rule.matchText))
        ) || null;
    }

    function rememberOriginalBorderColors(borderEl) {
        if (borderEl.dataset.ebOriginalColor !== undefined) return;

        borderEl.dataset.ebOriginalColor = borderEl.style.getPropertyValue('--electric-border-color') || DEFAULT_COLOR;
        borderEl.dataset.ebOriginalTopLeftColor = borderEl.style.getPropertyValue('--electric-border-top-left-color') || borderEl.dataset.ebOriginalColor;
        borderEl.dataset.ebOriginalBottomRightColor = borderEl.style.getPropertyValue('--electric-border-bottom-right-color') || borderEl.dataset.ebOriginalColor;
        borderEl.dataset.ebOriginalBorderColor = borderEl.style.borderColor || '';
        borderEl.dataset.ebOriginalBorderImage = borderEl.style.borderImage || '';
        borderEl.dataset.ebOriginalBackground = borderEl.style.background || '';
        borderEl.dataset.ebOriginalBackgroundColor = borderEl.style.backgroundColor || '';
    }

    function setBorderColors(borderEl, color, topLeftColor = color, bottomRightColor = color) {
        const changes = [
            ['--electric-border-color', color],
            ['--electric-border-top-left-color', topLeftColor],
            ['--electric-border-bottom-right-color', bottomRightColor]
        ];

        for (const [property, value] of changes) {
            if (borderEl.style.getPropertyValue(property).trim() !== value) {
                borderEl.style.setProperty(property, value);
            }
        }
    }

    function applyRuleToBorder(borderEl, rule) {
        const colorMode = normalizeColorMode(rule?.colorMode);
        const topLeftColor = getRuleTopLeftColor(rule);
        const bottomRightColor = colorMode === 'gradient' ? getRuleBottomRightColor(rule) : topLeftColor;

        rememberOriginalBorderColors(borderEl);

        if (hasElectricBorderVars(borderEl)) {
            setBorderColors(borderEl, topLeftColor, topLeftColor, bottomRightColor);
        } else {
            const fillColor = borderEl.dataset.ebOriginalBackgroundColor || getComputedStyle(borderEl).backgroundColor || 'rgb(37, 38, 43)';

            if (colorMode === 'gradient') {
                borderEl.style.borderColor = 'transparent';
                borderEl.style.borderImage = 'none';
                borderEl.style.background = `linear-gradient(${fillColor}, ${fillColor}) padding-box, linear-gradient(135deg, ${topLeftColor}, ${bottomRightColor}) border-box`;
            } else {
                borderEl.style.borderImage = 'none';
                borderEl.style.background = borderEl.dataset.ebOriginalBackground || '';
                borderEl.style.backgroundColor = borderEl.dataset.ebOriginalBackgroundColor || '';
                borderEl.style.borderColor = topLeftColor;
            }
        }

        borderEl.dataset.ebManaged = 'true';
    }

    function resetBorderIfManaged(borderEl) {
        if (borderEl.dataset.ebManaged !== 'true') return;

        if (hasElectricBorderVars(borderEl)) {
            setBorderColors(
                borderEl,
                borderEl.dataset.ebOriginalColor || DEFAULT_COLOR,
                borderEl.dataset.ebOriginalTopLeftColor || borderEl.dataset.ebOriginalColor || DEFAULT_COLOR,
                borderEl.dataset.ebOriginalBottomRightColor || borderEl.dataset.ebOriginalColor || DEFAULT_COLOR
            );
        }

        borderEl.style.borderColor = borderEl.dataset.ebOriginalBorderColor || '';
        borderEl.style.borderImage = borderEl.dataset.ebOriginalBorderImage || '';
        borderEl.style.background = borderEl.dataset.ebOriginalBackground || '';
        borderEl.style.backgroundColor = borderEl.dataset.ebOriginalBackgroundColor || '';

        delete borderEl.dataset.ebManaged;
    }

    function processEventBorder(borderEl) {
        const rule = getRuleForEvent(borderEl);
        if (!rule) {
            resetBorderIfManaged(borderEl);
            return;
        }

        applyRuleToBorder(borderEl, rule);
    }

    function processRoot(root = document) {
        getEventBorders(root).forEach(processEventBorder);
    }

    function scheduleProcessRoot(root = document) {
        queuedRoots.add(root);

        if (processQueueTimer) return;

        processQueueTimer = requestAnimationFrame(() => {
            const roots = [...queuedRoots];
            queuedRoots.clear();
            processQueueTimer = null;

            for (const queuedRoot of roots) {
                processRoot(queuedRoot);
            }
        });
    }

    function refreshAll() {
        queuedRoots.clear();
        if (processQueueTimer) {
            cancelAnimationFrame(processQueueTimer);
            processQueueTimer = null;
        }

        processRoot(document);
        renderRulesList();
    }

    function getVisibleEventNames() {
        const names = getVisibleEvents()
            .flatMap(event => event.patternDisplay ? [event.display, event.patternDisplay] : [event.display])
            .filter(Boolean);

        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }

    function getVisibleEvents() {
        return getEventBorders(document)
            .map(border => {
                const parts = getEventTextPartsFromBorder(border);
                const name = collapseSpaces(parts.join(' '));
                const pattern = getPatternCandidatesFromParts(parts)[0] || '';
                const gradientSignature = getEventGradientSignatureFromBorder(border);
                const eventName = getEventNameFromGradientSignature(gradientSignature);
                const display = `${name} [${eventName}]`;
                const patternDisplay = pattern ? `${pattern} [${eventName}]` : '';
                return { name, pattern, gradientSignature, eventName, display, patternDisplay };
            })
            .filter(event => event.name);
    }

    function getVisibleEventFromValue(value) {
        const parsed = parseVisibleEventValue(value);
        const normalizedName = normalizeText(parsed.name);
        const normalizedEventName = normalizeText(parsed.eventName);

        if (!normalizedName) return null;

        return getVisibleEvents().find(visibleEvent => {
            const nameMatches =
                normalizeText(visibleEvent.name) === normalizedName ||
                normalizeText(visibleEvent.pattern) === normalizedName;

            const eventMatches =
                !normalizedEventName ||
                normalizeText(visibleEvent.eventName) === normalizedEventName;

            return nameMatches && eventMatches;
        }) || null;
    }

    function getPatternFromVisibleEventName(eventName) {
        const visibleEvent = getVisibleEventFromValue(eventName);
        if (visibleEvent) return visibleEvent.pattern || '';

        const normalizedEventName = normalizeText(parseVisibleEventValue(eventName).name);
        if (!normalizedEventName) return '';

        const event = getVisibleEvents().find(visibleEvent =>
            normalizeText(visibleEvent.name) === normalizedEventName
        );

        return event?.pattern || '';
    }

    function getGradientSignatureFromVisibleEventName(eventName) {
        const visibleEvent = getVisibleEventFromValue(eventName);
        if (visibleEvent) return visibleEvent.gradientSignature || '';

        const normalizedEventName = normalizeText(parseVisibleEventValue(eventName).name);
        if (!normalizedEventName) return '';

        const event = getVisibleEvents().find(visibleEvent =>
            normalizeText(visibleEvent.name) === normalizedEventName
        );

        return event?.gradientSignature || '';
    }

    function getGradientScopeLabel(signature) {
        return getEventNameFromGradientSignature(signature);
    }

    function setGradientScope(signature) {
        const inputEl = document.getElementById('eb-gradient-signature');
        const normalizedSignature = normalizeGradientSignature(signature);

        if (inputEl) inputEl.value = normalizedSignature;
    }

    function updateMatchModeUi() {
        const modeEl = document.getElementById('eb-match-mode');
        const matchEl = document.getElementById('eb-match-text');
        const matchLabel = document.getElementById('eb-match-label');

        if (!matchEl || !matchLabel || !modeEl) return;

        if (modeEl.value === 'pattern') {
            matchLabel.textContent = 'Match finish pattern';
            matchEl.placeholder = "Doppler 'Black Pearl'";
        } else {
            matchLabel.textContent = 'Match event item text';
            matchEl.placeholder = "Five-SeveN Neon Kimono 'Neon Diamond'";
        }
    }

    function updateColorModeUi() {
        const colorModeEl = document.getElementById('eb-color-mode');
        const bottomRightWrap = document.getElementById('eb-bottom-right-color-wrap');
        const topLeftLabel = document.getElementById('eb-top-left-color-label');

        if (!colorModeEl || !bottomRightWrap || !topLeftLabel) return;

        if (colorModeEl.value === 'gradient') {
            topLeftLabel.textContent = 'Top-left';
            bottomRightWrap.style.display = 'block';
        } else {
            topLeftLabel.textContent = 'Color';
            bottomRightWrap.style.display = 'none';
        }
    }

    function clearForm() {
        editingIndex = -1;

        const matchEl = document.getElementById('eb-match-text');
        const modeEl = document.getElementById('eb-match-mode');
        const colorModeEl = document.getElementById('eb-color-mode');
        const gradientSignatureEl = document.getElementById('eb-gradient-signature');
        const addBtn = document.getElementById('eb-add-btn');
        const cancelBtn = document.getElementById('eb-cancel-btn');

        if (matchEl) matchEl.value = '';
        if (modeEl) modeEl.value = 'exact';
        updateMatchModeUi();
        if (colorModeEl) colorModeEl.value = 'solid';
        if (gradientSignatureEl) gradientSignatureEl.value = '';
        setGradientScope('');
        setColorInputs(DEFAULT_COLOR, 'top-left');
        setColorInputs(DEFAULT_COLOR, 'bottom-right');
        updateColorModeUi();
        if (addBtn) addBtn.textContent = 'Add Rule';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    function populateFormForEdit(index) {
        const rules = loadRules();
        const rule = rules[index];
        if (!rule) return;

        editingIndex = index;

        document.getElementById('eb-match-text').value = rule.matchText || '';
        document.getElementById('eb-match-mode').value = normalizeMatchMode(rule.matchMode);
        updateMatchModeUi();
        setGradientScope(rule.gradientSignature || '');
        if (rule.gradientSignature) {
            document.getElementById('eb-match-text').value = `${rule.matchText || ''} [${getEventNameFromGradientSignature(rule.gradientSignature)}]`;
        }
        document.getElementById('eb-color-mode').value = normalizeColorMode(rule.colorMode);
        setColorInputs(getRuleTopLeftColor(rule), 'top-left');
        setColorInputs(getRuleBottomRightColor(rule), 'bottom-right');
        updateColorModeUi();
        document.getElementById('eb-add-btn').textContent = 'Save';
        document.getElementById('eb-cancel-btn').style.display = 'inline-block';
        setStatus(`Editing rule ${index + 1}.`);
    }

    function handleAddOrUpdateRule() {
        const matchEl = document.getElementById('eb-match-text');
        const modeEl = document.getElementById('eb-match-mode');
        const colorModeEl = document.getElementById('eb-color-mode');
        const gradientSignatureEl = document.getElementById('eb-gradient-signature');
        const topLeftColorTextEl = document.getElementById('eb-top-left-color-text');
        const bottomRightColorTextEl = document.getElementById('eb-bottom-right-color-text');

        const parsedMatch = parseVisibleEventValue(matchEl.value);
        let matchText = parsedMatch.name;
        const matchMode = normalizeMatchMode(modeEl.value);
        const colorMode = normalizeColorMode(colorModeEl.value);
        const visibleEvent = getVisibleEventFromValue(matchEl.value);
        const gradientSignature = normalizeGradientSignature(visibleEvent?.gradientSignature || gradientSignatureEl.value);
        const topLeftColor = normalizeHexColor(topLeftColorTextEl.value);
        const bottomRightColor = colorMode === 'gradient' ? normalizeHexColor(bottomRightColorTextEl.value) : topLeftColor;

        if (matchMode === 'pattern') {
            matchText = visibleEvent?.pattern || getBestPatternFromEventName(matchText) || matchText;
        }

        if (!matchText) {
            setStatus(matchMode === 'pattern' ? "Enter the finish pattern, like Doppler 'Black Pearl'." : 'Enter the event item text to match.', true);
            return;
        }

        if (!isHexColor(topLeftColorTextEl.value)) {
            setStatus('Enter a valid top-left hex color like #ff4d4d.', true);
            return;
        }

        if (colorMode === 'gradient' && !isHexColor(bottomRightColorTextEl.value)) {
            setStatus('Enter a valid bottom-right hex color like #4d7dff.', true);
            return;
        }

        const rules = loadRules();
        const newRule = {
            matchText,
            matchMode,
            colorMode,
            gradientSignature,
            color: topLeftColor,
            topLeftColor,
            bottomRightColor
        };

        if (editingIndex >= 0) {
            rules[editingIndex] = newRule;
            saveRules(rules);
            clearForm();
            refreshAll();
            setStatus('Rule updated.');
            return;
        }

        const existingIndex = rules.findIndex(rule =>
            normalizeMatchMode(rule.matchMode) === matchMode &&
            normalizeText(rule.matchText) === normalizeText(matchText) &&
            normalizeGradientSignature(rule.gradientSignature) === gradientSignature
        );

        if (existingIndex >= 0) {
            rules[existingIndex] = newRule;
            setStatus('Existing rule updated.');
        } else {
            rules.push(newRule);
            setStatus('Rule saved.');
        }

        saveRules(rules);
        clearForm();
        refreshAll();
    }

    function exportRules() {
        const rules = loadRules();
        const json = JSON.stringify(rules, null, 2);

        navigator.clipboard.writeText(json).then(() => {
            setStatus('Rules copied to clipboard.');
        }).catch(() => {
            prompt('Copy your rules JSON:', json);
            setStatus('Clipboard failed, opened copy dialog instead.');
        });
    }

    function importRules() {
        const input = prompt('Paste exported rules JSON here:');
        if (!input) {
            setStatus('Import cancelled.');
            return;
        }

        try {
            const parsed = JSON.parse(input);

            if (!Array.isArray(parsed)) {
                setStatus('Import failed: JSON must be an array of rules.', true);
                return;
            }

            const existing = loadRules();
            const merged = [...existing];

            for (const rule of parsed) {
                if (!rule || typeof rule !== 'object') continue;

                const matchText = collapseSpaces(rule.matchText);
                const matchMode = normalizeMatchMode(rule.matchMode);
                const colorMode = normalizeColorMode(rule.colorMode);
                const gradientSignature = normalizeGradientSignature(rule.gradientSignature);
                const topLeftColor = getRuleTopLeftColor(rule);
                const bottomRightColor = colorMode === 'gradient' ? getRuleBottomRightColor(rule) : topLeftColor;

                if (!matchText || !isHexColor(topLeftColor) || !isHexColor(bottomRightColor)) continue;

                const cleanedRule = {
                    matchText,
                    matchMode,
                    colorMode,
                    gradientSignature,
                    color: topLeftColor,
                    topLeftColor,
                    bottomRightColor
                };
                const index = merged.findIndex(existingRule =>
                    normalizeMatchMode(existingRule.matchMode) === matchMode &&
                    normalizeText(existingRule.matchText) === normalizeText(matchText) &&
                    normalizeGradientSignature(existingRule.gradientSignature) === gradientSignature
                );

                if (index >= 0) {
                    merged[index] = cleanedRule;
                } else {
                    merged.push(cleanedRule);
                }
            }

            saveRules(merged);
            clearForm();
            refreshAll();
            setStatus(`Import complete. You now have ${merged.length} rule${merged.length === 1 ? '' : 's'}.`);
        } catch {
            setStatus('Import failed: invalid JSON.', true);
        }
    }

    function deleteAllRules() {
        const rules = loadRules();
        if (rules.length === 0) {
            setStatus('No rules to delete.');
            return;
        }

        const confirmed = confirm(`Delete all ${rules.length} rule${rules.length === 1 ? '' : 's'}? This cannot be undone.`);
        if (!confirmed) {
            setStatus('Delete all cancelled.');
            return;
        }

        saveRules([]);
        ruleSearch = '';
        clearForm();

        const searchEl = document.getElementById('eb-search');
        if (searchEl) searchEl.value = '';

        refreshAll();
        setStatus('All rules deleted.');
    }

    function renderRulesList() {
        const listEl = document.getElementById('eb-list');
        if (!listEl) return;

        const rules = loadRules();
        const search = normalizeText(ruleSearch);

        const filteredRules = rules
            .map((rule, index) => ({ rule, index }))
            .filter(({ rule }) => {
                if (!search) return true;
                return normalizeText(`${getMatchModeLabel(rule.matchMode)} ${rule.matchText} ${getGradientScopeLabel(rule.gradientSignature)} ${getRuleColorSummary(rule)}`).includes(search);
            });

        listEl.innerHTML = '';

        if (filteredRules.length === 0) {
            listEl.innerHTML = '<div class="eb-rule-line" style="color:#999;">No matching rules found.</div>';
            return;
        }

        for (const { rule, index } of filteredRules) {
            const wrapper = document.createElement('div');
            wrapper.className = 'eb-rule';

            wrapper.innerHTML = `
                <div class="eb-rule-line"><strong>Mode:</strong> ${escapeHtml(getMatchModeLabel(rule.matchMode))}</div>
                <div class="eb-rule-line"><strong>Event:</strong> ${escapeHtml(getGradientScopeLabel(rule.gradientSignature))}</div>
                <div class="eb-rule-line"><strong>Match:</strong> ${escapeHtml(rule.matchText)}</div>
                <div class="eb-rule-line eb-color-line">
                    <strong>Color:</strong>
                    <span class="eb-swatch" style="background:${escapeHtml(getSwatchBackground(rule))};"></span>
                    ${escapeHtml(getRuleColorSummary(rule))}
                </div>
                <div class="eb-rule-actions">
                    <button class="eb-edit-btn" type="button" data-rule-index="${index}">Edit</button>
                    <button class="eb-remove-btn" type="button" data-rule-index="${index}">Remove</button>
                </div>
            `;

            listEl.appendChild(wrapper);
        }

        listEl.querySelectorAll('.eb-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                populateFormForEdit(Number(btn.dataset.ruleIndex));
            });
        });

        listEl.querySelectorAll('.eb-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.ruleIndex);
                const rules = loadRules();
                rules.splice(index, 1);
                saveRules(rules);

                if (editingIndex === index) clearForm();
                if (editingIndex > index) editingIndex--;

                refreshAll();
                setStatus('Rule removed.');
            });
        });
    }

    function createManagerUI() {
        if (document.getElementById('event-border-manager-root')) return;

        const root = document.createElement('div');
        root.id = 'event-border-manager-root';
        root.innerHTML = `
            <button id="event-border-toggle" type="button" title="Event Border Rules">
                <span>A</span>
            </button>
            <div id="event-border-panel" style="display:none;">
                <div id="event-border-header">Event Border Manager</div>

                <div class="eb-mode-grid">
                    <div>
                        <label class="eb-label">Match mode</label>
                        <select id="eb-match-mode" class="eb-input">
                            <option value="exact">Exact item text</option>
                            <option value="pattern">Finish pattern</option>
                        </select>
                    </div>
                    <div>
                        <label class="eb-label">Color mode</label>
                        <select id="eb-color-mode" class="eb-input">
                            <option value="solid">Solid</option>
                            <option value="gradient">Gradient</option>
                        </select>
                    </div>
                </div>

                <label id="eb-match-label" class="eb-label">Match event item text</label>
                <input id="eb-match-text" class="eb-input" list="eb-visible-events" placeholder="Five-SeveN Neon Kimono 'Neon Diamond'" autocomplete="off" />
                <datalist id="eb-visible-events"></datalist>

                <input id="eb-gradient-signature" type="hidden" />

                <div id="eb-top-left-color-wrap">
                    <label id="eb-top-left-color-label" class="eb-label">Color</label>
                    <div class="eb-color-row">
                        <input id="eb-top-left-color" type="color" value="${DEFAULT_COLOR}" />
                        <input id="eb-top-left-color-text" class="eb-input" value="${DEFAULT_COLOR}" placeholder="#ffffff" maxlength="7" />
                        <button id="eb-top-left-eyedropper-btn" type="button" title="Pick color from screen">Pick</button>
                    </div>
                </div>

                <div id="eb-bottom-right-color-wrap" style="display:none;">
                    <label class="eb-label">Bottom-right</label>
                    <div class="eb-color-row">
                        <input id="eb-bottom-right-color" type="color" value="${DEFAULT_COLOR}" />
                        <input id="eb-bottom-right-color-text" class="eb-input" value="${DEFAULT_COLOR}" placeholder="#ffffff" maxlength="7" />
                        <button id="eb-bottom-right-eyedropper-btn" type="button" title="Pick color from screen">Pick</button>
                    </div>
                </div>

                <div class="eb-actions">
                    <button id="eb-add-btn" type="button">Add Rule</button>
                    <button id="eb-cancel-btn" type="button" style="display:none;">Cancel</button>
                    <button id="eb-refresh-btn" type="button">Refresh</button>
                    <button id="eb-export-btn" type="button">Export</button>
                    <button id="eb-import-btn" type="button">Import</button>
                </div>

                <div id="eb-status"></div>

                <label class="eb-label" for="eb-search">Search rules</label>
                <div class="eb-search-row">
                    <input id="eb-search" class="eb-input" placeholder="Search match text or color..." />
                    <button id="eb-delete-all-btn" type="button" title="Delete all rules">Del</button>
                </div>
                <div id="eb-list"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #event-border-manager-root {
                position: fixed;
                right: 0;
                bottom: 42px;
                z-index: 999999;
                font-family: Arial, sans-serif;
            }

            #event-border-toggle {
                position: fixed;
                right: 0;
                bottom: 42px;
                width: 34px;
                height: 32px;
                padding: 0;
                margin: 0;
                border: 1px solid #444;
                border-right: 0;
                border-radius: 8px 0 0 8px;
                background: #000;
                color: #fff;
                cursor: pointer;
                line-height: 1;
                box-shadow: 0 4px 12px rgba(0,0,0,0.35);
                z-index: 1000002;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #event-border-toggle span {
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 22px;
                color: #fff;
                font-size: 18px;
                font-weight: 700;
                line-height: 1;
            }

            #event-border-toggle span::after {
                content: "";
                position: absolute;
                left: 1px;
                right: 1px;
                bottom: 0;
                height: 3px;
                border-radius: 999px;
                background: linear-gradient(90deg, #ff4d4d, #ffd24d, #4dff88, #4da3ff, #c44dff);
            }

            #event-border-panel {
                position: fixed;
                right: 16px;
                bottom: 20px;
                width: 400px;
                background: rgba(20, 20, 20, 0.97);
                color: #eee;
                border: 1px solid #444;
                border-radius: 10px;
                padding: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                box-sizing: border-box;
                z-index: 1000001;
            }

            #event-border-header {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 10px;
            }

            .eb-label {
                display: block;
                font-size: 12px;
                color: #bbb;
                margin: 8px 0 4px;
            }

            .eb-mode-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 8px;
            }

            .eb-input {
                width: 100%;
                box-sizing: border-box;
                padding: 8px;
                border-radius: 6px;
                border: 1px solid #555;
                background: #111;
                color: #fff;
                font-size: 13px;
            }

            .eb-color-row {
                display: flex;
                align-items: stretch;
                gap: 8px;
            }

            #eb-top-left-color,
            #eb-bottom-right-color {
                width: 48px;
                min-width: 48px;
                height: 36px;
                padding: 2px;
                border-radius: 6px;
                border: 1px solid #555;
                background: #111;
                cursor: pointer;
            }

            #eb-top-left-eyedropper-btn,
            #eb-bottom-right-eyedropper-btn {
                width: 54px;
                min-width: 54px;
                height: 36px;
                padding: 0;
                background: #222;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                line-height: 1.2;
                box-sizing: border-box;
            }

            .eb-actions,
            .eb-rule-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 10px;
            }

            .eb-actions button,
            .eb-rule-actions button,
            #eb-delete-all-btn {
                background: #222;
                color: #fff;
                border: 1px solid #555;
                border-radius: 6px;
                padding: 7px 9px;
                cursor: pointer;
                font-size: 13px;
                line-height: 1.2;
                box-sizing: border-box;
            }

            #eb-add-btn,
            #eb-cancel-btn,
            #eb-refresh-btn {
                flex: 1 1 auto;
                min-width: 0;
                text-align: center;
            }

            #eb-export-btn,
            #eb-import-btn {
                padding: 6px 8px;
                font-size: 11px;
            }

            .eb-search-row {
                display: flex;
                align-items: stretch;
                gap: 8px;
                margin-top: 2px;
            }

            .eb-search-row #eb-search {
                flex: 1;
                min-width: 0;
            }

            #eb-delete-all-btn {
                width: 42px;
                min-width: 42px;
                height: 36px;
                padding: 0;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
            }

            #eb-status {
                margin-top: 10px;
                font-size: 12px;
                min-height: 16px;
                color: #9ad;
            }

            #eb-list {
                margin-top: 12px;
                max-height: 240px;
                overflow: auto;
                border-top: 1px solid #333;
                padding-top: 10px;
            }

            .eb-rule {
                border: 1px solid #333;
                border-radius: 8px;
                padding: 8px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.03);
            }

            .eb-rule-line {
                font-size: 12px;
                margin-bottom: 4px;
                word-break: break-word;
            }

            .eb-color-line {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .eb-swatch {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 1px solid #666;
                border-radius: 3px;
                flex: 0 0 auto;
            }
        `;

        document.body.appendChild(style);
        document.body.appendChild(root);

        const toggleBtn = document.getElementById('event-border-toggle');
        const panel = document.getElementById('event-border-panel');
        const addBtn = document.getElementById('eb-add-btn');
        const cancelBtn = document.getElementById('eb-cancel-btn');
        const refreshBtn = document.getElementById('eb-refresh-btn');
        const exportBtn = document.getElementById('eb-export-btn');
        const importBtn = document.getElementById('eb-import-btn');
        const searchEl = document.getElementById('eb-search');
        const deleteAllBtn = document.getElementById('eb-delete-all-btn');
        const modeEl = document.getElementById('eb-match-mode');
        const matchEl = document.getElementById('eb-match-text');
        const colorModeEl = document.getElementById('eb-color-mode');
        const topLeftColorEl = document.getElementById('eb-top-left-color');
        const topLeftColorTextEl = document.getElementById('eb-top-left-color-text');
        const bottomRightColorEl = document.getElementById('eb-bottom-right-color');
        const bottomRightColorTextEl = document.getElementById('eb-bottom-right-color-text');
        const topLeftEyedropperBtn = document.getElementById('eb-top-left-eyedropper-btn');
        const bottomRightEyedropperBtn = document.getElementById('eb-bottom-right-eyedropper-btn');
        const datalistEl = document.getElementById('eb-visible-events');

        function getSelectedVisibleEvent() {
            const visibleEvents = getVisibleEvents();
            const typedName = collapseSpaces(matchEl.value);

            if (typedName) {
                const parsed = parseVisibleEventValue(typedName);
                const normalizedEventName = normalizeText(parsed.eventName);
                const typedMatch = visibleEvents.find(event =>
                    (
                        normalizeText(event.name) === normalizeText(parsed.name) ||
                        normalizeText(event.pattern) === normalizeText(parsed.name)
                    ) &&
                    (
                        !normalizedEventName ||
                        normalizeText(event.eventName) === normalizedEventName
                    )
                );

                if (typedMatch) return typedMatch;
            }

            return visibleEvents
                .sort((a, b) => a.name.localeCompare(b.name))[0] || null;
        }

        function refreshVisibleEventOptions() {
            datalistEl.innerHTML = '';
            getVisibleEventNames().forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                datalistEl.appendChild(option);
            });
        }

        toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            toggleBtn.style.zIndex = panel.style.display === 'none' ? '1000002' : '1000004';
            if (panel.style.display !== 'none') {
                refreshVisibleEventOptions();
            }
        });

        addBtn.addEventListener('click', handleAddOrUpdateRule);

        cancelBtn.addEventListener('click', () => {
            clearForm();
            setStatus('Edit cancelled.');
        });

        refreshBtn.addEventListener('click', () => {
            refreshVisibleEventOptions();
            refreshAll();
            setStatus('Rules re-applied.');
        });

        exportBtn.addEventListener('click', exportRules);
        importBtn.addEventListener('click', importRules);
        deleteAllBtn.addEventListener('click', deleteAllRules);

        searchEl.addEventListener('input', () => {
            ruleSearch = searchEl.value.trim().toLowerCase();
            renderRulesList();
        });

        colorModeEl.addEventListener('change', updateColorModeUi);

        topLeftColorEl.addEventListener('input', () => {
            setColorInputs(topLeftColorEl.value, 'top-left');
        });

        topLeftColorTextEl.addEventListener('input', () => {
            if (isHexColor(topLeftColorTextEl.value)) {
                setColorInputs(topLeftColorTextEl.value, 'top-left');
            }
        });

        bottomRightColorEl.addEventListener('input', () => {
            setColorInputs(bottomRightColorEl.value, 'bottom-right');
        });

        bottomRightColorTextEl.addEventListener('input', () => {
            if (isHexColor(bottomRightColorTextEl.value)) {
                setColorInputs(bottomRightColorTextEl.value, 'bottom-right');
            }
        });

        modeEl.addEventListener('change', () => {
            const value = collapseSpaces(matchEl.value);
            updateMatchModeUi();
            refreshVisibleEventOptions();
            if (!value) return;

            if (modeEl.value === 'pattern') {
                const visibleEvent = getVisibleEventFromValue(value);
                const pattern = visibleEvent?.pattern || getBestPatternFromEventName(parseVisibleEventValue(value).name);
                if (pattern) {
                    matchEl.value = visibleEvent?.eventName ? `${pattern} [${visibleEvent.eventName}]` : pattern;
                    if (visibleEvent?.gradientSignature) {
                        setGradientScope(visibleEvent.gradientSignature);
                    }
                    setStatus(`Pattern match set to ${pattern}.`);
                }
            }
        });

        topLeftEyedropperBtn.addEventListener('click', () => pickColorFromScreen('top-left'));
        bottomRightEyedropperBtn.addEventListener('click', () => pickColorFromScreen('bottom-right'));

        if (!window.EyeDropper) {
            topLeftEyedropperBtn.title = 'Screen color picker is not supported in this browser';
            bottomRightEyedropperBtn.title = 'Screen color picker is not supported in this browser';
        }

        refreshVisibleEventOptions();
        updateMatchModeUi();
        updateColorModeUi();
        renderRulesList();
    }

    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.id === 'event-border-manager-root' || node.closest?.('#event-border-manager-root')) continue;
                    scheduleProcessRoot(node);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async function init() {
        while (!document.body) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        createManagerUI();
        refreshAll();
        startObserver();
    }

    init();
})();