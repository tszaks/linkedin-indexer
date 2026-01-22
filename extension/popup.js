// Popup script for configuration

const DEFAULT_URL = 'https://linkedin-indexer-production.up.railway.app';

const pocketbaseUrlInput = document.getElementById('pocketbaseUrl');
const saveBtn = document.getElementById('saveBtn');
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const syncCountEl = document.getElementById('syncCount');

let sessionSyncCount = 0;

// Load saved config or use default
chrome.storage.sync.get(['pocketbaseUrl'], (result) => {
    const url = result.pocketbaseUrl || DEFAULT_URL;
    pocketbaseUrlInput.value = url;

    // Auto-save if not saved yet
    if (!result.pocketbaseUrl) {
        chrome.storage.sync.set({ pocketbaseUrl: DEFAULT_URL });
    }

    // Auto-test connection
    testConnection(url);
});

async function testConnection(url) {
    statusEl.textContent = 'Testing connection...';
    statusEl.className = 'status';

    try {
        const response = await fetch(`${url}/api/collections/connections_v2/records?perPage=1`);
        if (!response.ok) throw new Error('Server error');

        statusEl.textContent = '✓ Connected to PocketBase';
        statusEl.className = 'status connected';
        return true;
    } catch (error) {
        statusEl.textContent = '✕ Could not connect - check PocketBase';
        statusEl.className = 'status disconnected';
        console.error('Connection test failed:', error);
        return false;
    }
}

function updateStatus(url) {
    if (url) {
        statusEl.textContent = '✓ Connected to PocketBase';
        statusEl.className = 'status connected';
    } else {
        statusEl.textContent = 'Not configured';
        statusEl.className = 'status disconnected';
    }
}

// Save configuration
saveBtn.addEventListener('click', async () => {
    const pocketbaseUrl = pocketbaseUrlInput.value.trim().replace(/\/$/, '') || DEFAULT_URL;

    const connected = await testConnection(pocketbaseUrl);

    if (connected) {
        chrome.storage.sync.set({ pocketbaseUrl }, () => {
            // Update content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.url?.includes('linkedin.com')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'UPDATE_CONFIG',
                        pocketbaseUrl
                    }).catch(() => { });
                }
            });
        });
    }
});

// Force scan
scanBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com')) {
        statusEl.textContent = 'Open LinkedIn to scan';
        statusEl.className = 'status disconnected';
        return;
    }

    try {
        chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SCAN' }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = 'Refresh LinkedIn page and try again';
                statusEl.className = 'status disconnected';
                return;
            }

            if (response?.found) {
                statusEl.textContent = `Found ${response.found} new connection(s)`;
                statusEl.className = 'status connected';
            } else {
                statusEl.textContent = 'No new connections found on this page';
                statusEl.className = 'status';
            }
        });
    } catch (error) {
        statusEl.textContent = 'Could not scan - refresh the page';
        statusEl.className = 'status disconnected';
    }
});

// Listen for sync updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SYNC_COMPLETE') {
        sessionSyncCount += message.count;
        syncCountEl.textContent = sessionSyncCount;
    }
});
