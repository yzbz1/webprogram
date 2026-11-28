"use strict";

// src/main/preload.ts
var import_electron = require("electron");
var api = {
  invoke(endpoint, payload) {
    return import_electron.ipcRenderer.invoke("stage:api", endpoint, payload);
  },
  setInteractive(interactive) {
    import_electron.ipcRenderer.send("stage:set-interactive", Boolean(interactive));
  },
  openExternal(url) {
    return import_electron.ipcRenderer.invoke("stage:open-external", url);
  },
  openPath(target) {
    return import_electron.ipcRenderer.invoke("stage:open-path", target);
  },
  triggerHotkey(combo) {
    return import_electron.ipcRenderer.invoke("stage:trigger-hotkey", combo);
  },
  openBoundExcel() {
    return import_electron.ipcRenderer.invoke("stage:open-bound-excel");
  },
  pickExcelFile() {
    return import_electron.ipcRenderer.invoke("stage:pick-excel");
  },
  pickAnyFile() {
    return import_electron.ipcRenderer.invoke("stage:pick-any-file");
  },
  getPrefs() {
    return import_electron.ipcRenderer.invoke("stage:get-prefs");
  },
  updatePrefs(patch) {
    return import_electron.ipcRenderer.invoke("stage:update-prefs", patch);
  },
  onWindowBlur(cb) {
    const handler = () => cb();
    import_electron.ipcRenderer.on("stage:window-blur", handler);
    return () => import_electron.ipcRenderer.removeListener("stage:window-blur", handler);
  },
  onPrefsChanged(cb) {
    const handler = (_event, prefs) => cb(prefs);
    import_electron.ipcRenderer.on("stage:prefs-changed", handler);
    return () => import_electron.ipcRenderer.removeListener("stage:prefs-changed", handler);
  },
  onTriggerRefresh(cb) {
    const handler = () => cb();
    import_electron.ipcRenderer.on("stage:trigger-refresh", handler);
    return () => import_electron.ipcRenderer.removeListener("stage:trigger-refresh", handler);
  },
  onInputActivity(cb) {
    const handler = (_event, evt) => cb(evt);
    import_electron.ipcRenderer.on("stage:input-activity", handler);
    return () => import_electron.ipcRenderer.removeListener("stage:input-activity", handler);
  },
  getMediaState() {
    return import_electron.ipcRenderer.invoke("stage:get-media-state");
  },
  onMediaState(cb) {
    const handler = (_event, state) => cb(state);
    import_electron.ipcRenderer.on("stage:media-state", handler);
    return () => import_electron.ipcRenderer.removeListener("stage:media-state", handler);
  },
  mediaControl(action) {
    return import_electron.ipcRenderer.invoke("stage:media-control", action);
  },
  getLocalMusic() {
    return import_electron.ipcRenderer.invoke("stage:get-local-music");
  },
  onLocalMusicChanged(cb) {
    const handler = (_event, lib) => cb(lib);
    import_electron.ipcRenderer.on("stage:local-music-changed", handler);
    return () => import_electron.ipcRenderer.removeListener("stage:local-music-changed", handler);
  },
  pickMusicFolder() {
    return import_electron.ipcRenderer.invoke("stage:pick-music-folder");
  },
  openMusicFolder() {
    return import_electron.ipcRenderer.invoke("stage:open-music-folder");
  },
  showMusicContextMenu() {
    return import_electron.ipcRenderer.invoke("stage:music-context-menu");
  }
};
import_electron.contextBridge.exposeInMainWorld("stageApi", api);
