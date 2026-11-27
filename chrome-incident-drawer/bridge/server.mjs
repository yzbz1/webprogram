// src/bridge/server.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname as dirname2, join as join2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/shared/types.ts
var API_ROUTE_PATH = "/api/incident-drawer";
var HEALTH_ROUTE_PATH = "/health";
var CLIENT_HEADER_NAME = "x-incident-drawer-client";
var CLIENT_HEADER_VALUE = "chrome-ext";
var DEFAULT_BRIDGE_PORT = 17892;

// src/bridge/config-store.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function resolveDefaultSamplePath() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dshSiblingSample = resolve(here, "../../dsh-plugin-incident-drawer/sample/incidents.xlsx");
  if (existsSync(dshSiblingSample)) {
    return dshSiblingSample;
  }
  return resolve(here, "../sample/incidents.xlsx");
}
function resolveConfigFilePath() {
  if (process.env.DSH_INCIDENT_DRAWER_CONFIG) {
    return resolve(process.env.DSH_INCIDENT_DRAWER_CONFIG);
  }
  const dshHome = process.env.DSH_HOME || join(os.homedir(), ".dsh");
  return join(dshHome, "incident-drawer-config.json");
}
var ConfigStore = class {
  constructor(initialExcelPath, configFilePath = resolveConfigFilePath()) {
    this.initialExcelPath = initialExcelPath;
    this.configFilePath = configFilePath;
  }
  memoryFallback = null;
  /** Always read fresh from disk so DSH and Chrome stay synchronized on the same config file. */
  read() {
    try {
      if (existsSync(this.configFilePath)) {
        const raw = JSON.parse(readFileSync(this.configFilePath, "utf8"));
        if (typeof raw.excelPath === "string" && raw.excelPath.trim() !== "") {
          const loaded = {
            excelPath: raw.excelPath.trim(),
            ...typeof raw.preferredSheet === "string" && raw.preferredSheet.trim() !== "" ? { preferredSheet: raw.preferredSheet.trim() } : {}
          };
          this.memoryFallback = loaded;
          return loaded;
        }
      }
    } catch {
    }
    if (this.memoryFallback !== null) {
      return { ...this.memoryFallback };
    }
    const fallback = {
      excelPath: this.initialExcelPath?.trim() || resolveDefaultSamplePath()
    };
    this.memoryFallback = fallback;
    return { ...fallback };
  }
  write(next) {
    const clean = {
      excelPath: resolve(next.excelPath.trim()),
      ...next.preferredSheet && next.preferredSheet.trim() !== "" ? { preferredSheet: next.preferredSheet.trim() } : {}
    };
    this.memoryFallback = clean;
    try {
      mkdirSync(dirname(this.configFilePath), { recursive: true });
      writeFileSync(this.configFilePath, JSON.stringify(clean, null, 2) + "\n", "utf8");
      return { persisted: true, config: { ...clean } };
    } catch {
      return { persisted: false, config: { ...clean } };
    }
  }
};

