export interface AppSettings {
  adbPath: string;
  defaultBuffer: string;
  defaultPriority: string;
  autoScrollLogcat: boolean;
  theme: "dark" | "light";
  highContrast: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  adbPath: "adb",
  defaultBuffer: "main",
  defaultPriority: "I",
  autoScrollLogcat: true,
  theme: "dark",
  highContrast: false,
};

const SETTINGS_KEY = "adb-gui-app-settings";

export const settingsStore = {
  get(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  },
  save(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  },
  reset(): AppSettings {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  },
};
