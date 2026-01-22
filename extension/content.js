// Content script for scraping LinkedIn connections

(function () {
    'use strict';

    const DEFAULT_URL = 'https://linkedin-indexer-production.up.railway.app';
    let POCKETBASE_URL = DEFAULT_URL;

    chrome.storage.sync.get(['pocketbaseUrl'], (result) => {
        POCKETBASE_URL = result.pocketbaseUrl || DEFAULT_URL;
        console.log('[LinkedIn Indexer] PocketBase URL:', POCKETBASE_URL);
    });

    let processedUrls = new Set();
    let pendingConnections = [];
    let syncTimeout = null;

    function extractConnection(card) {
        try {
            // Find profile link - look for any anchor with /in/ in href
            const allLinks = card.querySelectorAll('a');
            let profileUrl = null;
            let name = null;

            for (const link of allLinks) {
                const href = link.getAttribute('href') || '';
                if (href.includes('/in/') && !href.includes('/in/ACoAAA')) {
                    // Get full URL
                    profileUrl = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
                    profileUrl = profileUrl.split('?')[0];

                    // Get name - could be in span with aria-hidden, or direct text
                    const spans = link.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent?.trim();
                        if (text && text.length > 2 && text.length < 50 &&
                            !text.toLowerCase().includes('view') &&
                            !text.toLowerCase().includes('linkedin') &&
                            !text.toLowerCase().includes('connect') &&
                            !text.includes('•') &&
                            text.split(' ').length <= 5) {
                            name = text;
                            break;
                        }
                    }

                    if (!name) {
                        // Try link text directly
                        const text = link.textContent?.trim();
                        if (text && text.length > 2 && text.length < 50) {
                            name = text.split('\n')[0].trim();
                        }
                    }

                    if (name) break;
                }
            }

            if (!profileUrl || !name || processedUrls.has(profileUrl)) {
                return null;
            }

            // Find headline - usually in a div or span after the name
            let headline = '';
            const allText = card.textContent || '';
            const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 200);

            // Find the line after the name that looks like a headline
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(name)) {
                    // Next few lines might be the headline
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const line = lines[j];
                        if (line && !line.includes('Connect') && !line.includes('Follow') &&
                            !line.includes('mutual') && !line.includes('Message') &&
                            line.length > 10) {
                            headline = line;
                            break;
                        }
                    }
                    break;
                }
            }

            // Parse title and company
            let title = headline;
            let company = '';
            const separators = [' at ', ' @ ', ' | ', ' - '];
            for (const sep of separators) {
                if (headline.includes(sep)) {
                    const parts = headline.split(sep);
                    title = parts[0].trim();
                    company = parts.slice(1).join(sep).trim();
                    break;
                }
            }

            // Find image
            let imageUrl = '';
            const img = card.querySelector('img[src*="licdn"], img[src*="media.licdn"]');
            if (img?.src && !img.src.includes('ghost') && !img.src.includes('data:')) {
                imageUrl = img.src;
            }

            console.log('[LinkedIn Indexer] Found:', name, '-', headline.substring(0, 50));

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
            console.error('[LinkedIn Indexer] Error:', error);
            return null;
        }
    }

    async function syncToPocketBase(connections) {
        if (!POCKETBASE_URL) return false;

        let successCount = 0;
        for (const conn of connections) {
            try {
                const searchUrl = `${POCKETBASE_URL}/api/collections/connections_v2/records?filter=(profile_url='${encodeURIComponent(conn.profile_url)}')`;
                const searchResponse = await fetch(searchUrl);
                const searchData = await searchResponse.json();

                if (searchData.items?.length > 0) {
                    await fetch(`${POCKETBASE_URL}/api/collections/connections_v2/records/${searchData.items[0].id}`, {
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
                console.error('[LinkedIn Indexer] Sync error:', error);
            }
        }

        console.log(`[LinkedIn Indexer] Synced ${successCount}/${connections.length}`);
        chrome.runtime.sendMessage({ type: 'SYNC_COMPLETE', count: successCount }).catch(() => { });
        return successCount > 0;
    }

    function scheduleSyncToPocketBase() {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            if (pendingConnections.length > 0) {
                const toSync = [...pendingConnections];
                pendingConnections = [];
                await syncToPocketBase(toSync);
            }
        }, 2000);
    }

    function scanForConnections() {
        // Use very generic selectors - find any list items or divs that contain profile links
        const main = document.querySelector('main') || document.body;

        // First, find all links to profiles
        const profileLinks = main.querySelectorAll('a[href*="/in/"]');
        console.log('[LinkedIn Indexer] Profile links found:', profileLinks.length);

        // For each profile link, find its parent card container
        const processedCards = new Set();
        let newCount = 0;

        profileLinks.forEach(link => {
            // Walk up to find a reasonable container (li, article, or div with certain patterns)
            let card = link;
            for (let i = 0; i < 10; i++) {
                card = card.parentElement;
                if (!card || card === main) break;

                // Check if this looks like a card container
                const tagName = card.tagName.toLowerCase();
                if (tagName === 'li' || tagName === 'article' ||
                    (tagName === 'div' && card.querySelectorAll('a[href*="/in/"]').length === 1)) {
                    break;
                }
            }

            if (!card || processedCards.has(card)) return;
            processedCards.add(card);

            const connection = extractConnection(card);
            if (connection) {
                processedUrls.add(connection.profile_url);
                pendingConnections.push(connection);
                newCount++;
            }
        });

        console.log('[LinkedIn Indexer] New connections:', newCount);
        if (newCount > 0) scheduleSyncToPocketBase();
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
        setTimeout(scanForConnections, 1500);
        setupMutationObserver();

        window.addEventListener('scroll', () => {
            clearTimeout(window._scrollScanTimeout);
            window._scrollScanTimeout = setTimeout(scanForConnections, 1000);
        }, { passive: true });
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'GET_STATUS') {
            sendResponse({ processed: processedUrls.size, pending: pendingConnections.length, configured: !!POCKETBASE_URL });
            return true;
        }
        if (message.type === 'UPDATE_CONFIG') {
            POCKETBASE_URL = message.pocketbaseUrl || DEFAULT_URL;
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
