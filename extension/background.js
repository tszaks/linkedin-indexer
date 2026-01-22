// Background service worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CONNECTIONS_UPDATED') {
        // Update badge
        chrome.action.setBadgeText({ text: '+' + message.count });
        chrome.action.setBadgeBackgroundColor({ color: message.success ? '#057642' : '#cc1016' });

        // Clear badge after 3 seconds
        setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
        }, 3000);

        // Notify popup if open
        if (message.success) {
            chrome.runtime.sendMessage({
                type: 'SYNC_COMPLETE',
                count: message.count
            }).catch(() => { });
        }
    }

    return false;
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('LinkedIn Connection Indexer installed');
});
