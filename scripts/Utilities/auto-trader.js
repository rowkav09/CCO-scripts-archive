// ==UserScript==
// @name         auto trade ig
// @description  huge
// @namespace    http://tampermonkey.net/
// @version      1.0
// @match        https://case-clicker.com/*
// @author       Zhiro
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCAN_MS = 1500;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let activeTrade   = null;
  let skinScanner   = null;
  let scanCount     = 0;
  let lastSkinsHash = '';
  let currentTokens = 0;
  let busy          = false;

  function findBtn(label, exact = false) {
    for (const b of document.querySelectorAll('button')) {
      const t = b.textContent?.trim() || '';
      const match = exact ? t === label : t.toLowerCase().includes(label.toLowerCase());
      if (match && !b.disabled) return b;
    }
    return null;
  }

  function closeModal() {
    const btn = document.querySelector('button[aria-label="Close"]');
    if (btn) { btn.click(); return; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  function priceToTokens(priceStr) {
    if (!priceStr) return 0;
    const m = priceStr.replace(',', '.').match(/[\d.]+/);
    if (!m) return 0;
    const dollars = parseFloat(m[0]);
    if (isNaN(dollars) || dollars <= 0) return 0;
    return Math.round(dollars * 10);
  }

  async function getMyTokenBalance() {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) return null;
      const data = await res.json();
      return Math.floor(data.tokens || 0);
    } catch (e) {
      return null;
    }
  }

  function scanSkins() {
    const cards = document.querySelectorAll('.mantine-Card-root');
    const result = [];
    for (const card of cards) {
      let priceStr = null;
      const nameParts = [];
      for (const el of card.querySelectorAll('p, span')) {
        const t = el.textContent?.trim() || '';
        if (!t || t.length > 100) continue;
        if (t.includes('$')) {
          if (!priceStr) priceStr = t;
        } else if (!/^\d[\d.]*$/.test(t) && t !== 'Not checked yet' && t.length > 1) {
          if (!nameParts.includes(t)) nameParts.push(t);
        }
      }
      if (!priceStr) {
        const badge = card.querySelector('[class*="Badge"]');
        const bt = badge?.textContent?.trim() || '';
        if (bt.includes('$')) priceStr = bt;
      }
      if (nameParts.length === 0) continue;
      const name   = nameParts.join(' ').replace(/\s+/g, ' ').trim();
      const tokens = priceToTokens(priceStr);
      result.push({ name, priceStr: priceStr || '', tokens });
    }
    return result;
  }

  function calcTotal(skins) {
    let total = 0;
    for (const s of skins) { if (s.tokens > 0) total += s.tokens; }
    return total;
  }

  function skinsHash(skins) {
    return JSON.stringify(skins.map(s => `${s.name}|${s.priceStr}`).sort());
  }

  async function setReactInputValue(input, value) {
    input.focus();
    await sleep(100);
    input.select();
    document.execCommand('selectAll');
    document.execCommand('delete');
    await sleep(100);
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    const str = String(value);
    const inserted = document.execCommand('insertText', false, str);
    if (!inserted || input.value !== str) {
      nativeSetter.call(input, str);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: str, inputType: 'insertText' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await sleep(100);
  }

  async function withdrawTokens() {
    if (currentTokens <= 0) return;
    const addBtn = findBtn('Add Tokens', true);
    if (addBtn) {
      addBtn.click();
      await sleep(1200);
      const wBtn = findBtn('Withdraw', true);
      if (wBtn) {
        wBtn.click();
        await sleep(800);
        currentTokens = 0;
        return;
      }
      closeModal();
      await sleep(500);
    }
    const wBtn2 = findBtn('Withdraw');
    if (wBtn2) {
      wBtn2.click();
      await sleep(800);
    }
    currentTokens = 0;
  }

  async function addTokensUI(amount) {
    const addBtn = findBtn('Add Tokens', true);
    if (!addBtn) return false;
    addBtn.click();
    await sleep(1500);

    let tokenInput = null;
    const modalSelectors = [
      '.mantine-Modal-content input',
      '.mantine-Modal-body input',
      '[role="dialog"] input',
      '.mantine-Overlay-root input',
    ];
    for (const sel of modalSelectors) {
      const inp = document.querySelector(sel);
      if (inp) { tokenInput = inp; break; }
    }
    if (!tokenInput) {
      for (const inp of document.querySelectorAll('input')) {
        const rect = inp.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { tokenInput = inp; break; }
      }
    }
    if (!tokenInput) { closeModal(); return false; }

    await setReactInputValue(tokenInput, amount);
    await sleep(300);
    if (tokenInput.value !== String(amount)) {
      await setReactInputValue(tokenInput, amount);
      await sleep(300);
    }

    const depositBtn = findBtn('Deposit', true);
    if (depositBtn) {
      depositBtn.click();
    } else {
      tokenInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }

    await sleep(1200);
    closeModal();
    await sleep(500);

    currentTokens = amount;
    return true;
  }

  async function acceptTrade() {
    for (let i = 0; i < 10; i++) {
      const cbs = document.querySelectorAll('input[type="checkbox"]');
      if (cbs.length > 0) { cbs[0].click(); return true; }
      await sleep(500);
    }
    return false;
  }

  async function processSkinsChange(skins) {
    const expectedTotal = calcTotal(skins);
    const expectedHash  = skinsHash(skins);

    if (currentTokens > 0) {
      await withdrawTokens();
      await sleep(600);
    }

    if (expectedTotal === 0) return;

    const balance = await getMyTokenBalance();
    if (balance === null) return;

    if (balance < expectedTotal) {
      return;
    }

    const ok = await addTokensUI(expectedTotal);
    if (!ok) return;
    await sleep(400);

    const currentSkins = scanSkins();
    const currentHash  = skinsHash(currentSkins);
    const currentTotal = calcTotal(currentSkins);

    if (currentHash !== expectedHash || currentTotal !== expectedTotal) {
      await withdrawTokens();
      await sleep(400);
      lastSkinsHash = '';
      return;
    }

    await acceptTrade();
  }

  async function scanAndUpdate() {
    if (!activeTrade || busy) return;

    const skins = scanSkins();
    const hash  = skinsHash(skins);
    if (hash === lastSkinsHash) return;
    lastSkinsHash = hash;

    busy = true;
    scanCount++;

    if (skins.length === 0) {
      if (currentTokens > 0) await withdrawTokens();
      busy = false;
      return;
    }

    await processSkinsChange(skins);
    busy = false;
  }

  function startScanner() {
    if (skinScanner) return;
    scanCount = 0; lastSkinsHash = ''; currentTokens = 0;
    skinScanner = setInterval(scanAndUpdate, SCAN_MS);
    setTimeout(scanAndUpdate, 600);
  }

  function stopScanner() {
    if (skinScanner) { clearInterval(skinScanner); skinScanner = null; }
  }

  function checkTradePage() {
    const m = window.location.pathname.match(/\/trading\/([0-9a-f]{24})/i);
    if (m) {
      if (!activeTrade) {
        activeTrade = m[1]; currentTokens = 0; lastSkinsHash = '';
      }
      if (!skinScanner) startScanner();
    } else {
      if (skinScanner) { stopScanner(); activeTrade = null; }
    }
  }

  checkTradePage();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(checkTradePage, 800); }
  }).observe(document, { subtree: true, childList: true });
})();