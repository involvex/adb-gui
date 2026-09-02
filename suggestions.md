# ADB GUI - Feature Suggestions

Based on thorough analysis of the current codebase (last reviewed: 2026-09-02), here are categorized feature ideas organized by priority and effort.

---

## Current State Summary (Verified)

**Fully Implemented:**

- Device management (list, select, refresh) — `TopBar.tsx`
- Process Manager (list, search, kill, sort by PID/name, clear, timestamps) — `ProcessManager.tsx`
- Permission Manager (list 3rd-party packages, activities, grant all, launch, package count badge) — `PermissionManager.tsx`
- File Explorer (browse, navigate, pull/push **files only**, open folder after pull, breadcrumbs) — `FileExplorer.tsx`
- Quick Commands (execute predefined macros, add/edit/delete, variable prompts, import/export, reset) — `QuickCommands.tsx`
- Logcat Viewer (streaming, filters, pause/resume, color coding, multi-row selection & copy, keyboard shortcuts, bookmarks) — `LogcatViewer.tsx`, `LogcatBookmarks.tsx`
- Command Bar (terminal with history, persist to localStorage, Ctrl+K focus) — `CommandBar.tsx`
- APK Installation (single file via file picker) — `TopBar.tsx` + `main.ts`
- Device Info Panel (model, battery, storage, network, screen info) — `DeviceInfo.tsx`
- Device Actions (screenshot, screenrecord, reboot, input, settings, power off) — `DeviceActions.tsx`
- Settings Panel (ADB info, logcat defaults, backup & restore, localStorage usage) — `Settings.tsx`
- WiFi ADB Connection (tcpip, connect/disconnect) — `WifiConnection.tsx`
- App Settings Backup & Restore (export/import all app data as JSON with validation) — `backupStore.ts`, `Settings.tsx`
- App Backup Tab (selective app backup with data to `.ab` files) — `BackupManager.tsx`
- Logcat Bookmark Manager (save/load filter combinations) — `logcatBookmarkStore.ts`, `LogcatBookmarks.tsx`
- Keyboard Shorts (Ctrl+K to focus Command Bar) — `CommandBar.tsx`
- Last refreshed timestamps on components
- Improved empty state messages with device connection tips
- App version display in footer

**Store Modules:**

- `electronStore.ts` — QuickCommands persistence
- `appSettings.ts` — AppSettings persistence
- `backupStore.ts` — Backup/restore with deep validation
- `logcatBookmarkStore.ts` — Logcat bookmark persistence
- `commandHistoryStore.ts` — Command bar history persistence

**IPC Channels (38 handlers in `electron/main.ts`):**

- `adb:execute`, `adb:list-devices`, `adb:list-file-entries`, `adb:pull-file`, `adb:push-file`, `adb:logcat-start`, `adb:logcat-stop`, `adb:open-folder`, `adb:device-info`, `adb:screenshot`, `adb:screenrecord`, `adb:install-apk`, `adb:backup-apps`

---

## Quick Wins (< 1 hour each)

