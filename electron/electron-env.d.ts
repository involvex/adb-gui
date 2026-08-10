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
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
    listDevices(): Promise<string[]>;
    isDeviceConnected(deviceId: string): Promise<boolean>;
    getADBInfo(): Promise<{
      version: string;
      path: string;
      features: string[];
    }>;
    executeWithDevice(
      cmd: string,
      deviceId?: string,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };
}
