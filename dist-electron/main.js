var y = Object.defineProperty;
var g = (n, e, t) => e in n ? y(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var h = (n, e, t) => g(n, typeof e != "symbol" ? e + "" : e, t);
import { ipcMain as a, app as d, BrowserWindow as f } from "electron";
import { fileURLToPath as P } from "node:url";
import o from "node:path";
import { exec as R } from "node:child_process";
import { promisify as _ } from "node:util";
const I = _(R);
class m {
  constructor(e = {}) {
    h(this, "deviceId");
    this.deviceId = e.deviceId ?? null;
  }
  resolveCommand(e) {
    return this.deviceId ? `adb -s ${this.deviceId} ${e}` : e;
  }
  async execute(e, t = 1e4) {
    const i = this.resolveCommand(e).replace(/[&|<>$`]/g, "\\$&");
    try {
      const { stdout: r, stderr: c } = await I(i, { timeout: t });
      return { stdout: r, stderr: c, exitCode: 0 };
    } catch (r) {
      const c = r;
      return {
        stdout: c.stdout || "",
        stderr: c.stderr || c.message,
        exitCode: c.code ? Number(c.code) : 1
      };
    }
  }
  async getConnectedDevices() {
    return (await this.execute("devices")).stdout.split(`
`).filter(
      (t) => !t.startsWith("List") && !t.startsWith("*") && t.trim()
    ).map((t) => t.split("	")[0]);
  }
  async isDeviceConnected(e) {
    return (await this.execute(`device ${e}`)).exitCode === 0;
  }
  async getADBInfo() {
    var s, i;
    const t = (await this.execute("version")).stdout.split(`
`);
    return {
      version: ((s = t[0]) == null ? void 0 : s.trim()) || "unknown",
      path: ((i = t[1]) == null ? void 0 : i.trim()) || "unknown",
      features: t.slice(2).filter(Boolean)
    };
  }
  async listPackages() {
    return (await this.execute("pm list packages")).stdout.split(`
`).filter((t) => t.includes("package:")).map((t) => t.replace("package:", "").trim());
  }
  async listThirdPartyPackages() {
    return (await this.execute("pm list packages -3")).stdout.split(`
`).filter((t) => t.includes("package:")).map((t) => t.replace("package:", "").trim());
  }
  async grantPermissions(e) {
    return this.execute(
      `pm grant ${e} --user 0 --all-permissions`,
      3e4
    );
  }
  async listPermissions(e) {
    return (await this.execute(`pm list permissions ${e}`)).stdout.split(`
`).filter((s) => s.includes("name:")).map((s) => s.replace("name:", "").trim());
  }
  async listProcesses() {
    const e = await this.execute("shell ps -A -o USER,PID,NAME"), t = [], s = e.stdout.trim().split(`
`);
    for (const i of s) {
      const r = i.split(/\s+/);
      r.length >= 3 && r[0] !== "USER" && t.push({
        user: r[0],
        pid: parseInt(r[1], 10),
        name: r.slice(2).join(" ")
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
    const t = [];
    for (const s of e) {
      const i = await this.execute(s.cmd);
      t.push(i);
    }
    return { success: !0, results: t };
  }
}
new m();
const v = o.dirname(P(import.meta.url)), l = new m();
process.env.APP_ROOT = o.join(v, "..");
const p = process.env.VITE_DEV_SERVER_URL, k = o.join(process.env.APP_ROOT, "dist-electron"), x = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = p ? o.join(process.env.APP_ROOT, "public") : x;
let u = null;
function w() {
  u = new f({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#030712",
    webPreferences: {
      preload: o.join(v, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), p ? u.loadURL(p) : u.loadFile(o.join(x, "index.html"));
}
a.handle("adb:execute", async (n, e) => l.execute(e));
a.handle("adb:list-devices", async () => l.getConnectedDevices());
a.handle("adb:is-device-connected", async (n, e) => l.isDeviceConnected(e));
a.handle("adb:get-info", async () => l.getADBInfo());
a.handle(
  "adb:execute-device",
  async (n, { cmd: e, deviceId: t }) => t ? new m({ deviceId: t }).execute(e) : l.execute(e)
);
d.on("window-all-closed", () => {
  process.platform !== "darwin" && (d.quit(), u = null);
});
d.on("activate", () => {
  f.getAllWindows().length === 0 && w();
});
d.whenReady().then(w);
export {
  k as MAIN_DIST,
  x as RENDERER_DIST,
  p as VITE_DEV_SERVER_URL
};
