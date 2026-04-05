const ObsidianSync = (() => {
    const DEFAULT_NOTE_PATH = 'AI Learnings/sources/READO.md';
    const HANDLE_DB_NAME = 'readdo-obsidian-handles';
    const HANDLE_STORE_NAME = 'handles';
    const HANDLE_KEY = 'vault-directory';
    let queuedFlushPromise = null;
    let syncRequestedWhileRunning = false;

    function pause(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function quoteYaml(value) {
        return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }

    function formatDisplayTime(timestamp) {
        if (!timestamp) return 'Unknown';
        return new Date(Number(timestamp)).toLocaleString();
    }

    function slugify(value = '') {
        return String(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    }

    function sanitizeInlineTag(tag) {
        return `#${slugify(tag)}`;
    }

    function normalizePath(value = '') {
        return String(value).trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    }

    function isLegacyPerItemPath(value = '') {
        const path = normalizePath(value);
        return /^ReadDo\/(Reading|Courses|Tasks)\//.test(path) || path === 'ReadDo/ReadDo Hub.md';
    }

    function sanitizeNotePath(value = '') {
        const path = normalizePath(value);
        if (!path || isLegacyPerItemPath(path)) {
            return DEFAULT_NOTE_PATH;
        }
        if (path === 'AI Learnings/sources/ReadDo.md') {
            return DEFAULT_NOTE_PATH;
        }
        return path;
    }

    function isAbsolutePath(value = '') {
        return /^\/|^[A-Za-z]:[\\/]/.test(String(value).trim());
    }

    function getSettingsStatusElement() {
        return document.getElementById('settings-status');
    }

    function setSettingsStatus(text, kind = '') {
        const el = getSettingsStatusElement();
        if (!el) return;
        el.textContent = text;
        el.className = kind ? `status-msg ${kind}` : 'status-msg';
    }

    function updateObsidianNotePreview() {
        const input = document.getElementById('obsidian-note-path');
        const preview = document.getElementById('obsidian-folder-preview');
        if (!preview) return;

        const notePath = sanitizeNotePath(input?.value || DEFAULT_NOTE_PATH);
        preview.textContent = notePath;
    }

    function launchObsidianUri(uri) {
        const anchor = document.createElement('a');
        anchor.href = uri;
        anchor.style.display = 'none';
        anchor.rel = 'noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    function buildObsidianUri(action, params) {
        const query = Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');
        return `obsidian://${action}?${query}`;
    }

    function openHandleDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(HANDLE_DB_NAME, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(HANDLE_STORE_NAME);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveVaultHandle(handle) {
        const db = await openHandleDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
            tx.objectStore(HANDLE_STORE_NAME).put(handle, HANDLE_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function loadVaultHandle() {
        const db = await openHandleDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
            const request = tx.objectStore(HANDLE_STORE_NAME).get(HANDLE_KEY);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async function hasReadWritePermission(handle, shouldPrompt = false) {
        if (!handle) return false;
        const options = { mode: 'readwrite' };

        if (typeof handle.queryPermission === 'function') {
            const status = await handle.queryPermission(options);
            if (status === 'granted') return true;
        }

        if (shouldPrompt && typeof handle.requestPermission === 'function') {
            const status = await handle.requestPermission(options);
            return status === 'granted';
        }

        return false;
    }

    async function promptForVaultHandle() {
        if (typeof window.showDirectoryPicker !== 'function') {
            throw new Error('This browser does not support directory access from the extension popup.');
        }

        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const granted = await hasReadWritePermission(handle, true);
        if (!granted) {
            throw new Error('Read/write permission to the vault folder was not granted.');
        }

        await saveVaultHandle(handle);
        return handle;
    }

    async function getVaultHandle({ prompt = false } = {}) {
        let handle = null;
        try {
            handle = await loadVaultHandle();
        } catch (error) {
            console.error('Failed to load stored vault handle', error);
        }

        if (handle && await hasReadWritePermission(handle, prompt)) {
            return handle;
        }

        if (prompt) {
            return promptForVaultHandle();
        }

        return null;
    }

    async function getConfig() {
        const result = await chrome.storage.local.get([
            'obsidianVaultName',
            'obsidianNotePath',
            'obsidianRootFolder',
            'obsidianAutoSync'
        ]);

        const legacyRootFolder = result.obsidianRootFolder || '';
        const migratedNotePath = legacyRootFolder && legacyRootFolder !== 'ReadDo'
            ? `${normalizePath(legacyRootFolder)}/READO.md`
            : DEFAULT_NOTE_PATH;

        return {
            vaultName: (result.obsidianVaultName || '').trim(),
            notePath: sanitizeNotePath(result.obsidianNotePath || migratedNotePath),
            autoSync: !!result.obsidianAutoSync
        };
    }

    function buildNoteTarget(config) {
        if (isAbsolutePath(config.vaultName)) {
            const basePath = config.vaultName.trim().replace(/\\/g, '/').replace(/\/+$/g, '');
            return { path: `${basePath}/${config.notePath}` };
        }

        return {
            vault: config.vaultName,
            file: config.notePath
        };
    }

    async function getOrCreateDirectory(rootHandle, pathParts) {
        let current = rootHandle;
        for (const part of pathParts) {
            current = await current.getDirectoryHandle(part, { create: true });
        }
        return current;
    }

    function resolveNotePathForHandle(rootHandle, notePath) {
        const normalizedPath = sanitizeNotePath(notePath);
        const segments = normalizedPath.split('/').filter(Boolean);
        const handleName = normalizePath(rootHandle?.name || '');
        if (!handleName) return segments;

        const lastMatchingIndex = segments.lastIndexOf(handleName);
        if (lastMatchingIndex >= 0 && lastMatchingIndex < segments.length - 1) {
            return segments.slice(lastMatchingIndex + 1);
        }

        return segments;
    }

    async function writeManagedNoteDirect(rootHandle, notePath, content) {
        const segments = resolveNotePathForHandle(rootHandle, notePath);
        if (!segments.length) {
            throw new Error('Managed note path is invalid.');
        }
        const fileName = segments.pop();
        const directoryHandle = await getOrCreateDirectory(rootHandle, segments);
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    async function openManagedNote(config) {
        const uri = buildObsidianUri('open', {
            ...buildNoteTarget(config)
        });
        launchObsidianUri(uri);
        await pause(80);
    }

    function renderTagSummary(tags = []) {
        if (!tags.length) return 'none';
        return tags.map(sanitizeInlineTag).join(' ');
    }

    function buildTaskBlock(item) {
        const lines = [
            `### ${item.title || 'Untitled task'}`,
            `- Status: ${item.status || 'open'}`,
            `- Saved: ${formatDisplayTime(item.createdAt)}`,
            `- Due: ${item.dueDate || 'Not set'}`,
            `- Urgent: ${item.isUrgent ? 'Yes' : 'No'}`,
            `- Important: ${item.isImportant ? 'Yes' : 'No'}`,
            `- Tags: ${renderTagSummary(item.tags || [])}`
        ];

        if (item.url) lines.push(`- Source: [Open link](${item.url})`);
        if (item.description) lines.push(`- Notes: ${item.description}`);
        if (item.linkedReadingIds?.length) lines.push(`- Linked reading items: ${item.linkedReadingIds.length}`);
        if (item.linkedCourseIds?.length) lines.push(`- Linked courses: ${item.linkedCourseIds.length}`);
        return lines.join('\n');
    }

    function buildReadingBlock(item, label) {
        const lines = [
            `### ${item.title || `Untitled ${label.toLowerCase()}`}`,
            `- Status: ${item.status || 'unread'}`,
            `- Saved: ${formatDisplayTime(item.createdAt)}`,
            `- Tags: ${renderTagSummary(item.tags || [])}`
        ];

        if (item.url) lines.push(`- Source: [Open link](${item.url})`);
        if (item.description || item.notes) lines.push(`- Notes: ${item.description || item.notes}`);
        if (item.linkedTodoIds?.length) lines.push(`- Linked tasks: ${item.linkedTodoIds.length}`);
        return lines.join('\n');
    }

    function collectHistory(data) {
        const doneReading = (data.readingList || [])
            .filter(item => item.status === 'done')
            .map(item => ({ ...item, type: 'reading', historyType: 'done' }));
        const doneCourses = (data.courseList || [])
            .filter(item => item.status === 'done')
            .map(item => ({ ...item, type: 'course', historyType: 'done' }));
        const doneTodos = (data.todoList || [])
            .filter(item => item.status === 'done')
            .map(item => ({ ...item, type: 'todo', historyType: 'done' }));
        const deletedItems = (data.historyList || []).map(item => ({ ...item, historyType: 'deleted' }));

        return [...doneReading, ...doneCourses, ...doneTodos, ...deletedItems]
            .sort((a, b) => {
                const timeA = a.deletedAt || a.updatedAt || a.createdAt || 0;
                const timeB = b.deletedAt || b.updatedAt || b.createdAt || 0;
                return timeB - timeA;
            });
    }

    function renderSection(title, items, renderItem) {
        if (!items.length) {
            return [`## ${title}`, '', '_None_', ''].join('\n');
        }

        return [
            `## ${title}`,
            '',
            items.map(renderItem).join('\n\n'),
            ''
        ].join('\n');
    }

    function buildManagedNote(data, notePath) {
        const activeReading = (data.readingList || []).filter(item => item.status !== 'done');
        const activeCourses = (data.courseList || []).filter(item => item.status !== 'done');
        const activeTodos = (data.todoList || []).filter(item => item.status !== 'done');
        const historyItems = collectHistory(data);

        const historyLines = historyItems.length
            ? historyItems.map(item => {
                const label = item.type === 'course' ? 'Course' : item.type === 'reading' ? 'Reading' : 'Task';
                const event = item.historyType === 'deleted' ? 'Deleted' : 'Completed';
                const time = formatDisplayTime(item.deletedAt || item.updatedAt || item.createdAt);
                return `- ${event} ${label}: ${item.title || 'Untitled'} (${time})`;
            }).join('\n')
            : '_None_';

        return [
            '---',
            `source: ${quoteYaml('readdo-extension')}`,
            'managed_by_extension: true',
            `updated: ${quoteYaml(new Date().toISOString())}`,
            `managed_note: ${quoteYaml(notePath)}`,
            '---',
            '# ReadDo',
            '',
            'This note is managed by the ReadDo browser extension. Sync rewrites this file in place.',
            '',
            '## Snapshot',
            `- Reading queue: ${activeReading.length}`,
            `- Courses queue: ${activeCourses.length}`,
            `- Tasks queue: ${activeTodos.length}`,
            `- History items: ${historyItems.length}`,
            '',
            renderSection('Open Tasks', activeTodos, buildTaskBlock),
            renderSection('Reading Queue', activeReading, item => buildReadingBlock(item, 'Reading')),
            renderSection('Course Queue', activeCourses, item => buildReadingBlock(item, 'Course')),
            '## History',
            '',
            historyLines,
            ''
        ].join('\n');
    }

    async function writeManagedNote({ updateStatus = false, promptForHandle = false } = {}) {
        const config = await getConfig();
        if (!config.vaultName) {
            throw new Error('Add your Obsidian vault name, vault ID, or absolute vault path first.');
        }

        const data = await Storage.loadData();
        const content = buildManagedNote(data, config.notePath);
        const vaultHandle = await getVaultHandle({ prompt: promptForHandle });
        if (!vaultHandle) {
            throw new Error('Grant Vault Access and choose your vault folder before syncing to Obsidian.');
        }

        await writeManagedNoteDirect(vaultHandle, config.notePath, content);

        if (updateStatus) {
            setSettingsStatus(`Obsidian sync complete. Updated ${config.notePath}.`, 'success');
        }

        return { mode: 'direct', notePath: config.notePath };
    }

    async function syncItemsIfEnabled() {
        const config = await getConfig();
        if (!config.autoSync || !config.vaultName) return false;
        const vaultHandle = await getVaultHandle({ prompt: false });
        if (!vaultHandle) return false;

        syncRequestedWhileRunning = true;
        if (!queuedFlushPromise) {
            queuedFlushPromise = (async () => {
                try {
                    while (syncRequestedWhileRunning) {
                        syncRequestedWhileRunning = false;
                        await pause(180);
                        await writeManagedNote({ updateStatus: false, promptForHandle: false });
                    }
                } finally {
                    queuedFlushPromise = null;
                }
            })();
        }

        return queuedFlushPromise;
    }

    async function syncAll({ updateStatus = true } = {}) {
        return writeManagedNote({ updateStatus, promptForHandle: true });
    }

    async function syncAllIfEnabled() {
        const config = await getConfig();
        if (!config.autoSync || !config.vaultName) return false;
        const vaultHandle = await getVaultHandle({ prompt: false });
        if (!vaultHandle) return false;
        return writeManagedNote({ updateStatus: false, promptForHandle: false });
    }

    async function openNote() {
        const config = await getConfig();
        if (!config.vaultName) {
            throw new Error('Add your Obsidian vault name, vault ID, or absolute vault path first.');
        }

        const vaultHandle = await getVaultHandle({ prompt: false });
        if (vaultHandle) {
            await writeManagedNote({ updateStatus: false, promptForHandle: false });
        }

        await openManagedNote(config);
        setSettingsStatus(`Opened ${config.notePath}.`, 'success');
    }

    return {
        syncAll,
        syncAllIfEnabled,
        syncItemsIfEnabled,
        openNote,
        promptForVaultHandle,
        updateObsidianNotePreview,
        showStatus: setSettingsStatus
    };
})();

globalThis.ObsidianSync = ObsidianSync;
globalThis.updateObsidianNotePreview = ObsidianSync.updateObsidianNotePreview;

document.getElementById('btn-grant-obsidian-access')?.addEventListener('click', async () => {
    try {
        await ObsidianSync.promptForVaultHandle();
        ObsidianSync.showStatus('Vault access granted. Future syncs will update one managed note directly.', 'success');
    } catch (error) {
        ObsidianSync.showStatus(`Could not grant vault access: ${error.message}`, 'error');
    }
});

document.getElementById('btn-sync-obsidian')?.addEventListener('click', async () => {
    try {
        ObsidianSync.showStatus('Syncing managed note to Obsidian...', '');
        await ObsidianSync.syncAll();
    } catch (error) {
        ObsidianSync.showStatus(`Obsidian sync failed: ${error.message}`, 'error');
    }
});

document.getElementById('btn-open-obsidian-note')?.addEventListener('click', async () => {
    try {
        await ObsidianSync.openNote();
    } catch (error) {
        ObsidianSync.showStatus(`Could not open the managed note: ${error.message}`, 'error');
    }
});

ObsidianSync.updateObsidianNotePreview();
