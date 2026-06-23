// ==UserScript==
// @name         CCO Games - Client Core v3
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Core script for cco casino
// @author       ZSB
// @match        *://*.case-clicker.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      mines.zsb-2bc.workers.dev
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';

    // Prevent re-injection
    if (unsafeWindow.CCO_PLUGIN_SYSTEM && unsafeWindow.CCO_PLUGIN_SYSTEM.isCoreInitialized) {
        return;
    }

    GM_addStyle(`
        .floating-panel { position: fixed; z-index: 10000; min-width: 340px; max-width: 90vw; min-height: 100px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; font-family: 'Segoe UI', sans-serif; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); color: #f4dfff; backdrop-filter: blur(10px); background: rgba(26, 21, 39, 0.85); }
        .floating-panel.minimized { display: none !important; }
        .panel-header { padding: 12px 16px; background: rgba(255, 255, 255, 0.1); font-weight: bold; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .panel-header-text { cursor: move; flex-grow: 1; user-select: none; }
        .panel-minimize-button { cursor: pointer; font-weight: bold; font-size: 1.2em; user-select: none; }
        .panel-content { flex-grow: 1; overflow-y: auto; }
        .panel-content-inner { padding: 15px; }
        .panel-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize; background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%); }
        .client-btn, .client-input, .client-select { width: 100%; padding: 10px; margin-bottom: 10px; box-sizing: border-box; background: linear-gradient(145deg, #4A3763, #2C1D3D); border: 1px solid #7a5a9b; color: #f4dfff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-weight: bold; border-radius: 4px; transition: all 0.2s ease-in-out; }
        .client-btn { cursor: pointer; }
        .client-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 0 15px 2px rgba(121, 202, 255, 0.5), 0 4px 8px rgba(0,0,0,0.4); filter: brightness(1.1); }
        .client-btn:disabled { background: #4f545c; color: #99aab5; cursor: not-allowed; filter: grayscale(50%); }
        .client-btn.cashout-active { background: linear-gradient(145deg, #2d7d46, #1e522e) !important; border-color: #58f28a !important; }
        .client-btn.secondary { filter: grayscale(30%); }
        .client-btn.danger { background: linear-gradient(145deg, #7d2d2d, #521e1e); border-color: #f25858; }
        .client-label { display: block; margin-bottom: 5px; color: #bba8d1; font-size: 0.9em; }
        .control-group { margin-bottom: 15px; }
        hr.client-hr { border: none; border-top: 1px solid #40444b; margin: 20px 0; }
        details > summary { cursor: pointer; font-weight: bold; padding: 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.05); transition: background-color 0.2s; }
        details > summary:hover { background: rgba(255, 255, 255, 0.1); }
        details[open] > summary { margin-bottom: 10px; }
        .script-toolbar-button { display: inline-flex; align-items: center; justify-content: center; height: 30px; padding: 0 16px; font-size: var(--mantine-font-size-sm); margin-left: calc(1rem * var(--mantine-scale)) !important; border-radius: var(--mantine-radius-sm); cursor: pointer; background: linear-gradient(145deg, #4A3763, #2C1D3D); border: 1px solid #7a5a9b; color: #f4dfff; font-weight: bold; }
        .script-toolbar-button span { margin-left: 8px; }
        #primary-balance-container, #balance-display { color: #43b581; font-weight: bold; }
        #balance-display { font-size: 1.5em; }
        #transaction-message-area, .auth-message { text-align: center; font-weight: bold; min-height: 20px; padding: 8px; border-radius: 4px; word-break: break-all; margin-top: 10px; }
        .auth-message.error { color: #f04747; }
        #sticky-header-info-wrapper { display: flex; align-items: center; opacity: 0; transform: scale(0.8); transition: opacity 0.3s, transform 0.3s; pointer-events: none; }
        #sticky-header-info-wrapper.visible { opacity: 1; transform: scale(1); }
        #sticky-wager-req-display { color: #f04747; font-weight: bold; font-size: 1.1em; margin-right: 15px; display: none; }
        #sticky-balance-display { color: #43b581; font-weight: bold; font-size: 1.1em; }
        #wager-req-container { color: #f04747; font-size: 0.9em; text-align: center; margin-top: -5px; margin-bottom: 10px; font-weight: bold; display: none; }
    `);

    const existingPlugins = (unsafeWindow.CCO_PLUGIN_SYSTEM && unsafeWindow.CCO_PLUGIN_SYSTEM.plugins) || [];
    const MAX_BET = 1000000;

    function applyNumberFormatting(inputElement, max = null) {
        const formatValue = () => {
            let rawValue = inputElement.value.replace(/[^0-9]/g, '');
            if (rawValue === '') {
                inputElement.value = '';
                return;
            }
            let num = parseInt(rawValue, 10);
            if (max !== null && num > max) {
                num = max;
            }
            const formatted = num.toLocaleString('en-US');
            if (inputElement.value !== formatted) {
                inputElement.value = formatted;
            }
        };
        inputElement.addEventListener('input', formatValue);
        inputElement.addEventListener('blur', formatValue);
    }

    unsafeWindow.CCO_PLUGIN_SYSTEM = {
        isCoreInitialized: true,
        plugins: existingPlugins,
        registerPlugin: function(plugin) {
            console.log(`%cCCO Core: Plugin script loaded -> ${plugin.name}`, "color: #58F28A");
            this.plugins.push(plugin);
        },
        api: {
            request: (endpoint, options) => new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'POST',
                    url: `https://mines.zsb-2bc.workers.dev${endpoint}`,
                    headers: options.headers || { 'Content-Type': 'application/json' },
                    data: options.body ? JSON.stringify(options.body) : null,
                    onload: res => {
                        try {
                            const json = JSON.parse(res.responseText);
                            if (res.status >= 200 && res.status < 300) {
                                resolve(json);
                            } else {
                                reject(json);
                            }
                        } catch (e) {
                            reject({ message: `HTTP ${res.status}: Invalid JSON response.` });
                        }
                    },
                    onerror: () => reject({ message: 'Network error.' })
                });
            })
        },
        ui: {
            mainContentArea: null,
            updateBalance: (newBalance, wagerRequirement = -1) => {
                unsafeWindow.CCO_PLUGIN_SYSTEM.state.currentBalance = newBalance;
                const formattedBalance = newBalance.toLocaleString();
                document.getElementById('balance-display').textContent = formattedBalance;
                document.getElementById('sticky-balance-display').textContent = formattedBalance;

                if (wagerRequirement > -1) {
                    const wagerContainer = document.getElementById('wager-req-container');
                    const stickyWagerDisplay = document.getElementById('sticky-wager-req-display');
                    if (wagerRequirement > 0) {
                        const formattedWager = wagerRequirement.toLocaleString();
                        wagerContainer.querySelector('#wager-req-display').textContent = formattedWager;
                        stickyWagerDisplay.textContent = `${formattedWager} Wager`;
                        wagerContainer.style.display = 'block';
                        stickyWagerDisplay.style.display = 'inline';
                    } else {
                        wagerContainer.style.display = 'none';
                        stickyWagerDisplay.style.display = 'none';
                    }
                }
            },
            addSection: (title, htmlContent) => {
                if (!unsafeWindow.CCO_PLUGIN_SYSTEM.ui.mainContentArea) return;
                const details = document.createElement('details');
                details.innerHTML = `<summary>${title}</summary><div class="control-group">${htmlContent}</div>`;
                unsafeWindow.CCO_PLUGIN_SYSTEM.ui.mainContentArea.appendChild(details);
                const hr = document.createElement('hr');
                hr.className = 'client-hr';
                unsafeWindow.CCO_PLUGIN_SYSTEM.ui.mainContentArea.appendChild(hr);
            },
            applyBetFormatting: (element) => applyNumberFormatting(element, MAX_BET)
        },
        state: {
            currentUserUID: null,
            currentBalance: 0,
            isTransactionPending: false
        }
    };

    const SYSTEM = unsafeWindow.CCO_PLUGIN_SYSTEM;

    function initCore() {
        const AUTH_FORM_HTML = `
            <div id="uid-step">
                <h3>Account Login</h3>
                <div class="control-group">
                    <label class="client-label" for="uid-input">CCO UID</label>
                    <input type="text" id="uid-input" class="client-input" autocomplete="username">
                </div>
                <button id="uid-continue-btn" class="client-btn">Continue</button>
                <div id="uid-message" class="auth-message"></div>
            </div>
            <div id="password-step" style="display: none;">
                <h3>Enter Password</h3>
                <div class="control-group">
                    <label class="client-label" for="password-input">Password</label>
                    <input type="password" id="password-input" class="client-input" autocomplete="current-password">
                </div>
                <button id="login-btn" class="client-btn">Login</button>
                <div id="password-message" class="auth-message"></div>
            </div>
            <div id="verify-step" style="display: none;">
                <h3>First-Time User Verification</h3>
                <p style="font-size: 0.9em; color: #bba8d1;">To prove you own this account, copy the code below and paste it into your CCO profile description.</p>
                <div class="control-group">
                    <label class="client-label">Your Verification Code</label>
                    <input type="text" id="verification-code-input" class="client-input" readonly onclick="this.select()">
                </div>
                <div class="control-group">
                    <label class="client-label">Create Game Password (min 4 characters)</label>
                    <input type="password" id="new-password-input" class="client-input" autocomplete="new-password">
                </div>
                <button id="verify-btn" class="client-btn">Verify & Set Password</button>
                <div id="verify-message" class="auth-message"></div>
            </div>`;

        const MONEY_MGMT_HTML = `
            <div id="account-management-section" style="padding-top: 15px;">
                <div class="control-group">
                    <label class="client-label" for="deposit-trade-link-input">Deposit via CCO Trade Link</label>
                    <input type="text" id="deposit-trade-link-input" class="client-input" placeholder="Paste your trade link...">
                </div>
                <div class="control-group">
                    <label class="client-label" for="bonus-code-input">Bonus Code (Optional)</label>
                    <input type="text" id="bonus-code-input" class="client-input" placeholder="e.g., WELCOME10" style="text-transform: uppercase;">
                </div>
                <button id="deposit-btn" class="client-btn">Submit Deposit</button>
                <hr class="client-hr">
                <div class="control-group">
                    <label class="client-label" for="withdraw-amount-input">Withdraw Tokens</label>
                    <input type="text" inputmode="numeric" id="withdraw-amount-input" class="client-input" placeholder="e.g., 1,000">
                    <button id="withdraw-btn" class="client-btn">Submit Withdrawal</button>
                </div>
                <div id="transaction-message-area" class="auth-message" style="background: rgba(0,0,0,0.2);"></div>
                <button id="check-withdrawal-btn" class="client-btn secondary" style="margin-top: 10px;">Check for Active Withdrawal</button>
                <button id="sign-out-btn" class="client-btn danger" style="margin-top: 15px;">Sign Out</button>
            </div>`;

        const PANEL_HTML = `
            <div id="auth-container">${AUTH_FORM_HTML}</div>
            <div id="main-client-section" style="display: none;">
                <h2 id="primary-balance-container" style="text-align: center; margin-top: 0;">Tokens: <span id="balance-display">--</span></h2>
                <div id="wager-req-container">Wager Requirement: <span id="wager-req-display">0</span></div>
                <hr class="client-hr">
                <details open>
                    <summary>💼 Money Management</summary>
                    ${MONEY_MGMT_HTML}
                </details>
                <hr class="client-hr">
                <div id="game-plugins-container"></div>
                <button id="load-plugins-btn" class="client-btn secondary" style="margin-top: 15px;">🔄️ Load Game Modules</button>
            </div>`;

        createDraggablePanel('cco-client-panel', 'CCO Games Client', PANEL_HTML, { top: '80px', left: '50px' });
        SYSTEM.ui.mainContentArea = document.getElementById('game-plugins-container');

        const showMainClient = (balance, wagerRequirement) => {
            GM_setValue('lastLoggedInUID', SYSTEM.state.currentUserUID);
            SYSTEM.ui.updateBalance(balance, wagerRequirement);
            const authContainer = document.getElementById('auth-container');
            authContainer.innerHTML = '';
            authContainer.style.display = 'none';
            document.getElementById('main-client-section').style.display = 'block';
        };

        const setupAuthEventListeners = () => {
            const lastUID = GM_getValue('lastLoggedInUID', null);
            const uidInput = document.getElementById('uid-input');
            if (uidInput && lastUID) {
                uidInput.value = lastUID;
            }
            document.getElementById('uid-continue-btn')?.addEventListener('click', handleUidContinue);
            document.getElementById('login-btn')?.addEventListener('click', handleLogin);
            document.getElementById('verify-btn')?.addEventListener('click', handleVerify);
        };

        function initializePlugins() {
            const loadBtn = document.getElementById('load-plugins-btn');
            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';

            console.log(`%cCCO Core: Initializing ${SYSTEM.plugins.length} game plugins...`, "color: #79CAFF");

            SYSTEM.plugins.forEach(plugin => {
                if (typeof plugin.init === 'function' && !plugin.initialized) {
                    try {
                        // *** THIS IS THE CORRECTED LINE ***
                        plugin.init(SYSTEM); // Pass the entire SYSTEM object to the module
                        // **********************************
                        console.log(`%cCCO Core: Successfully initialized plugin -> ${plugin.name}`, "color: #58F28A");
                    } catch (e) {
                        console.error(`%cCCO Core: Failed to initialize plugin ${plugin.name}:`, "color: #F04747", e);
                    }
                }
            });

            loadBtn.textContent = '✅ Modules Loaded';
            console.log("%cCCO Core: All plugins processed.", "color: #79CAFF; font-weight: bold;");
        }

        const pollForJobCompletion = (jobId, jobType) => {
            let hasShownWithdrawLink = false;
            setTransactionMessage(jobType === 'deposit' ? 'Waiting for bot to confirm deposit...' : 'Waiting for bot to create withdrawal trade...');
            const interval = setInterval(async () => {
                try {
                    const data = await SYSTEM.api.request(`/api/job-status/${jobId}`, { method: 'GET' });
                    if (data.status === 'complete') {
                        clearInterval(interval);
                        setFinancialLock(false);
                        if (data.result === 'success' && data.balance !== null) {
                            SYSTEM.ui.updateBalance(data.balance, data.wager_requirement);
                            setTransactionMessage(data.message || (jobType === 'deposit' ? `Deposit successful!` : `Withdrawal complete!`));
                        } else {
                            setTransactionMessage('Transaction failed or was cancelled.');
                            if (data.balance !== null) {
                                SYSTEM.ui.updateBalance(data.balance, data.wager_requirement);
                            }
                        }
                        return;
                    }
                    if (jobType === 'withdrawal' && data.tradeLink && !hasShownWithdrawLink) {
                        hasShownWithdrawLink = true;
                        setTransactionMessage('Withdrawal ready! Copy link: <br><input type="text" class="client-input" value="' + data.tradeLink + '" readonly onclick="this.select()" style="margin-top: 10px;">', true);
                    } else if (!hasShownWithdrawLink) {
                        document.getElementById('transaction-message-area').textContent += '.';
                    }
                } catch (e) {
                    clearInterval(interval);
                    setFinancialLock(false);
                    setTransactionMessage('Error checking job status.');
                }
            }, 3000);
        };

        const pollForVerificationResult = (jobId) => {
            const verifyMessage = document.getElementById('verify-message');
            const verifyBtn = document.getElementById('verify-btn');
            verifyMessage.textContent = 'Waiting for bot to check your profile...';
            const interval = setInterval(async () => {
                try {
                    const data = await SYSTEM.api.request(`/api/job-status/${jobId}`, { method: 'GET' });
                    if (data.status === 'complete') {
                        clearInterval(interval);
                        if (data.result === 'success') {
                            verifyMessage.textContent = 'Verification successful! Logging in...';
                            setTimeout(() => showMainClient(data.balance, data.wager_requirement), 1500);
                        } else {
                            verifyMessage.textContent = 'Verification failed. Please ensure the code is in your profile and try again.';
                            verifyBtn.disabled = false;
                        }
                    } else {
                        verifyMessage.textContent += '.';
                    }
                } catch (e) {
                    clearInterval(interval);
                    verifyMessage.textContent = 'Error checking status.';
                    verifyBtn.disabled = false;
                }
            }, 3000);
        };

        async function handleUidContinue() {
            const uidInput = document.getElementById('uid-input');
            const uidMessage = document.getElementById('uid-message');
            const uid = uidInput.value.trim();
            if (!uid) {
                uidMessage.textContent = "UID cannot be empty.";
                return;
            }
            SYSTEM.state.currentUserUID = uid;
            uidMessage.textContent = 'Checking...';
            try {
                const data = await SYSTEM.api.request('/api/login', { body: { uid } });
                if (data.status === 'password_required') {
                    document.getElementById('uid-step').style.display = 'none';
                    document.getElementById('password-step').style.display = 'block';
                } else if (data.status === 'verification_required') {
                    document.getElementById('uid-step').style.display = 'none';
                    document.getElementById('verify-step').style.display = 'block';
                    document.getElementById('verification-code-input').value = data.verificationCode;
                }
            } catch (error) {
                uidMessage.textContent = `Error: ${error.message}`;
            }
        }

        async function handleLogin() {
            const passwordInput = document.getElementById('password-input');
            const passwordMessage = document.getElementById('password-message');
            const password = passwordInput.value;
            if (!password) {
                passwordMessage.textContent = 'Password cannot be empty.';
                return;
            }
            passwordMessage.textContent = 'Logging in...';
            try {
                const data = await SYSTEM.api.request('/api/login', { body: { uid: SYSTEM.state.currentUserUID, password } });
                if (data.success) {
                    showMainClient(data.balance, data.wager_requirement);
                } else {
                    passwordMessage.textContent = `Login Failed: ${data.message || 'Incorrect password.'}`;
                }
            } catch (error) {
                passwordMessage.textContent = `Login Failed: ${error.message}`;
            }
        }

        async function handleVerify() {
            const newPasswordInput = document.getElementById('new-password-input');
            const verifyMessage = document.getElementById('verify-message');
            const verifyBtn = document.getElementById('verify-btn');
            const password = newPasswordInput.value;
            if (password.length < 4) {
                verifyMessage.textContent = 'Password must be at least 4 characters.';
                return;
            }
            verifyMessage.textContent = 'Submitting verification request...';
            verifyBtn.disabled = true;
            try {
                const data = await SYSTEM.api.request('/api/initiate-verification', { body: { uid: SYSTEM.state.currentUserUID, password } });
                pollForVerificationResult(data.jobId);
            } catch (error) {
                verifyMessage.textContent = `Error: ${error.message}`;
                verifyBtn.disabled = false;
            }
        }

        const handleSignOut = () => {
            const lastUsedUID = document.getElementById('uid-input')?.value || '';
            document.getElementById('main-client-section').style.display = 'none';
            const authContainer = document.getElementById('auth-container');
            authContainer.innerHTML = AUTH_FORM_HTML;
            authContainer.style.display = 'block';
            setupAuthEventListeners();
            document.getElementById('uid-input').value = lastUsedUID;
            document.getElementById('uid-message').textContent = 'Signed out successfully.';
            SYSTEM.ui.mainContentArea.innerHTML = '';
            document.getElementById('wager-req-container').style.display = 'none';
            document.getElementById('sticky-wager-req-display').style.display = 'none';
            const loadBtn = document.getElementById('load-plugins-btn');
            loadBtn.disabled = false;
            loadBtn.textContent = '🔄️ Load Game Modules';
            SYSTEM.plugins.forEach(p => p.initialized = false);
            GM_setValue('lastLoggedInUID', null);
        };

        async function handleDeposit() {
            const tradeLinkInput = document.getElementById('deposit-trade-link-input');
            const bonusCodeInput = document.getElementById('bonus-code-input');
            const link = tradeLinkInput.value.trim();
            const bonusCode = bonusCodeInput.value.trim();
            if (!link.startsWith('https://case-clicker.com/trading/')) {
                setTransactionMessage('Please enter a valid CCO trade link.');
                return;
            }
            setFinancialLock(true);
            try {
                const data = await SYSTEM.api.request('/api/deposit', { body: { uid: SYSTEM.state.currentUserUID, tradeLink: link, bonusCode: bonusCode } });
                tradeLinkInput.value = '';
                bonusCodeInput.value = '';
                pollForJobCompletion(data.jobId, 'deposit');
            } catch (e) {
                setTransactionMessage(`Error: ${e.message}`);
                setFinancialLock(false);
            }
        }

        async function handleWithdraw() {
            const amountInput = document.getElementById('withdraw-amount-input');
            const amount = parseInt(amountInput.value.replace(/,/g, ''), 10);
            if (!amount || amount <= 0 || amount > SYSTEM.state.currentBalance) {
                setTransactionMessage('Please enter a valid amount.');
                return;
            }
            setFinancialLock(true);
            try {
                const data = await SYSTEM.api.request('/api/withdraw', { body: { uid: SYSTEM.state.currentUserUID, amount } });
                amountInput.value = '';
                pollForJobCompletion(data.jobId, 'withdrawal');
            } catch (e) {
                setTransactionMessage(`Error: ${e.message}`);
                setFinancialLock(false);
            }
        }

        async function handleCheckWithdrawal() {
            setTransactionMessage('Checking for active trades...');
            try {
                const data = await SYSTEM.api.request(`/api/check-withdrawal/${SYSTEM.state.currentUserUID}`, { method: 'GET' });
                if (data.found && data.tradeLink) {
                    setTransactionMessage(`Found active trade for ${data.amount.toLocaleString()}! Copy link: <br><input type="text" class="client-input" value="${data.tradeLink}" readonly onclick="this.select()" style="margin-top: 10px;">`, true);
                } else {
                    setTransactionMessage('No active withdrawal found.');
                }
            } catch (e) {
                setTransactionMessage(e.message || 'An error occurred.');
            }
        }

        function setTransactionMessage(html, isHtml = false) {
            const area = document.getElementById('transaction-message-area');
            if (isHtml) {
                area.innerHTML = html;
            } else {
                area.textContent = html;
            }
        }

        function setFinancialLock(isLocked) {
            SYSTEM.state.isTransactionPending = isLocked;
            document.getElementById('deposit-btn').disabled = isLocked;
            document.getElementById('withdraw-btn').disabled = isLocked;
        }

        // Setup all the event listeners
        setupAuthEventListeners();
        document.getElementById('load-plugins-btn').addEventListener('click', initializePlugins);
        document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
        document.getElementById('deposit-btn').addEventListener('click', handleDeposit);
        document.getElementById('withdraw-btn').addEventListener('click', handleWithdraw);
        document.getElementById('check-withdrawal-btn').addEventListener('click', handleCheckWithdrawal);
        applyNumberFormatting(document.getElementById('withdraw-amount-input'));

        const observer = new IntersectionObserver(([entry]) => {
            document.getElementById('sticky-header-info-wrapper').classList.toggle('visible', !entry.isIntersecting);
        }, { root: document.querySelector('#cco-client-panel .panel-content'), threshold: 0.1 });

        observer.observe(document.getElementById('primary-balance-container'));
    }

    function createDraggablePanel(id, headerText, innerHTML, defaultPos) {
        let container = document.getElementById(id);
        if (container) return container;

        container = document.createElement('div');
        container.id = id;
        container.className = 'floating-panel';
        container.innerHTML = `
            <div class="panel-header">
                <span class="panel-header-text">${headerText}</span>
                <span id="sticky-header-info-wrapper" class="sticky-header-info">
                    <span id="sticky-wager-req-display" class="sticky-wager-req"></span>
                    <span id="sticky-balance-display" class="sticky-balance"></span>
                </span>
                <span class="panel-minimize-button" title="Minimize">−</span>
            </div>
            <div class="panel-content"><div class="panel-content-inner">${innerHTML}</div></div>
            <div class="panel-resize-handle"></div>`;
        document.body.appendChild(container);

        const header = container.querySelector('.panel-header-text');
        const minimizeButton = container.querySelector('.panel-minimize-button');
        const resizeHandle = container.querySelector('.panel-resize-handle');
        let isDragging = false, isResizing = false;
        let offset = { x: 0, y: 0 };
        let initialSize = { width: 0, height: 0 };

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset = { x: e.clientX - container.offsetLeft, y: e.clientY - container.offsetTop };
        });

        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            offset = { x: e.clientX, y: e.clientY };
            initialSize = { width: container.offsetWidth, height: container.offsetHeight };
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                container.style.left = `${e.clientX - offset.x}px`;
                container.style.top = `${e.clientY - offset.y}px`;
            }
            if (isResizing) {
                container.style.width = `${initialSize.width + (e.clientX - offset.x)}px`;
                container.style.height = `${initialSize.height + (e.clientY - offset.y)}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                GM_setValue(`${id}Position`, { top: container.style.top, left: container.style.left });
            }
            if (isResizing) {
                isResizing = false;
                GM_setValue(`${id}Dimensions`, { width: container.style.width, height: container.style.height });
            }
        });

        const savedPos = GM_getValue(`${id}Position`, defaultPos);
        container.style.top = savedPos.top;
        container.style.left = savedPos.left;

        const savedDims = GM_getValue(`${id}Dimensions`);
        if (savedDims) {
            container.style.width = savedDims.width;
            container.style.height = savedDims.height;
        }

        minimizeButton.addEventListener('click', () => {
            container.classList.add('minimized');
            GM_setValue(`${id}Minimized`, true);
            syncToolbar();
        });

        if (GM_getValue(`${id}Minimized`, false)) {
            container.classList.add('minimized');
        }

        return container;
    }

    function syncToolbar() {
        const serverStatsButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Show Serverstats'));
        if (!serverStatsButton || !serverStatsButton.parentElement) return;

        const toolbar = serverStatsButton.parentElement;
        let btn = document.getElementById('restore-client-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'restore-client-btn';
            btn.className = 'script-toolbar-button';
            btn.innerHTML = '🤖<span>Game Client</span>';
            btn.onclick = () => {
                document.getElementById('cco-client-panel')?.classList.remove('minimized');
                GM_setValue('cco-client-panelMinimized', false);
                syncToolbar();
            };
            toolbar.appendChild(btn);
        }
        btn.style.display = GM_getValue('cco-client-panelMinimized', false) ? 'inline-flex' : 'none';
    }

    let isInitialized = false;

    function run() {
        if (isInitialized) return;
        const serverStatsButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Show Serverstats'));
        if (serverStatsButton) {
            isInitialized = true;
            console.log("%cCCO Core: Initializing...", "color: #79CAFF; font-weight: bold;");
            initCore();
            const toolbarObserver = new MutationObserver(syncToolbar);
            toolbarObserver.observe(document.body, { childList: true, subtree: true });
            syncToolbar();
        }
    }

    const masterObserver = new MutationObserver(run);
    masterObserver.observe(document.body, { childList: true, subtree: true });

    if (document.readyState !== 'loading') {
        run();
    }
})();