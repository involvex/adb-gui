import { useState, useRef, useEffect, useCallback } from "react";
import { adbService } from "../adbService";

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
const LINE_RE =
  /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(\S+?)\s*:\s*(.*)$/;
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
    tag: match[6],
    message: match[7],
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
  const [copiedId, setCopiedId] = useState<number | null>(null);
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
  }, []);

  const handleCopyLine = useCallback(async (line: LogLine) => {
    try {
      await navigator.clipboard.writeText(line.raw);
      setCopiedId(line.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard write failed silently
    }
  }, []);

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
  }, [lines, autoScroll]);

  const filtered = search
    ? lines.filter((l) => l.raw.toLowerCase().includes(search.toLowerCase()))
    : lines;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">Logcat Viewer</h2>
        <button
          type="button"
          onClick={handleClear}
          className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {!running ? (
          <button
            type="button"
            onClick={handleStart}
            className="bg-green-900/30 text-green-300 px-4 py-1.5 rounded hover:bg-green-900/50 transition-colors text-sm font-medium border border-green-800"
          >
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="bg-red-900/30 text-red-300 px-4 py-1.5 rounded hover:bg-red-900/50 transition-colors text-sm font-medium border border-red-800"
          >
            Stop
          </button>
        )}
        {running && (
          <button
            type="button"
            onClick={handlePauseToggle}
            className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${
              paused
                ? "bg-yellow-900/30 text-yellow-300 border-yellow-800 hover:bg-yellow-900/50"
                : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}

        <label className="flex items-center gap-1 text-xs text-gray-400 ml-2">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-gray-500"
          />
          Auto-scroll
        </label>
      </div>

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
        className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 overflow-y-auto font-mono text-xs leading-5 min-h-[200px] max-h-[calc(100vh-380px)]"
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
        {filtered.map((line) => {
          const colorClass = line.level
            ? LEVEL_COLORS[line.level] || "text-gray-300"
            : "text-gray-500";
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => handleCopyLine(line)}
              className={`whitespace-nowrap text-left w-full ${colorClass} hover:bg-gray-800/30 px-1 rounded-sm cursor-pointer relative ${
                copiedId === line.id ? "bg-gray-800/50" : ""
              }`}
              title="Click to copy"
            >
              {copiedId === line.id && (
                <span className="absolute right-1 top-0 text-[10px] text-green-400 bg-gray-900 px-1 rounded">
                  Copied
                </span>
              )}
              {line.date && line.time ? (
                <>
                  <span className="text-gray-600">{line.date} </span>
                  <span className="text-gray-500">{line.time} </span>
                  <span className="text-gray-600">{line.pid.padStart(5)} </span>
                  <span className="text-gray-600">{line.tid.padStart(5)} </span>
                  <span className="font-semibold">{line.level} </span>
                  <span className="text-cyan-400">{line.tag}: </span>
                  <span className="text-gray-300">{line.message}</span>
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
