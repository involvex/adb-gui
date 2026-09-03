# Backup System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full backup/restore system that exports and imports all persistent app data (Quick Commands, App Settings, Command History) as a single JSON file.

**Architecture:** A new `backupStore.ts` module handles serialization/deserialization of all localStorage keys into a versioned JSON file. The Settings page gains a "Backup & Restore" section with Export All, Import, and selective restore controls. Existing per-module export/import (QuickCommands.tsx) remains untouched.

**Tech Stack:** React 18, TypeScript 5.3, Tailwind CSS v4, localStorage, Electron 43

**Spec:** Data inventory — 3 localStorage keys: `adb-gui-quick-commands` (QuickCommand[]), `adb-gui-app-settings` (AppSettings), `adb-gui-command-history` (string[]). Total data <10KB.

## Global Constraints

- TypeScript strict mode — no `any`, explicit types required
- No unused variables or parameters (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind CSS utility classes only, dark mode default (`bg-gray-950`, `text-gray-100`)
- One component per file, named export default
- Use `bun` for all package management
- Commit messages follow conventional commits: `type(scope): description`
- All file paths are relative to project root `E:\repos\adb-gui\`

---

## File Map

| Action | File                          | Responsibility                                                     |
| ------ | ----------------------------- | ------------------------------------------------------------------ |
| Create | `src/backupStore.ts`          | Backup/restore logic, file format, all localStorage key management |
| Modify | `src/components/Settings.tsx` | Add "Backup & Restore" UI section                                  |
| Modify | `src/electronStore.ts`        | Add `getAllRaw()` method for backup access                         |
| Modify | `src/appSettings.ts`          | Add `getAllRaw()` method for backup access                         |

---

### Task 1: Create backup store module

**Files:**

- Create: `src/backupStore.ts`

**Interfaces:**

- Consumes: `QuickCommand` from `src/electronStore.ts`, `AppSettings` from `src/appSettings.ts`
- Produces: `BackupData` interface, `backupStore` object with `exportAll()`, `importFromJson()`, `restoreAll()` methods

**Backup file format:**

```json
{
  "version": 1,
  "timestamp": "2026-09-02T12:00:00.000Z",
  "appVersion": "0.0.0",
  "quickCommands": [ ... ],
  "appSettings": { ... },
  "commandHistory": [ ... ]
}
```

- [ ] **Step 1: Create `src/backupStore.ts` with types and export logic**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: PASS (no errors in new file)

- [ ] **Step 3: Commit**

```bash
git add src/backupStore.ts
git commit -m "feat(backup): add backupStore module with export/import logic"
```

---

### Task 2: Add backup UI to Settings page

**Files:**

- Modify: `src/components/Settings.tsx:170-193` (replace "Quick Commands Data Management" section)

**Interfaces:**

- Consumes: `backupStore.exportAll()`, `backupStore.importFromJson()`, `backupStore.restoreAll()` from `src/backupStore.ts`
- Produces: Updated Settings component with backup/restore section

- [ ] **Step 1: Add import for backupStore at top of Settings.tsx**

Add to existing imports (line 1-4):

```typescript
import { backupStore, type BackupData } from "../backupStore";
```

- [ ] **Step 2: Replace the "Quick Commands Data Management" section (lines 170-193) with full Backup & Restore section**

Replace:

```tsx
{
  /* Data & Backup */
}
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
</div>;
```

With:

```tsx
{
  /* Backup & Restore */
}
<div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-4">
  <h3 className="text-sm font-medium text-gray-200">Backup & Restore</h3>
  <p className="text-xs text-gray-400">
    Export all app data (Quick Commands, Settings, Command History) to a JSON
    file, or restore from a previous backup.
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
        <p>Created: {new Date(backupPreview.timestamp).toLocaleString()}</p>
        <p>
          Quick Commands: {backupPreview.quickCommands.length} command
          {backupPreview.quickCommands.length !== 1 ? "s" : ""}
        </p>
        <p>Command History: {backupPreview.commandHistory.length} entries</p>
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
          Restore Quick Commands Only
        </button>
      </div>
    </div>
  )}
</div>;
```

- [ ] **Step 3: Add state and handler functions to Settings component**

Add these state variables after the existing `useState` declarations (after line 13):

```typescript
const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
```

Add these handler functions after the existing `handleImportCommands` function (after line 73):

```typescript
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

const handleImportRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const result = backupStore.importFromJson(event.target?.result as string);
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
  backupStore.restoreAll(backupPreview);
  setSettings(settingsStore.get());
  setBackupPreview(null);
  setSavedStatus("All data restored successfully!");
  setTimeout(() => setSavedStatus(null), 2500);
};

const handleRestoreSelective = () => {
  if (!backupPreview) return;
  if (!confirm("This will overwrite your Quick Commands. Continue?")) {
    return;
  }
  backupStore.restoreQuickCommands(backupPreview.quickCommands);
  setBackupPreview(null);
  setSavedStatus("Quick Commands restored successfully!");
  setTimeout(() => setSavedStatus(null), 2500);
};
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Verify ESLint passes**

Run: `bun run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat(backup): add Backup & Restore section to Settings UI"
```

---

### Task 3: Format code and final verification

**Files:** None created — validation only

- [ ] **Step 1: Format all files**

Run: `bun run format`
Expected: PASS

- [ ] **Step 2: Full prebuild validation**

Run: `bun run prebuild`
Expected: PASS (format + typecheck + lint:fix all succeed)

- [ ] **Step 3: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: format code for backup system"
```

(Only if there are changes; skip if clean.)

---

## Design Decisions

1. **Single-file backup** — All 3 localStorage keys in one JSON file. Simpler UX than 3 separate exports. The file is tiny (<10KB).

2. **Version field** — `version: 1` allows future schema changes (v2 could add device bookmarks, custom themes, etc.). Import rejects unknown versions with a clear error.

3. **Preview before restore** — Import shows a preview (timestamp, command count, history count) before the user commits to restoring. This prevents accidental overwrites.

4. **Selective restore option** — User can restore just Quick Commands without touching Settings or History. This is useful for sharing command sets between machines.

5. **Existing QuickCommands export/import untouched** — The per-module export in QuickCommands.tsx serves a different purpose (sharing command sets) and should remain as-is.

6. **Command history extracted into backupStore** — The `loadHistory`/`saveHistory` functions in `CommandBar.tsx` are duplicated in `backupStore.ts` for the backup module to access history without modifying CommandBar's internal state. This is a pragmatic duplication since the data format is trivial (JSON string array).

## What This Does NOT Cover

- Automatic scheduled backups (out of scope — manual export/import only)
- Cloud sync / remote backup storage
- Device-specific data backup (device selection is ephemeral, not stored)
- Backup of logcat output or process lists (these are live data, not user config)

## Future Enhancements (not in this plan)

- Auto-backup on app exit (write to `app.getPath('userData')/backups/`)
- Backup rotation (keep last N backups)
- Import merge mode (additive, not destructive)
- Backup encryption for sensitive ADB paths
