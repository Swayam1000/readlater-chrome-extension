/**
 * Data Model:
 * ReadingItem: { id, url, title, favIconUrl, notes, tags: [], status: 'unread'|'done', linkedTodoIds: [], createdAt }
 * CourseItem: { id, url, title, favIconUrl, notes, tags: [], status: 'unread'|'done', linkedTodoIds: [], createdAt }
 * TodoItem: { id, title, description, status: 'open'|'done', priority: 'medium', dueDate, linkedReadingIds: [], linkedCourseIds: [], createdAt }
 */

const Storage = {
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
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'unread',
      linkedTodoIds: []
    };
    readingList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList, null, await this._getCourseList());
    return newItem;
  },

  async addCourseItem(item) {
    const { readingList, todoList, courseList } = await this.loadData();
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'unread',
      linkedTodoIds: []
    };
    courseList.unshift(newItem); // Add to top
    await this._saveLists(readingList, todoList, null, courseList);
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
      await this._saveLists(readingList, todoList, null, await this._getCourseList());
    }
  },

  async updateCourseItem(id, updates) {
    const { readingList, todoList, courseList } = await this.loadData();
    const index = courseList.findIndex(i => i.id === id);
    if (index !== -1) {
      courseList[index] = { ...courseList[index], ...updates };
      await this._saveLists(readingList, todoList, null, courseList);
    }
  },

  async updateTodoItem(id, updates) {
    const { readingList, todoList } = await this.loadData();
    const index = todoList.findIndex(i => i.id === id);
    if (index !== -1) {
      todoList[index] = { ...todoList[index], ...updates };
      await this._saveLists(readingList, todoList, null, await this._getCourseList());
    }
  },

  async deleteReadingItem(id) {
    const { readingList, todoList, historyList } = await this.loadData();
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

      // Add to history
      const historyItem = {
        ...item,
        status: 'deleted',
        deletedAt: Date.now(),
        type: 'reading' // Mark type
      };
      historyList.unshift(historyItem);

      readingList.splice(index, 1);
      await this._saveLists(readingList, todoList, historyList);
    }
  },

  async deleteTodoItem(id) {
    const { readingList, todoList, historyList, courseList } = await this.loadData();
    const nextCourseList = courseList || [];
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

      // Remove links from course items
      (item.linkedCourseIds || []).forEach(courseId => {
        const cItem = nextCourseList.find(c => c.id === courseId);
        if (cItem) {
          cItem.linkedTodoIds = cItem.linkedTodoIds.filter(tid => tid !== id);
        }
      });

      // Add to history
      const historyItem = {
        ...item,
        status: 'deleted',
        deletedAt: Date.now(),
        type: 'todo' // Mark type
      };
      historyList.unshift(historyItem);

      todoList.splice(index, 1);
      await this._saveLists(readingList, todoList, historyList, nextCourseList);
    }
  },

  async deleteCourseItem(id) {
    const { readingList, todoList, historyList, courseList } = await this.loadData();
    const index = courseList.findIndex(i => i.id === id);
    if (index !== -1) {
      // Remove links from todos
      const item = courseList[index];
      item.linkedTodoIds.forEach(todoId => {
        const todo = todoList.find(t => t.id === todoId);
        if (todo) {
          todo.linkedCourseIds = (todo.linkedCourseIds || []).filter(cid => cid !== id);
        }
      });

      // Add to history
      const historyItem = {
        ...item,
        status: 'deleted',
        deletedAt: Date.now(),
        type: 'course' // Mark type
      };
      historyList.unshift(historyItem);

      courseList.splice(index, 1);
      await this._saveLists(readingList, todoList, historyList, courseList);
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
    await this._saveLists(readingList, todoList, null, await this._getCourseList());
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
  },

  // Helper to ensure we don't overwrite current courseList when using old save methods
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
