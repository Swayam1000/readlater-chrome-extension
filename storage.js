/**
 * Data Model:
 * ReadingItem: { id, url, title, favIconUrl, notes, tags: [], status: 'unread'|'done', linkedTodoIds: [], createdAt }
 * TodoItem: { id, title, description, status: 'open'|'done', priority: 'medium', dueDate, linkedReadingIds: [], createdAt }
 */

const Storage = {
  // Load all data
  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['readingList', 'todoList'], (result) => {
        resolve({
          readingList: result.readingList || [],
          todoList: result.todoList || []
        });
      });
    });
  },

  // Save entire lists (internal helper)
  async _saveLists(readingList, todoList) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ readingList, todoList }, () => {
        resolve();
      });
    });
  },

  async addReadingItem(item) {
    const { readingList, todoList } = await this.loadData();
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'unread',
      linkedTodoIds: []
    };
    readingList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList);
    return newItem;
  },

  async addTodoItem(item) {
    const { readingList, todoList } = await this.loadData();
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'open',
      linkedReadingIds: []
    };
    todoList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList);
    return newItem;
  },

  async updateReadingItem(id, updates) {
    const { readingList, todoList } = await this.loadData();
    const index = readingList.findIndex(i => i.id === id);
    if (index !== -1) {
      readingList[index] = { ...readingList[index], ...updates };
      await this._saveLists(readingList, todoList);
    }
  },

  async updateTodoItem(id, updates) {
    const { readingList, todoList } = await this.loadData();
    const index = todoList.findIndex(i => i.id === id);
    if (index !== -1) {
      todoList[index] = { ...todoList[index], ...updates };
      await this._saveLists(readingList, todoList);
    }
  },

  async deleteReadingItem(id) {
    const { readingList, todoList } = await this.loadData();
    const index = readingList.findIndex(i => i.id === id);
    if (index !== -1) {
      // Remove links from todos
      const item = readingList[index];
      item.linkedTodoIds.forEach(todoId => {
        const todo = todoList.find(t => t.id === todoId);
        if (todo) {
          todo.linkedReadingIds = todo.linkedReadingIds.filter(rid => rid !== id);
        }
      });
      readingList.splice(index, 1);
      await this._saveLists(readingList, todoList);
    }
  },

  async deleteTodoItem(id) {
    const { readingList, todoList } = await this.loadData();
    const index = todoList.findIndex(i => i.id === id);
    if (index !== -1) {
      // Remove links from reading items
      const item = todoList[index];
      item.linkedReadingIds.forEach(readingId => {
        const rItem = readingList.find(r => r.id === readingId);
        if (rItem) {
          rItem.linkedTodoIds = rItem.linkedTodoIds.filter(tid => tid !== id);
        }
      });
      todoList.splice(index, 1);
      await this._saveLists(readingList, todoList);
    }
  },

  async linkItems(todoId, readingId) {
    const { readingList, todoList } = await this.loadData();
    const todo = todoList.find(t => t.id === todoId);
    const reading = readingList.find(r => r.id === readingId);

    if (todo && reading) {
      if (!todo.linkedReadingIds.includes(readingId)) {
        todo.linkedReadingIds.push(readingId);
      }
      if (!reading.linkedTodoIds.includes(todoId)) {
        reading.linkedTodoIds.push(todoId);
      }
      await this._saveLists(readingList, todoList);
    }
  },

  async unlinkItems(todoId, readingId) {
    const { readingList, todoList } = await this.loadData();
    const todo = todoList.find(t => t.id === todoId);
    const reading = readingList.find(r => r.id === readingId);

    if (todo) {
      todo.linkedReadingIds = todo.linkedReadingIds.filter(id => id !== readingId);
    }
    if (reading) {
      reading.linkedTodoIds = reading.linkedTodoIds.filter(id => id !== todoId);
    }
    await this._saveLists(readingList, todoList);
  }
    // -- Data Sync --
  static async exportData() {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data);
  }

  static async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON');

      // Basic validation
      if (!data.readingList && !data.todoList) throw new Error('No recognized data found');

      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
};

// Export for usage in modules (if using checking) or just global in non-module context
// For Chrome Extensions without modules, we often just attach to window or let it be global.
// We will export it as a global object.
globalThis.Storage = Storage;
