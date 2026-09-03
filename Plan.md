**Kurzfassung:**
Dies ist der detaillierte Entwicklungsplan für eine Electron-Vite basierte ADB-GUI-App. Sie automatisiert ADB-Befehle für Permissions, File Transfers, Process Management, Logcat-Analyse und App-Backups über den `bun` Paketmanager und erzwingt standardmäßig ein Dark-Mode-UI. Ein Agent-Prompt für den direkten Entwicklungsstart ist beigefügt.

---

### Architektur & Tech-Stack

- **Framework:** `electron-vite` (Main: Node.js, Renderer: React/Vue nach Wahl, Preload für IPC).
- **Paketmanager:** `bun`.
- **Sprache:** TypeScript (strict mode).
- **Styling:** Tailwind CSS v4 (Dark Mode Standard / Terminal-Ästhetik).
- **ADB-Integration:** Node.js `child_process` (`execAsync`) via Main Process.
- **Storage:** `localStorage` (für Quick Commands und App-Einstellungen).
- **IPC:** Context-isolated Preload-Script mit `ipcRenderer.invoke`.

### Entwicklungsplan (Meilensteine)

**1. Initialisierung & IPC-Setup** ✅

- Scaffolding via `bun create electron-vite adb-gui`.
- Installation von Tailwind CSS v4. Dark Mode als Standard.
- IPC-Kanäle im Preload-Skript definiert (`invoke('adb-execute', ...)`, etc.)

**2. Core ADB-Service (Main Process)** ✅

- Wrapper-Klasse `AdbService` in `electron/adbService.ts`.
- `exec`/`execAsync` in Promises gekapselt.
- Funktionen: `getConnectedDevices()`, `execute()`, `executeDevice()`, `isDeviceConnected()`, `getInfo()`, `listPackages()`, `listThirdPartyPackages()`, `grantPermissions()`, `listPermissions()`, `listProcesses()`, `forceStop()`, `pull()`, `push()`, `listDirectory()`, `executeBatch()`.

**3. Modul: Process Manager** ✅

- **Listen:** `adb shell ps -A -o USER,PID,NAME` ausführen, Output parsen.
- **Search:** Client-seitiges Filtern nach Name/PID.
- **Kill:** UI-Button sendet `adb shell am force-stop <package>` oder `adb shell kill <pid>`.
- **Sortierung:** Nach PID oder Name, auf-/absteigend.

**4. Modul: Permission Manager** ✅

- **Packages listen:** `adb shell pm list packages -3`.
- **Permissions:** UI zum Auswählen des Packages, Button grantiert alle Berechtigungen (`--user 0 --all-permissions`).
- **Activities:** Liste der Activities pro Package.
- **Launch:** App direkt starten nach Berechtigungsgrant.
- **Badge:** Paketanzahl in Tab-Leiste.

**5. Modul: File Explorer (Pull/Push)** ✅

- Tree-View für `storage/sdcard0/` Navigation.
- **Navigation:** Output von `adb shell ls -l` parsen (Dateien, Ordner, Berechtigungen, Größe).
- **Pull:** `dialog.showSaveDialog` → `adb pull <remote_path> <local_path>`.
- **Push:** `dialog.showOpenDialog` → `adb push <local_path> <remote_path>`.
- **Open folder:** Nach Pull öffnet sich der Zielordner im Explorer.

**6. Modul: Quick Commands** ✅

- JSON-Struktur definiert (`{ id, title, command, description, icon }`).
- Speicherung über `localStorage` via `electronStore.ts`.
- Renderer generiert dynamisch Buttons für jedes Makro.
- Variable Platzhalter (z.B. `<package>`, `<text>`) werden per Prompt abgefragt.
- Import/Export als JSON.

**7. Modul: Logcat Viewer** ✅

- Streaming-Logcat (`adb logcat -c` + `adb logcat`).
- Filter: Buffer-Auswahl (main, system, radio, events), Level (Verbose bis Assert).
- Pause/Resume-Funktion.
- Color-Coding nach Level.
- Multi-Zeilen-Auswahl und Copy-to-Clipboard.
- Regex-Suche mit Debouncing.

**8. Modul: Command Bar (Terminal)** ✅

- Terminal-ähnliche Eingabemöglichkeit für ADB-Befehle.
- Verlauf (History) persistiert in `localStorage`.
- Fokus via `Ctrl+K` Tastenkürzel.
- Farbausgabe für stdout/stderr/exitCode.

**9. Modul: APK Installation** ✅

- Einfache APK-Installation via `adb install -r <apk_path>`.
- Mehrere APKs gleichzeitig auswählbar.

**10. Modul: Device Info Panel** ✅

- Gerätemodell, Hersteller, Android-Version, SDK-Level.
- Bildschirmauflösung und Dichte.
- Batteriestatus und -stand.
- Speichernutzung (intern/extern).
- Netzwerkinformationen (WiFi SSID, IP-Adresse).

**11. Modul: Device Actions** ✅

- Screenshot (`adb shell screencap -p`).
- Screenrecord (`adb shell screenrecord` mit Zeitbegrenzung).
- Reboot (normal, recovery, bootloader).
- Input-Befehle (Text, Tastendruck).

**12. Modul: Settings Panel** ✅

- ADB-Pfad-Konfiguration.
- Theme-Einstellungen (Dark Mode Standard).
- Quick Commands Import/Export (JSON).
- Window-Größe/Position Persistenz.

**13. Modul: WiFi ADB Connection** ✅

- `adb tcpip <port>` für WiFi-Debugging.
- `adb connect <ip>:<port>` Verbindungsaufbau.
- Auto-Erkundung via `adb mdns` (Android 11+).
- Verbindungshistorie für schnelles Wiederverbinden.

**14. Modul: App Settings Backup & Restore** ✅

- Export aller App-Daten (Quick Commands, Einstellungen, Befehlsverlauf) als JSON.
- Import/Restore mit Version-Prüfung und Deep-Validation.
- Selective Restore (einzelne Datenkategorien wiederherstellen).

**15. Modul: App Backup** ✅

- Neuer Navigation-Tab "Backup".
- Listen aller Third-Party-Packages mit App-Namen (via `pm dump`).
- Suchfunktion und Filterung.
- Multi-Select für ausgewählte Apps.
- Backup ausgewählter Apps mit Daten zu `.ab`-Datei via `adb backup -f <path> -noapk <packages>`.
- Gerätebestätigungsdialog erforderlich.

**16. Keyboard Shortcuts** ✅

- Globale Tastenkürzel für Navigation und Schnellzugriff.
- `Ctrl+K` für Command Bar Fokus.
- `Ctrl+1-7` für Tab-Wechsel.
- `Ctrl+Shift+L` für Logcat Start/Stop.

**17. Code Quality & Best Practices** ✅

- TypeScript Strict Mode aktiviert.
- ESLint + Prettier konfiguriert.
- Shell-Metzeichen-Escaping im Main Process (`[&|<>$`\]`).
- Timeout-Konfiguration pro Befehlstyp (10s Standard, 60s Pull/Push, 30s Permissions).
- Device-Targeting via `AdbService` Konstruktor mit `deviceId`.
- `AdbResult`-Interface (`{ stdout, stderr, exitCode }`) — keine Exceptions auf Befehlsfehler.

---

_Original-Plan basierend auf Anforderungen. Alle Meilensteine wurden umgesetzt und um zusätzliche Features (WiFi ADB, Backup, App Data Backup) erweitert. Siehe `suggestions.md` für weitere Ideen._
