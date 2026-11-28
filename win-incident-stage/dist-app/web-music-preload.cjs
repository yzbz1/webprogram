"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main/web-music-preload.ts
var web_music_preload_exports = {};
module.exports = __toCommonJS(web_music_preload_exports);
var import_electron = require("electron");
if (window.location.protocol === "file:") {
  const api = {
    getHomeUrl() {
      return import_electron.ipcRenderer.invoke("stage:web-music-start-get-url");
    },
    openUrl(rawUrl) {
      return import_electron.ipcRenderer.invoke("stage:web-music-start-open-url", rawUrl);
    },
    clearSession() {
      return import_electron.ipcRenderer.invoke("stage:clear-web-music-session");
    }
  };
  import_electron.contextBridge.exposeInMainWorld("stageWebMusicSetup", api);
}
