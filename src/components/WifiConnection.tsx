import React, { useState } from "react";
import { adbService } from "../adbService";

const WifiConnection: React.FC = () => {
  const [port, setPort] = useState("5555");
  const [ipAddress, setIpAddress] = useState("");
  const [pairingPort, setPairingPort] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnableTcpip = async () => {
    setLoading(true);
    setOutput(`Executing: adb tcpip ${port}...`);
    try {
      const res = await adbService.execute(`tcpip ${port}`);
      setOutput(res.stdout || res.stderr || "Success");
    } catch (err) {
      setOutput(
        err instanceof Error
          ? err.message
          : "Failed to switch ADB to TCP/IP mode",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePair = async () => {
    if (!ipAddress.trim()) {
      alert("Please enter the device IP address");
      return;
    }
    if (!pairingCode.trim()) {
      alert("Please enter the pairing code from your device");
      return;
    }
    setLoading(true);
    const target = ipAddress.includes(":")
      ? ipAddress
      : `${ipAddress}:${pairingPort || "37000"}`;
    setOutput(`Executing: adb pair ${target} ...`);
    try {
      const res = await adbService.pair(target, pairingCode.trim());
      const msg = res.stdout || res.stderr || "Pairing successful";
      setOutput(msg);
      if (res.exitCode === 0) {
        setOutput(
          `${msg}\n\nPaired! Now use "Connect" with the device's wireless debugging port (usually 5555) to connect.`,
        );
      }
    } catch (err) {
      setOutput(
        err instanceof Error ? err.message : "Failed to pair with device",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWifi = async () => {
    if (!ipAddress.trim()) {
      alert("Please enter a valid device IP address");
      return;
    }
    setLoading(true);
    const target = ipAddress.includes(":") ? ipAddress : `${ipAddress}:${port}`;
    setOutput(`Executing: adb connect ${target}...`);
    try {
      const res = await adbService.execute(`connect ${target}`);
      setOutput(res.stdout || res.stderr || "Connected");
    } catch (err) {
      setOutput(
        err instanceof Error ? err.message : "Failed to connect via WiFi",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWifi = async () => {
    setLoading(true);
    setOutput(`Executing: adb disconnect...`);
    try {
      const res = await adbService.execute(`disconnect`);
      setOutput(res.stdout || res.stderr || "Disconnected");
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div className="border-b border-gray-800 pb-4">
        <h2 className="text-xl font-semibold text-gray-100">
          Wireless (WiFi) ADB Connection
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Connect to your Android device over Wi-Fi without a physical USB
          cable. Supports Android 11+ pairing and legacy TCP/IP mode.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Android 11+ Pairing */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-200">
            Android 11+ Wireless Pairing
          </h3>
          <p className="text-xs text-gray-400">
            On your device: Settings → Developer options → Wireless debugging →{" "}
            <strong>Pair device with pairing code</strong>. Enter the IP, port,
            and 6-digit code shown on screen.
          </p>
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">IP:</span>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.50"
                className="flex-1 bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-gray-500 transition-colors"
                aria-label="Device IP address"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">Port:</span>
              <input
                type="text"
                value={pairingPort}
                onChange={(e) => setPairingPort(e.target.value)}
                placeholder="37000"
                className="w-24 bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-gray-500 transition-colors"
                aria-label="Pairing port"
              />
              <span className="text-xs text-gray-500">
                (from Wireless debugging screen)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">Code:</span>
              <input
                type="text"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-24 bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-gray-500 transition-colors"
                aria-label="6-digit pairing code"
              />
              <button
                type="button"
                disabled={loading || !ipAddress.trim() || !pairingCode.trim()}
                onClick={handlePair}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-1.5 rounded text-xs transition-colors font-medium disabled:opacity-50"
              >
                Pair
              </button>
            </div>
          </div>
        </div>

        {/* Legacy TCP/IP */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-200">
            Legacy TCP/IP Mode (USB Required)
          </h3>
          <p className="text-xs text-gray-400">
            Connect device via USB first, then restart ADB daemon in TCP/IP
            mode.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Port:</span>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs w-20 font-mono outline-none focus:border-gray-500 transition-colors"
                aria-label="TCP/IP port"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleEnableTcpip}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs transition-colors font-medium disabled:opacity-50"
            >
              Enable TCP/IP
            </button>
          </div>
        </div>

        {/* Connect / Disconnect */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-200">
            Connect to Device
          </h3>
          <p className="text-xs text-gray-400">
            Enter the device IP and wireless debugging port (not the pairing
            port). Usually <code className="text-gray-300">5555</code>.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-xs text-gray-400">IP:Port:</span>
              <input
                type="text"
                value={
                  ipAddress.includes(":") ? ipAddress : `${ipAddress}:${port}`
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const colonIdx = val.lastIndexOf(":");
                  if (colonIdx > 0) {
                    setIpAddress(val.substring(0, colonIdx));
                    setPort(val.substring(colonIdx + 1));
                  } else {
                    setIpAddress(val);
                  }
                }}
                placeholder="192.168.1.50:5555"
                className="flex-1 bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-gray-500 transition-colors"
                aria-label="Device IP and port"
              />
            </div>
            <button
              type="button"
              disabled={loading || !ipAddress.trim()}
              onClick={handleConnectWifi}
              className="bg-green-700 hover:bg-green-600 text-white px-4 py-1.5 rounded text-xs transition-colors font-medium disabled:opacity-50"
            >
              Connect
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleDisconnectWifi}
              className="bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800 px-3 py-1.5 rounded text-xs transition-colors font-medium disabled:opacity-50"
            >
              Disconnect All
            </button>
          </div>
        </div>

        {output && (
          <div className="bg-black border border-gray-800 rounded p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    </div>
  );
};

export default WifiConnection;
