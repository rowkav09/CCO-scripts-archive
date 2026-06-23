// ==UserScript==
// @name        trade token buttons
// @description 1M 5M 10M 100M buttons when you are adding tokens
// @namespace   QoL
// @version     1.0
// @match       https://case-clicker.com/*
// @author      Zhiro
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(function () {
  'use strict';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const state = { sum: 0 };

  async function setVal(input, value) {
    input.focus();
    await sleep(100);
    input.select();
    document.execCommand('selectAll');
    document.execCommand('delete');
    await sleep(100);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    const str = String(value);
    const ok = document.execCommand('insertText', false, str);
    if (!ok || input.value !== str) {
      setter.call(input, str);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: str, inputType: 'insertText' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await sleep(100);
  }

  function makeAmountBtn(inp, label, val) {
    const b = document.createElement('button');
    b.textContent = '+' + label;
    b.style.cssText = 'background:#2b6cb0;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer';
    b.onclick = async function () { state.sum += val; await setVal(inp, state.sum); };
    return b;
  }

  function isTokenModal(modal) {
    for (const b of modal.querySelectorAll('button')) {
      const t = b.textContent?.trim();
      if (t === 'Withdraw' || t === 'Deposit') return true;
    }
    return false;
  }

  function inject(modal) {
    state.sum = 0;
    const inp = modal.querySelector('input');
    if (!inp) return;

    const bar = document.createElement('div');
    bar.id = 'tok-bar';
    bar.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';

    bar.appendChild(makeAmountBtn(inp, '1M', 1e6));
    bar.appendChild(makeAmountBtn(inp, '5M', 5e6));
    bar.appendChild(makeAmountBtn(inp, '10M', 1e7));
    bar.appendChild(makeAmountBtn(inp, '100M', 1e8));

    const clr = document.createElement('button');
    clr.textContent = 'Clear';
    clr.style.cssText = 'background:#744210;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer';
    clr.onclick = async function () { state.sum = 0; await setVal(inp, 0); };
    bar.appendChild(clr);

    inp.parentElement.after(bar);
  }

  new MutationObserver(function () {
    const modal = document.querySelector('.mantine-Modal-content, .mantine-Modal-body, [role="dialog"]');
    if (!modal) { state.sum = 0; return; }
    if (modal.querySelector('#tok-bar')) return;
    if (!isTokenModal(modal)) return;
    inject(modal);
  }).observe(document.body, { subtree: true, childList: true });
})();