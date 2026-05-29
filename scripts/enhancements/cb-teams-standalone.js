// ==UserScript==
// @name         CB teams v9
// @namespace    cco script
// @version      v9
// @description  displays some neat information about team cbs
// @run-at       document-start
// @author       ZSB
// @match        https://case-clicker.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=case-clicker.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log('[CB Teams Script] v32 Loaded. Waiting for page content...');
    const resultInsertionTargetXPath = '//*[@id="__next"]/div/main/div[2]/div[1]/p[2]';
    const crazyModeCheckXPath = '//*[@id="__next"]/div/main/div[2]/div[3]/p[1]';
    const playerImageContainerXPathBase = '//*[@id="__next"]/div/main/div[3]/div/div';
    const playerValueContainerXPathBase = '//*[@id="__next"]/div/main/div[5]/div/div';
    const defaultPlayerImage = 'https://i.imgur.com/w6RcB0C.png';

    let previousRoundHash = null;
    let debounceTimeout;

    const evaluateXPath = (xpath) => document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const evaluateXPathSingle = (xpath) => document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const formatCurrency = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const extractValueInCents = (text) => {
        if (!text) return null;
        const match = text.match(/\$?([\d,]+(\.\d{1,2})?)/);
        if (!match || !match[1]) return null;
        return Math.round(parseFloat(match[1].replace(/,/g, '')) * 100);
    };

    async function runCalculations() {
        const playerSlots = evaluateXPath(playerValueContainerXPathBase + '[not(self::style)]');
        const numPlayers = playerSlots.snapshotLength;
        if (![4, 6].includes(numPlayers)) return;

        const playerValuesCents = [];
        const playerImages = [];

        for (let i = 0; i < numPlayers; i++) {
            const valueXPath = `${playerValueContainerXPathBase}[${i + 1}]/div/a/div/p`;
            const imageXPath = `${playerImageContainerXPathBase}[${i + 1}]/div/div[1]/div[1]/a/div/img`;
            const valueEl = evaluateXPathSingle(valueXPath);
            const imageEl = evaluateXPathSingle(imageXPath);
            if (!valueEl || !valueEl.textContent) return;
            const valueCents = extractValueInCents(valueEl.textContent);
            if (valueCents === null) return;
            playerValuesCents.push(valueCents);
            playerImages.push(imageEl ? imageEl.src : defaultPlayerImage);
        }

        const roundHash = playerValuesCents.join(';');
        if (roundHash === previousRoundHash) return;

        console.log('[CB Teams Script] New data found! Updating display.');
        previousRoundHash = roundHash;

        const midIndex = numPlayers / 2;
        const teamACents = playerValuesCents.slice(0, midIndex);
        const teamBCents = playerValuesCents.slice(midIndex);
        displayTotals(teamACents, teamBCents, playerImages);
    }

    const colorCodePlayer = (percentage, teamPercentages) => {
        if (!teamPercentages || teamPercentages.length <= 1) return '#2ee071';
        const maxP = Math.max(...teamPercentages);
        const minP = Math.min(...teamPercentages);
        if (percentage.toFixed(1) === maxP.toFixed(1)) return '#2ee071';
        if (percentage.toFixed(1) === minP.toFixed(1)) return '#f74a5c';
        return '#fcc63d';
    };

    function displayTotals(teamACents, teamBCents, playerImages) {
        const targetElement = evaluateXPathSingle(resultInsertionTargetXPath);
        if (!targetElement) return;

        let resultContainer = document.getElementById('team-value-sums');
        if (!resultContainer) {
            resultContainer = document.createElement('div');
            resultContainer.id = 'team-value-sums';
            Object.assign(resultContainer.style, {
                padding: '14px',
                fontFamily: `sans-serif`,
                backgroundColor: 'rgb(30, 31, 38)',
                color: '#EAEAEA',
                borderRadius: '10px',
                marginTop: '12px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
            });
            targetElement.parentNode.insertBefore(resultContainer, targetElement.nextSibling);
        }

        const teamASumCents = teamACents.reduce((a, b) => a + b, 0);
        const teamBSumCents = teamBCents.reduce((a, b) => a + b, 0);
        const teamASumDollars = teamASumCents / 100;
        const teamBSumDollars = teamBSumCents / 100;
        const crazyModeEl = evaluateXPathSingle(crazyModeCheckXPath);
        const isCrazyMode = crazyModeEl && crazyModeEl.textContent.includes('Crazy');
        const normalWinColor = '#2ee071';
        const normalLossColor = 'inherit';
        const crazyWinColor = '#2ee071';
        const crazyLossColor = '#f74a5c';

        let teamATotalDisplayColor;
        let teamBTotalDisplayColor;

        if (teamASumDollars === teamBSumDollars) {
            teamATotalDisplayColor = 'inherit';
            teamBTotalDisplayColor = 'inherit';
        } else if (isCrazyMode) {
            if (teamASumDollars < teamBSumDollars) {
                teamATotalDisplayColor = crazyWinColor;
                teamBTotalDisplayColor = crazyLossColor;
            } else {
                teamATotalDisplayColor = crazyLossColor;
                teamBTotalDisplayColor = crazyWinColor;
            }
        } else {
            if (teamASumDollars > teamBSumDollars) {
                teamATotalDisplayColor = normalWinColor;
                teamBTotalDisplayColor = normalLossColor;
            } else {
                teamATotalDisplayColor = normalLossColor;
                teamBTotalDisplayColor = normalWinColor;
            }
        }

        const blueColor = '#483d8b';
        const redColor = '#8b0000';
        const calculatePercentages = (cents, sumCents) => (sumCents > 0 ? cents.map(v => (v / sumCents) * 100) : cents.map(() => 0));
        const teamAPercentages = calculatePercentages(teamACents, teamASumCents);
        const teamBPercentages = calculatePercentages(teamBCents, teamBSumCents);
        const createPlayerList = (percentages, allTeamPercentages, images, startIndex) => {
            return percentages.map((p, i) => {
                const imageSrc = images[startIndex + i] || defaultPlayerImage;
                const color = colorCodePlayer(p, allTeamPercentages);
                return `<div style="display: inline-flex; align-items: center; margin: 2px 5px;">
                          <img src="${imageSrc}" alt="P" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 5px; border: 1px solid rgba(255,255,255,0.1);">
                          <strong style="color: ${color}; font-size: 0.9em; font-weight: 600;">${p.toFixed(1)}%</strong>
                        </div>`;
            }).join('');
        };

        const totalValueDollars = teamASumDollars + teamBSumDollars;
        const numPlayers = playerImages.length;
        const divisor = numPlayers === 4 ? 2 : (numPlayers === 6 ? 3 : 1);
        const potentialWinValueDollars = totalValueDollars / divisor;
        const teamDollarDifference = Math.abs(teamASumDollars - teamBSumDollars);
        const teamBlockStyle = 'background-color: rgba(0, 0, 0, 0.15); border: 1px solid rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 8px;';

        resultContainer.innerHTML = `
            <!-- Blue Team -->
            <div style="${teamBlockStyle} margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                    <strong style="color: ${blueColor}; font-size: 1.1em; font-weight: 700;">Blue Team</strong>
                    <strong style="color: ${teamATotalDisplayColor}; font-size: 1.3em; font-weight: 700;">${formatCurrency(teamASumDollars)}</strong>
                </div>
                <div style="text-align: center; background: rgba(0,0,0,0.2); padding: 5px 0; border-radius: 8px;">${createPlayerList(teamAPercentages, teamAPercentages, playerImages, 0)}</div>
            </div>

            <!-- Red Team -->
            <div style="${teamBlockStyle}">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                    <strong style="color: ${redColor}; font-size: 1.1em; font-weight: 700;">Red Team</strong>
                    <strong style="color: ${teamBTotalDisplayColor}; font-size: 1.3em; font-weight: 700;">${formatCurrency(teamBSumDollars)}</strong>
                </div>
                <div style="text-align: center; background: rgba(0,0,0,0.2); padding: 5px 0; border-radius: 8px;">${createPlayerList(teamBPercentages, teamBPercentages, playerImages, teamAPercentages.length)}</div>
            </div>

            <!-- Summary Bar -->
            <!-- FIX: Switched to CSS Grid for robust, non-overlapping columns -->
            <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 16px; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center;">
                <div>
                    <div style="font-size: 0.8em; color: #8899a6; margin-bottom: 3px; font-weight: 500;">TOTAL POT</div>
                    <div style="font-size: 1.15em; font-weight: 700; color: #EAEAEA;">${formatCurrency(totalValueDollars)}</div>
                </div>
                <div>
                    <div style="font-size: 0.8em; color: #8899a6; margin-bottom: 3px; font-weight: 500;">$ DIFF</div>
                    <div style="font-size: 1.15em; font-weight: 700; color: ${teamASumDollars > teamBSumDollars ? blueColor : redColor};">${formatCurrency(teamDollarDifference)}</div>
                </div>
                <div>
                    <div style="font-size: 0.8em; color: #8899a6; margin-bottom: 3px; font-weight: 500;">WIN VALUE</div>
                    <div style="font-size: 1.15em; font-weight: 700; color: #2ee071;">${formatCurrency(potentialWinValueDollars)}</div>
                </div>
            </div>`;
    }

    function initialize() {
        console.log('[CB Teams Script] Target element found! Initializing debounced observer.');
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(runCalculations, 250);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        runCalculations();
    }

    function waitForElement(xpath, callback) {
        const interval = setInterval(() => {
            if (evaluateXPathSingle(xpath)) {
                clearInterval(interval);
                callback();
            }
        }, 250);
    }

    waitForElement(resultInsertionTargetXPath, initialize);
})();