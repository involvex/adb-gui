import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export function isValidPackageName(pkg: string): boolean {
  if (!pkg || typeof pkg !== "string") return false;
  return (
    /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg) &&
    pkg.length <= 255
  );
}

/**
 * Validate a value that is interpolated into a shell command as-is (package
 * names, activity class names). Rejects anything that could escape the
 * argument and inject additional shell commands.
 */
function assertSafeToken(value: string, label: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid ${label}`);
  }
  // Allow letters, digits, underscore, dot, dollar (Java inner classes) and the
  // leading dot of Android short activity names.
  if (!/^[a-zA-Z0-9_.$]+$/.test(value) || value.length > 255) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

export function assertValidPackageName(pkg: string): string {
  return assertSafeToken(pkg, "package name");
}

export function assertValidActivityName(activity: string): string {
  return assertSafeToken(activity, "activity name");
}

/**
 * ADB device serials / transport ids ("emulator-5554", "ip:port" wireless ids).
 * Spaces are allowed because Windows mDNS de-duplicates colliding hostnames by
 * appending " (2)" to them ("HOST (2)._adb-tls-connect._tcp").
 */
export function isValidDeviceId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return (
    /^[A-Za-z0-9 ._:()-]+$/.test(id) && id.trim().length > 0 && id.length <= 128
  );
}

export function assertValidDeviceId(id: string): string {
  if (!isValidDeviceId(id)) throw new Error(`Invalid device id: ${id}`);
  return id;
}

/**
 * Validate a path living on the device. Device paths never legitimately contain
 * shell metacharacters or quotes, so reject them instead of attempting to
 * escape (adb shells the string out verbatim).
 */
export function sanitizePath(p: string): string {
  if (!p || typeof p !== "string") throw new Error("Invalid path");
  if (/[;&|$()<>"'`\n\r]/.test(p)) {
    throw new Error("Invalid path characters");
  }
  return p;
}

/**
 * Quote an argument for the host shell (cmd.exe / sh). Double quotes protect
 * spaces and parentheses; a value containing a quote or newline could break
 * out of the quoting, so it is rejected.
 */
export function quoteArg(value: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Invalid argument");
  }
  if (/["`\n\r]/.test(value)) {
    throw new Error("Invalid characters in argument");
  }
  return `"${value}"`;
}

/**
 * Escape shell metacharacters outside of double-quoted segments.
 *
 * Quoted arguments (device serials, host paths) are left byte-for-byte intact:
 * cmd.exe does not treat `\` as an escape, so escaping a parenthesis that lives
 * inside a quoted serial such as `"HOST (2)._adb-tls-connect._tcp"` would
 * corrupt it. Characters outside quotes are escaped, which keeps untrusted
 * tokens (package names, activity names) from breaking out of their argument.
 */