| #   | Feature                                       | Status     | Files to Modify                                                                    |
| --- | --------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| 1   | Clear button in ProcessManager                | ✅ Done    | `src/components/ProcessManager.tsx`                                                |
| 2   | Package count badge in PermissionManager      | ✅ Done    | `src/components/PermissionManager.tsx`, `App.tsx`                                  |
| 3   | Last refreshed timestamp on components        | ✅ Done    | All component files                                                                |
| 4   | Improved empty state messages                 | ✅ Done    | All component files                                                                |
| 5   | Loading skeleton components                   | ⏭️ Skip    | —                                                                                  |
| 6   | Keyboard shortcut: focus Command Bar (Ctrl+K) | ✅ Done    | `src/components/CommandBar.tsx`                                                    |
| 7   | Sort processes by name/PID                    | ✅ Done    | `src/components/ProcessManager.tsx`                                                |
| 8   | Copy logcat line on click / Multi-select Copy | ✅ Done    | `src/components/LogcatViewer.tsx`                                                  |
| 9   | Open containing folder after file pull        | ✅ Done    | `src/components/FileExplorer.tsx`                                                  |
| 10  | Persist CommandBar history to localStorage    | ✅ Done    | `src/commandHistoryStore.ts`, `CommandBar.tsx`                                     |
| 11  | Logcat search filter highlighting/debouncing  | ✅ Done    | `src/components/LogcatViewer.tsx`                                                  |
| 12  | File preview for text/images in FileExplorer  | ⏳ **NEW** | `src/components/FileExplorer.tsx`                                                  |
| 13  | Shortcut label hints in tooltips              | ⏳ **NEW** | `src/components/CommandBar.tsx`, `LogcatViewer.tsx`                                |
| 14  | Copy device serial to clipboard in TopBar     | ⏳ **NEW** | `src/components/TopBar.tsx`                                                        |
| 15  | Confirmation dialog before force-stop         | ⏳ **NEW** | `src/components/ProcessManager.tsx`                                                |
| 16  | Select All / Select None in PermissionManager | ⏳ **NEW** | `src/components/PermissionManager.tsx`                                             |
| 17  | Save current Logcat filters as bookmarks      | ✅ Done    | `LogcatBookmarks.tsx`                                                              |
| 18  | Folder push support (currently files only)    | ⏳ **NEW** | `electron/main.ts`, `electron/preload.ts`, `src/adbService.ts`, `FileExplorer.tsx` |

---

## High Priority — Core Functionality Gaps

### 1. App Info & Management

**Effort:** Medium  
**Status:** ✅ **Planned** — Not yet implemented. A new `AppManager.tsx` component needs to be created.

**Rationale:** The PermissionManager and BackupManager handle permissions and backup, but there's no unified app management view for viewing app details, clearing data/cache, uninstalling, disabling system apps, or exporting APKs.

- View app details (version, size, install date, permissions count)
- Clear app data/cache (`pm clear <package>`)
- Uninstall app with confirmation
- Disable/enable app (system apps)
- Export APK from device (`pm path` + pull)
- Force stop individual apps

**Files to create/modify:**

- New: `src/components/AppManager.tsx`
- `electron/adbService.ts` — add `getAppInfo`, `clearAppData`, `uninstallApp`, `toggleApp` methods
- `electron/main.ts` — add IPC handlers
- `electron/preload.ts` — expose new methods
- `src/adbService.ts` — add renderer wrappers
- `src/App.tsx` — add "Apps" section

### 2. File Explorer Enhancements

**Effort:** Low-Medium  
**Status:** ⚠️ **Partially Done** — Pull/push for files exists. Folder push not yet implemented. Delete/rename/mkdir not implemented.

- File preview (images, text, APK info)
- Delete file/folder on device (`adb shell rm`)
- Rename file/folder (`adb shell mv`)
- Create new folder (`adb shell mkdir`)
- File permissions editing (`chmod`)
- Symlink resolution display
- File search within current directory
- Sort by name/size/date
- **Folder push support** (currently only multi-file push exists, not folder)

### 3. Process Resource Monitoring

**Effort:** Medium  
**Status:** ⚠️ **Planned** — Basic `ps` list exists but no resource/CPU/memory monitoring.

- CPU/memory usage per process (`top -n 1` output parsing)
- Process tree view (parent-child relationships via `ps --forest`)
- Kill with signal options (SIGTERM vs SIGKILL)
- Real-time refresh interval option (auto-refresh toggle)
- Filter by user (root, system, app)

### 4. Testing Infrastructure

**Effort:** Medium  
**Status:** ❌ **Not Started** — No test framework configured despite being listed as a goal.

- Unit tests for ADB service methods (mock child_process)
- Component tests with Vitest + React Testing Library
- E2E tests with Playwright (full app flow)
- IPC integration tests

