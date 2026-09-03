interface WindowControlApi {
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  saveWindowSettings: (settings: {
    minimizeToTray: boolean;
    globalHotkey: string;
  }) => Promise<{ success: boolean }>;
}

const windowControl = window.windowControl as WindowControlApi;

export interface WindowSettings {
  minimizeToTray: boolean;
  globalHotkey: string;
}

export async function showWindow(): Promise<void> {
  return windowControl.showWindow();
}

export async function hideWindow(): Promise<void> {
  return windowControl.hideWindow();
}

export async function saveWindowSettings(settings: {
  minimizeToTray: boolean;
  globalHotkey: string;
}): Promise<{ success: boolean }> {
  return windowControl.saveWindowSettings(settings);
}

export const windowControlService = {
  showWindow,
  hideWindow,
  saveWindowSettings,
};

export default windowControlService;
