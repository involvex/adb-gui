/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  adb: {
    execute(
      cmd: string,
      deviceId?: string,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
    listDevices(): Promise<string[]>;
  };
  windowControl: {
    showWindow: () => Promise<void>;
    hideWindow: () => Promise<void>;
    saveWindowSettings: (settings: {
      minimizeToTray: boolean;
      globalHotkey: string;
    }) => Promise<{ success: boolean }>;
  };
}
