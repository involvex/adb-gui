import { useState, useEffect } from "react";
import { adbService, setDeviceId, getDeviceId } from "../adbService";

interface Device {
  serial: string;
}

const TopBar: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(getDeviceId());

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceList = await adbService.getConnectedDevices();
      setDevices(deviceList.map((serial: string) => ({ serial })));
      if (deviceList.length === 0) {
        setDeviceId(null);
        setActiveId(null);
      } else if (activeId && !deviceList.includes(activeId)) {
        setDeviceId(null);
        setActiveId(null);
      }
    } catch {
      setError("Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

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

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-100">ADB GUI</h1>
        <div className="flex items-center gap-2">
          {loading && <span className="text-sm text-gray-400">Loading...</span>}
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
              <button
                key={d.serial}
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
            ))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="bg-gray-800 text-gray-300 px-3 py-1 rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
      >
        Refresh
      </button>
    </header>
  );
};

export default TopBar;
