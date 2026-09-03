import { BrowserWindow as e, Menu as t, Tray as n, app as r, dialog as i, globalShortcut as a, ipcMain as o, nativeImage as s, shell as c } from "electron";
import { exec as l, spawn as u } from "node:child_process";
import { fileURLToPath as d } from "node:url";
import f from "node:path";
import { existsSync as p } from "node:fs";
import { promisify as m } from "node:util";
//#region electron/adbService.ts
var h = m(l), g = class {
	deviceId;
	constructor(e = {}) {
		this.deviceId = e.deviceId ?? null;
	}
	resolveCommand(e) {
		return this.deviceId ? `adb -s ${this.deviceId} ${e}` : `adb ${e}`;
	}
	async execute(e, t = 1e4) {
		let n = this.resolveCommand(e).replace(/[&|<>$`]/g, "\\$&");
		try {
			let { stdout: e, stderr: r } = await h(n, { timeout: t });
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
		return (await this.execute("shell pm list packages")).stdout.split("\n").filter((e) => e.includes("package:")).map((e) => e.replace("package:", "").trim());
	}
	async listThirdPartyPackages() {
		return (await this.execute("shell pm list packages -3")).stdout.split("\n").filter((e) => e.includes("package:")).map((e) => e.replace("package:", "").trim());
	}
	async grantPermissions(e) {
		return this.execute(`shell pm grant ${e} --user 0 --all-permissions`, 3e4);
	}
	async listPermissions(e) {
		return (await this.execute(`shell pm list permissions ${e}`)).stdout.split("\n").filter((e) => e.includes("name:")).map((e) => e.replace("name:", "").trim());
	}
	async listActivities(e) {
		let t = await this.execute(`shell dumpsys package ${e}`, 15e3), n = /^\s+[0-9a-f]+\s+(\S+)\s+filter\s+[0-9a-f]+/gm, r = /* @__PURE__ */ new Set(), i = t.stdout.matchAll(n);
		for (let e of i) {
			let t = e[1];
			if (!t) continue;
			let n = t.indexOf("/");
			n !== -1 && r.add(t.slice(n + 1));
		}
		return [...r].sort();
	}
	async launchActivity(e, t) {
		let n = t.startsWith(".") ? t : t.replace(e, "");
		return this.execute(`shell am start -n ${e}/${n}`, 1e4);
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
		let t = (await this.execute(`shell dumpsys package ${e}`, 15e3)).stdout, n = t.match(/versionName=(\S+)/), r = t.match(/targetSdk=(\S+)/), i = t.match(/firstInstallTime=(.+)/), a = await this.execute(`shell pm path ${e}`, 1e4), o = "unknown", s = a.stdout.split("\n").find((e) => e.startsWith("package:"))?.replace("package:", "")?.trim();
		if (s) {
			let e = await this.execute(`shell stat -c %s ${s}`, 1e4), t = parseInt(e.stdout.trim(), 10);
			isNaN(t) || (o = t >= 1048576 ? (t / 1048576).toFixed(1) + " MB" : t >= 1024 ? (t / 1024).toFixed(1) + " KB" : t + " B");
		}
		let c = (await this.execute(`shell pm dump ${e} | grep -m1 "application-label:"`)).stdout.match(/application-label:"([^"]+)"/);
		return {
			version: n?.[1] || "unknown",
			targetSdk: r?.[1] || "unknown",
			size: o,
			installDate: i?.[1]?.trim() || "unknown",
			label: c?.[1] || e
		};
	}
	async clearAppData(e) {
		return this.execute(`shell pm clear ${e}`, 3e4);
	}
	async uninstallApp(e) {
		return this.execute(`shell pm uninstall ${e}`, 6e4);
	}
	async toggleApp(e, t) {
		let n = t ? "enable" : "disable";
		return this.execute(`shell pm ${n} ${e}`, 15e3);
	}
	async exportApk(e, t) {
		let n = (await this.execute(`shell pm path ${e}`, 1e4)).stdout.split("\n").find((e) => e.startsWith("package:"))?.replace("package:", "")?.trim();
		return n ? this.pull(n, t) : {
			stdout: "",
			stderr: "APK path not found",
			exitCode: 1
		};
	}
	async pair(e, t) {
		return this.execute(`pair ${e} ${t}`, 3e4);
	}
};
new g();
//#endregion
//#region electron/main.ts
var _ = f.dirname(d(import.meta.url)), v = new g();
process.env.APP_ROOT = f.join(_, "..");
var y = process.env.VITE_DEV_SERVER_URL, b = f.join(process.env.APP_ROOT, "dist-electron"), x = f.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? f.join(process.env.APP_ROOT, "public") : x;
var S = null, C = null, w = null, T = null, E = !1, D = {
	minimizeToTray: !0,
	globalHotkey: "Ctrl+Shift+H"
}, O = f.join(process.resourcesPath || f.join(process.env.APP_ROOT, "electron", "resources"), "win64"), k = f.join(O, "scrcpy", "scrcpy.exe"), A = f.join(O, "scrcpy", "adb.exe");
function j() {
	return process.platform === "win32" && p(k);
}
function M() {
	return j() ? k : "scrcpy";
}
function N() {
	let e = { ...process.env };
	return j() && (e.ADB = A), e;
}
function P() {
	S = new e({
		width: 1280,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		icon: f.join(process.env.VITE_PUBLIC, "icon.svg"),
		backgroundColor: "#030712",
		webPreferences: {
			preload: f.join(_, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), y ? S.loadURL(y) : S.loadFile(f.join(x, "index.html")), S.on("close", (e) => {
		E || D.minimizeToTray && (e.preventDefault(), S?.hide());
	}), S.on("show", () => S?.focus()), F();
}
function F() {
	if (!S) return;
	let e = f.join(process.env.VITE_PUBLIC ?? "", "icon.png"), i = s.createFromPath(e);
	T = new n(i), T.setToolTip("ADB GUI"), T.setContextMenu(t.buildFromTemplate([
		{
			label: "Show",
			click: () => {
				S?.show(), S?.focus();
			}
		},
		{
			label: "Hide",
			click: () => {
				S?.hide();
			}
		},
		{ type: "separator" },
		{
			label: "Settings",
			click: () => {
				S?.show(), S?.focus(), S?.webContents.send("navigate:section", "settings");
			}
		},
		{ type: "separator" },
		{
			label: "Quit",
			click: () => {
				E = !0, r.quit();
			}
		}
	])), T.on("click", () => {
		S?.isVisible() ? S.hide() : (S?.show(), S?.focus());
	});
}
function I(e) {
	a.unregisterAll(), e && (a.register(e, () => {
		S?.isVisible() ? S.hide() : (S?.show(), S?.focus());
	}) || console.warn(`Failed to register global hotkey: ${e}`));
}
o.handle("adb:execute", async (e, { cmd: t, deviceId: n }) => (n ? new g({ deviceId: n }) : v).execute(t)), o.handle("adb:list-devices", async () => v.getConnectedDevices()), o.handle("adb:list-file-entries", async (e, { remotePath: t, deviceId: n }) => {
	let r = await (n ? new g({ deviceId: n }) : v).listDirectory(t);
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
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let r = f.basename(t), { canceled: a, filePath: o } = await i.showSaveDialog(S, {
		title: "Save pulled file",
		defaultPath: r
	});
	return a || !o ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (n ? new g({ deviceId: n }) : v).pull(t, o),
		localPath: o
	};
}), o.handle("adb:push-file", async (e, { remotePath: t, deviceId: n }) => {
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePaths: a } = await i.showOpenDialog(S, {
		title: "Select file(s) to push",
		properties: ["openFile", "multiSelections"]
	});
	if (r || a.length === 0) return {
		error: "cancelled",
		exitCode: 1
	};
	let o = n ? new g({ deviceId: n }) : v, s = [];
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
	C &&= (C.kill(), null);
	let o = [];
	a && o.push("-s", a), o.push("logcat", "-v", "threadtime"), n && n !== "all" && o.push("-b", n), i && o.push("--pid", i), r ? o.push(...r.split(/\s+/).filter(Boolean)) : o.push(`*:${t || "I"}`);
	let s = u("adb", o, { stdio: [
		"ignore",
		"pipe",
		"pipe"
	] });
	C = s;
	let c = "";
	return s.stdout.on("data", (t) => {
		c += t.toString();
		let n = c.split("\n");
		c = n.pop() || "";
		for (let t of n) t.trim() && e.sender.send("adb:logcat-line", t);
	}), s.stderr.on("data", (t) => {
		e.sender.send("adb:logcat-line", `[stderr] ${t.toString().trim()}`);
	}), s.on("close", () => {
		C === s && (C = null);
	}), s.on("error", (t) => {
		e.sender.send("adb:logcat-line", `[error] ${t.message}`), C === s && (C = null);
	}), { success: !0 };
}), o.handle("adb:logcat-stop", async () => (C &&= (C.kill(), null), { success: !0 })), o.handle("adb:open-folder", async (e, { folderPath: t }) => {
	try {
		return await c.openPath(t), { success: !0 };
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Failed to open folder"
		};
	}
}), o.handle("adb:device-info", async (e, { deviceId: t }) => {
	let n = t ? new g({ deviceId: t }) : v, [r, i, a, o, s] = await Promise.all([
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
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: n, filePath: r } = await i.showSaveDialog(S, {
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
		...await (t ? new g({ deviceId: t }) : v).screenshot(r),
		localPath: r
	};
}), o.handle("adb:screenrecord", async (e, { timeLimit: t, deviceId: n }) => {
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: a } = await i.showSaveDialog(S, {
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
		...await (n ? new g({ deviceId: n }) : v).screenrecord(a, t || 10),
		localPath: a
	};
}), o.handle("adb:install-apk", async (e, { deviceId: t }) => {
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: n, filePaths: r } = await i.showOpenDialog(S, {
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
	let a = t ? new g({ deviceId: t }) : v, o = [];
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
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: a } = await i.showSaveDialog(S, {
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
	let o = n ? new g({ deviceId: n }) : v, s = t.map((e) => `"${e}"`).join(" ");
	return {
		...await o.execute(`backup -f "${a}" -noapk ${s}`, 12e4),
		localPath: a
	};
}), o.handle("adb:get-app-info", async (e, { packageName: t, deviceId: n }) => (n ? new g({ deviceId: n }) : v).getAppInfo(t)), o.handle("adb:clear-app-data", async (e, { packageName: t, deviceId: n }) => (n ? new g({ deviceId: n }) : v).clearAppData(t)), o.handle("adb:uninstall-app", async (e, { packageName: t, deviceId: n }) => (n ? new g({ deviceId: n }) : v).uninstallApp(t)), o.handle("adb:toggle-app", async (e, { packageName: t, enable: n, deviceId: r }) => (r ? new g({ deviceId: r }) : v).toggleApp(t, n)), o.handle("adb:export-apk", async (e, { packageName: t, deviceId: n }) => {
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: a } = await i.showSaveDialog(S, {
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
		...await (n ? new g({ deviceId: n }) : v).exportApk(t, a),
		localPath: a
	};
}), o.handle("adb:export-logcat", async (e, { lines: t }) => {
	if (!S) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: n, filePath: r } = await i.showSaveDialog(S, {
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
}), o.handle("adb:pair", async (e, t, n) => v.pair(t, n)), o.handle("window:show", async () => (S?.show(), S?.focus(), {})), o.handle("window:hide", async () => (S?.hide(), {})), o.handle("window:save-settings", async (e, t) => (D = t, I(t.globalHotkey), { success: !0 })), o.handle("window:navigate", async (e, t) => (S?.webContents.send("navigate:section", t), { success: !0 })), o.handle("adb:start-mirror", async (e, { bitrate: t, maxSize: n, fps: r, control: i }) => {
	w &&= (w.kill(), null);
	try {
		let e = M();
		if (!await new Promise((t) => {
			let n = u(e, ["--version"], {
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				],
				env: N()
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
			error: j() ? "scrcpy is bundled but failed to start" : "scrcpy not found. Install it from https://github.com/Genymobile/scrcpy"
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
		w = u(e, a, {
			stdio: [
				"ignore",
				"ignore",
				"pipe"
			],
			detached: !0,
			env: N()
		});
		let o = w, s = "";
		return o.stderr?.on("data", (e) => {
			s += e.toString();
		}), new Promise((e) => {
			let t = !1, n = (n) => {
				t || (t = !0, w = null, e({
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
}), o.handle("adb:stop-mirror", async () => (w &&= (w.kill(), null), { success: !0 })), r.on("before-quit", () => {
	E = !0;
}), r.on("window-all-closed", () => {
	C &&= (C.kill(), null), process.platform !== "darwin" && (r.quit(), S = null);
}), r.on("activate", () => {
	e.getAllWindows().length === 0 && P();
}), r.whenReady().then(() => {
	P(), I(D.globalHotkey);
});
//#endregion
export { b as MAIN_DIST, x as RENDERER_DIST, y as VITE_DEV_SERVER_URL };
