# ADB GUI - Agent Instructions

This document provides comprehensive instructions for AI agents working on the ADB GUI project.

---

## 📋 Project Overview

**ADB GUI** is an Electron + React + TypeScript application that provides a graphical interface for managing Android devices via ADB (Android Debug Bridge). It automates common ADB commands for permissions, file transfers, process management, and quick command execution.

**Key Technologies:**

- **Framework:** Electron + Vite (Main: Node.js, Renderer: React)
- **Package Manager:** Bun (v1.3.0+)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (Dark mode default, terminal aesthetic)
- **ADB Integration:** Node.js `child_process` via `execAsync` in Main process
- **Storage:** localStorage (for Quick Commands persistence)
- **IPC:** Context-isolated preload script with `ipcRenderer.invoke`

---

## 🛠️ Useful Commands

### Development

```bash
# Start development server (renderer only)
bun run start:dev

# Start full Electron app with Vite dev server
bun run dev

# Format code with Prettier
bun run format

# Run ESLint
bun run lint

# Run ESLint with auto-fix
bun run lint:fix

# Type-check TypeScript (no emit)
bun run typecheck

# Full pre-build validation (format + typecheck + lint:fix)
bun run prebuild
```

### Building

```bash
# Build for production (renderer + Electron main + package)
bun run build

# Preview production build (renderer only)
bun run preview

# Start production Electron app
bun run start
```

### Testing

No test framework configured yet. Consider adding Vitest or Playwright.

---

## 🏗️ Architecture

### Project Structure

```
adb-gui/
├── electron/                 # Electron Main Process
│   ├── main.ts              # App entry, window creation, IPC handlers
│   ├── preload.ts           # Context bridge for secure IPC
│   ├── adbService.ts        # ADB wrapper class (main process)
│   └── electron-env.d.ts    # Type declarations
├── src/                      # React Renderer Process
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Main app with navigation
│   ├── index.css            # Global styles (Tailwind + dark mode)
│   ├── adbService.ts        # Renderer-side ADB service (IPC proxy)
│   ├── electronStore.ts     # localStorage wrapper for Quick Commands
│   ├── components/          # React components
│   │   ├── TopBar.tsx       # Device selector, refresh
│   │   ├── ProcessManager.tsx
│   │   ├── PermissionManager.tsx
│   │   ├── FileExplorer.tsx
│   │   └── QuickCommands.tsx
│   └── vite-env.d.ts        # Vite type declarations
├── public/                   # Static assets
├── dist/                     # Built renderer output
├── dist-electron/            # Built Electron main output
├── release/                  # electron-builder output
├── package.json
├── tsconfig.json             # Renderer TS config
├── tsconfig.node.json        # Node/Electron TS config
├── vite.config.ts            # Vite + electron-vite config
├── Plan.md                   # Development plan
└── README.md
```

### IPC Communication Flow

```
Renderer (React)          Preload                    Main (Electron)
     │                      │                           │
     ├─ window.adb.execute ─► ipcRenderer.invoke ─────► │
     │                      │                           ├─ adb.execute()
     │                      │◄── Promise resolves ───────┤
     │◄─────────────────────┤                           │
```

**IPC Channels (defined in `electron/main.ts`):**

- `adb:execute` - Execute arbitrary ADB command
- `adb:list-devices` - Get connected device serials
- `adb:is-device-connected` - Check if device is connected
- `adb:get-info` - Get ADB version and path info
- `adb:execute-device` - Execute command on specific device (`-s <serial>`)

---

## 🧩 Core Modules

### 1. ADB Service (`electron/adbService.ts`)

Main process class wrapping `child_process.exec` with promises.

```typescript
class AdbService {
  constructor(options: { deviceId?: string }); // Target specific device

  execute(cmd: string, timeout?: number): Promise<AdbResult>;
  getConnectedDevices(): Promise<string[]>;
  isDeviceConnected(deviceId: string): Promise<boolean>;
  getADBInfo(): Promise<{ version; path; features }>;
  listPackages(): Promise<string[]>;
  listThirdPartyPackages(): Promise<string[]>;
  grantPermissions(packageName: string): Promise<AdbResult>;
  listPermissions(packageName: string): Promise<string[]>;
  listProcesses(): Promise<ProcessInfo[]>;
  forceStop(packageName: string): Promise<AdbResult>;
  pull(remotePath, localPath): Promise<AdbResult>;
  push(localPath, remotePath): Promise<AdbResult>;
  listDirectory(remotePath): Promise<AdbResult>;
  getShellCurrentDir(): Promise<AdbResult>;
  getHostCurrentDir(): Promise<AdbResult>;
  executeBatch(commands: Array<{ cmd; label }>): Promise<{ success; results }>;
}
```

**AdbResult Interface:**

```typescript
interface AdbResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

### 2. Renderer ADB Service (`src/adbService.ts`)

Thin wrapper around `window.adb` (exposed via preload). Provides typed async functions matching Main process API.

### 3. Electron Store (`src/electronStore.ts`)

localStorage wrapper for Quick Commands persistence.

```typescript
interface QuickCommand {
  id: string;
  title: string;
  command: string;
  description: string;
  icon: string;
}

