import { ipcRenderer, contextBridge } from "electron";

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
});
