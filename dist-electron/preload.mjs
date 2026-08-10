let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("adb", {
	execute(cmd, deviceId) {
		return electron.ipcRenderer.invoke("adb:execute", {
			cmd,
			deviceId
		});
	},
	listDevices() {
		return electron.ipcRenderer.invoke("adb:list-devices");
	}
});
//#endregion
