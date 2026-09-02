import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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
      return `adb -s ${this.deviceId} ${cmd}`;
    }
    return `adb ${cmd}`;
  }

  async execute(cmd: string, timeout: number = 10000): Promise<AdbResult> {
    const fullCmd = this.resolveCommand(cmd);
    const safeCmd = fullCmd.replace(/[&|<>$`]/g, "\\$&");
    try {
      const { stdout, stderr } = await execAsync(safeCmd, { timeout });
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
    const result = await this.execute(`device ${deviceId}`);
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
    return this.execute(
      `shell pm grant ${packageName} --user 0 --all-permissions`,
      30000,
    );
  }

  async listPermissions(packageName: string): Promise<string[]> {
    const result = await this.execute(
      `shell pm list permissions ${packageName}`,
    );
    return result.stdout
      .split("\n")
      .filter((line: string) => line.includes("name:"))
      .map((line: string) => line.replace("name:", "").trim());
  }

  async listActivities(packageName: string): Promise<string[]> {
    const result = await this.execute(
      `shell dumpsys package ${packageName}`,
      15000,
    );
    const activityRe = /^\s+[0-9a-f]+\s+(\S+)\s+filter\s+[0-9a-f]+/gm;
    const activities = new Set<string>();
    const matches = result.stdout.matchAll(activityRe);
    for (const m of matches) {
      const component = m[1];
      if (!component) continue;
      const idx = component.indexOf("/");
      if (idx !== -1) {
        activities.add(component.slice(idx + 1));
      }
    }
    return [...activities].sort();
  }

  async launchActivity(
    packageName: string,
    activityName: string,
  ): Promise<AdbResult> {
    const activity = activityName.startsWith(".")
      ? activityName
      : activityName.replace(packageName, "");
    return this.execute(`shell am start -n ${packageName}/${activity}`, 10000);
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
    return this.execute(`shell am force-stop ${packageName}`, 10000);
  }

  async pull(remotePath: string, localPath: string): Promise<AdbResult> {
    return this.execute(`pull ${remotePath} ${localPath}`, 60000);
  }

  async push(localPath: string, remotePath: string): Promise<AdbResult> {
    return this.execute(`push ${localPath} ${remotePath}`, 60000);
  }

  async listDirectory(remotePath: string): Promise<AdbResult> {
    return this.execute(`shell ls -l ${remotePath}`, 30000);
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
    const dumpResult = await this.execute(
      `shell dumpsys package ${packageName}`,
      15000,
    );
    const stdout = dumpResult.stdout;

    const versionMatch = stdout.match(/versionName=(\S+)/);
    const targetSdkMatch = stdout.match(/targetSdk=(\S+)/);
    const firstInstallMatch = stdout.match(/firstInstallTime=(.+)/);

    const pathResult = await this.execute(
      `shell pm path ${packageName}`,
      10000,
    );
    let size = "unknown";
    const apkPath = pathResult.stdout
      .split("\n")
      .find((l: string) => l.startsWith("package:"))
      ?.replace("package:", "")
      ?.trim();
    if (apkPath) {
      const sizeResult = await this.execute(
        `shell stat -c %s ${apkPath}`,
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

    const labelResult = await this.execute(
      `shell pm dump ${packageName} | grep -m1 "application-label:"`,
    );
    const labelMatch = labelResult.stdout.match(/application-label:"([^"]+)"/);

    return {
      version: versionMatch?.[1] || "unknown",
      targetSdk: targetSdkMatch?.[1] || "unknown",
      size,
      installDate: firstInstallMatch?.[1]?.trim() || "unknown",
      label: labelMatch?.[1] || packageName,
    };
  }

  async clearAppData(packageName: string): Promise<AdbResult> {
    return this.execute(`shell pm clear ${packageName}`, 30000);
  }

  async uninstallApp(packageName: string): Promise<AdbResult> {
    return this.execute(`shell pm uninstall ${packageName}`, 60000);
  }

  async toggleApp(packageName: string, enable: boolean): Promise<AdbResult> {
    const cmd = enable ? "enable" : "disable";
    return this.execute(`shell pm ${cmd} ${packageName}`, 15000);
  }

  async exportApk(packageName: string, localPath: string): Promise<AdbResult> {
    const pathResult = await this.execute(
      `shell pm path ${packageName}`,
      10000,
    );
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
    return this.execute(`pair ${target} ${pairingCode}`, 30000);
  }
}

export const adbService = new AdbService();
