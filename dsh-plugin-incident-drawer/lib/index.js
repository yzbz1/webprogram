// src/host/index.ts
import { existsSync as existsSync2, watch } from "node:fs";
import { createRequire } from "node:module";
import { dirname as dirname2, resolve as resolve2 } from "node:path";

// src/shared/types.ts
var API_ROUTE_PATH = "/api/incident-drawer";

// src/host/config-store.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function resolveDefaultSamplePath() {
  const here = dirname(fileURLToPath(import.meta.url));
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
  memoryConfig = null;
  read() {
    if (this.memoryConfig !== null) {
      return { ...this.memoryConfig };
    }
    try {
      if (existsSync(this.configFilePath)) {
        const raw = JSON.parse(readFileSync(this.configFilePath, "utf8"));
        if (typeof raw.excelPath === "string" && raw.excelPath.trim() !== "") {
          const loaded = {
            excelPath: raw.excelPath.trim(),
            ...typeof raw.preferredSheet === "string" && raw.preferredSheet.trim() !== "" ? { preferredSheet: raw.preferredSheet.trim() } : {}
          };
          this.memoryConfig = loaded;
          return { ...loaded };
        }
      }
    } catch {
    }
    const fallback = {
      excelPath: this.initialExcelPath?.trim() || resolveDefaultSamplePath()
    };
    this.memoryConfig = fallback;
    return { ...fallback };
  }
  write(next) {
    const clean = {
      excelPath: resolve(next.excelPath.trim()),
      ...next.preferredSheet && next.preferredSheet.trim() !== "" ? { preferredSheet: next.preferredSheet.trim() } : {}
    };
    this.memoryConfig = clean;
    try {
      mkdirSync(dirname(this.configFilePath), { recursive: true });
      writeFileSync(this.configFilePath, JSON.stringify(clean, null, 2) + "\n", "utf8");
      return { persisted: true, config: { ...clean } };
    } catch {
      return { persisted: false, config: { ...clean } };
    }
  }
};

