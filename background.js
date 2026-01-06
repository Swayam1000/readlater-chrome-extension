// Import Storage helper if needed, but in background we usually import via manifest or just duplicate simple logic if strictly needed. 
// However, since we're using Manifest V3 service workers, `window` is not available. 
// We need to either importScripts or just implement the save logic directly here for simplicity if we want to avoid complex module setups.
// Let's use `importScripts` to reuse storage.js.

try {
    importScripts('storage.js');
} catch (e) {
    console.error(e);
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-to-reading-list",
        title: "Save to Reading List",
        contexts: ["page", "link"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-to-reading-list") {
        // Determine URL and Title
        let url = info.linkUrl || info.pageUrl || tab.url;
        let title = tab.title;

        // If it's a link, we might not have the title easily, so we use the URL or generic text
        if (info.linkUrl) {
            title = "Saved Link"; // Fallback, user can edit later
        }

        const item = {
            url: url,
            title: title,
            favIconUrl: tab.favIconUrl || ""
        };

        if (globalThis.Storage) {
            await globalThis.Storage.addReadingItem(item);
            // Optional: Add a badge or notification if we had them (Notifications not in v1)
        } else {
            console.error("Storage helper not loaded");
        }
    }
});
