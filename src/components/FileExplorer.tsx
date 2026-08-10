import { useState, useCallback } from "react";
import { adbService } from "../adbService";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: string;
  perms: string;
  owner: string;
  group: string;
  date: string;
}

const DEFAULT_PATH = "/sdcard";

function buildPath(dir: string, name: string): string {
  if (dir.endsWith("/")) return dir + name;
  return dir + "/" + name;
}

function parentPath(dir: string): string {
  const trimmed = dir.endsWith("/") ? dir.slice(0, -1) : dir;
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

function fmtSize(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return bytes;
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + " GB";
  if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

const FileExplorer: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(DEFAULT_PATH);
  const [pathInput, setPathInput] = useState<string>(DEFAULT_PATH);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [pulledFolderPath, setPulledFolderPath] = useState<string | null>(null);

  const loadDir = useCallback(async (remotePath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adbService.listFileEntries(remotePath);
      if (result.error) {
        setError(result.error);
        setEntries([]);
      } else {
        setEntries(result.entries);
        setCurrentPath(remotePath);
        setPathInput(remotePath);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to list directory";
      setError(msg);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNavigate = (name: string) => {
    loadDir(buildPath(currentPath, name));
  };

  const handleGoUp = () => {
    if (currentPath === "/") return;
    loadDir(parentPath(currentPath));
  };

  const handleGoToPath = () => {
    const trimmed = pathInput.trim();
    if (trimmed) loadDir(trimmed);
  };

  const handlePull = async (entry: FileEntry) => {
    if (entry.isDirectory) return;
    setStatusMsg(null);
    setError(null);
    setPulledFolderPath(null);
    try {
      const result = await adbService.pullFile(
        buildPath(currentPath, entry.name),
      );
      if (result.error && result.error !== "cancelled") {
        setError(result.error);
      } else if (result.exitCode !== 0 && result.error !== "cancelled") {
        setError(result.stderr || "Pull failed");
      } else if (result.error !== "cancelled") {
        setStatusMsg(
          `Pulled "${entry.name}" to ${result.localPath || "local"}`,
        );
        if (result.localPath) {
          const lastSlash = Math.max(
            result.localPath.lastIndexOf("/"),
            result.localPath.lastIndexOf("\\"),
          );
          setPulledFolderPath(
            lastSlash > 0 ? result.localPath.substring(0, lastSlash) : null,
          );
        }
        setTimeout(() => {
          setStatusMsg(null);
          setPulledFolderPath(null);
        }, 10000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pull failed";
      setError(msg);
    }
  };

  const handleOpenFolder = async () => {
    if (!pulledFolderPath) return;
    await adbService.openFolder(pulledFolderPath);
  };

  const dirs = entries.filter((e) => e.isDirectory && !e.isSymlink);
  const files = entries.filter((e) => !e.isDirectory);

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  const handlePush = async () => {
    setError(null);
    setStatusMsg(null);
    setPulledFolderPath(null);
    try {
      const result = await adbService.pushFile(currentPath);
      if (result.error && result.error !== "cancelled") {
        setError(result.error);
      } else if (result.error !== "cancelled" && result.pushedFiles) {
        setStatusMsg(
          `Pushed ${result.pushedFiles.length} file(s) to ${currentPath}`,
        );
        setTimeout(() => setStatusMsg(null), 5000);
        loadDir(currentPath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Push failed";
      setError(msg);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          File Explorer
          {lastRefreshed && (
            <span className="text-xs font-normal text-gray-600 ml-2">
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handlePush}
          disabled={loading}
          className="bg-blue-900/30 text-blue-300 px-3 py-1 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800 disabled:opacity-50"
        >
          Push Files
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1 text-sm text-gray-400 flex-1 min-w-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => loadDir("/")}
            className="text-blue-400 hover:text-blue-300 transition-colors shrink-0"
          >
            /
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <span className="text-gray-600">/</span>
              <button
                type="button"
                onClick={() =>
                  loadDir("/" + breadcrumbs.slice(0, i + 1).join("/"))
                }
                className="text-blue-400 hover:text-blue-300 transition-colors truncate max-w-[150px]"
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => loadDir(currentPath)}
          disabled={loading}
          className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 shrink-0"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGoToPath()}
          placeholder="Enter path..."
          className="flex-1 bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors font-mono"
        />
        <button
          type="button"
          onClick={handleGoToPath}
          className="bg-gray-700 text-gray-300 px-3 py-2 rounded hover:bg-gray-600 transition-colors text-sm"
        >
          Go
        </button>
      </div>

      {statusMsg && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 p-2 rounded mb-3 text-sm flex items-center justify-between">
          <span>{statusMsg}</span>
          {pulledFolderPath && (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded hover:bg-green-900/70 transition-colors text-xs font-medium border border-green-700"
            >
              Open Folder
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">Loading...</div>
      )}

      {!loading && entries.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  Name
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  Size
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  Date
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  Perms
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {currentPath !== "/" && (
                <tr
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={handleGoUp}
                  onKeyDown={(e) => e.key === "Enter" && handleGoUp()}
                  tabIndex={0}
                >
                  <td className="px-3 py-2 text-sm text-blue-400" colSpan={4}>
                    ..
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              )}
              {dirs.map((entry) => (
                <tr
                  key={entry.name}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => handleNavigate(entry.name)}
                >
                  <td className="px-3 py-2 text-sm text-blue-300 font-mono truncate max-w-[300px]">
                    {entry.name}/
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    &lt;dir&gt;
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {entry.date}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                    {entry.perms}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              ))}
              {files.map((entry) => (
                <tr
                  key={entry.name}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-3 py-2 text-sm text-gray-200 font-mono truncate max-w-[300px]">
                    {entry.name}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {fmtSize(entry.size)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {entry.date}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                    {entry.perms}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePull(entry);
                      }}
                      className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded hover:bg-blue-900/50 transition-colors text-xs font-medium border border-blue-800"
                    >
                      Pull
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="text-gray-500 text-sm py-4 text-center">
          <p className="mb-2">No files found in this directory</p>
          <p className="text-xs text-gray-600">
            Connect a device via USB with debugging enabled, then press Refresh
          </p>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
