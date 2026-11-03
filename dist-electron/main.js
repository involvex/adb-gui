import { BrowserWindow as e, Menu as t, Tray as n, app as r, dialog as i, globalShortcut as a, ipcMain as o, nativeImage as s, shell as c } from "electron";
import { exec as l, spawn as u } from "node:child_process";
import { fileURLToPath as d } from "node:url";
import f from "node:path";
import { existsSync as p } from "node:fs";
import { promisify as m } from "node:util";
//#region electron/adbService.ts
var h = m(l);
function g(e, t) {
	if (!e || typeof e != "string") throw Error(`Invalid ${t}`);
	if (!/^[a-zA-Z0-9_.$]+$/.test(e) || e.length > 255) throw Error(`Invalid ${t}: ${e}`);
	return e;
}
function _(e) {
	return g(e, "package name");
}
function v(e) {
	return g(e, "activity name");
}
function y(e) {
	return !e || typeof e != "string" ? !1 : /^[A-Za-z0-9 ._:()-]+$/.test(e) && e.trim().length > 0 && e.length <= 128;
}
function b(e) {
	if (!y(e)) throw Error(`Invalid device id: ${e}`);
	return e;
}
function x(e) {
	if (!e || typeof e != "string") throw Error("Invalid path");
	if (/[;&|$()<>"'`\n\r]/.test(e)) throw Error("Invalid path characters");
	return e;
}
function S(e) {
	if (typeof e != "string" || !e.trim()) throw Error("Invalid argument");
	if (/["`\n\r]/.test(e)) throw Error("Invalid characters in argument");
	return `"${e}"`;
}
function C(e) {
	let t = "", n = !1;
	for (let r of e) {
		if (r === "\"") {
			n = !n, t += r;
			continue;
		}
		if (!n && /[&<>$`()]/.test(r)) {
			t += `\\${r}`;
			continue;
		}
		t += r;
	}
	return t;
}
function w(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = !1, i = !1;
	for (let a of e.split("\n")) {
		if (/Resolver Table:/.test(a)) {
			r = a.includes("Activity Resolver Table"), i = !1;
			continue;
		}
		if (!r) continue;
		let e = a.match(/^\s+([a-zA-Z0-9_.]+:\s*$)/);
		if (e) {
			i = e[1].startsWith("android.intent.action.MAIN");
			continue;
		}
		let o = a.match(/^\s+[0-9a-fA-F]+\s+(\S+)\/(\S+)\s+filter\s+[0-9a-fA-F]+/);
		o && (i ? t.add(o[2]) : n.add(o[2]));
	}
	return [...t.size > 0 ? t : n].sort();
}
function T(e, t) {
	let n = t.trim();
	return n.startsWith(`${e}/`) ? n : n.startsWith(".") ? `${e}/${n}` : n.startsWith(`${e}.`) ? n : `${e}/${n}`;
}
function E(e, t = !1) {
	let n = String.raw`ActivityRecord\{[^}]*?\s(\S+)\/(\S+)\s+t\d+\}`, r = [
		new RegExp(String.raw`topResumedActivity=` + n),
		new RegExp(String.raw`mResumedActivity:?\s+` + n),
		new RegExp(String.raw`ResumedActivity:?\s+` + n)
	];
	t && r.push(/^\s*Activities:\s+\S+\s+(\S+)\/(\S+)/m);
	for (let t of r) {
		let n = e.match(t);
		if (n) return {
			package: n[1],
			activity: n[2]
		};
	}
	return null;
}
var D = class {
	deviceId;
	constructor(e = {}) {
		this.deviceId = e.deviceId ?? null;
	}
	resolveCommand(e) {
		return this.deviceId ? `adb -s ${S(b(this.deviceId))} ${e}` : `adb ${e}`;
	}
	async execute(e, t = 1e4) {
		let n = C(this.resolveCommand(e));
		try {
			let { stdout: e, stderr: r } = await h(n, {
				timeout: t,
				maxBuffer: 52428800
			});
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
		let t = b(e);
		return (await this.execute(`device ${t}`)).exitCode === 0;
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
		return (await this.execute("shell pm list packages")).stdout.split("\n").filter((e) => e.includes("package:")).map((e) => e.replace("package:", "").trim());
	}
	async listThirdPartyPackages() {
		return (await this.execute("shell pm list packages -3")).stdout.split("\n").filter((e) => e.includes("package:")).map((e) => e.replace("package:", "").trim());
	}
	async grantPermissions(e) {
		let t = _(e);
		return this.execute(`shell pm grant ${t} --user 0 --all-permissions`, 3e4);
	}
	async listPermissions(e) {
		let t = _(e);
		return (await this.execute(`shell pm list permissions ${t}`)).stdout.split("\n").filter((e) => e.includes("name:")).map((e) => e.replace("name:", "").trim());
	}
	async listActivities(e) {
		let t = _(e);
		return w((await this.execute(`shell dumpsys package ${t}`, 15e3)).stdout);
	}
	async getForegroundActivity() {
		let e = E((await this.execute("shell dumpsys activity activities", 15e3)).stdout);
		if (e) return e;
		let t = E((await this.execute("shell dumpsys activity top -n 1", 1e4)).stdout, !0);
		if (!t) throw Error("Unable to parse foreground activity");
		return t;
	}
	async getActivitiesForPackage(e) {
		return this.listActivities(e);
	}
	async launchActivity(e, t) {
		let n = T(_(e), v(t));
		return this.execute(`shell am start -n ${n}`, 1e4);
	}
	async listProcesses() {
		let e = await this.execute("shell ps -A -o USER,PID,%CPU,%MEM,RSS,NAME"), t = [], n = e.stdout.trim().split("\n");
		for (let e of n) {
			let n = e.split(/\s+/);
			if (n.length >= 6 && n[0] !== "USER") {
				let e = parseInt(n[4], 10), r = n[4] || "0";
				isNaN(e) || (r = e >= 1048576 ? (e / 1048576).toFixed(1) + " GB" : e >= 1024 ? (e / 1024).toFixed(1) + " MB" : e + " KB"), t.push({
					user: n[0],
					pid: parseInt(n[1], 10),
					cpu: parseFloat(n[2]) || 0,
					mem: parseFloat(n[3]) || 0,
					rss: r,
					name: n.slice(5).join(" ")
				});
			}
		}
		return t;
	}
	async forceStop(e) {
		let t = _(e);
		return this.execute(`shell am force-stop ${t}`, 1e4);
	}
	async pull(e, t) {
		let n = x(e), r = S(t);
		return this.execute(`pull ${n} ${r}`, 6e4);
	}
	async push(e, t) {
		let n = S(e), r = x(t);
		return this.execute(`push ${n} ${r}`, 6e4);
	}
	async listDirectory(e) {
		let t = x(e);
		return this.execute(`shell ls -l ${t}`, 3e4);
	}
	async getShellCurrentDir() {
		return this.execute("shell pwd", 1e4);
	}
	async getHostCurrentDir() {
		return this.execute("shell pwd", 1e4);
	}
	async getDeviceInfo() {
		let e = [
			"ro.product.model",
			"ro.product.manufacturer",
			"ro.build.version.release",
			"ro.build.version.sdk",
			"ro.build.display.id",
			"ro.serialno",
			"persist.sys.language",
			"persist.sys.country",
			"ro.product.cpu.abi",
			"ro.hardware.chipname",
			"ro.board.platform"
		], t = await this.execute(`shell getprop ${e.map((e) => `[${e}]`).join(" ")}`), n = {};
		for (let r of e) {
			let e = RegExp(`\\[${r}\\]:\\s*\\[(.*?)\\]`), i = t.stdout.match(e);
			i && (n[r] = i[1] || "unknown");
		}
		return n;
	}
	async getScreenInfo() {
		let e = await this.execute("shell wm size"), t = await this.execute("shell wm density"), n = e.stdout.match(/Physical size:\s*(\S+)/), r = t.stdout.match(/Physical density:\s*(\S+)/);
		return {
			resolution: n?.[1] || "unknown",
			density: r?.[1] || "unknown"
		};
	}
	async getBatteryInfo() {
		let e = await this.execute("shell dumpsys battery"), t = e.stdout.match(/level:\s*(\S+)/), n = e.stdout.match(/status:\s*(\S+)/), r = e.stdout.match(/temperature:\s*(\S+)/);
		return {
			level: t?.[1] || "unknown",
			status: n?.[1] || "unknown",
			temperature: r?.[1] || "unknown"
		};
	}
	async getStorageInfo() {
		return (await this.execute("shell df /data /sdcard 2>/dev/null")).stdout.split("\n").filter((e) => e.trim() && !e.startsWith("Filesystem")).map((e) => {
			let t = e.split(/\s+/);
			return {
				mount: t[5] || "/",
				total: t[1] || "0",
				used: t[2] || "0",
				free: t[3] || "0"
			};
		});
	}
	async getNetworkInfo() {
		let e = await this.execute("shell dumpsys wifi | grep 'mWifiInfo'"), t = await this.execute("shell ip route show table 0"), n = e.stdout.match(/SSID:\s*"([^"]+)"/), r = t.stdout.match(/src\s+(\S+)/);
		return {
			wifiSsid: n?.[1] || "not connected",
			ipAddress: r?.[1] || "unknown"
		};
	}
	async screenshot(e) {
		let t = "/sdcard/screenshot_tmp.png", n = await this.execute(`shell screencap -p ${t}`);
		if (n.exitCode !== 0) return n;
		let r = await this.pull(t, e);
		return await this.execute(`shell rm ${t}`), r;
	}
	async screenrecord(e, t = 10) {
		let n = "/sdcard/record_tmp.mp4", r = await this.execute(`shell screenrecord --time-limit ${t} ${n}`, (t + 5) * 1e3);
		if (r.exitCode !== 0) return r;
		let i = await this.pull(n, e);
		return await this.execute(`shell rm ${n}`), i;
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
	async getAppInfo(e) {
		let t = _(e), n = (await this.execute(`shell dumpsys package ${t}`, 15e3)).stdout, r = n.match(/versionName=(\S+)/), i = n.match(/targetSdk=(\S+)/), a = n.match(/firstInstallTime=(.+)/), o = await this.execute(`shell pm path ${t}`, 1e4), s = "unknown", c = o.stdout.split("\n").find((e) => e.startsWith("package:"))?.replace("package:", "")?.trim();
		if (c) {
			let e = await this.execute(`shell stat -c %s ${x(c)}`, 1e4), t = parseInt(e.stdout.trim(), 10);
			isNaN(t) || (s = t >= 1048576 ? (t / 1048576).toFixed(1) + " MB" : t >= 1024 ? (t / 1024).toFixed(1) + " KB" : t + " B");
		}
		let l = t;
		try {
			let e = await this.execute(`shell pm dump ${t}`, 15e3), n = e.stdout.match(/application-label[^:]*:"([^"]+)"/i) || e.stdout.match(/label[^:]*:"([^"]+)"/i);
			n && n[1] && (l = n[1]);
		} catch {}
		return {
			version: r?.[1] || "unknown",
			targetSdk: i?.[1] || "unknown",
			size: s,
			installDate: a?.[1]?.trim() || "unknown",
			label: l
		};
	}
	async clearAppData(e) {
		let t = _(e);
		return this.execute(`shell pm clear ${t}`, 3e4);
	}
	async uninstallApp(e) {
		let t = _(e);
		return this.execute(`shell pm uninstall ${t}`, 6e4);
	}
	async toggleApp(e, t) {
		let n = _(e), r = t ? "enable" : "disable";
		return this.execute(`shell pm ${r} ${n}`, 15e3);
	}
	async exportApk(e, t) {
		let n = _(e), r = (await this.execute(`shell pm path ${n}`, 1e4)).stdout.split("\n").find((e) => e.startsWith("package:"))?.replace("package:", "")?.trim();
		return r ? this.pull(r, t) : {
			stdout: "",
			stderr: "APK path not found",
			exitCode: 1
		};
	}
	async pair(e, t) {
		if (!/^[A-Za-z0-9._-]+:\d{1,5}$/.test(e)) throw Error("Invalid pairing target (expected host:port)");
		if (!/^\d{1,10}$/.test(t)) throw Error("Invalid pairing code");
		return this.execute(`pair ${e} ${t}`, 3e4);
	}
};
new D();
//#endregion
//#region electron/main.ts
var O = f.dirname(d(import.meta.url)), k = new D();
process.env.APP_ROOT = f.join(O, "..");
var A = process.env.VITE_DEV_SERVER_URL, j = f.join(process.env.APP_ROOT, "dist-electron"), M = f.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = A ? f.join(process.env.APP_ROOT, "public") : M;
var N = null, P = null, F = null, I = null, L = !1, R = {
	minimizeToTray: !0,
	globalHotkey: "Ctrl+Shift+H"
}, z = f.join(process.resourcesPath || f.join(process.env.APP_ROOT, "electron", "resources"), "win64"), B = f.join(z, "scrcpy", "scrcpy.exe"), V = f.join(z, "scrcpy", "adb.exe");
function H() {
	return process.platform === "win32" && p(B);
}
function U() {
	return H() ? B : "scrcpy";
}
function W() {
	let e = { ...process.env };
	return H() && (e.ADB = V), e;
}
function G() {
	N = new e({
		width: 1280,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		icon: f.join(process.env.VITE_PUBLIC, "icon.svg"),
		backgroundColor: "#030712",
		webPreferences: {
			preload: f.join(O, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), A ? N.loadURL(A) : N.loadFile(f.join(M, "index.html")), N.on("close", (e) => {
		L || R.minimizeToTray && (e.preventDefault(), N?.hide());
	}), N.on("show", () => N?.focus()), K();
}
function K() {
	if (!N) return;
	let e = f.join(process.env.VITE_PUBLIC ?? "", "icon.png"), i = s.createFromPath(e);
	I = new n(i), I.setToolTip("ADB GUI"), I.setContextMenu(t.buildFromTemplate([
		{
			label: "Show",
			click: () => {
				N?.show(), N?.focus();
			}
		},
		{
			label: "Hide",
			click: () => {
				N?.hide();
			}
		},
		{ type: "separator" },
		{
			label: "Settings",
			click: () => {
				N?.show(), N?.focus(), N?.webContents.send("navigate:section", "settings");
			}
		},
		{ type: "separator" },
		{
			label: "Quit",
			click: () => {
				L = !0, r.quit();
			}
		}
	])), I.on("click", () => {
		N?.isVisible() ? N.hide() : (N?.show(), N?.focus());
	});
}
function q(e) {
	a.unregisterAll(), e && (a.register(e, () => {
		N?.isVisible() ? N.hide() : (N?.show(), N?.focus());
	}) || console.warn(`Failed to register global hotkey: ${e}`));
}
o.handle("adb:execute", async (e, { cmd: t, deviceId: n }) => (n ? new D({ deviceId: n }) : k).execute(t)), o.handle("adb:list-devices", async () => k.getConnectedDevices()), o.handle("adb:list-file-entries", async (e, { remotePath: t, deviceId: n }) => {
	let r = await (n ? new D({ deviceId: n }) : k).listDirectory(t);
	return r.exitCode === 0 ? {
		error: null,
		entries: r.stdout.split("\n").map((e) => e.trim()).filter((e) => e && !e.startsWith("total ")).map((e) => {
			let t = e.split(/\s+/);
			if (t.length < 6) return null;
			let n = t[0], r = t[1], i = t[2], a = t[3], o = `${t[4]} ${t[5]} ${t[6] || ""}`;
			return {
				name: t.slice(7).join(" "),
				isDirectory: n.startsWith("d"),
				isSymlink: n.startsWith("l"),
				size: a,
				perms: n,
				owner: r,
				group: i,
				date: o
			};
		}).filter((e) => e !== null)
	} : {
		error: r.stderr || "Failed to list directory",
		entries: []
	};
}), o.handle("adb:pull-file", async (e, { remotePath: t, deviceId: n }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let r = f.basename(t), { canceled: a, filePath: o } = await i.showSaveDialog(N, {
		title: "Save pulled file",
		defaultPath: r
	});
	return a || !o ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (n ? new D({ deviceId: n }) : k).pull(t, o),
		localPath: o
	};
}), o.handle("adb:push-file", async (e, { remotePath: t, deviceId: n }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePaths: a } = await i.showOpenDialog(N, {
		title: "Select file(s) to push",
		properties: ["openFile", "multiSelections"]
	});
	if (r || a.length === 0) return {
		error: "cancelled",
		exitCode: 1
	};
	let o = n ? new D({ deviceId: n }) : k, s = [];
	for (let e of a) {
		let n = f.basename(e), r = t.endsWith("/") ? t + n : t + "/" + n, i = await o.push(e, r);
		s.push({
			file: e,
			result: i
		});
	}
	return {
		success: s.every((e) => e.result.exitCode === 0),
		results: s,
		pushedFiles: s.map((e) => f.basename(e.file))
	};
}), o.handle("adb:logcat-start", async (e, { priority: t, buffer: n, tags: r, pid: i, deviceId: a }) => {
	P &&= (P.kill(), null);
	let o = [];
	a && o.push("-s", a), o.push("logcat", "-v", "threadtime"), n && n !== "all" && o.push("-b", n), i && o.push("--pid", i), r ? o.push(...r.split(/\s+/).filter(Boolean)) : o.push(`*:${t || "I"}`);
	let s = u("adb", o, { stdio: [
		"ignore",
		"pipe",
		"pipe"
	] });
	P = s;
	let c = "";
	return s.stdout.on("data", (t) => {
		c += t.toString();
		let n = c.split("\n");
		c = n.pop() || "";
		for (let t of n) t.trim() && e.sender.send("adb:logcat-line", t);
	}), s.stderr.on("data", (t) => {
		e.sender.send("adb:logcat-line", `[stderr] ${t.toString().trim()}`);
	}), s.on("close", () => {
		P === s && (P = null);
	}), s.on("error", (t) => {
		e.sender.send("adb:logcat-line", `[error] ${t.message}`), P === s && (P = null);
	}), { success: !0 };
}), o.handle("adb:logcat-stop", async () => (P &&= (P.kill(), null), { success: !0 })), o.handle("adb:open-folder", async (e, { folderPath: t }) => {
	try {
		return await c.openPath(t), { success: !0 };
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Failed to open folder"
		};
	}
}), o.handle("adb:device-info", async (e, { deviceId: t }) => {
	let n = t ? new D({ deviceId: t }) : k, [r, i, a, o, s] = await Promise.all([
		n.getDeviceInfo(),
		n.getScreenInfo(),
		n.getBatteryInfo(),
		n.getStorageInfo(),
		n.getNetworkInfo()
	]);
	return {
		device: r,
		screen: i,
		battery: a,
		storage: o,
		network: s
	};
}), o.handle("adb:screenshot", async (e, { deviceId: t }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: n, filePath: r } = await i.showSaveDialog(N, {
		title: "Save Screenshot",
		defaultPath: `screenshot_${Date.now()}.png`,
		filters: [{
			name: "PNG",
			extensions: ["png"]
		}]
	});
	return n || !r ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (t ? new D({ deviceId: t }) : k).screenshot(r),
		localPath: r
	};
}), o.handle("adb:screenrecord", async (e, { timeLimit: t, deviceId: n }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: a } = await i.showSaveDialog(N, {
		title: "Save Screen Recording",
		defaultPath: `recording_${Date.now()}.mp4`,
		filters: [{
			name: "MP4",
			extensions: ["mp4"]
		}]
	});
	return r || !a ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (n ? new D({ deviceId: n }) : k).screenrecord(a, t || 10),
		localPath: a
	};
}), o.handle("adb:install-apk", async (e, { deviceId: t }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: n, filePaths: r } = await i.showOpenDialog(N, {
		title: "Select APK(s) to install",
		filters: [{
			name: "APK files",
			extensions: ["apk"]
		}],
		properties: ["openFile", "multiSelections"]
	});
	if (n || r.length === 0) return {
		error: "cancelled",
		exitCode: 1
	};
	let a = t ? new D({ deviceId: t }) : k, o = [];
	for (let e of r) {
		let t = await a.execute(`install -r "${e}"`, 12e4);
		o.push({
			file: e,
			result: t
		});
	}
	return {
		success: o.every((e) => e.result.exitCode === 0),
		results: o.map((e) => ({
			file: e.file,
			exitCode: e.result.exitCode,
			stderr: e.result.stderr
		})),
		installedFiles: o.filter((e) => e.result.exitCode === 0).map((e) => e.file),
		failedFiles: o.filter((e) => e.result.exitCode !== 0).map((e) => ({
			file: e.file,
			error: e.result.stderr
		}))
	};
}), o.handle("adb:backup-apps", async (e, { packages: t, deviceId: n }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: a } = await i.showSaveDialog(N, {
		title: "Save Backup File",
		defaultPath: `adb_backup_${Date.now()}.ab`,
		filters: [{
			name: "Android Backup",
			extensions: ["ab"]
		}]
	});
	if (r || !a) return {
		error: "cancelled",
		exitCode: 1
	};
	let o = n ? new D({ deviceId: n }) : k, s = t.map((e) => `"${e}"`).join(" ");
	return {
		...await o.execute(`backup -f "${a}" -noapk ${s}`, 12e4),
		localPath: a
	};
}), o.handle("adb:get-app-info", async (e, { packageName: t, deviceId: n }) => (n ? new D({ deviceId: n }) : k).getAppInfo(t)), o.handle("adb:get-foreground-activity", async (e, { deviceId: t } = {}) => (t ? new D({ deviceId: t }) : k).getForegroundActivity()), o.handle("adb:get-activities-for-package", async (e, { packageName: t, deviceId: n }) => {
	if (!t) throw Error("packageName required");
	return (n ? new D({ deviceId: n }) : k).getActivitiesForPackage(t);
}), o.handle("adb:clear-app-data", async (e, { packageName: t, deviceId: n }) => (n ? new D({ deviceId: n }) : k).clearAppData(t)), o.handle("adb:uninstall-app", async (e, { packageName: t, deviceId: n }) => (n ? new D({ deviceId: n }) : k).uninstallApp(t)), o.handle("adb:launch-activity", async (e, { packageName: t, activityName: n, deviceId: r }) => {
	if (!t || !n) throw Error("packageName and activityName required");
	return (r ? new D({ deviceId: r }) : k).launchActivity(t, n);
}), o.handle("adb:list-third-party-packages", async (e, { deviceId: t } = {}) => (t ? new D({ deviceId: t }) : k).listThirdPartyPackages()), o.handle("adb:toggle-app", async (e, { packageName: t, enable: n, deviceId: r }) => (r ? new D({ deviceId: r }) : k).toggleApp(t, n)), o.handle("adb:export-apk", async (e, { packageName: t, deviceId: n }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: a } = await i.showSaveDialog(N, {
		title: "Save APK",
		defaultPath: `${t}.apk`,
		filters: [{
			name: "APK",
			extensions: ["apk"]
		}]
	});
	return r || !a ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (n ? new D({ deviceId: n }) : k).exportApk(t, a),
		localPath: a
	};
}), o.handle("adb:export-logcat", async (e, { lines: t }) => {
	if (!N) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: n, filePath: r } = await i.showSaveDialog(N, {
		title: "Export Logcat",
		defaultPath: `logcat_${Date.now()}.txt`,
		filters: [{
			name: "Text",
			extensions: ["txt", "log"]
		}]
	});
	return n || !r ? {
		error: "cancelled",
		exitCode: 1
	} : (await (await import("node:fs/promises")).writeFile(r, t, "utf-8"), {
		success: !0,
		localPath: r
	});
}), o.handle("adb:pair", async (e, t, n) => k.pair(t, n)), o.handle("window:show", async () => (N?.show(), N?.focus(), {})), o.handle("window:hide", async () => (N?.hide(), {})), o.handle("window:save-settings", async (e, t) => (R = t, q(t.globalHotkey), { success: !0 })), o.handle("window:navigate", async (e, t) => (N?.webContents.send("navigate:section", t), { success: !0 })), o.handle("adb:start-mirror", async (e, { bitrate: t, maxSize: n, fps: r, control: i }) => {
	F &&= (F.kill(), null);
	try {
		let e = U();
		if (!await new Promise((t) => {
			let n = u(e, ["--version"], {
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				],
				env: W()
			}), r = !1;
			n.on("error", () => {
				r || (r = !0, t(!1));
			}), n.on("close", () => {
				r || (r = !0, t(!0));
			}), setTimeout(() => {
				r || (r = !0, n.kill(), t(!1));
			}, 5e3);
		})) return {
			success: !1,
			error: H() ? "scrcpy is bundled but failed to start" : "scrcpy not found. Install it from https://github.com/Genymobile/scrcpy"
		};
		let a = [
			"--video-bit-rate",
			`${t}M`,
			"--max-size",
			`${n}`,
			"--max-fps",
			`${r}`,
			...i ? [] : ["--no-control"]
		];
		F = u(e, a, {
			stdio: [
				"ignore",
				"ignore",
				"pipe"
			],
			detached: !0,
			env: W()
		});
		let o = F, s = "";
		return o.stderr?.on("data", (e) => {
			s += e.toString();
		}), new Promise((e) => {
			let t = !1, n = (n) => {
				t || (t = !0, F = null, e({
					success: !1,
					error: n
				}));
			};
			o.on("error", (e) => {
				n(e.message);
			}), o.on("exit", () => {
				n(s.trim() || "scrcpy exited unexpectedly (is a device connected?)");
			}), setTimeout(() => {
				t || (t = !0, e({ success: !0 }));
			}, 2e3);
		});
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Failed to start scrcpy"
		};
	}
}), o.handle("adb:stop-mirror", async () => (F &&= (F.kill(), null), { success: !0 })), r.on("before-quit", () => {
	L = !0;
}), r.on("window-all-closed", () => {
	P &&= (P.kill(), null), process.platform !== "darwin" && (r.quit(), N = null);
}), r.on("activate", () => {
	e.getAllWindows().length === 0 && G();
}), r.whenReady().then(() => {
	G(), q(R.globalHotkey);
});
//#endregion
export { j as MAIN_DIST, M as RENDERER_DIST, A as VITE_DEV_SERVER_URL };
