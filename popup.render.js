function renderReadingList(list) {
    const container = lists.reading;
    container.innerHTML = '';

    // Apply Filter
    let displayList = list.filter(item => item.status !== 'done'); // Hide done items
    if (currentReadFilter) {
        displayList = displayList.filter(item => (item.tags || []).includes(currentReadFilter));
    }

    // Sort by Priority
    displayList.sort((a, b) => {
        const aPriority = (a.tags || []).includes('Priority');
        const bPriority = (b.tags || []).includes('Priority');
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return 0; // Keep original order (newest first)
    });

    if (displayList.length === 0) {
        emptyStates.reading.classList.toggle('hidden', list.length > 0);
        if (list.length > 0 && displayList.length === 0) {
            container.innerHTML = '<div class="empty-filter">No items with this tag.</div>';
        } else if (list.length === 0) {
            emptyStates.reading.classList.remove('hidden');
        }
    } else {
        emptyStates.reading.classList.add('hidden');
        displayList.forEach(item => {
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
            <button class="action-btn btn-add-tag" title="Add Tag">+</button>
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

function renderCourseList(list) {
    const container = lists.course;
    container.innerHTML = '';

    // Apply Filter
    let displayList = list.filter(item => item.status !== 'done'); // Hide done items
    if (currentCourseFilter) {
        displayList = displayList.filter(item => (item.tags || []).includes(currentCourseFilter));
    }

    if (displayList.length === 0) {
        emptyStates.course.classList.toggle('hidden', list.length > 0);
        if (list.length > 0 && displayList.length === 0) {
            container.innerHTML = '<div class="empty-filter">No courses with this tag.</div>';
        } else if (list.length === 0) {
            emptyStates.course.classList.remove('hidden');
        }
    } else {
        emptyStates.course.classList.add('hidden');
        displayList.forEach(item => {
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
                 <button class="action-btn btn-toggle-status" title="Toggle Done Status">${item.status === 'done' ? '↩' : '✓'}</button>
                 <button class="action-btn btn-delete" title="Delete">×</button>
               </div>
            </div>
            <div class="tags-list">
                ${tagsHtml}
                <button class="action-btn btn-add-tag" title="Add Tag">+</button>
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
                await Storage.updateCourseItem(item.id, { status: newStatus });
                await refreshData();
            });

            li.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm('Delete this course?')) {
                    await Storage.deleteCourseItem(item.id);
                    await refreshData();
                }
            });

            li.querySelector('.link-badge').addEventListener('click', () => {
                openLinkOverlay(item.id, 'course');
            });

            li.querySelector('.btn-add-tag').addEventListener('click', () => {
                openTagOverlay(item.id, 'course'); // Pass type
            });

            container.appendChild(li);
        });
    }
}

