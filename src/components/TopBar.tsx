import { useState, useEffect, useCallback, useRef } from "react";
import { adbService, setDeviceId, getDeviceId } from "../adbService";

interface Device {
  serial: string;
}

const TopBar: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(getDeviceId());
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [installing, setInstalling] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceList = await adbService.getConnectedDevices();
      setDevices(deviceList.map((serial: string) => ({ serial })));
      const current = activeIdRef.current;
      if (deviceList.length === 0) {
        setDeviceId(null);
        setActiveId(null);
      } else if (current && !deviceList.includes(current)) {
        setDeviceId(null);
        setActiveId(null);
      }
    } catch {
      setError("Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleCopySerial = useCallback(async (serial: string) => {
    try {
      await navigator.clipboard.writeText(serial);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Failed to copy");
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "r" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        if (
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          loadDevices();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadDevices]);

  const handleSelect = (serial: string) => {
    if (activeId === serial) {
      setDeviceId(null);
      setActiveId(null);
    } else {
      setDeviceId(serial);
      setActiveId(serial);
    }
  };

  const handleRefresh = () => {
    loadDevices();
  };

  const handleInstallApk = async () => {
    setInstalling(true);
    setError(null);
    setInstallMsg(null);
    try {
      const result = await adbService.installApk();
      if (result.error === "cancelled") return;
      if (result.installedFiles && result.installedFiles.length > 0) {
        const names = result.installedFiles
          .map((f) => f.split(/[\\/]/).pop())
          .join(", ");
        setInstallMsg(`Installed ${names}`);
      }
      if (result.failedFiles && result.failedFiles.length > 0) {
        const failNames = result.failedFiles
          .map((f) => f.file.split(/[\\/]/).pop())
          .join(", ");
        setError(`Failed: ${failNames}`);
      }
      setTimeout(() => {
        setInstallMsg(null);
        setError(null);
      }, 5000);
    } catch {
      setError("Failed to install APK");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-2">
      <div className="flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-100">ADB GUI</h1>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="text-sm text-gray-400">Loading...</span>
            )}
            {!loading && error && (
              <span className="text-sm text-red-400">{error}</span>
            )}
            {!loading && !error && devices.length === 0 && (
              <span className="text-sm text-red-400">No devices</span>
            )}
            {!loading &&
              !error &&
              devices.length > 0 &&
              devices.map((d) => (
                <div key={d.serial} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelect(d.serial)}
                    className={`px-2 py-0.5 rounded text-xs font-mono transition-colors border ${
                      activeId === d.serial
                        ? "bg-green-900/30 text-green-300 border-green-700"
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    {d.serial}
                  </button>
                  {activeId === d.serial && (
                    <button
                      type="button"
                      onClick={() => handleCopySerial(d.serial)}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                      title="Copy serial to clipboard"
                      aria-label="Copy serial to clipboard"
                    >
                      📋
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallApk}
            disabled={installing}
            className="bg-blue-900/30 text-blue-300 px-3 py-1 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800 disabled:opacity-50"
          >
            {installing ? "Installing..." : "Install APK"}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="bg-gray-800 text-gray-300 px-3 py-1 rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
            title="Refresh devices (Ctrl+R)"
            aria-label="Refresh devices"
          >
            Refresh
          </button>
        </div>
      </div>
      {installMsg && (
        <div className="mt-2 bg-green-900/20 border border-green-800 text-green-400 p-1.5 rounded text-xs">
          {installMsg}
        </div>
      )}
      {copyStatus && (
        <div className="mt-2 bg-cyan-900/20 border border-cyan-800 text-cyan-400 p-1.5 rounded text-xs">
          {copyStatus}
        </div>
      )}
    </header>
  );
};

export default TopBar;
