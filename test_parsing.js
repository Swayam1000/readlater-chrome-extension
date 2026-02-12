
const Storage = {
    // Mock
};

// Paste logic here to test parsing
function processTelegramMessage(text) {
    // ... logic ...
    const lines = text.split('\n');
    let title = lines[0].trim();
    const note = lines.slice(1).join('\n').trim();

    // 1. Check for Course
    if (text.startsWith('/course') || text.includes('#course')) {
        // Course Logic
        // Extract URL
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
        const url = urlMatch ? urlMatch[0] : '';

        // Remove Command/Tag from Title
        title = title.replace('/course', '').replace('#course', '').trim();
        // Remove URL from Title if present
        if (url) title = title.replace(url, '').trim();

        // Extract Tags
        const tags = (text.match(/#[\w-]+/g) || [])
            .filter(t => t !== '#course')
            .map(t => t.substring(1)); // Remove #

        console.log("COURSE:", { title, url, tags, note });
        return { type: 'course', title, url, tags, note };
    }

    // 2. Check for Reading (URL presence)
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
    if (urlMatch) {
        const url = urlMatch[0];
        // Remove URL from Title
        title = title.replace(url, '').trim();

        const tags = (text.match(/#[\w-]+/g) || [])
            .map(t => t.substring(1));

        console.log("READING:", { title, url, tags, note });
        return { type: 'reading', title, url, tags, note };
    }

    // 3. Todo Logic
    // Extract Metadata
    const dateMatch = title.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    const date = dateMatch ? dateMatch[1] : '';
    if (date) title = title.replace(dateMatch[0], '').trim();

    const isUrgent = title.includes('!urgent');
    if (isUrgent) title = title.replace('!urgent', '').trim();

    const isImportant = title.includes('!important');
    if (isImportant) title = title.replace('!important', '').trim();

    const tags = (text.match(/#[\w-]+/g) || []).map(t => t.substring(1));
    // Clean tags from title
    tags.forEach(t => title = title.replace('#' + t, '').trim());

    console.log("TODO:", { title, date, isUrgent, isImportant, tags, note });
    return { type: 'todo', title, date, isUrgent, isImportant, tags, note };
}

// Test Cases
processTelegramMessage("Buy milk !urgent [2025-01-01] #personal");
processTelegramMessage("https://google.com Great Search Engine #tech");
processTelegramMessage("/course https://udemy.com React Masterclass #learning");
processTelegramMessage("Simple Task\nWith a note");
