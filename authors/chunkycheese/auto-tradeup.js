// ==UserScript==
// @name         Auto Tradeup
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  tradeup automation
// @author       chunkycheese
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    var pageTotal = 1;

    const topDist = '21px';
    const rightDist = '50px';

    const container = document.createElement('div');
    const uiMainHeader = document.createElement('div');
    const outcome = document.createElement('output');
    const tradeupContainer = document.createElement('div');

    let index;
    let minF = 0.0;
    let maxF = 1.0;
    let rare = "Classified";
    let origin = "";
    let fav = "none";
    let stat = false;
    let event = "None";
    let high = false;
    let run = false;
    let lastResult;
    let lastFloat;

    function setupUI() {
        container.style.position = 'fixed';
        container.style.top = topDist;
        container.style.right = rightDist;
        container.style.borderRadius = '10px';
        container.style.zIndex = 10000;
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.minWidth = '330px';
        container.style.maxWidth = '330px';

        let pos = 0.0;
        let step = 0.5;
        const waveInterval = setInterval(() => {
            pos = (pos + step) % 360;
            container.style.background = `conic-gradient(from ${pos}deg, #666666, #888888, #888888, #666666, #666666, #888888, #888888, #666666, #666666, #888888, #888888, #666666,
            #666666, #888888, #888888, #666666, #666666, #888888, #888888, #666666, #666666, #888888, #888888, #666666, #666666, #888888, #888888, #666666)`;
        }, 50);

        uiMainHeader.style.display = 'flex';
        uiMainHeader.style.alignItems = 'center';
        uiMainHeader.style.justifyContent = 'center';
        uiMainHeader.style.padding = '10px';
        uiMainHeader.style.cursor = 'move';
        uiMainHeader.style.backgroundColor = 'transparent';
        uiMainHeader.style.borderRadius = '10px';

        const minimiseMainButton = document.createElement('button');
        minimiseMainButton.textContent = 'Skins';
        minimiseMainButton.style.background = 'transparent';
        minimiseMainButton.style.color = 'black';
        minimiseMainButton.style.fontSize = '20px';
        minimiseMainButton.style.border = 'none';
        minimiseMainButton.style.cursor = 'pointer';
        minimiseMainButton.style.fontWeight = 'bold';

        uiMainHeader.appendChild(minimiseMainButton);

        let names = [];
        let countCheck = true;

        function updateTotal() {
            const total = names.reduce((sum, n) => sum + n.count, 0);
            if(total != 10) {
                countCheck = false;
            }else{
                countCheck = true;
            }
        }

        function createNameInput(index) {
            let debounceNames;
            let debounceCount;
            const wrapper = document.createElement("div");
            styleElem(wrapper);
            wrapper.style.display = "flex";
            wrapper.style.gap = "5px";
            wrapper.style.alignItems = "center";

            const nameInput = document.createElement("input");
            nameInput.style.backgroundColor = 'transparent';
            nameInput.type = "text";
            nameInput.placeholder = "Name (default no name)";
            nameInput.style.width = "200px";
            nameInput.value = names[index].name || "";
            nameInput.addEventListener("input", () => {
                clearTimeout(debounceNames);
                debounceNames = setTimeout(() => {
                    names[index].name = nameInput.value.trim().toLowerCase();
                    updateTotal();
                }, 500);
            });
            const countInput = document.createElement("input");
            countInput.style.backgroundColor = 'rgba(1, 28, 51, 0.5)';
            countInput.type = "number";
            countInput.min = "0";
            countInput.max = "10";
            countInput.placeholder = "Count";
            countInput.style.width = "60px";
            countInput.value = names[index].count || 0;
            countInput.addEventListener("input", () => {
                clearTimeout(debounceCount);
                debounceCount = setTimeout(() => {
                    const val = parseInt(countInput.value) || 0;
                    names[index].count = val;
                    updateTotal();
                }, 500);
            });
            const removeBtn = document.createElement("button");
            removeBtn.textContent = "✖";
            removeBtn.style.cursor = "pointer";
            removeBtn.style.background = "red";
            removeBtn.style.color = "white";
            removeBtn.style.border = "none";
            removeBtn.style.borderRadius = "4px";
            removeBtn.style.padding = "2px 6px";
            removeBtn.addEventListener("click", () => {
                names.splice(index, 1);
                render();
            });

            wrapper.appendChild(nameInput);
            wrapper.appendChild(countInput);
            wrapper.appendChild(removeBtn);
            return wrapper;
        }

        const namesContainer = document.createElement('div');
        namesContainer.style.justifyContent = 'center';
        tradeupContainer.appendChild(namesContainer);

        function render() {
            namesContainer.innerHTML = "";
            names.forEach((_, i) => namesContainer.appendChild(createNameInput(i)));
            namesContainer.appendChild(addButton);
        }

        const addButton = document.createElement("button");
        styleElem(addButton);
        addButton.style.backgroundColor = 'green';
        addButton.style.width = 'calc(40px)';
        addButton.style.cursor = 'pointer';
        addButton.textContent = "+";
        addButton.addEventListener("click", () => {
            names.push({ name: "", count: 0 });
            render();
        });

        names.push({ name: "", count: 10 });
        render();

        const minimumFloatInput = document.createElement('input');
        styleElem(minimumFloatInput);
        let check;
        let debounceExt;
        minimumFloatInput.type = 'text';
        minimumFloatInput.placeholder = 'Minimum float (default 0)';
        minimumFloatInput.addEventListener('input', () => {
            clearTimeout(debounceExt);
            debounceExt = setTimeout(() => {
                check = parseFloat(minimumFloatInput.value);
                if(check < 0 || check > 1){
                    minF = 0.0;
                } else {
                    minF = check;
                }
            }, 1000);
        });
        tradeupContainer.appendChild(minimumFloatInput);

        const maximumFloatInput = document.createElement('input');
        styleElem(maximumFloatInput);
        let checker;
        let debounceMax;
        maximumFloatInput.type = 'text';
        maximumFloatInput.placeholder = 'Maximum float (default 1)';
        maximumFloatInput.addEventListener('input', () => {
            clearTimeout(debounceMax);
            debounceMax = setTimeout(() => {
                checker = parseFloat(maximumFloatInput.value);
                if(checker < 0 || checker > 1){
                    maxF = 1.0;
                } else {
                    maxF = checker;
                }
            }, 1000);
        });
        tradeupContainer.appendChild(maximumFloatInput);

        const raritySelector = document.createElement('select');
        const raresFull = ["Classified", "Restricted", "Mil-Spec Grade", "Industrial Grade", "Consumer Grade"];

        raritySelector.style.display = 'block';
        raritySelector.style.width = 'calc(100% - 20px)';
        raritySelector.style.margin = '10px';
        raritySelector.style.padding = '8px';
        raritySelector.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        raritySelector.style.color = 'rgba(200, 200, 200, 1)';
        raritySelector.style.border = 'none';
        raritySelector.style.borderRadius = '5px';

        raritySelector.addEventListener('change', () => {
            rare = raritySelector.value;
        });

        for (let i = 0; i < raresFull.length; i++) {
            const option = document.createElement('option');
            option.value = raresFull[i];
            option.textContent = raresFull[i];
            raritySelector.appendChild(option);
        }
        tradeupContainer.appendChild(raritySelector);

        const collection = document.createElement('input');
        styleElem(collection);
        let debounceOrigin;
        collection.type = 'text';
        collection.placeholder = 'Collection';
        collection.value = origin || "";
        collection.addEventListener('input', () => {
            clearTimeout(debounceOrigin);
            debounceOrigin = setTimeout(() => {
                origin = collection.value.trim();
                console.log("Origin Value:", origin);
            }, 1000);
        });
        tradeupContainer.appendChild(collection);

        const optionsContainer1 = document.createElement('div');
        styleElem(optionsContainer1);
        const optionsContainer2 = document.createElement('div');
        styleElem(optionsContainer2);

        const favLabel = document.createElement('label');
        favLabel.textContent = 'Use Favorites';
        favLabel.style.cursor = 'pointer';
        const favInput = document.createElement('input');
        favInput.type = 'checkbox';
        favInput.style.marginLeft = '5px';
        favInput.addEventListener('change', () => {
            fav = favInput.checked ? "any" : "none";
        });
        favLabel.appendChild(favInput);
        optionsContainer1.appendChild(favLabel);

        const eventLabel = document.createElement('label');
        eventLabel.textContent = 'Use Event Skins';
        eventLabel.style.cursor = 'pointer';
        const eventInput = document.createElement('input');
        eventInput.type = 'checkbox';
        eventInput.style.marginLeft = '5px';
        eventInput.addEventListener('change', () => {
            event = eventInput.checked ? "" : "None";
        });
        eventLabel.appendChild(eventInput);
        optionsContainer1.appendChild(eventLabel);

        const statLabel = document.createElement('label');
        statLabel.textContent = 'Stattrack';
        statLabel.style.cursor = 'pointer';
        const statInput = document.createElement('input');
        statInput.type = 'checkbox';
        statInput.style.marginLeft = '5px';
        statInput.addEventListener('change', () => {
            stat = statInput.checked ? true : false;
        });
        statLabel.appendChild(statInput);
        optionsContainer2.appendChild(statLabel);

        const highLabel = document.createElement('label');
        highLabel.textContent = 'High Float';
        highLabel.style.cursor = 'pointer';
        const highInput = document.createElement('input');
        highInput.type = 'checkbox';
        highInput.style.marginLeft = '5px';
        highInput.addEventListener('change', () => {
            high = highInput.checked ? true : false;
        });
        highLabel.appendChild(highInput);
        optionsContainer2.appendChild(highLabel);

        tradeupContainer.appendChild(optionsContainer1);
        tradeupContainer.appendChild(optionsContainer2);

        const outcomeBody = document.createElement('div');
        styleElem(outcomeBody);
        outcome.style.whiteSpace = 'pre-line';
        outcome.textContent = "Last Result";
        outcomeBody.appendChild(outcome);
        tradeupContainer.appendChild(outcomeBody);

        let debounceRun;
        const start = document.createElement('button');
        styleElem(start);
        start.style.backgroundColor = 'black';
        start.style.cursor = 'pointer';
        start.textContent = 'Tradeup';
        start.addEventListener('click', () => {
            clearTimeout(debounceRun);
            debounceRun = setTimeout(() => {
                if(countCheck === true){
                    run = !run;
                    run ? sendRequest({names}) : null;
                    start.textContent = run ? 'Stop Tradeup' : 'Tradeup';
                }else{
                    alert("Total count is not 10");
            }
            }, 1000);
        });
        tradeupContainer.appendChild(start);

        function styleElem(elem, block = true) {
            if (block) {
                elem.style.display = 'block';
            }
            elem.style.width = 'calc(100% - 20px)';
            elem.style.margin = '10px';
            elem.style.padding = '8px';
            elem.style.backgroundColor = 'rgba(1, 28, 51, 0.5)';
            elem.style.color = 'white';
            elem.style.border = 'none';
            elem.style.borderRadius = '5px';
        }

        container.appendChild(uiMainHeader);
        container.appendChild(tradeupContainer);
        document.body.appendChild(container);

        let isMinimised = true;
        let savedStyles = minimiseUI(container, isMinimised, null, true);

        minimiseMainButton.addEventListener('click', () => {
            isMinimised = !isMinimised;
            savedStyles = minimiseUI(container, isMinimised, savedStyles, true);
        });
    }

    async function getSkin({name, needed, pageNum} = {}) {
        const onlyStat = stat ? 'Only ST' : 'Non ST';
        const url = `/api/inventory?page=${pageNum}&sort=float&search=${encodeURIComponent(name)}&favoriteSkinsFilter=${fav}&exterior=${encodeURIComponent("")}&rarity=${encodeURIComponent(rare)}&statTrakSouvenir=${encodeURIComponent(onlyStat)}&eventName=${event}&showStickers=false&showUpgradedSkins=true`;

        const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        let data = await res.json();
        pageTotal = data.pages;
        if(needed === 0) return;

        let items;
        if(origin != ""){
            const skinNames = await findNames();
            items = (data.skins || []).filter(s => s.statTrak === stat && !s.souvenir && !s.knifeType && !s.hasPattern && skinNames.some(name => s.name.includes(name)) && s.float >= minF && s.float <= maxF);
        }else{
            items = (data.skins || []).filter(s => s.statTrak === stat && !s.souvenir && !s.knifeType && !s.hasPattern && s.float >= minF && s.float <= maxF);
        }

        if(high){
            return items.slice(items.length - needed, items.length).map(s => s._id);
        }else{
            return items.slice(0, needed).map(s => s._id);
        }
    }

    async function findNames() {
        const build = window.__NEXT_DATA__?.buildId;
        if (!build) {
            alert('Failed to get build ID — please refresh the page and try again.');
            throw new Error('Could not get buildId');
        }
        const hasCollection = origin.includes("Collection");
        const type = hasCollection ? 'collections' : 'cases';
        const joinedOrigin = origin.replaceAll(" ", "+");
        const url = `/_next/data/${encodeURIComponent(build)}/en/cases/${type}/${encodeURIComponent(origin)}.json?cases=${type}&caseName=${joinedOrigin}`;
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
        const skins = JSON.parse(data.pageProps.skins);
        const skinNames = skins.filter(skin => skin.rarity === rare).map(skin => skin.name);
        return skinNames;
    }

    async function sendRequest(args={}){
        const{names = []} = args;
        //console.log("hi");

        while (run) {
            let tradeIds = [];
            let finalCount = 0;
            for (const{name, count} of names){
                let ids;
                let needed;
                finalCount = finalCount + count;
                let currentPage = 1;

                while(tradeIds.length < finalCount && currentPage <= pageTotal && high === false && run){
                    needed = finalCount - tradeIds.length;
                    ids = await getSkin({name, needed, pageNum: currentPage});
                    tradeIds = tradeIds.concat(ids);
                    currentPage++;
                }
                if(high === true){
                    await getSkin({name, needed: 0, pageNum: 1});
                    currentPage = pageTotal;
                    while(tradeIds.length < finalCount && currentPage > 0 && run){
                        //console.log("called");
                        needed = finalCount - tradeIds.length;
                        ids = await getSkin({name, needed, pageNum: currentPage});
                        tradeIds = tradeIds.concat(ids);
                        //console.log("Yippee");
                        currentPage--;
                    }
                }
            }
            if (tradeIds.length < 10) {
                break;
            }
            const skinIds = [...tradeIds];
            const doTradeup = await tradeup(skinIds);
        }
    }

    async function tradeup(skinIds) {
        while (true) {
            try {
                const res = await fetch("https://case-clicker.com/api/tradeup", {
                    credentials: "include",
                    headers: { "Content-Type": "application/json", "Accept": "*/*" },
                    body: JSON.stringify({skinIds}),
                    method: "POST",
                    mode: "cors"
                });

                const data = await res.json();

                if (data.error === "Skins could not be traded up" || data.error === "User is locked.") {
                    updateResult(data.error, false);
                    await new Promise(r => setTimeout(r, 50));
                } else if (data.error){
                    updateResult(data.error, false);
                    return false;
                } else {
                    updateResult(data);
                    return true;
                }
            } catch (err) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    function updateResult(result, success = true) {
        if (!success) {
            outcome.textContent = result;
        } else {
            lastResult = result.name;
            lastFloat = result.float;
            outcome.textContent = `${lastResult}\n${lastFloat}`;
        }
    }

    function minimiseUI(box, mini, styles = null, main = false) {
        mini ? styles = {
            top: box.style.top,
            right: box.style.right,
            height: main ? box.style.height : null,
            width: main ? box.style.minWidth : null,
            padding: main ? box.children[0].style.padding : null,
            font: main ? box.children[0].children[0].style.fontSize : null
        } : styles;
        if (main) {
            if (mini) {
                box.style.top = topDist;
                box.style.right = rightDist;
                box.style.height = '21px';
                box.style.minWidth = '50px';
                box.children[0].style.padding = '0px';
                box.children[0].children[0].style.fontSize = '12px';
            } else{
                box.style.top = styles.top;
                box.style.right = styles.right;
                box.style.height = styles.height;
                box.style.minWidth = styles.width;
                box.children[0].style.padding = styles.padding;
                box.children[0].children[0].style.fontSize = styles.font;
            }
            for (let i = 1; i < box.children.length; i++) {
                box.children[i].style.display = mini ? 'none' : '';
            }
        } else {
           for (let i = 0; i < box.children.length; i++) {
                box.children[i].style.display = mini ? 'none' : '';
            }
        }
        return styles;
    }

    function makeDraggable(element, handle) {
        let startX = 0, startY = 0;
        let startRight = 0, startTop = 0;

        element.style.position = 'fixed';

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();

            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            startRight = viewportWidth - rect.right;
            startTop = rect.top;

            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            element.style.right = (startRight - dx) + 'px';
            element.style.top = (startTop + dy) + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    window.addEventListener('load', () => {
        setupUI();
        makeDraggable(container, uiMainHeader);
    });
})();