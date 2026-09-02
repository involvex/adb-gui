import { useState, useRef, useEffect, useCallback } from "react";
import { adbService } from "../adbService";
import { logcatBookmarkStore, LogcatBookmark } from "../logcatBookmarkStore";
import LogcatBookmarks from "./LogcatBookmarks";

interface LogLine {
  id: number;
  raw: string;
  date: string;
  time: string;
  pid: string;
  tid: string;
  level: string;
  tag: string;
  message: string;
}

const MAX_LINES = 10000;
// Improved threadtime regex: matches date, time, pid, tid, level, tag, and remaining message (even if empty or contains colons)
const LINE_RE =
  /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(.*?)\s*:\s?(.*)$/;
const TS_SPLIT = /(?=\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/;

const LEVEL_COLORS: Record<string, string> = {
  V: "text-gray-500",
  D: "text-blue-400",
  I: "text-green-400",
  W: "text-yellow-400",
  E: "text-red-400",
  F: "text-red-500 font-bold",
};

const PRIORITY_OPTIONS = [
  { value: "V", label: "Verbose" },
  { value: "D", label: "Debug" },
  { value: "I", label: "Info" },
  { value: "W", label: "Warning" },
  { value: "E", label: "Error" },
  { value: "F", label: "Fatal" },
  { value: "S", label: "Silent" },
];

const BUFFER_OPTIONS = [
  { value: "main", label: "Main" },
  { value: "system", label: "System" },
  { value: "crash", label: "Crash" },
  { value: "events", label: "Events" },
  { value: "radio", label: "Radio" },
  { value: "all", label: "All" },
];

let idCounter = 0;

function parseLine(raw: string): LogLine | null {
  const match = LINE_RE.exec(raw);
  if (!match) return null;
  return {
    id: ++idCounter,
    raw,
    date: match[1],
    time: match[2],
    pid: match[3],
    tid: match[4],
    level: match[5],
    tag: match[6].trim(),
    message: match[7] !== undefined ? match[7] : "",
  };
}

const LogcatViewer: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [priority, setPriority] = useState("I");
  const [buffer, setBuffer] = useState("main");
  const [tags, setTags] = useState("");
  const [filterPid, setFilterPid] = useState("");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  const rawLinesRef = useRef<LogLine[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const pausedQueueRef = useRef<LogLine[]>([]);

  const flushPaused = useCallback(() => {
    if (pausedQueueRef.current.length === 0) return;
    rawLinesRef.current = [
      ...rawLinesRef.current,
      ...pausedQueueRef.current,
    ].slice(-MAX_LINES);
    setLines(rawLinesRef.current);
    pausedQueueRef.current = [];
  }, []);

  const handleStart = useCallback(async () => {
    if (running) {
      await adbService.stopLogcat();
    }
    rawLinesRef.current = [];
    pausedQueueRef.current = [];
    setLines([]);
    setSelectedIds(new Set());
    setLastSelectedId(null);
    setRunning(true);
    setPaused(false);
    await adbService.startLogcat({
      priority,
      buffer,
      tags: tags || undefined,
      pid: filterPid || undefined,
    });
  }, [running, priority, buffer, tags, filterPid]);

  const handleStop = useCallback(async () => {
    if (paused) {
      flushPaused();
      setPaused(false);
    }
    await adbService.stopLogcat();
    setRunning(false);
  }, [paused, flushPaused]);

  const handlePauseToggle = useCallback(() => {
    setPaused((prev) => {
      if (prev) {
        flushPaused();
        return false;
      }
      return true;
    });
  }, [flushPaused]);

  const handleClear = useCallback(() => {
    rawLinesRef.current = [];
    setLines([]);
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (lines.length === 0) return;
    const text = lines
      .map((l) =>
        l.date && l.time
          ? `${l.date} ${l.time} ${l.pid} ${l.tid} ${l.level} ${l.tag}: ${l.message}`
          : l.raw,
      )
      .join("\n");
    try {
      const result = await adbService.exportLogcat(text);
      if (result.localPath) {
        setCopiedStatus(`Exported to ${result.localPath}`);
        setTimeout(() => setCopiedStatus(null), 4000);
      }
    } catch {
      setCopiedStatus("Export failed");
      setTimeout(() => setCopiedStatus(null), 4000);
    }
  }, [lines]);

  const handleSaveBookmark = useCallback(
    (title: string) => {
      logcatBookmarkStore.add({
        title,
        priority,
        buffer,
        tags,
        filterPid,
      });
    },
    [priority, buffer, tags, filterPid],
  );

  const handleApplyBookmark = useCallback((bookmark: LogcatBookmark) => {
    setPriority(bookmark.priority);
    setBuffer(bookmark.buffer);
    setTags(bookmark.tags);
    setFilterPid(bookmark.filterPid);
  }, []);

  const filtered = search
    ? lines.filter((l) => l.raw.toLowerCase().includes(search.toLowerCase()))
    : lines;

  const handleCopySelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const selectedLines = rawLinesRef.current
      .filter((l) => selectedIds.has(l.id))
      .map((l) => l.raw);
    if (selectedLines.length === 0) return;
    try {
      await navigator.clipboard.writeText(selectedLines.join("\n"));
      setCopiedStatus(`Copied ${selectedLines.length} line(s)`);
      setTimeout(() => setCopiedStatus(null), 2000);
    } catch {
      // Clipboard write failed silently
    }
  }, [selectedIds]);

  const handleSelectAll = useCallback(() => {
    const allFilteredIds = new Set(filtered.map((l) => l.id));
    setSelectedIds(allFilteredIds);
  }, [filtered]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const handleLineClick = useCallback(
    (e: React.MouseEvent, line: LogLine, index: number) => {
      e.preventDefault();
      const newSelected = new Set(selectedIds);

      if (e.shiftKey && lastSelectedId !== null) {
        // Range selection based on filtered items view order
        const lastIdx = filtered.findIndex((l) => l.id === lastSelectedId);
        if (lastIdx !== -1) {
          const start = Math.min(lastIdx, index);
          const end = Math.max(lastIdx, index);
          for (let i = start; i <= end; i++) {
            newSelected.add(filtered[i].id);
          }
        } else {
          newSelected.add(line.id);
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        if (newSelected.has(line.id)) {
          newSelected.delete(line.id);
        } else {
          newSelected.add(line.id);
        }
        setLastSelectedId(line.id);
      } else {
        // Single selection
        if (newSelected.size === 1 && newSelected.has(line.id)) {
          newSelected.clear();
          setLastSelectedId(null);
        } else {
          newSelected.clear();
          newSelected.add(line.id);
          setLastSelectedId(line.id);
        }
      }
      setSelectedIds(newSelected);
    },
    [selectedIds, lastSelectedId, filtered],
  );

  useEffect(() => {
    const unsub = adbService.onLogcatLine((line: string) => {
      const subLines = line.split(TS_SPLIT).filter(Boolean);
      const newEntries: LogLine[] = [];
      for (const sub of subLines) {
        let parsed: LogLine | null = parseLine(sub);
        if (!parsed && sub.startsWith("[")) {
          parsed = {
            id: ++idCounter,
            raw: sub,
            date: "",
            time: "",
            pid: "",
            tid: "",
            level: "",
            tag: "",
            message: sub,
          };
        }
        if (parsed) {
          newEntries.push(parsed);
        }
      }
      if (newEntries.length === 0) return;
      if (paused) {
        pausedQueueRef.current.push(...newEntries);
      } else {
        rawLinesRef.current = [...rawLinesRef.current, ...newEntries].slice(
          -MAX_LINES,
        );
        setLines([...rawLinesRef.current]);
      }
    });
    return unsub;
  }, [paused]);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [autoScroll]);

  // Keyboard shortcuts for copy / select all / clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleCopySelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        // If focus is inside the log viewer container or active
        if (
          listRef.current?.contains(document.activeElement) ||
          document.activeElement === document.body
        ) {
          e.preventDefault();
          handleSelectAll();
        }
      } else if (e.key === "Escape") {
        handleClearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, handleCopySelected, handleSelectAll, handleClearSelection]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col h-full select-none">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-100">Logcat Viewer</h2>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-gray-800 px-2.5 py-1 rounded border border-gray-700 text-xs">
              <span className="text-cyan-300 font-medium">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleCopySelected}
                className="bg-cyan-900/40 text-cyan-200 hover:bg-cyan-900/70 px-2 py-0.5 rounded transition-colors border border-cyan-800 font-medium"
                title="Copy selected lines (Ctrl+C)"
                aria-label="Copy selected lines"
              >
                Copy Selected
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-gray-400 hover:text-gray-200 px-1"
                title="Clear selection (Esc)"
                aria-label="Clear selection"
              >
                ✕
              </button>
            </div>
          )}
          {copiedStatus && (
            <span className="text-xs text-green-400 bg-green-950/60 border border-green-800 px-2 py-0.5 rounded animate-pulse">
              {copiedStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="bg-gray-800 text-gray-300 px-3 py-1 rounded hover:bg-gray-700 transition-colors text-sm border border-gray-700"
              title="Ctrl+A"
              aria-label="Select all log lines"
            >
              Select All
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm"
            title="Clear all log lines"
            aria-label="Clear all log lines"
          >
            Clear
          </button>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="bg-blue-900/30 text-blue-300 px-3 py-1 rounded hover:bg-blue-900/50 transition-colors text-sm border border-blue-800"
              title="Export logs to file"
              aria-label="Export logs to file"
            >
              Export
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {!running ? (
          <button
            type="button"
            onClick={handleStart}
            className="bg-green-900/30 text-green-300 px-4 py-1.5 rounded hover:bg-green-900/50 transition-colors text-sm font-medium border border-green-800"
            title="Start logcat (Ctrl+L)"
            aria-label="Start logcat"
          >
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="bg-red-900/30 text-red-300 px-4 py-1.5 rounded hover:bg-red-900/50 transition-colors text-sm font-medium border border-red-800"
            title="Stop logcat"
            aria-label="Stop logcat"
          >
            Stop
          </button>
        )}
        {running && (
          <button
            type="button"
            onClick={handlePauseToggle}
            title={paused ? "Resume logcat" : "Pause logcat"}
            aria-label={paused ? "Resume logcat" : "Pause logcat"}
            className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${
              paused
                ? "bg-yellow-900/30 text-yellow-300 border-yellow-800 hover:bg-yellow-900/50"
                : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}

        <label className="flex items-center gap-1 text-xs text-gray-400 ml-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-gray-500"
          />
          Auto-scroll
        </label>
      </div>

      <LogcatBookmarks
        onApplyBookmark={handleApplyBookmark}
        onSavePrompt={handleSaveBookmark}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Priority:</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={running}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none disabled:opacity-50"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.value})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Buffer:</span>
          <select
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            disabled={running}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none disabled:opacity-50"
          >
            {BUFFER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Tags:</span>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={running}
            placeholder="Tag:I Tag2:D *:S"
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-gray-500 w-36 font-mono disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">PID:</span>
          <input
            type="text"
            value={filterPid}
            onChange={(e) => setFilterPid(e.target.value)}
            disabled={running}
            placeholder="1234"
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-gray-500 w-20 font-mono disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-1 flex-1 min-w-[150px]">
          <span className="text-xs text-gray-500">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter lines..."
            className="flex-1 bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-gray-500 font-mono"
          />
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 overflow-y-auto font-mono text-xs leading-5 min-h-[200px] max-h-[calc(100vh-380px)] outline-none focus:border-gray-700"
      >
        {filtered.length === 0 && (
          <div className="text-gray-500 py-4 text-center">
            {running
              ? paused
                ? "Paused — waiting for log entries..."
                : "Waiting for log entries..."
              : "Click Start to begin capturing logs"}
          </div>
        )}
        {filtered.map((line, index) => {
          const isSelected = selectedIds.has(line.id);
          const colorClass = line.level
            ? LEVEL_COLORS[line.level] || "text-gray-300"
            : "text-gray-500";
          return (
            <button
              key={line.id}
              type="button"
              onClick={(e) => handleLineClick(e, line, index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleLineClick(
                    e as unknown as React.MouseEvent,
                    line,
                    index,
                  );
                }
              }}
              className={`whitespace-nowrap text-left w-full px-1 rounded-sm cursor-pointer transition-colors block ${
                isSelected
                  ? "bg-blue-900/40 border-l-2 border-blue-500 text-blue-100"
                  : `hover:bg-gray-800/30 ${colorClass}`
              }`}
              title="Click to select, Shift+Click for range, Ctrl+Click for multi-select"
            >
              {line.date && line.time ? (
                <>
                  <span className="text-gray-600">{line.date} </span>
                  <span className="text-gray-500">{line.time} </span>
                  <span className="text-gray-600">{line.pid.padStart(5)} </span>
                  <span className="text-gray-600">{line.tid.padStart(5)} </span>
                  <span className="font-semibold">{line.level} </span>
                  <span className="text-cyan-400">{line.tag}: </span>
                  <span
                    className={isSelected ? "text-blue-100" : "text-gray-300"}
                  >
                    {line.message}
                  </span>
                </>
              ) : (
                <span>{line.raw}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
        <span>
          {lines.length.toLocaleString()} lines
          {search && filtered.length !== lines.length
            ? ` | ${filtered.length.toLocaleString()} visible`
            : ""}
          {selectedIds.size > 0 ? ` | ${selectedIds.size} selected` : ""}
        </span>
        <span>
          Buffer: {buffer}
          {running && (paused ? " | Paused" : " | Running")}
          {!running && lines.length > 0 && " | Stopped"}
        </span>
      </div>
    </div>
  );
};

export default LogcatViewer;