quickCommandsStore = {
  getAll(): QuickCommand[],
  add(command): QuickCommand[],
  remove(id): QuickCommand[],
  update(command): QuickCommand[],
  reset(): QuickCommand[],
}
```

---

## 🎨 UI Components

### Navigation (App.tsx)

5 Sections (tabs):

1. **Dashboard** - Grid of all 4 modules
2. **Process Manager** - List/kill processes
3. **Permissions** - Grant permissions to packages
4. **File Explorer** - Pull files from device
5. **Quick Commands** - Execute saved command macros

### Component Details

| Component             | Key Features                                                           |
| --------------------- | ---------------------------------------------------------------------- |
| **TopBar**            | Device list, refresh, device selector                                  |
| **ProcessManager**    | Search, list processes (`ps -A`), kill via `am force-stop`             |
| **PermissionManager** | List 3rd-party packages (`pm list packages -3`), grant all permissions |
| **FileExplorer**      | Browse remote dir (`ls -l`), pull files (`adb pull`)                   |
| **QuickCommands**     | Execute saved macros, reset to defaults                                |

---

## 🎯 Best Practices & Guidelines

### Code Style

1. **TypeScript Strict Mode** - Enabled in `tsconfig.json`. No `any`, explicit types.
2. **No Unused Code** - `noUnusedLocals`, `noUnusedParameters` enforced.
3. **ESM Only** - `"type": "module"` in package.json.
4. **React Functional Components** - Use hooks, no class components.
5. **Tailwind CSS** - Utility-first, dark mode default (`bg-gray-950`, `text-gray-100`).

### Security

1. **Context Isolation** - Enabled in `BrowserWindow` (`contextIsolation: true`).
2. **No Node Integration** - `nodeIntegration: false` in renderer.
3. **Preload Script** - Only expose safe, typed APIs via `contextBridge`.
4. **Command Sanitization** - Main process escapes shell metacharacters: `[&|<>$`]`.

### ADB Command Guidelines

1. **Timeouts** - Set appropriate timeouts:
   - Default: 10s
   - Pull/Push: 60s
   - Permissions: 30s
   - Directory listing: 30s

2. **Device Targeting** - Use `AdbService` constructor with `deviceId` for multi-device support.

3. **Error Handling** - Always return `AdbResult` with `exitCode`, never throw on command failure.

### Git Workflow

```bash
# Commit message format (conventional commits)
type(scope): description

# Examples
feat(process): add process search filter
fix(adb): handle timeout in pull command
chore(deps): update electron to v43
```

### File Organization

- **One component per file** - Named export default
- **Co-located types** - Define interfaces in same file
- **Barrel exports** - Not used; import directly from file path
- **Path aliases** - Not configured; use relative imports

---

## 🔧 Development Workflow

### Adding a New ADB Command

1. **Main Process** - Add method to `AdbService` class in `electron/adbService.ts`
2. **IPC Handler** - Add `ipcMain.handle` in `electron/main.ts`
3. **Preload** - Expose typed function in `electron/preload.ts`
4. **Renderer Service** - Add wrapper in `src/adbService.ts`
5. **UI Component** - Create or update React component

### Adding a New Quick Command

Edit `src/electronStore.ts` `DEFAULT_COMMANDS` array:

```typescript
{
  id: "unique-id",
  title: "Display Name",
  command: "adb command with <placeholders>",
  description: "What it does",
  icon: "🎯",
}
```

### Styling Guidelines

- **Colors**: Use Tailwind gray scale (`gray-950`, `gray-900`, `gray-800`, `gray-700`)
- **Accents**: Semantic colors (`blue`, `green`, `red`, `yellow`) with `/30` opacity for backgrounds
- **Typography**: `font-mono` for code/terminal output, `text-sm`/`text-xs` for dense UI
- **Spacing**: `p-4`, `gap-2`, `mb-3` consistent spacing
- **Transitions**: `transition-colors` on interactive elements

---

## 🐛 Debugging

### Renderer DevTools

- Open with `Ctrl+Shift+I` (or `Cmd+Opt+I` on Mac) in development

### Main Process Logs

- Console output appears in terminal running `bun run dev`

### Common Issues

| Issue             | Solution                                                     |
| ----------------- | ------------------------------------------------------------ |
| ADB not found     | Ensure ADB in PATH, or set `ANDROID_HOME/platform-tools`     |
| Device not listed | Run `adb devices` manually, check USB debugging              |
| Permission denied | Some commands need root (`adb root`) or specific permissions |
| IPC timeout       | Increase timeout in `AdbService.execute()` call              |

---

## 📦 Dependencies

### Production

- `react`, `react-dom` v18.3

### Development

- `electron` v43.3
- `electron-builder` v26.15
- `vite` v8.2 + `@vitejs/plugin-react` v6.0
- `vite-plugin-electron` v1.1 (simple mode)
- `tailwindcss` v4.3 + `@tailwindcss/vite`
- `typescript` v5.3 + `typescript-eslint` v8.66
- `eslint` v10.8 + React plugins
- `prettier` v3.4

### Node.js Requirement

- **Node.js >= 20.0.0** (specified in `package.json` engines)

---

## 🚀 Release Process

```bash
# 1. Run pre-build checks
bun run prebuild

# 2. Build production package
bun run build

# 3. Output in release/ directory
# - .exe installer
# - win-unpacked/ portable folder
```

**electron-builder Config** - Uses defaults (no custom config file). Outputs to `release/` (gitignored).

---

## 📝 Plan Reference

See `Plan.md` for the original development plan with milestones:

1. Initialization & IPC Setup
2. Core ADB Service
3. Process Manager Module
4. Permission Manager Module
5. File Explorer Module
6. Quick Commands Module

---

## 🔮 Future Improvements

- [ ] Add unit/integration tests (Vitest + Playwright)
- [ ] Implement file push functionality in UI
- [ ] Add device-specific command targeting in all modules
- [ ] Implement logcat viewer
- [ ] Add screenshot/screenrecord buttons
- [ ] Settings panel (ADB path, default device, theme)
- [ ] Keyboard shortcuts for common actions
- [ ] Export/import Quick Commands JSON
- [ ] Batch command execution UI

---

_Generated from project analysis. Update this file when architecture or conventions change._
