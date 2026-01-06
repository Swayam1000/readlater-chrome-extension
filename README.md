# ReadLater + Todos Chrome Extension

A lightweight, privacy-focused Chrome extension to manage your reading list and daily tasks side-by-side. 
Built with **Manifest V3**, it stores all data locally in your browser and supports bi-directional linking between readings and tasks.

## Features

- 📚 **Reading List**: Save current tabs with one click.
- ✅ **Todo List**: Manage tasks and "Writing Ideas".
- 🏷️ **Dynamic Tags**: Tag your items (e.g., "Must-read", "Job to apply", "Draft").
- 🔗 **Bi-directional Linking**: Link reading items to specific tasks (e.g., link a research article to a "Writing" task).
- ✈️ **Telegram Sync**: Automatically send "Must-read" links to your personal Telegram chat.
- 🔒 **Privacy First**: No backend, no accounts. All data stays in `chrome.storage.local`.

## Installation

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `readlater_todos` folder from this repository.

## Usage

### Saving Pages
- Click the extension icon.
- In the "Reading" tab, select a tag (optional) and click **Save Current Tab**.

### Managing Todos
- Switch to the "Todos" tab.
- Add new tasks.
- Use the `+` button on a task to tag it (e.g., "Idea", "Priority").

### Linking Items
- Click the `🔗 linked` badge on any item.
- Select the item from the other list you want to link to.

### Telegram Sync Setup
1. Go to **Settings** (⚙️ icon).
2. Enter your **Bot Token** and **Chat ID**.
3. Use the **Test Connection** button to verify.
4. Tag any item as **"Must-read"** to instantly sync it to Telegram.

## Permissions

- `storage`: To save your lists locally.
- `activeTab`: To capture the title and URL of the page you are saving.
- `contextMenus`: (Optional) To save pages via right-click.

## License

MIT
