# ADB GUI - Feature Suggestions

Based on analysis of the current codebase, here are categorized feature ideas organized by priority and effort.

---

## Current State Summary

**Implemented:**

- Device management (list, select, refresh)
- Process Manager (list, search, kill, sort by PID/name, clear)
- Permission Manager (list 3rd-party packages, activities, grant all, launch, package count badge)
- File Explorer (browse, navigate, pull/push files, open folder after pull, file/folder operations)
- Quick Commands (execute predefined macros, add/edit/delete, variable prompts, import/export)
- Logcat Viewer (streaming, filters, pause/resume, color coding, multi-row selection & copy, keyboard shortcuts)
- Command Bar (terminal with history, persist to localStorage, Ctrl+K focus)
- APK Installation (single file)
- Device Info Panel (model, battery, storage, network)
- Device Actions (screenshot, screenrecord, reboot, input, settings)
- Last refreshed timestamps on components
- Improved empty state messages
- Settings panel (window size, localStorage usage, theme)
- WiFi ADB Connection (tcpip, connect/disconnect, recent devices)
- App Settings Backup & Restore (export/import all app data as JSON)
- App Backup tab (selective app backup with data to .ab files)
- Logcat Bookmark Manager (save/load filter combinations)

---

## High Priority - Core Functionality

### 1. File Push Support (Multi-file/folder)

**Effort:** Medium  
**Files:** `electron/main.ts`, `electron/preload.ts`, `src/adbService.ts`, `src/components/FileExplorer.tsx`

Currently only `Pull` exists. Add `Push` button to upload files from host to device.

- Add IPC handler `adb:push-file` with `dialog.showOpenElement` (multi-file support)
- Add `pushFile()` to preload bridge
- Add UI button next to Pull in FileExplorer
- Support both file and folder push

### 2. Device Info Enhancement

**Effort:** Low  
**Files:** `src/components/DeviceInfo.tsx`, `electron/adbService.ts`

Enhance the existing Device Info panel with more detailed information.

- Add real-time battery monitoring with charge status
- Show device uptime and kernel version
- Add WiFi MAC address and Bluetooth status
- Display IMEI/SN (if available)
- Add copy-to-clipboard buttons for device identifiers

### 3. Settings Panel (Additional Options)

**Effort:** Medium  
**Files:** `src/components/Settings.tsx`, new IPC handlers

Expand the existing settings panel.

- ADB path configuration (auto-detect or manual)
- Default device selection preference
- Theme customization (accent colors, compact mode)
- Default logcat buffer/priority
- Command timeout configuration per module
- Window size/position persistence

### 3.5. App Data Backup Enhancement

**Effort:** Low  
**Files:** `src/components/BackupManager.tsx`, `src/backupStore.ts`

