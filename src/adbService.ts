const adb = window.adb;

export interface AdbResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function execute(cmd: string): Promise<AdbResult> {
  return adb.execute(cmd);
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

async function isDeviceConnected(deviceId: string): Promise<boolean> {
  try {
    await adb.execute(`device ${deviceId}`);
    return true;
  } catch {
    return false;
  }
}

async function getADBInfo(): Promise<{
  version: string;
  path: string;
  features: string[];
}> {
  const result = await adb.execute("version");
  const lines = result.stdout.split("\n");
  return {
    version: lines[0]?.trim() || "unknown",
    path: lines[1]?.trim() || "unknown",
    features: lines.slice(2).filter(Boolean),
  };
}

async function listPackages(): Promise<string[]> {
  const result = await adb.execute("pm list packages");
  return result.stdout
    .split("\n")
    .filter((line: string) => line.includes("package:"))
    .map((line: string) => line.replace("package:", "").trim());
}

async function listThirdPartyPackages(): Promise<string[]> {
  const result = await adb.execute("pm list packages -3");
  return result.stdout
    .split("\n")
    .filter((line: string) => line.includes("package:"))
    .map((line: string) => line.replace("package:", "").trim());
}

async function grantPermissions(packageName: string): Promise<AdbResult> {
  return adb.execute(`pm grant ${packageName} --user 0 --all-permissions`);
}

async function listPermissions(packageName: string): Promise<string[]> {
  const result = await adb.execute(`pm list permissions ${packageName}`);
  return result.stdout
    .split("\n")
    .filter((line: string) => line.includes("name:"))
    .map((line: string) => line.replace("name:", "").trim());
}

async function listProcesses(): Promise<
  { user: string; pid: number; name: string }[]
> {
  const result = await adb.execute("shell ps -A -o USER,PID,NAME");
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
  return adb.execute(`shell am force-stop ${packageName}`);
}

async function pull(remotePath: string, localPath: string): Promise<AdbResult> {
  return adb.execute(`pull ${remotePath} ${localPath}`);
}

async function push(localPath: string, remotePath: string): Promise<AdbResult> {
  return adb.execute(`push ${localPath} ${remotePath}`);
}

async function listDirectory(remotePath: string): Promise<AdbResult> {
  return adb.execute(`shell ls -l ${remotePath}`);
}

async function getShellCurrentDir(): Promise<AdbResult> {
  return adb.execute("shell pwd");
}

async function getHostCurrentDir(): Promise<AdbResult> {
  return adb.execute("pwd");
}

export const adbService = {
  execute,
  getConnectedDevices,
  isDeviceConnected,
  getADBInfo,
  listPackages,
  listThirdPartyPackages,
  grantPermissions,
  listPermissions,
  listProcesses,
  forceStop,
  pull,
  push,
  listDirectory,
  getShellCurrentDir,
  getHostCurrentDir,
};

export default adbService;
