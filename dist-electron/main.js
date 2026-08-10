import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import { fileURLToPath as r } from "node:url";
import i from "node:path";
import { exec as a } from "node:child_process";
import { promisify as o } from "node:util";
//#region electron/adbService.ts
var s = o(a), c = class {
	deviceId;
	constructor(e = {}) {
		this.deviceId = e.deviceId ?? null;
	}
	resolveCommand(e) {
		return this.deviceId ? `adb -s ${this.deviceId} ${e}` : e;
	}
	async execute(e, t = 1e4) {
		let n = this.resolveCommand(e).replace(/[&|<>$`]/g, "\\$&");
		try {
			let { stdout: e, stderr: r } = await s(n, { timeout: t });
			return {
				stdout: e,
				stderr: r,
				exitCode: 0
			};
		} catch (e) {
			let t = e;
			return {
				stdout: t.stdout || "",
				stderr: t.stderr || t.message,
				exitCode: t.code ? Number(t.code) : 1
			};
		}
	}
	async getConnectedDevices() {
		return (await this.execute("devices")).stdout.split("\n").filter((e) => !e.startsWith("List") && !e.startsWith("*") && e.trim()).map((e) => e.split("	")[0]);
	}
	async isDeviceConnected(e) {
		return (await this.execute(`device ${e}`)).exitCode === 0;
	}
	async getADBInfo() {
		let e = (await this.execute("version")).stdout.split("\n");
		return {
			version: e[0]?.trim() || "unknown",
			path: e[1]?.trim() || "unknown",
			features: e.slice(2).filter(Boolean)
		};
	}
	async listPackages() {
		return (await this.execute("pm list packages")).stdout.split("\n").filter((e) => e.includes("package:")).map((e) => e.replace("package:", "").trim());
	}
	async listThirdPartyPackages() {
		return (await this.execute("pm list packages -3")).stdout.split("\n").filter((e) => e.includes("package:")).map((e) => e.replace("package:", "").trim());
	}
	async grantPermissions(e) {
		return this.execute(`pm grant ${e} --user 0 --all-permissions`, 3e4);
	}
	async listPermissions(e) {
		return (await this.execute(`pm list permissions ${e}`)).stdout.split("\n").filter((e) => e.includes("name:")).map((e) => e.replace("name:", "").trim());
	}
	async listProcesses() {
		let e = await this.execute("shell ps -A -o USER,PID,NAME"), t = [], n = e.stdout.trim().split("\n");
		for (let e of n) {
			let n = e.split(/\s+/);
			n.length >= 3 && n[0] !== "USER" && t.push({
				user: n[0],
				pid: parseInt(n[1], 10),
				name: n.slice(2).join(" ")
			});
		}
		return t;
	}
	async forceStop(e) {
		return this.execute(`shell am force-stop ${e}`, 1e4);
	}
	async pull(e, t) {
		return this.execute(`pull ${e} ${t}`, 6e4);
	}
	async push(e, t) {
		return this.execute(`push ${e} ${t}`, 6e4);
	}
	async listDirectory(e) {
		return this.execute(`shell ls -l ${e}`, 3e4);
	}
	async getShellCurrentDir() {
		return this.execute("shell pwd", 1e4);
	}
	async getHostCurrentDir() {
		return this.execute("pwd", 1e4);
	}
	async executeBatch(e) {
		let t = [];
		for (let n of e) {
			let e = await this.execute(n.cmd);
			t.push(e);
		}
		return {
			success: !0,
			results: t
		};
	}
};
new c();
//#endregion
//#region electron/main.ts
var l = i.dirname(r(import.meta.url)), u = new c();
process.env.APP_ROOT = i.join(l, "..");
var d = process.env.VITE_DEV_SERVER_URL, f = i.join(process.env.APP_ROOT, "dist-electron"), p = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = d ? i.join(process.env.APP_ROOT, "public") : p;
var m = null;
function h() {
	m = new e({
		width: 1280,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: "#030712",
		webPreferences: {
			preload: i.join(l, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), d ? m.loadURL(d) : m.loadFile(i.join(p, "index.html"));
}
n.handle("adb:execute", async (e, t) => u.execute(t)), n.handle("adb:list-devices", async () => u.getConnectedDevices()), n.handle("adb:is-device-connected", async (e, t) => u.isDeviceConnected(t)), n.handle("adb:get-info", async () => u.getADBInfo()), n.handle("adb:execute-device", async (e, { cmd: t, deviceId: n }) => n ? new c({ deviceId: n }).execute(t) : u.execute(t)), t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), m = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && h();
}), t.whenReady().then(h);
//#endregion
export { f as MAIN_DIST, p as RENDERER_DIST, d as VITE_DEV_SERVER_URL };
