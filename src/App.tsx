import { useState, useEffect, useCallback } from "react";
import TopBar from "./components/TopBar";
import ProcessManager from "./components/ProcessManager";
import PermissionManager from "./components/PermissionManager";
import FileExplorer from "./components/FileExplorer";
import QuickCommands from "./components/QuickCommands";
import CommandBar from "./components/CommandBar";
import LogcatViewer from "./components/LogcatViewer";
import DeviceInfo from "./components/DeviceInfo";
import DeviceActions from "./components/DeviceActions";
import Settings from "./components/Settings";
import WifiConnection from "./components/WifiConnection";
import BackupManager from "./components/BackupManager";
import AppManager from "./components/AppManager";

type Section =
  | "dashboard"
  | "device"
  | "wifi"
  | "actions"
  | "processes"
  | "permissions"
  | "files"
  | "quick"
  | "logcat"
  | "settings"
  | "backup"
  | "apps";

const sections: { key: Section; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "device", label: "Device Info" },
  { key: "wifi", label: "WiFi ADB" },
  { key: "actions", label: "Actions" },
  { key: "processes", label: "Process Manager" },
  { key: "permissions", label: "Permissions" },
  { key: "apps", label: "Apps" },
  { key: "files", label: "File Explorer" },
  { key: "quick", label: "Quick Commands" },
  { key: "logcat", label: "Logcat" },
  { key: "settings", label: "Settings" },
  { key: "backup", label: "Backup" },
];

function App() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [packageCount, setPackageCount] = useState<number | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= sections.length) {
        e.preventDefault();
        setActiveSection(sections[num - 1].key);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <TopBar />

      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex gap-2 flex-wrap">
        {sections.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSection(s.key)}
            title={`${s.label} (Alt+${i + 1})`}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeSection === s.key
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            {s.label}
            {s.key === "permissions" &&
              packageCount !== null &&
              packageCount > 0 && (
                <span className="ml-1.5 bg-blue-900/50 text-blue-300 text-xs px-1.5 py-0.5 rounded-full">
                  {packageCount}
                </span>
              )}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-6 bg-gray-950">
        {activeSection === "dashboard" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProcessManager />
              <PermissionManager />
              <FileExplorer />
              <QuickCommands />
            </div>
            <LogcatViewer />
          </div>
        )}

        {activeSection === "device" && <DeviceInfo />}
        {activeSection === "wifi" && <WifiConnection />}
        {activeSection === "actions" && <DeviceActions />}
        {activeSection === "processes" && <ProcessManager />}
        {activeSection === "permissions" && (
          <PermissionManager onCountChange={setPackageCount} />
        )}
        {activeSection === "apps" && <AppManager />}
        {activeSection === "files" && <FileExplorer />}
        {activeSection === "quick" && <QuickCommands />}
        {activeSection === "logcat" && <LogcatViewer />}
        {activeSection === "settings" && <Settings />}
        {activeSection === "backup" && <BackupManager />}
      </main>

      <CommandBar />

      <footer className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-500 text-xs">
        ADB GUI v0.0.0
      </footer>
    </div>
  );
}

export default App;
