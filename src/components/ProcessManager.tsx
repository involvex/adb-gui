import { useState, useEffect, useCallback } from "react";
import { adbService } from "../adbService";

interface ProcessInfo {
  user: string;
  pid: number;
  name: string;
}

const ProcessManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadProcesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adbService.listProcesses();
      setProcesses(result);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to list processes";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  const handleKill = async (pkgName: string) => {
    setStatusMsg(`Stopping ${pkgName}...`);
    try {
      await adbService.forceStop(pkgName);
      setStatusMsg(`${pkgName} force-stopped`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Failed to stop ${pkgName}`;
      setError(msg);
      setStatusMsg(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  const filtered = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.user.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          Process Manager
          {!loading && processes.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filtered.length}/{processes.length})
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={loadProcesses}
          disabled={loading}
          className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {processes.length > 0 && (
        <input
          type="text"
          placeholder="Search processes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm mb-3 outline-none focus:border-gray-500 transition-colors"
        />
      )}

      {statusMsg && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 p-2 rounded mb-3 text-sm">
          {statusMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">
          Loading processes...
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  PID
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  USER
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  NAME
                </th>
                <th className="bg-gray-800 text-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proc) => (
                <tr
                  key={proc.pid}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-3 py-2 text-sm text-gray-300 font-mono">
                    {proc.pid}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-300">
                    {proc.user}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-200 truncate max-w-[200px]">
                    {proc.name}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleKill(proc.name)}
                      className="bg-red-900/30 text-red-300 px-2 py-0.5 rounded hover:bg-red-900/50 transition-colors text-xs font-medium"
                    >
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && processes.length > 0 && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No matching processes
        </div>
      )}

      {!loading && processes.length === 0 && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No processes found. Ensure a device is connected via USB debugging.
        </div>
      )}
    </div>
  );
};

export default ProcessManager;
