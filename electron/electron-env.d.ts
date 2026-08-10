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
}