The existing app backup feature (for ADB GUI's own settings) could be enhanced:

- Auto-save backups on a schedule (e.g., before major operations)
- Show backup file size and creation date
- Compress large backups
- Version migration for backup format

---

## Medium Priority - Enhanced Features

### 4. Screenrecord Enhancement

**Effort:** Medium  
**Files:** `src/components/DeviceActions.tsx`, `electron/main.ts`

Improve the existing screenrecord functionality.

- Time-limited recording with progress indicator
- Video file size preview
- Record with audio option (requires Android 10+)
- Inline video preview before saving

### 6. App Info & Management

**Effort:** Medium  
**Files:** New component `src/components/AppManager.tsx`

Package management beyond permissions and backup.

- View app details (version, size, install date, permissions count)
- Clear app data/cache
- Uninstall app with confirmation
- Disable/enable app (system apps)
- Export APK from device (`pm path` + pull)
- Force stop individual apps

### 7. Process Details & Resource Monitoring

**Effort:** Medium  
**Files:** `src/components/ProcessManager.tsx`, `electron/adbService.ts`

Enhanced process management with resource visibility.

- CPU/memory usage per process (`top -n 1` output parsing)
- Process tree view (parent-child relationships via `ps --forest`)
- Kill with signal options (SIGTERM vs SIGKILL)
- Real-time refresh interval option (auto-refresh toggle)
- Filter by user (root, system, app)

### 8. Logcat Enhancements

**Effort:** Low-Medium  
**Files:** `src/components/LogcatViewer.tsx`

Improve existing logcat viewer.

- Log level filter (multi-select, not just minimum threshold)
- Tag-based filtering with UI chips
- Regex search support
- Export logs to file (`.log` or `.txt`)
- Timestamp format options (relative vs absolute vs UTC)
- Log entry count limit configuration
- Bookmark/collapse log sections
- **Logcat Bookmark Manager** ✅ — Save current filter combinations (priority, buffer, tags, PID) as named bookmarks for quick re-application

### 9. Quick Commands Improvements

**Effort:** Low  
**Files:** `src/components/QuickCommands.tsx`, `src/electronStore.ts`

Already partially implemented. Remaining enhancements:

- Command categories/folders
- Drag-and-drop reordering
- Favorite/pin frequently used commands
- Recent commands history section

### 10. Keyboard Shortcuts

**Effort:** Low  
**Files:** `src/App.tsx`, `src/components/*`

Already partially implemented. Expand coverage:

- `Ctrl/⌘ + R` - Refresh devices
- `Ctrl/⌘ + K` - Focus Command Bar ✅
- `Ctrl/⌘ + 1-7` - Switch tabs (Dashboard, Process, Permissions, Files, Quick Cmds, Logcat, Backup)
- `Ctrl/⌘ + Shift + L` - Start/Stop Logcat
- `Ctrl/⌘ + Shift + P` - Process Manager focus
- Custom shortcut configuration in Settings

---

## Lower Priority - Nice-to-Have

### 11. Batch Operations

**Effort:** Medium  
**Files:** New component or modal

Execute multiple commands in sequence or parallel.

- Batch APK install (select multiple APKs)
- Batch file pull/push with queue
- Command queue with progress display
- Save/load command batches as presets

### 12. Testing Infrastructure

**Effort:** Medium  
**Files:** New test files, config

Add automated testing for reliability.

- Unit tests for ADB service methods (mock child_process)
- Component tests with Vitest + React Testing Library
- E2E tests with Playwright (full app flow)
- IPC integration tests

### 13. Shell Session Management

**Effort:** High  
**Files:** New component, persistent spawn

Interactive shell session with multiple tabs.

- Persistent `adb shell` session (not one-off commands)
- Multiple shell tabs with session naming
- Command history persistence per session
- Auto-complete for common commands
- Session recording/playback

### 14. Notification Management

**Effort:** Medium  
**Files:** New component, ADB notification commands

View and manage device notifications.

- List active notifications (`dumpsys notification` parsing)
- Clear individual or all notifications
- Filter by app or priority
- Export notification history

### 15. File Explorer Enhancements

**Effort:** Low-Medium  
**Files:** `src/components/FileExplorer.tsx`

Already partially implemented (pull/push, open folder). Remaining:

- File preview (images, text, APK info)
- Delete file/folder on device
- Rename file/folder
- Create new folder
- File permissions editing (chmod)
- Symlink resolution display
- File search within current directory
- Sort by name/size/date

### 16. Network Inspector

**Effort:** High  
**Files:** New component, ADB shell commands

View network activity and configuration.

- Active connections (`netstat` output parsing)
- WiFi configuration details
- DNS settings
- Proxy settings (get/set)
- Network speed test

### 17. Performance Dashboard

**Effort:** High  
**Files:** New component, monitoring hooks

Real-time device performance monitoring.

- CPU usage graph (per-core)
- Memory usage graph
- Battery drain rate
- Storage I/O metrics
- Network throughput

### 18. Theme Customization

**Effort:** Low  
**Files:** `src/index.css`, `src/components/Settings.tsx`

Customizable appearance.

- Custom accent colors
- Font size options
- Compact/comfortable mode
- Export/import theme presets

### 19. Accessibility Improvements

**Effort:** Low-Medium  
**Files:** All components

Better accessibility compliance.

- ARIA labels on all interactive elements
- Keyboard navigation for all components
- High contrast mode toggle
- Screen reader announcements for status updates
- Focus management for modals

### 20. Multi-Device Management

**Effort:** Medium  
**Files:** `src/components/TopBar.tsx`, `electron/adbService.ts`

Enhanced support for multiple connected devices.

- Per-device tab interface
- Device grouping/naming
- Sync operations across selected devices
- Device comparison views

### 21. APK Analysis

**Effort:** Medium  
**Files:** New component, `apkanalyzer` integration

Analyze APK files before installation.

- Show app permissions
- Show app size breakdown
- Show native architectures (splits)
- Compare with installed version

---

## Bug Fixes & Code Quality

### 22. Error Handling Improvements

**Effort:** Low  
**Files:** All service and component files

Better error messages and recovery.

- User-friendly error messages (not raw ADB output)
- Retry logic for transient failures
- Connection lost detection and recovery
- Command timeout handling with progress feedback

### 23. Type Safety & Performance

**Effort:** Low-Medium  
**Files:** All TypeScript files

- Replace any remaining `any` types with proper interfaces
- Generic types for IPC responses
- Virtualized lists for large process/package lists
- Debounced search inputs
- Lazy loading for components
- Memoization for expensive computations

### 24. Documentation

**Effort:** Low  
**Files:** `README.md`, new docs

Already partially implemented. Remaining:

- API documentation for IPC channels
- Keyboard shortcuts reference guide
- Troubleshooting guide
- Changelog

---

## Implementation Priority Matrix

| Priority | Feature                     | Effort     | Impact | Status      |
| -------- | --------------------------- | ---------- | ------ | ----------- |
| 1        | File Push (multi-file)      | Medium     | High   | ✅ Done     |
| 2        | Device Info Enhancement     | Low        | Medium | ⏭️ Skipped* |
| 3        | Settings Panel (full)       | Medium     | High   | ✅ Done     |
| 4        | WiFi ADB Connection         | Medium     | High   | ✅ Done     |
| 5        | Screenrecord Enhancement    | Medium     | High   | ✅ Done     |
| 6        | App Info & Management       | Medium     | High   | Pending     |
| 7        | Process Resource Monitoring | Medium     | Medium | Pending     |
| 8        | Logcat Enhancements         | Low-Medium | Medium | ✅ Done     |
| 9        | Quick Commands Improvements | Low        | Medium | ✅ Done     |
| 10       | Keyboard Shortcuts          | Low        | Medium | ✅ Done     |
| 11       | Testing Infrastructure      | Medium     | High   | Pending     |
| 12       | Shell Session Management    | High       | High   | Pending     |
| 13       | App Backup Tab              | Medium     | Medium | ✅ Done     |
| 14       | App Settings Backup/Restore | Medium     | Medium | ✅ Done     |
| 15       | Logcat Bookmark Manager     | Low        | Medium | ✅ Done     |

*Note: Device Info already has a basic panel. Enhancement to show real-time data and additional info could be a future iteration.

---

## Quick Wins (< 1 hour each)

1. Add `Clear` button to ProcessManager ✅
2. Add package count badge to PermissionManager tab ✅
3. Add last refreshed timestamp to components ✅
4. Improve empty state messages with device connection tips ✅
5. Add loading skeleton components ⏭️ (skipped)
6. Keyboard shortcut to focus Command Bar ✅
7. Sort processes by name/PID option ✅
8. Copy logcat line on click / Multi-select & Copy ✅
9. Add "Open containing folder" after file pull ✅
10. Persist CommandBar history to localStorage ✅
11. Add Logcat search filter highlighting / debouncing ✅
12. Add file preview for text/images in FileExplorer
13. Add shortcut label hints in tooltips (e.g., "Ctrl+K")
14. Add "Copy to clipboard" for device serial in TopBar
15. Add confirmation dialog before force-stop in ProcessManager
16. Add "Select All" / "Select None" to PermissionManager
17. Save current Logcat filters as bookmarks ✅

---

## New Suggestions (2026-09-02)

Based on the recent backup feature additions, here are new ideas:

### 25. Remote Control / Mirroring

**Effort:** High  
**Files:** New component, `scrcpy` integration

Integrate screen mirroring and remote control using scrcpy:

- Live device screen mirroring in the app
- Click/drag to control device from desktop
- Keyboard input passthrough
- Recording of mirrored sessions

### 26. Logcat Bookmark Manager

**Effort:** Low  
**Files:** `src/components/LogcatViewer.tsx`

- Save frequently used tag/level filters as bookmarks
- Share filter configurations between devices

### 27. ADB Command Snippets Library

**Effort:** Medium  
**Files:** New panel or QuickCommands enhancement

- Pre-built collection of useful ADB snippets organized by category
- Curated by difficulty level (beginner, intermediate, advanced)
- Searchable with descriptions

### 28. Device Profiles

**Effort:** Medium  
**Files:** New store module, Settings panel

- Save device-specific settings (preferred packages, filters, tabs)
- Auto-load profile when device connects
- Export/import profiles

_Generated from codebase analysis. Updated: 2026-09-02_
