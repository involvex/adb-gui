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
  pushFile(
    remotePath: string,
    deviceId?: string,
  ): Promise<{
    success: boolean;
    pushedFiles?: string[];
    error?: string;
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
    success?: boolean;
    results?: { file: string; exitCode: number; stderr: string }[];
    installedFiles?: string[];
    failedFiles?: { file: string; error: string }[];
    error?: string;
  }>;
  openFolder(folderPath: string): Promise<{ success: boolean; error?: string }>;
  getDeviceInfo(deviceId?: string): Promise<{
    device: Record<string, string>;
    screen: { resolution: string; density: string };
    battery: { level: string; status: string; temperature: string };
    storage: { mount: string; total: string; used: string; free: string }[];
    network: { wifiSsid: string; ipAddress: string };
  }>;
  screenshot(deviceId?: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }>;
  screenrecord(
    timeLimit?: number,
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }>;
  backupApps(
    packages: string[],
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }>;
  getAppInfo(
    packageName: string,
    deviceId?: string,
  ): Promise<{
    version: string;
    targetSdk: string;
    size: string;
    installDate: string;
    label: string;
  }>;
  clearAppData(
    packageName: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  uninstallApp(
    packageName: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  toggleApp(
    packageName: string,
    enable: boolean,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  exportApk(
    packageName: string,
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }>;
  exportLogcat(lines: string): Promise<{
    success: boolean;
    error?: string;
    localPath?: string;
  }>;
  pair(
    target: string,
    pairingCode: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
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
  {
    user: string;
    pid: number;
    cpu: number;
    mem: number;
    rss: string;
    name: string;
  }[]
> {
  const result = await execute("shell ps -A -o USER,PID,%CPU,%MEM,RSS,NAME");
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

async function pushFile(remotePath: string): Promise<{
  success: boolean;
  pushedFiles?: string[];
  error?: string;
}> {
  return adb.pushFile(remotePath, currentDeviceId ?? undefined);
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

async function openFolder(
  folderPath: string,
): Promise<{ success: boolean; error?: string }> {
  return adb.openFolder(folderPath);
}

async function getDeviceInfo(): Promise<{
  device: Record<string, string>;
  screen: { resolution: string; density: string };
  battery: { level: string; status: string; temperature: string };
  storage: { mount: string; total: string; used: string; free: string }[];
  network: { wifiSsid: string; ipAddress: string };
}> {
  return adb.getDeviceInfo(currentDeviceId ?? undefined);
}

async function screenshot(): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  localPath?: string;
}> {
  return adb.screenshot(currentDeviceId ?? undefined);
}

async function screenrecord(timeLimit?: number): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  localPath?: string;
}> {
  return adb.screenrecord(timeLimit, currentDeviceId ?? undefined);
}

async function installApk(): Promise<{
  success?: boolean;
  results?: { file: string; exitCode: number; stderr: string }[];
  installedFiles?: string[];
  failedFiles?: { file: string; error: string }[];
  error?: string;
}> {
  return adb.installApk(currentDeviceId ?? undefined);
}

async function backupApps(packages: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  localPath?: string;
}> {
  return adb.backupApps(packages, currentDeviceId ?? undefined);
}

async function getAppInfo(packageName: string): Promise<{
  version: string;
  targetSdk: string;
  size: string;
  installDate: string;
  label: string;
}> {
  return adb.getAppInfo(packageName, currentDeviceId ?? undefined);
}

async function clearAppData(packageName: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return adb.clearAppData(packageName, currentDeviceId ?? undefined);
}

async function uninstallApp(packageName: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return adb.uninstallApp(packageName, currentDeviceId ?? undefined);
}

async function toggleApp(
  packageName: string,
  enable: boolean,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return adb.toggleApp(packageName, enable, currentDeviceId ?? undefined);
}

async function exportApk(packageName: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  localPath?: string;
}> {
  return adb.exportApk(packageName, currentDeviceId ?? undefined);
}

async function exportLogcat(lines: string): Promise<{
  success: boolean;
  error?: string;
  localPath?: string;
}> {
  return adb.exportLogcat(lines);
}

async function pair(
  target: string,
  pairingCode: string,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}> {
  return adb.pair(target, pairingCode);
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
  pushFile,
  startLogcat,
  stopLogcat,
  onLogcatLine,
  openFolder,
  getDeviceInfo,
  screenshot,
  screenrecord,
  installApk,
  backupApps,
  getAppInfo,
  clearAppData,
  uninstallApp,
  toggleApp,
  exportApk,
  exportLogcat,
  pair,
};

export default adbService;
