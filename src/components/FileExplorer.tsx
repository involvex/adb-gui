import { useState } from "react";
import { adbService } from "../adbService";

const FileExplorer: React.FC = () => {
  const [remotePath, setRemotePath] = useState<string>("");
  const [localPath, setLocalPath] = useState<string>("");
  const [pulling, setPulling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);

  const handleBrowse = async () => {
    if (!remotePath.trim()) return;
    setError(null);
    try {
      const result = await adbService.listDirectory(remotePath);
      setFiles(result.stdout.split("\n").filter(Boolean));
    } catch {
      setError("Failed to list directory");
    }
  };

  const handlePull = async () => {
    if (!remotePath.trim()) {
      setError("Please enter a remote path");
      return;
    }
    if (!localPath.trim()) {
      setError("Please enter a local destination path");
      return;
    }

    setPulling(true);
    setError(null);
    setStatusMsg(null);
    try {
      const result = await adbService.pull(remotePath, localPath);
      if (result.exitCode === 0) {
        setStatusMsg(`Pulled ${remotePath} -> ${localPath}`);
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        setError(`Pull failed: ${result.stderr}`);
      }
    } catch {
      setError("Pull failed");
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-3">
        File Explorer
      </h2>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="remote-path"
            className="block text-xs text-gray-400 mb-1"
          >
            Remote Path:
          </label>
          <div className="flex gap-2">
            <input
              id="remote-path"
              type="text"
              placeholder="storage/sdcard0/Android/data/..."
              value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              className="flex-1 bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleBrowse}
              className="bg-gray-700 text-gray-300 px-3 py-2 rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Browse
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="local-path"
            className="block text-xs text-gray-400 mb-1"
          >
            Local Destination:
          </label>
          <input
            id="local-path"
            type="text"
            placeholder="C:\Users\...\file.txt"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={handlePull}
          disabled={pulling || !remotePath || !localPath}
          className="bg-blue-900/30 text-blue-300 px-4 py-2 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pulling ? "Pulling..." : "Pull File"}
        </button>

        {statusMsg && (
          <div className="bg-green-900/20 border border-green-800 text-green-400 p-2 rounded text-sm">
            {statusMsg}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded text-sm">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded p-2 max-h-40 overflow-y-auto">
            <pre className="text-xs text-gray-300 font-mono">
              {files.map((f, i) => (
                <div key={i}>{f}</div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
