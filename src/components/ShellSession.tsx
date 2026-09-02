import React, { useState, useCallback, useRef, useEffect } from "react";
import { adbService } from "../adbService";

interface ShellLine {
  id: number;
  type: "input" | "output" | "error" | "info";
  text: string;
  timestamp: Date;
}

const MAX_LINES = 500;

function ShellSession() {
  const [lines, setLines] = useState<ShellLine[]>([
    {
      id: 0,
      type: "info",
      text: "ADB Shell Session — type commands below. Use ↑/↓ for history.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [currentDir, setCurrentDir] = useState("/");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(1);

  const addLine = useCallback((type: ShellLine["type"], text: string) => {
    const line: ShellLine = {
      id: idCounter.current++,
      type,
      text,
      timestamp: new Date(),
    };
    setLines((prev) => {
      const next = [...prev, line];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });
  }, []);

  const runCommand = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      addLine("input", trimmed);
      setHistory((prev) => [...prev, trimmed]);
      setHistoryIdx(-1);
      setRunning(true);

      try {
        const fullCmd =
          trimmed === "cd"
            ? `shell cd / && pwd`
            : trimmed.startsWith("cd ")
              ? `shell cd ${currentDir} && ${trimmed} && pwd`
              : `shell cd ${currentDir} && ${trimmed}`;

        const result = await adbService.execute(fullCmd);

        if (result.stdout.trim()) {
          addLine("output", result.stdout.trimEnd());
        }
        if (result.stderr.trim()) {
          addLine("error", result.stderr.trimEnd());
        }

        // Track directory changes
        if (trimmed.startsWith("cd ")) {
          const dirOutput = result.stdout.trim();
          if (dirOutput.startsWith("/") && result.exitCode === 0) {
            setCurrentDir(dirOutput);
          }
        } else if (trimmed === "cd") {
          setCurrentDir("/");
        }
      } catch (err) {
        addLine("error", err instanceof Error ? err.message : "Command failed");
      } finally {
        setRunning(false);
      }
    },
    [addLine, currentDir],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !running) {
        runCommand(input);
        setInput("");
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length > 0) {
          const newIdx =
            historyIdx === -1
              ? history.length - 1
              : Math.max(0, historyIdx - 1);
          setHistoryIdx(newIdx);
          setInput(history[newIdx]);
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx !== -1) {
          const newIdx = historyIdx + 1;
          if (newIdx >= history.length) {
            setHistoryIdx(-1);
            setInput("");
          } else {
            setHistoryIdx(newIdx);
            setInput(history[newIdx]);
          }
        }
      }

      if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setLines([
          {
            id: idCounter.current++,
            type: "info",
            text: "Screen cleared",
            timestamp: new Date(),
          },
        ]);
      }
    },
    [input, running, history, historyIdx, runCommand],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [running]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">
            Shell Session
          </span>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            {currentDir}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {lines.length} lines · {history.length} commands
          </span>
          <button
            type="button"
            onClick={() =>
              setLines([
                {
                  id: idCounter.current++,
                  type: "info",
                  text: "Session cleared",
                  timestamp: new Date(),
                },
              ])
            }
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Clear session output"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 min-h-[200px]">
        {lines.map((line) => (
          <div key={line.id} className="flex gap-2">
            {line.type === "input" && (
              <>
                <span className="text-green-400 shrink-0 select-none">$</span>
                <span className="text-gray-100">{line.text}</span>
              </>
            )}
            {line.type === "output" && (
              <span className="text-gray-300 whitespace-pre-wrap">
                {line.text}
              </span>
            )}
            {line.type === "error" && (
              <span className="text-red-400 whitespace-pre-wrap">
                {line.text}
              </span>
            )}
            {line.type === "info" && (
              <span className="text-gray-500 italic">{line.text}</span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-800 px-3 py-2 flex items-center gap-2">
        <span className="text-green-400 font-mono text-xs select-none">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={running ? "Running..." : "Type a command..."}
          className="flex-1 bg-transparent text-gray-100 font-mono text-xs outline-none placeholder:text-gray-600 disabled:opacity-50"
          aria-label="Shell command input"
          autoComplete="off"
          spellCheck={false}
        />
        {running && (
          <span className="text-[10px] text-yellow-400 animate-pulse">
            running
          </span>
        )}
      </div>
    </div>
  );
}

export default ShellSession;
