**Kurzfassung:**
Dies ist der detaillierte Entwicklungsplan für eine Electron-Vite basierte ADB-GUI-App. Sie automatisiert ADB-Befehle (Permissions, File Pulls, Process Management) über den `bun` Paketmanager und erzwingt standardmäßig ein Dark-Mode-UI. Ein Agent-Prompt für den direkten Entwicklungsstart ist beigefügt.

---

### Architektur & Tech-Stack

- **Framework:** `electron-vite` (Main: Node.js, Renderer: React/Vue nach Wahl, Preload für IPC).
- **Paketmanager:** `bun`.
- **Sprache:** TypeScript.
- **Styling:** Tailwind CSS (Fokus auf Dark Mode / Terminal-Ästhetik).
- **ADB-Integration:** Node.js `child_process` (asynchron via `exec` / `spawn`) oder `@devicefarmer/adbkit` für stabilere Verbindungsverwaltung.
- **Storage:** `electron-store` (für die Speicherung der Quick Commands als JSON).

### Entwicklungsplan (Meilensteine)

**1. Initialisierung & IPC-Setup**

- Scaffolding via `bun create electron-vite adb-gui`.
- Installation von Tailwind CSS. Dark Mode in `tailwind.config.js` aktivieren und als Standard im CSS setzen (`@apply bg-gray-900 text-gray-100`).
- Definition der IPC-Kanäle im Preload-Skript (z.B. `invoke('adb-command', commandString)`).

**2. Core ADB-Service (Main Process)**

- Implementierung einer Wrapper-Klasse in Electron-Main.
- `exec` / `spawn` in Promises kapseln.
- Erste Funktionen: `getConnectedDevices()`, `runAdbCommand(cmd, deviceId)`.

**3. Modul: Process Manager**

- **Listen:** Command `adb shell ps -A -o USER,PID,NAME` ausführen, Output parsen und als JSON-Array an Renderer senden.
- **Kill:** UI-Button sendet `adb shell kill <pid>` oder `adb shell am force-stop <package.name>`.

**4. Modul: Permission Manager**

- **Packages listen:** `adb shell pm list packages -3` (nur Third-Party, für bessere Übersicht).
- **Permissions:** UI zum Auswählen des Packages. Button triggert `adb shell pm grant <package> <permission.string>`.
- _Tipp:_ `--user 0 --all-permissions` als Quick-Action-Button hinterlegen.

**5. Modul: File Explorer (Pull/Push)**

- Einfacher Tree-View für `storage/sdcard0/`.
- **Navigation:** Output von `adb shell ls -l` parsen.
- **Pull/Push:** Electron `dialog.showOpenDialog` oder `showSaveDialog` nutzen. Befehl: `adb pull <remote_path> <local_path>`.

**6. Modul: Quick Commands**

- JSON-Struktur definieren (z.B. `{ id, title, command_string }`).
- Speicherung über `electron-store`.
- Renderer generiert dynamisch Buttons für jedes Makro im UI.

---