export function escapeUnquotedSpecials(cmd: string): string {
  let out = "";
  let inQuotes = false;
  for (const ch of cmd) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      out += ch;
      continue;
    }
    if (!inQuotes && /[&<>$`()]/.test(ch)) {
      out += `\\${ch}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Extract launchable activity components from `dumpsys package <pkg>` output.
 *
 * Entries appear in the "Activity Resolver Table" section (also in the
 * receiver/service/provider tables, which are ignored):
 *
 *   Activity Resolver Table:
 *     Non-Data Actions:
 *       android.intent.action.MAIN:
 *         3f2a1b0 com.example/.MainActivity filter 3f2a1b0
 *
 * Entries registered under an `android.intent.action.MAIN` action are the
 * launchable ones; if none are found we fall back to every resolver entry so
 * packages with unusual manifests still list something usable.
 */
export function parseActivitiesFromDump(stdout: string): string[] {
  const mainActivities = new Set<string>();
  const otherActivities = new Set<string>();
  let inActivityTable = false;
  let inMainAction = false;

  for (const line of stdout.split("\n")) {
    if (/Resolver Table:/.test(line)) {
      inActivityTable = line.includes("Activity Resolver Table");
      inMainAction = false;
      continue;
    }
    if (!inActivityTable) continue;

    const action = line.match(/^\s+([a-zA-Z0-9_.]+:\s*$)/);
    if (action) {
      inMainAction = action[1].startsWith("android.intent.action.MAIN");
      continue;
    }

    const entry = line.match(
      /^\s+[0-9a-fA-F]+\s+(\S+)\/(\S+)\s+filter\s+[0-9a-fA-F]+/,
    );
    if (entry) {
      if (inMainAction) mainActivities.add(entry[2]);
      else otherActivities.add(entry[2]);
    }
  }

  const activities = mainActivities.size > 0 ? mainActivities : otherActivities;
  return [...activities].sort();
}

/**
 * Normalise a package/activity pair into a value usable with `am start -n`.
 *
 * Accepts a short name (".MainActivity", resolved against the package), a
 * fully-qualified class name, or an already-complete component.
 */
export function resolveActivityComponent(
  packageName: string,
  activityName: string,
): string {
  const activity = activityName.trim();
  if (activity.startsWith(`${packageName}/`)) return activity;
  if (activity.startsWith(".")) return `${packageName}/${activity}`;
  // A class name that already starts with the package is fully qualified.
  if (activity.startsWith(`${packageName}.`)) return activity;
  return `${packageName}/${activity}`;
}

/**
 * Extract the resumed (foreground) component from activity dumps.
 *
 * Handles the field names used across Android versions:
 *   topResumedActivity=ActivityRecord{... com.pkg/.Act t123}
 *   mResumedActivity: ActivityRecord{... com.pkg/.Act t123}
 *   ResumedActivity: ActivityRecord{... com.pkg/.Act t123}
 * and the classic (pre-10) "Activities: <token> com.pkg/.Act" layout, which
 * only appears in `dumpsys activity top` output (hence the `legacy` flag).
 */
export function parseForegroundActivityFromDump(
  stdout: string,
  legacy = false,
): { package: string; activity: string } | null {
  const record = String.raw`ActivityRecord\{[^}]*?\s(\S+)\/(\S+)\s+t\d+\}`;
  const patterns: RegExp[] = [
    new RegExp(String.raw`topResumedActivity=` + record),
    new RegExp(String.raw`mResumedActivity:?\s+` + record),
    new RegExp(String.raw`ResumedActivity:?\s+` + record),
  ];
  if (legacy) {
    patterns.push(/^\s*Activities:\s+\S+\s+(\S+)\/(\S+)/m);
  }
  for (const re of patterns) {
    const match = stdout.match(re);
    if (match) return { package: match[1], activity: match[2] };
  }
  return null;
}

export interface AdbResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class AdbService {
  private deviceId: string | null;

  constructor(options: { deviceId?: string } = {}) {
    this.deviceId = options.deviceId ?? null;
  }

  private resolveCommand(cmd: string): string {
    if (this.deviceId) {
      // Central choke point: the device id is interpolated into a shell string,
      // so it is validated and always quoted (serials may contain spaces).
      return `adb -s ${quoteArg(assertValidDeviceId(this.deviceId))} ${cmd}`;
    }
    return `adb ${cmd}`;
  }

  async execute(cmd: string, timeout: number = 10000): Promise<AdbResult> {
    const fullCmd = this.resolveCommand(cmd);
    // Escape characters that are dangerous in both cmd.exe and POSIX shells.
    // `|` and `;` are intentionally left alone: several device-side commands
    // rely on pipelines (e.g. `dumpsys x | grep y`), and user-supplied values
    // are validated/whitelisted by the callers before reaching this point.
    // `"` is deliberately not escaped here because path arguments are quoted
    // with quoteArg() by their callers.
    const safeCmd = escapeUnquotedSpecials(fullCmd);
    try {
      const { stdout, stderr } = await execAsync(safeCmd, {
        timeout,
        maxBuffer: 1024 * 1024 * 50,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const e = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
      };
      return {
        stdout: e.stdout || "",
        stderr: e.stderr || e.message,
        exitCode: e.code ? Number(e.code) : 1,
      };
    }
  }

  async getConnectedDevices(): Promise<string[]> {
    const result = await this.execute("devices");
    return result.stdout
      .split("\n")
      .filter(
        (line: string) =>
          !line.startsWith("List") && !line.startsWith("*") && line.trim(),
      )
      .map((line: string) => line.split("\t")[0]);
  }

  async isDeviceConnected(deviceId: string): Promise<boolean> {
    const id = assertValidDeviceId(deviceId);
    const result = await this.execute(`device ${id}`);
    return result.exitCode === 0;
  }

  async getADBInfo(): Promise<{
    version: string;
    path: string;
    features: string[];
  }> {
    const result = await this.execute("version");
    const lines = result.stdout.split("\n");
    return {
      version: lines[0]?.trim() || "unknown",
      path: lines[1]?.trim() || "unknown",
      features: lines.slice(2).filter(Boolean),
    };
  }

  async listPackages(): Promise<string[]> {
    const result = await this.execute("shell pm list packages");
    return result.stdout
      .split("\n")
      .filter((line: string) => line.includes("package:"))
      .map((line: string) => line.replace("package:", "").trim());
  }

  async listThirdPartyPackages(): Promise<string[]> {
    const result = await this.execute("shell pm list packages -3");
    return result.stdout
      .split("\n")
      .filter((line: string) => line.includes("package:"))
      .map((line: string) => line.replace("package:", "").trim());
  }

  async grantPermissions(packageName: string): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    return this.execute(
      `shell pm grant ${pkg} --user 0 --all-permissions`,
      30000,
    );
  }

  async listPermissions(packageName: string): Promise<string[]> {
    const pkg = assertValidPackageName(packageName);
    const result = await this.execute(`shell pm list permissions ${pkg}`);
    return result.stdout
      .split("\n")
      .filter((line: string) => line.includes("name:"))
      .map((line: string) => line.replace("name:", "").trim());
  }

  async listActivities(packageName: string): Promise<string[]> {
    const pkg = assertValidPackageName(packageName);
    const result = await this.execute(`shell dumpsys package ${pkg}`, 15000);
    return parseActivitiesFromDump(result.stdout);
  }

  async getForegroundActivity(): Promise<{
    package: string;
    activity: string;
  }> {
    // `dumpsys activity activities` exposes the resumed component on every
    // Android version (topResumedActivity on 12+, mResumedActivity/ResumedActivity
    // on older ones). `dumpsys activity top` only lists tasks in indented
    // "TASK/ACTIVITY" blocks on some ROMs, so it is a secondary fallback.
    const result = await this.execute(
      "shell dumpsys activity activities",
      15000,
    );
    const parsed = parseForegroundActivityFromDump(result.stdout);
    if (parsed) return parsed;

    const topResult = await this.execute(
      "shell dumpsys activity top -n 1",
      10000,
    );
    const fallback = parseForegroundActivityFromDump(topResult.stdout, true);
    if (!fallback) throw new Error("Unable to parse foreground activity");
    return fallback;
  }

  async getActivitiesForPackage(packageName: string): Promise<string[]> {
    // Same implementation as listActivities; kept as an alias for the IPC API.
    return this.listActivities(packageName);
  }

  async launchActivity(
    packageName: string,
    activityName: string,
  ): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    const activity = assertValidActivityName(activityName);
    const component = resolveActivityComponent(pkg, activity);
    return this.execute(`shell am start -n ${component}`, 10000);
  }

  async listProcesses(): Promise<
    {
      user: string;
      pid: number;
      cpu: number;
      mem: number;
      rss: string;
      name: string;
    }[]
  > {
    const result = await this.execute(
      "shell ps -A -o USER,PID,%CPU,%MEM,RSS,NAME",
    );
    const processes: {
      user: string;
      pid: number;
      cpu: number;
      mem: number;
      rss: string;
      name: string;
    }[] = [];
    const lines = result.stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 6 && parts[0] !== "USER") {
        const rssKb = parseInt(parts[4], 10);
        let rssStr = parts[4] || "0";
        if (!isNaN(rssKb)) {
          if (rssKb >= 1048576) {
            rssStr = (rssKb / 1048576).toFixed(1) + " GB";
          } else if (rssKb >= 1024) {
            rssStr = (rssKb / 1024).toFixed(1) + " MB";
          } else {
            rssStr = rssKb + " KB";
          }
        }
        processes.push({
          user: parts[0],
          pid: parseInt(parts[1], 10),
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          rss: rssStr,
          name: parts.slice(5).join(" "),
        });
      }
    }
    return processes;
  }

  async forceStop(packageName: string): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    return this.execute(`shell am force-stop ${pkg}`, 10000);
  }

  async pull(remotePath: string, localPath: string): Promise<AdbResult> {
    const remote = sanitizePath(remotePath);
    const local = quoteArg(localPath);
    return this.execute(`pull ${remote} ${local}`, 60000);
  }

  async push(localPath: string, remotePath: string): Promise<AdbResult> {
    const local = quoteArg(localPath);
    const remote = sanitizePath(remotePath);
    return this.execute(`push ${local} ${remote}`, 60000);
  }

  async listDirectory(remotePath: string): Promise<AdbResult> {
    const remote = sanitizePath(remotePath);
    return this.execute(`shell ls -l ${remote}`, 30000);
  }

  async getShellCurrentDir(): Promise<AdbResult> {
    return this.execute("shell pwd", 10000);
  }

  async getHostCurrentDir(): Promise<AdbResult> {
    return this.execute("shell pwd", 10000);
  }

  async getDeviceInfo(): Promise<Record<string, string>> {
    const props = [
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
      "ro.board.platform",
    ];
    const result = await this.execute(
      `shell getprop ${props.map((p) => `[${p}]`).join(" ")}`,
    );
    const info: Record<string, string> = {};
    for (const prop of props) {
      const regex = new RegExp(`\\[${prop}\\]:\\s*\\[(.*?)\\]`);
      const match = result.stdout.match(regex);
      if (match) {
        info[prop] = match[1] || "unknown";
      }
    }
    return info;
  }

  async getScreenInfo(): Promise<{ resolution: string; density: string }> {
    const result = await this.execute("shell wm size");
    const densityResult = await this.execute("shell wm density");
    const resMatch = result.stdout.match(/Physical size:\s*(\S+)/);
    const denMatch = densityResult.stdout.match(/Physical density:\s*(\S+)/);
    return {
      resolution: resMatch?.[1] || "unknown",
      density: denMatch?.[1] || "unknown",
    };
  }

  async getBatteryInfo(): Promise<{
    level: string;
    status: string;
    temperature: string;
  }> {
    const result = await this.execute("shell dumpsys battery");
    const levelMatch = result.stdout.match(/level:\s*(\S+)/);
    const statusMatch = result.stdout.match(/status:\s*(\S+)/);
    const tempMatch = result.stdout.match(/temperature:\s*(\S+)/);
    return {
      level: levelMatch?.[1] || "unknown",
      status: statusMatch?.[1] || "unknown",
      temperature: tempMatch?.[1] || "unknown",
    };
  }

  async getStorageInfo(): Promise<
    { mount: string; total: string; used: string; free: string }[]
  > {
    const result = await this.execute("shell df /data /sdcard 2>/dev/null");
    const lines = result.stdout
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("Filesystem"));
    return lines.map((line) => {
      const parts = line.split(/\s+/);
      return {
        mount: parts[5] || "/",
        total: parts[1] || "0",
        used: parts[2] || "0",
        free: parts[3] || "0",
      };
    });
  }

  async getNetworkInfo(): Promise<{
    wifiSsid: string;
    ipAddress: string;
  }> {
    const ssidResult = await this.execute(
      "shell dumpsys wifi | grep 'mWifiInfo'",
    );
    const ipResult = await this.execute("shell ip route show table 0");
    const ssidMatch = ssidResult.stdout.match(/SSID:\s*"([^"]+)"/);
    const ipMatch = ipResult.stdout.match(/src\s+(\S+)/);
    return {
      wifiSsid: ssidMatch?.[1] || "not connected",
      ipAddress: ipMatch?.[1] || "unknown",
    };
  }

  async screenshot(localPath: string): Promise<AdbResult> {
    const remotePath = "/sdcard/screenshot_tmp.png";
    const result = await this.execute(`shell screencap -p ${remotePath}`);
    if (result.exitCode !== 0) return result;
    const pullResult = await this.pull(remotePath, localPath);
    await this.execute(`shell rm ${remotePath}`);
    return pullResult;
  }

  async screenrecord(
    localPath: string,
    timeLimit: number = 10,
  ): Promise<AdbResult> {
    const remotePath = "/sdcard/record_tmp.mp4";
    const recordResult = await this.execute(
      `shell screenrecord --time-limit ${timeLimit} ${remotePath}`,
      (timeLimit + 5) * 1000,
    );
    if (recordResult.exitCode !== 0) return recordResult;
    const pullResult = await this.pull(remotePath, localPath);
    await this.execute(`shell rm ${remotePath}`);
    return pullResult;
  }

  async executeBatch(
    commands: Array<{ cmd: string; label: string }>,
  ): Promise<{ success: boolean; results: AdbResult[] }> {
    const results: AdbResult[] = [];
    for (const cmd of commands) {
      const result = await this.execute(cmd.cmd);
      results.push(result);
    }
    return { success: true, results };
  }

  async getAppInfo(packageName: string): Promise<{
    version: string;
    targetSdk: string;
    size: string;
    installDate: string;
    label: string;
  }> {
    const pkg = assertValidPackageName(packageName);
    const dumpResult = await this.execute(
      `shell dumpsys package ${pkg}`,
      15000,
    );
    const stdout = dumpResult.stdout;

    const versionMatch = stdout.match(/versionName=(\S+)/);
    const targetSdkMatch = stdout.match(/targetSdk=(\S+)/);
    const firstInstallMatch = stdout.match(/firstInstallTime=(.+)/);

    const pathResult = await this.execute(`shell pm path ${pkg}`, 10000);
    let size = "unknown";
    const apkPath = pathResult.stdout
      .split("\n")
      .find((l: string) => l.startsWith("package:"))
      ?.replace("package:", "")
      ?.trim();
    if (apkPath) {
      const sizeResult = await this.execute(
        `shell stat -c %s ${sanitizePath(apkPath)}`,
        10000,
      );
      const sizeBytes = parseInt(sizeResult.stdout.trim(), 10);
      if (!isNaN(sizeBytes)) {
        if (sizeBytes >= 1048576) {
          size = (sizeBytes / 1048576).toFixed(1) + " MB";
        } else if (sizeBytes >= 1024) {
          size = (sizeBytes / 1024).toFixed(1) + " KB";
        } else {
          size = sizeBytes + " B";
        }
      }
    }

    let label = pkg;
    try {
      const labelResult = await this.execute(`shell pm dump ${pkg}`, 15000);
      const labelMatch =
        labelResult.stdout.match(/application-label[^:]*:"([^"]+)"/i) ||
        labelResult.stdout.match(/label[^:]*:"([^"]+)"/i);
      if (labelMatch && labelMatch[1]) {
        label = labelMatch[1];
      }
    } catch {
      // ignore
    }

    return {
      version: versionMatch?.[1] || "unknown",
      targetSdk: targetSdkMatch?.[1] || "unknown",
      size,
      installDate: firstInstallMatch?.[1]?.trim() || "unknown",
      label,
    };
  }

  async clearAppData(packageName: string): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    return this.execute(`shell pm clear ${pkg}`, 30000);
  }

  async uninstallApp(packageName: string): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    return this.execute(`shell pm uninstall ${pkg}`, 60000);
  }

  async toggleApp(packageName: string, enable: boolean): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    const cmd = enable ? "enable" : "disable";
    return this.execute(`shell pm ${cmd} ${pkg}`, 15000);
  }

  async exportApk(packageName: string, localPath: string): Promise<AdbResult> {
    const pkg = assertValidPackageName(packageName);
    const pathResult = await this.execute(`shell pm path ${pkg}`, 10000);
    const apkPath = pathResult.stdout
      .split("\n")
      .find((l: string) => l.startsWith("package:"))
      ?.replace("package:", "")
      ?.trim();
    if (!apkPath) {
      return {
        stdout: "",
        stderr: "APK path not found",
        exitCode: 1,
      };
    }
    return this.pull(apkPath, localPath);
  }

  async pair(target: string, pairingCode: string): Promise<AdbResult> {
    // Wireless pairing target ("192.168.1.5:37123") and a numeric code both
    // come straight from user input.
    if (!/^[A-Za-z0-9._-]+:\d{1,5}$/.test(target)) {
      throw new Error("Invalid pairing target (expected host:port)");
    }
    if (!/^\d{1,10}$/.test(pairingCode)) {
      throw new Error("Invalid pairing code");
    }
    return this.execute(`pair ${target} ${pairingCode}`, 30000);
  }
}

export const adbService = new AdbService();
