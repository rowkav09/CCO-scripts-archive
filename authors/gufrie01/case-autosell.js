// ==UserScript==
// @name         Sell All Cases
// @version      1.0.69
// @description  Sells all your cases with the click of a button.
// @author       gufrie01
// @match        https://case-clicker.com/cases/cases*
// @grant        GM_addStyle
// @connect      self
// ==/UserScript==

(function() {
    'use strict';

    // ================================================================================= //
    // --- ⚙️ CONFIGURATION ⚙️ ---
    // ================================================================================= //

    const API_CASES_ENDPOINT = '/api/cases';
    const DATA_KEYS = { id: '_id', amount: 'amount' };

    // The maximum number of times to retry selling a single item if it fails.
    const MAX_RETRIES = 7;

    // This should be longer than the normal delay to give the server time to recover.
    const RETRY_DELAY = 5000;

    // The normal delay between each DIFFERENT item request to be nice to the server.
    const DELAY_BETWEEN_REQUESTS = 1000;

    const sellButton = document.createElement('button');
    sellButton.id = 'gemini-sell-button';
    sellButton.innerHTML = 'Sell All Cases';
    document.body.appendChild(sellButton);
    GM_addStyle(`#gemini-sell-button{position:fixed;bottom:20px;right:20px;z-index:9999;padding:12px 20px;background-color:#4CAF50;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.2);transition:all .2s ease-in-out}#gemini-sell-button:hover{background-color:#45a049;transform:translateY(-2px)}#gemini-sell-button:disabled{background-color:#555;cursor:not-allowed;transform:none}`);

    const startSellingSequence = async () => {
        sellButton.disabled = true;
        sellButton.textContent = 'Fetching cases...';
        try {
            console.log(`Fetching case list from ${API_CASES_ENDPOINT}`);
            const response = await fetch(API_CASES_ENDPOINT);
            if (!response.ok) throw new Error(`API GET Error: ${response.status} ${response.statusText}`);
            const data = await response.json();
            let casesToSell = [];
            if (Array.isArray(data)) {
                casesToSell = data.map(item => ({ id: item[DATA_KEYS.id], amount: item[DATA_KEYS.amount] })).filter(c => c.amount > 0 && c.id);
            } else if (typeof data === 'object' && data !== null) {
                casesToSell = Object.keys(data).map(id => ({ id: id, amount: data[id] })).filter(c => c.amount > 0 && c.id);
            }
            if (casesToSell.length === 0) {
                sellButton.textContent = 'No valid cases found!';
                setTimeout(() => { sellButton.disabled = false; sellButton.innerHTML = 'Sell All Cases'; }, 4000);
                return;
            }
            const totalCaseCount = casesToSell.reduce((sum, c) => (sum + c.amount), 0);
            console.log(`Found ${casesToSell.length} case types, with a total of ${totalCaseCount} items to sell.`);
            const report = await sellItemsViaFetch(casesToSell, totalCaseCount);
            sellButton.textContent = `Done! Sold: ${report.success}, Failed: ${report.failed}`;
            console.log('--- FINAL REPORT ---');
            console.log(`Successfully sold ${report.success} types of cases.`);
            console.log(`Failed to sell ${report.failed} types of cases.`);
        } catch (error) {
            sellButton.textContent = 'Fatal Error! Check Console.';
            console.error('--- AWESOME SAUCE FATAL ERROR ---', error);
        } finally {
            setTimeout(() => { sellButton.disabled = false; sellButton.innerHTML = 'Sell All Cases'; }, 10000);
        }
    };

    const sellItemsViaFetch = async (cases, totalAmount) => {
        console.log(`Starting to sell ${cases.length} types of cases with smart retries.`);
        let soldSoFar = 0;
        let successCount = 0;
        let failedCount = 0;

        for (const caseItem of cases) {
            let attempts = 0;
            let soldSuccessfully = false;

            while (attempts < MAX_RETRIES && !soldSuccessfully) {
                attempts++;
                try {
                    if (!caseItem.id) throw new Error("Item has no ID");

                    const payload = { id: caseItem.id, type: "case", amount: caseItem.amount };
                    const progressText = `Selling ${caseItem.amount} of ${caseItem.id}...`;
                    console.log(`Attempt ${attempts}/${MAX_RETRIES}: ${progressText}`, 'Payload:', payload);
                    sellButton.textContent = `Selling... (${soldSoFar}/${totalAmount})`;

                    const response = await fetch(API_CASES_ENDPOINT, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        throw new Error(`Server responded with ${response.status}. Body: ${errorBody}`);
                    }

                    console.log(`SUCCESS: Sold ${caseItem.id}. Server response:`, await response.text());
                    soldSoFar += caseItem.amount;
                    soldSuccessfully = true;
                    successCount++;

                } catch (error) {
                    const errorMessage = error.message;
                    console.error(`Attempt ${attempts}/${MAX_RETRIES} FAILED for ${caseItem.id}. Reason: ${errorMessage}`);

                    // --- NEW SMART RETRY LOGIC ---
                    // If the error is because the case doesn't exist, we stop retrying for this specific item.
                    if (errorMessage.includes('"error":"No case found"')) {
                        console.warn(`Server says case ${caseItem.id} is invalid. Skipping permanently.`);
                        attempts = MAX_RETRIES; // Force the loop to end for this item.
                    }
                    // --- END SMART RETRY LOGIC ---

                    if (attempts < MAX_RETRIES) {
                        console.log(`Waiting ${RETRY_DELAY / 1000}s before retrying...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    }
                }
            }

            if (!soldSuccessfully) {
                console.error(`GIVING UP on item ${caseItem.id} after ${attempts} attempt(s).`);
                failedCount++;
            }

            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }

        console.log('All selling attempts are complete.');
        return { success: successCount, failed: failedCount };
    };

    sellButton.addEventListener('click', startSellingSequence);

})();