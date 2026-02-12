// popup.js

// -- State --
let currentTab = 'reading'; // 'reading' | 'todos'
let activeReadingList = [];
let activeCourseList = []; // New Course List
let activeTodo = [];
let currentReadFilter = "";
let currentCourseFilter = ""; // Course filter
let currentTodoFilter = ""; // State for filters
let activeTodoList = [];
let activeHistoryList = []; // Add history list
let linkingState = null; // { sourceId, sourceType: 'reading'|'todo' }

// -- DOM Elements --
const tabBtns = document.querySelectorAll('.tab-btn');
const views = {
    reading: document.getElementById('view-reading'),
    course: document.getElementById('view-course'), // Add course view
    todos: document.getElementById('view-todos'),
    history: document.getElementById('view-history'), // Add history view
    settings: document.getElementById('view-settings')
};
const lists = {
    reading: document.getElementById('reading-list'),
    course: document.getElementById('course-list'), // Add course list
    todos: document.getElementById('todo-list'),
    history: document.getElementById('history-list') // Add history list
};
const emptyStates = {
    reading: document.getElementById('reading-empty'),
    course: document.getElementById('course-empty'), // Add course empty
    todos: document.getElementById('todo-empty'),
    history: document.getElementById('history-empty') // Add history empty
};

const btnSettings = document.getElementById('btn-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnSaveConvexSettings = document.getElementById('btn-save-convex-settings');
const btnTestConnection = document.getElementById('btn-test-connection');
const inputBotToken = document.getElementById('tg-bot-token');
const inputChatId = document.getElementById('tg-chat-id');
const inputConvexBackupUrl = document.getElementById('convex-backup-url');
const inputConvexRestoreUrl = document.getElementById('convex-restore-url');
const inputConvexSyncKey = document.getElementById('convex-sync-key');
const compactModeToggle = document.getElementById('compact-mode-toggle');
const settingsStatus = document.getElementById('settings-status');

const settingsTagsList = document.getElementById('settings-tags-list');
const newTagInput = document.getElementById('new-tag-input');
const btnAddTag = document.getElementById('btn-add-tag');

// Course Elements
const btnSaveCourse = document.getElementById('btn-save-course');
// Reading Elements
const btnSaveCurrent = document.getElementById('btn-save-current');
const btnSaveTodo = document.getElementById('btn-save-todo');
const todoTagSelector = document.getElementById('todo-tag-selector');
const todoNoteInput = document.getElementById('todo-note-input');
const todoDateInput = document.getElementById('todo-date-input');
const todoUrgentInput = document.getElementById('todo-urgent-input');
const todoImportantInput = document.getElementById('todo-important-input');

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
    await loadUiPreferences();
    await updateMainTagSelector();
    await updateTodoTagSelector();
    await updateFilterDropdowns(); // Init filters
    await refreshData();
    uiLog('Popup Initialized.');
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
    const saveSettingsHandler = async () => {
        const token = inputBotToken.value.trim();
        const chatId = inputChatId.value.trim();
        const convexBackupUrl = inputConvexBackupUrl.value.trim();
        const convexRestoreUrl = inputConvexRestoreUrl.value.trim();
        const convexSyncKey = inputConvexSyncKey.value.trim();

        await chrome.storage.local.set({
            telegramBotToken: token,
            telegramChatId: chatId,
            convexBackupUrl,
            convexRestoreUrl,
            convexSyncKey,
            uiCompactMode: compactModeToggle?.checked || false
        });

        settingsStatus.textContent = 'Saved!';
        settingsStatus.className = 'status-msg success';
        setTimeout(() => settingsStatus.textContent = '', 2000);
    };

    // Save Settings
    btnSaveSettings.addEventListener('click', saveSettingsHandler);
    btnSaveConvexSettings?.addEventListener('click', saveSettingsHandler);

    // Paste Buttons
    const btnPasteToken = document.getElementById('btn-paste-token');
    const btnPasteChatId = document.getElementById('btn-paste-chatid');

    if (btnPasteToken) {
        btnPasteToken.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) inputBotToken.value = text.trim();
            } catch (err) {
                console.error('Failed to read clipboard', err);
                alert('Could not read clipboard. Please allow access if prompted.');
            }
        });
    }

    if (btnPasteChatId) {
        btnPasteChatId.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) inputChatId.value = text.trim();
            } catch (err) {
                console.error('Failed to read clipboard', err);
                alert('Could not read clipboard. Please allow access if prompted.');
            }
        });
    }

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

        const result = typeof window.sendTelegramMessage === 'function'
            ? await window.sendTelegramMessage(token, chatId, "✅ Connection successful! Your ReadLater extension is connected.", true)
            : { ok: false, error: 'Telegram sync module not loaded' };

        if (result && result.ok) {
            settingsStatus.textContent = 'Success! Check your Telegram.';
            settingsStatus.className = 'status-msg success';
        } else {
            settingsStatus.textContent = `Failed: ${(result && result.error) ? result.error : 'Check Token/ID.'}`;
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
            await updateTodoTagSelector();
            await updateFilterDropdowns();
        }
    });

    if (compactModeToggle) {
        compactModeToggle.addEventListener('change', async () => {
            const enabled = compactModeToggle.checked;
            applyCompactMode(enabled);
            await chrome.storage.local.set({ uiCompactMode: enabled });
        });
    }

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
                if (typeof window.checkAndSyncToTelegram === 'function') {
                    await window.checkAndSyncToTelegram(tab.title, tab.url, selectedTag);
                }
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
        const dueDate = todoDateInput.value;
        const isUrgent = todoUrgentInput.checked;
        const isImportant = todoImportantInput.checked;
        const manualTitle = document.getElementById('todo-input').value.trim();

        // If manual title is present, prioritize it? Or should this button ONLY be for current tab?
        // User asked for "another button" for manual add.
        // So this button remains strictly for "Save Current Tab".

        if (tab) {
            await Storage.addTodoItem({
                title: tab.title,
                description: note,
                url: tab.url,
                dueDate: dueDate,
                isUrgent: isUrgent,
                isImportant: isImportant,
                tags: selectedTag ? [selectedTag] : []
            });

            todoTagSelector.value = '';
            todoNoteInput.value = '';
            todoDateInput.value = '';
            todoUrgentInput.checked = false;
            todoImportantInput.checked = false;
            document.getElementById('todo-input').value = ''; // Clear manual input just in case
            todoManualInput?.dispatchEvent(new Event('input'));
            await refreshData();
        }
    });

    // Add Manual Todo
    const btnAddManualTodo = document.getElementById('btn-add-manual-todo');
    const todoManualInput = document.getElementById('todo-input');
    const syncTodoActionPriority = () => {
        const hasManualTitle = todoManualInput.value.trim().length > 0;
        btnAddManualTodo.classList.toggle('primary-btn', hasManualTitle);
        btnAddManualTodo.classList.toggle('secondary-btn', !hasManualTitle);
        btnSaveTodo.classList.toggle('secondary-btn', hasManualTitle);
        btnSaveTodo.classList.toggle('primary-btn', !hasManualTitle);
    };
    syncTodoActionPriority();

    const addManualTodoHandler = async () => {
        const title = todoManualInput.value.trim();
        const selectedTag = todoTagSelector.value;
        const note = todoNoteInput.value.trim();
        const dueDate = todoDateInput.value;
        const isUrgent = todoUrgentInput.checked;
        const isImportant = todoImportantInput.checked;

        if (title) {
            await Storage.addTodoItem({
                title: title,
                description: note,
                url: '', // No URL for manual task
                dueDate: dueDate,
                isUrgent: isUrgent,
                isImportant: isImportant,
                tags: selectedTag ? [selectedTag] : []
            });

            todoManualInput.value = '';
            todoTagSelector.value = '';
            todoNoteInput.value = '';
            todoDateInput.value = '';
            todoUrgentInput.checked = false;
            todoImportantInput.checked = false;
            syncTodoActionPriority();
            await refreshData();
        } else {
            // Highlight input if empty
            todoManualInput.focus();
            todoManualInput.style.borderColor = 'red';
            setTimeout(() => todoManualInput.style.borderColor = '', 1000);
        }
    };

    btnAddManualTodo.addEventListener('click', addManualTodoHandler);
    todoManualInput.addEventListener('input', syncTodoActionPriority);
    todoManualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addManualTodoHandler();
    });

    // Sync from Telegram
    const btnSyncTelegram = document.getElementById('btn-sync-telegram');
    if (btnSyncTelegram) {
        btnSyncTelegram.addEventListener('click', async () => {
            await syncTelegramTasksHandler();
        });
    }

    // Close Overlay
    btnCloseOverlay.addEventListener('click', closeOverlay);
    btnCloseTagOverlay.addEventListener('click', closeTagOverlay);

    // Close on Click Outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    });
    tagOverlay.addEventListener('click', (e) => {
        if (e.target === tagOverlay) closeTagOverlay();
    });

    // Filter Change Listeners
    if (readingFilter) {
        readingFilter.addEventListener('change', () => {
            currentReadFilter = readingFilter.value;
            renderReadingList(activeReadingList);
        });
    }
    if (todoFilter) {
        todoFilter.addEventListener('change', () => {
            currentTodoFilter = todoFilter.value;
            renderTodoList(activeTodoList);
        });
    }

    // Save Course (Current Tab)
    if (btnSaveCourse) {
        btnSaveCourse.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const tagSelector = document.getElementById('course-tag-selector');
            const selectedTag = tagSelector.value;

            if (tab) {
                await Storage.addCourseItem({
                    url: tab.url,
                    title: tab.title,
                    favIconUrl: tab.favIconUrl || '',
                    tags: selectedTag ? [selectedTag] : []
                });

                tagSelector.value = ""; // Reset
                await refreshData();
            }
        });
    }

    // Course Filter
    const courseFilter = document.getElementById('course-filter');
    if (courseFilter) {
        courseFilter.addEventListener('change', () => {
            currentCourseFilter = courseFilter.value;
            renderCourseList(activeCourseList);
        });
    }
}

