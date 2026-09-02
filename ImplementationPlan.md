# Implementation Plan — Quick Wins & High Priority Items

**Date:** 2026-09-02
**Project:** ADB GUI (Electron + React + TypeScript)
**Branch:** `feature/quick-wins-high-prio`

---

## 0. Summary of Analysis

The codebase has significantly evolved since `suggestions.md` was first written. A thorough review of all source files reveals:

### What's Actually Done (vs. what suggestions.md claimed was done)

- **✅ Fully implemented:** Device management, Process Manager, Permission Manager, File Explorer (pull/push **files only**), Quick Commands, Logcat Viewer (with bookmarks), Command Bar, APK install, Device Info, Device Actions, Settings panel, WiFi ADB, App backup/restore, Logcat bookmark manager
- **⚠️ Partially done:** File Explorer push (files only, no folders), Keyboard shortcuts (only Ctrl+K), Error handling (basic), Type safety (some `any` remains), Accessibility (limited ARIA), Testing (none)
- **❌ Not started:** App Info & Management, Process resource monitoring, Extended keyboard shortcuts, Logcat export, Batch operations, Shell sessions, Notification management, Testing infrastructure, Network inspector, Performance dashboard, Theme customization, APK analysis, ADB snippets library, Device profiles

### Key Discrepancies in Original suggestions.md

| Item                          | suggestions.md claim | Actual state                                                                     |
| ----------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| File Push (multi-file/folder) | ✅ Done              | ⚠️ Files only, no folder support                                                 |
| Settings Panel (full)         | ✅ Done              | ⚠️ Partial — no ADB path config, no window position persistence, no compact mode |
| Keyboard Shortcuts            | ✅ Done              | ⚠️ Only Ctrl+K implemented                                                       |
| Process Resource Monitoring   | Pending              | ❌ Not started                                                                   |
| Logcat Export                 | ✅ Done              | ❌ Not started                                                                   |
| File Preview                  | N/A                  | ❌ Not started                                                                   |

---

## 1. Phase 1: Quick Wins (Estimated: 3–4 hours total)

These are small, self-contained changes that improve UX with minimal risk. Each is independent.

### 1.1 Copy Device Serial to Clipboard (15 min)

**Files:** `src/components/TopBar.tsx`

**Change:** Add a copy-to-clipboard icon/button next to the active device serial in the TopBar.

```tsx
// In handleSelect result area, add:
<button
  type="button"
  onClick={async () => {
    await navigator.clipboard.writeText(activeId);
    // show brief "copied" status
  }}
  className="... text-gray-500 hover:text-gray-300"
  title="Copy serial to clipboard"
>
  📋
</button>
```

### 1.2 Confirmation Dialog Before Force-Stop (20 min)

**Files:** `src/components/ProcessManager.tsx`

**Change:** Wrap `handleKill` with a `confirm()` dialog.

```tsx
const handleKill = async (pkgName: string) => {
  if (!confirm(`Force-stop ${pkgName}? This cannot be undone.`)) return;
  // ... existing logic
};
```

### 1.3 Select All / Select None in PermissionManager (20 min)

**Files:** `src/components/PermissionManager.tsx`

**Change:** Add two buttons above the package list: "Select All" and "Select None" that operate on the filtered list.

**Implementation:** Add a `selectedPkgs: Set<string>` state, render checkboxes, and add select-all/none buttons. Only "Grant All" per-package currently exists.

### 1.4 Shortcut Label Hints in Tooltips (20 min)

**Files:** `src/components/CommandBar.tsx`, `src/components/LogcatViewer.tsx`, `src/components/TopBar.tsx`

**Change:** Add `title` attributes showing keyboard shortcuts.

- CommandBar: `title="Run (Ctrl+Enter)"` on Run button
- LogcatViewer: `title="Copy (Ctrl+C)"` on Copy Selected button
- TopBar: `title="Refresh devices (Ctrl+R)"` — note: Ctrl+R not yet implemented, so only add hints for implemented shortcuts

### 1.5 File Preview in FileExplorer (30 min)

**Files:** `src/components/FileExplorer.tsx`

**Change:** Add a preview pane/tab that shows:

- Text files: raw content
- Images: `<img>` preview with object-fit
- APK files: basic file info (size, perms)
- Unknown: icon placeholder

**Implementation:** When a non-directory entry is clicked, fetch a preview. For text/images, use `adbService.execute('shell cat <path>')` or `adbService.pullFile()` for images.

### 1.6 Export Logcat to File (30 min)

**Files:** `src/components/LogcatViewer.tsx`, `src/adbService.ts`

**Change:** Add an "Export" button in LogcatViewer that writes all current (filtered or raw) log lines to a `.txt` or `.log` file using a browser Blob download.

```tsx
const handleExport = () => {
  const content = lines.map((l) => l.raw).join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logcat_${Date.now()}.log`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### 1.7 Folder Push Support in FileExplorer (45 min)

