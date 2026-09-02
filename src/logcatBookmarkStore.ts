export interface LogcatBookmark {
  id: string;
  title: string;
  priority: string;
  buffer: string;
  tags: string;
  filterPid: string;
}

const STORAGE_KEY = "logcat-bookmarks";

function loadBookmarks(): LogcatBookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LogcatBookmark[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveBookmarks(bookmarks: LogcatBookmark[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // ignore
  }
}

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const logcatBookmarkStore = {
  getAll(): LogcatBookmark[] {
    return loadBookmarks();
  },
  add(bookmark: Omit<LogcatBookmark, "id">): LogcatBookmark[] {
    const bookmarks = loadBookmarks();
    const newBookmark: LogcatBookmark = { ...bookmark, id: generateId() };
    bookmarks.unshift(newBookmark);
    saveBookmarks(bookmarks);
    return bookmarks;
  },
  remove(id: string): LogcatBookmark[] {
    const bookmarks = loadBookmarks().filter((b) => b.id !== id);
    saveBookmarks(bookmarks);
    return bookmarks;
  },
  update(id: string, updated: Omit<LogcatBookmark, "id">): LogcatBookmark[] {
    const bookmarks = loadBookmarks().map((b) =>
      b.id === id ? { ...updated, id } : b,
    );
    saveBookmarks(bookmarks);
    return bookmarks;
  },
  recordUsage(id: string): LogcatBookmark[] {
    const bookmarks = loadBookmarks();
    const bookmark = bookmarks.find((b) => b.id === id);
    if (bookmark) {
      const filtered = bookmarks.filter((b) => b.id !== id);
      filtered.unshift(bookmark);
      saveBookmarks(filtered);
    }
    return bookmarks;
  },
};
