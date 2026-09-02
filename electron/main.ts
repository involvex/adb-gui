import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { AdbService, type AdbResult } from "./adbService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adb = new AdbService();

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let logcatProcess: ChildProcess | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, "icon.svg"),
    backgroundColor: "#030712",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

ipcMain.handle(
  "adb:execute",
  async (_event, { cmd, deviceId }: { cmd: string; deviceId?: string }) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    return svc.execute(cmd);
  },
);

ipcMain.handle("adb:list-devices", async () => {
  return adb.getConnectedDevices();
});

ipcMain.handle(
  "adb:list-file-entries",
  async (
    _event,
    { remotePath, deviceId }: { remotePath: string; deviceId?: string },
  ) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const result = await svc.listDirectory(remotePath);
    if (result.exitCode !== 0) {
      return {
        error: result.stderr || "Failed to list directory",
        entries: [],
      };
    }
    const entries = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("total "))
      .map((line) => {
        const parts = line.split(/\s+/);
        if (parts.length < 6) return null;
        const perms = parts[0];
        const owner = parts[1];
        const group = parts[2];
        const size = parts[3];
        const date = `${parts[4]} ${parts[5]} ${parts[6] || ""}`;
        const name = parts.slice(7).join(" ");
        const isDirectory = perms.startsWith("d");
        const isSymlink = perms.startsWith("l");
        return {
          name,
          isDirectory,
          isSymlink,
          size,
          perms,
          owner,
          group,
          date,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    return { error: null, entries };
  },
);

ipcMain.handle(
  "adb:pull-file",
  async (
    _event,
    { remotePath, deviceId }: { remotePath: string; deviceId?: string },
  ) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const defaultName = path.basename(remotePath);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save pulled file",
      defaultPath: defaultName,
    });
    if (canceled || !filePath) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const result = await svc.pull(remotePath, filePath);
    return { ...result, localPath: filePath };
  },
);

ipcMain.handle(
  "adb:push-file",
  async (
    _event,
    { remotePath, deviceId }: { remotePath: string; deviceId?: string },
  ) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: "Select file(s) to push",
      properties: ["openFile", "multiSelections"],
    });
    if (canceled || filePaths.length === 0) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const results: { file: string; result: AdbResult }[] = [];
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const destPath = remotePath.endsWith("/")
        ? remotePath + fileName
        : remotePath + "/" + fileName;
      const result = await svc.push(filePath, destPath);
      results.push({ file: filePath, result });
    }
    const allSuccess = results.every((r) => r.result.exitCode === 0);
    return {
      success: allSuccess,
      results,
      pushedFiles: results.map((r) => path.basename(r.file)),
    };
  },
);

ipcMain.handle(
  "adb:logcat-start",
  async (
    event,
    {
      priority,
      buffer,
      tags,
      pid: filterPid,
      deviceId,
    }: {
      priority?: string;
      buffer?: string;
      tags?: string;
      pid?: string;
      deviceId?: string;
    },
  ) => {
    if (logcatProcess) {
      logcatProcess.kill();
      logcatProcess = null;
    }

    const args: string[] = [];
    if (deviceId) {
      args.push("-s", deviceId);
    }
    args.push("logcat", "-v", "threadtime");

    if (buffer && buffer !== "all") {
      args.push("-b", buffer);
    }
    if (filterPid) {
      args.push("--pid", filterPid);
    }

    if (tags) {
      args.push(...tags.split(/\s+/).filter(Boolean));
    } else {
      args.push(`*:${priority || "I"}`);
    }

    const child = spawn("adb", args, { stdio: ["ignore", "pipe", "pipe"] });
    logcatProcess = child;

    let buf = "";
    child.stdout.on("data", (data: Buffer) => {
      buf += data.toString();
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          event.sender.send("adb:logcat-line", line);
        }
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      event.sender.send(
        "adb:logcat-line",
        `[stderr] ${data.toString().trim()}`,
      );
    });

    child.on("close", () => {
      if (logcatProcess === child) {
        logcatProcess = null;
      }
    });

    child.on("error", (err) => {
      event.sender.send("adb:logcat-line", `[error] ${err.message}`);
      if (logcatProcess === child) {
        logcatProcess = null;
      }
    });

    return { success: true };
  },
);

ipcMain.handle("adb:logcat-stop", async () => {
  if (logcatProcess) {
    logcatProcess.kill();
    logcatProcess = null;
  }
  return { success: true };
});

ipcMain.handle(
  "adb:open-folder",
  async (_event, { folderPath }: { folderPath: string }) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to open folder",
      };
    }
  },
);

ipcMain.handle(
  "adb:device-info",
  async (_event, { deviceId }: { deviceId?: string }) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const [deviceInfo, screenInfo, batteryInfo, storageInfo, networkInfo] =
      await Promise.all([
        svc.getDeviceInfo(),
        svc.getScreenInfo(),
        svc.getBatteryInfo(),
        svc.getStorageInfo(),
        svc.getNetworkInfo(),
      ]);
    return {
      device: deviceInfo,
      screen: screenInfo,
      battery: batteryInfo,
      storage: storageInfo,
      network: networkInfo,
    };
  },
);

