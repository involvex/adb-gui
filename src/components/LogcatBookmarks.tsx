import { useState, useRef, useEffect } from "react";
import { logcatBookmarkStore, LogcatBookmark } from "../logcatBookmarkStore";

interface LogcatBookmarksProps {
  onApplyBookmark: (bookmark: LogcatBookmark) => void;
  onSavePrompt: (title: string) => void;
}

const LogcatBookmarks: React.FC<LogcatBookmarksProps> = ({
  onApplyBookmark,
  onSavePrompt,
}) => {
  const [bookmarks, setBookmarks] = useState<LogcatBookmark[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isInputOpen, setIsInputOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBookmarks(logcatBookmarkStore.getAll());
  }, []);

  const refreshBookmarks = () => setBookmarks(logcatBookmarkStore.getAll());

  const handleSave = () => {
    if (inputValue.trim()) {
      onSavePrompt(inputValue.trim());
      refreshBookmarks();
    }
    setInputValue("");
    setIsInputOpen(false);
  };

  const handleRemove = (id: string) => {
    logcatBookmarkStore.remove(id);
    refreshBookmarks();
  };

  const handleApply = (bookmark: LogcatBookmark) => {
    logcatBookmarkStore.recordUsage(bookmark.id);
    refreshBookmarks();
    onApplyBookmark(bookmark);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {bookmarks.map((bookmark) => (
        <div key={bookmark.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleApply(bookmark)}
            className="bg-gray-800/60 text-gray-200 border border-gray-700 px-2.5 py-1 rounded text-xs hover:bg-gray-700 transition-colors cursor-pointer"
            title={`Priority: ${bookmark.priority}, Buffer: ${bookmark.buffer}${bookmark.tags ? `, Tags: ${bookmark.tags}` : ""}${bookmark.filterPid ? `, PID: ${bookmark.filterPid}` : ""}`}
          >
            {bookmark.title}
          </button>
          <button
            type="button"
            onClick={() => handleRemove(bookmark.id)}
            className="text-gray-500 hover:text-gray-300 text-xs w-4 h-4 flex items-center justify-center"
            title={`Remove ${bookmark.title}`}
          >
            ×
          </button>
        </div>
      ))}

      {bookmarks.length === 0 && (
        <span className="text-xs text-gray-600">
          No bookmarks saved. Save your current filter to create one.
        </span>
      )}

      {isInputOpen && (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setInputValue("");
                setIsInputOpen(false);
              }
            }}
            placeholder="Bookmark name..."
            className="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-200 outline-none focus:border-gray-500 w-36"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            ✓
          </button>
        </div>
      )}

      {bookmarks.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setIsInputOpen(true);
            inputRef.current?.focus();
          }}
          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-1.5 py-0.5"
          title="Save current filter as bookmark"
        >
          + Save
        </button>
      )}

      {bookmarks.length === 0 && (
        <button
          type="button"
          onClick={() => {
            setIsInputOpen(true);
            inputRef.current?.focus();
          }}
          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-1.5 py-0.5"
          title="Save current filter as bookmark"
        >
          + Save current filter
        </button>
      )}
    </div>
  );
};

export default LogcatBookmarks;
