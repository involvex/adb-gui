import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");

function getBin(name: string): string {
  if (process.platform === "win32") {
    return `${name}.exe`;
  }
  return name;
}

function runDev() {
  const bunBin = getBin("bun");
  const child = spawn(bunBin, ["run", "dev"], {
    cwd: PACKAGE_ROOT,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  child.on("error", (err) => {
    console.error(`Failed to start dev server: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function runProd() {
  const electronBin = getBin("electron");
  const child = spawn(electronBin, ["."], {
    cwd: PACKAGE_ROOT,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  child.on("error", (err) => {
    console.error(`Failed to start app: ${err.message}`);
    console.error("Make sure you ran 'bun run build' first.");
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

const args = process.argv.slice(2);
const prod = args.includes("--prod") || args.includes("-p");

if (prod) {
  runProd();
} else {
  runDev();
}
