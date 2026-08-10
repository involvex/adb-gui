import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { AdbService } from "./adbService";

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

app.on("window-all-closed", () => {
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
