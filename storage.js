/**
 * Data Model:
 * ReadingItem: { id, url, title, favIconUrl, notes, tags: [], status: 'unread'|'done', linkedTodoIds: [], createdAt }
 * CourseItem: { id, url, title, favIconUrl, notes, tags: [], status: 'unread'|'done', linkedTodoIds: [], createdAt }
 * TodoItem: { id, title, description, status: 'open'|'done', priority: 'medium', dueDate, linkedReadingIds: [], linkedCourseIds: [], createdAt }
 */

const Storage = {
  async _syncObsidianItemsIfEnabled() {
    const obsidianSync = globalThis.ObsidianSync;
    if (obsidianSync && typeof obsidianSync.syncItemsIfEnabled === 'function') {
      try {
        await obsidianSync.syncItemsIfEnabled();
      } catch (error) {
        console.error('Obsidian auto-sync failed', error);
      }
    }
  },

  async _syncObsidianAllIfEnabled() {
    const obsidianSync = globalThis.ObsidianSync;
    if (obsidianSync && typeof obsidianSync.syncAllIfEnabled === 'function') {
      try {
        await obsidianSync.syncAllIfEnabled();
      } catch (error) {
        console.error('Obsidian auto-sync failed', error);
      }
    }
  },

  // Load all data
  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['readingList', 'todoList', 'historyList', 'courseList'], (result) => {
        resolve({
          readingList: result.readingList || [],
          courseList: result.courseList || [],
          todoList: result.todoList || [],
          historyList: result.historyList || []
        });
      });
    });
  },

  // Save entire lists (internal helper)
  async _saveLists(readingList, todoList, historyList = null, courseList = null) {
    return new Promise((resolve) => {
      const data = { readingList, todoList };
      if (historyList !== null) data.historyList = historyList;
      if (courseList !== null) data.courseList = courseList;
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  },

  async addReadingItem(item) {
    const { readingList, todoList } = await this.loadData();
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const newItem = {
      ...item,
      id,
      createdAt,
      status: 'unread',
      linkedTodoIds: []
    };
    readingList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList, null, await this._getCourseList());
    await this._syncObsidianItemsIfEnabled();
    return newItem;
  },

  async addCourseItem(item) {
    const { readingList, todoList, courseList } = await this.loadData();
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const newItem = {
      ...item,
      id,
      createdAt,
      status: 'unread',
      linkedTodoIds: []
    };
    courseList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList, null, courseList);
    await this._syncObsidianItemsIfEnabled();
    return newItem;
  },

  async addTodoItem(item) {
    const { readingList, todoList } = await this.loadData();
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const newItem = {
      ...item,
      id,
      createdAt,
      status: 'open',
      linkedReadingIds: [],
      linkedCourseIds: item.linkedCourseIds || []
    };
    todoList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList);
    await this._syncObsidianItemsIfEnabled();
    return newItem;
  },

  async updateReadingItem(id, updates) {
    const { readingList, todoList } = await this.loadData();
    const index = readingList.findIndex(i => i.id === id);
    if (index !== -1) {
      readingList[index] = { ...readingList[index], ...updates, updatedAt: Date.now() };
      await this._saveLists(readingList, todoList, null, await this._getCourseList());
      await this._syncObsidianItemsIfEnabled();
    }
  },

  async updateCourseItem(id, updates) {
    const { readingList, todoList, courseList } = await this.loadData();
    const index = courseList.findIndex(i => i.id === id);
    if (index !== -1) {
      courseList[index] = { ...courseList[index], ...updates, updatedAt: Date.now() };
      await this._saveLists(readingList, todoList, null, courseList);
      await this._syncObsidianItemsIfEnabled();
    }
  },

  async updateTodoItem(id, updates) {
    const { readingList, todoList } = await this.loadData();
    const index = todoList.findIndex(i => i.id === id);
    if (index !== -1) {
      todoList[index] = { ...todoList[index], ...updates, updatedAt: Date.now() };
      await this._saveLists(readingList, todoList, null, await this._getCourseList());
      await this._syncObsidianItemsIfEnabled();
    }
  },

  async deleteReadingItem(id) {
    const { readingList, todoList, historyList } = await this.loadData();
    const index = readingList.findIndex(i => i.id === id);
    if (index !== -1) {
      const item = readingList[index];
      item.linkedTodoIds.forEach(todoId => {
        const todo = todoList.find(t => t.id === todoId);
        if (todo) {
          todo.linkedReadingIds = todo.linkedReadingIds.filter(rid => rid !== id);
        }
      });

      const historyItem = {
        ...item,
        status: 'deleted',
        deletedAt: Date.now(),
        type: 'reading'
      };
      historyList.unshift(historyItem);

      readingList.splice(index, 1);
      await this._saveLists(readingList, todoList, historyList);
      await this._syncObsidianItemsIfEnabled();
    }
  },

  async deleteTodoItem(id) {
    const { readingList, todoList, historyList, courseList } = await this.loadData();
    const nextCourseList = courseList || [];
    const index = todoList.findIndex(i => i.id === id);
    if (index !== -1) {
      const item = todoList[index];
      item.linkedReadingIds.forEach(readingId => {
        const rItem = readingList.find(r => r.id === readingId);
        if (rItem) {
          rItem.linkedTodoIds = rItem.linkedTodoIds.filter(tid => tid !== id);
        }
      });

      (item.linkedCourseIds || []).forEach(courseId => {
        const cItem = nextCourseList.find(c => c.id === courseId);
        if (cItem) {
          cItem.linkedTodoIds = cItem.linkedTodoIds.filter(tid => tid !== id);
        }
      });

      const historyItem = {
        ...item,
        status: 'deleted',
        deletedAt: Date.now(),
        type: 'todo'
      };
      historyList.unshift(historyItem);

      todoList.splice(index, 1);
      await this._saveLists(readingList, todoList, historyList, nextCourseList);
      await this._syncObsidianItemsIfEnabled();
    }
  },

  async deleteCourseItem(id) {
    const { readingList, todoList, historyList, courseList } = await this.loadData();
    const index = courseList.findIndex(i => i.id === id);
    if (index !== -1) {
      const item = courseList[index];
      item.linkedTodoIds.forEach(todoId => {
        const todo = todoList.find(t => t.id === todoId);
        if (todo) {
          todo.linkedCourseIds = (todo.linkedCourseIds || []).filter(cid => cid !== id);
        }
      });

      const historyItem = {
        ...item,
        status: 'deleted',
        deletedAt: Date.now(),
        type: 'course'
      };
      historyList.unshift(historyItem);

      courseList.splice(index, 1);
      await this._saveLists(readingList, todoList, historyList, courseList);
      await this._syncObsidianItemsIfEnabled();
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
      await this._syncObsidianItemsIfEnabled();
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
    await this._saveLists(readingList, todoList, null, await this._getCourseList());
    await this._syncObsidianItemsIfEnabled();
  },

  async linkCourseItem(todoId, courseId) {
    const { readingList, todoList, courseList } = await this.loadData();
    const todo = todoList.find(t => t.id === todoId);
    const course = courseList.find(c => c.id === courseId);

    if (todo && course) {
      if (!todo.linkedCourseIds) todo.linkedCourseIds = [];
      if (!todo.linkedCourseIds.includes(courseId)) {
        todo.linkedCourseIds.push(courseId);
      }
      if (!course.linkedTodoIds.includes(todoId)) {
        course.linkedTodoIds.push(todoId);
      }
      await this._saveLists(readingList, todoList, null, courseList);
      await this._syncObsidianItemsIfEnabled();
    }
  },

  async unlinkCourseItem(todoId, courseId) {
    const { readingList, todoList, courseList } = await this.loadData();
    const todo = todoList.find(t => t.id === todoId);
    const course = courseList.find(c => c.id === courseId);

    if (todo) {
      todo.linkedCourseIds = (todo.linkedCourseIds || []).filter(id => id !== courseId);
    }
    if (course) {
      course.linkedTodoIds = course.linkedTodoIds.filter(id => id !== todoId);
    }
    await this._saveLists(readingList, todoList, null, courseList);
    await this._syncObsidianItemsIfEnabled();
  },

  async _getCourseList() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['courseList'], (result) => {
        resolve(result.courseList || []);
      });
    });
  },

  // -- Data Sync --
  async exportData() {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data);
  },

  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON');

      // Basic validation
      if (!data.readingList && !data.todoList && !data.courseList) throw new Error('No recognized data found');

      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
      await this._syncObsidianAllIfEnabled();
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
};

globalThis.Storage = Storage;
