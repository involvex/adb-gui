import { useState, useEffect, useCallback } from "react";
import { adbService } from "../adbService";
import { parseAdbError } from "../errorUtils";
import { useDebounce } from "../useDebounce";

interface AppInfo {
  name: string;
  label: string;
  version: string;
  targetSdk: string;
  size: string;
  installDate: string;
  isSystem: boolean;
}

const AppManager: React.FC = () => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [appDetails, setAppDetails] = useState<Map<string, AppInfo>>(new Map());
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showSystem, setShowSystem] = useState(false);
  const [rawSearch, setRawSearch] = useState("");
  const searchTerm = useDebounce(rawSearch, 200);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allPkgs = await adbService.listPackages();
      const appList: AppInfo[] = [];
      for (const pkg of allPkgs) {
        const isSystem = !pkg.includes(".");
        if (!showSystem && isSystem) continue;
        appList.push({
          name: pkg,
          label: pkg,
          version: "",
          targetSdk: "",
          size: "",
          installDate: "",
          isSystem,
        });
      }
      setApps(appList);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to list applications",
      );
    } finally {
      setLoading(false);
    }
  }, [showSystem]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const filtered = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const toggleExpand = useCallback(
    async (pkg: string) => {
      if (expandedApp === pkg) {
        setExpandedApp(null);
        return;
      }
      setExpandedApp(pkg);
      if (!appDetails.has(pkg)) {
        setDetailLoading(pkg);
        try {
          const info = await adbService.getAppInfo(pkg);
          setAppDetails((prev) => {
            const next = new Map(prev);
            next.set(pkg, {
              name: pkg,
              label: info.label || pkg,
              version: info.version,
              targetSdk: info.targetSdk,
              size: info.size,
              installDate: info.installDate,
              isSystem: !pkg.includes("."),
            });
            return next;
          });
        } catch {
          setAppDetails((prev) => {
            const next = new Map(prev);
            next.set(pkg, {
              name: pkg,
              label: pkg,
              version: "error",
              targetSdk: "",
              size: "",
              installDate: "",
              isSystem: !pkg.includes("."),
            });
            return next;
          });
        } finally {
          setDetailLoading(null);
        }
      }
    },
    [expandedApp, appDetails],
  );

  const handleClearData = async (pkg: string) => {
    if (
      !confirm(
        `Clear all data for ${pkg}?\n\nThis will delete all app data, settings, accounts, and databases.`,
      )
    ) {
      return;
    }
    setActionStatus(`Clearing data for ${pkg}...`);
    setActionError(null);
    try {
      const result = await adbService.clearAppData(pkg);
      if (result.exitCode === 0) {
        setActionStatus(`Data cleared for ${pkg}`);
      } else {
        setActionError(parseAdbError(result.stderr, "Failed to clear data"));
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? parseAdbError(err.message, "Failed to clear data")
          : "Failed to clear data",
      );
    }
    setTimeout(() => {
      setActionStatus(null);
      setActionError(null);
    }, 4000);
  };

  const handleUninstall = async (pkg: string) => {
    if (
      !confirm(
        `Uninstall ${pkg}?\n\nThis will remove the app and all its data.`,
      )
    ) {
      return;
    }
    setActionStatus(`Uninstalling ${pkg}...`);
    setActionError(null);
    try {
      const result = await adbService.uninstallApp(pkg);
      if (result.exitCode === 0) {
        setActionStatus(`${pkg} uninstalled`);
        setApps((prev) => prev.filter((a) => a.name !== pkg));
        setExpandedApp(null);
      } else {
        setActionError(parseAdbError(result.stderr, "Failed to uninstall"));
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? parseAdbError(err.message, "Failed to uninstall")
          : "Failed to uninstall",
      );
    }
    setTimeout(() => {
      setActionStatus(null);
      setActionError(null);
    }, 4000);
  };

  const handleToggle = async (pkg: string, enable: boolean) => {
    const action = enable ? "Enabling" : "Disabling";
    setActionStatus(`${action} ${pkg}...`);
    setActionError(null);
    try {
      const result = await adbService.toggleApp(pkg, enable);
      if (result.exitCode === 0) {
        setActionStatus(`${pkg} ${enable ? "enabled" : "disabled"}`);
      } else {
        setActionError(
          parseAdbError(result.stderr, `Failed to ${action.toLowerCase()}`),
        );
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? parseAdbError(err.message, `Failed to ${action.toLowerCase()}`)
          : `Failed to ${action.toLowerCase()}`,
      );
    }
    setTimeout(() => {
      setActionStatus(null);
      setActionError(null);
    }, 4000);
  };

  const handleForceStop = async (pkg: string) => {
    setActionStatus(`Force-stopping ${pkg}...`);
    setActionError(null);
    try {
      await adbService.forceStop(pkg);
      setActionStatus(`${pkg} stopped`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to stop");
    }
    setTimeout(() => {
      setActionStatus(null);
      setActionError(null);
    }, 3000);
  };

  const handleExportApk = async (pkg: string) => {
    setActionStatus(`Exporting APK for ${pkg}...`);
    setActionError(null);
    try {
      const result = await adbService.exportApk(pkg);
      if (result.error && result.error !== "cancelled") {
        setActionError(parseAdbError(result.error, "Export failed"));
      } else if (result.exitCode !== 0 && result.error !== "cancelled") {
        setActionError(parseAdbError(result.stderr, "Export failed"));
      } else if (result.error !== "cancelled") {
        setActionStatus(`APK exported to ${result.localPath}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    }
    setTimeout(() => {
      setActionStatus(null);
      setActionError(null);
    }, 5000);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          App Manager
          {lastRefreshed && (
            <span className="text-xs font-normal text-gray-600 ml-2">
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showSystem}
              onChange={(e) => setShowSystem(e.target.checked)}
              className="accent-gray-500"
            />
            System
          </label>
          <button
            type="button"
            onClick={loadApps}
            disabled={loading}
            className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {apps.length > 0 && (
        <input
          type="text"
          placeholder="Search apps..."
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm mb-3 outline-none focus:border-gray-500 transition-colors"
        />
      )}

      {actionStatus && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 p-2 rounded mb-3 text-sm">
          {actionStatus}
        </div>
      )}

      {actionError && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {actionError}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">
          Loading applications...
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-gray-500 text-sm py-4 text-center">
          <p className="mb-2">No applications found</p>
          <p className="text-xs text-gray-600">
            Connect a device via USB with debugging enabled, then press Refresh
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="max-h-[32rem] overflow-y-auto">
          {filtered.map((app) => {
            const details = appDetails.get(app.name);
            const isExpanded = expandedApp === app.name;
            const isLoading = detailLoading === app.name;

            return (
              <div
                key={app.name}
                className="border-b border-gray-800/50 last:border-b-0"
              >
                <div className="flex items-center gap-2 p-2 text-sm hover:bg-gray-800/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleExpand(app.name)}
                    className="text-gray-500 hover:text-gray-300 transition-colors text-xs shrink-0 w-4 text-center"
                    aria-label={
                      isExpanded ? "Collapse details" : "Expand details"
                    }
                  >
                    {isLoading ? "..." : isExpanded ? "\u25BC" : "\u25B6"}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-200 text-xs font-mono truncate">
                      {app.name}
                    </div>
                    {details && details.label !== app.name && (
                      <div className="text-gray-500 text-xs truncate">
                        {details.label}
                      </div>
                    )}
                  </div>
                  {app.isSystem && (
                    <span className="text-[10px] text-yellow-500/70 bg-yellow-900/20 px-1.5 py-0.5 rounded shrink-0">
                      SYS
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="px-6 pb-3">
                    {details ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Version:</span>{" "}
                            <span className="text-gray-300">
                              {details.version}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Size:</span>{" "}
                            <span className="text-gray-300">
                              {details.size}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Target SDK:</span>{" "}
                            <span className="text-gray-300">
                              {details.targetSdk}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Installed:</span>{" "}
                            <span className="text-gray-300">
                              {details.installDate}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleForceStop(app.name)}
                            className="bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors text-xs border border-gray-700"
                          >
                            Force Stop
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(app.name, false)}
                            className="bg-yellow-900/20 text-yellow-300 px-2 py-1 rounded hover:bg-yellow-900/40 transition-colors text-xs border border-yellow-800"
                          >
                            Disable
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(app.name, true)}
                            className="bg-green-900/20 text-green-300 px-2 py-1 rounded hover:bg-green-900/40 transition-colors text-xs border border-green-800"
                          >
                            Enable
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearData(app.name)}
                            className="bg-yellow-900/20 text-yellow-300 px-2 py-1 rounded hover:bg-yellow-900/40 transition-colors text-xs border border-yellow-800"
                          >
                            Clear Data
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportApk(app.name)}
                            className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded hover:bg-blue-900/50 transition-colors text-xs border border-blue-800"
                          >
                            Export APK
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUninstall(app.name)}
                            className="bg-red-900/30 text-red-300 px-2 py-1 rounded hover:bg-red-900/50 transition-colors text-xs border border-red-800"
                          >
                            Uninstall
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xs">
                        Loading details...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-2 text-[11px] text-gray-500">
          {filtered.length} app(s)
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}
    </div>
  );
};

export default AppManager;
