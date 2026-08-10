import { useState, useEffect } from "react";
import { adbService } from "../adbService";
import { quickCommandsStore, type QuickCommand } from "../electronStore";

const QuickCommands: React.FC = () => {
  const [commands, setCommands] = useState<QuickCommand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCommands = () => {
    setLoading(true);
    try {
      setCommands(quickCommandsStore.getAll());
    } catch {
      setError("Failed to load commands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommands();
  }, []);

  const handleExecute = async (cmd: QuickCommand) => {
    setError(null);
    try {
      await adbService.execute(cmd.command);
    } catch {
      setError(`Failed to execute: ${cmd.title}`);
    }
  };

  const handleReset = () => {
    const reset = quickCommandsStore.reset();
    setCommands(reset);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">Quick Commands</h2>
        <button
          type="button"
          onClick={handleReset}
          className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">
          Loading commands...
        </div>
      )}

      {!loading && commands.length === 0 && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No commands configured
        </div>
      )}

      {!loading && commands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {commands.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => handleExecute(cmd)}
              className="bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-gray-100 border border-gray-700 rounded px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <span className="mr-1">{cmd.icon}</span>
              {cmd.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickCommands;