// -- Rendering --
async function refreshData() {
    const data = await Storage.loadData();
    activeReadingList = data.readingList;
    activeCourseList = data.courseList || [];
    activeTodoList = data.todoList;
    activeHistoryList = data.historyList || [];

    renderReadingList(activeReadingList);
    renderCourseList(activeCourseList);
    renderTodoList(activeTodoList);
    renderHistoryList();
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


// -- Tag Overlay Logic --
let taggingTargetId = null;
let taggingTargetType = null; // 'reading' or 'todo'

// ... getAvailableTags etc ...
async function getAvailableTags() {
    const defaultTags = ["Must-read", "Priority", "Course to check", "Interesting Person", "Interesting Project", "Job to apply", "Must-do", "In Progress", "Completed"];
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

// Filter Dropdowns
const readingFilter = document.getElementById('reading-filter');
const todoFilter = document.getElementById('todo-filter');

async function updateFilterDropdowns() {
    if (!readingFilter || !todoFilter) return;
    // Don't reset value if user already selected something
    const currentReadVal = readingFilter.value;
    const currentTodoVal = todoFilter.value;

    const html = '<option value="">All Tags</option>' + (await getAvailableTags()).map(tag =>
        `<option value="${tag}">${tag}</option>`
    ).join('');

    readingFilter.innerHTML = html;
    todoFilter.innerHTML = html;

    readingFilter.value = currentReadVal;
    todoFilter.value = currentTodoVal;
}
// We need to call this when popup opens


// -- Telegram Sync Logic --
async function loadSettings() {
    const result = await chrome.storage.local.get([
        'telegramBotToken',
        'telegramChatId',
        'convexBackupUrl',
        'convexRestoreUrl',
        'convexSyncKey',
        'uiCompactMode'
    ]);
    inputBotToken.value = result.telegramBotToken || '';
    inputChatId.value = result.telegramChatId || '';
    inputConvexBackupUrl.value = result.convexBackupUrl || '';
    inputConvexRestoreUrl.value = result.convexRestoreUrl || '';
    inputConvexSyncKey.value = result.convexSyncKey || '';
    if (compactModeToggle) {
        compactModeToggle.checked = !!result.uiCompactMode;
    }
    applyCompactMode(!!result.uiCompactMode);
}

async function loadUiPreferences() {
    const result = await chrome.storage.local.get(['uiCompactMode']);
    const isCompact = !!result.uiCompactMode;
    if (compactModeToggle) {
        compactModeToggle.checked = isCompact;
    }
    applyCompactMode(isCompact);
}

function applyCompactMode(enabled) {
    document.body.classList.toggle('density-compact', enabled);
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
