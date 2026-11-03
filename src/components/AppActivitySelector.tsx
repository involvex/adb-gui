import React, { useState, useEffect } from "react";
import { adbService } from "../adbService";
// import { toast } from "react-toastify";
import { toast } from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../store";
import { clearHistory } from "../store/launchHistorySlice";

interface AppActivitySelectorProps {
  /** Optional initial package to pre-select; if omitted the first package is used. */
  initialPackage?: string;
}

/**
 * Activity selector component
 *
 * - On mount it populates the package dropdown via `adbService.listThirdPartyPackages()`
 *   (routed to the device currently selected in the top bar).
 * - Selecting a package calls `adbService.getActivitiesForPackage(packageName)` and
 *   displays the resulting launchable activity names.
 * - The component re-renders whenever the selection changes.
 */
export const AppActivitySelector: React.FC<AppActivitySelectorProps> = ({
  initialPackage,
}) => {
  const [packages, setPackages] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [packagesLoading, setPackagesLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [packageFilter, setPackageFilter] = useState<string>("");
  const history = useSelector<RootState>(
    (state: RootState) => state.launchHistory.entries,
  ) as { activity: string; package: string; timestamp: number }[];

  const dispatch = useDispatch();

  const filteredPackages = packages.filter((pkg) =>
    pkg.toLowerCase().includes(packageFilter.toLowerCase()),
  );

  // Populate the package list once when the component mounts
  useEffect(() => {
    async function fetchPackages(): Promise<void> {
      setPackagesLoading(true);
      setError(null);
      try {
        const result = await adbService.listThirdPartyPackages();
        if (!result || !Array.isArray(result)) {
          throw new Error("Failed to load packages");
        }
        setPackages(result);
        // If an initialPackage was provided and exists in the list, select it;
        // otherwise default to the first entry.
        if (initialPackage && result.includes(initialPackage)) {
          setSelectedPackage(initialPackage);
        } else if (result.length > 0) {
          setSelectedPackage(result[0]);
          setActivities([]); // clear any previous activities
        }
      } catch (err) {
        console.error("Failed to fetch third-party packages:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPackagesLoading(false);
      }
    }
    fetchPackages();
  }, [initialPackage]);

  // When the selected package changes, fetch its activities
  useEffect(() => {
    if (!selectedPackage) {
      setActivities([]);
      return;
    }
    setLoading(true);
    setActivityError(null);
    async function fetchActivities(): Promise<void> {
      try {
        const result = await adbService.getActivitiesForPackage(
          selectedPackage!,
        );
        setActivities(result);
      } catch (err) {
        console.error(
          `Failed to fetch activities for package "${selectedPackage}":`,
          err,
        );
        setActivities([]);
        setActivityError(
          err instanceof Error
            ? `Failed to load activities: ${err.message}`
            : `Failed to load activities for ${selectedPackage}`,
        );
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
  }, [selectedPackage]);

  // Helper to launch the selected activity with feedback
  const handleLaunch = async (activity: string) => {
    if (!selectedPackage) return;
    setLoading(true);
    try {
      const result = await adbService.launchActivity(selectedPackage, activity);
      if (result.exitCode === 0) {
        toast.success(`Launched ${activity} successfully`);
        // persist launch history
        let history = JSON.parse(
          localStorage.getItem("launchedActivities") || "[]",
        );
        const entry = {
          activity,
          package: selectedPackage,
          timestamp: Date.now(),
        };
        history.unshift(entry);
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem("launchedActivities", JSON.stringify(history));
      } else {
        toast.error(
          `Failed to launch ${activity}: ${result.stderr || result.stdout}`,
        );
      }
    } catch (err: unknown) {
      toast.error(
        `Error launching activity: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  if (packagesLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>Loading packages…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>No third-party packages found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="mb-4 text-xl font-semibold text-gray-100">
        Activity selector
      </h2>

      {/* Package selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Package:
        </label>
        <input
          type="text"
          value={packageFilter}
          onChange={(e) => setPackageFilter(e.target.value)}
          placeholder="Filter packages..."
          className="mt-1 mb-2 block w-full rounded-md border-gray-700 shadow-sm bg-gray-950 px-3 py-2 text-white text-sm"
        />
        <select
          value={selectedPackage ?? ""}
          onChange={(e) => {
            const pkg = e.target.value;
            setSelectedPackage(pkg);
            // Activities are fetched automatically by the useEffect above.
          }}
          className="mt-1 block w-full rounded-md border-gray-700 shadow-sm bg-gray-950 px-3 py-2 text-white"
        >
          <option value="">— Select a package —</option>
          {filteredPackages.map((pkg) => (
            <option key={pkg} value={pkg}>
              {pkg}
            </option>
          ))}
        </select>
        {packageFilter && (
          <p className="mt-1 text-xs text-gray-500">
            Showing {filteredPackages.length} of {packages.length} packages
          </p>
        )}
      </div>

      {/* Activities list */}
      {selectedPackage && activityError ? (
        <div className="mt-4 bg-red-900/20 border border-red-800 text-red-400 p-3 rounded text-sm">
          {activityError}
        </div>
      ) : selectedPackage && activities.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Activities for <strong>{selectedPackage}</strong>:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {activities.map((act) => (
              <div
                key={act}
                className="flex items-center rounded-md border border-gray-700 bg-gray-950 p-2 text-sm text-gray-100"
              >
                <span className="flex-1 truncate">{act}</span>
                <button
                  onClick={() => handleLaunch(act)}
                  className="ml-2 text-blue-400 hover underline cursor-pointer"
                  disabled={loading}
                >
                  Launch
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : selectedPackage && loading ? (
        <p className="mt-4 text-center text-gray-400">Loading activities...</p>
      ) : selectedPackage && activities.length === 0 ? (
        <p className="mt-4 text-center text-gray-500">
          No activities found (the package may not have exported launchable
          components).
        </p>
      ) : null}
      {history.length > 0 ? (
        <div className="mt-4">
          <div className="p-3 bg-gray-900 text-gray-300 text-sm">
            <strong>Recent launches:</strong>
            {history
              .slice(0, 5)
              .map((e: { activity: string; package: string }, i: number) => (
                <span key={i} className="me-2">
                  {e.activity} ({e.package})
                </span>
              ))}
          </div>
          <button
            onClick={() => dispatch(clearHistory())}
            className="mt-2 text-blue-400 hover underline cursor-pointer"
          >
            Clear history
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default AppActivitySelector;
