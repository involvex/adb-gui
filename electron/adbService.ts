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
    { user: string; pid: number; name: string }[]
  > {
    const result = await this.execute("shell ps -A -o USER,PID,NAME");
    const processes: { user: string; pid: number; name: string }[] = [];
    const lines = result.stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3 && parts[0] !== "USER") {
        processes.push({
          user: parts[0],
          pid: parseInt(parts[1], 10),
          name: parts.slice(2).join(" "),
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
}

export const adbService = new AdbService();
