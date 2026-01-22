// Popup script for configuration

const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const syncCountEl = document.getElementById('syncCount');
const webAppLink = document.getElementById('webAppLink');

// Load saved config
chrome.storage.sync.get(['apiUrl', 'apiKey', 'syncCount'], (result) => {
    apiUrlInput.value = result.apiUrl || '';
    apiKeyInput.value = result.apiKey || '';
    syncCountEl.textContent = result.syncCount || '0';

    if (result.apiUrl) {
        webAppLink.href = result.apiUrl;
    }

    updateStatus(result.apiUrl, result.apiKey);
});

function updateStatus(url, key) {
    if (url && key) {
        statusEl.textContent = '✓ Connected to server';
        statusEl.className = 'status connected';
    } else {
        statusEl.textContent = 'Not configured - add server details below';
        statusEl.className = 'status disconnected';
    }
}

// Save configuration
saveBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, ''); // Remove trailing slash
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
        statusEl.textContent = '⚠ Please fill in both fields';
        statusEl.className = 'status disconnected';
        return;
    }

    // Test connection
    statusEl.textContent = 'Testing connection...';
    statusEl.className = 'status';

    try {
        const response = await fetch(`${apiUrl}/api/connections?count=true`);
        if (!response.ok) throw new Error('Server not reachable');

        // Save config
        chrome.storage.sync.set({ apiUrl, apiKey }, () => {
            updateStatus(apiUrl, apiKey);
            webAppLink.href = apiUrl;

            // Update content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.url?.includes('linkedin.com')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'UPDATE_CONFIG',
                        apiUrl,
                        apiKey
                    }).catch(() => { });
                }
            });
        });
    } catch (error) {
        statusEl.textContent = '✕ Could not connect to server';
        statusEl.className = 'status disconnected';
    }
});

// Force scan
scanBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com')) {
        statusEl.textContent = 'Open LinkedIn to scan connections';
        statusEl.className = 'status disconnected';
        return;
    }

    try {
        chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SCAN' }, (response) => {
            if (response?.found) {
                statusEl.textContent = `Found ${response.found} new connection(s)`;
                statusEl.className = 'status connected';
            } else {
                statusEl.textContent = 'No new connections found on this page';
                statusEl.className = 'status';
            }
        });
    } catch (error) {
        statusEl.textContent = 'Could not scan - refresh the LinkedIn page';
        statusEl.className = 'status disconnected';
    }
});

// Listen for sync updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SYNC_COMPLETE') {
        chrome.storage.sync.get(['syncCount'], (result) => {
            const newCount = (result.syncCount || 0) + message.count;
            chrome.storage.sync.set({ syncCount: newCount });
            syncCountEl.textContent = newCount;
        });
    }
});
