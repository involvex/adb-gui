import React, { useState, useEffect } from "react";
import { settingsStore, type AppSettings } from "../appSettings";
import { adbService } from "../adbService";
import { backupStore, type BackupData } from "../backupStore";

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(settingsStore.get());
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [adbVersionInfo, setAdbVersionInfo] = useState<{
    version: string;
    path: string;
  } | null>(null);
  const [checkingAdb, setCheckingAdb] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);

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

  const handleExportAll = () => {
    const data = backupStore.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adb_gui_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedStatus("Backup exported successfully!");
    setTimeout(() => setSavedStatus(null), 2500);
  };

  const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10MB

  const handleImportRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_SIZE) {
      alert("Backup file is too large (max 10MB)");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== "string") {
        alert("Failed to read file");
        return;
      }
      const result = backupStore.importFromJson(content);
      if (result.success && result.data) {
        setBackupPreview(result.data);
      } else {
        alert(result.error || "Failed to import backup");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestoreAll = () => {
    if (!backupPreview) return;
    if (
      !confirm(
        "This will overwrite all current data. Quick Commands, Settings, and Command History will be replaced. Continue?",
      )
    ) {
      return;
    }
    const result = backupStore.restoreAll(backupPreview);
    if (result.success) {
      setSettings(settingsStore.get());
      setBackupPreview(null);
      setSavedStatus("All data restored successfully!");
      setTimeout(() => setSavedStatus(null), 2500);
    } else {
      alert(`Restore failed: ${result.error}`);
    }
  };

  const handleRestoreSelective = () => {
    if (!backupPreview) return;
    if (!confirm("This will overwrite your Quick Commands. Continue?")) {
      return;
    }
    const result = backupStore.restoreQuickCommands(
      backupPreview.quickCommands,
    );
    if (result.success) {
      setBackupPreview(null);
      setSavedStatus("Quick Commands restored successfully!");
      setTimeout(() => setSavedStatus(null), 2500);
    } else {
      alert(`Restore failed: ${result.error}`);
    }
  };

  const handleRestoreSettings = () => {
    if (!backupPreview) return;
    if (!confirm("This will overwrite your Settings. Continue?")) {
      return;
    }
    const result = backupStore.restoreSettings(backupPreview.appSettings);
    if (result.success) {
      setSettings(settingsStore.get());
      setBackupPreview(null);
      setSavedStatus("Settings restored successfully!");
      setTimeout(() => setSavedStatus(null), 2500);
    } else {
      alert(`Restore failed: ${result.error}`);
    }
  };

  const handleRestoreHistory = () => {
    if (!backupPreview) return;
    if (!confirm("This will overwrite your Command History. Continue?")) {
      return;
    }
    const result = backupStore.restoreCommandHistory(
      backupPreview.commandHistory,
    );
    if (result.success) {
      setBackupPreview(null);
      setSavedStatus("Command History restored successfully!");
      setTimeout(() => setSavedStatus(null), 2500);
    } else {
      alert(`Restore failed: ${result.error}`);
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

        {/* Backup & Restore */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-200">
            Backup & Restore
          </h3>
          <p className="text-xs text-gray-400">
            Export all app data (Quick Commands, Settings, Command History) to a
            JSON file, or restore from a previous backup.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportAll}
              className="bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800 px-4 py-2 rounded text-xs transition-colors font-medium"
            >
              Export All Data (JSON)
            </button>
            <label className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2 rounded text-xs transition-colors font-medium cursor-pointer">
              Import & Restore
              <input
                type="file"
                accept=".json"
                onChange={handleImportRestore}
                className="hidden"
              />
            </label>
          </div>

          {backupPreview && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-200">
                  Backup Preview
                </span>
                <button
                  type="button"
                  onClick={() => setBackupPreview(null)}
                  className="text-gray-500 hover:text-gray-300 text-xs"
                >
                  Dismiss
                </button>
              </div>
              <div className="text-[11px] text-gray-400 space-y-0.5">
                <p>Version: {backupPreview.version}</p>
                <p>
                  Created: {new Date(backupPreview.timestamp).toLocaleString()}
                </p>
                <p>
                  Quick Commands: {backupPreview.quickCommands.length} command
                  {backupPreview.quickCommands.length !== 1 ? "s" : ""}
                </p>
                <p>
                  Command History: {backupPreview.commandHistory.length} entries
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  className="bg-green-950/40 hover:bg-green-900/60 text-green-300 border border-green-800 px-3 py-1.5 rounded text-xs transition-colors font-medium"
                >
                  Restore All
                </button>
                <button
                  type="button"
                  onClick={handleRestoreSelective}
                  className="bg-yellow-950/40 hover:bg-yellow-900/60 text-yellow-300 border border-yellow-800 px-3 py-1.5 rounded text-xs transition-colors font-medium"
                >
                  Quick Commands Only
                </button>
                <button
                  type="button"
                  onClick={handleRestoreSettings}
                  className="bg-yellow-950/40 hover:bg-yellow-900/60 text-yellow-300 border border-yellow-800 px-3 py-1.5 rounded text-xs transition-colors font-medium"
                >
                  Settings Only
                </button>
                <button
                  type="button"
                  onClick={handleRestoreHistory}
                  className="bg-yellow-950/40 hover:bg-yellow-900/60 text-yellow-300 border border-yellow-800 px-3 py-1.5 rounded text-xs transition-colors font-medium"
                >
                  History Only
                </button>
              </div>
            </div>
          )}
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
