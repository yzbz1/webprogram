"use strict";
(() => {
  // src/shared/types.ts
  var DEFAULT_BRIDGE_PORT = 17892;
  var DEFAULT_EXTENSION_SETTINGS = {
    enabled: true,
    siteMode: "all-except",
    blockedHosts: [],
    allowedHosts: [],
    theme: "system",
    bridgePort: DEFAULT_BRIDGE_PORT
  };

  // src/extension/popup.ts
  function normalizeSettings(raw) {
    if (!raw || typeof raw !== "object") return DEFAULT_EXTENSION_SETTINGS;
    const obj = raw;
    return {
      enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_EXTENSION_SETTINGS.enabled,
      siteMode: obj.siteMode === "only-listed" ? "only-listed" : "all-except",
      blockedHosts: Array.isArray(obj.blockedHosts) ? obj.blockedHosts.filter((x) => typeof x === "string") : [],
      allowedHosts: Array.isArray(obj.allowedHosts) ? obj.allowedHosts.filter((x) => typeof x === "string") : [],
      theme: obj.theme === "dark" || obj.theme === "light" ? obj.theme : "system",
      bridgePort: typeof obj.bridgePort === "number" && obj.bridgePort > 0 && obj.bridgePort <= 65535 ? obj.bridgePort : DEFAULT_EXTENSION_SETTINGS.bridgePort
    };
  }
  function parseLines(text) {
    return text.split(/[\r\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  async function initPopup() {
    const bridgeDot = document.getElementById("bridge-dot");
    const bridgeStatus = document.getElementById("bridge-status");
    const excelPathEl = document.getElementById("excel-path");
    const bridgeHintEl = document.getElementById("bridge-hint");
    const btnRecheck = document.getElementById("btn-recheck");
    const chkEnabled = document.getElementById("chk-enabled");
    const siteToggleRow = document.getElementById("site-toggle-row");
    const currentHostEl = document.getElementById("current-host");
    const btnToggleSite = document.getElementById("btn-toggle-site");
    const selSiteMode = document.getElementById("sel-site-mode");
    const domainsLabel = document.getElementById("domains-label");
    const txtDomains = document.getElementById("txt-domains");
    const selTheme = document.getElementById("sel-theme");
    const numPort = document.getElementById("num-port");
    const btnSave = document.getElementById("btn-save");
    const saveToast = document.getElementById("save-toast");
    let settings = normalizeSettings((await chrome.storage.local.get("settings"))?.settings);
    let activeHost = "";
    const refreshHealth = async (port) => {
      bridgeStatus.textContent = "\u68C0\u6D4B\u4E2D...";
      bridgeDot.className = "dot";
      const res = await chrome.runtime.sendMessage({ type: "BRIDGE_HEALTH", port });
      if (res?.ok) {
        bridgeDot.className = "dot ok";
        bridgeStatus.textContent = "\u5DF2\u8FDE\u63A5";
        excelPathEl.textContent = `Excel\uFF1A${res.excelPath}`;
        bridgeHintEl.style.display = "none";
      } else {
        bridgeDot.className = "dot err";
        bridgeStatus.textContent = "\u672A\u8FDE\u63A5";
        excelPathEl.textContent = "\u672A\u8FDE\u63A5\u5230 127.0.0.1 \u672C\u5730 Excel \u670D\u52A1";
        bridgeHintEl.style.display = "block";
      }
    };
    const renderDomainUi = () => {
      const mode = selSiteMode.value;
      if (mode === "only-listed") {
        domainsLabel.textContent = "\u5141\u8BB8\u663E\u793A\u7684\u57DF\u540D\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF0C\u652F\u6301 *.internal\uFF09";
        txtDomains.value = settings.allowedHosts.join("\n");
      } else {
        domainsLabel.textContent = "\u6392\u9664\u57DF\u540D\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF0C\u652F\u6301 *.example.com\uFF09";
        txtDomains.value = settings.blockedHosts.join("\n");
      }
      if (activeHost) {
        siteToggleRow.style.display = "flex";
        currentHostEl.textContent = activeHost;
        const inList = mode === "only-listed" ? settings.allowedHosts.includes(activeHost) : settings.blockedHosts.includes(activeHost);
        if (mode === "only-listed") {
          btnToggleSite.textContent = inList ? "\u4ECE\u767D\u540D\u5355\u79FB\u9664" : "\u52A0\u5165\u767D\u540D\u5355";
        } else {
          btnToggleSite.textContent = inList ? "\u6062\u590D\u5728\u6B64\u7AD9\u663E\u793A" : "\u5728\u6B64\u7AD9\u9690\u85CF";
        }
      }
    };
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeUrl = tabs[0]?.url;
    if (activeUrl) {
      try {
        const u = new URL(activeUrl);
        if (u.protocol === "http:" || u.protocol === "https:") {
          activeHost = u.hostname.toLowerCase();
        }
      } catch {
      }
    }
    chkEnabled.checked = settings.enabled;
    selSiteMode.value = settings.siteMode;
    selTheme.value = settings.theme;
    numPort.value = String(settings.bridgePort);
    renderDomainUi();
    void refreshHealth(settings.bridgePort);
    const saveSettings = async (next, toastMsg = "\u5DF2\u4FDD\u5B58\u8BBE\u7F6E") => {
      settings = next;
      await chrome.storage.local.set({ settings: next });
      renderDomainUi();
      saveToast.textContent = toastMsg;
      window.setTimeout(() => {
        if (saveToast.textContent === toastMsg) saveToast.textContent = "";
      }, 2e3);
    };
    chkEnabled.addEventListener("change", () => {
      void saveSettings({ ...settings, enabled: chkEnabled.checked });
    });
    selSiteMode.addEventListener("change", () => {
      const nextMode = selSiteMode.value;
      settings = { ...settings, siteMode: nextMode };
      renderDomainUi();
    });
    btnToggleSite.addEventListener("click", () => {
      if (!activeHost) return;
      const mode = selSiteMode.value;
      if (mode === "only-listed") {
        const exists = settings.allowedHosts.includes(activeHost);
        const nextList = exists ? settings.allowedHosts.filter((h) => h !== activeHost) : [...settings.allowedHosts, activeHost];
        void saveSettings({ ...settings, siteMode: mode, allowedHosts: nextList });
      } else {
        const exists = settings.blockedHosts.includes(activeHost);
        const nextList = exists ? settings.blockedHosts.filter((h) => h !== activeHost) : [...settings.blockedHosts, activeHost];
        void saveSettings({ ...settings, siteMode: mode, blockedHosts: nextList });
      }
    });
    btnSave.addEventListener("click", () => {
      const mode = selSiteMode.value;
      const domains = parseLines(txtDomains.value);
      const parsedPort = Number(numPort.value);
      const bridgePort = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : settings.bridgePort;
      const next = {
        enabled: chkEnabled.checked,
        siteMode: mode,
        allowedHosts: mode === "only-listed" ? domains : settings.allowedHosts,
        blockedHosts: mode === "all-except" ? domains : settings.blockedHosts,
        theme: selTheme.value,
        bridgePort
      };
      void saveSettings(next).then(() => refreshHealth(bridgePort));
    });
    btnRecheck.addEventListener("click", () => {
      void refreshHealth(settings.bridgePort);
    });
  }
  void initPopup();
})();
