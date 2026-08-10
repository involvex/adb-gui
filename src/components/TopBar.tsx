import { useState, useEffect } from "react";
import { adbService } from "../adbService";

interface Device {
  serial: string;
  name: string;
  id: string;
}

const TopBar: React.FC<{ onDeviceSelect?: (deviceId: string) => void }> = ({
  onDeviceSelect,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      setLoading(true);
      setError(null);
      try {
        const deviceList = await adbService.getConnectedDevices();
        const devices: Device[] = deviceList.map((serial: string) => ({
          serial,
          name: serial,
          id: serial,
        }));
        setDevices(devices);
      } catch (err) {
        setError("Failed to fetch devices");
        console.error("ADB devices fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDevices();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const deviceList = await adbService.getConnectedDevices();
      const devices: Device[] = deviceList.map((serial: string) => ({
        serial,
        name: serial,
        id: serial,
      }));
      setDevices(devices);
    } catch {
      setError("Failed to refresh devices");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-100">ADB GUI</h1>
        <span className="text-sm text-gray-400">
          {loading && "Loading..."}
          {!loading && devices.length === 0 && "No devices found"}
          {!loading &&
            devices.length > 0 &&
            `${devices.length} device(s) connected`}
        </span>
        {error && <span className="text-sm text-red-400">{"⚠ " + error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="bg-gray-800 text-gray-300 px-3 py-1 rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
        >
          {"↻ Refresh"}
        </button>
        {onDeviceSelect && (
          <button
            type="button"
            onClick={() => onDeviceSelect("all")}
            className="bg-gray-800 text-gray-300 px-3 py-1 rounded hover:bg-gray-700 transition-colors text-sm"
          >
            {"All Devices"}
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBar;
