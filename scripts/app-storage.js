"use strict";

var STORAGE_KEY = "general_money_manager_v1";
var STORAGE_RECOVERY_KEY = STORAGE_KEY + "_recovery";
var STORAGE_SYNC_META_KEY = STORAGE_KEY + "_sync_meta";
var syncMeta = null;

function storeCorruptState(rawText, err) {
  try {
    localStorage.setItem(STORAGE_RECOVERY_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      error: String(err && err.message ? err.message : err),
      raw: rawText
    }));
  } catch (storageErr) {}
}

function loadState() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeState(null);
  try {
    return normalizeState(migrateState(JSON.parse(raw)));
  } catch (err) {
    storeCorruptState(raw, err);
    if (typeof appAlert === "function") appAlert("数据异常", "本地数据可能已损坏，系统已进入安全默认模式。损坏原文已保存到 recovery key，请先导出或联系维护者处理。");
    else if (typeof alert === "function") alert("本地数据可能已损坏，系统已进入安全默认模式。损坏原文已保存到 recovery key，请先导出或联系维护者处理。");
    return normalizeState(null);
  }
}

function defaultSyncMeta() {
  return { localUpdatedAt: "", lastCloudUpdatedAt: "", lastSyncedAt: "" };
}

function loadSyncMeta() {
  var raw = localStorage.getItem(STORAGE_SYNC_META_KEY);
  if (!raw) return defaultSyncMeta();
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaultSyncMeta();
    return {
      localUpdatedAt: typeof parsed.localUpdatedAt === "string" ? parsed.localUpdatedAt : "",
      lastCloudUpdatedAt: typeof parsed.lastCloudUpdatedAt === "string" ? parsed.lastCloudUpdatedAt : "",
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : ""
    };
  } catch (err) {
    return defaultSyncMeta();
  }
}

function saveSyncMeta() {
  try {
    localStorage.setItem(STORAGE_SYNC_META_KEY, JSON.stringify(syncMeta || defaultSyncMeta()));
    return true;
  } catch (err) {
    return false;
  }
}

function updateSyncMeta(patch) {
  syncMeta = Object.assign(defaultSyncMeta(), syncMeta || {}, patch || {});
  saveSyncMeta();
  return syncMeta;
}

function touchLocalSyncMeta(isoText) {
  updateSyncMeta({ localUpdatedAt: isoText || new Date().toISOString() });
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastSavedAt = new Date();
    touchLocalSyncMeta(lastSavedAt.toISOString());
    updateSaveStatusUI();
    if (typeof scheduleCloudPushAfterLocalSave === "function") scheduleCloudPushAfterLocalSave();
    if (typeof scheduleIdbBackup === "function") scheduleIdbBackup();
    return true;
  } catch (err) {
    notify("保存失败：浏览器本地存储空间可能已满，请先导出备份。");
    return false;
  }
}

syncMeta = loadSyncMeta();
state = loadState();
