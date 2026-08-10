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
});
