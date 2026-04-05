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
        let url = info.linkUrl || info.pageUrl || tab.url;
        let title = tab.title;

        if (info.linkUrl) {
            title = "Saved Link";
        }

        const item = {
            url: url,
            title: title,
            favIconUrl: tab.favIconUrl || ""
        };

        if (globalThis.Storage) {
            await globalThis.Storage.addReadingItem(item);
        } else {
            console.error("Storage helper not loaded");
        }
    }
});
