# ADB GUI

A graphical interface for managing Android devices via ADB (Android Debug Bridge). Built with Electron + React + TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-43.3-blue.svg)
![React](https://img.shields.io/badge/react-18.3-61dafb.svg)

## Features

### Core Modules

| Module                 | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Process Manager**    | List, search, and kill device processes. Sort by PID or name.                       |
| **Permission Manager** | Browse third-party apps, view activities, grant all permissions, launch activities. |
| **File Explorer**      | Navigate device filesystem, browse directories, pull files to host.                 |
| **Quick Commands**     | Execute predefined ADB commands with one click.                                     |
| **Logcat Viewer**      | Real-time streaming log capture with filters, color coding, and click-to-copy.      |
| **Command Bar**        | Direct ADB command execution with history (persists across sessions).               |

### Additional Features

- **Device Management** - Auto-detect connected devices, switch between multiple devices
- **APK Installation** - Install APKs directly from file picker
- **Keyboard Shortcuts** - `Ctrl+K` to focus Command Bar
- **Dark Mode** - Terminal-inspired dark theme by default

## Tech Stack

- **Framework:** Electron 43 + Vite 8
- **Frontend:** React 18 + TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Package Manager:** Bun (v1.3.0+)
- **Build:** electron-builder

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.0.0
- [Bun](https://bun.sh/) >= 1.3.0
- [ADB](https://developer.android.com/tools/adb) in PATH or ANDROID_HOME/platform-tools

### Installation

```bash
# Clone the repository
git clone https://github.com/involvex/adb-gui.git
cd adb-gui

# Install dependencies
bun install

# Start development server
bun run dev
```

### Development Commands

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `bun run dev`       | Start full Electron app with Vite dev server |
| `bun run start:dev` | Start renderer only (Vite)                   |
| `bun run build`     | Build for production                         |
| `bun run format`    | Format code with Prettier                    |
| `bun run lint`      | Run ESLint                                   |
| `bun run lint:fix`  | Run ESLint with auto-fix                     |
| `bun run typecheck` | Type-check TypeScript                        |
| `bun run prebuild`  | Full pre-build validation                    |

## Project Structure

```
adb-gui/
├── electron/                 # Electron Main Process
│   ├── main.ts              # App entry, window creation, IPC handlers
│   ├── preload.ts           # Context bridge for secure IPC
│   └── adbService.ts        # ADB wrapper class
├── src/                      # React Renderer Process
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Main app with navigation
│   ├── adbService.ts        # Renderer-side ADB service (IPC proxy)
│   ├── electronStore.ts     # localStorage wrapper
│   └── components/          # React components
│       ├── TopBar.tsx       # Device selector, APK install
│       ├── ProcessManager.tsx
│       ├── PermissionManager.tsx
│       ├── FileExplorer.tsx
│       ├── LogcatViewer.tsx
│       ├── QuickCommands.tsx
│       └── CommandBar.tsx   # Quick terminal bar
├── package.json
├── tsconfig.json
├── vite.config.ts
└── suggestions.md           # Feature roadmap
```

## Architecture

### IPC Communication

```
Renderer (React)  →  Preload (contextBridge)  →  Main (Electron)
     ↓                      ↓                         ↓
  adbService.ts        ipcRenderer.invoke        ipcMain.handle
                            ↓                         ↓
                       window.adb                 AdbService
```

### Security

- Context isolation enabled
- Node integration disabled in renderer
- All ADB commands executed in main process
- Shell metacharacters escaped in commands

## Usage

1. Connect an Android device via USB with debugging enabled
2. Launch the app with `bun run dev`
3. Select your device from the top bar
4. Use the navigation tabs to access different modules

### Keyboard Shortcuts

| Shortcut           | Action            |
| ------------------ | ----------------- |
| `Ctrl+K` / `Cmd+K` | Focus Command Bar |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

## Roadmap

See [suggestions.md](suggestions.md) for the full feature roadmap and ideas.

### Completed

- [x] Device management and selection
- [x] Process Manager with search and kill
- [x] Permission Manager with activity launching
- [x] File Explorer with navigation and pull
- [x] Quick Commands with persistence
- [x] Logcat Viewer with streaming and filters
- [x] Command Bar with history
- [x] APK Installation
- [x] Copy logcat lines on click
- [x] Open folder after file pull
- [x] Persist command history

### Planned

- [ ] File Push Support
- [ ] Device Info Panel
- [ ] Settings Panel
- [ ] WiFi ADB Connection
- [ ] Screenshot/Screenrecord
- [ ] Testing infrastructure (Vitest + Playwright)

## License

MIT

## Author

involvex
