import { useState, useCallback } from "react";
import { adbService } from "../adbService";

const DeviceActions: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordTime, setRecordTime] = useState<number>(10);

  const handleAction = useCallback(
    async (action: string, fn: () => Promise<unknown>) => {
      setLoading(action);
      setError(null);
      setStatusMsg(null);
      try {
        await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : `${action} failed`;
        setError(msg);
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  const handleScreenshot = async () => {
    await handleAction("screenshot", async () => {
      const result = await adbService.screenshot();
      if (result.error === "cancelled") return;
      if (result.exitCode === 0) {
        const name = result.localPath?.split(/[\\/]/).pop() || "screenshot";
        setStatusMsg(`Screenshot saved: ${name}`);
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        setError(result.stderr || "Screenshot failed");
      }
    });
  };

  const handleScreenrecord = async () => {
    await handleAction("screenrecord", async () => {
      setStatusMsg(`Recording for ${recordTime} seconds...`);
      const result = await adbService.screenrecord(recordTime);
      if (result.error === "cancelled") {
        setStatusMsg(null);
        return;
      }
      if (result.exitCode === 0) {
        const name = result.localPath?.split(/[\\/]/).pop() || "recording";
        setStatusMsg(`Recording saved: ${name}`);
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        setError(result.stderr || "Screenrecord failed");
      }
    });
  };

  const handleReboot = async (mode: "normal" | "recovery" | "bootloader") => {
    const cmd =
      mode === "normal"
        ? "reboot"
        : mode === "recovery"
          ? "reboot recovery"
          : "reboot bootloader";
    await handleAction(`reboot-${mode}`, async () => {
      await adbService.execute(cmd);
      setStatusMsg(`Device rebooting to ${mode}...`);
    });
  };

  const handlePowerOff = async () => {
    await handleAction("poweroff", async () => {
      await adbService.execute("shell reboot -p");
      setStatusMsg("Device powering off...");
    });
  };

  const handleToggleUSBDebugging = async () => {
    await handleAction("usb-debug", async () => {
      await adbService.execute("shell settings put global adb_enabled 1");
      setStatusMsg("USB debugging enabled");
      setTimeout(() => setStatusMsg(null), 3000);
    });
  };

  const handleToggleStayAwake = async () => {
    await handleAction("stay-awake", async () => {
      const result = await adbService.execute(
        "shell settings get global stay_on_while_plugged_in",
      );
      const current = result.stdout.trim();
      const newValue = current === "3" ? "0" : "3";
      await adbService.execute(
        `shell settings put global stay_on_while_plugged_in ${newValue}`,
      );
      setStatusMsg(
        newValue === "3" ? "Stay awake enabled" : "Stay awake disabled",
      );
      setTimeout(() => setStatusMsg(null), 3000);
    });
  };

  const handleInputText = async () => {
    const text = prompt("Enter text to input:");
    if (!text) return;
    await handleAction("input-text", async () => {
      await adbService.execute(`shell input text "${text}"`);
      setStatusMsg(`Input sent: ${text}`);
      setTimeout(() => setStatusMsg(null), 3000);
    });
  };

  const handleKeyEvent = async (key: string) => {
    await handleAction(`key-${key}`, async () => {
      await adbService.execute(`shell input keyevent ${key}`);
      setStatusMsg(`Key event sent: ${key}`);
      setTimeout(() => setStatusMsg(null), 3000);
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-3">
        Device Actions
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

      {/* Capture */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Capture</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleScreenshot}
            disabled={loading !== null}
            className="bg-purple-900/30 text-purple-300 px-3 py-1.5 rounded hover:bg-purple-900/50 transition-colors text-sm font-medium border border-purple-800 disabled:opacity-50"
          >
            {loading === "screenshot" ? "Capturing..." : "Screenshot"}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={180}
              value={recordTime}
              onChange={(e) =>
                setRecordTime(parseInt(e.target.value, 10) || 10)
              }
              disabled={loading !== null}
              className="w-16 bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none disabled:opacity-50"
            />
            <span className="text-xs text-gray-500">sec</span>
            <button
              type="button"
              onClick={handleScreenrecord}
              disabled={loading !== null}
              className="bg-red-900/30 text-red-300 px-3 py-1.5 rounded hover:bg-red-900/50 transition-colors text-sm font-medium border border-red-800 disabled:opacity-50"
            >
              {loading === "screenrecord" ? "Recording..." : "Record"}
            </button>
          </div>
        </div>
      </div>

      {/* Power */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Power</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleReboot("normal")}
            disabled={loading !== null}
            className="bg-yellow-900/30 text-yellow-300 px-3 py-1.5 rounded hover:bg-yellow-900/50 transition-colors text-sm font-medium border border-yellow-800 disabled:opacity-50"
          >
            {loading === "reboot-normal" ? "Rebooting..." : "Reboot"}
          </button>
          <button
            type="button"
            onClick={() => handleReboot("recovery")}
            disabled={loading !== null}
            className="bg-yellow-900/30 text-yellow-300 px-3 py-1.5 rounded hover:bg-yellow-900/50 transition-colors text-sm font-medium border border-yellow-800 disabled:opacity-50"
          >
            Recovery
          </button>
          <button
            type="button"
            onClick={() => handleReboot("bootloader")}
            disabled={loading !== null}
            className="bg-yellow-900/30 text-yellow-300 px-3 py-1.5 rounded hover:bg-yellow-900/50 transition-colors text-sm font-medium border border-yellow-800 disabled:opacity-50"
          >
            Bootloader
          </button>
          <button
            type="button"
            onClick={handlePowerOff}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Power Off
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Settings</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleToggleUSBDebugging}
            disabled={loading !== null}
            className="bg-blue-900/30 text-blue-300 px-3 py-1.5 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800 disabled:opacity-50"
          >
            {loading === "usb-debug" ? "Setting..." : "Enable USB Debug"}
          </button>
          <button
            type="button"
            onClick={handleToggleStayAwake}
            disabled={loading !== null}
            className="bg-blue-900/30 text-blue-300 px-3 py-1.5 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800 disabled:opacity-50"
          >
            {loading === "stay-awake" ? "Setting..." : "Toggle Stay Awake"}
          </button>
        </div>
      </div>

      {/* Input */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Input</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleInputText}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Input Text
          </button>
          <button
            type="button"
            onClick={() => handleKeyEvent("KEYCODE_HOME")}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => handleKeyEvent("KEYCODE_BACK")}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => handleKeyEvent("KEYCODE_APP_SWITCH")}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Recent Apps
          </button>
          <button
            type="button"
            onClick={() => handleKeyEvent("KEYCODE_VOLUME_UP")}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Vol+
          </button>
          <button
            type="button"
            onClick={() => handleKeyEvent("KEYCODE_VOLUME_DOWN")}
            disabled={loading !== null}
            className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600 disabled:opacity-50"
          >
            Vol-
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceActions;
