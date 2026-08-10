let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("adb", {
	execute(cmd) {
		return electron.ipcRenderer.invoke("adb:execute", cmd);
	},
	listDevices() {
		return electron.ipcRenderer.invoke("adb:list-devices");
	},
	isDeviceConnected(deviceId) {
		return electron.ipcRenderer.invoke("adb:is-device-connected", deviceId);
	},
	getADBInfo() {
		return electron.ipcRenderer.invoke("adb:get-info");
	},
	executeWithDevice(cmd, deviceId) {
		return electron.ipcRenderer.invoke("adb:execute-device", {
			cmd,
			deviceId
		});
	}
});
//#endregion