function renderTodoList(list) {
    const container = lists.todos;
    container.innerHTML = '';

    // Apply Filter
    let displayList = list.filter(item => item.status !== 'done'); // Hide done items
    if (currentTodoFilter) {
        displayList = displayList.filter(item => (item.tags || []).includes(currentTodoFilter));
    }

    // Sort by Priority (Quadrant Logic)
    displayList.sort((a, b) => {
        // Calculate score: Important=2, Urgent=1.
        // Q1 (Imp+Urg) = 3
        // Q2 (Imp) = 2
        // Q3 (Urg) = 1
        // Q4 = 0
        const scoreA = (a.isImportant ? 2 : 0) + (a.isUrgent ? 1 : 0);
        const scoreB = (b.isImportant ? 2 : 0) + (b.isUrgent ? 1 : 0);

        if (scoreA > scoreB) return -1;
        if (scoreA < scoreB) return 1;

        // Secondary sort: Existing Priority tag
        const aPriority = (a.tags || []).includes('Priority');
        const bPriority = (b.tags || []).includes('Priority');
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;

        return 0;
    });

    if (displayList.length === 0) {
        if (list.length > 0) {
            container.innerHTML = '<div class="empty-filter">No tasks with this tag.</div>';
        } else {
            emptyStates.todos.classList.remove('hidden');
        }
    } else {
        emptyStates.todos.classList.add('hidden');
        displayList.forEach(item => {
            const li = document.createElement('li');
            li.className = 'item-card';

            const linkedCounts = (item.linkedReadingIds ? item.linkedReadingIds.length : 0) + (item.linkedCourseIds ? item.linkedCourseIds.length : 0);

            // Generate Tags HTML
            const tagsHtml = (item.tags || []).map(tag => {
                const className = getTagClass(tag);
                return `<span class="item-tag ${className}">${escapeHtml(tag)}</span>`;
            }).join('');

            // Generate URL and Note HTML
            const urlHtml = item.url ? `<div class="todo-url">🔗 <a href="${item.url}" target="_blank">${escapeHtml(new URL(item.url).hostname)}</a></div>` : '';
            const noteHtml = item.description ? `<div class="todo-note">${escapeHtml(item.description)}</div>` : '';
            const dateValue = item.dueDate ? item.dueDate : '';
            const dateInputHtml = `<input type="date" class="todo-date-edit" value="${dateValue}" title="Set Due Date">`;

            // Determine Quadrant Class and Label
            let quadrantClass = '';
            let quadrantLabel = '';
            if (item.isImportant && item.isUrgent) {
                quadrantClass = 'todo-q1'; // Do First
                quadrantLabel = '🔥⭐ Do First';
            } else if (item.isImportant) {
                quadrantClass = 'todo-q2'; // Schedule
                quadrantLabel = '⭐ Schedule';
            } else if (item.isUrgent) {
                quadrantClass = 'todo-q3'; // Delegate
                quadrantLabel = '🔥 Delegate';
            } else {
                quadrantClass = 'todo-q4'; // Eliminate
            }

            const titleHtml = item.url
                ? `<a href="${item.url}" target="_blank" class="item-title ${item.status === 'done' ? 'done' : ''}">${escapeHtml(item.title)}</a>`
                : `<span class="item-title ${item.status === 'done' ? 'done' : ''}">${escapeHtml(item.title)}</span>`;

            li.innerHTML = `
        <div class="item-header ${quadrantClass}">
           ${titleHtml}
           <div class="actions">
             <button class="action-btn btn-toggle-status" title="Toggle Done Status">${item.status === 'done' ? '↩' : '✓'}</button>
             <button class="action-btn btn-delete" title="Delete">×</button>
           </div>
        </div>
        ${urlHtml}
        ${noteHtml}
        <div>${dateInputHtml}</div>
        ${quadrantLabel ? `<div class="quadrant-badge ${quadrantClass}-badge">${quadrantLabel}</div>` : ''}
        <div class="tags-list">
            ${tagsHtml}
            <button class="action-btn btn-add-tag" title="Add Tag">+</button>
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

            // Date Change Listener
            li.querySelector('.todo-date-edit').addEventListener('change', async (e) => {
                const newDate = e.target.value;
                await Storage.updateTodoItem(item.id, { dueDate: newDate });
                // Optional: refreshData() if sorting depends on date
                // await refreshData(); 
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

function renderHistoryList() {
    const container = lists.history;
    container.innerHTML = '';

    // 1. Get Done items from active lists
    const doneReading = activeReadingList.filter(i => i.status === 'done').map(i => ({ ...i, type: 'reading', historyType: 'done' }));
    const doneCourses = activeCourseList.filter(i => i.status === 'done').map(i => ({ ...i, type: 'course', historyType: 'done' }));
    const doneTodos = activeTodoList.filter(i => i.status === 'done').map(i => ({ ...i, type: 'todo', historyType: 'done' }));

    // 2. Get Deleted items from storage history
    const deletedItems = activeHistoryList.map(i => ({ ...i, historyType: 'deleted' }));

    // 3. Combine and Sort
    let allHistory = [...doneReading, ...doneCourses, ...doneTodos, ...deletedItems];
    allHistory.sort((a, b) => {
        const timeA = a.historyType === 'deleted' ? a.deletedAt : (a.updatedAt || a.createdAt); // We might not have updatedAt for done, use createdAt fallback
        const timeB = b.historyType === 'deleted' ? b.deletedAt : (b.updatedAt || b.createdAt);
        return timeB - timeA; // Newest first
    });

    if (allHistory.length === 0) {
        emptyStates.history.classList.remove('hidden');
    } else {
        emptyStates.history.classList.add('hidden');
        allHistory.forEach(item => {
            const li = document.createElement('li');
            li.className = 'item-card history-card';

            const isDeleted = item.historyType === 'deleted';
            const statusBadge = isDeleted
                ? `<span class="history-status deleted">Deleted</span>`
                : `<span class="history-status done">Done</span>`;

            const typeIcon = item.type === 'reading' ? '📖' : (item.type === 'course' ? '🎓' : '✅');
            const typeLabel = item.type === 'reading' ? 'Reading' : (item.type === 'course' ? 'Course' : 'Task');
            const actionTime = isDeleted ? item.deletedAt : (item.updatedAt || item.createdAt);
            const hostLabel = item.url ? getHostname(item.url) : '';
            const actionLabel = isDeleted ? 'Deleted' : 'Completed';
            const relativeTime = formatHistoryTimestamp(actionTime);

            // Make title clickable if URL exists
            const titleHtml = item.url
                ? `<a href="${item.url}" target="_blank" class="item-title history-title">${escapeHtml(item.title)}</a>`
                : `<span class="item-title">${escapeHtml(item.title)}</span>`;

            // Show compact domain for scanability
            const domainHtml = item.url
                ? `<a href="${item.url}" target="_blank" class="history-domain" title="${escapeHtml(item.url)}">${escapeHtml(hostLabel)}</a>`
                : '';

            li.innerHTML = `
        <div class="item-header">
           <span class="history-header-icon">${typeIcon}</span>
           ${titleHtml}
           ${statusBadge}
        </div>
        <div class="history-meta-row">
           <span class="history-type">${typeLabel}</span>
           ${domainHtml}
        </div>
        <div class="history-time" title="${new Date(actionTime).toLocaleString()}">
           ${actionLabel} ${relativeTime}
        </div>
      `;
            container.appendChild(li);
        });
    }
}

function renderLinkCandidates() {
    linkCandidates.innerHTML = '';
    const { sourceId, type } = linkingState;

    // Define Candidates
    let candidates = [];
    if (type === 'reading' || type === 'course') {
        // Source is Reading or Course -> Link to Todos
        candidates = activeTodoList.map(i => ({ ...i, candidateType: 'todo' }));
    } else {
        // Source is Todo -> Link to Reading OR Course
        const readingCandidates = activeReadingList.map(i => ({ ...i, candidateType: 'reading' }));
        const courseCandidates = activeCourseList.map(i => ({ ...i, candidateType: 'course' }));
        candidates = [...readingCandidates, ...courseCandidates];
    }

    // Find Source Item
    let sourceItem;
    if (type === 'reading') sourceItem = activeReadingList.find(i => i.id === sourceId);
    else if (type === 'course') sourceItem = activeCourseList.find(i => i.id === sourceId);
    else sourceItem = activeTodoList.find(i => i.id === sourceId);

    if (!sourceItem) return;

    // Get Linked IDs
    let alreadyLinkedIds = [];
    if (type === 'reading' || type === 'course') {
        alreadyLinkedIds = sourceItem.linkedTodoIds || [];
    } else {
        // Todo source
        alreadyLinkedIds = [...(sourceItem.linkedReadingIds || []), ...(sourceItem.linkedCourseIds || [])];
    }

    candidates.forEach(item => {
        const isLinked = alreadyLinkedIds.includes(item.id);
        const li = document.createElement('li');
        li.className = `item-card small candidate-card ${isLinked ? 'linked' : ''}`.trim();

        const typeIcon = item.candidateType === 'todo' ? '✅' : (item.candidateType === 'course' ? '🎓' : '📖');

        li.innerHTML = `
      <div class="item-header">
        <span class="history-header-icon">${typeIcon}</span>
        <span class="item-title">${escapeHtml(item.title)}</span>
        ${isLinked ? '<span class="candidate-linked-label">Linked</span>' : ''}
      </div>
    `;

        li.addEventListener('click', async () => {
            const isTodoCandidate = item.candidateType === 'todo'; // i.e. source is reading/course
            const isCourseCandidate = item.candidateType === 'course';
            const isReadingCandidate = item.candidateType === 'reading';

            if (isLinked) {
                // Unlink
                if (type === 'reading') {
                    await Storage.unlinkItems(item.id, sourceId); // item is todo
                } else if (type === 'course') {
                    await Storage.unlinkCourseItem(item.id, sourceId); // item is todo
                } else {
                    // source is todo
                    if (isReadingCandidate) await Storage.unlinkItems(sourceId, item.id);
                    if (isCourseCandidate) await Storage.unlinkCourseItem(sourceId, item.id);
                }
            } else {
                // Link
                if (type === 'reading') {
                    await Storage.linkItems(item.id, sourceId);
                } else if (type === 'course') {
                    await Storage.linkCourseItem(item.id, sourceId);
                } else {
                    // source is todo
                    if (isReadingCandidate) await Storage.linkItems(sourceId, item.id);
                    if (isCourseCandidate) await Storage.linkCourseItem(sourceId, item.id);
                }
            }

            // Refresh
            const data = await Storage.loadData();
            activeReadingList = data.readingList;
            activeCourseList = data.courseList || [];
            activeTodoList = data.todoList;

            // Re-render candidates
            // Also update source item reference to check links correctly
            if (type === 'reading') sourceItem = activeReadingList.find(i => i.id === sourceId);
            else if (type === 'course') sourceItem = activeCourseList.find(i => i.id === sourceId);
            else sourceItem = activeTodoList.find(i => i.id === sourceId);

            renderLinkCandidates();
            refreshData(); // Refresh bg list
        });

        linkCandidates.appendChild(li);
    });
}

async function renderTagCandidates(itemId) {
    tagCandidates.innerHTML = '';
    // Determine source list
    let sourceList;
    if (taggingTargetType === 'todo') sourceList = activeTodoList;
    else if (taggingTargetType === 'course') sourceList = activeCourseList;
    else sourceList = activeReadingList;

    const item = sourceList.find(i => i.id === itemId);

    const existingTags = item ? (item.tags || []) : [];
    const availableTags = await getAvailableTags();

    availableTags.forEach(tag => {
        const isSelected = existingTags.includes(tag);
        const span = document.createElement('span');
        span.className = `item-tag ${getTagClass(tag)}`;

        if (isSelected) span.classList.add('tag-selected');
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
                    if ((tag === 'Must-read' || tag === 'Video to watch') && typeof window.checkAndSyncToTelegram === 'function') {
                        await window.checkAndSyncToTelegram(item.title, item.url || '(No URL)', tag);
                    }
                }

                if (taggingTargetType === 'todo') {
                    await Storage.updateTodoItem(itemId, { tags: newTags });
                } else if (taggingTargetType === 'course') {
                    await Storage.updateCourseItem(itemId, { tags: newTags });
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
        btn.className = 'tag-remove';
        btn.textContent = ' ×';

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

        settingsTagsList.appendChild(li);
    });
}

function getHostname(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
        return url || '';
    }
}

function formatHistoryTimestamp(timestamp) {
    if (!timestamp) return 'just now';

    const elapsed = Date.now() - Number(timestamp);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (elapsed < minute) return 'just now';
    if (elapsed < hour) return `${Math.floor(elapsed / minute)}m ago`;
    if (elapsed < day) return `${Math.floor(elapsed / hour)}h ago`;
    if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d ago`;
    return new Date(Number(timestamp)).toLocaleDateString();
}
