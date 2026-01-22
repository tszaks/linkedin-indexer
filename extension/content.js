// Content script for scraping LinkedIn connections and syncing to PocketBase

(function () {
    'use strict';

    // Configuration - will be set from popup
    let POCKETBASE_URL = '';

    // Load config from storage
    chrome.storage.sync.get(['pocketbaseUrl'], (result) => {
        POCKETBASE_URL = result.pocketbaseUrl || '';
        if (POCKETBASE_URL) {
            console.log('[LinkedIn Indexer] Config loaded, PocketBase URL:', POCKETBASE_URL);
        }
    });

    let processedUrls = new Set();
    let pendingConnections = [];
    let syncTimeout = null;

    // Selectors for LinkedIn connection cards
    const SELECTORS = {
        connectionCard: '[data-view-name="search-entity-result-universal-template"]',
        connectionListItem: '.mn-connection-card',
        name: '.entity-result__title-text a span[aria-hidden="true"], .mn-connection-card__name',
        headline: '.entity-result__primary-subtitle, .mn-connection-card__occupation',
        profileLink: '.entity-result__title-text a, .mn-connection-card__link',
        image: '.entity-result__image img, .mn-connection-card__picture img, .presence-entity__image',
    };

    function extractConnection(card) {
        try {
            const linkEl = card.querySelector(SELECTORS.profileLink);
            const profileUrl = linkEl?.href?.split('?')[0];

            if (!profileUrl || processedUrls.has(profileUrl)) {
                return null;
            }

            const nameEl = card.querySelector(SELECTORS.name);
            const name = nameEl?.textContent?.trim();

            if (!name) return null;

            const headlineEl = card.querySelector(SELECTORS.headline);
            const headline = headlineEl?.textContent?.trim() || '';
            const { title, company } = parseHeadline(headline);

            const imgEl = card.querySelector(SELECTORS.image);
            const imageUrl = imgEl?.src || '';

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

    async function syncToPocketBase(connections) {
        if (!POCKETBASE_URL) {
            console.log('[LinkedIn Indexer] PocketBase URL not configured, skipping sync');
            return false;
        }

        let successCount = 0;

        for (const conn of connections) {
            try {
                // First check if exists
                const searchResponse = await fetch(
                    `${POCKETBASE_URL}/api/collections/connections/records?filter=(profile_url='${encodeURIComponent(conn.profile_url)}')`
                );
                const searchData = await searchResponse.json();

                if (searchData.items && searchData.items.length > 0) {
                    // Update existing
                    const existingId = searchData.items[0].id;
                    await fetch(`${POCKETBASE_URL}/api/collections/connections/records/${existingId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(conn)
                    });
                } else {
                    // Create new
                    await fetch(`${POCKETBASE_URL}/api/collections/connections/records`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(conn)
                    });
                }
                successCount++;
            } catch (error) {
                console.error('[LinkedIn Indexer] Error syncing connection:', error);
            }
        }

        console.log(`[LinkedIn Indexer] Synced ${successCount}/${connections.length} connections`);
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
                    // Put back in queue if failed
                    pendingConnections.push(...toSync);
                }

                // Notify popup about update
                chrome.runtime.sendMessage({
                    type: 'CONNECTIONS_UPDATED',
                    count: toSync.length,
                    success
                }).catch(() => { });
            }
        }, 2000);
    }

    function scanForConnections() {
        const cards = document.querySelectorAll(
            `${SELECTORS.connectionCard}, ${SELECTORS.connectionListItem}`
        );

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
            console.log(`[LinkedIn Indexer] Found ${newCount} new connections`);
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
        console.log('[LinkedIn Indexer] Initializing...');

        // Initial scan
        setTimeout(scanForConnections, 1000);

        // Setup observer for infinite scroll
        setupMutationObserver();

        // Scan on scroll
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(scanForConnections, 1000);
        }, { passive: true });
    }

    // Listen for messages
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

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
