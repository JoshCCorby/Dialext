import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolRoot = join(root, ".dialext-tools");
const env = {
  ...process.env,
  ANARLOG_DISABLE_SENTRY: "1",
  DIALEXT_APP_IDENTIFIER: "app.dialext.prototype",
  ONBOARDING: process.env.ONBOARDING ?? "false",
  CHAR_VAULT_BASE: join(root, ".dialext-data", "vault"),
  RELAY_PORT: "1424",
};
if (existsSync(join(toolRoot, "cargo", "bin", "cargo"))) {
  env.CARGO_HOME = join(toolRoot, "cargo");
  env.RUSTUP_HOME = join(toolRoot, "rustup");
  env.PATH = `${join(toolRoot, "cargo", "bin")}:${env.PATH}`;
}
if (process.platform === "darwin") {
  const xcode = "/Applications/Xcode.app/Contents/Developer";
  if (existsSync(xcode)) env.DEVELOPER_DIR = xcode;
  env.PATH = `${join(root, "dialext", "toolchain")}:${env.PATH}`;
  const metal = spawnSync("xcrun", ["metal", "--version"], {
    env,
    encoding: "utf8",
  });
  if (metal.status !== 0) {
    console.error(
      "Xcode setup is incomplete. Open Xcode, accept its licence and install the Metal Toolchain before starting the native app.",
    );
    console.error(
      metal.stderr || metal.error?.message || "Metal compiler unavailable.",
    );
    process.exit(1);
  }
}
mkdirSync(env.CHAR_VAULT_BASE, { recursive: true });

async function pnpm(args) {
  await new Promise((resolveRun, reject) => {
    const child = spawn("npx", ["--yes", "pnpm@11.1.1", ...args], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    const stop = () => child.kill("SIGTERM");
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      if (code === 0 || signal === "SIGTERM") resolveRun();
      else
        reject(new Error(`Development command exited with ${code ?? signal}`));
    });
  });
}

try {
  await pnpm(["-F", "@anlg/ui", "build"]);
  await pnpm([
    "-F",
    "@anlg/desktop",
    "exec",
    "tauri",
    "dev",
    "--no-watch",
    "--features",
    "dev",
    "--config",
    join(root, "dialext", "tauri.prototype.json"),
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
