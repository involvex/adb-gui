interface FileEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: string;
  perms: string;
  owner: string;
  group: string;
  date: string;
}

interface AdbWindow {
  execute(
    cmd: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  listDevices(): Promise<string[]>;
  listFileEntries(
    remotePath: string,
    deviceId?: string,
  ): Promise<{ error: string | null; entries: FileEntry[] }>;
  pullFile(
    remotePath: string,
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }>;
  startLogcat(filters: {
    priority?: string;
    buffer?: string;
    tags?: string;
    pid?: string;
    deviceId?: string;
  }): Promise<{ success: boolean }>;
  stopLogcat(): Promise<{ success: boolean }>;
  onLogcatLine(callback: (line: string) => void): () => void;
  installApk(deviceId?: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    apkPath?: string;
  }>;
}

const adb = window.adb as AdbWindow;

export interface AdbResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

let currentDeviceId: string | null = null;

export function setDeviceId(id: string | null): void {
  currentDeviceId = id;
}

export function getDeviceId(): string | null {
  return currentDeviceId;
}

async function execute(cmd: string): Promise<AdbResult> {
  return adb.execute(cmd, currentDeviceId ?? undefined);
}

async function getConnectedDevices(): Promise<string[]> {
  const result = await adb.execute("devices");
  return result.stdout
    .split("\n")
    .filter(
      (line: string) =>
        !line.startsWith("List") && !line.startsWith("*") && line.trim(),
    )
    .map((line: string) => line.split("\t")[0]);
}

async function getADBInfo(): Promise<{
  version: string;
  path: string;
  features: string[];
}> {
  const result = await execute("version");
  const lines = result.stdout.split("\n");
  return {
    version: lines[0]?.trim() || "unknown",
    path: lines[1]?.trim() || "unknown",
    features: lines.slice(2).filter(Boolean),
  };
}

async function listPackages(): Promise<string[]> {
  const result = await execute("shell pm list packages");
  return result.stdout
    .split("\n")
    .filter((line: string) => line.includes("package:"))
    .map((line: string) => line.replace("package:", "").trim());
}

async function listThirdPartyPackages(): Promise<string[]> {
  const result = await execute("shell pm list packages -3");
  return result.stdout
    .split("\n")
    .filter((line: string) => line.includes("package:"))
    .map((line: string) => line.replace("package:", "").trim());
}

async function grantPermissions(packageName: string): Promise<AdbResult> {
  return execute(`shell pm grant ${packageName} --user 0 --all-permissions`);
}

async function listPermissions(packageName: string): Promise<string[]> {
  const result = await execute(`shell pm list permissions ${packageName}`);
  return result.stdout
    .split("\n")
    .filter((line: string) => line.includes("name:"))
    .map((line: string) => line.replace("name:", "").trim());
}

async function listActivities(packageName: string): Promise<string[]> {
  const result = await execute(`shell dumpsys package ${packageName}`);
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

async function launchActivity(
  packageName: string,
  activityName: string,
): Promise<AdbResult> {
  const activity = activityName.startsWith(".")
    ? activityName
    : activityName.replace(packageName, "");
  return execute(`shell am start -n ${packageName}/${activity}`);
}

async function listProcesses(): Promise<
  { user: string; pid: number; name: string }[]
> {
  const result = await execute("shell ps -A -o USER,PID,NAME");
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

async function forceStop(packageName: string): Promise<AdbResult> {
  return execute(`shell am force-stop ${packageName}`);
}

async function pull(remotePath: string, localPath: string): Promise<AdbResult> {
  return execute(`pull ${remotePath} ${localPath}`);
}

async function push(localPath: string, remotePath: string): Promise<AdbResult> {
  return execute(`push ${localPath} ${remotePath}`);
}

async function listDirectory(remotePath: string): Promise<AdbResult> {
  return execute(`shell ls -l ${remotePath}`);
}

async function getShellCurrentDir(): Promise<AdbResult> {
  return execute("shell pwd");
}

async function getHostCurrentDir(): Promise<AdbResult> {
  return execute("shell pwd");
}

async function listFileEntries(
  remotePath: string,
): Promise<{ error: string | null; entries: FileEntry[] }> {
  return adb.listFileEntries(remotePath, currentDeviceId ?? undefined);
}

async function pullFile(remotePath: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  localPath?: string;
}> {
  return adb.pullFile(remotePath, currentDeviceId ?? undefined);
}

async function startLogcat(filters: {
  priority?: string;
  buffer?: string;
  tags?: string;
  pid?: string;
}): Promise<{ success: boolean }> {
  return adb.startLogcat({
    ...filters,
    deviceId: currentDeviceId ?? undefined,
  });
}

async function stopLogcat(): Promise<{ success: boolean }> {
  return adb.stopLogcat();
}

function onLogcatLine(callback: (line: string) => void): () => void {
  return adb.onLogcatLine(callback);
}

async function installApk(): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  apkPath?: string;
}> {
  return adb.installApk(currentDeviceId ?? undefined);
}

export const adbService = {
  execute,
  getConnectedDevices,
  getADBInfo,
  listPackages,
  listThirdPartyPackages,
  grantPermissions,
  listPermissions,
  listActivities,
  launchActivity,
  listProcesses,
  forceStop,
  pull,
  push,
  listDirectory,
  getShellCurrentDir,
  getHostCurrentDir,
  listFileEntries,
  pullFile,
  startLogcat,
  stopLogcat,
  onLogcatLine,
  installApk,
};

export default adbService;
