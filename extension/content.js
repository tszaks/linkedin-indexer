// Content script for scraping LinkedIn connections_v2 and syncing to PocketBase

(function () {
    'use strict';

    let POCKETBASE_URL = '';

    chrome.storage.sync.get(['pocketbaseUrl'], (result) => {
        POCKETBASE_URL = result.pocketbaseUrl || 'https://linkedin-indexer-production.up.railway.app';
        console.log('[LinkedIn Indexer] PocketBase URL:', POCKETBASE_URL);
    });

    let processedUrls = new Set();
    let pendingConnections = [];
    let syncTimeout = null;

    // Expanded selectors to capture people from various LinkedIn pages
    const SELECTORS = {
        // Search results, connections_v2 list, people cards
        personCards: [
            '[data-view-name="search-entity-result-universal-template"]',
            '.mn-connection-card',
            '.entity-result',
            '.reusable-search__result-container',
            '.search-result__wrapper',
            '[data-chameleon-result-urn]',
            '.artdeco-list__item'
        ].join(', '),

        // Name selectors
        names: [
            '.entity-result__title-text a span[aria-hidden="true"]',
            '.mn-connection-card__name',
            '.entity-result__title-line span[dir="ltr"] span[aria-hidden="true"]',
            '.app-aware-link span[aria-hidden="true"]',
            'span.entity-result__title-text a',
            '.t-16.t-black.t-bold'
        ],

        // Headline/title selectors
        headlines: [
            '.entity-result__primary-subtitle',
            '.mn-connection-card__occupation',
            '.entity-result__summary',
            '.t-14.t-normal'
        ],

        // Profile link selectors
        profileLinks: [
            '.entity-result__title-text a',
            '.mn-connection-card__link',
            'a.app-aware-link[href*="/in/"]',
            'a[href*="/in/"]'
        ],

        // Image selectors
        images: [
            '.entity-result__image img',
            '.mn-connection-card__picture img',
            '.presence-entity__image',
            'img.EntityPhoto-circle-5'
        ]
    };

    function extractConnection(card) {
        try {
            // Find profile link
            let profileUrl = null;
            for (const selector of SELECTORS.profileLinks) {
                const linkEl = card.querySelector(selector);
                if (linkEl?.href?.includes('/in/')) {
                    profileUrl = linkEl.href.split('?')[0];
                    break;
                }
            }

            if (!profileUrl || processedUrls.has(profileUrl)) {
                return null;
            }

            // Find name
            let name = null;
            for (const selector of SELECTORS.names) {
                const nameEl = card.querySelector(selector);
                const text = nameEl?.textContent?.trim();
                if (text && text.length > 1 && !text.includes('LinkedIn')) {
                    name = text;
                    break;
                }
            }

            if (!name) return null;

            // Find headline
            let headline = '';
            for (const selector of SELECTORS.headlines) {
                const headlineEl = card.querySelector(selector);
                const text = headlineEl?.textContent?.trim();
                if (text && text.length > 5) {
                    headline = text;
                    break;
                }
            }

            const { title, company } = parseHeadline(headline);

            // Find image
            let imageUrl = '';
            for (const selector of SELECTORS.images) {
                const imgEl = card.querySelector(selector);
                if (imgEl?.src && !imgEl.src.includes('ghost')) {
                    imageUrl = imgEl.src;
                    break;
                }
            }

            return {
                profile_url: profileUrl,
                name,
                headline,
                title,
                company,
                location: '',
                image_url: imageUrl
            };
        } catch (error) {
            console.error('[LinkedIn Indexer] Error extracting connection:', error);
            return null;
        }
    }

    function parseHeadline(headline) {
        let title = headline;
        let company = '';

        const separators = [' at ', ' @ ', ' | ', ' - ', ', '];

        for (const sep of separators) {
            if (headline.includes(sep)) {
                const parts = headline.split(sep);
                title = parts[0].trim();
                company = parts.slice(1).join(sep).trim();
                break;
            }
        }

        return { title, company };
    }

    async function syncToPocketBase(connections_v2) {
        if (!POCKETBASE_URL) {
            console.log('[LinkedIn Indexer] PocketBase URL not configured');
            return false;
        }

        let successCount = 0;

        for (const conn of connections_v2) {
            try {
                const searchUrl = `${POCKETBASE_URL}/api/collections/connections_v2/records?filter=(profile_url='${encodeURIComponent(conn.profile_url)}')`;
                const searchResponse = await fetch(searchUrl);
                const searchData = await searchResponse.json();

                if (searchData.items && searchData.items.length > 0) {
                    const existingId = searchData.items[0].id;
                    await fetch(`${POCKETBASE_URL}/api/collections/connections_v2/records/${existingId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(conn)
                    });
                } else {
                    await fetch(`${POCKETBASE_URL}/api/collections/connections_v2/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(conn)
                    });
                }
                successCount++;
            } catch (error) {
                console.error('[LinkedIn Indexer] Error syncing:', error);
            }
        }

        console.log(`[LinkedIn Indexer] Synced ${successCount}/${connections_v2.length} connections_v2`);

        // Notify popup
        chrome.runtime.sendMessage({
            type: 'SYNC_COMPLETE',
            count: successCount
        }).catch(() => { });

        return successCount > 0;
    }

    function scheduleSyncToPocketBase() {
        if (syncTimeout) {
            clearTimeout(syncTimeout);
        }

        syncTimeout = setTimeout(async () => {
            if (pendingConnections.length > 0) {
                const toSync = [...pendingConnections];
                pendingConnections = [];

                const success = await syncToPocketBase(toSync);
                if (!success) {
                    pendingConnections.push(...toSync);
                }
            }
        }, 2000);
    }

    function scanForConnections() {
        const cards = document.querySelectorAll(SELECTORS.personCards);

        let newCount = 0;

        cards.forEach(card => {
            const connection = extractConnection(card);
            if (connection) {
                processedUrls.add(connection.profile_url);
                pendingConnections.push(connection);
                newCount++;
            }
        });

        if (newCount > 0) {
            console.log(`[LinkedIn Indexer] Found ${newCount} new connections_v2`);
            scheduleSyncToPocketBase();
        }

        return newCount;
    }

    function setupMutationObserver() {
        const observer = new MutationObserver(() => {
            clearTimeout(window._linkedinScanTimeout);
            window._linkedinScanTimeout = setTimeout(scanForConnections, 500);
        });

        const targetNode = document.querySelector('main') || document.body;
        observer.observe(targetNode, { childList: true, subtree: true });

        console.log('[LinkedIn Indexer] Observer started');
    }

    function init() {
        console.log('[LinkedIn Indexer] Initializing on:', window.location.href);

        setTimeout(scanForConnections, 1000);
        setupMutationObserver();

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(scanForConnections, 1000);
        }, { passive: true });
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'GET_STATUS') {
            sendResponse({
                processed: processedUrls.size,
                pending: pendingConnections.length,
                configured: !!POCKETBASE_URL
            });
            return true;
        }

        if (message.type === 'UPDATE_CONFIG') {
            POCKETBASE_URL = message.pocketbaseUrl || '';
            sendResponse({ success: true });
            return true;
        }

        if (message.type === 'FORCE_SCAN') {
            const found = scanForConnections();
            sendResponse({ found });
            return true;
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
