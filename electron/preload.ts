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
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    apkPath?: string;
  }> {
    return ipcRenderer.invoke("adb:install-apk", { deviceId });
  },

  openFolder(
    folderPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("adb:open-folder", { folderPath });
  },
});