### 5. Error Handling Improvements

**Effort:** Low  
**Status:** ⚠️ **Partially Done** — Some error handling exists but many components show raw ADB output instead of user-friendly messages.

- User-friendly error messages (not raw ADB output)
- Retry logic for transient failures
- Connection lost detection and recovery
- Command timeout handling with progress feedback

### 6. Type Safety & Performance

**Effort:** Low-Medium  
**Status:** ⚠️ **Partially Done** — TypeScript strict mode is enabled but some `any` types remain (e.g., in `BackupManager.tsx`).

- Replace remaining `any` types with proper interfaces
- Generic types for IPC responses
- Virtualized lists for large process/package lists
- Debounced search inputs
- Lazy loading for components
- Memoization for expensive computations

---

## Medium Priority — Enhanced Features

### 7. Keyboard Shortcuts (Expanded)

**Effort:** Low  
**Status:** ⚠️ **Partially Done** — Only `Ctrl+K` (focus Command Bar) is implemented.

- `Ctrl/⌘ + R` - Refresh devices
- `Ctrl/⌘ + 1-7` - Switch tabs (Dashboard, Process, Permissions, Files, Quick Cmds, Logcat, Apps)
- `Ctrl/⌘ + Shift + L` - Start/Stop Logcat
- `Ctrl/⌘ + Shift + F` - Focus File Explorer search
- Custom shortcut configuration in Settings

### 8. Logcat Export & Timestamp Options

**Effort:** Low  
**Status:** ❌ **Not Started**

- Export logs to file (`.log` or `.txt`)
- Timestamp format options (relative vs absolute vs UTC)
- Log entry count limit configuration
- Bookmark/collapse log sections

### 9. App Data Backup Enhancement

**Effort:** Low  
**Status:** ⚠️ **Partially Done** — Backup/restore export exists. Auto-save and size display not implemented.

- Show backup file size and creation date in preview
- Compress large backups
- Version migration for backup format

### 10. Batch Operations

**Effort:** Medium  
**Status:** ❌ **Not Started**

- Batch APK install (select multiple APKs)
- Batch file pull/push with queue
- Command queue with progress display
- Save/load command batches as presets

### 11. Notification Management

**Effort:** Medium  
**Status:** ❌ **Not Started**

- List active notifications (`dumpsys notification` parsing)
- Clear individual or all notifications
- Filter by app or priority
- Export notification history

### 12. Accessibility Improvements

**Effort:** Low-Medium  
**Status:** ⚠️ **Partially Done** — Some ARIA labels in PermissionManager.

- ARIA labels on all interactive elements
- Keyboard navigation for all components
- High contrast mode toggle
- Screen reader announcements for status updates
- Focus management for modals

### 13. Multi-Device Management

**Effort:** Medium  
**Status:** ⚠️ **Partially Done** — Basic device switching in TopBar exists.

- Per-device tab interface
- Device grouping/naming
- Sync operations across selected devices
- Device comparison views

### 14. ADB Command Snippets Library

**Effort:** Medium  
**Status:** ❌ **Not Started**

- Pre-built collection of useful ADB snippets organized by category
- Curated by difficulty level (beginner, intermediate, advanced)
- Searchable with descriptions

### 15. Device Profiles

**Effort:** Medium  
**Status:** ❌ **Not Started**

- Save device-specific settings (preferred packages, filters, tabs)
- Auto-load profile when device connects
- Export/import profiles

---

## Lower Priority — Nice-to-Have

### 16. Shell Session Management

**Effort:** High  
**Status:** ❌ **Not Started**

- Persistent `adb shell` session (not one-off commands)
- Multiple shell tabs with session naming
- Command history persistence per session
- Auto-complete for common commands
- Session recording/playback

### 17. Remote Control / Mirroring

**Effort:** High  
**Status:** ❌ **Not Started**

