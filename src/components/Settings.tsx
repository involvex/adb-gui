import React, { useState, useEffect } from "react";
import { settingsStore, type AppSettings } from "../appSettings";
import { quickCommandsStore } from "../electronStore";
import { adbService } from "../adbService";

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(settingsStore.get());
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [adbVersionInfo, setAdbVersionInfo] = useState<{
    version: string;
    path: string;
  } | null>(null);
  const [checkingAdb, setCheckingAdb] = useState(false);

  useEffect(() => {
    checkAdb();
  }, []);

  const checkAdb = async () => {
    setCheckingAdb(true);
    try {
      const info = await adbService.getADBInfo();
      setAdbVersionInfo({ version: info.version, path: info.path });
    } catch {
      setAdbVersionInfo({ version: "Failed to query ADB", path: "Unknown" });
    } finally {
      setCheckingAdb(false);
    }
  };

  const handleSave = () => {
    settingsStore.save(settings);
    setSavedStatus("Settings saved successfully!");
    setTimeout(() => setSavedStatus(null), 2500);
  };

  const handleExportCommands = () => {
    const commands = quickCommandsStore.getAll();
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(commands, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `adb_gui_quick_commands_${Date.now()}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportCommands = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            localStorage.setItem(
              "adb-gui-quick-commands",
              JSON.stringify(parsed),
            );
            setSavedStatus("Quick commands imported successfully!");
            setTimeout(() => setSavedStatus(null), 2500);
          }
        } catch {
          alert("Invalid JSON file for Quick Commands.");
        }
      };
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">
            Application Settings
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Manage ADB configuration, preferences, and backups.
          </p>
        </div>
        {savedStatus && (
          <span className="text-xs bg-green-950/80 text-green-300 border border-green-800 px-3 py-1 rounded animate-pulse font-medium">
            {savedStatus}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {/* ADB Environment */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-200">ADB Environment</h3>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">
                ADB Status & Version
              </span>
              <span className="text-xs font-mono text-cyan-400 mt-0.5">
                {checkingAdb
                  ? "Checking..."
                  : adbVersionInfo?.version || "Not detected"}
              </span>
              <span className="text-[11px] font-mono text-gray-500 mt-0.5">
                Path: {adbVersionInfo?.path || settings.adbPath}
              </span>
            </div>
            <button
              type="button"
              onClick={checkAdb}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded text-xs transition-colors border border-gray-700"
            >
              Verify ADB
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-200">
            Default Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">
                Default Logcat Buffer
              </label>
              <select
                value={settings.defaultBuffer}
                onChange={(e) =>
                  setSettings({ ...settings, defaultBuffer: e.target.value })
                }
                className="bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs outline-none focus:border-gray-500"
              >
                <option value="main">Main</option>
                <option value="system">System</option>
                <option value="crash">Crash</option>
                <option value="events">Events</option>
                <option value="radio">Radio</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">
                Default Logcat Priority
              </label>
              <select
                value={settings.defaultPriority}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPriority: e.target.value })
                }
                className="bg-gray-900 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-xs outline-none focus:border-gray-500"
              >
                <option value="V">Verbose (V)</option>
                <option value="D">Debug (D)</option>
                <option value="I">Info (I)</option>
                <option value="W">Warning (W)</option>
                <option value="E">Error (E)</option>
                <option value="F">Fatal (F)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data & Backup */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-200">
            Quick Commands Data Management
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCommands}
              className="bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800 px-4 py-2 rounded text-xs transition-colors font-medium"
            >
              Export Quick Commands (JSON)
            </button>
            <label className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2 rounded text-xs transition-colors font-medium cursor-pointer">
              Import Quick Commands
              <input
                type="file"
                accept=".json"
                onChange={handleImportCommands}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-800 pt-4">
        <button
          type="button"
          onClick={() => {
            setSettings(settingsStore.reset());
            setSavedStatus("Settings reset to defaults");
            setTimeout(() => setSavedStatus(null), 2500);
          }}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded text-xs transition-colors border border-gray-700"
        >
          Reset Defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded text-xs transition-colors font-medium"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Settings;