// src/bridge/server.ts
var require2 = createRequire(import.meta.url);
var excelStore = require2("./excel-store.cjs");
var MAX_BODY_BYTES = 1024 * 1024;
function isAllowedOrigin(origin) {
  if (origin.startsWith("chrome-extension://")) return true;
  try {
    const u = new URL(origin);
    return (u.hostname === "127.0.0.1" || u.hostname === "localhost") && u.protocol === "http:";
  } catch {
    return false;
  }
}
function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && isAllowedOrigin(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", `content-type, ${CLIENT_HEADER_NAME}`);
  }
}
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body exceeds 1MB limit");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks, size).toString("utf8");
  return JSON.parse(text);
}
async function startBridgeServer(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT);
  const configStore = new ConfigStore(options.initialExcelPath, options.configFilePath);
  const server = createServer(async (req, res) => {
    try {
      applyCorsHeaders(req, res);
      const origin = req.headers.origin;
      if (typeof origin === "string" && !isAllowedOrigin(origin)) {
        sendJson(res, 403, { ok: false, error: "Forbidden origin" });
        return;
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (pathname === HEALTH_ROUTE_PATH && req.method === "GET") {
        const cfg = configStore.read();
        sendJson(res, 200, {
          ok: true,
          service: "chrome-incident-drawer-bridge",
          version: "1.0.0",
          pid: process.pid,
          excelPath: cfg.excelPath
        });
        return;
      }
      if (pathname === API_ROUTE_PATH && req.method === "POST") {
        const clientTag = req.headers[CLIENT_HEADER_NAME];
        if (clientTag !== CLIENT_HEADER_VALUE) {
          sendJson(res, 403, { ok: false, error: "Missing or invalid client header" });
          return;
        }
        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON request body" });
          return;
        }
        if (!body || typeof body !== "object") {
          sendJson(res, 400, { ok: false, error: "Invalid request envelope" });
          return;
        }
        const { endpoint, payload } = body;
        if (typeof endpoint !== "string" || endpoint.trim() === "") {
          sendJson(res, 400, { ok: false, error: "Missing endpoint" });
          return;
        }
        const cfg = configStore.read();
        switch (endpoint) {
          case "load": {
            const reqPayload = payload && typeof payload === "object" ? payload : {};
            const sheetName = typeof reqPayload.sheetName === "string" && reqPayload.sheetName.trim() !== "" ? reqPayload.sheetName.trim() : cfg.preferredSheet;
            const snapshot = await excelStore.loadWorkbookData(cfg.excelPath, sheetName);
            sendJson(res, 200, { ok: true, value: snapshot });
            return;
          }
          case "check-status": {
            const reqPayload = payload && typeof payload === "object" ? payload : {};
            const known = typeof reqPayload.knownVersion === "string" || reqPayload.knownVersion === null ? reqPayload.knownVersion : null;
            const status = await excelStore.checkWorkbookStatus(cfg.excelPath, known);
            sendJson(res, 200, { ok: true, value: status });
            return;
          }
          case "save-cell": {
            if (!payload || typeof payload !== "object") {
              sendJson(res, 400, { ok: false, error: "Invalid save-cell payload" });
              return;
            }
            const reqPayload = payload;
            const result = await excelStore.saveCellsToWorkbook({
              excelPath: cfg.excelPath,
              sheetName: reqPayload.sheetName,
              edits: [{ rowNumber: reqPayload.rowNumber, colIndex: reqPayload.colIndex, value: String(reqPayload.value ?? "") }],
              expectedVersion: reqPayload.expectedVersion ?? null,
              forceOverwrite: Boolean(reqPayload.forceOverwrite)
            });
            sendJson(res, 200, { ok: true, value: result });
            return;
          }
          case "save-batch": {
            if (!payload || typeof payload !== "object") {
              sendJson(res, 400, { ok: false, error: "Invalid save-batch payload" });
              return;
            }
            const reqPayload = payload;
            const result = await excelStore.saveCellsToWorkbook({
              excelPath: cfg.excelPath,
              sheetName: reqPayload.sheetName,
              edits: Array.isArray(reqPayload.edits) ? reqPayload.edits : [],
              expectedVersion: reqPayload.expectedVersion ?? null,
              forceOverwrite: Boolean(reqPayload.forceOverwrite)
            });
            sendJson(res, 200, { ok: true, value: result });
            return;
          }
          case "set-config": {
            if (!payload || typeof payload !== "object") {
              sendJson(res, 400, { ok: false, error: "Invalid set-config payload" });
              return;
            }
            const reqPayload = payload;
            if (typeof reqPayload.excelPath !== "string" || reqPayload.excelPath.trim() === "") {
              sendJson(res, 400, { ok: false, error: "excelPath must be a non-empty string" });
              return;
            }
            const { config: savedCfg } = configStore.write({
              excelPath: reqPayload.excelPath,
              ...typeof reqPayload.preferredSheet === "string" && reqPayload.preferredSheet.trim() !== "" ? { preferredSheet: reqPayload.preferredSheet.trim() } : {}
            });
            const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath, savedCfg.preferredSheet);
            sendJson(res, 200, { ok: true, value: snapshot });
            return;
          }
          case "create-sample": {
            const reqPayload = payload && typeof payload === "object" ? payload : {};
            const targetPath = typeof reqPayload.excelPath === "string" && reqPayload.excelPath.trim() !== "" ? resolve2(reqPayload.excelPath.trim()) : cfg.excelPath;
            await excelStore.createSampleWorkbook(targetPath);
            const { config: savedCfg } = configStore.write({ excelPath: targetPath });
            const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath);
            sendJson(res, 200, { ok: true, value: snapshot });
            return;
          }
          default:
            sendJson(res, 404, { ok: false, error: `Unknown endpoint: ${endpoint}` });
            return;
        }
      }
      sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.removeListener("error", rejectListen);
      resolveListen();
    });
  });
  const boundPort = server.address().port;
  const pidPath = options.pidFilePath === null ? null : options.pidFilePath ?? join2(dirname2(fileURLToPath2(import.meta.url)), ".bridge.pid");
  if (pidPath) {
    try {
      mkdirSync2(dirname2(pidPath), { recursive: true });
      writeFileSync2(pidPath, String(process.pid), "ascii");
    } catch {
    }
  }
  const cleanupPid = () => {
    if (pidPath && existsSync2(pidPath)) {
      try {
        rmSync(pidPath, { force: true });
      } catch {
      }
    }
  };
  const close = async () => {
    cleanupPid();
    await new Promise((resolveClose) => {
      server.close(() => resolveClose());
    });
  };
  return { server, port: boundPort, host, close };
}
var isEntry = (() => {
  try {
    return resolve2(process.argv[1] ?? "") === resolve2(fileURLToPath2(import.meta.url));
  } catch {
    return false;
  }
})();
if (isEntry) {
  const { port, host, close } = await startBridgeServer({
    pidFilePath: process.env.BRIDGE_NO_PID === "1" ? null : void 0
  });
  console.log(`[chrome-incident-drawer-bridge] listening on http://${host}:${port}`);
  const shutdown = () => {
    void close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", () => {
    try {
      const pidPath = join2(dirname2(fileURLToPath2(import.meta.url)), ".bridge.pid");
      if (existsSync2(pidPath)) rmSync(pidPath, { force: true });
    } catch {
    }
  });
}
export {
  startBridgeServer
};
