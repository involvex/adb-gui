export interface QuickCommand {
  id: string;
  title: string;
  command: string;
  description: string;
  icon: string;
}

const DEFAULT_COMMANDS: QuickCommand[] = [
  {
    id: "list-packages",
    title: "List Packages",
    command: "pm list packages",
    description: "List all installed packages",
    icon: "📦",
  },
  {
    id: "list-perms",
    title: "List Permissions",
    command: "pm list permissions",
    description: "List all permissions for a package",
    icon: "🔐",
  },
  {
    id: "grant-perm",
    title: "Grant Permission",
    command: "pm grant <package> --user 0 --all-permissions",
    description: "Grant all permissions to a package",
    icon: "✅",
  },
  {
    id: "force-stop",
    title: "Force Stop",
    command: "shell am force-stop <package>",
    description: "Force stop an app",
    icon: "⛔",
  },
  {
    id: "pull-file",
    title: "Pull File",
    command: "pull <remote-path> <local-path>",
    description: "Pull file from device to local",
    icon: "📥",
  },
  {
    id: "push-file",
    title: "Push File",
    command: "push <local-path> <remote-path>",
    description: "Push file from local to device",
    icon: "📤",
  },
  {
    id: "list-files",
    title: "List Files",
    command: "shell ls -l <remote-path>",
    description: "List files in a directory on device",
    icon: "📁",
  },
  {
    id: "device-info",
    title: "Device Info",
    command: "shell getprop",
    description: "Get device properties",
    icon: "ℹ️",
  },
  {
    id: "reboot",
    title: "Reboot Device",
    command: "reboot",
    description: "Reboot the connected device",
    icon: "🔄",
  },
];

const STORAGE_KEY = "adb-gui-quick-commands";

function loadCommands(): QuickCommand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuickCommand[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_COMMANDS;
}

function saveCommands(commands: QuickCommand[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
  } catch {
    // ignore
  }
}

export const quickCommandsStore = {
  getAll(): QuickCommand[] {
    return loadCommands();
  },
  add(command: QuickCommand): QuickCommand[] {
    const commands = loadCommands();
    commands.push(command);
    saveCommands(commands);
    return commands;
  },
  remove(id: string): QuickCommand[] {
    const commands = loadCommands().filter((c) => c.id !== id);
    saveCommands(commands);
    return commands;
  },
  update(updated: QuickCommand): QuickCommand[] {
    const commands = loadCommands().map((c) =>
      c.id === updated.id ? updated : c,
    );
    saveCommands(commands);
    return commands;
  },
  reset(): QuickCommand[] {
    saveCommands(DEFAULT_COMMANDS);
    return DEFAULT_COMMANDS;
  },
};
