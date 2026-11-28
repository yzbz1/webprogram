window.__ModuleLoader__.load({
  id: "dsh-plugin-incident-drawer",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/shared/types.ts
var API_CLIENT_ROUTE = "api/incident-drawer";

// src/client/IncidentDrawer.tsx
var import_react = require("react");

// src/shared/sla.ts
var DEFAULT_SERVICE_CATEGORIES = {
  \u57FA\u7840\u67B6\u6784: ["\u7F51\u7EDC\u4E0E\u7F51\u5173", "\u670D\u52A1\u5668\u4E0E\u78C1\u76D8", "\u5BB9\u5668\u4E0E\u8BC1\u4E66"],
  \u5E94\u7528\u7CFB\u7EDF: ["\u5355\u70B9\u767B\u5F55\u4E0E\u8BA4\u8BC1", "OA\u4E0E\u5BA1\u6279\u6D41", "\u8D22\u52A1\u4E0E\u62A5\u8868"],
  \u4E2D\u95F4\u4EF6\u4E0E\u6570\u636E: ["\u6D88\u606F\u961F\u5217", "\u6570\u636E\u5E93\u4E0ESQL", "\u7F13\u5B58\u4E0E\u68C0\u7D22"],
  \u53D1\u5E03\u4E0E\u8FD0\u7EF4: ["CI/CD\u6D41\u6C34\u7EBF", "CDN\u4E0E\u9759\u6001\u8D44\u6E90", "\u5B9A\u65F6\u4EFB\u52A1\u8C03\u5EA6"]
};
var WORK_START_MIN = 8 * 60 + 30;
var WORK_END_MIN = 18 * 60;
var MS_PER_MIN = 6e4;
var MS_PER_HOUR = 36e5;
function isServiceCategoryHeader(header) {
  const h = header.trim();
  return h.includes("\u670D\u52A1\u5206\u7C7B") && !h.includes("\u5B50\u5206\u7C7B");
}
function isServiceSubCategoryHeader(header) {
  const h = header.trim();
  return h.includes("\u670D\u52A1\u5B50\u5206\u7C7B") || h.includes("\u5B50\u5206\u7C7B");
}
function isSlaHeader(header) {
  return /sla|到期时间/i.test(header.trim());
}
function parseLocalDateTime(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(
    trimmed
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] !== void 0 ? Number(match[4]) : 18;
  const minute = match[5] !== void 0 ? Number(match[5]) : 0;
  const second = match[6] !== void 0 ? Number(match[6]) : 0;
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }
  const d = new Date(year, month - 1, day, hour, minute, second, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}
function sumWorkingMsBetween(startMs, endMs) {
  if (endMs <= startMs) return 0;
  const cursor = new Date(startMs);
  cursor.setHours(0, 0, 0, 0);
  let totalMs = 0;
  for (let days = 0; days < 366; days += 1) {
    const dayStartMs = cursor.getTime();
    if (dayStartMs >= endMs) break;
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      const workStart = dayStartMs + WORK_START_MIN * MS_PER_MIN;
      const workEnd = dayStartMs + WORK_END_MIN * MS_PER_MIN;
      const overlapStart = Math.max(startMs, workStart);
      const overlapEnd = Math.min(endMs, workEnd);
      if (overlapEnd > overlapStart) {
        totalMs += overlapEnd - overlapStart;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return totalMs;
}
function computeWorkingHoursRemaining(deadline, now = /* @__PURE__ */ new Date()) {
  const startMs = now.getTime();
  const endMs = deadline.getTime();
  if (endMs === startMs) return 0;
  if (endMs > startMs) {
    return sumWorkingMsBetween(startMs, endMs) / MS_PER_HOUR;
  }
  return -(sumWorkingMsBetween(endMs, startMs) / MS_PER_HOUR);
}
function evaluateSla(rawValue, now = /* @__PURE__ */ new Date()) {
  const deadline = parseLocalDateTime(rawValue);
  if (!deadline) return null;
  const remainingHours = computeWorkingHoursRemaining(deadline, now);
  const tone = remainingHours < 4 ? "err" : remainingHours <= 8 ? "warn" : "ok";
  let label;
  let shortLabel;
  if (deadline.getTime() <= now.getTime()) {
    label = "\u5DF2\u8D85\u65F6";
    shortLabel = "\u8D85\u65F6";
  } else if (remainingHours < 0.1) {
    label = "\u5373\u5C06\u5230\u671F";
    shortLabel = "0.1h";
  } else {
    const rounded = remainingHours.toFixed(1);
    label = `\u5DE5\u4F5C\u5269\u4F59 ${rounded}h`;
    shortLabel = `${rounded}h`;
  }
  return { deadline, remainingHours, tone, label, shortLabel };
}

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function RefreshIcon({ spinning = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      width: "13",
      height: "13",
      viewBox: "0 0 16 16",
      fill: "none",
      className: spinning ? "idw-spin" : void 0,
      "aria-hidden": "true",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "path",
        {
          d: "M13.5 8a5.5 5.5 0 1 1-1.35-3.61M13.5 2.75v2.75h-2.75",
          stroke: "currentColor",
          strokeWidth: "1.4",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      )
    }
  );
}
function SettingsIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "2.2", stroke: "currentColor", strokeWidth: "1.35" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        d: "M8 1.8v1.3M8 12.9v1.3M14.2 8h-1.3M3.1 8H1.8M12.38 3.62l-.92.92M4.54 11.46l-.92.92M12.38 12.38l-.92-.92M4.54 4.54l-.92-.92",
        stroke: "currentColor",
        strokeWidth: "1.35",
        strokeLinecap: "round"
      }
    )
  ] });
}
function CollapseRightIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M6.25 4.25L10 8l-3.75 3.75M11.75 4.25v7.5",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ) });
}
function PeekLeftIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M10 3.5L5.5 8 10 12.5",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ) });
}
function ExternalLinkIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "11", height: "11", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M6 3.5h6.5V10M12.2 3.8L4.2 11.8",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ) });
}
function ChevronDownIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M4.25 6.25L8 10l3.75-3.75",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ) });
}
function WarnIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        d: "M8 2.3L14.2 13H1.8L8 2.3z",
        stroke: "currentColor",
        strokeWidth: "1.35",
        strokeLinejoin: "round"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 6.3v3.1", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "11.2", r: "0.7", fill: "currentColor" })
  ] });
}

