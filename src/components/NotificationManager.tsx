import { useState, useCallback, useEffect } from "react";

interface Notification {
  id: number;
  packageName: string;
  title: string;
  text: string;
  priority: string;
  when: string;
}

interface NotificationManagerProps {
  onStatusChange?: (status: string | null) => void;
}

function NotificationManager({ onStatusChange }: NotificationManagerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState("");
  const [clearing, setClearing] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.adb.execute(
        "dumpsys notification --noredact",
      );
      if (result.exitCode === 0) {
        const lines = result.stdout.split("\n");
        const parsed: Notification[] = [];
        let current: Partial<Notification> | null = null;

        for (const line of lines) {
          if (line.includes("NotificationRecord(")) {
            if (current && current.packageName) {
              parsed.push(current as Notification);
            }
            current = {};
            const pkgMatch = line.match(/pkg=(\S+)/);
            if (pkgMatch) current.packageName = pkgMatch[1];
          }
          if (current) {
            if (line.includes("mTitle=")) {
              const titleMatch = line.match(/mTitle=(.+)/);
              if (titleMatch) current.title = titleMatch[1].trim();
            }
            if (line.includes("mText=")) {
              const textMatch = line.match(/mText=(.+)/);
              if (textMatch) current.text = textMatch[1].trim();
            }
            if (line.includes("priority=")) {
              const priMatch = line.match(/priority=(\d+)/);
              if (priMatch) current.priority = priMatch[1];
            }
            if (line.includes("when=")) {
              const whenMatch = line.match(/when=(\d+)/);
              if (whenMatch) current.when = whenMatch[1];
            }
          }
        }
        if (current && current.packageName) {
          parsed.push(current as Notification);
        }
        setNotifications(parsed);
      } else {
        setError("Failed to dump notifications");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearNotification = useCallback(
    async (pkg: string) => {
      setClearing(true);
      onStatusChange?.(`Clearing notifications for ${pkg}...`);
      try {
        await window.adb.execute(
          `cmd notification cancel --package ${pkg} all`,
        );
        await loadNotifications();
        onStatusChange?.(`Cleared notifications for ${pkg}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        onStatusChange?.(null);
      } finally {
        setClearing(false);
      }
    },
    [loadNotifications, onStatusChange],
  );

  const clearAllNotifications = useCallback(async () => {
    setClearing(true);
    onStatusChange?.("Clearing all notifications...");
    try {
      for (const pkg of [...new Set(notifications.map((n) => n.packageName))]) {
        await window.adb.execute(
          `cmd notification cancel --package ${pkg} all`,
        );
      }
      await loadNotifications();
      onStatusChange?.("All notifications cleared");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onStatusChange?.(null);
    } finally {
      setClearing(false);
    }
  }, [notifications, loadNotifications, onStatusChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filtered = filterApp
    ? notifications.filter((n) =>
        n.packageName.toLowerCase().includes(filterApp.toLowerCase()),
      )
    : notifications;

  const packages = [...new Set(notifications.map((n) => n.packageName))];

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200">
          Notification Manager
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={clearAllNotifications}
            disabled={clearing || filtered.length === 0}
            className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-xs hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            Clear All
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded p-2 mb-3 text-red-300 text-xs">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Filter by app..."
          value={filterApp}
          onChange={(e) => setFilterApp(e.target.value)}
          className="flex-1 bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-gray-500 transition-colors"
        />
        <select
          value={filterApp}
          onChange={(e) => setFilterApp(e.target.value)}
          className="bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-gray-500 transition-colors"
        >
          <option value="">All apps</option>
          {packages.map((pkg) => (
            <option key={pkg} value={pkg}>
              {pkg}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">
            {loading ? "Loading notifications..." : "No notifications found"}
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={`${n.packageName}-${n.id}`}
              className="bg-gray-800 rounded px-3 py-2 text-xs flex items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 truncate">
                    {n.packageName}
                  </span>
                  {n.priority && (
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] ${
                        parseInt(n.priority) >= 4
                          ? "bg-red-900/30 text-red-300"
                          : parseInt(n.priority) >= 2
                            ? "bg-yellow-900/30 text-yellow-300"
                            : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      P{n.priority}
                    </span>
                  )}
                </div>
                <div className="text-gray-300 font-medium truncate">
                  {n.title || "(no title)"}
                </div>
                <div className="text-gray-500 truncate">{n.text}</div>
              </div>
              <button
                type="button"
                onClick={() => clearNotification(n.packageName)}
                disabled={clearing}
                className="shrink-0 px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-[10px] hover:bg-gray-600 hover:text-gray-200 transition-colors disabled:opacity-50"
                aria-label={`Clear notifications from ${n.packageName}`}
              >
                Clear
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationManager;
