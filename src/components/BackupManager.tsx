import { useState, useEffect, useCallback } from "react";
import { adbService } from "../adbService";

interface AdbResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface BackupResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  localPath?: string;
}

interface PackageInfo {
  name: string;
  label: string;
}

const BackupManager: React.FC = () => {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pkgList = await adbService.listThirdPartyPackages();
      const withLabels: PackageInfo[] = [];
      for (const pkg of pkgList) {
        const label = await getPackageLabel(pkg);
        withLabels.push({ name: pkg, label: label || pkg });
      }
      setPackages(withLabels);
      setFilteredPackages(withLabels);
    } catch (err) {
      setError("Failed to list packages");
      console.error("Package list error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPackages(packages);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredPackages(
        packages.filter(
          (pkg) =>
            pkg.name.toLowerCase().includes(lower) ||
            pkg.label.toLowerCase().includes(lower),
        ),
      );
    }
  }, [searchTerm, packages]);

  async function getPackageLabel(pkg: string): Promise<string> {
    try {
      const result: AdbResult = await adbService.execute(
        `shell pm dump ${pkg} | grep -m1 "application-label:"`,
      );
      const match = result.stdout.match(/application-label:"([^"]+)"/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  }

  const toggleSelection = (pkg: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(pkg)) {
      newSelected.delete(pkg);
    } else {
      newSelected.add(pkg);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    setSelected(new Set(filteredPackages.map((p) => p.name)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const handleBackup = async () => {
    const selectedPackages = Array.from(selected);
    if (selectedPackages.length === 0) {
      alert("Please select at least one app to backup.");
      return;
    }

    setBackupLoading(true);
    setBackupStatus("Preparing backup...");
    setError(null);

    try {
      const result: BackupResult =
        await adbService.backupApps(selectedPackages);

      if (result.exitCode !== 0 && result.error) {
        setError(
          result.error === "cancelled"
            ? "Backup cancelled."
            : `Backup failed: ${result.error}`,
        );
      } else if (result.localPath) {
        const msg = `Backup saved to ${result.localPath}`;
        setBackupStatus(msg);
        setSelected(new Set());
      } else {
        setBackupStatus("Backup completed.");
      }
    } catch (err) {
      setError(
        `Backup failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setBackupLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          App Backup Manager
        </h2>
        <button
          type="button"
          onClick={loadPackages}
          disabled={loading}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs transition-colors border border-gray-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && clearError && (
        <div className="mb-2">
          <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-2 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {backupStatus && (
        <div className="bg-blue-900/20 border border-blue-800 text-blue-300 p-2 rounded mb-2 text-sm">
          {backupStatus}
        </div>
      )}

      <div className="mb-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search packages..."
          className="w-full bg-gray-950 text-gray-100 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono outline-none focus:border-gray-500 transition-colors"
        />
      </div>

      {filteredPackages.length > 0 && (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs transition-colors border border-gray-700"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs transition-colors border border-gray-700"
          >
            Select None
          </button>
          <span className="text-xs text-gray-500 self-center">
            {selected.size} of {filteredPackages.length} selected
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleBackup}
        disabled={backupLoading || selected.size === 0}
        className="bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800 px-4 py-2 rounded text-xs transition-colors font-medium disabled:opacity-50 mb-3"
      >
        {backupLoading ? "Backing up..." : "Backup Selected Apps"}
      </button>

      <p className="text-[10px] text-gray-600 mb-3">
        Note: You may need to confirm the backup on your Android device. The
        backup will be saved as an .ab file. Requires USB debugging and
        sufficient device storage.
      </p>

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">
          Loading packages...
        </div>
      )}

      {!loading && filteredPackages.length === 0 && searchTerm === "" && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No third-party apps found on device.
        </div>
      )}

      {!loading && filteredPackages.length === 0 && searchTerm !== "" && (
        <div className="text-gray-500 text-sm py-4 text-center">
          {"No packages matching " + '"' + searchTerm + '"'}
        </div>
      )}

      {!loading && filteredPackages.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.name}
              className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded px-3 py-2 hover:bg-gray-800/50 transition-colors"
            >
              <input
                type="checkbox"
                id={pkg.name}
                checked={selected.has(pkg.name)}
                onChange={() => toggleSelection(pkg.name)}
                className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <div className="flex flex-col flex-1 min-w-0">
                <label
                  htmlFor={pkg.name}
                  className="text-sm font-medium text-gray-200 cursor-pointer truncate"
                  title={pkg.name}
                >
                  {pkg.label || pkg.name}
                </label>
                <span className="text-[10px] text-gray-600 font-mono truncate">
                  {pkg.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackupManager;
