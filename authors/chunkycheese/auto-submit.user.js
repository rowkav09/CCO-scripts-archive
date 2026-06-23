// ==UserScript==
// @name         Auto Submit
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  auto buy, open, submit and redeem skin collections
// @author       chunkycheese
// @match        https://case-clicker.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const uiContainer = document.createElement('div');
    const currentText = document.createElement('button');
    const actionButton = document.createElement('button');

    //const hash = 'SvZ462lYDI8Z4WvZSINEM';
    const hash = window.__NEXT_DATA__.buildId;

    let caseOpenCount;

    let delay = 100;

    //Use these to change default positioning on page load
    const topDist = '12px';
    const rightDist = '830px';

    //let collection;

    function setupUI() {
        uiContainer.style.position = 'fixed';
        uiContainer.style.top = topDist;
        uiContainer.style.right = rightDist;
        uiContainer.style.background = 'linear-gradient(120deg, #0ca678, #1c754d, #0ca678)';
        uiContainer.style.borderRadius = '10px';
        uiContainer.style.zIndex = 10000;
        uiContainer.style.color = '#25262b';
        uiContainer.style.fontFamily = 'Arial, sans-serif';
        uiContainer.style.maxWidth = '128px';
        uiContainer.style.minWidth = '128px';

        currentText.textContent = 'Current';
        currentText.style.display = 'block';
        currentText.style.width = 'calc(100% - 20px)';
        currentText.style.margin = '10px';
        currentText.style.padding = '4px';
        currentText.style.backgroundColor = 'transparent';
        currentText.style.color = 'white';
        currentText.style.border = 'none';
        currentText.style.borderRadius = '5px';
        currentText.style.fontWeight = 'bold';
        currentText.style.fontSize = '12px';

        actionButton.textContent = 'Submit';
        actionButton.style.display = 'block';
        actionButton.style.width = 'calc(100% - 20px)';
        actionButton.style.margin = '10px';
        actionButton.style.padding = '4px';
        actionButton.style.backgroundColor = 'rgba(0,0,0,0.2)';
        actionButton.style.color = 'white';
        actionButton.style.border = 'none';
        actionButton.style.borderRadius = '5px';
        actionButton.style.cursor = 'pointer';
        actionButton.style.fontWeight = 'bold';
        actionButton.style.fontSize = '12px';
        actionButton.style.transition = 'background-color 0.2s';
        actionButton.onmouseover = () => { actionButton.style.backgroundColor = 'rgba(0,0,0,0.3)'; };
        actionButton.onmouseout = () => { actionButton.style.backgroundColor = 'rgba(0,0,0,0.2)'; };

        uiContainer.appendChild(currentText);
        uiContainer.appendChild(actionButton);
        document.body.appendChild(uiContainer);
    }

    async function submitSkins(collection) {
        let locked = false;
        do {
            try {
                const res = await fetch('https://case-clicker.com/api/skinCollection', {
                    method: 'POST',
                    body: JSON.stringify({id:'all',collection}),
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (data.error === 'You are locked currently. Try again.') {
                    locked = true;
                } else if (data.error === 'Here') {
                    return true;
                } else {
                    locked = false;
                }
            } catch (err) {

            }
            await new Promise(r => setTimeout(r, delay));
        } while (locked);
        locked = false;
        do {
            try {
                const res = await fetch('https://case-clicker.com/api/skinCollection', {
                    method: 'PATCH',
                    body: JSON.stringify({collectionName:collection}),
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if(data.error === 'You are locked currently. Try again.'){
                    locked = true;
                } else if (data.error === 'You are still missing skins in this collection') {
                    actionButton.textContent = 'Incomplete';
                    return false;
                } else {
                    return true;
                }
            } catch (err) {

            }
            await new Promise(r => setTimeout(r, delay));
        } while (locked);
        return false;
    }

    async function buyCases(id, name) {
        const type = name.includes('Collection') ? 'collectionCase' : 'case';
        let locked = true;
        do {
            try {
                const res = await fetch("https://case-clicker.com/api/cases", {
                    credentials: "include",
                    headers: { "Content-Type": "application/json", "Accept": "*/*" },
                    body: JSON.stringify({amount:500, id, type}),
                    method: "POST",
                    mode: "cors"
                });

                const data = await res.json();

                if (data.error === "User is locked.") {
                    locked = true;
                     await new Promise(r => setTimeout(r, 150));
                } else {
                    locked = false;
                    actionButton.textContent = 'Purchased';
                }
            } catch (err) {

            }
        }while(locked);
        return true;
    }

    async function openCases(id, name) {
        const type = name.includes('Collection') ? 'collectionCase' : 'case';
        let locked = true;
        let caseCount = 500;
        while (caseCount > caseOpenCount) {
            do {
                try {
                    const res = await fetch(`https://case-clicker.com/api/open/${type}`, {
                        credentials: "include",
                        headers: { "Content-Type": "application/json", "Accept": "*/*" },
                        body: JSON.stringify({id,quickOpen:true,count:`${caseOpenCount}`,useEventTickets:false,caseOpenMultiplier:"1",
                                              autoOpenConfig:{
                                                  autosellActivated:false,autosellAmount:500,autosellVariant:"money",favoriteHighFloats:true,favoriteLowFloats:true,
                                                   favoritePatterns:true,customHighFloat:0.999999,customLowFloat:0.000001,customSelectedFloats:[],favoriteCustomFloats:true
                                              }
                                             }),
                        method: "POST",
                        mode: "cors"
                    });

                    const data = await res.json();

                    if (data.error === "User is locked.") {
                        locked = true;
                        await new Promise(r => setTimeout(r, 50));
                     } else {
                         locked = false;
                         caseCount = caseCount - caseOpenCount;
                     }
                } catch (err) {
                    await new Promise(r => setTimeout(r, 100));
                }
             }while(locked);
        }
        actionButton.textContent = 'Opened';
        return true;
    }

    async function sellAll() {
        let locked = false;
        do {
            try {
                const res = await fetch(`/api/inventory`, {
                    method: "DELETE",
                    body: JSON.stringify({type: "price", value: 1000, currency: "money"}),
                    headers: { "Content-Type": "application/json" },
                });
                if(res.status !== 200){
                    locked = true;
                } else {
                    locked = false;
                }
            } catch (err) {

            }
            await new Promise(r => setTimeout(r, 500));
        } while (locked);
    }

    async function start() {
        getOpenCount();
        const ids = await setupIds();
        for (const id of ids) {
            currentText.textContent = id.name;
            const submitTest = await submitSkins(id.name);
            if (!submitTest) {
                while (true) {
                    const buy = await buyCases(id._id, id.name);
                    const open = await openCases(id._id, id.name);
                    const submit = await submitSkins(id.name);
                    const sell = await sellAll();
                    if (submit) {
                        actionButton.textContent = 'Complete';
                        await new Promise(r => setTimeout(r, 500));
                        break;
                    }
                }
            }
        }
    }

    async function setupIds(type = 'cases') {
        const url = `/_next/data/${hash}/en/cases/${type}.json`;
        let locked = false;
        let data;
        do {
            try {
                const res = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });
                if (res.status !== 200) {
                    locked = true;
                    await new Promise(r => setTimeout(r, 333));
                } else {
                    data = await res.json();
                    locked = false;
                }
            } catch (err) {
                locked = true;
                await new Promise(r => setTimeout(r, 333));
            }
        } while (locked);
        if (type === 'cases') {
            const casedata = JSON.parse(data.pageProps.cases);
            const cases = casedata.filter(s => !s.isNonBuyable).map(s => ({
                _id: s._id,
                name: s.name,
            }));
            //console.log('Mapped:', cases);
            const collections = await setupIds('collections');
            //console.log('Stats:', cases.concat(collections));
            return cases.concat(collections);
        } else {
            const colldata = JSON.parse(data.pageProps.cases);
            const coll = colldata.filter(s => !s.isNonBuyable).map(s => ({
                _id: s._id,
                name: s.name,
            }));
            return coll;
        }
    }

    async function getOpenCount() {
        let locked = false;
        do {
            try {
                const res = await fetch(`/api/me`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                });
                if(res.status !== 200){
                    locked = true;
                } else {
                    const data = await res.json();
                    caseOpenCount = data.caseOpenCount;
                    locked = false;
                }
            } catch (err) {

            }
            await new Promise(r => setTimeout(r, 200));
        } while (locked);
    }

    window.addEventListener('load', () => {
        setupUI();
        actionButton.addEventListener('click', () => {
            start();
        });

    });
})();