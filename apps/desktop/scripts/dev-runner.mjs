#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  constants,
  copyFileSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const [command, ...args] = process.argv.slice(2);
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };

if (!command) {
  console.error("Expected a Cargo command or Tauri application binary path.");
  process.exit(1);
}

if (command === "run" || command === "build") {
  const cargoArgs = [];
  if (command === "run" && process.platform === "darwin") {
    cargoArgs.push(
      "--config",
      `target.'cfg(target_os = "macos")'.runner = [${JSON.stringify(scriptPath)}]`,
    );
  }
  cargoArgs.push(command, ...args);
  runChild("cargo", cargoArgs);
} else {
  let executable = command;
  if (process.platform === "darwin") {
    signBinary(command);
    if (process.env.DIALEXT_APP_IDENTIFIER === "app.dialext.prototype") {
      executable = prototypeBundle(command);
    }
  }
  runChild(executable, args);
}

function prototypeBundle(binary) {
  const root = resolve(dirname(scriptPath), "../../..");
  const contents = resolve(
    root,
    ".dialext-data/Dialext Prototype.app/Contents",
  );
  const executable = resolve(contents, "MacOS/desktop");
  mkdirSync(dirname(executable), { recursive: true });
  copyFileSync(binary, executable, constants.COPYFILE_FICLONE);
  for (const name of [
    "check-permissions",
    "icons",
    "notification-icons",
    "CabinSketch-Regular.ttf",
    "CabinSketch-OFL.txt",
  ]) {
    const source = resolve(dirname(resolve(binary)), name);
    const destination = resolve(dirname(executable), name);
    if (existsSync(source) && !existsSync(destination))
      symlinkSync(source, destination);
  }
  const resources = resolve(contents, "Resources");
  if (!existsSync(resources)) symlinkSync(dirname(resolve(binary)), resources);
  const plist = readFileSync(
    resolve(root, "apps/desktop/src-tauri/Info.plist"),
    "utf8",
  ).replace(
    "<dict>",
    `<dict>
    <key>CFBundleIdentifier</key><string>app.dialext.prototype</string>
    <key>CFBundleName</key><string>Dialext Prototype</string>
    <key>CFBundleExecutable</key><string>desktop</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleVersion</key><string>1</string>`,
  );
  writeFileSync(resolve(contents, "Info.plist"), plist);
  return executable;
}

function signBinary(binary) {
  const identifier = process.env.DIALEXT_APP_IDENTIFIER ?? "com.hyprnote.dev";
  const scriptDirectory = dirname(scriptPath);
  const entitlements = resolve(
    scriptDirectory,
    "../src-tauri/Entitlements.plist",
  );
  const signing = spawnSync(
    "codesign",
    [
      "--force",
      "--sign",
      "-",
      "--identifier",
      identifier,
      "--requirements",
      `=designated => identifier "${identifier}"`,
      "--entitlements",
      entitlements,
      binary,
    ],
    { stdio: "inherit" },
  );

  if (signing.status !== 0) {
    process.exit(signing.status ?? 1);
  }
}

function runChild(executable, childArgs) {
  const child = spawn(executable, childArgs, { stdio: "inherit" });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(signalExitCodes[signal] ?? 1);
      return;
    }

    process.exit(code ?? 1);
  });
}
