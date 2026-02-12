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

async function sendTelegramMessage(token, chatId, text, verbose = false) {
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const send = async (useMarkdown = true) => {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    ...(useMarkdown ? { parse_mode: 'Markdown' } : {})
                })
            });

            const responseClone = response.clone();
            try {
                const data = await response.json();
                return { response, data };
            } catch (_) {
                const rawText = await responseClone.text().catch(() => '');
                return {
                    response,
                    data: {
                        ok: false,
                        error_code: response.status,
                        description: `Invalid Telegram response: ${rawText.slice(0, 160)}`
                    }
                };
            }
        };

        let { data } = await send(true);

        // Retry once without Markdown when formatting breaks entity parsing.
        const isMarkdownParseError =
            !data.ok &&
            typeof data.description === 'string' &&
            data.description.toLowerCase().includes("can't parse entities");
        if (isMarkdownParseError) {
            ({ data } = await send(false));
        }

        if (!data.ok) {
            const errorText = data.description || `Telegram API Error (${data.error_code || 'unknown'})`;
            console.error(`Telegram API Error: ${errorText}`);
            if (verbose) {
                return { ok: false, error: errorText, code: data.error_code || null };
            }
            return false;
        }

        if (verbose) {
            return { ok: true, result: data.result };
        }
        return true;
    } catch (e) {
        console.error('Telegram sync failed', e);
        if (verbose) {
            return { ok: false, error: e.message || 'Network error' };
        }
        return false;
    }
}

async function resolveTelegramChatId(token, configuredChatId) {
    try {
        const chat = await getTelegramChat(token, configuredChatId);
        if (chat && typeof chat.id !== 'undefined') {
            return String(chat.id);
        }
    } catch (e) {
        console.error('Failed to resolve chat id', e);
    }
    return String(configuredChatId);
}

const btnBackup = document.getElementById('btn-backup');
const btnRestore = document.getElementById('btn-restore');

// ... (existing code)

// Backup to Telegram
btnBackup.addEventListener('click', async () => {
    if (!confirm('Backup current data to Telegram? This will PIN the backup file in your chat. Ensure your Bot is an Admin if using a Channel.')) return;

    const { telegramBotToken, telegramChatId } = await chrome.storage.local.get(['telegramBotToken', 'telegramChatId']);
    if (!telegramBotToken || !telegramChatId) {
        alert('Please save Bot Token and Chat ID first.');
        return;
    }

    settingsStatus.textContent = 'Backing up...';
    settingsStatus.className = 'status-msg';

    try {
        const jsonString = await Storage.exportData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const filename = `readlater_backup_${new Date().toISOString().slice(0, 10)}.json`;

        const message = await sendTelegramDocument(telegramBotToken, telegramChatId, blob, filename);
        if (message && message.message_id) {
            const pinned = await pinTelegramMessage(telegramBotToken, telegramChatId, message.message_id);
            if (pinned) {
                settingsStatus.textContent = 'Backup Pinned! ✅';
                settingsStatus.className = 'status-msg success';
            } else {
                settingsStatus.textContent = 'Uploaded, but Pin failed. (Bot needs Admin?)';
                settingsStatus.className = 'status-msg warning';
            }
        } else {
            throw new Error('Upload failed');
        }
    } catch (e) {
        console.error(e);
        settingsStatus.textContent = 'Backup Failed ❌';
        settingsStatus.className = 'status-msg error';
    }
});

// -- Logger --
function uiLog(msg) {
    console.log(msg);
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        logEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
        logEl.scrollTop = logEl.scrollHeight;
    }
}
document.getElementById('btn-toggle-logs')?.addEventListener('click', () => {
    const logEl = document.getElementById('debug-log');
    if (logEl.style.display === 'none') {
        logEl.style.display = 'block';
    } else {
        logEl.style.display = 'none';
    }
});