- Integrate screen mirroring using `scrcpy`
- Live device screen mirroring in the app
- Click/drag to control device from desktop
- Keyboard input passthrough

### 18. Network Inspector

**Effort:** High  
**Status:** ❌ **Not Started**

- Active connections (`netstat` output parsing)
- WiFi configuration details
- DNS settings
- Proxy settings (get/set)
- Network speed test

### 19. Performance Dashboard

**Effort:** High  
**Status:** ❌ **Not Started**

- CPU usage graph (per-core)
- Memory usage graph
- Battery drain rate
- Storage I/O metrics
- Network throughput

### 20. Theme Customization

**Effort:** Low  
**Status:** ❌ **Not Started**

- Custom accent colors
- Font size options
- Compact/comfortable mode
- Export/import theme presets

### 21. APK Analysis

**Effort:** Medium  
**Status:** ❌ **Not Started**

- Show app permissions
- Show app size breakdown
- Show native architectures (splits)
- Compare with installed version

---

## Implementation Priority Matrix

| Priority | Feature                       | Effort  | Impact | Status      |
| -------- | ----------------------------- | ------- | ------ | ----------- |
| 1        | App Info & Management         | Medium  | High   | Planned     |
| 2        | File Explorer Enhancements    | Low-Med | Medium | Partial     |
| 3        | Process Resource Monitoring   | Medium  | Medium | Planned     |
| 4        | Testing Infrastructure        | Medium  | High   | Not Started |
| 5        | Error Handling Improvements   | Low     | Medium | Partial     |
| 6        | Type Safety & Performance     | Low-Med | Medium | Partial     |
| 7        | Keyboard Shortcuts (Expanded) | Low     | Medium | Partial     |
| 8        | Logcat Export & Timestamps    | Low     | Medium | Not Started |
| 9        | Batch Operations              | Medium  | Medium | Not Started |
| 10       | App Data Backup Enhancement   | Low     | Low    | Partial     |
| 11       | Accessibility Improvements    | Low-Med | Medium | Partial     |
| 12       | ADB Command Snippets Library  | Medium  | Medium | Not Started |
| 13       | Notification Management       | Medium  | Low    | Not Started |
| 14       | Multi-Device Management       | Medium  | Medium | Partial     |
| 15       | Device Profiles               | Medium  | Low    | Not Started |
| 16       | Shell Session Management      | High    | High   | Not Started |
| 17       | Remote Control / Mirroring    | High    | High   | Not Started |
| 18       | Network Inspector             | High    | Medium | Not Started |
| 19       | Performance Dashboard         | High    | High   | Not Started |
| 20       | Theme Customization           | Low     | Low    | Not Started |
| 21       | APK Analysis                  | Medium  | Low    | Not Started |

---

## Quick Wins (Pending — < 1 hour each)

| #   | Feature                                       | Est. Time | Files to Modify                                                       |
| --- | --------------------------------------------- | --------- | --------------------------------------------------------------------- |
| 12  | File preview for text/images in FileExplorer  | 30 min    | `src/components/FileExplorer.tsx`                                     |
| 13  | Shortcut label hints in tooltips              | 20 min    | `src/components/CommandBar.tsx`, `LogcatViewer.tsx`                   |
| 14  | Copy device serial to clipboard in TopBar     | 15 min    | `src/components/TopBar.tsx`                                           |
| 15  | Confirmation dialog before force-stop         | 20 min    | `src/components/ProcessManager.tsx`                                   |
| 16  | Select All / Select None in PermissionManager | 25 min    | `src/components/PermissionManager.tsx`                                |
| 17  | Folder push support in FileExplorer           | 45 min    | `electron/main.ts`, `preload.ts`, `adbService.ts`, `FileExplorer.tsx` |
| 18  | Export logcat to file (.txt)                  | 30 min    | `src/components/LogcatViewer.tsx`, `src/adbService.ts`                |

_Genenerated from codebase analysis. Updated: 2026-09-02_
