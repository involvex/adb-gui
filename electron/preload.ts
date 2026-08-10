import { ipcRenderer, contextBridge } from "electron";

contextBridge.exposeInMainWorld("adb", {
  execute(
    cmd: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return ipcRenderer.invoke("adb:execute", cmd);
  },

  listDevices(): Promise<string[]> {
    return ipcRenderer.invoke("adb:list-devices");
  },

  isDeviceConnected(deviceId: string): Promise<boolean> {
    return ipcRenderer.invoke("adb:is-device-connected", deviceId);
  },

  getADBInfo(): Promise<{ version: string; path: string; features: string[] }> {
    return ipcRenderer.invoke("adb:get-info");
  },

  executeWithDevice(
    cmd: string,
    deviceId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return ipcRenderer.invoke("adb:execute-device", { cmd, deviceId });
  },
});
