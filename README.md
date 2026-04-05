# ReadLater + Todos Chrome Extension

A lightweight, privacy-focused Chrome extension to manage your reading list and daily tasks side-by-side. 
Built with **Manifest V3**, it stores all data locally in your browser and supports bi-directional linking between readings and tasks.

## Features

### 📚 Reading List
- **One-click Save**: Instantly save the current tab.
- **Tags**: Organize with color-coded tags (e.g., "Must-read", "Structure").
- **Dynamic Colors**: New tags automatically get assigned a consistent, vibrant color.

### ✅ Todo List
- **Task Management**: Create tasks directly or **save the current tab as a task**.
- **Context**: Add notes to any task.
- **Rich Links**: Tasks saved from tabs include a direct link to the source URL.
- **Workflow**: Mark items as done (✓) or delete them (×) with a single click.

### 🔗 Bi-directional Linking
- Link any **Reading Item** to a **Todo Task** (and vice versa).
- Useful for connecting research materials to the tasks that require them.

### ✈️ Telegram Sync
Automatically sync important items to your Telegram Channel or Chat.
- Tag as **"Must-read"** → Sends with 📚 emoji.
- Tag as **"Video to watch"** → Sends with 🎬 emoji.

### 🔒 Privacy First
- No backend.
- No user accounts.
- All data resides in `chrome.storage.local`.

## Installation

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `readlater_todos` folder from this repository.

## Usage

### Saving Pages (Reading)
1. Open the **Reading** tab.
2. Select a tag (optional).
3. Click **Save Current Tab**.

### Clip And Send To Obsidian
1. Open the page you want in Obsidian.
2. Open the extension on the **Reading** tab.
3. Click **Clip and send to Obsidian**.
4. The current page is saved to ReadDo and the managed note `AI Learnings/sources/READO.md` is updated immediately.

### Managing Todos
1. Open the **Todos** tab.
2. (Optional) Select a tag and add a **Note**.
3. Click **Save Current Tab** to capture the current page as a task, or type a title and click **Add Task** for a manual task.
4. Use the tick checkmark (✓) to toggle status and the cross (×) to delete.

### ☁️ Cloud Sync (Multi-Device Support)
Sync your data between different browsers (e.g., Chrome, Brave, ChatGPT Atlas) using your Telegram Chat as a secure cloud storage.

1.  **Backup**:
    *   Go to **Settings** -> Click **☁️ Backup to TG**.
    *   This uploads your data to your chat and **Pins** the message.
2.  **Restore**:
    *   On your other device, enter the same Bot Token & Chat ID.
    *   Click **📥 Restore from TG**.
    *   The extension finds the pinned backup and restores your data.

> **Note for Atlas Browser Users**: If you cannot copy/paste your token using keyboard shortcuts, use the **Paste 📋** button next to the input fields.

### Convex Sync Setup (New)
You can also sync via Convex HTTP Actions.

This repo now includes ready Convex handlers:
- `convex/http.ts` (`/backup`, `/restore`)
- `convex/backups.ts`
- `convex/schema.ts`

1. Initialize/deploy Convex from this repo:
```bash
npx convex dev
```

2. Optional security key:
- In Convex dashboard, add env var `CONVEX_SYNC_KEY=<your-secret>`
- Put the same value in extension setting `Convex Sync Key`

3. Open extension **Settings** and fill:
- `Convex Backup URL`: `https://<your-deployment>.convex.site/backup`
- `Convex Restore URL`: `https://<your-deployment>.convex.site/restore`
- `Convex Sync Key`: same secret as above (or blank if not using one)

4. Click **Save Settings**, then test:
- **☁️ Backup to Convex**
- **📥 Restore from Convex**

### Obsidian Sync Setup
You can sync the extension into one managed Markdown note inside your Obsidian vault.

What gets updated:
- One file only, for example `AI Learnings/sources/READO.md`
- The extension rewrites that same note in place on each sync
- No other Obsidian files are created or modified

Setup:
1. Install and open Obsidian at least once on your machine.
2. Open the extension **Settings** and expand **Obsidian Vault**.
3. Fill:
- `Vault Name, ID, or Absolute Path`: either the exact Obsidian vault name, the vault ID, or the full filesystem path to the vault folder
- `Managed Note Path`: relative path to the note inside the vault, default `AI Learnings/sources/READO.md`
- `Auto-sync changes to Obsidian`: optional, off by default
4. Click **Save Obsidian Settings**.
5. Click **Grant Vault Access** and choose the actual vault folder for reliable direct file writes.
6. Click **Sync All to Obsidian** to write the managed note.

Notes:
- No Obsidian plugin is required.
- Direct vault access is required for writing. The extension does not use `obsidian://new` for sync writes anymore.
- If vault lookup fails, use the full absolute path to the vault folder instead of the display name.
- Auto-sync refreshes the managed note when you add, update, delete, or relink items.
- Manual sync is the safest first run because it rewrites the full note in one pass.

### 📱 Telegram Setup
1.  Create a bot via [@BotFather](https://t.me/BotFather) and get the **API Token**.
2.  Start a chat with your bot (or add it to a group/channel).
3.  Get your **Chat ID** (forward a message to [@userinfobot](https://t.me/userinfobot)).
4.  **Important**: If using a Group/Channel, ensure the Bot is an **Admin** with "Pin Messages" permission.

### Telegram Sync Setup
1. Go to **Settings** (⚙️ icon).
2. Enter your **Bot Token** and **Chat ID** (or Channel Username like `@mychannel`).
3. Use the **Test Connection** button to verify.
4. Add tags `Must-read` or `Video to watch` to items to sync them.

## License

MIT
