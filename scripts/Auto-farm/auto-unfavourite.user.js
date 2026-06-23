// ==UserScript==
// @name         Auto unfavorite
// @namespace    :3
// @version      1.0
// @description  snipe them faves cuh
// @author       ZSB
// @match        https://case-clicker.com/*
// @grant        none
// @icon
// ==/UserScript==

(function () {
    'use strict';

    let isEnabled = false;
    const clickedElements = new Set();
    const simulateMouseClick = (element) => {
        const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        element.dispatchEvent(mouseEvent);
        console.log('Simulated click on element:', element);
    };
    const isYellow = (element) => {
        return element.style.color === 'yellow';
    };
    const clickTargetElement = () => {
        if (!isEnabled) return;
        console.log('Searching for target elements...');
        const svgElements = document.querySelectorAll('svg[style="color: yellow;"]');
        if (!svgElements.length) {
            console.warn('No matching SVG elements found.');
        }
        svgElements.forEach(svg => {
            const clickableParent = svg.closest('[onclick], button, a, .clickable');
            if (clickableParent && typeof clickableParent.click === 'function') {
                if (!clickedElements.has(clickableParent) && isYellow(svg)) {
                    clickedElements.add(clickableParent);
                    clickableParent.click();
                    console.log('Clicked parent element:', clickableParent);
                } else {
                    console.log('Skipping element, already clicked or not yellow:', clickableParent);
                }
            } else {
                console.warn('No clickable parent found:', clickableParent);
            }
        });
    };
    const createToggleButton = () => {
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Enable Script';
        toggleButton.style.position = 'fixed';
        toggleButton.style.bottom = '10px';
        toggleButton.style.right = '10px';
        toggleButton.style.zIndex = '1000';
        toggleButton.style.padding = '10px';
        toggleButton.style.backgroundColor = '#007BFF';
        toggleButton.style.color = '#FFFFFF';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.addEventListener('click', () => {
            isEnabled = !isEnabled;
            toggleButton.textContent = isEnabled ? 'Disable Script' : 'Enable Script';
            console.log(`Script ${isEnabled ? 'enabled' : 'disabled'}`);
        });
        document.body.appendChild(toggleButton);
    };
    clickTargetElement();
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                clickTargetElement();
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    createToggleButton();
})();