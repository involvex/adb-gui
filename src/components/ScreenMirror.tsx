import { useState, useCallback, useRef } from "react";
import { adbService } from "../adbService";

interface MirrorState {
  running: boolean;
  error: string | null;
  info: string | null;
}

const ScreenMirror: React.FC = () => {
  const [state, setState] = useState<MirrorState>({
    running: false,
    error: null,
    info: null,
  });
  const [bitrate, setBitrate] = useState(8);
  const [maxSize, setMaxSize] = useState(1024);
  const [fps, setFps] = useState(30);
  const [showControls, setShowControls] = useState(true);
  const processRef = useRef<ReturnType<typeof adbService.execute> | null>(null);

  const startMirror = useCallback(async () => {
    setState({ running: true, error: null, info: "Starting scrcpy..." });

    try {
      const args = [
        "--no-control",
        "--bit-rate",
        `${bitrate}M`,
        "--max-size",
        `${maxSize}`,
        "--max-fps",
        `${fps}`,
        showControls ? "" : "--no-playback",
      ]
        .filter(Boolean)
        .join(" ");

      const result = await adbService.execute(`exec-out scrcpy ${args}`);

      if (result.exitCode !== 0) {
        const fallbackResult = await adbService.execute(
          "exec-out scrcpy --version",
        );

        if (
          fallbackResult.exitCode !== 0 &&
          (result.stderr.includes("not found") ||
            result.stderr.includes("No such file"))
        ) {
          setState({
            running: false,
            error:
              "scrcpy not found. Install it from https://github.com/Genymobile/scrcpy",
            info: null,
          });
          return;
        }
      }

      setState({
        running: true,
        error: null,
        info: `Screen mirroring active (${bitrate}Mbps, ${maxSize}px, ${fps}fps)`,
      });
    } catch (err) {
      setState({
        running: false,
        error: err instanceof Error ? err.message : "Failed to start mirroring",
        info: null,
      });
    }
  }, [bitrate, maxSize, fps, showControls]);

  const stopMirror = useCallback(() => {
    setState({ running: false, error: null, info: "Mirror stopped" });
    processRef.current = null;
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">Screen Mirror</h2>
        <div className="flex items-center gap-2">
          {state.running && (
            <span className="text-[10px] text-green-400 animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {state.error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {state.error}
        </div>
      )}

      {state.info && !state.error && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 p-2 rounded mb-3 text-sm">
          {state.info}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div>
          <label
            htmlFor="mirror-bitrate"
            className="text-xs text-gray-400 block mb-1"
          >
            Bitrate: {bitrate} Mbps
          </label>
          <input
            id="mirror-bitrate"
            type="range"
            min={1}
            max={50}
            value={bitrate}
            onChange={(e) => setBitrate(parseInt(e.target.value, 10))}
            disabled={state.running}
            className="w-full accent-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="mirror-maxsize"
            className="text-xs text-gray-400 block mb-1"
          >
            Max Size: {maxSize}px
          </label>
          <input
            id="mirror-maxsize"
            type="range"
            min={256}
            max={1920}
            step={128}
            value={maxSize}
            onChange={(e) => setMaxSize(parseInt(e.target.value, 10))}
            disabled={state.running}
            className="w-full accent-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="mirror-fps"
            className="text-xs text-gray-400 block mb-1"
          >
            FPS: {fps}
          </label>
          <input
            id="mirror-fps"
            type="range"
            min={15}
            max={60}
            step={5}
            value={fps}
            onChange={(e) => setFps(parseInt(e.target.value, 10))}
            disabled={state.running}
            className="w-full accent-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="mirror-controls"
            type="checkbox"
            checked={showControls}
            onChange={(e) => setShowControls(e.target.checked)}
            disabled={state.running}
            className="accent-blue-500 disabled:opacity-50"
          />
          <label htmlFor="mirror-controls" className="text-xs text-gray-400">
            Allow device control (keyboard/touch)
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        {!state.running ? (
          <button
            type="button"
            onClick={startMirror}
            className="flex-1 bg-blue-900/30 text-blue-300 px-4 py-2 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800"
          >
            Start Mirror
          </button>
        ) : (
          <button
            type="button"
            onClick={stopMirror}
            className="flex-1 bg-red-900/30 text-red-300 px-4 py-2 rounded hover:bg-red-900/50 transition-colors text-sm font-medium border border-red-800"
          >
            Stop
          </button>
        )}
      </div>

      <div className="mt-3 bg-gray-800 rounded p-2 border border-gray-700">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Requires <span className="text-gray-400 font-mono">scrcpy</span>{" "}
          installed and in PATH.{" "}
          <a
            href="https://github.com/Genymobile/scrcpy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Install scrcpy
          </a>
        </p>
      </div>
    </div>
  );
};

export default ScreenMirror;
