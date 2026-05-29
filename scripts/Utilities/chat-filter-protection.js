// ==UserScript==
// @name         Chat filter protection v2
// @namespace    finally
// @version      2.0
// @description  Highlights chat words that would result in a mute and encrypts the word before sending.
// @author       ZSB
// @match        https://case-clicker.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  const CONFIG = {
    inputSelector: 'input.mantine-TextInput-input[placeholder="Send a message"]',
    sendButtonSelector:
      '.mantine-TextInput-wrapper:has(input[placeholder="Send a message"]) button',
    matchBehavior: 'encode',
    chatCharLimit: 200,
    blockHighlightColor:   'rgba(255,  70,  70, 0.55)',
    encodeHighlightColor:  'rgba(240, 200,  60, 0.55)',
    decodedHighlightColor: 'rgba(170, 100, 240, 0.30)',

    debug: false,
    extraBackdropStyle: {},
  };

  let obscenity;
  try {
    obscenity = await import('https://esm.sh/obscenity@0.4.6');
  } catch (err) {
    console.error('[CC PreFilter] Failed to load obscenity:', err);
    return;
  }
  const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = obscenity;
  const built = englishDataset.build();
  const matcher = new RegExpMatcher({
    blacklistedTerms: built.blacklistedTerms,
    whitelistedTerms: [],
    ...englishRecommendedTransformers,
  });

  function getMatches(text) {
    if (!text) return [];
    return matcher.getAllMatches(text, true).map((m) => ({
      ...m,
      endIndex: m.endIndex + 1,
    }));
  }

  const ENCODE_RE = /\|~([A-Za-z0-9_-]+)~\|/g;

  function b64encode(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  function b64decode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  const encodeWord = (w) => '|~' + b64encode(w) + '~|';

  function mergeRanges(matches) {
    const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
    const merged = [];
    for (const m of sorted) {
      const last = merged[merged.length - 1];
      if (last && m.startIndex <= last.endIndex) {
        last.endIndex = Math.max(last.endIndex, m.endIndex);
      } else {
        merged.push({ startIndex: m.startIndex, endIndex: m.endIndex });
      }
    }
    return merged;
  }

  function rewriteAtRanges(text, matches, fn) {
    const ranges = mergeRanges(matches);
    if (!ranges.length) return text;
    let out = '', cursor = 0;
    for (const r of ranges) {
      out += text.slice(cursor, r.startIndex);
      out += fn(text.slice(r.startIndex, r.endIndex));
      cursor = r.endIndex;
    }
    out += text.slice(cursor);
    return out;
  }

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function buildHighlightedHtml(text, matches) {
    const ranges = mergeRanges(matches);
    if (!ranges.length) return escapeHtml(text);
    let out = '', cursor = 0;
    for (const r of ranges) {
      out += escapeHtml(text.slice(cursor, r.startIndex));
      out += '<mark>' + escapeHtml(text.slice(r.startIndex, r.endIndex)) + '</mark>';
      cursor = r.endIndex;
    }
    out += escapeHtml(text.slice(cursor));
    return out;
  }

  function computeSentLength(text, matches) {
    if (CONFIG.matchBehavior !== 'encode' || !matches.length) return text.length;
    return rewriteAtRanges(text, matches, encodeWord).length;
  }

  const STYLE_ID = 'cc-prefilter-styles';
  if (!document.getElementById(STYLE_ID)) {
    const hi = CONFIG.matchBehavior === 'encode'
      ? CONFIG.encodeHighlightColor
      : CONFIG.blockHighlightColor;
    const ring = CONFIG.matchBehavior === 'encode'
      ? 'rgba(240, 180, 0, 0.55)'
      : 'rgba(255,   0, 0, 0.45)';

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cc-pf-backdrop {
        position: absolute; pointer-events: none; overflow: hidden;
        white-space: pre; color: transparent; background: transparent;
        margin: 0; z-index: 0; box-sizing: border-box;
        border-color: transparent !important;
      }
      .cc-pf-backdrop mark {
        all: unset;
        background: ${hi};
        color: transparent;
        border-radius: 2px;
        box-shadow: 0 0 0 1px ${ring};
      }
      .cc-pf-input { background: transparent !important; position: relative; z-index: 1; }
      .cc-pf-blocked { opacity: 0.45 !important; cursor: not-allowed !important; filter: grayscale(0.6); }

      .cc-pf-decoded {
        background: ${CONFIG.decodedHighlightColor};
        border-radius: 2px;
        padding: 0 1px;
        cursor: help;
        box-shadow: 0 0 0 1px rgba(170, 100, 240, 0.45);
      }

      .cc-pf-counter {
        position: absolute;
        right: 2px;
        top: -1.45em;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: rgba(255, 255, 255, 0.42);
        pointer-events: none;
        user-select: none;
        z-index: 5;
        white-space: nowrap;
      }
      .cc-pf-counter-warn  { color: rgba(240, 200,  60, 0.95); }
      .cc-pf-counter-over  { color: rgba(255,  70,  70, 0.95); font-weight: 600; }
      .cc-pf-counter-arrow { opacity: 0.6; padding: 0 3px; }
    `;
    document.head.appendChild(style);
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  function setReactValue(el, value) {
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  let activeInput = null;
  let suppressSendInterception = false;

  function setSendButtonBlocked(blocked) {
    const btn = document.querySelector(CONFIG.sendButtonSelector);
    if (!btn) return;
    if (blocked) {
      btn.classList.add('cc-pf-blocked');
      btn.setAttribute('aria-disabled', 'true');
      try { btn.disabled = true; } catch (_) {}
    } else {
      btn.classList.remove('cc-pf-blocked');
      btn.removeAttribute('aria-disabled');
      try { btn.disabled = false; } catch (_) {}
    }
  }

  function handleSendAttempt(e) {
    if (suppressSendInterception) return;
    if (!activeInput) return;

    const text = activeInput.value;
    const matches = getMatches(text);
    const sentLen = computeSentLength(text, matches);

    const overLimit = sentLen > CONFIG.chatCharLimit;
    const blockingMatches = CONFIG.matchBehavior === 'block' && matches.length > 0;
    const willEncode = CONFIG.matchBehavior === 'encode' && matches.length > 0;

    if (!overLimit && !blockingMatches && !willEncode) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (overLimit || blockingMatches) {
      if (CONFIG.debug) {
        console.log('[CC PreFilter] blocked send',
          overLimit ? `(over limit: ${sentLen}/${CONFIG.chatCharLimit})` : '(matches)');
      }
      return;
    }

    const encoded = rewriteAtRanges(text, matches, encodeWord);
    if (CONFIG.debug) {
      console.log('[CC PreFilter] encode:', JSON.stringify(text), '->', JSON.stringify(encoded));
    }

    setReactValue(activeInput, encoded);
    setTimeout(() => {
      const btn = document.querySelector(CONFIG.sendButtonSelector);
      if (!btn) return;
      suppressSendInterception = true;
      try { btn.click(); } finally { suppressSendInterception = false; }
    }, 0);
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(CONFIG.sendButtonSelector)) handleSendAttempt(e);
  }, true);

  function attachInput(inputEl) {
    if (inputEl.dataset.ccPf) return;
    inputEl.dataset.ccPf = '1';
    activeInput = inputEl;

    const parent = inputEl.parentElement;
    if (!parent) return;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    inputEl.classList.add('cc-pf-input');

    const backdrop = document.createElement('div');
    backdrop.className = 'cc-pf-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    parent.insertBefore(backdrop, inputEl);

    const counter = document.createElement('div');
    counter.className = 'cc-pf-counter';
    parent.appendChild(counter);

    function sync() {
      const cs = getComputedStyle(inputEl);
      for (const p of [
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
        'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'textAlign',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
        'borderTopLeftRadius', 'borderTopRightRadius',
        'borderBottomLeftRadius', 'borderBottomRightRadius',
        'tabSize',
      ]) backdrop.style[p] = cs[p];
      backdrop.style.borderColor = 'transparent';
      backdrop.style.whiteSpace = inputEl.tagName === 'INPUT' ? 'pre' : 'pre-wrap';
      backdrop.style.overflow = 'hidden';
      const r = inputEl.getBoundingClientRect();
      backdrop.style.top = inputEl.offsetTop + 'px';
      backdrop.style.left = inputEl.offsetLeft + 'px';
      backdrop.style.width = r.width + 'px';
      backdrop.style.height = r.height + 'px';
      Object.assign(backdrop.style, CONFIG.extraBackdropStyle);
    }
    sync();

    function renderCounter(typed, sent) {
      const limit = CONFIG.chatCharLimit;
      counter.innerHTML = sent !== typed
        ? `${typed}<span class="cc-pf-counter-arrow">→</span>${sent} / ${limit}`
        : `${typed} / ${limit}`;
      counter.classList.toggle('cc-pf-counter-over', sent > limit);
      counter.classList.toggle('cc-pf-counter-warn', sent <= limit && sent >= limit * 0.85);
    }

    function update() {
      const text = inputEl.value || '';
      const matches = getMatches(text);
      backdrop.innerHTML = buildHighlightedHtml(text, matches);
      backdrop.scrollLeft = inputEl.scrollLeft;
      backdrop.scrollTop = inputEl.scrollTop;

      const sentLen = computeSentLength(text, matches);
      renderCounter(text.length, sentLen);

      const overLimit = sentLen > CONFIG.chatCharLimit;
      const matchBlocks = CONFIG.matchBehavior === 'block' && matches.length > 0;
      setSendButtonBlocked(overLimit || matchBlocks);

      if (CONFIG.debug && matches.length) {
        console.log('[CC PreFilter] matches:', matches.map((m) => {
          try {
            return englishDataset.getPayloadWithPhraseMetadata(m).phraseMetadata.originalWord;
          } catch (_) { return '?'; }
        }));
      }
    }

    inputEl.addEventListener('input', update);
    inputEl.addEventListener('scroll', () => {
      backdrop.scrollLeft = inputEl.scrollLeft;
      backdrop.scrollTop = inputEl.scrollTop;
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) handleSendAttempt(e);
    }, true);

    try { new ResizeObserver(sync).observe(inputEl); } catch (_) {}
    try { new ResizeObserver(sync).observe(parent); } catch (_) {}
    window.addEventListener('resize', sync);

    update();
  }

  function decodeTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.classList.contains('cc-pf-backdrop')) return;
    if (parent.classList.contains('cc-pf-input')) return;
    if (parent.classList.contains('cc-pf-decoded')) return;
    if (parent.tagName === 'INPUT' || parent.tagName === 'TEXTAREA') return;
    if (parent.isContentEditable) return;
    if (parent.closest && parent.closest('script, style')) return;

    const text = node.nodeValue;
    if (!text || text.indexOf('|~') === -1) return;

    const re = /\|~([A-Za-z0-9_-]+)~\|/g;
    let lastIndex = 0;
    let match;
    let foundAny = false;
    const frag = document.createDocumentFragment();

    while ((match = re.exec(text)) !== null) {
      foundAny = true;
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      let decoded;
      try {
        decoded = b64decode(match[1]);
      } catch (_) {

        frag.appendChild(document.createTextNode(match[0]));
        lastIndex = match.index + match[0].length;
        continue;
      }
      const span = document.createElement('span');
      span.className = 'cc-pf-decoded';
      span.textContent = decoded;
      span.title = text;
      frag.appendChild(span);
      lastIndex = match.index + match[0].length;
    }

    if (!foundAny) return;

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode.replaceChild(frag, node);
  }

  function decodeSubtree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { decodeTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.classList && root.classList.contains('cc-pf-decoded')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const tn of nodes) decodeTextNode(tn);
  }

  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        for (const node of m.addedNodes) decodeSubtree(node);
      } else if (m.type === 'characterData') {
        decodeTextNode(m.target);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  decodeSubtree(document.body);

  function scan() {
    document.querySelectorAll(CONFIG.inputSelector).forEach((el) => {
      if (!el.dataset.ccPf) attachInput(el);
    });
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true, subtree: true,
  });

  if (CONFIG.debug) {
    console.log('[CC PreFilter] ready, mode =', CONFIG.matchBehavior,
      ', limit =', CONFIG.chatCharLimit);
  }
})();