// Restore from Telegram
btnRestore.addEventListener('click', async () => {
    uiLog('Restore Button Clicked. Starting...');
    // Removed confirm() to debug if it was blocking Atlas

    const { telegramBotToken, telegramChatId } = await chrome.storage.local.get(['telegramBotToken', 'telegramChatId']);
    uiLog(`Starting Restore. Token present: ${!!telegramBotToken}, ChatID: ${telegramChatId}`);

    if (!telegramBotToken || !telegramChatId) {
        uiLog('Error: Missing Token/ID');
        alert('Please save Bot Token and Chat ID first.');
        return;
    }

    settingsStatus.textContent = 'Restoring... (See logs)';
    settingsStatus.className = 'status-msg';

    try {
        // 1. Get Chat info
        uiLog('Step 1: Fetching Chat Info...');
        const resolvedChatId = await resolveTelegramChatId(telegramBotToken, telegramChatId);
        uiLog(`Resolved Chat ID: ${resolvedChatId}`);
        const chat = await getTelegramChat(telegramBotToken, telegramChatId);
        uiLog(`Chat info received: ${JSON.stringify(chat)}`);

        if (!chat) throw new Error('Could not access Telegram Chat. Check ID/Token.');

        // 2. Get File Path
        uiLog('Step 2: Finding Backup File...');
        const pinnedDoc = chat.pinned_message?.document || null;
        const backupDocument = pinnedDoc || await findLatestBackupDocument(telegramBotToken, resolvedChatId);
        if (!backupDocument) {
            throw new Error('No backup file found. Pin a backup message or create a new TG backup first.');
        }
        if (pinnedDoc) {
            uiLog('Using pinned backup document.');
        } else {
            uiLog('Pinned document missing; using latest backup file from chat history.');
        }
        const fileId = backupDocument.file_id;
        const file_path = await getTelegramFile(telegramBotToken, fileId);
        uiLog(`File path received: ${file_path}`);

        if (!file_path) throw new Error('Could not get file path.');

        // 3. Download
        uiLog('Step 3: Downloading File...');
        const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${file_path}`;
        const response = await fetch(fileUrl);
        uiLog(`Download response: ${response.status} ${response.statusText}`);

        if (!response.ok) throw new Error(`Download HTTP Error: ${response.status}`);

        const jsonString = await response.text();
        uiLog(`File downloaded. Size: ${jsonString.length} chars`);

        // 4. Import
        const success = await Storage.importData(jsonString);
        if (success) {
            uiLog('Restore Complete! Refreshing data...');
            settingsStatus.textContent = 'Restore Complete! ✅';
            settingsStatus.className = 'status-msg success';
            await refreshData();
        } else {
            throw new Error('Import validation failed.');
        }

    } catch (e) {
        uiLog(`ERROR: ${e.message}`);
        settingsStatus.textContent = `Restore failed: ${e.message}`;
        settingsStatus.className = 'status-msg error';
        // Also show logs automatically on error
        document.getElementById('debug-log').style.display = 'block';
    }
});

// ... (existing code)

// -- Telegram API Helpers --
async function sendTelegramDocument(token, chatId, blob, filename) {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', blob, filename);
    formData.append('caption', '📦 ReadLater Backup - Pin this message to restore from it later.');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if (!data.ok) {
        throw new Error(data.description || `sendDocument failed (${data.error_code || 'unknown'})`);
    }
    return data.result;
}

async function pinTelegramMessage(token, chatId, messageId) {
    const response = await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId
        })
    });
    const data = await response.json();
    return data.ok;
}

async function getTelegramChat(token, chatId) {
    const response = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId })
    });
    const data = await response.json();
    if (!data.ok) {
        throw new Error(data.description || `getChat failed (${data.error_code || 'unknown'})`);
    }
    return data.result;
}

async function getTelegramFile(token, fileId) {
    const response = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
    });
    const data = await response.json();
    if (!data.ok) {
        throw new Error(data.description || `getFile failed (${data.error_code || 'unknown'})`);
    }
    return data.result.file_path;
}

function isLikelyBackupMessage(message) {
    const doc = message?.document;
    if (!doc) return false;

    const fileName = doc.file_name || '';
    const mimeType = doc.mime_type || '';
    const caption = message.caption || '';

    if (fileName.startsWith('readlater_backup_')) return true;
    if (caption.includes('ReadLater Backup')) return true;
    if (fileName.endsWith('.json')) return true;
    if (mimeType === 'application/json') return true;
    return false;
}

async function findLatestBackupDocument(token, resolvedChatId) {
    const updates = await getTelegramUpdates(token, 0);
    if (!updates || updates.length === 0) return null;

    const messagesWithBackupFile = updates
        .map(update => update.message)
        .filter(message => message && String(message.chat?.id) === String(resolvedChatId))
        .filter(message => isLikelyBackupMessage(message));

    if (messagesWithBackupFile.length === 0) return null;

    messagesWithBackupFile.sort((a, b) => b.message_id - a.message_id);
    return messagesWithBackupFile[0].document;
}

function getConvexHeaders(syncKey = '') {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    if (syncKey) headers['x-sync-key'] = syncKey;
    return headers;
}

async function getResponseErrorMessage(response, fallback) {
    try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const payload = await response.json();
            return payload?.error || payload?.message || JSON.stringify(payload);
        }
        const text = (await response.text()).trim();
        if (text) return text;
    } catch (e) {
        console.error('Failed to parse error response', e);
    }
    return fallback;
}

async function backupToConvex() {
    const { convexBackupUrl, convexSyncKey } = await chrome.storage.local.get(['convexBackupUrl', 'convexSyncKey']);
    if (!convexBackupUrl) {
        alert('Please add Convex Backup URL in Settings and click Save Settings.');
        return;
    }

    settingsStatus.textContent = 'Backing up to Convex...';
    settingsStatus.className = 'status-msg';

    try {
        const jsonString = await Storage.exportData();
        const payload = JSON.parse(jsonString);
        const response = await fetch(convexBackupUrl, {
            method: 'POST',
            headers: getConvexHeaders(convexSyncKey || ''),
            body: JSON.stringify({
                source: 'readlater_todos_extension',
                exportedAt: Date.now(),
                data: payload
            })
        });

        if (!response.ok) {
            const details = await getResponseErrorMessage(response, `Convex backup failed (${response.status})`);
            throw new Error(details);
        }

        settingsStatus.textContent = 'Convex backup complete ✅';
        settingsStatus.className = 'status-msg success';
    } catch (e) {
        console.error(e);
        settingsStatus.textContent = `Convex backup failed: ${e.message}`;
        settingsStatus.className = 'status-msg error';
    }
}

async function restoreFromConvex() {
    const { convexRestoreUrl, convexSyncKey } = await chrome.storage.local.get(['convexRestoreUrl', 'convexSyncKey']);
    if (!convexRestoreUrl) {
        alert('Please add Convex Restore URL in Settings and click Save Settings.');
        return;
    }

    settingsStatus.textContent = 'Restoring from Convex...';
    settingsStatus.className = 'status-msg';

    try {
        const response = await fetch(convexRestoreUrl, {
            method: 'POST',
            headers: getConvexHeaders(convexSyncKey || ''),
            body: JSON.stringify({
                source: 'readlater_todos_extension'
            })
        });

        if (!response.ok) {
            const details = await getResponseErrorMessage(response, `Convex restore failed (${response.status})`);
            throw new Error(details);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Convex restore endpoint must return JSON');
        }
        const data = await response.json();
        const snapshot = data.data || data.backup || data;
        const jsonString = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);

        const success = await Storage.importData(jsonString);
        if (!success) throw new Error('Convex payload is not valid extension data');

        settingsStatus.textContent = 'Convex restore complete ✅';
        settingsStatus.className = 'status-msg success';
        await refreshData();
    } catch (e) {
        console.error(e);
        settingsStatus.textContent = `Convex restore failed: ${e.message}`;
        settingsStatus.className = 'status-msg error';
    }
}

// -- Telegram Sync Logic (Tasks) --

async function syncTelegramTasksHandler() {
    const btn = document.getElementById('btn-sync-telegram');
    const originalText = btn.innerHTML;
    btn.textContent = 'Syncing...';
    btn.disabled = true;

    try {
        const count = await fetchNewTelegramTasks();
        if (count > 0) {
            btn.textContent = `Synced ${count} items!`;
            btn.style.backgroundColor = '#dcfce7';
            btn.style.color = '#166534';
            await refreshData();
        } else {
            btn.textContent = 'No new items';
        }
    } catch (e) {
        console.error(e);
        btn.textContent = 'Error';
        btn.style.backgroundColor = '#fee2e2';
        btn.style.color = '#991b1b';
    }

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.backgroundColor = '#f0f9ff';
        btn.style.color = '#0369a1';
    }, 3000);
}

document.getElementById('btn-convex-backup')?.addEventListener('click', backupToConvex);
document.getElementById('btn-convex-restore')?.addEventListener('click', restoreFromConvex);

async function fetchNewTelegramTasks() {
    const { telegramBotToken, telegramChatId, lastProcessedUpdateId } = await chrome.storage.local.get(['telegramBotToken', 'telegramChatId', 'lastProcessedUpdateId']);

    if (!telegramBotToken || !telegramChatId) {
        alert("Please configure Bot Token and Chat ID in Settings.");
        throw new Error("Missing configs");
    }

    const resolvedChatId = await resolveTelegramChatId(telegramBotToken, telegramChatId);

    // Offset = lastId + 1
    const offset = lastProcessedUpdateId ? lastProcessedUpdateId + 1 : 0;
    const updates = await getTelegramUpdates(telegramBotToken, offset);

    if (!updates || updates.length === 0) return 0;

    let processedCount = 0;
    let maxUpdateId = lastProcessedUpdateId || 0;

    for (const update of updates) {
        if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;

        // Verify Chat ID matches (allow strings or numbers comparison)
        if (!update.message || String(update.message.chat.id) !== resolvedChatId) continue;

        // Skip if is a document/backup or empty text
        if (update.message.document || !update.message.text) continue;

        const text = update.message.text;
        const itemData = processTelegramMessage(text);

        if (itemData) {
            if (itemData.type === 'course') {
                await Storage.addCourseItem(itemData);
            } else if (itemData.type === 'reading') {
                await Storage.addReadingItem(itemData);
            } else {
                await Storage.addTodoItem(itemData);
            }
            processedCount++;
        }
    }

    await chrome.storage.local.set({ lastProcessedUpdateId: maxUpdateId });
    return processedCount;
}

function processTelegramMessage(text) {
    if (!text) return null;

    // Split lines for Title / Notes
    const lines = text.split('\n');
    let title = lines[0].trim();
    // Notes are everything after first line
    let description = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';

    // 1. Check for Course
    if (text.startsWith('/course') || text.includes('#course')) {
        // Remove command/tag from title line
        title = title.replace('/course', '').replace('#course', '').trim();

        // Extract URL
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
        const url = urlMatch ? urlMatch[0] : '';
        if (url) title = title.replace(url, '').trim();

        // Extract Tags (excluding #course)
        const tags = (title.match(/#[\w-]+/g) || [])
            .map(t => t.substring(1)); // Remove #
        // Also remove tags from title
        tags.forEach(t => title = title.replace('#' + t, '').trim());

        return {
            type: 'course',
            title: title || 'New Course',
            url: url,
            description: description,
            tags: tags
        };
    }

    // 2. Check for Reading (URL presence)
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
    // If URL is present and NOT a course
    if (urlMatch) {
        const url = urlMatch[0];
        // Remove URL from Title
        title = title.replace(url, '').trim();

        const tags = (title.match(/#[\w-]+/g) || [])
            .map(t => t.substring(1));
        tags.forEach(t => title = title.replace('#' + t, '').trim());

        return {
            type: 'reading',
            title: title || 'New Article',
            url: url,
            description: description,
            tags: tags
        };
    }

    // 3. Todo Logic (Default)
    // Extract Metadata
    const dateMatch = title.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    const dueDate = dateMatch ? dateMatch[1] : '';
    if (dueDate) title = title.replace(dateMatch[0], '').trim();

    const isUrgent = title.toLowerCase().includes('!urgent');
    if (isUrgent) title = title.replace(/!urgent/i, '').trim();

    const isImportant = title.toLowerCase().includes('!important');
    if (isImportant) title = title.replace(/!important/i, '').trim();

    const tags = (title.match(/#[\w-]+/g) || []).map(t => t.substring(1));
    tags.forEach(t => title = title.replace('#' + t, '').trim());

    return {
        type: 'todo',
        title: title || 'New Task',
        description: description,
        dueDate: dueDate,
        isUrgent: isUrgent,
        isImportant: isImportant,
        tags: tags,
        url: ''
    };
}

async function getTelegramUpdates(token, offset) {
    const apiUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (!data.ok && data.error_code === 409) {
            // Recover when webhook is set for this bot from another integration.
            const recovered = await clearTelegramWebhook(token);
            if (!recovered) return [];
            const retryResponse = await fetch(apiUrl);
            const retryData = await retryResponse.json();
            return retryData.ok ? retryData.result : [];
        }
        return data.ok ? data.result : [];
    } catch (e) {
        console.error('Telegram polling failed', e);
        return [];
    }
}

async function clearTelegramWebhook(token) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
        const data = await response.json();
        if (!data.ok) {
            console.error('Failed to clear Telegram webhook', data);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Webhook clear failed', e);
        return false;
    }
}

function escapeMarkdown(text) {
    // Only escape characters that break Telegram's Markdown parsing
    return text.replace(/[_*`\[\]]/g, '\\$&');
}
