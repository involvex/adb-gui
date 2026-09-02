import { ipcRenderer, contextBridge } from "electron";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: string;
  perms: string;
  owner: string;
  group: string;
  date: string;
}

contextBridge.exposeInMainWorld("adb", {
  execute(
    cmd: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return ipcRenderer.invoke("adb:execute", { cmd, deviceId });
  },

  listDevices(): Promise<string[]> {
    return ipcRenderer.invoke("adb:list-devices");
  },

  listFileEntries(
    remotePath: string,
    deviceId?: string,
  ): Promise<{ error: string | null; entries: FileEntry[] }> {
    return ipcRenderer.invoke("adb:list-file-entries", {
      remotePath,
      deviceId,
    });
  },

  pullFile(
    remotePath: string,
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }> {
    return ipcRenderer.invoke("adb:pull-file", { remotePath, deviceId });
  },

  pushFile(
    remotePath: string,
    deviceId?: string,
  ): Promise<{
    success: boolean;
    pushedFiles?: string[];
    error?: string;
  }> {
    return ipcRenderer.invoke("adb:push-file", { remotePath, deviceId });
  },

  startLogcat(filters: {
    priority?: string;
    buffer?: string;
    tags?: string;
    pid?: string;
    deviceId?: string;
  }): Promise<{ success: boolean }> {
    return ipcRenderer.invoke("adb:logcat-start", filters);
  },

  stopLogcat(): Promise<{ success: boolean }> {
    return ipcRenderer.invoke("adb:logcat-stop");
  },

  onLogcatLine(callback: (line: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, line: string) =>
      callback(line);
    ipcRenderer.on("adb:logcat-line", listener);
    return () => {
      ipcRenderer.removeListener("adb:logcat-line", listener);
    };
  },

  installApk(deviceId?: string): Promise<{
    success?: boolean;
    results?: { file: string; exitCode: number; stderr: string }[];
    installedFiles?: string[];
    failedFiles?: { file: string; error: string }[];
    error?: string;
  }> {
    return ipcRenderer.invoke("adb:install-apk", { deviceId });
  },

  openFolder(
    folderPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("adb:open-folder", { folderPath });
  },

  getDeviceInfo(deviceId?: string): Promise<{
    device: Record<string, string>;
    screen: { resolution: string; density: string };
    battery: { level: string; status: string; temperature: string };
    storage: { mount: string; total: string; used: string; free: string }[];
    network: { wifiSsid: string; ipAddress: string };
  }> {
    return ipcRenderer.invoke("adb:device-info", { deviceId });
  },

  screenshot(deviceId?: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }> {
    return ipcRenderer.invoke("adb:screenshot", { deviceId });
  },

  screenrecord(
    timeLimit?: number,
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }> {
    return ipcRenderer.invoke("adb:screenrecord", { timeLimit, deviceId });
  },

  backupApps(
    packages: string[],
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }> {
    return ipcRenderer.invoke("adb:backup-apps", { packages, deviceId });
  },

  getAppInfo(
    packageName: string,
    deviceId?: string,
  ): Promise<{
    version: string;
    targetSdk: string;
    size: string;
    installDate: string;
    label: string;
  }> {
    return ipcRenderer.invoke("adb:get-app-info", { packageName, deviceId });
  },

  clearAppData(
    packageName: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return ipcRenderer.invoke("adb:clear-app-data", { packageName, deviceId });
  },

  uninstallApp(
    packageName: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return ipcRenderer.invoke("adb:uninstall-app", { packageName, deviceId });
  },

  toggleApp(
    packageName: string,
    enable: boolean,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return ipcRenderer.invoke("adb:toggle-app", {
      packageName,
      enable,
      deviceId,
    });
  },

  exportApk(
    packageName: string,
    deviceId?: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    localPath?: string;
  }> {
    return ipcRenderer.invoke("adb:export-apk", { packageName, deviceId });
  },

  exportLogcat(lines: string): Promise<{
    success: boolean;
    error?: string;
    localPath?: string;
  }> {
    return ipcRenderer.invoke("adb:export-logcat", { lines });
  },
});
