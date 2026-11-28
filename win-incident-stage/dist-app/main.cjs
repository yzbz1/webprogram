"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main/main.ts
var import_node_path4 = require("node:path");
var import_node_url = require("node:url");
var import_electron2 = require("electron");

// src/main/config-store.ts
var import_node_fs = require("node:fs");
var import_node_os = __toESM(require("node:os"));
var import_node_path = require("node:path");
var VALID_LIGHT_IDS = ["red", "yellow", "green"];
var VALID_ACTION_TYPES = /* @__PURE__ */ new Set([
  "hotkey",
  "url",
  "path",
  "open-excel",
  "settings",
  "todos",
  "refresh",
  "toggle-hide"
]);
var DEFAULT_TRAFFIC_LIGHTS = [
  { id: "red", label: "\u533A\u57DF\u622A\u5C4F", actionType: "hotkey", target: "Win+Shift+S" },
  { id: "yellow", label: "\u663E\u793A\u684C\u9762", actionType: "hotkey", target: "Win+D" },
  { id: "green", label: "\u526A\u8D34\u677F\u5386\u53F2", actionType: "hotkey", target: "Win+V" }
];
function isUntouchedLegacyLights(input) {
  if (!Array.isArray(input) || input.length !== 3) return false;
  const [r, y, g] = input;
  return r?.id === "red" && r?.actionType === "settings" && (r?.target ?? "") === "" && y?.id === "yellow" && y?.actionType === "todos" && (y?.target ?? "") === "" && g?.id === "green" && g?.actionType === "url" && g?.target === "https://cn.bing.com";
}
var DEFAULT_TODOS = [
  { id: "todo-default-1", text: "\u68C0\u67E5\u4ECA\u65E5\u9AD8\u4F18\u4E8B\u4EF6\u5355\u5904\u7406\u8FDB\u5EA6", done: false },
  { id: "todo-default-2", text: "\u4E0B\u73ED\u524D\u786E\u8BA4 Excel \u65E5\u62A5\u5DF2\u540C\u6B65\u66F4\u65B0", done: false }
];
var DEFAULT_DESKTOP_PREFS = {
  theme: "system",
  alwaysOnTop: true,
  displayId: null,
  hidden: false,
  stageWidth: 344,
  showCat: true,
  showPlayer: true,
  musicFolder: "",
  trafficLights: DEFAULT_TRAFFIC_LIGHTS.map((item) => ({ ...item })),
  todos: DEFAULT_TODOS.map((item) => ({ ...item })),
  todoIntervalMinutes: 60
};
function sanitizeTrafficLights(input) {
  const byId = /* @__PURE__ */ new Map();
  for (const def of DEFAULT_TRAFFIC_LIGHTS) {
    byId.set(def.id, { ...def });
  }
  if (!Array.isArray(input) || isUntouchedLegacyLights(input)) {
    return VALID_LIGHT_IDS.map((id) => byId.get(id));
  }
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw;
    if (rec.id !== "red" && rec.id !== "yellow" && rec.id !== "green") continue;
    const fallback = byId.get(rec.id);
    const actionType = typeof rec.actionType === "string" && VALID_ACTION_TYPES.has(rec.actionType) ? rec.actionType : fallback.actionType;
    const label = typeof rec.label === "string" && rec.label.trim() !== "" ? rec.label.trim().slice(0, 24) : fallback.label;
    const target = typeof rec.target === "string" ? rec.target.trim().slice(0, 512) : "";
    byId.set(rec.id, { id: rec.id, label, actionType, target });
  }
  return VALID_LIGHT_IDS.map((id) => byId.get(id));
}
function sanitizeTodos(input) {
  if (!Array.isArray(input)) {
    return DEFAULT_TODOS.map((item) => ({ ...item }));
  }
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (let i = 0; i < input.length && result.length < 30; i += 1) {
    const raw = input[i];
    if (!raw || typeof raw !== "object") continue;
    const rec = raw;
    const text = typeof rec.text === "string" ? rec.text.trim().slice(0, 120) : "";
    if (!text) continue;
    let id = typeof rec.id === "string" && rec.id.trim() !== "" ? rec.id.trim().slice(0, 48) : `todo-${i + 1}`;
    while (seen.has(id)) {
      id = `${id}-${i + 1}`;
    }
    seen.add(id);
    result.push({
      id,
      text,
      done: Boolean(rec.done)
    });
  }
  return result;
}
function sanitizeTodoInterval(input) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return DEFAULT_DESKTOP_PREFS.todoIntervalMinutes;
  }
  const rounded = Math.round(input);
  if (rounded <= 0) return 0;
  return Math.min(240, Math.max(5, rounded));
}
function resolveDefaultSamplePath(baseDir) {
  const siblingDshSample = (0, import_node_path.resolve)(baseDir, "../dsh-plugin-incident-drawer/sample/incidents.xlsx");
  if ((0, import_node_fs.existsSync)(siblingDshSample)) {
    return siblingDshSample;
  }
  const siblingChromeSample = (0, import_node_path.resolve)(baseDir, "../chrome-incident-drawer/sample/incidents.xlsx");
  if ((0, import_node_fs.existsSync)(siblingChromeSample)) {
    return siblingChromeSample;
  }
  return (0, import_node_path.resolve)(baseDir, "sample/incidents.xlsx");
}
function resolveDshHomeDir() {
  return process.env.DSH_HOME || (0, import_node_path.join)(import_node_os.default.homedir(), ".dsh");
}
function resolveConfigFilePath() {
  if (process.env.DSH_INCIDENT_DRAWER_CONFIG) {
    return (0, import_node_path.resolve)(process.env.DSH_INCIDENT_DRAWER_CONFIG);
  }
  return (0, import_node_path.join)(resolveDshHomeDir(), "incident-drawer-config.json");
}
function resolveDesktopPrefsFilePath() {
  if (process.env.STAGE_PREFS_PATH) {
    return (0, import_node_path.resolve)(process.env.STAGE_PREFS_PATH);
  }
  return (0, import_node_path.join)(resolveDshHomeDir(), "win-incident-stage-prefs.json");
}
var ConfigStore = class {
  constructor(baseDir, configFilePath = resolveConfigFilePath()) {
    this.baseDir = baseDir;
    this.configFilePath = configFilePath;
  }
  memoryFallback = null;
  /** Always read fresh from disk so DSH, Chrome, and Windows Desktop stay synchronized. */
  read() {
    try {
      if ((0, import_node_fs.existsSync)(this.configFilePath)) {
        const raw = JSON.parse((0, import_node_fs.readFileSync)(this.configFilePath, "utf8"));
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
      excelPath: resolveDefaultSamplePath(this.baseDir)
    };
    this.memoryFallback = fallback;
    return { ...fallback };
  }
  write(next) {
    const clean = {
      excelPath: (0, import_node_path.resolve)(next.excelPath.trim()),
      ...next.preferredSheet && next.preferredSheet.trim() !== "" ? { preferredSheet: next.preferredSheet.trim() } : {}
    };
    this.memoryFallback = clean;
    try {
      (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(this.configFilePath), { recursive: true });
      (0, import_node_fs.writeFileSync)(this.configFilePath, JSON.stringify(clean, null, 2) + "\n", "utf8");
      return { persisted: true, config: { ...clean } };
    } catch {
      return { persisted: false, config: { ...clean } };
    }
  }
};
var DesktopPrefsStore = class {
  constructor(prefsFilePath = resolveDesktopPrefsFilePath()) {
    this.prefsFilePath = prefsFilePath;
  }
  read() {
    try {
      if ((0, import_node_fs.existsSync)(this.prefsFilePath)) {
        const raw = JSON.parse((0, import_node_fs.readFileSync)(this.prefsFilePath, "utf8"));
        return {
          theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "system",
          alwaysOnTop: typeof raw.alwaysOnTop === "boolean" ? raw.alwaysOnTop : DEFAULT_DESKTOP_PREFS.alwaysOnTop,
          displayId: typeof raw.displayId === "number" ? raw.displayId : null,
          hidden: typeof raw.hidden === "boolean" ? raw.hidden : false,
          stageWidth: typeof raw.stageWidth === "number" && raw.stageWidth >= 300 && raw.stageWidth <= 540 ? raw.stageWidth : DEFAULT_DESKTOP_PREFS.stageWidth,
          showCat: typeof raw.showCat === "boolean" ? raw.showCat : DEFAULT_DESKTOP_PREFS.showCat,
          showPlayer: typeof raw.showPlayer === "boolean" ? raw.showPlayer : DEFAULT_DESKTOP_PREFS.showPlayer,
          musicFolder: typeof raw.musicFolder === "string" ? raw.musicFolder.trim().slice(0, 512) : "",
          trafficLights: sanitizeTrafficLights(raw.trafficLights),
          todos: sanitizeTodos(raw.todos),
          todoIntervalMinutes: sanitizeTodoInterval(raw.todoIntervalMinutes)
        };
      }
    } catch {
    }
    return {
      ...DEFAULT_DESKTOP_PREFS,
      trafficLights: DEFAULT_TRAFFIC_LIGHTS.map((item) => ({ ...item })),
      todos: DEFAULT_TODOS.map((item) => ({ ...item }))
    };
  }
  write(next) {
    try {
      (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(this.prefsFilePath), { recursive: true });
      (0, import_node_fs.writeFileSync)(this.prefsFilePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    } catch {
    }
  }
};

// src/main/input-monitor.ts
var import_electron = require("electron");

// src/main/win32-bridge.ts
var import_node_module = require("node:module");
var VK_MEDIA_NEXT_TRACK = 176;
var VK_MEDIA_PREV_TRACK = 177;
var VK_MEDIA_PLAY_PAUSE = 179;
var KEYEVENTF_EXTENDEDKEY = 1;
var KEYEVENTF_KEYUP = 2;
var VK_MODIFIER_MAP = {
  CTRL: 17,
  CONTROL: 17,
  LCTRL: 162,
  RCTRL: 163,
  ALT: 18,
  OPTION: 18,
  LALT: 164,
  RALT: 165,
  SHIFT: 16,
  LSHIFT: 160,
  RSHIFT: 161,
  WIN: 91,
  LWIN: 91,
  META: 91,
  SUPER: 91,
  CMD: 91,
  RWIN: 92
};
var VK_KEY_MAP = {
  BACKSPACE: 8,
  BKSP: 8,
  TAB: 9,
  ENTER: 13,
  RETURN: 13,
  PAUSE: 19,
  CAPSLOCK: 20,
  ESC: 27,
  ESCAPE: 27,
  SPACE: 32,
  SPACEBAR: 32,
  PAGEUP: 33,
  PGUP: 33,
  PAGEDOWN: 34,
  PGDN: 34,
  END: 35,
  HOME: 36,
  LEFT: 37,
  ARROWLEFT: 37,
  UP: 38,
  ARROWUP: 38,
  RIGHT: 39,
  ARROWRIGHT: 39,
  DOWN: 40,
  ARROWDOWN: 40,
  PRINTSCREEN: 44,
  PRTSC: 44,
  SNAPSHOT: 44,
  INSERT: 45,
  INS: 45,
  DELETE: 46,
  DEL: 46,
  MUTE: 173,
  VOLUMEDOWN: 174,
  VOLUMEUP: 175,
  NEXT: 176,
  PREV: 177,
  PLAYPAUSE: 179,
  ";": 186,
  SEMICOLON: 186,
  "=": 187,
  EQUAL: 187,
  PLUS: 187,
  ",": 188,
  COMMA: 188,
  "-": 189,
  MINUS: 189,
  ".": 190,
  PERIOD: 190,
  "/": 191,
  SLASH: 191,
  "`": 192,
  BACKQUOTE: 192,
  "[": 219,
  BRACKETLEFT: 219,
  "\\": 220,
  BACKSLASH: 220,
  "]": 221,
  BRACKETRIGHT: 221,
  "'": 222,
  QUOTE: 222
};
var EXTENDED_VKS = /* @__PURE__ */ new Set([
  91,
  // VK_LWIN
  92,
  // VK_RWIN
  33,
  34,
  35,
  36,
  // PgUp, PgDn, End, Home
  37,
  38,
  39,
  40,
  // Arrows
  44,
  // PrintScreen
  45,
  46,
  // Ins, Del
  163,
  165
  // RCtrl, RAlt
]);
var cachedApi;
function loadUser32() {
  if (cachedApi !== void 0) return cachedApi;
  if (process.platform !== "win32") {
    cachedApi = null;
    return null;
  }
  try {
    const req = typeof require === "function" ? require : (0, import_node_module.createRequire)(__filename);
    const koffi = req("koffi");
    const user32 = koffi.load("user32.dll");
    const getAsyncKeyState2 = user32.func("short __stdcall GetAsyncKeyState(int vKey)");
    const keybdEvent = user32.func("void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)");
    cachedApi = {
      getAsyncKeyState: (vKey) => getAsyncKeyState2(vKey),
      keybdEvent: (bVk, bScan, dwFlags, dwExtraInfo) => {
        keybdEvent(bVk, bScan, dwFlags, dwExtraInfo);
      }
    };
    return cachedApi;
  } catch {
    cachedApi = null;
    return null;
  }
}
function resolveKeyVk(token) {
  const upper = token.trim().toUpperCase();
  if (!upper) return null;
  if (Object.hasOwn(VK_KEY_MAP, upper)) return VK_KEY_MAP[upper];
  if (/^[A-Z0-9]$/.test(upper)) return upper.charCodeAt(0);
  const fMatch = /^F([1-9]|1\d|2[0-4])$/.exec(upper);
  if (fMatch) {
    return 111 + Number.parseInt(fMatch[1], 10);
  }
  return null;
}
function isWin32Available() {
  return loadUser32() !== null;
}
function getAsyncKeyState(vk) {
  const api = loadUser32();
  if (!api) return 0;
  return api.getAsyncKeyState(vk);
}
function sendMediaKey(action) {
  const api = loadUser32();
  if (!api) return false;
  const vk = action === "prev" ? VK_MEDIA_PREV_TRACK : action === "next" ? VK_MEDIA_NEXT_TRACK : VK_MEDIA_PLAY_PAUSE;
  try {
    api.keybdEvent(vk, 0, 0, 0);
    api.keybdEvent(vk, 0, KEYEVENTF_KEYUP, 0);
    return true;
  } catch {
    return false;
  }
}
async function sendHotkeyCombo(combo) {
  const api = loadUser32();
  if (!api || typeof combo !== "string") return false;
  const rawParts = combo.split("+").map((p) => p.trim()).filter(Boolean);
  if (rawParts.length === 0) return false;
  const modifiers = [];
  const keys = [];
  for (const part of rawParts) {
    const upper = part.toUpperCase();
    if (Object.hasOwn(VK_MODIFIER_MAP, upper)) {
      const modVk = VK_MODIFIER_MAP[upper];
      if (!modifiers.includes(modVk)) modifiers.push(modVk);
      continue;
    }
    const keyVk = resolveKeyVk(part);
    if (keyVk === null) return false;
    keys.push(keyVk);
  }
  if (modifiers.length === 0 && keys.length === 0) return false;
  const pressKey = (vk, up) => {
    const ext = EXTENDED_VKS.has(vk) ? KEYEVENTF_EXTENDEDKEY : 0;
    api.keybdEvent(vk, 0, ext | (up ? KEYEVENTF_KEYUP : 0), 0);
  };
  try {
    for (const mod of modifiers) pressKey(mod, false);
    for (const k of keys) pressKey(k, false);
    await new Promise((resolve4) => setTimeout(resolve4, 28));
    for (let i = keys.length - 1; i >= 0; i -= 1) pressKey(keys[i], true);
    for (let i = modifiers.length - 1; i >= 0; i -= 1) pressKey(modifiers[i], true);
    return true;
  } catch {
    return false;
  }
}

// src/main/input-monitor.ts
var LEFT_HAND_VKS = [
  27,
  9,
  20,
  160,
  162,
  164,
  // Esc, Tab, Caps, LShift, LCtrl, LAlt
  49,
  50,
  51,
  52,
  53,
  // 1-5
  81,
  87,
  69,
  82,
  84,
  // Q W E R T
  65,
  83,
  68,
  70,
  71,
  // A S D F G
  90,
  88,
  67,
  86,
  66
  // Z X C V B
];
var RIGHT_HAND_VKS = [
  54,
  55,
  56,
  57,
  48,
  // 6-0
  8,
  13,
  161,
  163,
  165,
  // Backspace, Enter, RShift, RCtrl, RAlt
  37,
  38,
  39,
  40,
  // Arrow keys
  89,
  85,
  73,
  79,
  80,
  // Y U I O P
  72,
  74,
  75,
  76,
  // H J K L
  78,
  77,
  // N M
  186,
  187,
  188,
  189,
  190,
  191,
  219,
  220,
  221,
  222
  // Punctuation
];
var VK_SPACE = 32;
var InputMonitor = class {
  enabled = false;
  mouseTimer = null;
  keyTimer = null;
  listener = null;
  lastMouseX = -9999;
  lastMouseY = -9999;
  prevDown = new Uint8Array(256);
  keySweepInitialized = false;
  alternateHand = "right";
  start(listener) {
    this.listener = listener;
    if (this.enabled) {
      this.ensureTimers();
    }
  }
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) {
      this.ensureTimers();
    } else {
      this.clearTimers();
    }
  }
  stop() {
    this.enabled = false;
    this.clearTimers();
    this.listener = null;
  }
  clearTimers() {
    if (this.mouseTimer) {
      clearInterval(this.mouseTimer);
      this.mouseTimer = null;
    }
    if (this.keyTimer) {
      clearInterval(this.keyTimer);
      this.keyTimer = null;
    }
    this.keySweepInitialized = false;
    this.prevDown.fill(0);
  }
  ensureTimers() {
    if (!this.listener || !this.enabled) return;
    if (!this.mouseTimer) {
      this.mouseTimer = setInterval(() => {
        if (!this.enabled || !this.listener) return;
        try {
          const pt = import_electron.screen.getCursorScreenPoint();
          if (Math.abs(pt.x - this.lastMouseX) < 3 && Math.abs(pt.y - this.lastMouseY) < 3) {
            return;
          }
          this.lastMouseX = pt.x;
          this.lastMouseY = pt.y;
          const display = import_electron.screen.getDisplayNearestPoint(pt);
          const { x, y, width, height } = display.bounds;
          const nx = width > 0 ? Math.min(1, Math.max(0, (pt.x - x) / width)) : 0.5;
          const ny = height > 0 ? Math.min(1, Math.max(0, (pt.y - y) / height)) : 0.5;
          this.listener({ type: "mouse", nx, ny });
        } catch {
        }
      }, 65);
    }
    if (!this.keyTimer && isWin32Available()) {
      this.keySweepInitialized = false;
      this.prevDown.fill(0);
      this.keyTimer = setInterval(() => {
        if (!this.enabled || !this.listener) return;
        let leftHit = false;
        let rightHit = false;
        const sampleGroup = (vks) => {
          let hit = false;
          for (let i = 0; i < vks.length; i += 1) {
            const vk = vks[i];
            const state = getAsyncKeyState(vk);
            const isDown = (state & 32768) !== 0;
            const toggledSinceLast = (state & 1) !== 0;
            const wasDown = this.prevDown[vk] === 1;
            this.prevDown[vk] = isDown ? 1 : 0;
            if (this.keySweepInitialized && (isDown && !wasDown || toggledSinceLast && !wasDown)) {
              hit = true;
            }
          }
          return hit;
        };
        if (sampleGroup(LEFT_HAND_VKS)) leftHit = true;
        if (sampleGroup(RIGHT_HAND_VKS)) rightHit = true;
        const spaceState = getAsyncKeyState(VK_SPACE);
        const spaceDown = (spaceState & 32768) !== 0;
        const spaceToggled = (spaceState & 1) !== 0;
        const spaceWasDown = this.prevDown[VK_SPACE] === 1;
        this.prevDown[VK_SPACE] = spaceDown ? 1 : 0;
        if (this.keySweepInitialized && (spaceDown && !spaceWasDown || spaceToggled && !spaceWasDown)) {
          this.alternateHand = this.alternateHand === "left" ? "right" : "left";
          if (this.alternateHand === "left") leftHit = true;
          else rightHit = true;
        }
        if (!this.keySweepInitialized) {
          this.keySweepInitialized = true;
          return;
        }
        if (leftHit && rightHit) {
          this.listener({ type: "key", hand: "both" });
        } else if (leftHit) {
          this.listener({ type: "key", hand: "left" });
        } else if (rightHit) {
          this.listener({ type: "key", hand: "right" });
        }
      }, 55);
    }
  }
};