ipcMain.handle(
  "adb:screenshot",
  async (_event, { deviceId }: { deviceId?: string }) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save Screenshot",
      defaultPath: `screenshot_${Date.now()}.png`,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (canceled || !filePath) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const result = await svc.screenshot(filePath);
    return { ...result, localPath: filePath };
  },
);

ipcMain.handle(
  "adb:screenrecord",
  async (
    _event,
    { timeLimit, deviceId }: { timeLimit?: number; deviceId?: string },
  ) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save Screen Recording",
      defaultPath: `recording_${Date.now()}.mp4`,
      filters: [{ name: "MP4", extensions: ["mp4"] }],
    });
    if (canceled || !filePath) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const result = await svc.screenrecord(filePath, timeLimit || 10);
    return { ...result, localPath: filePath };
  },
);

ipcMain.handle(
  "adb:install-apk",
  async (_event, { deviceId }: { deviceId?: string }) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: "Select APK(s) to install",
      filters: [{ name: "APK files", extensions: ["apk"] }],
      properties: ["openFile", "multiSelections"],
    });
    if (canceled || filePaths.length === 0) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const results: { file: string; result: AdbResult }[] = [];
    for (const apkPath of filePaths) {
      const result = await svc.execute(`install -r "${apkPath}"`, 120000);
      results.push({ file: apkPath, result });
    }
    const allSuccess = results.every((r) => r.result.exitCode === 0);
    return {
      success: allSuccess,
      results: results.map((r) => ({
        file: r.file,
        exitCode: r.result.exitCode,
        stderr: r.result.stderr,
      })),
      installedFiles: results
        .filter((r) => r.result.exitCode === 0)
        .map((r) => r.file),
      failedFiles: results
        .filter((r) => r.result.exitCode !== 0)
        .map((r) => ({ file: r.file, error: r.result.stderr })),
    };
  },
);

ipcMain.handle(
  "adb:backup-apps",
  async (
    _event,
    { packages, deviceId }: { packages: string[]; deviceId?: string },
  ) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save Backup File",
      defaultPath: `adb_backup_${Date.now()}.ab`,
      filters: [{ name: "Android Backup", extensions: ["ab"] }],
    });
    if (canceled || !filePath) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const pkgArgs = packages.map((p) => `"${p}"`).join(" ");
    const result = await svc.execute(
      `backup -f "${filePath}" -noapk ${pkgArgs}`,
      120000,
    );
    return { ...result, localPath: filePath };
  },
);

ipcMain.handle(
  "adb:get-app-info",
  async (
    _event,
    { packageName, deviceId }: { packageName: string; deviceId?: string },
  ) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    return svc.getAppInfo(packageName);
  },
);

ipcMain.handle(
  "adb:clear-app-data",
  async (
    _event,
    { packageName, deviceId }: { packageName: string; deviceId?: string },
  ) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    return svc.clearAppData(packageName);
  },
);

ipcMain.handle(
  "adb:uninstall-app",
  async (
    _event,
    { packageName, deviceId }: { packageName: string; deviceId?: string },
  ) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    return svc.uninstallApp(packageName);
  },
);

ipcMain.handle(
  "adb:toggle-app",
  async (
    _event,
    {
      packageName,
      enable,
      deviceId,
    }: { packageName: string; enable: boolean; deviceId?: string },
  ) => {
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    return svc.toggleApp(packageName, enable);
  },
);

ipcMain.handle(
  "adb:export-apk",
  async (
    _event,
    { packageName, deviceId }: { packageName: string; deviceId?: string },
  ) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save APK",
      defaultPath: `${packageName}.apk`,
      filters: [{ name: "APK", extensions: ["apk"] }],
    });
    if (canceled || !filePath) {
      return { error: "cancelled", exitCode: 1 };
    }
    const svc = deviceId ? new AdbService({ deviceId }) : adb;
    const result = await svc.exportApk(packageName, filePath);
    return { ...result, localPath: filePath };
  },
);

ipcMain.handle(
  "adb:export-logcat",
  async (_event, { lines }: { lines: string }) => {
    if (!win) return { error: "No window", exitCode: 1 };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Export Logcat",
      defaultPath: `logcat_${Date.now()}.txt`,
      filters: [{ name: "Text", extensions: ["txt", "log"] }],
    });
    if (canceled || !filePath) {
      return { error: "cancelled", exitCode: 1 };
    }
    const fs = await import("node:fs/promises");
    await fs.writeFile(filePath, lines, "utf-8");
    return { success: true, localPath: filePath };
  },
);

ipcMain.handle(
  "adb:pair",
  async (_event, target: string, pairingCode: string) => {
    return adb.pair(target, pairingCode);
  },
);

app.on("window-all-closed", () => {
  if (logcatProcess) {
    logcatProcess.kill();
    logcatProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
