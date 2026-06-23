// ==UserScript==
// @name         Plinko Unlimited Balls
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Bypasses the Plinko ball limit
// @author       ZSB
// @match        https://case-clicker.com/game/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Plinko Hijack v8] Script active. Ready to call internal functions.');

    const PROXY_ID = 'plinko-proxy-button-v8';

    const getRealButton = () => {
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
            const label = button.querySelector('span');
            if (label && label.textContent.trim() === 'Bet') {
                return button;
            }
        }
        return null;
    };

    const getReactClickHandler = (button) => {
        if (!button) return null;
        const reactPropsKey = Object.keys(button).find(key => key.startsWith('__reactProps$'));

        if (reactPropsKey && button[reactPropsKey] && typeof button[reactPropsKey].onClick === 'function') {
            return button[reactPropsKey].onClick;
        }
        return null;
    };
    const manageProxyButton = () => {
        const realButton = getRealButton();
        let proxyButton = document.getElementById(PROXY_ID);

        if (realButton) {
            if (!proxyButton) {
                console.log('[Plinko Hijack v8] Real button located. Creating proxy and preparing to hijack onClick function.');
                proxyButton = document.createElement('button');
                proxyButton.id = PROXY_ID;
                document.body.appendChild(proxyButton);

                proxyButton.addEventListener('click', () => {
                    const latestRealButton = getRealButton();
                    const clickHandler = getReactClickHandler(latestRealButton);

                    if (clickHandler) {
                        console.log('[Plinko Hijack v8] Proxy clicked! Executing internal onClick function directly.');
                        clickHandler();
                    } else {
                        console.error('[Plinko Hijack v8] Could not find the internal onClick function. The website may have updated.');
                    }
                });
            }

            const rect = realButton.getBoundingClientRect();
            Object.assign(proxyButton.style, {
                position: 'fixed',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                zIndex: '99999',
                opacity: '0',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer'
            });

        } else if (proxyButton) {
            proxyButton.remove();
        }
    };

    const observer = new MutationObserver(manageProxyButton);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(manageProxyButton, 1000);
})();