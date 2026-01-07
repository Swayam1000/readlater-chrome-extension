# ReadLater + Todos Chrome Extension

A lightweight, privacy-focused Chrome extension to manage your reading list and daily tasks side-by-side. 
Built with **Manifest V3**, it stores all data locally in your browser and supports bi-directional linking between readings and tasks.

## Features

### 📚 Reading List
- **One-click Save**: Instantly save the current tab.
- **Tags**: Organize with color-coded tags (e.g., "Must-read", "Structure").
- **Dynamic Colors**: valid PNGs New tags automatically get assigned a consistent, vibrant color.

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

### Managing Todos
1. Open the **Todos** tab.
2. (Optional) Select a tag and add a **Note**.
3. Click **Save Current Tab as Task** to capture the URL, or just type a title if adding manually (future update).
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