// src/host/index.ts
var require2 = createRequire(import.meta.url);
var excelStore = require2("./excel-store.cjs");
var name = "incident-drawer";
var inject = ["connection"];
function jsonOk(value) {
  return Response.json(
    { ok: true, value },
    { headers: { "cache-control": "no-store" } }
  );
}
function jsonErr(code, message, status = 400) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "cache-control": "no-store" } }
  );
}
function apply(ctx, pluginConfig) {
  const configStore = new ConfigStore(pluginConfig?.excelPath);
  let currentVersion = null;
  let watcher = null;
  let watchedDir = "";
  const refreshWatcher = (excelPath) => {
    const dir = dirname2(resolve2(excelPath));
    if (watcher && watchedDir === dir) return;
    watcher?.close();
    watcher = null;
    watchedDir = dir;
    if (!existsSync2(dir)) return;
    try {
      watcher = watch(dir, { persistent: false }, (_eventType, filename) => {
        if (!filename) return;
        const targetName = resolve2(excelPath).toLowerCase();
        if (resolve2(dir, filename.toString()).toLowerCase() === targetName) {
          void excelStore.computeFileVersion(excelPath).then((ver) => {
            currentVersion = ver;
          }).catch(() => void 0);
        }
      });
    } catch {
      watcher = null;
    }
  };
  ctx.effect(() => () => {
    watcher?.close();
    watcher = null;
  }, "incident-drawer: file watcher");
  ctx.effect(
    () => ctx.connection.fetch.register({
      path: API_ROUTE_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonErr("incident-drawer/bad-request", "request body must be valid JSON", 400);
        }
        if (!body || typeof body !== "object") {
          return jsonErr("incident-drawer/bad-request", "invalid request envelope", 400);
        }
        const { endpoint, payload } = body;
        if (typeof endpoint !== "string" || endpoint.trim() === "") {
          return jsonErr("incident-drawer/bad-request", "missing endpoint", 400);
        }
        const cfg = configStore.read();
        refreshWatcher(cfg.excelPath);
        try {
          switch (endpoint) {
            case "load": {
              const req = payload && typeof payload === "object" ? payload : {};
              const sheetName = typeof req.sheetName === "string" && req.sheetName.trim() !== "" ? req.sheetName.trim() : cfg.preferredSheet;
              const snapshot = await excelStore.loadWorkbookData(cfg.excelPath, sheetName);
              currentVersion = snapshot.version;
              return jsonOk(snapshot);
            }
            case "check-status": {
              const req = payload && typeof payload === "object" ? payload : {};
              const known = typeof req.knownVersion === "string" || req.knownVersion === null ? req.knownVersion : currentVersion;
              const status = await excelStore.checkWorkbookStatus(cfg.excelPath, known);
              currentVersion = status.currentVersion;
              return jsonOk(status);
            }
            case "save-cell": {
              if (!payload || typeof payload !== "object") {
                return jsonErr("incident-drawer/bad-request", "invalid save-cell payload", 400);
              }
              const req = payload;
              const res = await excelStore.saveCellsToWorkbook({
                excelPath: cfg.excelPath,
                sheetName: req.sheetName,
                edits: [{ rowNumber: req.rowNumber, colIndex: req.colIndex, value: String(req.value ?? "") }],
                expectedVersion: req.expectedVersion ?? null,
                forceOverwrite: Boolean(req.forceOverwrite)
              });
              if (res.version) currentVersion = res.version;
              return jsonOk(res);
            }
            case "save-batch": {
              if (!payload || typeof payload !== "object") {
                return jsonErr("incident-drawer/bad-request", "invalid save-batch payload", 400);
              }
              const req = payload;
              const res = await excelStore.saveCellsToWorkbook({
                excelPath: cfg.excelPath,
                sheetName: req.sheetName,
                edits: Array.isArray(req.edits) ? req.edits : [],
                expectedVersion: req.expectedVersion ?? null,
                forceOverwrite: Boolean(req.forceOverwrite)
              });
              if (res.version) currentVersion = res.version;
              return jsonOk(res);
            }
            case "set-config": {
              if (!payload || typeof payload !== "object") {
                return jsonErr("incident-drawer/bad-request", "invalid set-config payload", 400);
              }
              const req = payload;
              if (typeof req.excelPath !== "string" || req.excelPath.trim() === "") {
                return jsonErr("incident-drawer/bad-request", "excelPath must be a non-empty string", 400);
              }
              const { config: savedCfg } = configStore.write({
                excelPath: req.excelPath,
                ...typeof req.preferredSheet === "string" && req.preferredSheet.trim() !== "" ? { preferredSheet: req.preferredSheet.trim() } : {}
              });
              refreshWatcher(savedCfg.excelPath);
              const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath, savedCfg.preferredSheet);
              currentVersion = snapshot.version;
              return jsonOk(snapshot);
            }
            case "create-sample": {
              const req = payload && typeof payload === "object" ? payload : {};
              const targetPath = typeof req.excelPath === "string" && req.excelPath.trim() !== "" ? resolve2(req.excelPath.trim()) : cfg.excelPath;
              await excelStore.createSampleWorkbook(targetPath);
              const { config: savedCfg } = configStore.write({ excelPath: targetPath });
              refreshWatcher(savedCfg.excelPath);
              const snapshot = await excelStore.loadWorkbookData(savedCfg.excelPath);
              currentVersion = snapshot.version;
              return jsonOk(snapshot);
            }
            default:
              return jsonErr("incident-drawer/not-found", `unknown endpoint: ${endpoint}`, 404);
          }
        } catch (error) {
          return jsonErr(
            "incident-drawer/internal",
            error instanceof Error ? error.message : String(error),
            500
          );
        }
      }
    }),
    "incident-drawer: /api/incident-drawer route"
  );
}
export {
  apply,
  inject,
  name
};
