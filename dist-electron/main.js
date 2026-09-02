import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, shell as i } from "electron";
import { exec as a, spawn as o } from "node:child_process";
import { fileURLToPath as s } from "node:url";
import c from "node:path";
import { promisify as l } from "node:util";
//#region electron/adbService.ts
var u = l(a), d = class {
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
			let { stdout: e, stderr: r } = await u(n, { timeout: t });
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
};
new d();
//#endregion
//#region electron/main.ts
var f = c.dirname(s(import.meta.url)), p = new d();
process.env.APP_ROOT = c.join(f, "..");
var m = process.env.VITE_DEV_SERVER_URL, h = c.join(process.env.APP_ROOT, "dist-electron"), g = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? c.join(process.env.APP_ROOT, "public") : g;
var _ = null, v = null;
function y() {
	_ = new e({
		width: 1280,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		icon: c.join(process.env.VITE_PUBLIC, "icon.svg"),
		backgroundColor: "#030712",
		webPreferences: {
			preload: c.join(f, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), m ? _.loadURL(m) : _.loadFile(c.join(g, "index.html"));
}
r.handle("adb:execute", async (e, { cmd: t, deviceId: n }) => (n ? new d({ deviceId: n }) : p).execute(t)), r.handle("adb:list-devices", async () => p.getConnectedDevices()), r.handle("adb:list-file-entries", async (e, { remotePath: t, deviceId: n }) => {
	let r = await (n ? new d({ deviceId: n }) : p).listDirectory(t);
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
}), r.handle("adb:pull-file", async (e, { remotePath: t, deviceId: r }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let i = c.basename(t), { canceled: a, filePath: o } = await n.showSaveDialog(_, {
		title: "Save pulled file",
		defaultPath: i
	});
	return a || !o ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (r ? new d({ deviceId: r }) : p).pull(t, o),
		localPath: o
	};
}), r.handle("adb:push-file", async (e, { remotePath: t, deviceId: r }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: i, filePaths: a } = await n.showOpenDialog(_, {
		title: "Select file(s) to push",
		properties: ["openFile", "multiSelections"]
	});
	if (i || a.length === 0) return {
		error: "cancelled",
		exitCode: 1
	};
	let o = r ? new d({ deviceId: r }) : p, s = [];
	for (let e of a) {
		let n = c.basename(e), r = t.endsWith("/") ? t + n : t + "/" + n, i = await o.push(e, r);
		s.push({
			file: e,
			result: i
		});
	}
	return {
		success: s.every((e) => e.result.exitCode === 0),
		results: s,
		pushedFiles: s.map((e) => c.basename(e.file))
	};
}), r.handle("adb:logcat-start", async (e, { priority: t, buffer: n, tags: r, pid: i, deviceId: a }) => {
	v &&= (v.kill(), null);
	let s = [];
	a && s.push("-s", a), s.push("logcat", "-v", "threadtime"), n && n !== "all" && s.push("-b", n), i && s.push("--pid", i), r ? s.push(...r.split(/\s+/).filter(Boolean)) : s.push(`*:${t || "I"}`);
	let c = o("adb", s, { stdio: [
		"ignore",
		"pipe",
		"pipe"
	] });
	v = c;
	let l = "";
	return c.stdout.on("data", (t) => {
		l += t.toString();
		let n = l.split("\n");
		l = n.pop() || "";
		for (let t of n) t.trim() && e.sender.send("adb:logcat-line", t);
	}), c.stderr.on("data", (t) => {
		e.sender.send("adb:logcat-line", `[stderr] ${t.toString().trim()}`);
	}), c.on("close", () => {
		v === c && (v = null);
	}), c.on("error", (t) => {
		e.sender.send("adb:logcat-line", `[error] ${t.message}`), v === c && (v = null);
	}), { success: !0 };
}), r.handle("adb:logcat-stop", async () => (v &&= (v.kill(), null), { success: !0 })), r.handle("adb:open-folder", async (e, { folderPath: t }) => {
	try {
		return await i.openPath(t), { success: !0 };
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Failed to open folder"
		};
	}
}), r.handle("adb:device-info", async (e, { deviceId: t }) => {
	let n = t ? new d({ deviceId: t }) : p, [r, i, a, o, s] = await Promise.all([
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
}), r.handle("adb:screenshot", async (e, { deviceId: t }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: i } = await n.showSaveDialog(_, {
		title: "Save Screenshot",
		defaultPath: `screenshot_${Date.now()}.png`,
		filters: [{
			name: "PNG",
			extensions: ["png"]
		}]
	});
	return r || !i ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (t ? new d({ deviceId: t }) : p).screenshot(i),
		localPath: i
	};
}), r.handle("adb:screenrecord", async (e, { timeLimit: t, deviceId: r }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: i, filePath: a } = await n.showSaveDialog(_, {
		title: "Save Screen Recording",
		defaultPath: `recording_${Date.now()}.mp4`,
		filters: [{
			name: "MP4",
			extensions: ["mp4"]
		}]
	});
	return i || !a ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (r ? new d({ deviceId: r }) : p).screenrecord(a, t || 10),
		localPath: a
	};
}), r.handle("adb:install-apk", async (e, { deviceId: t }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePaths: i } = await n.showOpenDialog(_, {
		title: "Select APK to install",
		filters: [{
			name: "APK files",
			extensions: ["apk"]
		}],
		properties: ["openFile"]
	});
	if (r || i.length === 0) return {
		error: "cancelled",
		exitCode: 1
	};
	let a = i[0];
	return {
		...await (t ? new d({ deviceId: t }) : p).execute(`install -r "${a}"`, 12e4),
		apkPath: a
	};
}), r.handle("adb:backup-apps", async (e, { packages: t, deviceId: r }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: i, filePath: a } = await n.showSaveDialog(_, {
		title: "Save Backup File",
		defaultPath: `adb_backup_${Date.now()}.ab`,
		filters: [{
			name: "Android Backup",
			extensions: ["ab"]
		}]
	});
	if (i || !a) return {
		error: "cancelled",
		exitCode: 1
	};
	let o = r ? new d({ deviceId: r }) : p, s = t.map((e) => `"${e}"`).join(" ");
	return {
		...await o.execute(`backup -f "${a}" -noapk ${s}`, 12e4),
		localPath: a
	};
}), r.handle("adb:get-app-info", async (e, { packageName: t, deviceId: n }) => (n ? new d({ deviceId: n }) : p).getAppInfo(t)), r.handle("adb:clear-app-data", async (e, { packageName: t, deviceId: n }) => (n ? new d({ deviceId: n }) : p).clearAppData(t)), r.handle("adb:uninstall-app", async (e, { packageName: t, deviceId: n }) => (n ? new d({ deviceId: n }) : p).uninstallApp(t)), r.handle("adb:toggle-app", async (e, { packageName: t, enable: n, deviceId: r }) => (r ? new d({ deviceId: r }) : p).toggleApp(t, n)), r.handle("adb:export-apk", async (e, { packageName: t, deviceId: r }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: i, filePath: a } = await n.showSaveDialog(_, {
		title: "Save APK",
		defaultPath: `${t}.apk`,
		filters: [{
			name: "APK",
			extensions: ["apk"]
		}]
	});
	return i || !a ? {
		error: "cancelled",
		exitCode: 1
	} : {
		...await (r ? new d({ deviceId: r }) : p).exportApk(t, a),
		localPath: a
	};
}), r.handle("adb:export-logcat", async (e, { lines: t }) => {
	if (!_) return {
		error: "No window",
		exitCode: 1
	};
	let { canceled: r, filePath: i } = await n.showSaveDialog(_, {
		title: "Export Logcat",
		defaultPath: `logcat_${Date.now()}.txt`,
		filters: [{
			name: "Text",
			extensions: ["txt", "log"]
		}]
	});
	return r || !i ? {
		error: "cancelled",
		exitCode: 1
	} : (await (await import("node:fs/promises")).writeFile(i, t, "utf-8"), {
		success: !0,
		localPath: i
	});
}), t.on("window-all-closed", () => {
	v &&= (v.kill(), null), process.platform !== "darwin" && (t.quit(), _ = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && y();
}), t.whenReady().then(y);
//#endregion
export { h as MAIN_DIST, g as RENDERER_DIST, m as VITE_DEV_SERVER_URL };