// src/main/local-music.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
var AUDIO_EXTENSIONS = /* @__PURE__ */ new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".webm"
]);
var COVER_CANDIDATES = [
  "cover.jpg",
  "cover.jpeg",
  "cover.png",
  "cover.webp",
  "folder.jpg",
  "folder.jpeg",
  "folder.png",
  "album.jpg",
  "album.png"
];
var MAX_FOLDER_COVER_BYTES = 15e5;
var MAX_ID3_HEADER_READ = 524288;
function parseTrackDisplay(fileName) {
  const base = (0, import_node_path2.parse)(fileName).name.trim();
  const dashIdx = base.indexOf(" - ");
  if (dashIdx > 0 && dashIdx < base.length - 3) {
    return {
      artist: base.slice(0, dashIdx).trim(),
      title: base.slice(dashIdx + 3).trim()
    };
  }
  return { title: base || fileName, artist: "" };
}
function findFolderCoverDataUrl(folderPath, entriesLower) {
  for (const candidate of COVER_CANDIDATES) {
    const actualName = entriesLower.get(candidate);
    if (!actualName) continue;
    try {
      const fullPath = (0, import_node_path2.join)(folderPath, actualName);
      const st = (0, import_node_fs2.statSync)(fullPath);
      if (!st.isFile() || st.size <= 0 || st.size > MAX_FOLDER_COVER_BYTES) continue;
      const buf = (0, import_node_fs2.readFileSync)(fullPath);
      const ext = (0, import_node_path2.extname)(actualName).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
    }
  }
  return null;
}
function readSynchsafeInt(buf, offset) {
  return (buf[offset] & 127) << 21 | (buf[offset + 1] & 127) << 14 | (buf[offset + 2] & 127) << 7 | buf[offset + 3] & 127;
}
function readUInt32BE(buf, offset) {
  return (buf[offset] << 24 >>> 0) + (buf[offset + 1] << 16) + (buf[offset + 2] << 8) + buf[offset + 3];
}
function extractMp3CoverDataUrl(filePath) {
  let fd = null;
  try {
    fd = (0, import_node_fs2.openSync)(filePath, "r");
    const head = Buffer.alloc(10);
    if ((0, import_node_fs2.readSync)(fd, head, 0, 10, 0) < 10) return null;
    if (head.toString("ascii", 0, 3) !== "ID3") return null;
    const version = head[3];
    if (version !== 3 && version !== 4) return null;
    const tagSize = readSynchsafeInt(head, 6);
    const readLen = Math.min(tagSize, MAX_ID3_HEADER_READ);
    if (readLen <= 10) return null;
    const tagBuf = Buffer.alloc(readLen);
    const actual = (0, import_node_fs2.readSync)(fd, tagBuf, 0, readLen, 10);
    let pos = 0;
    if ((head[5] & 64) !== 0 && actual >= 4) {
      const extSize = version === 4 ? readSynchsafeInt(tagBuf, 0) : readUInt32BE(tagBuf, 0);
      pos = Math.min(actual, extSize + (version === 4 ? 0 : 4));
    }
    while (pos + 10 <= actual) {
      const frameId = tagBuf.toString("ascii", pos, pos + 4);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
      const frameSize = version === 4 ? readSynchsafeInt(tagBuf, pos + 4) : readUInt32BE(tagBuf, pos + 4);
      const dataStart = pos + 10;
      const dataEnd = dataStart + frameSize;
      if (frameSize <= 0 || dataEnd > actual) break;
      if (frameId === "APIC") {
        const enc = tagBuf[dataStart];
        let cursor = dataStart + 1;
        const mimeEnd = tagBuf.indexOf(0, cursor);
        if (mimeEnd === -1 || mimeEnd >= dataEnd) return null;
        const mimeRaw = tagBuf.toString("ascii", cursor, mimeEnd).toLowerCase();
        const mime = mimeRaw.includes("png") ? "image/png" : "image/jpeg";
        cursor = mimeEnd + 2;
        if (enc === 1 || enc === 2) {
          while (cursor + 1 < dataEnd) {
            if (tagBuf[cursor] === 0 && tagBuf[cursor + 1] === 0) {
              cursor += 2;
              break;
            }
            cursor += 2;
          }
        } else {
          const descEnd = tagBuf.indexOf(0, cursor);
          if (descEnd === -1 || descEnd >= dataEnd) return null;
          cursor = descEnd + 1;
        }
        if (cursor < dataEnd) {
          const imgBytes = tagBuf.subarray(cursor, dataEnd);
          if (imgBytes.length > 32 && imgBytes.length <= MAX_FOLDER_COVER_BYTES) {
            return `data:${mime};base64,${imgBytes.toString("base64")}`;
          }
        }
        return null;
      }
      pos = dataEnd;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        (0, import_node_fs2.closeSync)(fd);
      } catch {
      }
    }
  }
}
var LocalMusicStore = class {
  folderPath = "";
  filePaths = [];
  library = { folderPath: "", tracks: [] };
  version = 1;
  loadFolder(rawFolderPath) {
    const trimmed = typeof rawFolderPath === "string" ? rawFolderPath.trim() : "";
    if (!trimmed) {
      this.folderPath = "";
      this.filePaths = [];
      this.library = { folderPath: "", tracks: [] };
      return this.library;
    }
    const absFolder = (0, import_node_path2.resolve)(trimmed);
    this.folderPath = absFolder;
    this.version += 1;
    if (!(0, import_node_fs2.existsSync)(absFolder)) {
      this.filePaths = [];
      this.library = { folderPath: absFolder, tracks: [] };
      return this.library;
    }
    try {
      const dirents = (0, import_node_fs2.readdirSync)(absFolder, { withFileTypes: true });
      const entriesLower = /* @__PURE__ */ new Map();
      const audioNames = [];
      for (const entry of dirents) {
        if (!entry.isFile()) continue;
        entriesLower.set(entry.name.toLowerCase(), entry.name);
        if (AUDIO_EXTENSIONS.has((0, import_node_path2.extname)(entry.name).toLowerCase())) {
          audioNames.push(entry.name);
        }
      }
      audioNames.sort((a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" }));
      const folderCover = findFolderCoverDataUrl(absFolder, entriesLower);
      const nextPaths = [];
      const nextTracks = [];
      for (let i = 0; i < audioNames.length; i += 1) {
        const fileName = audioNames[i];
        const fullPath = (0, import_node_path2.join)(absFolder, fileName);
        nextPaths.push(fullPath);
        const { title, artist } = parseTrackDisplay(fileName);
        const coverDataUrl = (0, import_node_path2.extname)(fileName).toLowerCase() === ".mp3" ? extractMp3CoverDataUrl(fullPath) ?? folderCover : folderCover;
        nextTracks.push({
          index: i,
          fileName,
          title,
          artist,
          streamUrl: `stage-audio://track/${i}?v=${this.version}`,
          coverDataUrl
        });
      }
      this.filePaths = nextPaths;
      this.library = { folderPath: absFolder, tracks: nextTracks };
      return this.library;
    } catch {
      this.filePaths = [];
      this.library = { folderPath: absFolder, tracks: [] };
      return this.library;
    }
  }
  getLibrary() {
    return this.library;
  }
  resolveTrackPath(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.filePaths.length) {
      return null;
    }
    return this.filePaths[index];
  }
};

// src/main/media-monitor.ts
var import_node_child_process = require("node:child_process");
var import_node_fs3 = require("node:fs");
var import_node_path3 = require("node:path");
var INITIAL_MEDIA_STATE = {
  available: process.platform === "win32",
  hasSession: false,
  title: "",
  artist: "",
  status: "idle",
  thumbnailDataUrl: null
};
var MediaMonitor = class {
  constructor(appRoot2) {
    this.appRoot = appRoot2;
  }
  enabled = false;
  proc = null;
  stdoutBuffer = "";
  state = { ...INITIAL_MEDIA_STATE };
  listener = null;
  pendingAcks = [];
  start(listener) {
    this.listener = listener;
    if (this.enabled) {
      this.spawnWorker();
    }
  }
  getState() {
    return this.state;
  }
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) {
      this.spawnWorker();
    } else {
      this.killWorker();
      this.updateState({ ...INITIAL_MEDIA_STATE });
    }
  }
  stop() {
    this.enabled = false;
    this.killWorker();
    this.listener = null;
  }
  async control(action) {
    const worker = this.proc;
    if (!worker || !worker.stdin || worker.killed || !this.state.hasSession) {
      return sendMediaKey(action);
    }
    const ackOk = await new Promise((resolve4) => {
      const timer = setTimeout(() => {
        this.pendingAcks = this.pendingAcks.filter((item) => item.resolve !== resolve4);
        resolve4(false);
      }, 950);
      this.pendingAcks.push({ action, resolve: resolve4, timer });
      try {
        worker.stdin?.write(`${action}
`);
      } catch {
        clearTimeout(timer);
        this.pendingAcks = this.pendingAcks.filter((item) => item.resolve !== resolve4);
        resolve4(false);
      }
    });
    if (ackOk) return true;
    return sendMediaKey(action);
  }
  updateState(next) {
    this.state = next;
    if (this.listener) {
      this.listener(next);
    }
  }
  spawnWorker() {
    if (this.proc || process.platform !== "win32" || !this.enabled) return;
    const scriptPath = (0, import_node_path3.join)(this.appRoot, "dist-app", "media-helper.ps1");
    if (!(0, import_node_fs3.existsSync)(scriptPath)) {
      this.updateState({ ...INITIAL_MEDIA_STATE, available: false });
      return;
    }
    const child = (0, import_node_child_process.spawn)(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      {
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true
      }
    );
    this.proc = child;
    this.stdoutBuffer = "";
    child.stdout?.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString("utf8");
      let idx = this.stdoutBuffer.indexOf("\n");
      while (idx !== -1) {
        const line = this.stdoutBuffer.slice(0, idx).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
        if (line) {
          this.handleLine(line);
        }
        idx = this.stdoutBuffer.indexOf("\n");
      }
    });
    child.on("error", () => {
      if (this.proc === child) {
        this.proc = null;
      }
      this.flushPendingAcks(false);
    });
    child.on("exit", () => {
      if (this.proc === child) {
        this.proc = null;
      }
      this.flushPendingAcks(false);
    });
  }
  handleLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "state") {
        const status = msg.status === "playing" || msg.status === "paused" ? msg.status : "idle";
        this.updateState({
          available: Boolean(msg.available),
          hasSession: Boolean(msg.hasSession),
          title: typeof msg.title === "string" ? msg.title : "",
          artist: typeof msg.artist === "string" ? msg.artist : "",
          status,
          thumbnailDataUrl: typeof msg.thumbnailDataUrl === "string" ? msg.thumbnailDataUrl : null
        });
      } else if (msg.type === "ack") {
        const idx = this.pendingAcks.findIndex((item) => item.action === msg.action);
        if (idx !== -1) {
          const [entry] = this.pendingAcks.splice(idx, 1);
          clearTimeout(entry.timer);
          entry.resolve(Boolean(msg.ok));
        }
      }
    } catch {
    }
  }
  flushPendingAcks(value) {
    for (const entry of this.pendingAcks) {
      clearTimeout(entry.timer);
      entry.resolve(value);
    }
    this.pendingAcks = [];
  }
  killWorker() {
    this.flushPendingAcks(false);
    const child = this.proc;
    this.proc = null;
    if (!child) return;
    try {
      child.stdin?.end();
    } catch {
    }
    try {
      if (!child.killed) {
        child.kill();
      }
    } catch {
    }
  }
};

