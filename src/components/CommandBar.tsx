import { useState, useRef, useEffect, useCallback } from "react";
import { adbService, type AdbResult } from "../adbService";
import {
  loadCommandHistory,
  saveCommandHistory,
  MAX_HISTORY,
} from "../commandHistoryStore";

const CommandBar: React.FC = () => {
  const [cmd, setCmd] = useState<string>("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const historyRef = useRef<string[]>(loadCommandHistory());
  const historyIdxRef = useRef<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (outputRef.current && expanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, expanded]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const runCommand = useCallback(async () => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const result: AdbResult = await adbService.execute(trimmed);
      const lines: string[] = [];
      if (result.stdout) lines.push(result.stdout);
      if (result.stderr) lines.push("[stderr] " + result.stderr);
      if (!result.stdout && !result.stderr) {
        lines.push(`(exit code: ${result.exitCode})`);
      }
      setOutput(lines.join("\n"));
      setExpanded(true);
      historyRef.current = [
        trimmed,
        ...historyRef.current.filter((h) => h !== trimmed),
      ].slice(0, MAX_HISTORY);
      saveCommandHistory(historyRef.current);
      historyIdxRef.current = -1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Command failed";
      setError(msg);
      setOutput(`[error] ${msg}`);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }, [cmd]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = historyRef.current;
      if (h.length === 0) return;
      const newIdx = Math.min(historyIdxRef.current + 1, h.length - 1);
      historyIdxRef.current = newIdx;
      setCmd(h[newIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = historyIdxRef.current - 1;
      if (newIdx < 0) {
        historyIdxRef.current = -1;
        setCmd("");
      } else {
        historyIdxRef.current = newIdx;
        setCmd(historyRef.current[newIdx]);
      }
    }
  };

  return (
    <div className="bg-gray-900 border-t border-gray-800">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm shrink-0"
        >
          {expanded ? "\u25BC" : "\u25B6"} Terminal
        </button>
        <input
          ref={inputRef}
          type="text"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="adb command..."
          className="flex-1 bg-gray-950 text-gray-100 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono outline-none focus:border-gray-500 transition-colors"
        />
        <button
          type="button"
          onClick={runCommand}
          disabled={loading || !cmd.trim()}
          className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 shrink-0"
        >
          {loading ? "..." : "Run"}
        </button>
      </div>

      {expanded && output !== null && (
        <div className="px-4 pb-3">
          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-2 text-xs">
              {error}
            </div>
          )}
          <pre
            ref={outputRef}
            className="bg-gray-950 text-green-400 p-3 rounded border border-gray-800 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all"
          >
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CommandBar;