// src/client/IncidentDrawer.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var WIDTH_STORAGE_KEY = "dsh.incident-drawer.width";
var HIDDEN_STORAGE_KEY = "dsh.incident-drawer.hidden";
var DEFAULT_EXPANDED_WIDTH = 328;
var MIN_EXPANDED_WIDTH = 280;
var MAX_EXPANDED_WIDTH = 540;
var POLL_INTERVAL_MS = 4e3;
var HOVER_IN_DELAY_MS = 110;
var HOVER_OUT_DELAY_MS = 160;
function readStoredWidth() {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= MIN_EXPANDED_WIDTH && parsed <= MAX_EXPANDED_WIDTH) {
      return parsed;
    }
  } catch {
  }
  return DEFAULT_EXPANDED_WIDTH;
}
function readStoredHidden() {
  try {
    return localStorage.getItem(HIDDEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function cellKey(rowNumber, colIndex) {
  return `${rowNumber}:${colIndex}`;
}
function shortenTicketId(idText) {
  const trimmed = idText.trim();
  if (trimmed.length <= 7) return trimmed;
  const tailMatch = /(?:^|[-_#])([A-Za-z]?\d{1,4})$/.exec(trimmed);
  if (tailMatch) return `#${tailMatch[1]}`;
  return trimmed.slice(-6);
}
function getStatusTone(row) {
  const text = row.cells.join(" ");
  if (/已完成|已关闭|已解决|done|closed|resolved/i.test(text)) return "ok";
  if (/p0|p1|紧急|严重|critical|urgent|blocker/i.test(text)) return "err";
  if (/p2|高|待处理|待确认|high|pending/i.test(text)) return "warn";
  return "accent";
}
function collectDirtyEdits(snapshot, drafts) {
  if (!snapshot) return [];
  const edits = [];
  for (const row of snapshot.rows) {
    for (let colOffset = 0; colOffset < row.cells.length; colOffset += 1) {
      const colIndex = colOffset + 2;
      const key = cellKey(row.rowNumber, colIndex);
      if (Object.hasOwn(drafts, key) && drafts[key] !== row.cells[colOffset]) {
        edits.push({ rowNumber: row.rowNumber, colIndex, value: drafts[key] });
      }
    }
  }
  return edits;
}
var MAX_TEXTAREA_HEIGHT = 280;
function syncTextareaHeight(el) {
  el.style.height = "0px";
  const rawHeight = el.scrollHeight;
  const nextHeight = Math.min(Math.max(rawHeight, 28), MAX_TEXTAREA_HEIGHT);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = rawHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
}
function AutoTextarea({
  value,
  flash,
  placeholder,
  ariaLabel,
  onChange,
  onBlur,
  onKeyDown
}) {
  const ref = (0, import_react.useRef)(null);
  (0, import_react.useLayoutEffect)(() => {
    if (ref.current) syncTextareaHeight(ref.current);
  }, [value]);
  (0, import_react.useEffect)(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      syncTextareaHeight(el);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "textarea",
    {
      ref,
      rows: 1,
      className: "idw-textarea",
      "aria-label": ariaLabel,
      "data-flash": flash,
      value,
      placeholder,
      onChange: (e) => onChange(e.target.value),
      onBlur: (e) => onBlur(e.currentTarget.value),
      onKeyDown
    }
  );
}
function IncidentDrawer({ rpcCall }) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [hidden, setHidden] = (0, import_react.useState)(readStoredHidden);
  const [settingsOpen, setSettingsOpen] = (0, import_react.useState)(false);
  const [pathInput, setPathInput] = (0, import_react.useState)("");
  const [expandedRow, setExpandedRow] = (0, import_react.useState)(null);
  const [hoveredRow, setHoveredRow] = (0, import_react.useState)(null);
  const [expandedWidth, setExpandedWidth] = (0, import_react.useState)(readStoredWidth);
  const [resizing, setResizing] = (0, import_react.useState)(false);
  const [nowTick, setNowTick] = (0, import_react.useState)(() => Date.now());
  const [drafts, setDrafts] = (0, import_react.useState)({});
  const [fieldStatus, setFieldStatus] = (0, import_react.useState)({});
  const [fieldErrors, setFieldErrors] = (0, import_react.useState)({});
  const [stale, setStale] = (0, import_react.useState)(false);
  const [conflict, setConflict] = (0, import_react.useState)(false);
  const [confirmRefresh, setConfirmRefresh] = (0, import_react.useState)(false);
  const [bannerError, setBannerError] = (0, import_react.useState)(null);
  const [globalSavedPulse, setGlobalSavedPulse] = (0, import_react.useState)(false);
  const snapshotRef = (0, import_react.useRef)(null);
  const draftsRef = (0, import_react.useRef)({});
  const versionRef = (0, import_react.useRef)(null);
  const conflictRef = (0, import_react.useRef)(false);
  const saveQueueRef = (0, import_react.useRef)(Promise.resolve());
  const hoverInTimerRef = (0, import_react.useRef)(null);
  const hoverOutTimerRef = (0, import_react.useRef)(null);
  const flashTimersRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const savedPulseTimerRef = (0, import_react.useRef)(null);
  const cardRefs = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  snapshotRef.current = snapshot;
  draftsRef.current = drafts;
  conflictRef.current = conflict;
  const dirtyEdits = (0, import_react.useMemo)(() => collectDirtyEdits(snapshot, drafts), [snapshot, drafts]);
  const hasDirty = dirtyEdits.length > 0;
  const hasSaving = Object.values(fieldStatus).some((s) => s === "saving");
  const hasFieldError = Object.values(fieldStatus).some((s) => s === "error");
  const categoryOptions = snapshot?.categoryOptions ?? DEFAULT_SERVICE_CATEGORIES;
  const slaColOffset = (0, import_react.useMemo)(() => {
    const idx = (snapshot?.headers ?? []).findIndex((h, i) => i > 0 && isSlaHeader(h));
    return idx > 0 ? idx - 1 : -1;
  }, [snapshot?.headers]);
  const categoryColOffset = (0, import_react.useMemo)(() => {
    const idx = (snapshot?.headers ?? []).findIndex((h, i) => i > 0 && isServiceCategoryHeader(h));
    return idx > 0 ? idx - 1 : -1;
  }, [snapshot?.headers]);
  const subCategoryColOffset = (0, import_react.useMemo)(() => {
    const idx = (snapshot?.headers ?? []).findIndex((h, i) => i > 0 && isServiceSubCategoryHeader(h));
    return idx > 0 ? idx - 1 : -1;
  }, [snapshot?.headers]);
  const nowDate = (0, import_react.useMemo)(() => new Date(nowTick), [nowTick]);
  (0, import_react.useEffect)(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 6e4);
    return () => window.clearInterval(timer);
  }, []);
  const getCellDisplayValue = (0, import_react.useCallback)((row, colOffset) => {
    if (colOffset < 0 || colOffset >= row.cells.length) return "";
    const k = cellKey(row.rowNumber, colOffset + 2);
    return Object.hasOwn(drafts, k) ? drafts[k] : row.cells[colOffset] ?? "";
  }, [drafts]);
  const getRowSla = (0, import_react.useCallback)((row) => {
    if (slaColOffset < 0) return null;
    return evaluateSla(getCellDisplayValue(row, slaColOffset), nowDate);
  }, [getCellDisplayValue, nowDate, slaColOffset]);
  const clearHoverTimers = (0, import_react.useCallback)(() => {
    if (hoverInTimerRef.current !== null) {
      window.clearTimeout(hoverInTimerRef.current);
      hoverInTimerRef.current = null;
    }
    if (hoverOutTimerRef.current !== null) {
      window.clearTimeout(hoverOutTimerRef.current);
      hoverOutTimerRef.current = null;
    }
  }, []);
  (0, import_react.useEffect)(() => () => {
    clearHoverTimers();
    for (const timer of flashTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    if (savedPulseTimerRef.current !== null) {
      window.clearTimeout(savedPulseTimerRef.current);
    }
  }, [clearHoverTimers]);
  const triggerGlobalSavedPulse = (0, import_react.useCallback)(() => {
    setGlobalSavedPulse(true);
    if (savedPulseTimerRef.current !== null) {
      window.clearTimeout(savedPulseTimerRef.current);
    }
    savedPulseTimerRef.current = window.setTimeout(() => {
      setGlobalSavedPulse(false);
      savedPulseTimerRef.current = null;
    }, 2600);
  }, []);
  const markFieldSaved = (0, import_react.useCallback)((key) => {
    const prevTimer = flashTimersRef.current.get(key);
    if (prevTimer !== void 0) window.clearTimeout(prevTimer);
    setFieldStatus((prev) => ({ ...prev, [key]: "saved" }));
    const timer = window.setTimeout(() => {
      flashTimersRef.current.delete(key);
      setFieldStatus((prev) => {
        if (prev[key] !== "saved") return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 900);
    flashTimersRef.current.set(key, timer);
  }, []);
  const applySnapshot = (0, import_react.useCallback)((next) => {
    snapshotRef.current = next;
    versionRef.current = next.version;
    setSnapshot(next);
    setPathInput(next.excelPath);
    setDrafts({});
    setFieldStatus({});
    setFieldErrors({});
    setStale(false);
    setConflict(false);
    setConfirmRefresh(false);
    setBannerError(null);
    setExpandedRow((prev) => prev !== null && next.rows.some((r) => r.rowNumber === prev) ? prev : null);
  }, []);
  const loadData = (0, import_react.useCallback)(async (sheetName) => {
    setLoading(true);
    setBannerError(null);
    try {
      const next = await rpcCall("load", sheetName ? { sheetName } : {});
      applySnapshot(next);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "\u52A0\u8F7D\u4E8B\u4EF6\u5355\u5931\u8D25");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, rpcCall]);
  (0, import_react.useEffect)(() => {
    void loadData();
  }, [loadData]);
  const checkStatus = (0, import_react.useCallback)(async () => {
    if (loading || !snapshotRef.current?.exists) return;
    try {
      const res = await rpcCall("check-status", {
        knownVersion: versionRef.current
      });
      if (res.stale) {
        setStale(true);
        if (collectDirtyEdits(snapshotRef.current, draftsRef.current).length > 0) {
          setConflict(true);
        }
      }
    } catch {
    }
  }, [loading, rpcCall]);
  (0, import_react.useEffect)(() => {
    if (hidden) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkStatus();
      }
    }, POLL_INTERVAL_MS);
    const onFocus = () => {
      void checkStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkStatus, hidden]);
  const enqueueSave = (0, import_react.useCallback)((task) => {
    const next = saveQueueRef.current.catch(() => void 0).then(task);
    saveQueueRef.current = next;
    return next;
  }, []);
  const saveCell = (0, import_react.useCallback)((rowNumber, colIndex, value, forceOverwrite = false) => {
    return enqueueSave(async () => {
      const snap = snapshotRef.current;
      if (!snap || !snap.activeSheet) return false;
      const targetRow = snap.rows.find((r) => r.rowNumber === rowNumber);
      if (!targetRow) return false;
      const committed = targetRow.cells[colIndex - 2];
      const key = cellKey(rowNumber, colIndex);
      if (value === committed && fieldStatus[key] !== "error") {
        setDrafts((prev) => {
          if (!Object.hasOwn(prev, key)) return prev;
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        return true;
      }
      if (conflictRef.current && !forceOverwrite) {
        setFieldStatus((prev) => ({ ...prev, [key]: "error" }));
        setFieldErrors((prev) => ({ ...prev, [key]: "Excel \u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5148\u5237\u65B0\u6216\u9009\u62E9\u8986\u76D6" }));
        return false;
      }
      setFieldStatus((prev) => ({ ...prev, [key]: "saving" }));
      setFieldErrors((prev) => {
        if (!Object.hasOwn(prev, key)) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      try {
        const res = await rpcCall("save-cell", {
          sheetName: snap.activeSheet,
          rowNumber,
          colIndex,
          value,
          expectedVersion: versionRef.current,
          forceOverwrite
        });
        if (res.saved) {
          versionRef.current = res.version;
          setSnapshot((prev) => {
            if (!prev) return prev;
            const updatedRows = prev.rows.map((row) => {
              if (row.rowNumber !== rowNumber) return row;
              const nextCells = [...row.cells];
              nextCells[colIndex - 2] = value;
              return { ...row, cells: nextCells };
            });
            return { ...prev, rows: updatedRows, version: res.version };
          });
          setDrafts((prev) => {
            if (prev[key] !== value) return prev;
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
          setStale(false);
          setConflict(false);
          setBannerError(null);
          markFieldSaved(key);
          triggerGlobalSavedPulse();
          return true;
        }
        if (res.conflict) {
          setStale(true);
          setConflict(true);
          setFieldStatus((prev) => ({ ...prev, [key]: "error" }));
          setFieldErrors((prev) => ({ ...prev, [key]: "\u786C\u76D8 Excel \u5DF2\u66F4\u65B0\uFF0C\u81EA\u52A8\u4FDD\u5B58\u5DF2\u6682\u505C" }));
          return false;
        }
        setFieldStatus((prev) => ({ ...prev, [key]: "error" }));
        setFieldErrors((prev) => ({ ...prev, [key]: res.error ?? "\u4FDD\u5B58\u5931\u8D25" }));
        return false;
      } catch (err) {
        setFieldStatus((prev) => ({ ...prev, [key]: "error" }));
        setFieldErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : "\u4FDD\u5B58\u5931\u8D25" }));
        return false;
      }
    });
  }, [enqueueSave, fieldStatus, markFieldSaved, rpcCall, triggerGlobalSavedPulse]);
  const saveAllDirty = (0, import_react.useCallback)((forceOverwrite = false) => {
    return enqueueSave(async () => {
      const snap = snapshotRef.current;
      if (!snap || !snap.activeSheet) return false;
      const edits = collectDirtyEdits(snap, draftsRef.current);
      if (edits.length === 0) {
        setBannerError(null);
        return true;
      }
      if (conflictRef.current && !forceOverwrite) {
        return false;
      }
      setFieldStatus((prev) => {
        const next = { ...prev };
        for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = "saving";
        return next;
      });
      try {
        const res = await rpcCall("save-batch", {
          sheetName: snap.activeSheet,
          edits,
          expectedVersion: versionRef.current,
          forceOverwrite
        });
        if (res.saved) {
          versionRef.current = res.version;
          const editMap = new Map(edits.map((e) => [cellKey(e.rowNumber, e.colIndex), e.value]));
          setSnapshot((prev) => {
            if (!prev) return prev;
            const updatedRows = prev.rows.map((row) => {
              const nextCells = [...row.cells];
              let touched = false;
              for (let colOffset = 0; colOffset < row.cells.length; colOffset += 1) {
                const k = cellKey(row.rowNumber, colOffset + 2);
                const v = editMap.get(k);
                if (v !== void 0) {
                  nextCells[colOffset] = v;
                  touched = true;
                }
              }
              return touched ? { ...row, cells: nextCells } : row;
            });
            return { ...prev, rows: updatedRows, version: res.version };
          });
          setDrafts((prev) => {
            const copy = { ...prev };
            for (const edit of edits) {
              const k = cellKey(edit.rowNumber, edit.colIndex);
              if (copy[k] === edit.value) delete copy[k];
            }
            return copy;
          });
          setFieldErrors((prev) => {
            const copy = { ...prev };
            for (const edit of edits) delete copy[cellKey(edit.rowNumber, edit.colIndex)];
            return copy;
          });
          for (const edit of edits) {
            markFieldSaved(cellKey(edit.rowNumber, edit.colIndex));
          }
          setStale(false);
          setConflict(false);
          setBannerError(null);
          triggerGlobalSavedPulse();
          return true;
        }
        if (res.conflict) {
          setStale(true);
          setConflict(true);
          setFieldStatus((prev) => {
            const next = { ...prev };
            for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = "error";
            return next;
          });
          return false;
        }
        setFieldStatus((prev) => {
          const next = { ...prev };
          for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = "error";
          return next;
        });
        setBannerError(res.error ?? "\u4FDD\u5B58\u5931\u8D25");
        return false;
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : "\u4FDD\u5B58\u5931\u8D25");
        return false;
      }
    });
  }, [enqueueSave, markFieldSaved, rpcCall, triggerGlobalSavedPulse]);
  const saveEditsBatch = (0, import_react.useCallback)((edits) => {
    if (edits.length === 0) return Promise.resolve(true);
    if (edits.length === 1) {
      return saveCell(edits[0].rowNumber, edits[0].colIndex, edits[0].value, false);
    }
    return enqueueSave(async () => {
      const snap = snapshotRef.current;
      if (!snap || !snap.activeSheet) return false;
      if (conflictRef.current) return false;
      setFieldStatus((prev) => {
        const next = { ...prev };
        for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = "saving";
        return next;
      });
      try {
        const res = await rpcCall("save-batch", {
          sheetName: snap.activeSheet,
          edits,
          expectedVersion: versionRef.current,
          forceOverwrite: false
        });
        if (res.saved) {
          versionRef.current = res.version;
          const editMap = new Map(edits.map((e) => [cellKey(e.rowNumber, e.colIndex), e.value]));
          setSnapshot((prev) => {
            if (!prev) return prev;
            const updatedRows = prev.rows.map((r) => {
              const nextCells = [...r.cells];
              let touched = false;
              for (let c = 0; c < r.cells.length; c += 1) {
                const v = editMap.get(cellKey(r.rowNumber, c + 2));
                if (v !== void 0) {
                  nextCells[c] = v;
                  touched = true;
                }
              }
              return touched ? { ...r, cells: nextCells } : r;
            });
            return { ...prev, rows: updatedRows, version: res.version };
          });
          setDrafts((prev) => {
            const copy = { ...prev };
            for (const edit of edits) {
              const k = cellKey(edit.rowNumber, edit.colIndex);
              if (copy[k] === edit.value) delete copy[k];
            }
            return copy;
          });
          for (const edit of edits) markFieldSaved(cellKey(edit.rowNumber, edit.colIndex));
          setStale(false);
          setConflict(false);
          setBannerError(null);
          triggerGlobalSavedPulse();
          return true;
        }
        if (res.conflict) {
          setStale(true);
          setConflict(true);
        }
        setFieldStatus((prev) => {
          const next = { ...prev };
          for (const edit of edits) next[cellKey(edit.rowNumber, edit.colIndex)] = "error";
          return next;
        });
        return false;
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : "\u4FDD\u5B58\u5931\u8D25");
        return false;
      }
    });
  }, [enqueueSave, markFieldSaved, rpcCall, saveCell, triggerGlobalSavedPulse]);
  const handleRefreshClick = (0, import_react.useCallback)(() => {
    if (hasDirty && !stale) {
      setConfirmRefresh(true);
      return;
    }
    void loadData(snapshotRef.current?.activeSheet ?? void 0);
  }, [hasDirty, loadData, stale]);
  const handleToggleHidden = (0, import_react.useCallback)((nextHidden) => {
    setHidden(nextHidden);
    setSettingsOpen(false);
    try {
      localStorage.setItem(HIDDEN_STORAGE_KEY, nextHidden ? "1" : "0");
    } catch {
    }
  }, []);
  const handleRowMouseEnter = (0, import_react.useCallback)((rowNumber) => {
    if (expandedRow === rowNumber) return;
    clearHoverTimers();
    if (hoveredRow !== null) {
      setHoveredRow(rowNumber);
      return;
    }
    hoverInTimerRef.current = window.setTimeout(() => {
      hoverInTimerRef.current = null;
      setHoveredRow(rowNumber);
    }, HOVER_IN_DELAY_MS);
  }, [clearHoverTimers, expandedRow, hoveredRow]);
  const handleRowMouseLeave = (0, import_react.useCallback)((rowNumber) => {
    clearHoverTimers();
    hoverOutTimerRef.current = window.setTimeout(() => {
      hoverOutTimerRef.current = null;
      setHoveredRow((prev) => prev === rowNumber ? null : prev);
    }, HOVER_OUT_DELAY_MS);
  }, [clearHoverTimers]);
  const handleToggleExpand = (0, import_react.useCallback)((rowNumber) => {
    if (window.getSelection()?.toString()) return;
    clearHoverTimers();
    setHoveredRow(null);
    if (expandedRow === rowNumber) {
      setExpandedRow(null);
      return;
    }
    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur();
    }
    setExpandedRow(rowNumber);
    window.setTimeout(() => {
      cardRefs.current.get(rowNumber)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 250);
  }, [clearHoverTimers, expandedRow]);
  const handleOpenHyperlink = (0, import_react.useCallback)((e, url) => {
    e.stopPropagation();
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);
  const handleStartResize = (0, import_react.useCallback)((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = expandedWidth;
    setResizing(true);
    const onMove = (ev) => {
      const delta = startX - ev.clientX;
      const maxAllowed = Math.min(MAX_EXPANDED_WIDTH, Math.max(MIN_EXPANDED_WIDTH, window.innerWidth - 80));
      const clamped = Math.round(Math.min(maxAllowed, Math.max(MIN_EXPANDED_WIDTH, startWidth + delta)));
      setExpandedWidth(clamped);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setResizing(false);
      setExpandedWidth((current) => {
        try {
          localStorage.setItem(WIDTH_STORAGE_KEY, String(current));
        } catch {
        }
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [expandedWidth]);
  const handleApplyPath = (0, import_react.useCallback)(async () => {
    const trimmed = pathInput.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const next = await rpcCall("set-config", { excelPath: trimmed });
      applySnapshot(next);
      setSettingsOpen(false);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "\u66F4\u65B0\u8DEF\u5F84\u5931\u8D25");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, pathInput, rpcCall]);
  const handleSwitchSheet = (0, import_react.useCallback)(async (nextSheet) => {
    if (!nextSheet) return;
    if (hasDirty && !conflict) {
      const ok = await saveAllDirty(false);
      if (!ok) return;
    }
    setLoading(true);
    try {
      const next = await rpcCall("set-config", {
        excelPath: snapshotRef.current?.excelPath ?? pathInput.trim(),
        preferredSheet: nextSheet
      });
      applySnapshot(next);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "\u5207\u6362\u5DE5\u4F5C\u8868\u5931\u8D25");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, conflict, hasDirty, pathInput, rpcCall, saveAllDirty]);
  const handleCreateSample = (0, import_react.useCallback)(async () => {
    setLoading(true);
    try {
      const next = await rpcCall("create-sample", {
        excelPath: pathInput.trim() || void 0
      });
      applySnapshot(next);
      setSettingsOpen(false);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "\u751F\u6210\u793A\u4F8B Excel \u5931\u8D25");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, pathInput, rpcCall]);
  if (hidden) {
    const alertDotColor = hasFieldError || conflict ? "var(--idw-err-fg)" : stale ? "var(--idw-warn-border)" : hasDirty ? "var(--idw-accent)" : null;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "idw-root", style: { pointerEvents: "none" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: "idw-peek",
        title: "\u5C55\u5F00\u53F3\u4FA7\u4E8B\u4EF6\u5355\u9762\u677F",
        onClick: () => handleToggleHidden(false),
        children: [
          alertDotColor && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-peek-dot", style: { background: alertDotColor } }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PeekLeftIcon, {})
        ]
      }
    ) });
  }
  let statusBtnState = "idle";
  let statusDotTone = "ok";
  let statusLabel = "\u5DF2\u4FDD\u5B58";
  if (loading) {
    statusDotTone = "busy";
    statusLabel = "\u52A0\u8F7D\u4E2D";
  } else if (hasSaving) {
    statusDotTone = "busy";
    statusLabel = "\u4FDD\u5B58\u4E2D";
  } else if (conflict) {
    statusBtnState = "error";
    statusDotTone = "warn";
    statusLabel = "\u6709\u51B2\u7A81";
  } else if (hasFieldError || bannerError) {
    statusBtnState = "error";
    statusDotTone = "err";
    statusLabel = "\u91CD\u8BD5\u4FDD\u5B58";
  } else if (hasDirty) {
    statusBtnState = "dirty";
    statusDotTone = "accent";
    statusLabel = `\u4FDD\u5B58(${dirtyEdits.length})`;
  } else if (globalSavedPulse) {
    statusBtnState = "saved";
    statusDotTone = "ok";
    statusLabel = "\u5DF2\u4FDD\u5B58";
  } else if (snapshot?.activeSheet) {
    statusDotTone = stale ? "warn" : "ok";
    statusLabel = snapshot.activeSheet;
  }
  const rootVars = {
    "--idw-expanded-width": `${expandedWidth}px`,
    pointerEvents: "none"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-root", style: rootVars, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        className: "idw-toolbar",
        "data-active": String(settingsOpen || hasDirty || stale || hasFieldError),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              type: "button",
              className: "idw-status-btn",
              "data-state": statusBtnState,
              title: hasDirty || hasFieldError ? "\u70B9\u51FB\u7ACB\u5373\u4FDD\u5B58\u4FEE\u6539\u5230 Excel" : "\u5F53\u524D\u81EA\u52A8\u4FDD\u5B58\u72B6\u6001\uFF08\u5931\u7126\u81EA\u52A8\u4FDD\u5B58\uFF09",
              onClick: () => {
                if (hasDirty || hasFieldError) {
                  void saveAllDirty(false);
                } else {
                  void checkStatus();
                }
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-dot", "data-tone": statusDotTone }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: statusLabel })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              type: "button",
              className: "idw-icon-btn",
              title: stale ? "\u68C0\u6D4B\u5230\u786C\u76D8 Excel \u5DF2\u66F4\u65B0\uFF0C\u70B9\u51FB\u5237\u65B0" : "\u4ECE\u786C\u76D8\u5237\u65B0 Excel",
              disabled: loading,
              onClick: handleRefreshClick,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RefreshIcon, { spinning: loading }),
                stale && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-badge-dot" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "idw-icon-btn",
              title: "Excel \u8DEF\u5F84\u4E0E\u65E5\u671F\u5DE5\u4F5C\u8868\u8BBE\u7F6E",
              onClick: () => setSettingsOpen((v) => !v),
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SettingsIcon, {})
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "idw-icon-btn",
              title: "\u6536\u8D77\u81F3\u53F3\u8FB9\u7F18",
              onClick: () => handleToggleHidden(true),
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CollapseRightIcon, {})
            }
          )
        ]
      }
    ),
    confirmRefresh && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-banner", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(WarnIcon, {}),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-banner-text", children: "\u5F53\u524D\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5237\u65B0\u5C06\u4E22\u5F03\u672A\u843D\u76D8\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-banner-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "idw-mini-pill",
            "data-primary": "true",
            onClick: () => {
              setConfirmRefresh(false);
              void loadData(snapshot?.activeSheet ?? void 0);
            },
            children: "\u5237\u65B0"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "idw-mini-pill",
            onClick: () => setConfirmRefresh(false),
            children: "\u53D6\u6D88"
          }
        )
      ] })
    ] }),
    !confirmRefresh && (stale || conflict) && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-banner", "data-tone": conflict ? "error" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(WarnIcon, {}),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-banner-text", children: conflict ? "\u786C\u76D8 Excel \u5DF2\u6709\u66F4\u65B0\uFF0C\u5B58\u5728\u672C\u5730\u4FEE\u6539\uFF0C\u81EA\u52A8\u4FDD\u5B58\u5DF2\u6682\u505C" : "\u68C0\u6D4B\u5230 Excel \u5DF2\u66F4\u65B0\uFF0C\u5F53\u524D\u975E\u6700\u65B0\u6570\u636E\uFF0C\u8BF7\u5148\u5237\u65B0" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-banner-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "idw-mini-pill",
            "data-primary": !conflict,
            onClick: () => void loadData(snapshot?.activeSheet ?? void 0),
            children: conflict ? "\u653E\u5F03\u5E76\u5237\u65B0" : "\u5237\u65B0"
          }
        ),
        conflict && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "idw-mini-pill",
            "data-primary": "true",
            onClick: () => void saveAllDirty(true),
            children: "\u8986\u76D6\u4FDD\u5B58"
          }
        )
      ] })
    ] }),
    bannerError && !conflict && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-banner", "data-tone": "error", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(WarnIcon, {}),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-banner-text", children: bannerError }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          className: "idw-mini-pill",
          onClick: () => setBannerError(null),
          children: "\u5173\u95ED"
        }
      )
    ] }),
    settingsOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u4E8B\u4EF6\u5355\u6570\u636E\u6E90\u8BBE\u7F6E" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "idw-mini-pill",
            onClick: () => setSettingsOpen(false),
            children: "\u5173\u95ED"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings-label", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            "\u5DE5\u4F5C\u8868\uFF08\u9ED8\u8BA4\u5339\u914D\u5F53\u65E5 ",
            snapshot?.todaySheetName ?? "",
            "\uFF09"
          ] }),
          snapshot && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            "\u5171 ",
            snapshot.totalDataRows,
            " \u6761 \xB7 \u5C55\u793A\u524D ",
            snapshot.rows.length,
            " \u6761"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "select",
          {
            className: "idw-select",
            value: snapshot?.activeSheet ?? "",
            disabled: !snapshot || snapshot.sheets.length === 0,
            onChange: (e) => void handleSwitchSheet(e.target.value),
            children: [
              !snapshot?.activeSheet && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "\u8BF7\u9009\u62E9\u5DE5\u4F5C\u8868..." }),
              (snapshot?.sheets ?? []).map((name) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: name, children: [
                name,
                name === snapshot?.todaySheetName ? "\uFF08\u4ECA\u65E5\uFF09" : ""
              ] }, name))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "idw-settings-label", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u672C\u5730 Excel \u6587\u4EF6\u8DEF\u5F84 (.xlsx)" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings-input-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "text",
              className: "idw-input",
              value: pathInput,
              placeholder: "\u4F8B\u5982 D:\\Tickets\\incidents.xlsx",
              onChange: (e) => setPathInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") void handleApplyPath();
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "idw-btn",
              "data-primary": "true",
              onClick: () => void handleApplyPath(),
              children: "\u5E94\u7528"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-settings-input-row", style: { justifyContent: "space-between", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { fontSize: 11, color: "var(--idw-label-3)" }, children: [
          "\u5C55\u5F00\u5361\u7247\u5DE6\u8FB9\u7F18\u53EF\u62D6\u62FD\u8C03\u6574\u5BBD\u5EA6 (",
          expandedWidth,
          "px)"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "idw-btn",
            onClick: () => void handleCreateSample(),
            children: "\u751F\u6210\u793A\u4F8B\u8868"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-list", children: [
      snapshot && (!snapshot.exists || snapshot.rows.length === 0) && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-empty-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: snapshot.error ?? `\u5DE5\u4F5C\u8868 "${snapshot.activeSheet ?? ""}" \u6682\u65E0\u4E8B\u4EF6\u5355\u6570\u636E` }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-banner-actions", children: [
          !snapshot.exists && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "idw-btn",
              "data-primary": "true",
              onClick: () => void handleCreateSample(),
              children: "\u751F\u6210\u793A\u4F8B Excel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "idw-btn",
              onClick: () => setSettingsOpen(true),
              children: "\u6253\u5F00\u8BBE\u7F6E"
            }
          )
        ] })
      ] }),
      (snapshot?.rows ?? []).map((row) => {
        const isExpanded = expandedRow === row.rowNumber;
        const isHovered = !isExpanded && hoveredRow === row.rowNumber;
        const cardState = isExpanded ? "expanded" : isHovered ? "hover" : "collapsed";
        const rowSla = getRowSla(row);
        const rowHasDirty = row.cells.some((cellVal, colOffset) => {
          const k = cellKey(row.rowNumber, colOffset + 2);
          return Object.hasOwn(drafts, k) && drafts[k] !== cellVal;
        });
        const dotTone = rowSla ? rowSla.tone : rowHasDirty ? "accent" : getStatusTone(row);
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            ref: (el) => {
              if (el) cardRefs.current.set(row.rowNumber, el);
              else cardRefs.current.delete(row.rowNumber);
            },
            className: "idw-card",
            "data-state": cardState,
            "data-resizing": isExpanded && resizing ? "true" : void 0,
            onMouseEnter: () => handleRowMouseEnter(row.rowNumber),
            onMouseLeave: () => handleRowMouseLeave(row.rowNumber),
            children: [
              isExpanded && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "div",
                {
                  className: "idw-resize-handle",
                  title: "\u5DE6\u53F3\u62D6\u62FD\u8C03\u6574\u5361\u7247\u5BBD\u5EA6",
                  onPointerDown: handleStartResize
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "div",
                {
                  className: "idw-card-head",
                  onClick: () => handleToggleExpand(row.rowNumber),
                  title: cardState === "collapsed" ? rowSla ? `${row.idText}
SLA: ${rowSla.label}` : row.idText : void 0,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "span",
                      {
                        className: "idw-dot",
                        "data-tone": dotTone,
                        title: rowSla ? `SLA: ${rowSla.label}` : void 0
                      }
                    ),
                    cardState === "collapsed" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-id-short", children: shortenTicketId(row.idText) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-id-full", title: row.idText, children: row.idText }),
                    isHovered && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "idw-hover-hint", children: [
                      rowSla && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-mini-sla", "data-tone": rowSla.tone, children: rowSla.shortLabel }),
                      row.hyperlink && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ExternalLinkIcon, {}),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDownIcon, {})
                    ] }),
                    isExpanded && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-head-actions", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: "idw-open-link",
                          disabled: !row.hyperlink,
                          title: row.hyperlink ?? "\u8BE5\u4E8B\u4EF6\u5355\u672A\u914D\u7F6E\u8D85\u94FE\u63A5",
                          onClick: (e) => handleOpenHyperlink(e, row.hyperlink),
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ExternalLinkIcon, {}),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u6253\u5F00" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-chevron", title: "\u6536\u8D77", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDownIcon, {}) })
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "idw-accordion", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "idw-accordion-inner", children: isExpanded && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "idw-form", children: (() => {
                const hasCategoryPair = categoryColOffset >= 0 && subCategoryColOffset >= 0;
                const firstCategoryOffset = hasCategoryPair ? Math.min(categoryColOffset, subCategoryColOffset) : -1;
                const secondCategoryOffset = hasCategoryPair ? Math.max(categoryColOffset, subCategoryColOffset) : -1;
                const renderCategoryDropdown = (offset, isParent) => {
                  const colIndex = offset + 2;
                  const key = cellKey(row.rowNumber, colIndex);
                  const headerName = snapshot?.headers[colIndex - 1] ?? (isParent ? "\u670D\u52A1\u5206\u7C7B" : "\u670D\u52A1\u5B50\u5206\u7C7B");
                  const value = getCellDisplayValue(row, offset);
                  const status = fieldStatus[key];
                  const errText = fieldErrors[key];
                  const flash = status === "saved" || status === "error" ? status : void 0;
                  const parentValue = categoryColOffset >= 0 ? getCellDisplayValue(row, categoryColOffset).trim() : "";
                  const baseOptions = isParent ? Object.keys(categoryOptions) : parentValue ? categoryOptions[parentValue] ?? [] : [];
                  const optionList = value.trim() !== "" && !baseOptions.includes(value.trim()) ? [value.trim(), ...baseOptions] : baseOptions;
                  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field-head", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-field-label", title: headerName, children: headerName }),
                      status === "saving" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-field-state", "data-state": "saving", children: "\u4FDD\u5B58\u4E2D..." }),
                      status === "saved" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-field-state", "data-state": "saved", children: "\u5DF2\u4FDD\u5B58" })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                      "select",
                      {
                        className: "idw-select",
                        "aria-label": headerName,
                        "data-flash": flash,
                        disabled: !isParent && !parentValue,
                        value: value.trim(),
                        onChange: (e) => {
                          const nextVal = e.target.value;
                          if (isParent) {
                            const nextSubs = categoryOptions[nextVal] ?? [];
                            const subColIdx = subCategoryColOffset + 2;
                            const subKey = cellKey(row.rowNumber, subColIdx);
                            const curSub = subCategoryColOffset >= 0 ? getCellDisplayValue(row, subCategoryColOffset).trim() : "";
                            const resetSub = subCategoryColOffset >= 0 && curSub !== "" && !nextSubs.includes(curSub);
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: nextVal,
                              ...resetSub ? { [subKey]: "" } : {}
                            }));
                            const edits = [{ rowNumber: row.rowNumber, colIndex, value: nextVal }];
                            if (resetSub) {
                              edits.push({ rowNumber: row.rowNumber, colIndex: subColIdx, value: "" });
                            }
                            void saveEditsBatch(edits);
                          } else {
                            setDrafts((prev) => ({ ...prev, [key]: nextVal }));
                            void saveCell(row.rowNumber, colIndex, nextVal, false);
                          }
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: isParent ? "\u9009\u62E9\u670D\u52A1\u5206\u7C7B..." : parentValue ? "\u9009\u62E9\u670D\u52A1\u5B50\u5206\u7C7B..." : "\u8BF7\u5148\u9009\u670D\u52A1\u5206\u7C7B" }),
                          optionList.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: opt, children: opt }, opt))
                        ]
                      }
                    ),
                    errText && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field-error", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: errText }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "idw-retry-link",
                          onClick: () => void saveCell(row.rowNumber, colIndex, value, conflict),
                          children: conflict ? "\u5F3A\u5236\u8986\u76D6" : "\u91CD\u8BD5"
                        }
                      )
                    ] })
                  ] }, key);
                };
                return row.cells.map((cellValue, colOffset) => {
                  if (hasCategoryPair && colOffset === secondCategoryOffset) {
                    return null;
                  }
                  if (hasCategoryPair && colOffset === firstCategoryOffset) {
                    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field-pair", children: [
                      renderCategoryDropdown(categoryColOffset, true),
                      renderCategoryDropdown(subCategoryColOffset, false)
                    ] }, `cat-pair-${row.rowNumber}`);
                  }
                  const colIndex = colOffset + 2;
                  const key = cellKey(row.rowNumber, colIndex);
                  const headerName = snapshot?.headers[colIndex - 1] ?? `\u5217 ${colIndex}`;
                  const value = Object.hasOwn(drafts, key) ? drafts[key] : cellValue;
                  const status = fieldStatus[key];
                  const errText = fieldErrors[key];
                  const flash = status === "saved" || status === "error" ? status : void 0;
                  const cellSla = colOffset === slaColOffset ? evaluateSla(value, nowDate) : null;
                  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field-head", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-field-label", title: headerName, children: headerName }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
                        cellSla && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-sla-pill", "data-tone": cellSla.tone, children: cellSla.label }),
                        status === "saving" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-field-state", "data-state": "saving", children: "\u4FDD\u5B58\u4E2D..." }),
                        status === "saved" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "idw-field-state", "data-state": "saved", children: "\u5DF2\u4FDD\u5B58" })
                      ] })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      AutoTextarea,
                      {
                        ariaLabel: headerName,
                        value,
                        flash,
                        placeholder: `\u8F93\u5165${headerName}...`,
                        onChange: (nextVal) => {
                          setDrafts((prev) => ({ ...prev, [key]: nextVal }));
                          if (fieldStatus[key] === "error") {
                            setFieldStatus((prev) => {
                              const copy = { ...prev };
                              delete copy[key];
                              return copy;
                            });
                          }
                        },
                        onBlur: (currentVal) => {
                          void saveCell(row.rowNumber, colIndex, currentVal, false);
                        },
                        onKeyDown: (e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                            e.preventDefault();
                            void saveCell(row.rowNumber, colIndex, e.currentTarget.value, false);
                          } else if (e.key === "Escape") {
                            e.currentTarget.blur();
                          }
                        }
                      }
                    ),
                    errText && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "idw-field-error", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: errText }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "idw-retry-link",
                          onClick: () => void saveCell(row.rowNumber, colIndex, value, conflict),
                          children: conflict ? "\u5F3A\u5236\u8986\u76D6" : "\u91CD\u8BD5"
                        }
                      )
                    ] })
                  ] }, key);
                });
              })() }) }) })
            ]
          },
          row.rowNumber
        );
      })
    ] })
  ] });
}

