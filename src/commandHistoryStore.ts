export const COMMAND_HISTORY_KEY = "adb-gui-command-history";
export const MAX_HISTORY = 50;

export function loadCommandHistory(): string[] {
  try {
    const raw = localStorage.getItem(COMMAND_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        return parsed
          .filter((h): h is string => typeof h === "string")
          .slice(0, MAX_HISTORY);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveCommandHistory(history: string[]): void {
  try {
    localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}
