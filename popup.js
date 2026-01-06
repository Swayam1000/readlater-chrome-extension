// popup.js

// -- State --
let currentTab = 'reading'; // 'reading' | 'todos'
let activeReadingList = [];
let activeTodoList = [];
let linkingState = null; // { sourceId, sourceType: 'reading'|'todo' }

// -- DOM Elements --
const tabBtns = document.querySelectorAll('.tab-btn');
const views = {
    reading: document.getElementById('view-reading'),
    todos: document.getElementById('view-todos'),
    settings: document.getElementById('view-settings')
};
const lists = {
    reading: document.getElementById('reading-list'),
    todos: document.getElementById('todo-list')
};
const emptyStates = {
    reading: document.getElementById('reading-empty'),
    todos: document.getElementById('todo-empty')
};

const btnSettings = document.getElementById('btn-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnTestConnection = document.getElementById('btn-test-connection');
const inputBotToken = document.getElementById('tg-bot-token');
const inputChatId = document.getElementById('tg-chat-id');
const settingsStatus = document.getElementById('settings-status');

const settingsTagsList = document.getElementById('settings-tags-list');
const newTagInput = document.getElementById('new-tag-input');
const btnAddTag = document.getElementById('btn-add-tag');

const btnSaveCurrent = document.getElementById('btn-save-current');
const btnSaveTodo = document.getElementById('btn-save-todo');
const todoTagSelector = document.getElementById('todo-tag-selector');
const todoNoteInput = document.getElementById('todo-note-input');

const overlay = document.getElementById('link-overlay');
const linkCandidates = document.getElementById('link-candidates');
const btnCloseOverlay = document.getElementById('btn-close-overlay');

const tagOverlay = document.getElementById('tag-overlay');
const tagCandidates = document.getElementById('tag-candidates');
const btnCloseTagOverlay = document.getElementById('btn-close-tag-overlay');

// -- Initialization --
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupEventListeners();
    await updateMainTagSelector();
    await updateTodoTagSelector();
    await refreshData();
});

function setupTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI state
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            currentTab = tab;

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            views[tab].classList.add('active');
            views.settings.classList.remove('active'); // Ensure settings is closed
        });
    });

    // Settings Toggle
    btnSettings.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        tabBtns.forEach(b => b.classList.remove('active')); // Deselect tabs
        views.settings.classList.add('active');
        loadSettings();
        renderSettingsTags();
    });
}

function setupEventListeners() {
    // Save Settings
    btnSaveSettings.addEventListener('click', async () => {
        const token = inputBotToken.value.trim();
        const chatId = inputChatId.value.trim();

        await chrome.storage.local.set({
            telegramBotToken: token,
            telegramChatId: chatId
        });

        settingsStatus.textContent = 'Saved!';
        settingsStatus.className = 'status-msg success';
        settingsStatus.className = 'status-msg success';
        setTimeout(() => settingsStatus.textContent = '', 2000);
    });

    // Test Connection
    btnTestConnection.addEventListener('click', async () => {
        const token = inputBotToken.value.trim();
        const chatId = inputChatId.value.trim();

        if (!token || !chatId) {
            settingsStatus.textContent = 'Enter Token and ID first';
            settingsStatus.className = 'status-msg error';
            return;
        }

        settingsStatus.textContent = 'Testing...';
        settingsStatus.className = 'status-msg';

        const success = await sendTelegramMessage(token, chatId, "✅ Connection successful! Your ReadLater extension is connected.");

        if (success) {
            settingsStatus.textContent = 'Success! Check your Telegram.';
            settingsStatus.className = 'status-msg success';
        } else {
            settingsStatus.textContent = 'Failed. Check Token/ID.';
            settingsStatus.className = 'status-msg error';
        }
    });

    // Add New Tag (Settings)
    btnAddTag.addEventListener('click', async () => {
        const tagName = newTagInput.value.trim();
        if (tagName) {
            await addCustomTag(tagName);
            newTagInput.value = '';
            renderSettingsTags();
            // Also need to refresh selectors if they are visible, but they usually aren't.
            await updateMainTagSelector();
        }
    });

    // Save Current Tab
    btnSaveCurrent.addEventListener('click', async () => {
        // Get current tab info
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tagSelector = document.getElementById('tag-selector');
        const selectedTag = tagSelector.value;

        if (tab) {
            await Storage.addReadingItem({
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl || '',
                tags: selectedTag ? [selectedTag] : []
            });

            // Sync if Must-read or Video to watch
            if (selectedTag === 'Must-read' || selectedTag === 'Video to watch') {
                await checkAndSyncToTelegram(tab.title, tab.url, selectedTag);
            }

            tagSelector.value = ""; // Reset
            await refreshData();
        }
    });

    // Save Todo (Current Tab)
    btnSaveTodo.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const selectedTag = todoTagSelector.value;
        const note = todoNoteInput.value.trim();

        if (tab) {
            await Storage.addTodoItem({
                title: tab.title,
                description: note,
                url: tab.url,
                tags: selectedTag ? [selectedTag] : []
            });

            todoTagSelector.value = '';
            todoNoteInput.value = '';
            await refreshData();
        }
    });

    // Close Overlay
    btnCloseOverlay.addEventListener('click', closeOverlay);
    btnCloseTagOverlay.addEventListener('click', closeTagOverlay);
}

