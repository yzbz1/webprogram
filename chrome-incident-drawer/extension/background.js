// src/shared/types.ts
var API_ROUTE_PATH = "/api/incident-drawer";
var HEALTH_ROUTE_PATH = "/health";
var CLIENT_HEADER_NAME = "x-incident-drawer-client";
var CLIENT_HEADER_VALUE = "chrome-ext";
var DEFAULT_BRIDGE_PORT = 17892;

// src/extension/background.ts
async function getBridgePort() {
  try {
    const res = await chrome.storage.local.get("settings");
    const port = Number(res?.settings?.bridgePort);
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      return port;
    }
  } catch {
  }
  return DEFAULT_BRIDGE_PORT;
}
async function callBridgeApi(endpoint, payload) {
  const port = await getBridgePort();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8e3);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${API_ROUTE_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CLIENT_HEADER_NAME]: CLIENT_HEADER_VALUE
      },
      body: JSON.stringify({ endpoint, payload }),
      signal: controller.signal
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || `\u8BF7\u6C42\u5931\u8D25 (HTTP ${res.status})`
      };
    }
    return { ok: true, value: data.value };
  } catch (err) {
    return {
      ok: false,
      offline: true,
      error: err instanceof Error && err.name === "AbortError" ? "\u672C\u5730 Excel \u670D\u52A1\u54CD\u5E94\u8D85\u65F6" : "\u672A\u8FDE\u63A5\u5230\u672C\u5730 Excel \u670D\u52A1\uFF0C\u8BF7\u542F\u52A8 start-bridge-silent.vbs"
    };
  } finally {
    clearTimeout(timer);
  }
}
async function checkBridgeHealth(explicitPort) {
  const port = explicitPort && explicitPort > 0 && explicitPort <= 65535 ? explicitPort : await getBridgePort();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${HEALTH_ROUTE_PATH}`, {
      method: "GET",
      signal: controller.signal
    });
    if (!res.ok) {
      return { ok: false, offline: true, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return data;
  } catch {
    return { ok: false, offline: true, error: "\u672C\u5730\u670D\u52A1\u672A\u8FD0\u884C" };
  } finally {
    clearTimeout(timer);
  }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;
  const msg = message;
  if (msg.type === "INCIDENT_API" && typeof msg.endpoint === "string") {
    void callBridgeApi(msg.endpoint, msg.payload).then(sendResponse);
    return true;
  }
  if (msg.type === "BRIDGE_HEALTH") {
    void checkBridgeHealth(typeof msg.port === "number" ? msg.port : void 0).then(sendResponse);
    return true;
  }
  return false;
});
