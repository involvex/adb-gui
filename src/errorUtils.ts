const ADB_ERROR_MAP: Record<string, string> = {
  "no devices found":
    "No device connected. Check USB connection and enable USB debugging.",
  "device not found": "Device disconnected. Check USB cable.",
  "device unauthorized":
    "Device unauthorized. Accept the USB debugging prompt on your device.",
  "no such file or directory": "File or directory not found on device.",
  "permission denied":
    "Permission denied. Some operations may require root access.",
  "cannot stat": "Cannot access file. Check the path and permissions.",
  INSTALL_FAILED_ALREADY_EXISTS: "App already exists. Use reinstall (-r) flag.",
  INSTALL_FAILED_INSUFFICIENT_STORAGE: "Not enough storage space on device.",
  INSTALL_FAILED_INVALID_APK: "Invalid APK file.",
  INSTALL_FAILED_VERSION_DOWNGRADE: "Version downgrade not allowed.",
  "Failure [INSTALL_FAILED_": "Installation failed. Check APK compatibility.",
  "error: closed": "Device connection lost. Reconnect and try again.",
  "unable to connect":
    "Cannot connect to device. Check USB debugging is enabled.",
  "more than one device":
    "Multiple devices connected. Select a specific device.",
  "no emulator/sdcard": "No SD card or emulator storage found.",
};

export function parseAdbError(stderr: string, fallback?: string): string {
  if (!stderr) return fallback || "Unknown error";

  const lower = stderr.toLowerCase();

  for (const [pattern, message] of Object.entries(ADB_ERROR_MAP)) {
    if (lower.includes(pattern.toLowerCase())) {
      return message;
    }
  }

  const firstLine = stderr.split("\n")[0]?.trim();
  if (firstLine && firstLine.length < 200) {
    return firstLine;
  }

  return fallback || "An error occurred";
}

export function isConnectionError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("no devices") ||
    lower.includes("device not found") ||
    lower.includes("device offline") ||
    lower.includes("connection lost") ||
    lower.includes("error: closed") ||
    lower.includes("unable to connect")
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delay?: number; backoff?: number } = {},
): Promise<T> {
  const { attempts = 2, delay = 1000, backoff = 1500 } = options;
  let lastError: Error | undefined;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < attempts - 1 && isConnectionError(lastError.message)) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay + backoff * i),
        );
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}