// -- Rendering --
async function refreshData() {
    const data = await Storage.loadData();
    activeReadingList = data.readingList;
    activeTodoList = data.todoList;

    renderReadingList(activeReadingList);
    renderTodoList(activeTodoList);
}

function renderReadingList(list) {
    const container = lists.reading;
    container.innerHTML = '';

    if (list.length === 0) {
        emptyStates.reading.classList.remove('hidden');
    } else {
        emptyStates.reading.classList.add('hidden');
        list.forEach(item => {
            const li = document.createElement('li');
            li.className = 'item-card';

            const linkedCounts = item.linkedTodoIds ? item.linkedTodoIds.length : 0;

            // Generate Tags HTML
            const tagsHtml = (item.tags || []).map(tag => {
                const className = `tag-${tag.replace(/ /g, '-')}`;
                return `<span class="item-tag ${className}">${escapeHtml(tag)}</span>`;
            }).join('');

            li.innerHTML = `
        <div class="item-header">
           <img src="${item.favIconUrl || 'icons/icon16.png'}" class="favicon" onerror="this.src='icons/icon16.png'">
           <a href="${item.url}" target="_blank" class="item-title ${item.status === 'done' ? 'done' : ''}">${escapeHtml(item.title)}</a>
           <div class="actions">
             <button class="action-btn btn-toggle-status" title="Toggle Read Status">${item.status === 'done' ? '↩' : '✓'}</button>
             <button class="action-btn btn-delete" title="Delete">×</button>
           </div>
        </div>
        <div class="tags-list">
            ${tagsHtml}
            <button class="action-btn btn-add-tag" title="Add Tag" style="font-size:12px; margin-left:4px;">+</button>
        </div>
        <div class="item-meta">
          <div class="link-badge" role="button">
            <span>🔗 ${linkedCounts} linked</span>
          </div>
        </div>
      `;

            // Events
            li.querySelector('.btn-toggle-status').addEventListener('click', async () => {
                const newStatus = item.status === 'done' ? 'unread' : 'done';
                await Storage.updateReadingItem(item.id, { status: newStatus });
                await refreshData();
            });

            li.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm('Delete this item?')) {
                    await Storage.deleteReadingItem(item.id);
                    await refreshData();
                }
            });

            li.querySelector('.link-badge').addEventListener('click', () => {
                openLinkOverlay(item.id, 'reading');
            });

            li.querySelector('.btn-add-tag').addEventListener('click', () => {
                openTagOverlay(item.id, 'reading'); // Pass type
            });

            container.appendChild(li);
        });
    }
}