**Files:** `electron/main.ts`, `electron/preload.ts`, `src/adbService.ts`, `src/components/FileExplorer.tsx`

**Change:** Update the existing `adb:push-file` IPC handler to use `properties: ["openFile", "openDirectory", "multiSelections"]` instead of just `["openFile", "multiSelections"]`. The Main process already handles directories by joining each file path with the remote path as a filename — for a directory push, we need to detect if the local path is a directory and push as `push <dir> <remote_dir>`.

**Implementation in `main.ts`:**

```typescript
// In the push-file handler, detect directory and adjust
import { statSync } from "node:fs";
// For each filePath, check if it's a directory
// If directory, push as: adb push <localDir> <remoteDir>/
// If file, push as: adb push <localFile> <remoteDir>/<filename>
```

---

## 2. Phase 2: High Priority Items (Estimated: 40–80 hours total)

### 2.1 App Info & Management — NEW COMPONENT (Medium effort, ~20-30 hours)

**Goal:** Create a comprehensive app management panel replacing and extending the PermissionManager's per-package functionality.

**New file:** `src/components/AppManager.tsx`

**AdbService additions (`electron/adbService.ts`):**

```typescript
// New methods on AdbService class
async getAppInfo(packageName: string): Promise<{
  versionName: string;
  versionCode: string;
  installedSize: string;
  cacheSize: string;
  dataSize: string;
  permissions: string[];
  installDate: string;
}>
async clearAppData(packageName: string): Promise<AdbResult>
async uninstallApp(packageName: string, keepData: boolean): Promise<AdbResult>
async toggleApp(packageName: string, enable: boolean): Promise<AdbResult>
async forceStopPackage(packageName: string): Promise<AdbResult>  // duplicate of forceStop but explicit
async getApkPath(packageName: string): Promise<string>  // for APK export
```

**IPC handlers (`electron/main.ts`):**

- `adb:app-info` — calls `AdbService` methods, returns structured data
- `adb:clear-app-data` — clears app data
- `adb:uninstall-app` — uninstalls app
- `adb:toggle-app` — enables/disables app

**Preload bridge (`electron/preload.ts`):**

- Expose `getAppInfo`, `clearAppData`, `uninstallApp`, `toggleApp`, `forceStopPackage`

**Renderer service (`src/adbService.ts`):**

- Add wrapper functions for all new methods

**App.tsx:**

- Add "apps" section and nav button

**UI Component (`src/components/AppManager.tsx`):**

- Search/filter third-party packages
- Expandable rows showing app details (version, size, install date)
- Action buttons: Clear Data, Force Stop, Uninstall, Export APK, Disable/Enable
- Confirmation dialogs for destructive actions
- Package count badge in nav

### 2.2 Process Resource Monitoring (Medium effort, ~15-20 hours)

**Files:** `src/components/ProcessManager.tsx`, `electron/adbService.ts`

**AdbService additions:**

```typescript
async getProcessStats(): Promise<{
  user: string;
  pid: number;
  name: string;
  cpu: string;    // %CPU
  memory: string; // memory in KB
}[]>
// Uses: adb shell top -n 1 -d 1 -q -o PID,USER,CPU,MEM,NAME
// or: adb shell ps -A -o USER,PID,%CPU,%MEM,NAME
```

**ProcessManager UI changes:**

- Add CPU% and MEM columns
- Add "Auto-refresh" toggle (polls every 2-5 seconds)
- Add "Refresh" manual button
- Add sort options for CPU and MEM
- Add "Kill" confirmation (from quick wins)
- Add signal selection (SIGTERM vs SIGKILL) when killing

### 2.3 File Explorer Enhancements (Medium effort, ~15-20 hours)

**Files:** `src/components/FileExplorer.tsx`, `electron/main.ts`, `electron/adbService.ts`

**New features:**

- Delete file/folder (`adb shell rm -rf <path>`)
- Rename file/folder (`adb shell mv <old> <new>`)
- Create new folder (`adb shell mkdir -p <path>`)
- File permissions editing (`chmod`)
- Sort by name/size/date (clickable column headers)
- File search within current directory

**New IPC handlers:**

- `adb:delete-file` — deletes a file or directory on device
- `adb:rename-file` — renames a file or directory on device
- `adb:create-folder` — creates a folder on device
- `adb:chmod-file` — changes file permissions

### 2.4 Testing Infrastructure (Medium effort, ~15-20 hours)

**New files:**

- `vitest.config.ts` or add to `vite.config.ts`
- `src/__tests__/adbService.test.ts`
- `src/__tests__/electronStore.test.ts`
- `src/__tests__/backupStore.test.ts`
- `src/__tests__/components/*.test.tsx`
- `e2e/` directory for Playwright tests

