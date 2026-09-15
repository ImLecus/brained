const { app, BrowserWindow, Menu, dialog, globalShortcut } = require("electron");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { existsSync, copyFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const READY_TIMEOUT = 15000;

const DEFAULT_CONFIG = {
  vaultPath: "",
  instructionsPath: "AGENTS.md",
  model: "opencode/big-pickle",
  language: "es",
  theme: "dark",
};

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("could not reserve a free port"));
        }
      });
    });
  });
}

function copyBundledConfig(userData) {
  const configPath = join(userData, "config.json");
  if (existsSync(configPath)) {
    return;
  }
  const bundled = join(app.getAppPath(), "config.json");
  if (existsSync(bundled)) {
    copyFileSync(bundled, configPath);
  } else {
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  }
}

async function spawnServer(port) {
  const packaged = app.isPackaged;
  const cwd = packaged ? app.getPath("userData") : app.getAppPath();
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port) };
  let serverEntry;
  if (packaged) {
    serverEntry = join(app.getAppPath(), "dist-server", "server", "index.js");
    env.BRAINED_DIST = join(app.getAppPath(), "dist");
    copyBundledConfig(cwd);
  } else {
    serverEntry = join(cwd, "dist-server", "server", "index.js");
  }

  const child = spawn(process.execPath, [serverEntry], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("server did not become ready in time"));
    }, READY_TIMEOUT);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (output.includes("BRAINED:READY")) {
        return;
      }
      clearTimeout(timer);
      reject(new Error(`server exited with code ${code}`));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("BRAINED:READY")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on("data", () => undefined);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let server = null;
  let port = 0;

  app.on("before-quit", () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  });

  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    try {
      port = await freePort();
      server = await spawnServer(port);
    } catch (error) {
      dialog.showErrorBox("Brained", String(error));
      app.quit();
      return;
    }

    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 600,
      show: false,
      backgroundColor: "#171717",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    window.once("ready-to-show", () => window.show());
    window.on("closed", () => app.quit());

    window.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "F11") {
        event.preventDefault();
        window.setFullScreen(!window.isFullScreen());
      }
    });

    if (!app.isPackaged) {
      globalShortcut.register("F12", () => window.webContents.toggleDevTools());
    }

    void window.loadURL(`http://127.0.0.1:${port}`);
  });
}