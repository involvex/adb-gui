import { useState, useEffect, useCallback } from "react";
import { adbService } from "../adbService";

interface DeviceData {
  device: Record<string, string>;
  screen: { resolution: string; density: string };
  battery: { level: string; status: string; temperature: string };
  storage: { mount: string; total: string; used: string; free: string }[];
  network: { wifiSsid: string; ipAddress: string };
}

const BATTERY_STATUS: Record<string, string> = {
  "2": "Charging",
  "3": "Not charging",
  "4": "Full",
  "5": "Unknown",
};

function formatBytes(kb: string): string {
  const n = parseInt(kb, 10);
  if (isNaN(n)) return kb;
  if (n >= 1048576) return (n / 1048576).toFixed(1) + " GB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " MB";
  return n + " KB";
}

const DeviceInfo: React.FC = () => {
  const [info, setInfo] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adbService.getDeviceInfo();
      setInfo(data);
      setLastRefreshed(new Date());
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to get device info";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const batteryTemp = info?.battery.temperature
    ? (parseInt(info.battery.temperature, 10) / 10).toFixed(1)
    : "unknown";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          Device Info
          {lastRefreshed && (
            <span className="text-xs font-normal text-gray-600 ml-2">
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={loadInfo}
          disabled={loading}
          className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">
          Loading device info...
        </div>
      )}

      {!loading && !info && !error && (
        <div className="text-gray-500 text-sm py-4 text-center">
          <p className="mb-2">No device connected</p>
          <p className="text-xs text-gray-600">
            Connect a device via USB with debugging enabled
          </p>
        </div>
      )}

      {!loading && info && (
        <div className="space-y-4">
          {/* Device Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Device Details
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Model:</span>{" "}
                <span className="text-gray-200">
                  {info.device["ro.product.model"] || "unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Manufacturer:</span>{" "}
                <span className="text-gray-200">
                  {info.device["ro.product.manufacturer"] || "unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Android:</span>{" "}
                <span className="text-gray-200">
                  {info.device["ro.build.version.release"] || "unknown"} (API{" "}
                  {info.device["ro.build.version.sdk"] || "?"})
                </span>
              </div>
              <div>
                <span className="text-gray-500">Build:</span>{" "}
                <span className="text-gray-200 font-mono text-[10px]">
                  {info.device["ro.build.display.id"] || "unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Serial:</span>{" "}
                <span className="text-gray-200 font-mono text-[10px]">
                  {info.device["ro.serialno"] || "unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">CPU:</span>{" "}
                <span className="text-gray-200">
                  {info.device["ro.product.cpu.abi"] || "unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Screen Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Screen</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Resolution:</span>{" "}
                <span className="text-gray-200">{info.screen.resolution}</span>
              </div>
              <div>
                <span className="text-gray-500">Density:</span>{" "}
                <span className="text-gray-200">{info.screen.density} dpi</span>
              </div>
            </div>
          </div>

          {/* Battery Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Battery</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Level:</span>{" "}
                <span className="text-gray-200">
                  {parseInt(info.battery.level, 10) / 100 > 0
                    ? `${Math.round((parseInt(info.battery.level, 10) / 100) * 100)}%`
                    : "unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span className="text-gray-200">
                  {BATTERY_STATUS[info.battery.status] || info.battery.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Temp:</span>{" "}
                <span className="text-gray-200">{batteryTemp}°C</span>
              </div>
            </div>
          </div>

          {/* Storage Info */}
          {info.storage.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Storage
              </h3>
              <div className="space-y-2">
                {info.storage.map((s) => (
                  <div key={s.mount} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500">{s.mount}</span>
                      <span className="text-gray-400">
                        {formatBytes(s.used)} / {formatBytes(s.total)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{
                          width: `${
                            parseInt(s.total, 10) > 0
                              ? (parseInt(s.used, 10) / parseInt(s.total, 10)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Network Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Network</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">WiFi:</span>{" "}
                <span className="text-gray-200">{info.network.wifiSsid}</span>
              </div>
              <div>
                <span className="text-gray-500">IP:</span>{" "}
                <span className="text-gray-200 font-mono">
                  {info.network.ipAddress}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceInfo;