**package.json additions:**

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^24.0.0",
    "playwright": "^1.50.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test"
  }
}
```

**Coverage plan:**

- Unit tests for `adbService.ts` (mock `window.adb`)
- Unit tests for store modules (`electronStore`, `backupStore`, `appSettings`, `logcatBookmarkStore`, `commandHistoryStore`)
- Component tests for `QuickCommands`, `ProcessManager`, `PermissionManager`
- E2E test for basic app flow (launch → device detection → execute command)

### 2.5 Type Safety & Performance (Low-Medium effort, ~8-12 hours)

**Files:** All TypeScript files

**Changes:**

- Replace `any` types in `BackupManager.tsx` (the `AdbResult` interface is duplicated locally)
- Add explicit types for all IPC response interfaces in `preload.ts`
- Add virtualized list for ProcessManager when >500 processes (react-window or react-virtualized)
- Add `useMemo`/debounce on search inputs in ProcessManager, PermissionManager, BackupManager, FileExplorer
- Add `React.memo` on frequently re-rendered list items
- Lazy-load heavy components (LogcatViewer, BackupManager) with `React.lazy` + `Suspense`

---

## 3. Phase 3: Medium Priority Items (Future)

These are valuable but not blocking core functionality:

| Feature                           | Effort  | Key Files                                   |
| --------------------------------- | ------- | ------------------------------------------- |
| Keyboard Shortcuts (Expanded)     | Low     | `src/main.tsx` (global listener), `App.tsx` |
| Logcat Export & Timestamp Options | Low     | `LogcatViewer.tsx`                          |
| App Data Backup Enhancement       | Low     | `backupStore.ts`, `Settings.tsx`            |
| Batch Operations                  | Medium  | New component/modal                         |
| Notification Management           | Medium  | New `NotificationManager.tsx`               |
| Accessibility Improvements        | Low-Med | All components                              |
| Multi-Device Management           | Medium  | `TopBar.tsx`, `App.tsx`                     |
| ADB Command Snippets Library      | Medium  | New component                               |
| Device Profiles                   | Medium  | New store module, `Settings.tsx`            |

---

## 4. Phase 4: Lower Priority / High Effort (Future)

| Feature                    | Effort | Key Files                                    |
| -------------------------- | ------ | -------------------------------------------- |
| Shell Session Management   | High   | New component, Main process persistent spawn |
| Remote Control / Mirroring | High   | New component, `scrcpy` integration          |
| Network Inspector          | High   | New component                                |
| Performance Dashboard      | High   | New component, monitoring hooks              |
| Theme Customization        | Low    | `src/index.css`, `Settings.tsx`              |
| APK Analysis               | Medium | New component                                |

---

## 5. Execution Order Recommendation

```
1. Quick Wins (Phase 1)     → 3-4 hours  → Immediate UX improvement
2. App Info & Management     → 20-30 hrs  → High impact, new feature
3. Process Resource Mon.     → 15-20 hrs  → Medium impact, enhances existing
4. File Explorer Enhance.    → 15-20 hrs  → Medium impact, enhances existing
5. Testing Infrastructure    → 15-20 hrs  → Critical for long-term maintainability
6. Type Safety & Perf        → 8-12 hrs   → Good hygiene
7. [Pause for review]
→ Medium Priority items (Phase 3)
→ Lower Priority items (Phase 4)
```

## 6. Agent Instructions

When implementing these items, follow the existing patterns in the codebase:

1. **Main process changes:** Add methods to `AdbService` class in `electron/adbService.ts`, then add `ipcMain.handle` in `electron/main.ts`
2. **Preload bridge:** Expose new methods in `electron/preload.ts` following the existing pattern
3. **Renderer service:** Add wrapper functions in `src/adbService.ts` that delegate to `window.adb`
4. **UI:** Create or modify components in `src/components/` using the established Tailwind dark-mode aesthetic
5. **Stores:** Add new localStorage stores as separate modules in `src/` (e.g., `src/newStore.ts`)
6. **Navigation:** Add new sections by updating the `Section` type and `sections` array in `src/App.tsx`
7. **Security:** All ADB commands execute in the Main process with shell metacharacter escaping (`[&|<>$`\]`)
8. **Timeouts:** Use appropriate timeouts: 10s default, 30s for directory listings/permissions, 60s for pull/push, 120s for backup/apk install
9. **Code style:** Run `bun run format && bun run typecheck && bun run lint:fix` before any commit

## 7. Verification Checklist

Before marking any item complete:

- [ ] TypeScript compiles without errors (`bun run typecheck`)
- [ ] ESLint passes (`bun run lint`)
- [ ] Code is formatted (`bun run format`)
- [ ] No `any` types introduced for new code
- [ ] New IPC handlers have matching preload exposure
- [ ] New AdbService methods have renderer-side wrappers
- [ ] New components follow Tailwind dark-mode conventions
- [ ] New store modules persist to localStorage with try/catch
- [ ] Error states are handled gracefully (no unhandled exceptions)
- [ ] User-facing strings are consistent with existing style