function renderTodoList(list) {
    const container = lists.todos;
    container.innerHTML = '';

    if (list.length === 0) {
        emptyStates.todos.classList.remove('hidden');
    } else {
        emptyStates.todos.classList.add('hidden');
        list.forEach(item => {
            const li = document.createElement('li');
            li.className = 'item-card';

            const linkedCounts = item.linkedReadingIds ? item.linkedReadingIds.length : 0;

            // Generate Tags HTML
            const tagsHtml = (item.tags || []).map(tag => {
                const className = getTagClass(tag);
                return `<span class="item-tag ${className}">${escapeHtml(tag)}</span>`;
            }).join('');

            // Generate URL and Note HTML
            const urlHtml = item.url ? `<div class="todo-url">🔗 <a href="${item.url}" target="_blank">${escapeHtml(new URL(item.url).hostname)}</a></div>` : '';
            const noteHtml = item.description ? `<div class="todo-note">${escapeHtml(item.description)}</div>` : '';

            li.innerHTML = `
        <div class="item-header">
           <a href="${item.url || '#'}" target="_blank" class="item-title ${item.status === 'done' ? 'done' : ''}">${escapeHtml(item.title)}</a>
           <div class="actions">
             <button class="action-btn btn-toggle-status" title="Toggle Done Status">${item.status === 'done' ? '↩' : '✓'}</button>
             <button class="action-btn btn-delete" title="Delete">×</button>
           </div>
        </div>
        ${urlHtml}
        ${noteHtml}
        <div class="tags-list">
            ${tagsHtml}
            <button class="action-btn btn-add-tag" title="Add Tag" style="font-size:12px; margin-left:4px;">+</button>
        </div>
        <div class="item-meta">
          <div class="link-badge" role="button">
            <span>🔗 ${linkedCounts} linked</span>
          </div>
        </div>
      `;

            // Events
            li.querySelector('.btn-toggle-status').addEventListener('click', async () => {
                const newStatus = item.status === 'done' ? 'open' : 'done';
                await Storage.updateTodoItem(item.id, { status: newStatus });
                await refreshData();
            });

            li.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm('Delete this task?')) {
                    await Storage.deleteTodoItem(item.id);
                    await refreshData();
                }
            });

            li.querySelector('.link-badge').addEventListener('click', () => {
                openLinkOverlay(item.id, 'todo');
            });

            li.querySelector('.btn-add-tag').addEventListener('click', () => {
                openTagOverlay(item.id, 'todo'); // Pass type
            });

            container.appendChild(li);
        });
    }
}

// -- Linking Overlay Logic --
function openLinkOverlay(sourceId, type) {
    linkingState = { sourceId, type };
    overlay.classList.remove('hidden');
    renderLinkCandidates();
}

function closeOverlay() {
    overlay.classList.add('hidden');
    linkingState = null;
}

function renderLinkCandidates() {
    linkCandidates.innerHTML = '';
    const { sourceId, type } = linkingState;

    // If we are linking FROM a Reading Item, show Todos
    // If we are linking FROM a Todo, show Reading Items
    const candidates = type === 'reading' ? activeTodoList : activeReadingList;
    const isTargetTodo = type === 'reading'; // Are the candidates todos?

    // Find the source object to know what is already linked
    let sourceItem;
    if (type === 'reading') {
        sourceItem = activeReadingList.find(i => i.id === sourceId);
    } else {
        sourceItem = activeTodoList.find(i => i.id === sourceId);
    }

    const alreadyLinkedIds = type === 'reading'
        ? (sourceItem.linkedTodoIds || [])
        : (sourceItem.linkedReadingIds || []);

    candidates.forEach(item => {
        const isLinked = alreadyLinkedIds.includes(item.id);
        const li = document.createElement('li');
        li.className = 'item-card small';
        li.style.cursor = 'pointer';
        if (isLinked) {
            li.style.border = '2px solid var(--primary)';
            li.style.backgroundColor = '#eff6ff';
        }

        li.innerHTML = `
      <div class="item-header">
        <span class="item-title">${escapeHtml(item.title)}</span>
        ${isLinked ? '<span style="color:var(--primary); font-weight:bold;">Linked</span>' : ''}
      </div>
    `;

        li.addEventListener('click', async () => {
            if (isLinked) {
                // Unlink
                if (type === 'reading') {
                    await Storage.unlinkItems(item.id, sourceId); // item is todo
                } else {
                    await Storage.unlinkItems(sourceId, item.id); // source is todo
                }
            } else {
                // Link
                if (type === 'reading') {
                    await Storage.linkItems(item.id, sourceId);
                } else {
                    await Storage.linkItems(sourceId, item.id);
                }
            }
            // Re-render and close (or keep open? Let's re-render to show state)
            // refresh global data first
            const data = await Storage.loadData();
            activeReadingList = data.readingList;
            activeTodoList = data.todoList;
            // update source item reference
            if (type === 'reading') {
                sourceItem = activeReadingList.find(i => i.id === sourceId);
            } else {
                sourceItem = activeTodoList.find(i => i.id === sourceId);
            }
            renderLinkCandidates(); // Re-render this list
            refreshData(); // Refresh bg list
        });

        linkCandidates.appendChild(li);
    });
}

