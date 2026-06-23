// ==UserScript==
// @name         Dlore upgrade button v2
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  dragon lore button
// @author       ZSB
// @match        https://case-clicker.com/game/upgrade
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let attempts = 0;
    let successes = 0;
    let failures = 0;

    const uiContainer = document.createElement('div');
    const uiHeader = document.createElement('div');
    const statsContainer = document.createElement('div');
    const attemptsDisplay = createStatLine('Attempts', '0');
    const successesDisplay = createStatLine('Success', '0');
    const failuresDisplay = createStatLine('Fails', '0');
    const lastResultDisplay = document.createElement('div');
    const actionButton = document.createElement('button');

    function setupUI() {

        uiContainer.style.position = 'fixed';
        uiContainer.style.top = '150px';
        uiContainer.style.right = '50px';
        uiContainer.style.backgroundColor = '#2c3e50';
        uiContainer.style.border = '1px solid #34495e';
        uiContainer.style.borderRadius = '10px';
        uiContainer.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        uiContainer.style.zIndex = 10000;
        uiContainer.style.color = '#ecf0f1';
        uiContainer.style.fontFamily = 'Arial, sans-serif';
        uiContainer.style.minWidth = '220px';

        uiHeader.textContent = 'Dlore Upgrader';
        uiHeader.style.padding = '10px';
        uiHeader.style.cursor = 'move';
        uiHeader.style.backgroundColor = '#34495e';
        uiHeader.style.borderTopLeftRadius = '10px';
        uiHeader.style.borderTopRightRadius = '10px';
        uiHeader.style.borderBottom = '1px solid #2c3e50';
        uiHeader.style.textAlign = 'center';
        uiHeader.style.fontWeight = 'bold';

        statsContainer.style.padding = '10px';
        statsContainer.style.display = 'grid';
        statsContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
        statsContainer.style.gap = '5px';
        statsContainer.style.textAlign = 'center';
        lastResultDisplay.textContent = 'Ready...';
        lastResultDisplay.style.padding = '5px 10px';
        lastResultDisplay.style.margin = '0 10px';
        lastResultDisplay.style.borderRadius = '5px';
        lastResultDisplay.style.textAlign = 'center';
        lastResultDisplay.style.fontWeight = 'bold';
        lastResultDisplay.style.transition = 'background-color 0.3s ease';
        lastResultDisplay.style.backgroundColor = '#34495e';
        actionButton.textContent = 'Send Upgrade Request';
        actionButton.style.display = 'block';
        actionButton.style.width = 'calc(100% - 20px)';
        actionButton.style.margin = '10px';
        actionButton.style.padding = '12px';
        actionButton.style.backgroundColor = '#27ae60';
        actionButton.style.color = 'white';
        actionButton.style.border = 'none';
        actionButton.style.borderRadius = '5px';
        actionButton.style.cursor = 'pointer';
        actionButton.style.fontWeight = 'bold';
        actionButton.style.fontSize = '14px';
        actionButton.style.transition = 'background-color 0.2s';
        actionButton.onmouseover = () => { actionButton.style.backgroundColor = '#2ecc71'; };
        actionButton.onmouseout = () => { actionButton.style.backgroundColor = '#27ae60'; };

        statsContainer.appendChild(attemptsDisplay.container);
        statsContainer.appendChild(successesDisplay.container);
        statsContainer.appendChild(failuresDisplay.container);
        uiContainer.appendChild(uiHeader);
        uiContainer.appendChild(statsContainer);
        uiContainer.appendChild(lastResultDisplay);
        uiContainer.appendChild(actionButton);
        document.body.appendChild(uiContainer);
    }

    function createStatLine(label, value) {
        const container = document.createElement('div');
        const labelSpan = document.createElement('span');
        const valueSpan = document.createElement('span');
        container.style.backgroundColor = '#34495e';
        container.style.padding = '5px';
        container.style.borderRadius = '5px';
        labelSpan.textContent = label;
        labelSpan.style.display = 'block';
        labelSpan.style.fontSize = '12px';
        labelSpan.style.color = '#bdc3c7';
        valueSpan.textContent = value;
        valueSpan.style.display = 'block';
        valueSpan.style.fontSize = '16px';
        valueSpan.style.fontWeight = 'bold';
        container.appendChild(labelSpan);
        container.appendChild(valueSpan);
        return { container, valueSpan };
    }

    function updateStats() {
        attemptsDisplay.valueSpan.textContent = attempts;
        successesDisplay.valueSpan.textContent = successes;
        failuresDisplay.valueSpan.textContent = failures;
    }

    function handleResult(isSuccess) {
        attempts++;
        if (isSuccess) {
            successes++;
            lastResultDisplay.textContent = 'SUCCESS!';
            lastResultDisplay.style.backgroundColor = '#28a745';
        } else {
            failures++;
            lastResultDisplay.textContent = 'FAILED';
            lastResultDisplay.style.backgroundColor = '#dc3545';
        }
        updateStats();
    }

    function sendRequest() {
        lastResultDisplay.textContent = 'Sending...';
        lastResultDisplay.style.backgroundColor = '#f39c12';
        fetch("https://case-clicker.com/api/casino/upgrade", {
            credentials: "include",
            headers: { "Content-Type": "application/json", "Accept": "*/*" },
            referrer: "https://case-clicker.com/game/upgrade",
            body: JSON.stringify({
                userSkinReq: null, userTokensReq: 5000000,
                upgradeSkinReq: { _id: "6353e5c6167322ae1095edf7", name: "Souvenir AWP | Dragon Lore (Factory New)", classId: "1242384628", iconUrl: "-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FAR17P7NdTRH-t26q4SZlvD7PYTQgXtu5Mx2gv2P9o6migzl_Us5ZmCmLYDDJgU9NA6B81S5yezvg8e-7cycnXJgvHZx5WGdwUJqz1Tl4g", type: "Weapon", weaponType: "Sniper Rifle", gunType: "AWP", knifeType: null, exterior: "Factory New", rarity: "Covert", rarityColor: "eb4b4b", price: 500000, souvenir: true, __v: 0, isNonObtainable: false }
            }),
            method: "POST", mode: "cors"
        })
        .then(res => res.json())
        .then(data => { handleResult(data.result); })
        .catch(err => {
            console.error("Upgrade failed:", err);
            lastResultDisplay.textContent = 'ERROR';
            lastResultDisplay.style.backgroundColor = '#e74c3c';
            failures++;
            updateStats();
        });
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let isPositionedByLeft = false;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            if (!isPositionedByLeft) {
                const rect = element.getBoundingClientRect();
                element.style.left = rect.left + 'px';
                element.style.right = 'auto';
                isPositionedByLeft = true;
            }

            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    window.addEventListener('load', () => {
        setupUI();
        makeDraggable(uiContainer, uiHeader);
        actionButton.addEventListener('click', sendRequest);
    });

})();