// src/main/main.ts
var OVERLAY_WINDOW_WIDTH = 680;
import_electron2.protocol.registerSchemesAsPrivileged([
  {
    scheme: "stage-audio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
]);
var isSmokeTest = process.env.STAGE_SMOKE_TEST === "1";
if (!isSmokeTest) {
  const gotLock = import_electron2.app.requestSingleInstanceLock();
  if (!gotLock) {
    import_electron2.app.quit();
  }
}
var appRoot = import_electron2.app.getAppPath();
var excelStore = require((0, import_node_path4.join)(appRoot, "dist-app", "excel-store.cjs"));
var configStore = new ConfigStore(appRoot);
var prefsStore = new DesktopPrefsStore();
var inputMonitor = new InputMonitor();
var mediaMonitor = new MediaMonitor(appRoot);
var localMusicStore = new LocalMusicStore();
var mainWindow = null;
var tray = null;
var storedPrefs = prefsStore.read();
var lastInteractive = null;
localMusicStore.loadFolder(storedPrefs.musicFolder);
function resolveTheme(prefs) {
  if (prefs.theme === "light" || prefs.theme === "dark") return prefs.theme;
  return import_electron2.nativeTheme.shouldUseDarkColors ? "dark" : "light";
}
function getFullPrefs() {
  return {
    ...storedPrefs,
    resolvedTheme: resolveTheme(storedPrefs)
  };
}
function broadcastPrefs() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("stage:prefs-changed", getFullPrefs());
  }
}
function broadcastLocalMusic() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("stage:local-music-changed", localMusicStore.getLibrary());
  }
}
function syncWidgetsRuntime() {
  const active = !isSmokeTest && !storedPrefs.hidden;
  inputMonitor.setEnabled(active && storedPrefs.showCat);
  mediaMonitor.setEnabled(active && storedPrefs.showPlayer && storedPrefs.musicFolder.trim() === "");
}
function resolveTargetDisplay() {
  const displays = import_electron2.screen.getAllDisplays();
  if (storedPrefs.displayId !== null) {
    const matched = displays.find((d) => d.id === storedPrefs.displayId);
    if (matched) return matched;
  }
  return import_electron2.screen.getPrimaryDisplay();
}
function positionOverlayWindow(win) {
  const display = resolveTargetDisplay();
  const { x, y, width, height } = display.workArea;
  const winWidth = Math.min(OVERLAY_WINDOW_WIDTH, width);
  win.setBounds({
    x: x + width - winWidth,
    y,
    width: winWidth,
    height
  });
}
function applyAlwaysOnTop(win) {
  win.setAlwaysOnTop(storedPrefs.alwaysOnTop, "floating");
}
function setMousePassThrough(win, interactive) {
  if (lastInteractive === interactive) return;
  lastInteractive = interactive;
  win.setIgnoreMouseEvents(!interactive, { forward: true });
}
function updatePrefs(patch) {
  const prevMusicFolder = storedPrefs.musicFolder;
  storedPrefs = { ...storedPrefs, ...patch };
  prefsStore.write(storedPrefs);
  if (storedPrefs.musicFolder !== prevMusicFolder) {
    localMusicStore.loadFolder(storedPrefs.musicFolder);
    broadcastLocalMusic();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    applyAlwaysOnTop(mainWindow);
    positionOverlayWindow(mainWindow);
    if (storedPrefs.hidden) {
      setMousePassThrough(mainWindow, false);
    }
  }
  syncWidgetsRuntime();
  rebuildTrayMenu();
  broadcastPrefs();
  return getFullPrefs();
}
function toggleHidden() {
  const nextHidden = !storedPrefs.hidden;
  updatePrefs({ hidden: nextHidden });
  if (!nextHidden && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive();
  }
}
async function pickMusicFolder() {
  const result = await import_electron2.dialog.showOpenDialog({
    title: "\u9009\u62E9\u672C\u5730\u97F3\u4E50\u64AD\u653E\u6587\u4EF6\u5939",
    defaultPath: storedPrefs.musicFolder || void 0,
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const pickedFolder = result.filePaths[0];
  updatePrefs({ musicFolder: pickedFolder });
  return localMusicStore.getLibrary();
}
async function openMusicFolder() {
  if (!storedPrefs.musicFolder.trim()) {
    const picked = await pickMusicFolder();
    return picked !== null;
  }
  try {
    const errMsg = await import_electron2.shell.openPath(storedPrefs.musicFolder);
    return errMsg === "";
  } catch {
    return false;
  }
}
function rebuildTrayMenu() {
  if (!tray) return;
  const displays = import_electron2.screen.getAllDisplays();
  const activeDisplay = resolveTargetDisplay();
  const loginSettings = import_electron2.app.getLoginItemSettings();
  const menu = import_electron2.Menu.buildFromTemplate([
    {
      label: storedPrefs.hidden ? "\u5C55\u5F00\u524D\u53F0\u8C03\u5EA6\u9762\u677F" : "\u8D34\u8FB9\u6536\u8D77\u9762\u677F",
      click: () => toggleHidden()
    },
    {
      label: "\u5237\u65B0 Excel \u6570\u636E",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("stage:trigger-refresh");
        }
      }
    },
    {
      label: "\u9009\u62E9\u7ED1\u5B9A Excel \u6587\u4EF6...",
      click: async () => {
        const snap = await openExcelPicker();
        if (snap && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("stage:trigger-refresh");
        }
      }
    },
    { type: "separator" },
    {
      label: "\u663E\u793A\u952E\u76D8\u5C0F\u732B\uFF08\u542B\u5168\u606F\u5F85\u529E\uFF09",
      type: "checkbox",
      checked: storedPrefs.showCat,
      click: () => updatePrefs({ showCat: !storedPrefs.showCat })
    },
    {
      label: "\u663E\u793A\u6C34\u6EF4\u64AD\u653E\u5668",
      type: "checkbox",
      checked: storedPrefs.showPlayer,
      click: () => updatePrefs({ showPlayer: !storedPrefs.showPlayer })
    },
    {
      label: "\u9009\u62E9\u672C\u5730\u97F3\u4E50\u64AD\u653E\u6587\u4EF6\u5939...",
      click: () => {
        void pickMusicFolder();
      }
    },
    { type: "separator" },
    {
      label: "\u663E\u793A\u5728\u5C4F\u5E55",
      submenu: displays.map((d, idx) => ({
        label: `\u663E\u793A\u5668 ${idx + 1} (${d.size.width}\xD7${d.size.height})${d.id === import_electron2.screen.getPrimaryDisplay().id ? " [\u4E3B\u5C4F]" : ""}`,
        type: "radio",
        checked: d.id === activeDisplay.id,
        click: () => {
          updatePrefs({ displayId: d.id });
        }
      }))
    },
    {
      label: "\u4E3B\u9898\u5916\u89C2",
      submenu: [
        {
          label: "\u8DDF\u968F\u7CFB\u7EDF",
          type: "radio",
          checked: storedPrefs.theme === "system",
          click: () => updatePrefs({ theme: "system" })
        },
        {
          label: "\u6D45\u8272\u78E8\u7802",
          type: "radio",
          checked: storedPrefs.theme === "light",
          click: () => updatePrefs({ theme: "light" })
        },
        {
          label: "\u6DF1\u8272\u78E8\u7802",
          type: "radio",
          checked: storedPrefs.theme === "dark",
          click: () => updatePrefs({ theme: "dark" })
        }
      ]
    },
    {
      label: "\u5168\u5C40\u7F6E\u9876\u60AC\u6D6E",
      type: "checkbox",
      checked: storedPrefs.alwaysOnTop,
      click: () => updatePrefs({ alwaysOnTop: !storedPrefs.alwaysOnTop })
    },
    {
      label: "\u5F00\u673A\u81EA\u52A8\u542F\u52A8",
      type: "checkbox",
      checked: loginSettings.openAtLogin,
      click: () => {
        import_electron2.app.setLoginItemSettings({ openAtLogin: !loginSettings.openAtLogin });
        rebuildTrayMenu();
      }
    },
    { type: "separator" },
    {
      label: "\u9000\u51FA\u4E8B\u4EF6\u5355\u524D\u53F0\u8C03\u5EA6",
      click: () => import_electron2.app.quit()
    }
  ]);
  tray.setContextMenu(menu);
}
async function openExcelPicker() {
  const cfg = configStore.read();
  const result = await import_electron2.dialog.showOpenDialog({
    title: "\u9009\u62E9\u5171\u4EAB\u7684\u4E8B\u4EF6\u5355 Excel \u6587\u4EF6",
    defaultPath: cfg.excelPath,
    filters: [{ name: "Excel \u5DE5\u4F5C\u7C3F (*.xlsx)", extensions: ["xlsx"] }],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const pickedPath = result.filePaths[0];
  const { config: saved } = configStore.write({ excelPath: pickedPath });
  return excelStore.loadWorkbookData(saved.excelPath, saved.preferredSheet);
}
function normalizeHttpUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
function createWindow() {
  const display = resolveTargetDisplay();
  const { x, y, width, height } = display.workArea;
  const winWidth = Math.min(OVERLAY_WINDOW_WIDTH, width);
  mainWindow = new import_electron2.BrowserWindow({
    x: x + width - winWidth,
    y,
    width: winWidth,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: storedPrefs.alwaysOnTop,
    focusable: true,
    backgroundColor: "#00000000",
    show: !isSmokeTest,
    webPreferences: {
      preload: (0, import_node_path4.join)(appRoot, "dist-app", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  applyAlwaysOnTop(mainWindow);
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  lastInteractive = false;
  mainWindow.on("blur", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      setMousePassThrough(mainWindow, false);
      mainWindow.webContents.send("stage:window-blur");
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadFile((0, import_node_path4.join)(appRoot, "dist-app", "index.html"));
  if (isSmokeTest) {
    mainWindow.webContents.once("did-finish-load", async () => {
      try {
        await new Promise((r) => setTimeout(r, 250));
        const res = await mainWindow?.webContents.executeJavaScript(
          'Promise.all([window.stageApi.invoke("load", {}), window.stageApi.getPrefs(), window.stageApi.getLocalMusic()])'
        );
        const [loadRes, prefsRes, musicRes] = res;
        if (typeof prefsRes?.showCat !== "boolean" || typeof prefsRes?.showPlayer !== "boolean" || typeof prefsRes?.musicFolder !== "string" || !Array.isArray(prefsRes?.trafficLights) || prefsRes.trafficLights.length !== 3 || typeof musicRes?.folderPath !== "string") {
          throw new Error("DesktopPreferences missing new widget fields");
        }
        console.log(
          `ELECTRON_SMOKE_OK rows=${loadRes?.rows?.length ?? -1} activeSheet=${loadRes?.activeSheet ?? "null"} showCat=${prefsRes.showCat} showPlayer=${prefsRes.showPlayer} lights=${prefsRes.trafficLights.length}`
        );
        import_electron2.app.exit(0);
      } catch (err) {
        console.error("ELECTRON_SMOKE_FAILED:", err);
        import_electron2.app.exit(1);
      }
    });
  }
}
function registerIpcHandlers() {
  import_electron2.ipcMain.on("stage:set-interactive", (_event, interactive) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    setMousePassThrough(mainWindow, Boolean(interactive));
  });
  import_electron2.ipcMain.handle("stage:get-prefs", () => getFullPrefs());
  import_electron2.ipcMain.handle("stage:update-prefs", (_event, patch) => {
    const cleanPatch = {};
    if (patch.theme === "system" || patch.theme === "light" || patch.theme === "dark") {
      cleanPatch.theme = patch.theme;
    }
    if (typeof patch.alwaysOnTop === "boolean") cleanPatch.alwaysOnTop = patch.alwaysOnTop;
    if (typeof patch.hidden === "boolean") cleanPatch.hidden = patch.hidden;
    if (patch.displayId === null || typeof patch.displayId === "number") {
      cleanPatch.displayId = patch.displayId;
    }
    if (typeof patch.stageWidth === "number" && patch.stageWidth >= 300 && patch.stageWidth <= 540) {
      cleanPatch.stageWidth = Math.round(patch.stageWidth);
    }
    if (typeof patch.showCat === "boolean") cleanPatch.showCat = patch.showCat;
    if (typeof patch.showPlayer === "boolean") cleanPatch.showPlayer = patch.showPlayer;
    if (typeof patch.musicFolder === "string") {
      cleanPatch.musicFolder = patch.musicFolder.trim().slice(0, 512);
    }
    if (Array.isArray(patch.trafficLights)) {
      cleanPatch.trafficLights = sanitizeTrafficLights(patch.trafficLights);
    }
    if (Array.isArray(patch.todos)) {
      cleanPatch.todos = sanitizeTodos(patch.todos);
    }
    if (typeof patch.todoIntervalMinutes === "number") {
      cleanPatch.todoIntervalMinutes = sanitizeTodoInterval(patch.todoIntervalMinutes);
    }
    return updatePrefs(cleanPatch);
  });
  import_electron2.ipcMain.handle("stage:open-external", async (_event, rawUrl) => {
    if (typeof rawUrl !== "string") return false;
    const safeUrl = normalizeHttpUrl(rawUrl);
    if (!safeUrl) return false;
    try {
      await import_electron2.shell.openExternal(safeUrl);
      return true;
    } catch {
      return false;
    }
  });
  import_electron2.ipcMain.handle("stage:open-path", async (_event, rawPath) => {
    if (typeof rawPath !== "string") return false;
    const trimmed = rawPath.trim();
    if (!trimmed) return false;
    try {
      const errMsg = await import_electron2.shell.openPath(trimmed);
      return errMsg === "";
    } catch {
      return false;
    }
  });
  import_electron2.ipcMain.handle("stage:trigger-hotkey", async (_event, rawCombo) => {
    if (typeof rawCombo !== "string" || !rawCombo.trim()) return false;
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
      mainWindow.blur();
      await new Promise((r) => setTimeout(r, 45));
    }
    return sendHotkeyCombo(rawCombo);
  });
  import_electron2.ipcMain.handle("stage:open-bound-excel", async () => {
    const cfg = configStore.read();
    try {
      const errMsg = await import_electron2.shell.openPath(cfg.excelPath);
      return errMsg === "";
    } catch {
      return false;
    }
  });
  import_electron2.ipcMain.handle("stage:pick-excel", () => openExcelPicker());
  import_electron2.ipcMain.handle("stage:pick-any-file", async () => {
    const result = await import_electron2.dialog.showOpenDialog({
      title: "\u9009\u62E9\u5FEB\u6377\u542F\u52A8\u6587\u4EF6\u6216\u5E94\u7528",
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  import_electron2.ipcMain.handle("stage:get-media-state", () => mediaMonitor.getState());
  import_electron2.ipcMain.handle("stage:media-control", (_event, action) => {
    if (action !== "prev" && action !== "next" && action !== "toggle") return false;
    return mediaMonitor.control(action);
  });
  import_electron2.ipcMain.handle("stage:get-local-music", () => localMusicStore.getLibrary());
  import_electron2.ipcMain.handle("stage:pick-music-folder", () => pickMusicFolder());
  import_electron2.ipcMain.handle("stage:open-music-folder", () => openMusicFolder());
  import_electron2.ipcMain.handle("stage:music-context-menu", async () => {
    if (!storedPrefs.musicFolder.trim()) {
      await pickMusicFolder();
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const menu = import_electron2.Menu.buildFromTemplate([
      {
        label: "\u6253\u5F00\u64AD\u653E\u6587\u4EF6\u5939",
        click: () => {
          void openMusicFolder();
        }
      },
      {
        label: "\u66F4\u6362\u64AD\u653E\u6587\u4EF6\u5939...",
        click: () => {
          void pickMusicFolder();
        }
      },
      {
        label: "\u5237\u65B0\u66F2\u76EE\u5217\u8868",
        click: () => {
          localMusicStore.loadFolder(storedPrefs.musicFolder);
          broadcastLocalMusic();
        }
      },
      { type: "separator" },
      {
        label: "\u5207\u6362\u56DE\u7CFB\u7EDF\u5A92\u4F53\u6A21\u5F0F (SMTC)",
        click: () => {
          updatePrefs({ musicFolder: "" });
        }
      }
    ]);
    menu.popup({ window: mainWindow });
  });
  import_electron2.ipcMain.handle("stage:api", async (_event, endpoint, payload) => {
    const cfg = configStore.read();
    switch (endpoint) {
      case "load": {
        const req = payload && typeof payload === "object" ? payload : {};
        const sheetName = typeof req.sheetName === "string" && req.sheetName.trim() !== "" ? req.sheetName.trim() : cfg.preferredSheet;
        return excelStore.loadWorkbookData(cfg.excelPath, sheetName);
      }
      case "check-status": {
        const req = payload && typeof payload === "object" ? payload : {};
        const known = typeof req.knownVersion === "string" || req.knownVersion === null ? req.knownVersion : null;
        return excelStore.checkWorkbookStatus(cfg.excelPath, known);
      }
      case "save-cell": {
        const req = payload;
        return excelStore.saveCellsToWorkbook({
          excelPath: cfg.excelPath,
          sheetName: req.sheetName,
          edits: [{ rowNumber: req.rowNumber, colIndex: req.colIndex, value: String(req.value ?? "") }],
          expectedVersion: req.expectedVersion ?? null,
          forceOverwrite: Boolean(req.forceOverwrite)
        });
      }
      case "save-batch": {
        const req = payload;
        return excelStore.saveCellsToWorkbook({
          excelPath: cfg.excelPath,
          sheetName: req.sheetName,
          edits: Array.isArray(req.edits) ? req.edits : [],
          expectedVersion: req.expectedVersion ?? null,
          forceOverwrite: Boolean(req.forceOverwrite)
        });
      }
      case "set-config": {
        const req = payload;
        if (typeof req?.excelPath !== "string" || req.excelPath.trim() === "") {
          throw new Error("excelPath must be a non-empty string");
        }
        const { config: savedCfg } = configStore.write({
          excelPath: req.excelPath,
          ...typeof req.preferredSheet === "string" && req.preferredSheet.trim() !== "" ? { preferredSheet: req.preferredSheet.trim() } : {}
        });
        return excelStore.loadWorkbookData(savedCfg.excelPath, savedCfg.preferredSheet);
      }
      case "create-sample": {
        const req = payload && typeof payload === "object" ? payload : {};
        const targetPath = typeof req.excelPath === "string" && req.excelPath.trim() !== "" ? (0, import_node_path4.resolve)(req.excelPath.trim()) : cfg.excelPath;
        await excelStore.createSampleWorkbook(targetPath);
        const { config: savedCfg } = configStore.write({ excelPath: targetPath });
        return excelStore.loadWorkbookData(savedCfg.excelPath);
      }
      default:
        throw new Error(`Unknown IPC endpoint: ${endpoint}`);
    }
  });
}
void import_electron2.app.whenReady().then(() => {
  import_electron2.protocol.handle("stage-audio", (request) => {
    try {
      const parsed = new URL(request.url);
      const indexStr = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      const idx = Number.parseInt(indexStr, 10);
      const filePath = localMusicStore.resolveTrackPath(idx);
      if (!filePath) {
        return new Response("Track not found", { status: 404 });
      }
      return import_electron2.net.fetch((0, import_node_url.pathToFileURL)(filePath).toString(), { headers: request.headers });
    } catch {
      return new Response("Bad track URL", { status: 400 });
    }
  });
  registerIpcHandlers();
  createWindow();
  inputMonitor.start((evt) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("stage:input-activity", evt);
    }
  });
  mediaMonitor.start((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("stage:media-state", state);
    }
  });
  syncWidgetsRuntime();
  if (!isSmokeTest) {
    const iconPath = (0, import_node_path4.join)(appRoot, "assets", "tray-icon.png");
    const icon = import_electron2.nativeImage.createFromPath(iconPath);
    tray = new import_electron2.Tray(icon);
    tray.setToolTip("\u4E8B\u4EF6\u5355\u524D\u53F0\u8C03\u5EA6\u53F0\uFF08\u4E0E DSH / Chrome \u5171\u4EAB Excel\uFF09");
    tray.on("click", () => toggleHidden());
    rebuildTrayMenu();
    try {
      import_electron2.globalShortcut.register("Alt+Shift+E", () => toggleHidden());
    } catch {
    }
  }
  import_electron2.nativeTheme.on("updated", () => {
    if (storedPrefs.theme === "system") {
      broadcastPrefs();
    }
  });
  const reposition = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionOverlayWindow(mainWindow);
    }
    rebuildTrayMenu();
  };
  import_electron2.screen.on("display-metrics-changed", reposition);
  import_electron2.screen.on("display-added", reposition);
  import_electron2.screen.on("display-removed", reposition);
});
import_electron2.app.on("second-instance", () => {
  if (storedPrefs.hidden) {
    updatePrefs({ hidden: false });
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive();
  }
});
import_electron2.app.on("will-quit", () => {
  inputMonitor.stop();
  mediaMonitor.stop();
  import_electron2.globalShortcut.unregisterAll();
});
