import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || "34173";
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || "38123";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}/api/health/`;

function spawnService(command, args, env, label) {
  process.stdout.write(`[runner] starting ${label}\n`);
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.unref();
  return child;
}

function spawnWinCmd(commandLine, env, label) {
  return spawnService("cmd.exe", ["/d", "/s", "/c", commandLine], env, label);
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) {
        return;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function assertPortAvailable(port, host, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            `${label} port ${port} on ${host} is already in use. Stop stale e2e processes or override PLAYWRIGHT_${label.toUpperCase()}_PORT.`
          )
        );
        return;
      }
      reject(error);
    });
    server.listen(Number(port), host, () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  });
}

async function isPortListening(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port: Number(port), host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

async function runCommandCapture(command, args) {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("exit", (code) => resolve({ code: code ?? 1, stdout }));
    child.on("error", () => resolve({ code: 1, stdout }));
  });
}

async function findWindowsPortOwnerPid(port) {
  const result = await runCommandCapture("netstat", ["-ano", "-p", "tcp"]);
  if (result.code !== 0) {
    return null;
  }
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.includes(`:${port}`) || !line.includes("LISTENING")) {
      continue;
    }
    const columns = line.trim().split(/\s+/);
    const pid = Number(columns.at(-1));
    if (Number.isInteger(pid) && pid > 0) {
      return pid;
    }
  }
  return null;
}

async function ensurePortReleased(port, label) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!(await isPortListening(port))) {
      return;
    }
    if (process.platform === "win32") {
      const pid = await findWindowsPortOwnerPid(port);
      if (pid) {
        await Promise.race([
          new Promise((resolve) => {
            const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
              stdio: "ignore",
              windowsHide: true,
            });
            killer.on("exit", () => resolve());
            killer.on("error", () => resolve());
          }),
          delay(3000),
        ]);
      }
    }
    await delay(500);
  }

  if (await isPortListening(port)) {
    throw new Error(`${label} port ${port} is still occupied after e2e cleanup`);
  }
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await Promise.race([
      new Promise((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.on("exit", () => resolve());
        killer.on("error", () => resolve());
      }),
      delay(5000),
    ]);
    if (child.exitCode === null) {
      try {
        child.kill();
      } catch {
        // Best-effort fallback for Windows child teardown.
      }
    }
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

async function main() {
  const pythonCommand = process.env.PLAYWRIGHT_PYTHON || "python";
  const npmCommand = "npm";
  const npxCommand = "npx";
  const children = [];

  const backendEnv = {
    ...process.env,
    PLAYWRIGHT_FRONTEND_URL: baseURL,
    PLAYWRIGHT_BACKEND_HOST: "127.0.0.1",
    PLAYWRIGHT_BACKEND_PORT: backendPort,
    PLAYWRIGHT_SMOKE_USERNAME: process.env.PLAYWRIGHT_SMOKE_USERNAME || "playwright_b2b_client",
    PLAYWRIGHT_SMOKE_PASSWORD: process.env.PLAYWRIGHT_SMOKE_PASSWORD || "PlaywrightPass123!",
    PLAYWRIGHT_SMOKE_EMAIL: process.env.PLAYWRIGHT_SMOKE_EMAIL || "playwright-b2b@example.invalid",
    PLAYWRIGHT_ADMIN_USERNAME: process.env.PLAYWRIGHT_ADMIN_USERNAME || "playwright_admin",
    PLAYWRIGHT_ADMIN_PASSWORD: process.env.PLAYWRIGHT_ADMIN_PASSWORD || "PlaywrightAdmin123!",
    PLAYWRIGHT_ADMIN_EMAIL:
      process.env.PLAYWRIGHT_ADMIN_EMAIL || "playwright-admin@example.invalid",
  };

  const frontendEnv = {
    ...process.env,
    VITE_DEV_API_PROXY: `http://127.0.0.1:${backendPort}`,
    VITE_DEV_WS_PROXY: `ws://127.0.0.1:${backendPort}`,
    VITE_API_BASE_URL: "/api",
    VITE_WS_BASE_URL: "",
    VITE_SITE_URL: baseURL,
    VITE_TELEGRAM_BOT_USERNAME: "",
  };

  try {
    await assertPortAvailable(backendPort, "127.0.0.1", "backend");
    await assertPortAvailable(frontendPort, "127.0.0.1", "frontend");

    const backend = spawnService(
      pythonCommand,
      ["../scripts/run_playwright_backend.py"],
      backendEnv,
      "backend"
    );
    children.push(backend);
    await waitForUrl(backendUrl, 120000);

    const frontend =
      process.platform === "win32"
        ? spawnWinCmd(
            `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
            frontendEnv,
            "frontend"
          )
        : spawnService(
            npmCommand,
            ["run", "dev", "--", "--host", "127.0.0.1", "--port", frontendPort],
            frontendEnv,
            "frontend"
          );
    children.push(frontend);
    await waitForUrl(baseURL, 120000);

    const playwrightArgs = ["playwright", "test", ...process.argv.slice(2)];
    const testEnv = {
      ...process.env,
      PLAYWRIGHT_USE_EXTERNAL_SERVERS: "1",
      PLAYWRIGHT_BASE_URL: baseURL,
      PLAYWRIGHT_BACKEND_PORT: backendPort,
      PLAYWRIGHT_FRONTEND_PORT: frontendPort,
    };
    const testProcess =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", `npx ${playwrightArgs.join(" ")}`], {
            cwd: process.cwd(),
            env: testEnv,
            stdio: "inherit",
            windowsHide: true,
          })
        : spawn(npxCommand, playwrightArgs, {
            cwd: process.cwd(),
            env: testEnv,
            stdio: "inherit",
            windowsHide: true,
          });

    return await new Promise((resolve, reject) => {
      testProcess.on("exit", (code) => resolve(code ?? 1));
      testProcess.on("error", reject);
    });
  } finally {
    await Promise.all(children.reverse().map((child) => terminateChild(child)));
    await ensurePortReleased(backendPort, "backend");
    await ensurePortReleased(frontendPort, "frontend");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .then((code) => {
    process.exit(code ?? 0);
  });
