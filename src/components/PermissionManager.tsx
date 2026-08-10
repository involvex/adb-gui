import { useState, useEffect, useCallback } from "react";
import { adbService } from "../adbService";

const PermissionManager: React.FC = () => {
  const [packages, setPackages] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [loadingActivities, setLoadingActivities] = useState<Set<string>>(
    new Set(),
  );
  const [activityErrors, setActivityErrors] = useState<Map<string, string>>(
    new Map(),
  );
  const [launchStatus, setLaunchStatus] = useState<Map<string, string>>(
    new Map(),
  );

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const pkgList = await adbService.listThirdPartyPackages();
      setPackages(pkgList);
    } catch (err) {
      setError("Failed to list packages");
      console.error("Package list error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const toggleExpand = useCallback(
    async (pkg: string) => {
      setExpandedPkgs((prev) => {
        const next = new Set(prev);
        if (next.has(pkg)) {
          next.delete(pkg);
        } else {
          next.add(pkg);
        }
        return next;
      });

      if (!activities.has(pkg) && !loadingActivities.has(pkg)) {
        setLoadingActivities((prev) => new Set(prev).add(pkg));
        setActivityErrors((prev) => {
          const next = new Map(prev);
          next.delete(pkg);
          return next;
        });
        try {
          const acts = await adbService.listActivities(pkg);
          setActivities((prev) => new Map(prev).set(pkg, acts));
        } catch {
          setActivityErrors((prev) =>
            new Map(prev).set(pkg, "Failed to load activities"),
          );
        } finally {
          setLoadingActivities((prev) => {
            const next = new Set(prev);
            next.delete(pkg);
            return next;
          });
        }
      }
    },
    [activities, loadingActivities],
  );

  const handleGrantAll = async (packageName: string) => {
    setStatusMsg(`Granting permissions to ${packageName}...`);
    setError(null);
    try {
      await adbService.grantPermissions(packageName);
      setStatusMsg(`Permissions granted to ${packageName}`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setError(`Failed to grant permissions to ${packageName}`);
      setStatusMsg(null);
    }
  };

  const handleLaunch = async (pkg: string, activity: string) => {
    const key = `${pkg}/${activity}`;
    setLaunchStatus((prev) =>
      new Map(prev).set(key, `Launching ${activity}...`),
    );
    try {
      const result = await adbService.launchActivity(pkg, activity);
      if (result.exitCode === 0) {
        setLaunchStatus((prev) =>
          new Map(prev).set(key, `Launched ${activity}`),
        );
      } else {
        setLaunchStatus((prev) =>
          new Map(prev).set(key, `Failed: ${result.stderr || "unknown"}`),
        );
      }
    } catch {
      setLaunchStatus((prev) =>
        new Map(prev).set(key, `Failed to launch ${activity}`),
      );
    }
    setTimeout(() => {
      setLaunchStatus((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }, 4000);
  };

  const filtered = packages.filter((pkg) =>
    pkg.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          Permission Manager
        </h2>
        <button
          type="button"
          onClick={loadPackages}
          disabled={loading}
          className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {packages.length > 0 && (
        <input
          type="text"
          placeholder="Search packages..."
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
          Loading packages...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No third-party packages found
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {filtered.map((pkg) => {
            const isExpanded = expandedPkgs.has(pkg);
            const pkgActs = activities.get(pkg);
            const actsLoading = loadingActivities.has(pkg);
            const actsError = activityErrors.get(pkg);

            return (
              <div
                key={pkg}
                className="bg-gray-800/50 border border-gray-700 rounded"
              >
                <div className="flex items-center gap-2 p-2 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleExpand(pkg)}
                    className="text-gray-500 hover:text-gray-300 transition-colors text-xs shrink-0 w-4 text-center"
                    aria-label={
                      isExpanded ? "Collapse activities" : "Expand activities"
                    }
                  >
                    {isExpanded ? "\u25BC" : "\u25B6"}
                  </button>
                  <code className="text-gray-200 text-xs truncate flex-1">
                    {pkg}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleGrantAll(pkg)}
                    className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded hover:bg-blue-900/50 transition-colors text-xs font-medium whitespace-nowrap border border-blue-800"
                  >
                    Grant All
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-700 px-3 py-2">
                    {actsLoading && (
                      <div className="text-gray-500 text-xs py-2">
                        Loading activities...
                      </div>
                    )}

                    {actsError && (
                      <div className="text-red-400 text-xs py-2">
                        {actsError}
                      </div>
                    )}

                    {!actsLoading &&
                      !actsError &&
                      pkgActs &&
                      pkgActs.length === 0 && (
                        <div className="text-gray-600 text-xs py-2">
                          No activities found
                        </div>
                      )}

                    {!actsLoading && !actsError && pkgActs && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {pkgActs.map((activity) => {
                          const launchKey = `${pkg}/${activity}`;
                          const launchMsg = launchStatus.get(launchKey);
                          return (
                            <div
                              key={activity}
                              className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1"
                            >
                              <code className="text-gray-300 text-xs font-mono truncate flex-1 mr-2">
                                {activity}
                              </code>
                              <div className="flex items-center gap-2 shrink-0">
                                {launchMsg && (
                                  <span className="text-gray-500 text-[10px]">
                                    {launchMsg}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleLaunch(pkg, activity)}
                                  className="bg-green-900/30 text-green-300 px-2 py-0.5 rounded hover:bg-green-900/50 transition-colors text-xs font-medium border border-green-800"
                                >
                                  Launch
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PermissionManager;
