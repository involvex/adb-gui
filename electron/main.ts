import { app, BrowserWindow, ipcMain } from "electron";
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

ipcMain.handle("adb:execute", async (_event, cmd: string) => {
  return adb.execute(cmd);
});

ipcMain.handle("adb:list-devices", async () => {
  return adb.getConnectedDevices();
});

ipcMain.handle("adb:is-device-connected", async (_event, deviceId: string) => {
  return adb.isDeviceConnected(deviceId);
});

ipcMain.handle("adb:get-info", async () => {
  return adb.getADBInfo();
});

ipcMain.handle(
  "adb:execute-device",
  async (_event, { cmd, deviceId }: { cmd: string; deviceId?: string }) => {
    if (deviceId) {
      const deviceAdb = new AdbService({ deviceId });
      return deviceAdb.execute(cmd);
    }
    return adb.execute(cmd);
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