// -- Tag Overlay Logic --
let taggingTargetId = null;
let taggingTargetType = null; // 'reading' or 'todo'

// ... getAvailableTags etc ...
async function getAvailableTags() {
    const defaultTags = ["Must-read", "Course to check", "Interesting Person", "Interesting Project", "Job to apply"];
    const result = await chrome.storage.local.get(['allTags']);

    // Initialize if not present
    if (!result.allTags) {
        await chrome.storage.local.set({ allTags: defaultTags });
        return defaultTags;
    }

    // Ensure Must-read is always there
    if (!result.allTags.includes("Must-read")) {
        const fixedTags = ["Must-read", ...result.allTags];
        await chrome.storage.local.set({ allTags: fixedTags });
        return fixedTags;
    }

    return result.allTags;
}

async function addCustomTag(tagName) {
    const tags = await getAvailableTags();
    if (!tags.includes(tagName)) {
        const newTags = [...tags, tagName];
        await chrome.storage.local.set({ allTags: newTags });
    }
}

async function removeCustomTag(tagName) {
    if (tagName === "Must-read") return; // Protected

    const tags = await getAvailableTags();
    const newTags = tags.filter(t => t !== tagName);
    await chrome.storage.local.set({ allTags: newTags });
}

async function openTagOverlay(itemId, type = 'reading') {
    taggingTargetId = itemId;
    taggingTargetType = type;
    tagOverlay.classList.remove('hidden');
    await renderTagCandidates(itemId);
}

function closeTagOverlay() {
    tagOverlay.classList.add('hidden');
    taggingTargetId = null;
    taggingTargetType = null;
}

async function renderTagCandidates(itemId) {
    tagCandidates.innerHTML = '';
    // Determine source list
    const sourceList = taggingTargetType === 'todo' ? activeTodoList : activeReadingList;
    const item = sourceList.find(i => i.id === itemId);

    const existingTags = item ? (item.tags || []) : [];
    const availableTags = await getAvailableTags();

    availableTags.forEach(tag => {
        const isSelected = existingTags.includes(tag);
        const span = document.createElement('span');
        span.className = `item-tag ${getTagClass(tag)}`;

        if (isSelected) {
            span.style.border = "1px solid var(--primary)";
            span.style.backgroundColor = "#e0e7ff"; // Highlight selected
        }
        span.textContent = tag;

        span.addEventListener('click', async () => {
            if (item) {
                let newTags;
                if (isSelected) {
                    // Remove tag
                    newTags = existingTags.filter(t => t !== tag);
                } else {
                    // Add tag
                    newTags = [...existingTags, tag];
                    // Sync if adding Must-read or Video to watch
                    if (tag === 'Must-read' || tag === 'Video to watch') {
                        await checkAndSyncToTelegram(item.title, item.url || '(No URL)', tag);
                    }
                }

                if (taggingTargetType === 'todo') {
                    await Storage.updateTodoItem(itemId, { tags: newTags });
                } else {
                    await Storage.updateReadingItem(itemId, { tags: newTags });
                }

                await refreshData();
                closeTagOverlay();
            }
        });

        tagCandidates.appendChild(span);
    });
}

