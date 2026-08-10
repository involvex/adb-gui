import { useState, useEffect } from "react";
import { adbService } from "../adbService";

const PermissionManager: React.FC = () => {
  const [packages, setPackages] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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

  const handleGrantAll = async (packageName: string) => {
    setStatusMsg(`Granting permissions to ${packageName}...`);
    setError(null);
    try {
      await adbService.grantPermissions(packageName);
      setStatusMsg(`Permissions granted to ${packageName}`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setError(`Failed to grant permissions to ${packageName}`);
      setStatusMsg(null);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-3">
        Permission Manager
      </h2>

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

      {!loading && packages.length === 0 && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No third-party packages found
        </div>
      )}

      {!loading && packages.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {packages.map((pkg) => (
            <div
              key={pkg}
              className="bg-gray-800/50 border border-gray-700 rounded p-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <code className="text-gray-200 text-xs truncate flex-1 mr-2">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PermissionManager;
