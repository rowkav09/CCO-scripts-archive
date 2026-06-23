// ==UserScript==
// @name         profile viewer
// @version      1.0
// @author       Zhiro
// @description  view player profiles without going to a different page (LMB to open the window, RMB to open the profile in a new tab, if you want to see all the stats). My discord: zhiro999.
// @match        https://case-clicker.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(async () => {
    'use strict';

    const getBuildId = () => {
        const nextData = document.getElementById('__NEXT_DATA__');
        if (nextData) {
            try {
                const data = JSON.parse(nextData.textContent);
                return data.buildId;
            } catch(e) {}
        }
        return null;
    };

    const getUserFromAvatar = (avatarEl) => {
        let node = avatarEl;
        for (let i = 0; i < 10; i++) {
            const reactKey = Object.keys(node).find(k => k.startsWith('__reactFiber$'));
            if (reactKey) {
                let fiber = node[reactKey];
                let depth = 0;
                while (fiber && depth < 20) {
                    const props = fiber.memoizedProps || fiber.props;
                    const msg = props?.message || props?.msg || props?.chatMessage;
                    if (msg?.user?._id) {
                        return { id: msg.user._id, name: msg.user.name, image: msg.user.image };
                    }
                    fiber = fiber.return;
                    depth++;
                }
            }
            node = node.parentElement;
            if (!node) break;
        }
        return null;
    };

    const formatNumber = (n) => {
        if (!n && n !== 0) return '0';
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString();
    };

    const formatMoney = (n) => {
        if (!n && n !== 0) return '$0';
        return '$' + formatNumber(n);
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'Unknown';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Unknown';
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        return month + '/' + day + '/' + year;
    };

    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/[&<>]/g, (m) => {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    };

    const fetchProfile = async (userId) => {
        const buildId = getBuildId();
        if (!buildId) return null;

        const url = '/_next/data/' + buildId + '/en/profile/' + userId + '.json?id=' + userId;

        try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return null;
            const data = await res.json();

            const user = JSON.parse(data.pageProps.user);
            const userstat = JSON.parse(data.pageProps.userstat);
            const rank = data.pageProps.rank ? JSON.parse(data.pageProps.rank) : null;

            return {
                name: user.name,
                image: user.image,
                memberSince: formatDate(userstat.createdAt),
                role: user.role,
                rankName: rank ? rank.name : 'Unranked',
                premierRating: userstat.premierRating || 0,
                clicks: userstat.clicks || 0,
                clickedCases: userstat.clickedCases || 0,
                moneyEarned: userstat.moneyEarned || 0,
                moneySpent: userstat.moneySpent || 0,
                casebattles: userstat.casebattles || 0,
                casebattlesWon: userstat.casebattlesWon || 0,
                tokensWon: userstat.tokensWon || 0,
                tokensLost: userstat.tokensLost || 0
            };
        } catch(e) {
            console.error(e);
            return null;
        }
    };

    const showModal = async (userId, userImage, userName) => {
        const overlay = document.createElement('div');
        overlay.className = 'profile-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'profile-modal';
        modal.innerHTML = '<div class="profile-loader"><div class="loader-spinner"></div><div class="loader-text">Loading profile...</div></div>';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const profile = await fetchProfile(userId);

        if (!profile) {
            modal.innerHTML = '<div class="error-message">Failed to load profile</div>';
            return;
        }

        const profit = profile.moneyEarned - profile.moneySpent;
        const battleWinrate = profile.casebattles > 0
            ? ((profile.casebattlesWon / profile.casebattles) * 100).toFixed(1)
            : 0;
        const tokenProfit = profile.tokensWon - profile.tokensLost;

        let rankDisplay = '';
        if (profile.premierRating > 0) {
            rankDisplay = 'Premier Rating: ' + profile.premierRating.toLocaleString();
        } else {
            rankDisplay = profile.rankName;
        }

        const avatarUrl = userImage || profile.image;

        modal.innerHTML = `
            <div class="profile-modal-inner">
                <button class="profile-close">×</button>
                <div class="profile-header-glow"></div>
                <div class="profile-avatar">
                    <img class="avatar-image" src="${escapeHtml(avatarUrl)}" onerror="this.style.display='none'; this.parentElement.querySelector('.avatar-fallback').style.display='flex';" crossorigin="anonymous">
                    <div class="avatar-fallback" style="display: none; width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(145deg, #2a2a3e, #1a1a2e); align-items: center; justify-content: center; font-size: 36px; font-weight: bold; color: white;">${escapeHtml(profile.name.charAt(0).toUpperCase())}</div>
                </div>
                <div class="profile-username">${escapeHtml(profile.name)}</div>
                <div class="profile-rank-badge">${escapeHtml(rankDisplay)}</div>

                <div class="profile-stats">
                    <div class="stat-card">
                        <div class="stat-card-title">ECONOMY</div>
                        <div class="stat-grid">
                            <div class="stat-item">
                                <span class="stat-label">Earned</span>
                                <span class="stat-value positive">${formatMoney(profile.moneyEarned)}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Spent</span>
                                <span class="stat-value negative">${formatMoney(profile.moneySpent)}</span>
                            </div>
                            <div class="stat-item highlight">
                                <span class="stat-label">Net Profit</span>
                                <span class="stat-value ${profit >= 0 ? 'positive' : 'negative'}">${profit >= 0 ? '' : '-'}${formatMoney(Math.abs(profit))}</span>
                            </div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card-title">ACTIVITY</div>
                        <div class="stat-grid">
                            <div class="stat-item full-width">
                                <span class="stat-label">Clicks</span>
                                <span class="stat-value">${formatNumber(profile.clicks)}</span>
                            </div>
                            <div class="stat-item full-width">
                                <span class="stat-label">Cases</span>
                                <span class="stat-value">${formatNumber(profile.clickedCases)}</span>
                            </div>
                            <div class="stat-item full-width">
                                <span class="stat-label">Case Battles</span>
                                <span class="stat-value">${formatNumber(profile.casebattles)} <span class="winrate">(Winrate ${battleWinrate}%)</span></span>
                            </div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card-title">TOKENS</div>
                        <div class="stat-grid">
                            <div class="stat-item">
                                <span class="stat-label">Won</span>
                                <span class="stat-value positive">${formatNumber(profile.tokensWon)}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Lost</span>
                                <span class="stat-value negative">${formatNumber(profile.tokensLost)}</span>
                            </div>
                            <div class="stat-item highlight">
                                <span class="stat-label">Net</span>
                                <span class="stat-value ${tokenProfit >= 0 ? 'positive' : 'negative'}">${tokenProfit >= 0 ? '' : '-'}${formatNumber(Math.abs(tokenProfit))}</span>
                            </div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card-title">INFO</div>
                        <div class="stat-grid">
                            <div class="stat-item full-width">
                                <span class="stat-label">Member since</span>
                                <span class="stat-value">${profile.memberSince}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const img = modal.querySelector('.avatar-image');
        const fallback = modal.querySelector('.avatar-fallback');

        img.style.width = '80px';
        img.style.height = '80px';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        img.style.border = '2px solid rgba(233,69,96,0.5)';

        if (img.complete && img.naturalWidth === 0) {
            img.style.display = 'none';
            fallback.style.display = 'flex';
        } else {
            img.onerror = () => {
                img.style.display = 'none';
                fallback.style.display = 'flex';
            };
        }

        modal.querySelector('.profile-close').onclick = () => {
            overlay.remove();
        };
    };

    const attachAvatarListeners = () => {
        const avatars = document.querySelectorAll('img[alt="avatar"], img[class*="Avatar"]');
        for (const avatar of avatars) {
            if (avatar.dataset.profileLinked) continue;
            avatar.dataset.profileLinked = 'true';
            avatar.style.cursor = 'pointer';
            avatar.title = 'Left click - quick view, Right click - full profile';

            avatar.onclick = async (e) => {
                e.stopPropagation();
                const user = getUserFromAvatar(avatar);
                if (user && user.id) {
                    await showModal(user.id, user.image, user.name);
                }
            };

            avatar.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const user = getUserFromAvatar(avatar);
                if (user && user.id) {
                    window.open('/profile/' + user.id, '_blank');
                }
                return false;
            };
        }
    };

    const init = () => {
        attachAvatarListeners();
    };

    const observer = new MutationObserver(() => {
        attachAvatarListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

        .profile-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(12px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .profile-modal {
            animation: modalFloat 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
        }

        @keyframes modalFloat {
            from {
                opacity: 0;
                transform: scale(0.9) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        .profile-modal-inner {
            position: relative;
            background: linear-gradient(135deg, rgba(18, 18, 30, 0.98), rgba(28, 28, 45, 0.98));
            border-radius: 40px;
            width: 400px;
            max-width: 85vw;
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(233,69,96,0.15);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            overflow: hidden;
        }

        .profile-modal-inner::-webkit-scrollbar {
            display: none;
        }

        .profile-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255,255,255,0.06);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.7);
            font-size: 20px;
            cursor: pointer;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s ease;
            z-index: 10;
            font-weight: 300;
        }

        .profile-close:hover {
            background: #e94560;
            color: white;
            transform: rotate(90deg);
            border-color: #e94560;
        }

        .profile-header-glow {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 160px;
            background: radial-gradient(ellipse at 50% 0%, rgba(233,69,96,0.25), rgba(121,40,202,0.1), transparent);
            pointer-events: none;
        }

        .profile-avatar {
            display: flex;
            justify-content: center;
            padding-top: 32px;
            margin-bottom: 8px;
        }

        .avatar-image {
            width: 88px;
            height: 88px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid rgba(233,69,96,0.5);
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }

        .profile-username {
            text-align: center;
            font-size: 22px;
            font-weight: 700;
            color: white;
            margin-bottom: 6px;
            padding: 0 24px;
            letter-spacing: -0.2px;
        }

        .profile-rank-badge {
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            color: #ffd700;
            background: rgba(255,215,0,0.08);
            display: block;
            width: fit-content;
            max-width: 90%;
            padding: 4px 16px;
            border-radius: 50px;
            margin: 0 auto 24px auto;
            letter-spacing: 0.3px;
            border: 1px solid rgba(255,215,0,0.15);
            white-space: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
        }

        .profile-rank-badge::-webkit-scrollbar {
            display: none;
        }

        .profile-stats {
            padding: 0 20px 28px 20px;
        }

        .stat-card {
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid rgba(255,255,255,0.04);
        }

        .stat-card-title {
            font-size: 10px;
            font-weight: 700;
            color: #e94560;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            opacity: 0.7;
        }

        .stat-grid {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 13px;
            padding: 6px 0;
        }

        .stat-item.full-width {
            width: 100%;
        }

        .stat-item.highlight {
            padding-top: 10px;
            margin-top: 4px;
            border-top: 1px solid rgba(255,255,255,0.06);
        }

        .stat-label {
            color: #8899b0;
            font-size: 12px;
            font-weight: 500;
        }

        .stat-value {
            color: #f0f0f5;
            font-weight: 700;
            font-size: 13px;
            text-align: right;
        }

        .stat-value.positive {
            color: #4ade80;
        }

        .stat-value.negative {
            color: #f87171;
        }

        .winrate {
            color: #ffd700;
            font-size: 11px;
            margin-left: 6px;
            font-weight: 600;
        }

        .profile-loader {
            text-align: center;
            padding: 60px 40px;
        }

        .loader-spinner {
            width: 40px;
            height: 40px;
            border: 2px solid rgba(233,69,96,0.2);
            border-top: 2px solid #e94560;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loader-text {
            color: #8899b0;
            font-size: 13px;
            font-weight: 500;
        }

        .error-message {
            text-align: center;
            padding: 60px 40px;
            color: #f87171;
            font-size: 13px;
            font-weight: 500;
        }
    `);

    init();
})();