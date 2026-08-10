import { useState } from "react";
import TopBar from "./components/TopBar";
import ProcessManager from "./components/ProcessManager";
import PermissionManager from "./components/PermissionManager";
import FileExplorer from "./components/FileExplorer";
import QuickCommands from "./components/QuickCommands";
import CommandBar from "./components/CommandBar";
import LogcatViewer from "./components/LogcatViewer";

type Section =
  "dashboard" | "processes" | "permissions" | "files" | "quick" | "logcat";

const sections: { key: Section; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "processes", label: "Process Manager" },
  { key: "permissions", label: "Permissions" },
  { key: "files", label: "File Explorer" },
  { key: "quick", label: "Quick Commands" },
  { key: "logcat", label: "Logcat" },
];

function App() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [packageCount, setPackageCount] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <TopBar />

      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSection(s.key)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
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

        {activeSection === "processes" && <ProcessManager />}
        {activeSection === "permissions" && (
          <PermissionManager onCountChange={setPackageCount} />
        )}
        {activeSection === "files" && <FileExplorer />}
        {activeSection === "quick" && <QuickCommands />}
        {activeSection === "logcat" && <LogcatViewer />}
      </main>

      <CommandBar />

      <footer className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-500 text-xs">
        ADB GUI v0.0.0
      </footer>
    </div>
  );
}

export default App;
