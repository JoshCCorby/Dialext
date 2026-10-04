// Installs ~/Applications/Dialext Prototype.app so Spotlight, Launchpad and the
// Dock can start the prototype. The app is a thin wrapper around dev.mjs: the
// debug bundle dev-runner writes into .dialext-data needs the Vite server and
// the launcher's environment, so it cannot be opened on its own.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  console.error("The launcher app is macOS only.");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(homedir(), "Applications", "Dialext Prototype.app");
const contents = join(app, "Contents");
const quote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;

rmSync(app, { force: true, recursive: true });
mkdirSync(join(contents, "MacOS"), { recursive: true });
mkdirSync(join(contents, "Resources"), { recursive: true });

copyFileSync(
  join(root, "apps/desktop/src-tauri/icons/dialext/icon.icns"),
  join(contents, "Resources", "AppIcon.icns"),
);

writeFileSync(
  join(contents, "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>app.dialext.prototype.launcher</string>
  <key>CFBundleName</key><string>Dialext Prototype</string>
  <key>CFBundleDisplayName</key><string>Dialext Prototype</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
</dict>
</plist>
`,
);

// Node comes from nvm, which a Finder-launched process never sees, so the
// installing Node's directory is baked in. Re-run after changing Node.
const launch = join(contents, "MacOS", "launch");
writeFileSync(
  launch,
  `#!/bin/sh
ROOT=${quote(root)}
NODE=${quote(process.execPath)}
BUNDLE="$ROOT/.dialext-data/Dialext Prototype.app"
LOG="$ROOT/.dialext-data/launcher.log"

if pgrep -f "$BUNDLE/Contents/MacOS/desktop" >/dev/null; then
  exec open "$BUNDLE"
fi
# Never start a second instance against the vault, including one still building
# or started from a terminal.
if pgrep -f "^[^ ]*node [^ ]*dialext/dev\\.mjs" >/dev/null; then
  exit 0
fi

mkdir -p "$ROOT/.dialext-data"
cd "$ROOT" || exit 1
PATH="$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin" \\
  nohup "$NODE" "$ROOT/dialext/dev.mjs" </dev/null >"$LOG" 2>&1 &
DEV=$!

# Stay alive, keeping the Dock icon, until the prototype's window is up: the
# build takes a minute or more and nothing else shows while it runs.
while kill -0 "$DEV" 2>/dev/null; do
  if pgrep -f "$BUNDLE/Contents/MacOS/desktop" >/dev/null; then
    exec open "$BUNDLE"
  fi
  sleep 1
done
osascript -e 'display alert "Dialext Prototype could not start." message "See .dialext-data/launcher.log in the Dialext checkout." as critical'
exit 1
`,
);
chmodSync(launch, 0o755);

spawnSync(
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
  ["-f", app],
);
console.log(`Installed ${app}`);
console.log(`It starts ${root} with Node at ${process.execPath}.`);
