import React, { useState } from "react";
import { adbService } from "../adbService";

const WifiConnection: React.FC = () => {
  const [port, setPort] = useState("5555");
  const [ipAddress, setIpAddress] = useState("");
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
          cable.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-200">
            Step 1: Enable TCP/IP Mode over USB
          </h3>
          <p className="text-xs text-gray-400">
            Connect your device via USB first, then click below to restart ADB
            daemon in TCP/IP mode on the specified port.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Port:</span>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs w-20 font-mono outline-none"
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

        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-200">
            Step 2: Connect to Device IP
          </h3>
          <p className="text-xs text-gray-400">
            Once TCP/IP mode is enabled and USB is unplugged (or on same
            network), enter device IP address to connect.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-xs text-gray-400">IP:Port:</span>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.50:5555"
                className="flex-1 bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs font-mono outline-none"
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
