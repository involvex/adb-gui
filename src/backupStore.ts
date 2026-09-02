import { quickCommandsStore, type QuickCommand } from "./electronStore";
import { settingsStore, type AppSettings } from "./appSettings";

export interface BackupData {
  version: 1;
  timestamp: string;
  appVersion: string;
  quickCommands: QuickCommand[];
  appSettings: AppSettings;
  commandHistory: string[];
}

const COMMAND_HISTORY_KEY = "adb-gui-command-history";
const MAX_HISTORY = 50;

function loadCommandHistory(): string[] {
  try {
    const raw = localStorage.getItem(COMMAND_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_HISTORY);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCommandHistory(history: string[]): void {
  try {
    localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

export const backupStore = {
  exportAll(): BackupData {
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      appVersion: "0.0.0",
      quickCommands: quickCommandsStore.getAll(),
      appSettings: settingsStore.get(),
      commandHistory: loadCommandHistory(),
    };
  },

  importFromJson(jsonString: string): {
    success: boolean;
    error?: string;
    data?: BackupData;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== "object") {
        return { success: false, error: "Invalid backup file format" };
      }
      if (parsed.version !== 1) {
        return {
          success: false,
          error: `Unsupported backup version: ${parsed.version}`,
        };
      }
      if (!Array.isArray(parsed.quickCommands)) {
        return {
          success: false,
          error: "Missing or invalid quickCommands data",
        };
      }
      if (!parsed.appSettings || typeof parsed.appSettings !== "object") {
        return { success: false, error: "Missing or invalid appSettings data" };
      }
      if (!Array.isArray(parsed.commandHistory)) {
        return {
          success: false,
          error: "Missing or invalid commandHistory data",
        };
      }
      return { success: true, data: parsed as BackupData };
    } catch {
      return { success: false, error: "Failed to parse JSON file" };
    }
  },

  restoreAll(data: BackupData): void {
    localStorage.setItem(
      "adb-gui-quick-commands",
      JSON.stringify(data.quickCommands),
    );
    settingsStore.save(data.appSettings);
    saveCommandHistory(data.commandHistory);
  },

  restoreQuickCommands(commands: QuickCommand[]): void {
    localStorage.setItem("adb-gui-quick-commands", JSON.stringify(commands));
  },

  restoreSettings(settings: AppSettings): void {
    settingsStore.save(settings);
  },

  restoreCommandHistory(history: string[]): void {
    saveCommandHistory(history);
  },

  getCommandHistory(): string[] {
    return loadCommandHistory();
  },
};