async function renderSettingsTags() {
    settingsTagsList.innerHTML = '';
    const tags = await getAvailableTags();

    tags.forEach(tag => {
        const li = document.createElement('div');
        li.className = 'item-tag';
        li.classList.add(getTagClass(tag));

        li.textContent = tag;

        const btn = document.createElement('span');
        btn.textContent = ' ×';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';
        btn.style.marginLeft = '4px';

        // Hide delete for protected tags
        if (tag === "Must-read") {
            btn.style.display = 'none';
        }

        btn.addEventListener('click', async () => {
            if (confirm(`Delete tag "${tag}"?`)) {
                await removeCustomTag(tag);
                renderSettingsTags();
                await updateMainTagSelector();
            }
        });
        li.appendChild(btn);

        li.style.marginRight = '4px';
        li.style.marginBottom = '4px';
        settingsTagsList.appendChild(li);
    });
}

// Update the main Tag Selector in the Save Tab view as well!
async function updateMainTagSelector() {
    const tagSelector = document.getElementById('tag-selector');
    if (!tagSelector) return;
    const currentVal = tagSelector.value;
    tagSelector.innerHTML = '<option value="">Add Tag...</option>';
    const tags = await getAvailableTags();
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelector.appendChild(option);
    });
    tagSelector.value = currentVal;
}

async function updateTodoTagSelector() {
    if (!todoTagSelector) return;
    const currentVal = todoTagSelector.value;
    todoTagSelector.innerHTML = '<option value="">Add Tag...</option>';
    const tags = await getAvailableTags();
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        todoTagSelector.appendChild(option);
    });
    todoTagSelector.value = currentVal;
}
// We need to call this when popup opens


// -- Telegram Sync Logic --
async function loadSettings() {
    const result = await chrome.storage.local.get(['telegramBotToken', 'telegramChatId']);
    inputBotToken.value = result.telegramBotToken || '';
    inputChatId.value = result.telegramChatId || '';
}

async function checkAndSyncToTelegram(title, url, tag = 'Must-read') {
    const { telegramBotToken, telegramChatId } = await chrome.storage.local.get(['telegramBotToken', 'telegramChatId']);

    if (!telegramBotToken || !telegramChatId) {
        console.log('Telegram sync skipped: Missing credentials');
        return;
    }

    // Choose emoji based on tag
    const emoji = tag === 'Video to watch' ? '🎬' : '📚';
    const message = `${emoji} *${escapeMarkdown(tag)}*\n\n${escapeMarkdown(title)}\n${url}`;
    await sendTelegramMessage(telegramBotToken, telegramChatId, message);
}

async function sendTelegramMessage(token, chatId, text) {
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        const data = await response.json();
        if (!data.ok) {
            console.error('Telegram API Error:', data);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Telegram sync failed', e);
        return false;
    }
}

function escapeMarkdown(text) {
    // Only escape characters that break Telegram's Markdown parsing
    return text.replace(/[_*`\[\]]/g, '\\$&');
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* Helper to generate consistent color class for any tag string */
function getTagClass(tagName) {
    // Keep 'Must-read' specifically red if using the override class, 
    // but the override in CSS handles .tag-Must-read.
    // We can just rely on the CSS cascade or return specific class for known ones if we want strictly fixed colors for defaults.

    // Let's use specific classes for the original defaults to preserve their exact look if liked, 
    // OR just use the hash which will be consistent anyway.
    // The CSS has .tag-Must-read defined, so let's include that.

    // Sanitize for specific class lookup
    const safeName = tagName.replace(/ /g, '-');
    // If it matches a specific override in CSS (we kept .tag-Must-read etc)
    if (["Must-read", "Course-to-check", "Interesting-Person", "Interesting-Project", "Job-to-apply"].includes(safeName)) {
        return `tag-${safeName}`;
    }

    // Otherwise generate hash
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 10; // We have 0-9 classes
    return `tag-color-${index}`;
}
