// Popup script for configuration

const pocketbaseUrlInput = document.getElementById('pocketbaseUrl');
const saveBtn = document.getElementById('saveBtn');
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const syncCountEl = document.getElementById('syncCount');

let sessionSyncCount = 0;

// Load saved config
chrome.storage.sync.get(['pocketbaseUrl'], (result) => {
    pocketbaseUrlInput.value = result.pocketbaseUrl || '';
    updateStatus(result.pocketbaseUrl);
});

function updateStatus(url) {
    if (url) {
        statusEl.textContent = '✓ Connected to PocketBase';
        statusEl.className = 'status connected';
    } else {
        statusEl.textContent = 'Not configured - add PocketBase URL below';
        statusEl.className = 'status disconnected';
    }
}

// Save configuration
saveBtn.addEventListener('click', async () => {
    const pocketbaseUrl = pocketbaseUrlInput.value.trim().replace(/\/$/, '');

    if (!pocketbaseUrl) {
        statusEl.textContent = '⚠ Please enter the PocketBase URL';
        statusEl.className = 'status disconnected';
        return;
    }

    // Test connection
    statusEl.textContent = 'Testing connection...';
    statusEl.className = 'status';

    try {
        const response = await fetch(`${pocketbaseUrl}/api/collections/connections_v2/records?perPage=1`);
        if (!response.ok) throw new Error('Server not reachable');

        // Save config
        chrome.storage.sync.set({ pocketbaseUrl }, () => {
            updateStatus(pocketbaseUrl);

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
    } catch (error) {
        statusEl.textContent = '✕ Could not connect to PocketBase';
        statusEl.className = 'status disconnected';
        console.error('Connection test failed:', error);
    }
});

// Force scan
scanBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com')) {
        statusEl.textContent = 'Open LinkedIn to scan connections_v2';
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
                statusEl.textContent = 'No new connections_v2 found on this page';
                statusEl.className = 'status';
            }
        });
    } catch (error) {
        statusEl.textContent = 'Could not scan - refresh the LinkedIn page';
        statusEl.className = 'status disconnected';
    }
});

// Listen for sync updates from background
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SYNC_COMPLETE') {
        sessionSyncCount += message.count;
        syncCountEl.textContent = sessionSyncCount;
    }
});
