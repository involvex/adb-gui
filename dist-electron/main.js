import { BrowserWindow, app, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
//#region electron/adbService.ts
var execAsync = promisify(exec);
var AdbService = class {
	deviceId;
	constructor(options = {}) {
		this.deviceId = options.deviceId ?? null;
	}
	resolveCommand(cmd) {
		if (this.deviceId) return `adb -s ${this.deviceId} ${cmd}`;
		return `adb ${cmd}`;
	}
	async execute(cmd, timeout = 1e4) {
		const safeCmd = this.resolveCommand(cmd).replace(/[&|<>$`]/g, "\\$&");
		try {
			const { stdout, stderr } = await execAsync(safeCmd, { timeout });
			return {
				stdout,
				stderr,
				exitCode: 0
			};
		} catch (error) {
			const e = error;
			return {
				stdout: e.stdout || "",
				stderr: e.stderr || e.message,
				exitCode: e.code ? Number(e.code) : 1
			};
		}
	}
	async getConnectedDevices() {
		return (await this.execute("devices")).stdout.split("\n").filter((line) => !line.startsWith("List") && !line.startsWith("*") && line.trim()).map((line) => line.split("	")[0]);
	}
	async isDeviceConnected(deviceId) {
		return (await this.execute(`device ${deviceId}`)).exitCode === 0;
	}
	async getADBInfo() {
		const lines = (await this.execute("version")).stdout.split("\n");
		return {
			version: lines[0]?.trim() || "unknown",
			path: lines[1]?.trim() || "unknown",
			features: lines.slice(2).filter(Boolean)
		};
	}
	async listPackages() {
		return (await this.execute("pm list packages")).stdout.split("\n").filter((line) => line.includes("package:")).map((line) => line.replace("package:", "").trim());
	}
	async listThirdPartyPackages() {
		return (await this.execute("pm list packages -3")).stdout.split("\n").filter((line) => line.includes("package:")).map((line) => line.replace("package:", "").trim());
	}
	async grantPermissions(packageName) {
		return this.execute(`pm grant ${packageName} --user 0 --all-permissions`, 3e4);
	}
	async listPermissions(packageName) {
		return (await this.execute(`pm list permissions ${packageName}`)).stdout.split("\n").filter((line) => line.includes("name:")).map((line) => line.replace("name:", "").trim());
	}
	async listProcesses() {
		const result = await this.execute("shell ps -A -o USER,PID,NAME");
		const processes = [];
		const lines = result.stdout.trim().split("\n");
		for (const line of lines) {
			const parts = line.split(/\s+/);
			if (parts.length >= 3 && parts[0] !== "USER") processes.push({
				user: parts[0],
				pid: parseInt(parts[1], 10),
				name: parts.slice(2).join(" ")
			});
		}
		return processes;
	}
	async forceStop(packageName) {
		return this.execute(`shell am force-stop ${packageName}`, 1e4);
	}
	async pull(remotePath, localPath) {
		return this.execute(`pull ${remotePath} ${localPath}`, 6e4);
	}
	async push(localPath, remotePath) {
		return this.execute(`push ${localPath} ${remotePath}`, 6e4);
	}
	async listDirectory(remotePath) {
		return this.execute(`shell ls -l ${remotePath}`, 3e4);
	}
	async getShellCurrentDir() {
		return this.execute("shell pwd", 1e4);
	}
	async getHostCurrentDir() {
		return this.execute("pwd", 1e4);
	}
	async executeBatch(commands) {
		const results = [];
		for (const cmd of commands) {
			const result = await this.execute(cmd.cmd);
			results.push(result);
		}
		return {
			success: true,
			results
		};
	}
};
new AdbService();
//#endregion
//#region electron/main.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var adb = new AdbService();
process.env.APP_ROOT = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var win = null;
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
			nodeIntegration: false
		}
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(RENDERER_DIST, "index.html"));
}
ipcMain.handle("adb:execute", async (_event, { cmd, deviceId }) => {
	return (deviceId ? new AdbService({ deviceId }) : adb).execute(cmd);
});
ipcMain.handle("adb:list-devices", async () => {
	return adb.getConnectedDevices();
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(createWindow);
//#endregion
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
