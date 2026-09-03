interface WindowControlApi {
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  saveWindowSettings: (settings: {
    minimizeToTray: boolean;
    globalHotkey: string;
  }) => Promise<{ success: boolean }>;
  navigateSection: (section: string) => Promise<{ success: boolean }>;
  onNavigateSection: (callback: (section: string) => void) => () => void;
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

export async function navigateSection(
  section: string,
): Promise<{ success: boolean }> {
  return windowControl.navigateSection(section);
}

export function onNavigateSection(
  callback: (section: string) => void,
): () => void {
  return windowControl.onNavigateSection(callback);
}

export const windowControlService = {
  showWindow,
  hideWindow,
  saveWindowSettings,
  navigateSection,
  onNavigateSection,
};

export default windowControlService;
