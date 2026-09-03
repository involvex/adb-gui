import { useState, useCallback } from "react";
import { adbService } from "../adbService";

interface NetworkInterface {
  name: string;
  ipv4: string;
  ipv6: string;
  flags: string;
  mtu: string;
  state: string;
}

interface ConnectionState {
  activeDefault: string;
  activeNetworkType: string;
  wifiConnected: boolean;
  mobileConnected: boolean;
}

interface DataUsage {
  rxBytes: string;
  txBytes: string;
  rxPackets: string;
  txPackets: string;
}

const NetworkInspector: React.FC = () => {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [dataUsage, setDataUsage] = useState<DataUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "interfaces" | "connection" | "usage"
  >("connection");

  const parseInterfaces = (stdout: string): NetworkInterface[] => {
    const ifaces: NetworkInterface[] = [];
    const lines = stdout.split("\n");
    let current: Partial<NetworkInterface> = {};

    for (const line of lines) {
      const ifaceMatch = line.match(/^(\S+):\s+inet\s+(\S+)/);
      if (ifaceMatch) {
        if (current.name && current.ipv4) {
          ifaces.push(current as NetworkInterface);
        }
        current = {
          name: ifaceMatch[1],
          ipv4: ifaceMatch[2],
          ipv6: "",
          flags: "",
          mtu: "",
          state: "",
        };
        const flagsMatch = line.match(/flags=\S+\s+mtu\s+(\S+)/);
        if (flagsMatch) {
          current.mtu = flagsMatch[1];
        }
        const flagsStr = line.match(/flags=<([^>]+)>/);
        if (flagsStr) {
          current.flags = flagsStr[1];
        }
        continue;
      }

      const inet6Match = line.match(/inet6\s+(\S+)/);
      if (inet6Match && current.name && !current.ipv6) {
        current.ipv6 = inet6Match[1];
      }
    }

    if (current.name && current.ipv4) {
      ifaces.push(current as NetworkInterface);
    }

    return ifaces;
  };

  const loadNetworkInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ifResult, connResult, usageResult] = await Promise.all([
        adbService.execute("shell ip -4 addr show"),
        adbService.execute("shell dumpsys connectivity"),
        adbService.execute("shell cat /proc/net/dev"),
      ]);

      if (ifResult.exitCode === 0) {
        setInterfaces(parseInterfaces(ifResult.stdout));
      }

      const activeMatch = connResult.stdout.match(
        /Active default network:\s*(\S+)/,
      );
      const typeMatch = connResult.stdout.match(
        /Active default network type:\s*(\S+)/,
      );
      const wifiMatch = connResult.stdout.match(
        /Wifi:\s*(CONNECTED|DISCONNECTED)/i,
      );
      const mobileMatch = connResult.stdout.match(
        /Mobile:\s*(CONNECTED|DISCONNECTED)/i,
      );

      setConnection({
        activeDefault: activeMatch?.[1] || "unknown",
        activeNetworkType: typeMatch?.[1] || "unknown",
        wifiConnected: wifiMatch?.[1]?.toUpperCase() === "CONNECTED",
        mobileConnected: mobileMatch?.[1]?.toUpperCase() === "CONNECTED",
      });

      const devLines = usageResult.stdout.split("\n");
      for (const line of devLines) {
        const match = line
          .trim()
          .match(
            /^\w+:\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/,
          );
        if (match) {
          setDataUsage({
            rxBytes: formatBytes(parseInt(match[1], 10)),
            txBytes: formatBytes(parseInt(match[2], 10)),
            rxPackets: match[1],
            txPackets: match[2],
          });
          break;
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load network info",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
    return bytes + " B";
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          Network Inspector
        </h2>
        <button
          type="button"
          onClick={loadNetworkInfo}
          disabled={loading}
          className="bg-cyan-900/30 text-cyan-300 px-3 py-1 rounded hover:bg-cyan-900/50 transition-colors text-sm font-medium border border-cyan-800 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && interfaces.length === 0 && !connection && (
        <div className="text-gray-500 text-sm py-4 text-center">
          Click Refresh to load network information
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {(["connection", "interfaces", "usage"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === tab
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            {tab === "connection"
              ? "Connection"
              : tab === "interfaces"
                ? "Interfaces"
                : "Data Usage"}
          </button>
        ))}
      </div>

      {activeTab === "connection" && connection && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded p-3 border border-gray-700">
              <div className="text-[10px] text-gray-500 uppercase">WiFi</div>
              <div
                className={`text-sm font-medium ${connection.wifiConnected ? "text-green-400" : "text-gray-500"}`}
              >
                {connection.wifiConnected ? "Connected" : "Disconnected"}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3 border border-gray-700">
              <div className="text-[10px] text-gray-500 uppercase">Mobile</div>
              <div
                className={`text-sm font-medium ${connection.mobileConnected ? "text-green-400" : "text-gray-500"}`}
              >
                {connection.mobileConnected ? "Connected" : "Disconnected"}
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="text-[10px] text-gray-500 uppercase">
              Active Network
            </div>
            <div className="text-sm text-gray-200 font-mono">
              {connection.activeDefault}
            </div>
          </div>
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="text-[10px] text-gray-500 uppercase">
              Network Type
            </div>
            <div className="text-sm text-gray-200 font-mono">
              {connection.activeNetworkType}
            </div>
          </div>
        </div>
      )}

      {activeTab === "interfaces" && (
        <div className="space-y-2">
          {interfaces.length === 0 ? (
            <div className="text-gray-500 text-sm py-4 text-center">
              No interfaces found
            </div>
          ) : (
            interfaces.map((iface) => (
              <div
                key={iface.name}
                className="bg-gray-800 rounded p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-200">
                    {iface.name}
                  </span>
                  {iface.mtu && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      MTU {iface.mtu}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">IPv4: </span>
                    <span className="text-gray-300 font-mono">
                      {iface.ipv4}
                    </span>
                  </div>
                  {iface.ipv6 && (
                    <div>
                      <span className="text-gray-500">IPv6: </span>
                      <span className="text-gray-300 font-mono text-[10px]">
                        {iface.ipv6}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "usage" && dataUsage && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="text-[10px] text-gray-500 uppercase">Received</div>
            <div className="text-lg font-semibold text-green-400">
              {dataUsage.rxBytes}
            </div>
            <div className="text-[10px] text-gray-500">
              {dataUsage.rxPackets} packets
            </div>
          </div>
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="text-[10px] text-gray-500 uppercase">Sent</div>
            <div className="text-lg font-semibold text-blue-400">
              {dataUsage.txBytes}
            </div>
            <div className="text-[10px] text-gray-500">
              {dataUsage.txPackets} packets
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkInspector;
