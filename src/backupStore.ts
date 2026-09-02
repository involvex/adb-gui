import {
  quickCommandsStore,
  STORAGE_KEY,
  type QuickCommand,
} from "./electronStore";
import { settingsStore, type AppSettings } from "./appSettings";
import { loadCommandHistory, saveCommandHistory } from "./commandHistoryStore";

export const CURRENT_BACKUP_VERSION = 1;

export interface BackupData {
  version: 1;
  timestamp: string;
  appVersion: string;
  quickCommands: QuickCommand[];
  appSettings: AppSettings;
  commandHistory: string[];
}

function validateQuickCommands(items: unknown): items is QuickCommand[] {
  return (
    Array.isArray(items) &&
    items.every(
      (item): item is QuickCommand =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).title === "string" &&
        typeof (item as Record<string, unknown>).command === "string" &&
        typeof (item as Record<string, unknown>).description === "string" &&
        typeof (item as Record<string, unknown>).icon === "string",
    )
  );
}

function validateAppSettings(obj: unknown): obj is AppSettings {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.adbPath === "string" &&
    typeof s.defaultBuffer === "string" &&
    typeof s.defaultPriority === "string" &&
    typeof s.autoScrollLogcat === "boolean" &&
    (s.theme === "dark" || s.theme === "light")
  );
}

function validateCommandHistory(items: unknown): items is string[] {
  return Array.isArray(items) && items.every((h) => typeof h === "string");
}

export const backupStore = {
  exportAll(): BackupData {
    return {
      version: CURRENT_BACKUP_VERSION,
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
      if (typeof parsed.version !== "number") {
        return { success: false, error: "Missing or invalid version field" };
      }
      if (parsed.version > CURRENT_BACKUP_VERSION) {
        return {
          success: false,
          error: `Backup is from a newer version (v${parsed.version}). Please update the app.`,
        };
      }
      if (!validateQuickCommands(parsed.quickCommands)) {
        return {
          success: false,
          error:
            "Invalid quickCommands data — each command must have id, title, command, description, and icon strings",
        };
      }
      if (!validateAppSettings(parsed.appSettings)) {
        return {
          success: false,
          error:
            "Invalid appSettings data — must include adbPath, defaultBuffer, defaultPriority, autoScrollLogcat, and theme",
        };
      }
      if (!validateCommandHistory(parsed.commandHistory)) {
        return {
          success: false,
          error: "Invalid commandHistory data — must be an array of strings",
        };
      }
      return { success: true, data: parsed as BackupData };
    } catch {
      return { success: false, error: "Failed to parse JSON file" };
    }
  },

  restoreAll(data: BackupData): { success: boolean; error?: string } {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.quickCommands));
      settingsStore.save(data.appSettings);
      saveCommandHistory(data.commandHistory);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error:
          e instanceof Error ? e.message : "Failed to write to localStorage",
      };
    }
  },

  restoreQuickCommands(commands: QuickCommand[]): {
    success: boolean;
    error?: string;
  } {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error:
          e instanceof Error ? e.message : "Failed to write to localStorage",
      };
    }
  },

  restoreSettings(settings: AppSettings): {
    success: boolean;
    error?: string;
  } {
    try {
      settingsStore.save(settings);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error:
          e instanceof Error ? e.message : "Failed to write to localStorage",
      };
    }
  },

  restoreCommandHistory(history: string[]): {
    success: boolean;
    error?: string;
  } {
    try {
      saveCommandHistory(history);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error:
          e instanceof Error ? e.message : "Failed to write to localStorage",
      };
    }
  },

  getCommandHistory(): string[] {
    return loadCommandHistory();
  },
};