// src/client/styles.ts
var DRAWER_STYLE_ID = "dsh-plugin-incident-drawer/styles.css";
var DRAWER_PLUGIN_ID = "dsh-plugin-incident-drawer";
var DRAWER_CSS = `
/* Root container: click-through overlay anchored flush to the right edge.
 * IMPORTANT: AppFrame .overlayLayer > * sets pointer-events: auto, so we must
 * override to pointer-events: none !important on the root and wrapper, and
 * opt back in only on visible interactive pills/cards/buttons. */
.idw-root {
  position: fixed;
  top: 54px;
  right: 0;
  bottom: 84px;
  z-index: 42;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--dsw-alias-label-primary, rgb(15, 17, 21));
  -webkit-app-region: no-drag;
}

.idw-root * {
  box-sizing: border-box;
}

/* Hairline precision across 1x (100% Windows scaling) and HiDPI screens */
.idw-root {
  --idw-hairline: 0.5px;
  --idw-glass-bg: var(--dsw-menu-surface-fill, rgba(252, 253, 254, 0.86));
  --idw-tab-bg: var(--dsw-alias-bg-layer-1, rgb(255, 255, 255));
  --idw-tab-hover-bg: var(--dsw-alias-bg-layer-2, rgb(249, 250, 251));
  --idw-input-bg: var(--dsw-alias-bg-base, rgb(255, 255, 255));
  --idw-input-hover-bg: var(--dsw-alias-bg-module-platform, rgb(245, 246, 247));
  --idw-border: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  --idw-border-soft: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.09));
  --idw-border-input: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.16));
  --idw-accent: var(--dsw-alias-link, rgb(65, 118, 230));
  --idw-label-1: var(--dsw-alias-label-primary, rgb(15, 17, 21));
  --idw-label-2: var(--dsw-alias-label-secondary, rgb(97, 102, 107));
  --idw-label-3: var(--dsw-alias-label-tertiary, rgb(129, 133, 140));
  --idw-hover-fill: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.05));
  --idw-warn-fg: var(--dsw-alias-state-warn-label, rgb(202, 115, 18));
  --idw-warn-bg: var(--dsw-alias-state-warn-tertiary, rgb(254, 245, 231));
  --idw-warn-border: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11));
  --idw-ok-fg: var(--dsw-alias-state-success-primary, rgb(34, 197, 94));
  --idw-err-fg: var(--dsw-alias-state-error-primary, rgb(220, 38, 38));
  --idw-err-bg: rgba(239, 68, 68, 0.08);
  --idw-shadow-tab: -2px 2px 8px rgba(15, 23, 42, 0.05);
  --idw-shadow-hover: -8px 10px 26px rgba(15, 23, 42, 0.14), -2px 3px 8px rgba(15, 23, 42, 0.06);
  --idw-shadow-expanded: -14px 18px 44px rgba(15, 23, 42, 0.18), -3px 6px 14px rgba(15, 23, 42, 0.08);
  --idw-shadow-popover: -10px 14px 36px rgba(15, 23, 42, 0.16), -2px 4px 12px rgba(15, 23, 42, 0.06);
  --idw-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (max-resolution: 1.25dppx) {
  .idw-root {
    --idw-hairline: 1px;
  }
}

body[data-ds-dark-theme] .idw-root {
  --idw-glass-bg: rgba(40, 41, 46, 0.84);
  --idw-tab-bg: var(--dsw-alias-bg-layer-1, rgb(35, 35, 36));
  --idw-tab-hover-bg: var(--dsw-alias-bg-layer-2, rgb(44, 44, 46));
  --idw-input-bg: var(--dsw-alias-bg-base, rgb(24, 24, 27));
  --idw-input-hover-bg: var(--dsw-alias-bg-module-platform, rgb(48, 49, 54));
  --idw-border: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16));
  --idw-border-soft: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  --idw-border-input: var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.2));
  --idw-accent: var(--dsw-alias-link, rgb(122, 170, 255));
  --idw-label-1: var(--dsw-alias-label-primary, rgb(245, 246, 248));
  --idw-label-2: var(--dsw-alias-label-secondary, rgb(196, 200, 208));
  --idw-label-3: var(--dsw-alias-label-tertiary, rgb(148, 154, 164));
  --idw-hover-fill: rgba(255, 255, 255, 0.08);
  --idw-warn-fg: rgb(251, 191, 36);
  --idw-warn-bg: rgba(120, 74, 12, 0.42);
  --idw-warn-border: rgba(245, 158, 11, 0.6);
  --idw-err-fg: rgb(248, 113, 113);
  --idw-err-bg: rgba(127, 29, 29, 0.36);
  --idw-shadow-tab: -2px 2px 10px rgba(0, 0, 0, 0.32);
  --idw-shadow-hover: -8px 10px 28px rgba(0, 0, 0, 0.48), -2px 4px 10px rgba(0, 0, 0, 0.28);
  --idw-shadow-expanded: -14px 18px 48px rgba(0, 0, 0, 0.62), -3px 6px 16px rgba(0, 0, 0, 0.36);
  --idw-shadow-popover: -12px 16px 40px rgba(0, 0, 0, 0.56);
}

/* Zen Peek ear when drawer is hidden */
.idw-peek {
  pointer-events: auto;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 44px;
  margin-top: 4px;
  padding: 0;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  color: var(--idw-label-2);
  box-shadow: var(--idw-shadow-tab);
  cursor: pointer;
  opacity: 0.72;
  transition: width 180ms var(--idw-ease), opacity 180ms ease, background 150ms ease;
}

.idw-peek:hover {
  width: 24px;
  opacity: 1;
  color: var(--idw-label-1);
}

.idw-peek-dot {
  position: absolute;
  top: 5px;
  left: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

/* Top compact floating toolbar */
.idw-toolbar {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 6px 0 8px;
  border: var(--idw-hairline) solid var(--idw-border-soft);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--idw-shadow-tab);
  opacity: 0.88;
  transition: opacity 160ms ease, box-shadow 180ms ease;
}

.idw-toolbar:hover,
.idw-toolbar[data-active='true'] {
  opacity: 1;
  box-shadow: var(--idw-shadow-hover);
}

.idw-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--idw-label-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease, color 140ms ease;
}

.idw-status-btn:hover {
  background: var(--idw-hover-fill);
  color: var(--dsw-alias-label-primary, var(--idw-label-1));
}

.idw-status-btn[data-state='dirty'] {
  background: color-mix(in srgb, var(--idw-accent) 14%, transparent);
  color: var(--idw-accent);
}

.idw-status-btn[data-state='error'] {
  background: var(--idw-err-bg);
  color: var(--idw-err-fg);
}

.idw-status-btn[data-state='saved'] {
  color: var(--idw-ok-fg);
}

.idw-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--idw-label-3);
}

.idw-dot[data-tone='ok'] { background: var(--idw-ok-fg); }
.idw-dot[data-tone='busy'] { background: var(--idw-accent); animation: idw-pulse 1s infinite ease-in-out; }
.idw-dot[data-tone='warn'] { background: var(--idw-warn-border); }
.idw-dot[data-tone='err'] { background: var(--idw-err-fg); }
.idw-dot[data-tone='accent'] { background: var(--idw-accent); }

@keyframes idw-pulse {
  0%, 100% { opacity: 0.45; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

.idw-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--idw-label-2);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.idw-icon-btn:hover {
  background: var(--idw-hover-fill);
  color: var(--idw-label-1);
}

.idw-icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.idw-badge-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--idw-warn-border);
}

.idw-spin {
  animation: idw-spin 0.8s linear infinite;
}

@keyframes idw-spin {
  to { transform: rotate(360deg); }
}

/* Alert / Conflict / Empty / Confirm Banners */
.idw-banner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 10px 6px 11px;
  max-width: 340px;
  border: var(--idw-hairline) solid var(--idw-warn-border);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--idw-warn-bg);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  color: var(--idw-warn-fg);
  font-size: 11.5px;
  line-height: 1.35;
  box-shadow: var(--idw-shadow-hover);
}

.idw-banner[data-tone='error'] {
  border-color: var(--idw-err-fg);
  background: var(--idw-glass-bg);
  color: var(--idw-err-fg);
}

.idw-banner-text {
  flex: 1;
  min-width: 0;
}

.idw-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.idw-mini-pill {
  height: 20px;
  padding: 0 7px;
  border: var(--idw-hairline) solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease;
}

.idw-mini-pill:hover {
  background: var(--idw-hover-fill);
}

.idw-mini-pill[data-primary='true'] {
  background: var(--idw-accent);
  border-color: var(--idw-accent);
  color: #fff;
}

.idw-mini-pill[data-primary='true']:hover {
  filter: brightness(1.08);
}

/* Settings Popover */
.idw-settings {
  pointer-events: auto;
  width: 320px;
  max-width: calc(100vw - 24px);
  margin-top: 6px;
  padding: 12px 13px;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 12px 0 0 12px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: var(--idw-shadow-popover);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 50;
}

.idw-settings-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--idw-label-1);
}

.idw-settings-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.idw-settings-label {
  font-size: 11px;
  color: var(--idw-label-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.idw-settings-input-row {
  display: flex;
  gap: 6px;
}

.idw-input,
.idw-select {
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: var(--idw-hairline) solid var(--idw-border-input);
  border-radius: 6px;
  background: var(--idw-input-bg);
  color: var(--idw-label-1);
  font-family: inherit;
  font-size: 12px;
  outline: none;
  transition: box-shadow 140ms ease, background 140ms ease;
}

.idw-input:focus,
.idw-select:focus {
  box-shadow: inset 0 0 0 1px var(--idw-accent), 0 0 0 2px color-mix(in srgb, var(--idw-accent) 16%, transparent);
}

.idw-btn {
  height: 28px;
  padding: 0 10px;
  border: var(--idw-hairline) solid var(--idw-border-input);
  border-radius: 6px;
  background: var(--idw-input-bg);
  color: var(--idw-label-1);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease;
}

.idw-btn:hover {
  background: var(--idw-hover-fill);
}

.idw-btn[data-primary='true'] {
  background: var(--idw-accent);
  border-color: var(--idw-accent);
  color: #fff;
}

/* Ticket stack container (invisible, click-through, no visible scrollbar pushing cards) */
.idw-list {
  pointer-events: none !important;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  margin-top: 8px;
  padding: 4px 0 14px 28px;
  overflow-y: auto;
  overflow-x: visible;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  scrollbar-width: none;
}

.idw-list::-webkit-scrollbar {
  display: none;
}

/* Single ticket card (collapsed -> hover pill -> click-expanded card) */
.idw-card {
  pointer-events: auto;
  position: relative;
  flex: none;
  width: 74px;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: var(--idw-tab-bg);
  box-shadow: var(--idw-shadow-tab);
  opacity: 0.84;
  overflow: hidden;
  transition:
    width 220ms var(--idw-ease),
    border-radius 220ms var(--idw-ease),
    background 160ms ease,
    box-shadow 220ms var(--idw-ease),
    opacity 160ms ease,
    border-color 160ms ease;
}

.idw-card[data-state='hover'] {
  width: var(--idw-hover-width, 248px);
  border-radius: 12px 0 0 12px;
  background: var(--idw-tab-hover-bg);
  box-shadow: var(--idw-shadow-hover);
  opacity: 1;
  z-index: 44;
}

.idw-card[data-state='expanded'] {
  width: var(--idw-expanded-width, 328px);
  border-radius: 14px 0 0 14px;
  border-color: color-mix(in srgb, var(--idw-accent) 45%, var(--idw-border));
  background: var(--idw-glass-bg);
  backdrop-filter: blur(24px) saturate(185%);
  -webkit-backdrop-filter: blur(24px) saturate(185%);
  box-shadow: var(--idw-shadow-expanded);
  opacity: 1;
  z-index: 46;
}

.idw-card[data-resizing='true'] {
  transition: none !important;
}

/* Left accent stripe when expanded */
.idw-card[data-state='expanded']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2.5px;
  border-radius: 0 2px 2px 0;
  background: var(--idw-accent);
  pointer-events: none;
}

/* Left-edge drag handle for manual width adjustment */
.idw-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: ew-resize;
  z-index: 5;
  touch-action: none;
}

.idw-resize-handle:hover::after,
.idw-card[data-resizing='true'] .idw-resize-handle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--idw-accent) 55%, transparent);
}

/* Card Header */
.idw-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 10px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.idw-card[data-state='hover'] .idw-card-head {
  height: 28px;
  padding: 0 10px 0 12px;
}

.idw-card[data-state='expanded'] .idw-card-head {
  height: 36px;
  padding: 0 10px 0 14px;
  border-bottom: var(--idw-hairline) solid var(--idw-border-soft);
}

.idw-id-short {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--idw-label-2);
}

.idw-id-full {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--idw-label-1);
}

.idw-card[data-state='expanded'] .idw-id-full {
  user-select: text;
  cursor: text;
}

.idw-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.idw-hover-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--idw-label-3);
  opacity: 0;
  animation: idw-fade-in 150ms 50ms ease forwards;
}

@keyframes idw-fade-in {
  to { opacity: 1; }
}

.idw-open-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--idw-accent) 12%, transparent);
  color: var(--idw-accent);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease, transform 120ms ease;
}

.idw-open-link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--idw-accent) 20%, transparent);
}

.idw-open-link:disabled {
  background: transparent;
  color: var(--idw-label-3);
  opacity: 0.45;
  cursor: not-allowed;
}

.idw-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--idw-label-3);
  transition: transform 220ms var(--idw-ease);
}

.idw-card[data-state='expanded'] .idw-chevron {
  transform: rotate(180deg);
}

/* Accordion Body (grid-template-rows 0fr -> 1fr) */
.idw-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 240ms var(--idw-ease);
}

.idw-card[data-state='expanded'] .idw-accordion {
  grid-template-rows: 1fr;
}

.idw-accordion-inner {
  overflow: hidden;
  min-height: 0;
}

.idw-form {
  max-height: min(68vh, calc(100vh - 220px));
  overflow-y: auto;
  padding: 10px 12px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  scrollbar-width: thin;
}

.idw-form::-webkit-scrollbar {
  width: 4px;
}

.idw-form::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: var(--idw-border);
}

.idw-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.idw-field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: start;
}

.idw-select[data-flash='saved'] {
  box-shadow: inset 0 0 0 1px var(--idw-ok-fg);
}

.idw-select[data-flash='error'] {
  border-color: var(--idw-err-fg);
  box-shadow: inset 0 0 0 1px var(--idw-err-fg);
}

.idw-mini-sla,
.idw-sla-pill {
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 9.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  color: #fff;
  white-space: nowrap;
}

.idw-mini-sla[data-tone='err'],
.idw-sla-pill[data-tone='err'] { background: linear-gradient(135deg, #f43f5e, #dc2626); }
.idw-mini-sla[data-tone='warn'],
.idw-sla-pill[data-tone='warn'] { background: linear-gradient(135deg, #fbbf24, #d97706); }
.idw-mini-sla[data-tone='ok'],
.idw-sla-pill[data-tone='ok'] { background: linear-gradient(135deg, #34d399, #16a34a); }

.idw-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.idw-field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--idw-label-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idw-field-state {
  font-size: 10.5px;
  color: var(--idw-label-3);
  white-space: nowrap;
}

.idw-field-state[data-state='saved'] { color: var(--idw-ok-fg); }
.idw-field-state[data-state='saving'] { color: var(--idw-accent); }
.idw-field-state[data-state='error'] { color: var(--idw-err-fg); }

.idw-textarea {
  width: 100%;
  min-height: 28px;
  max-height: 280px;
  padding: 5px 8px;
  border: var(--idw-hairline) solid var(--idw-border-input);
  border-radius: 6px;
  background: var(--idw-input-bg);
  color: var(--idw-label-1);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 19px;
  resize: none;
  overflow-y: hidden;
  outline: none;
  transition: box-shadow 180ms ease, background 150ms ease, border-color 180ms ease;
}

.idw-textarea:hover {
  background: var(--idw-input-hover-bg);
}

.idw-textarea:focus {
  background: var(--idw-input-bg);
  box-shadow: inset 0 0 0 1px var(--idw-accent), 0 0 0 2px color-mix(in srgb, var(--idw-accent) 16%, transparent);
}

.idw-textarea[data-flash='saved'] {
  box-shadow: inset 0 0 0 1px var(--idw-ok-fg);
}

.idw-textarea[data-flash='error'] {
  border-color: var(--idw-err-fg);
  box-shadow: inset 0 0 0 1px var(--idw-err-fg);
}

.idw-field-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--idw-err-fg);
}

.idw-retry-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--idw-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  white-space: nowrap;
}

/* Empty state card */
.idw-empty-card {
  pointer-events: auto;
  width: 260px;
  padding: 12px 14px;
  border: var(--idw-hairline) solid var(--idw-border);
  border-right: none;
  border-radius: 12px 0 0 12px;
  background: var(--idw-glass-bg);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--idw-shadow-hover);
  font-size: 12px;
  line-height: 1.5;
  color: var(--idw-label-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .idw-card,
  .idw-accordion,
  .idw-peek,
  .idw-toolbar {
    transition: none !important;
  }
}
`;

// src/client/index.tsx
var inject = ["slots"];
function mountStyles() {
  if (typeof document === "undefined") return () => void 0;
  const existing = document.querySelector(`style[data-plugin-css=${JSON.stringify(DRAWER_STYLE_ID)}]`);
  if (existing) return () => void 0;
  const tag = document.createElement("style");
  tag.dataset.plugin = DRAWER_PLUGIN_ID;
  tag.dataset.pluginCss = DRAWER_STYLE_ID;
  tag.textContent = DRAWER_CSS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}
function apply(ctx) {
  ctx.effect(() => mountStyles(), "incident-drawer: styles");
  const rpcCall = async (endpoint, payload, signal) => {
    const response = await fetch(API_CLIENT_ROUTE, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint, payload }),
      ...signal ? { signal } : {}
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error?.message || `\u8BF7\u6C42 ${endpoint} \u5931\u8D25 (HTTP ${response.status})`);
    }
    return data.value;
  };
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      {
        name: "shell.overlay",
        id: "incident-drawer",
        inject: () => ({ rpcCall })
      },
      IncidentDrawer
    )
  );
}

    return module.exports;
  }
});
