"use strict";

var STORAGE_KEY = "general_money_manager_v1";
var STORAGE_RECOVERY_KEY = STORAGE_KEY + "_recovery";
var STORAGE_SYNC_META_KEY = STORAGE_KEY + "_sync_meta";
var syncMeta = null;
var storageHealth = {
  checked: false,
  localWritable: null,
  idbAvailable: null,
  backupCount: null,
  latestBackupAt: "",
  usage: null,
  quota: null,
  error: ""
};

function storageByteText(bytes) {
  if (bytes == null || !isFinite(bytes)) return "";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1) + " MB";
  if (bytes >= 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return Math.max(0, Math.round(bytes)) + " B";
}

function storageHealthPresentation() {
  var health = storageHealth || {};
  if (!health.checked) return { label: "存储状态待检测", shortLabel: "待检测", className: "warning", detail: "正在检查本地写入和自动备份能力" };
  if (!health.localWritable) return { label: "本地存储异常", shortLabel: "写入异常", className: "negative", detail: health.error || "当前浏览器无法写入 localStorage，请先导出并检查隐私或容量设置" };
  var capacity = health.usage != null && health.quota ? " · 浏览器存储 " + storageByteText(health.usage) + " / " + storageByteText(health.quota) : "";
  if (health.idbAvailable === false) return { label: "本地可写 · 无自动备份", shortLabel: "本地可写", className: "warning", detail: "localStorage 写入测试通过；当前环境没有可用的 IndexedDB" + capacity };
  if (!health.backupCount) return { label: "本地可写 · 待形成备份", shortLabel: "待形成备份", className: "warning", detail: "localStorage 与 IndexedDB 可用，但尚未读到自动备份" + capacity };
  return { label: "本地可写 · 已验证备份", shortLabel: "已验证备份", className: "positive", detail: "localStorage 写入测试通过；已读到 " + health.backupCount + " 份自动备份，最近一份 " + String(health.latestBackupAt || "").replace("T", " ").slice(0, 19) + capacity };
}

function updateStorageHealthUI() {
  var display = storageHealthPresentation();
  var dashboardEl = document.getElementById("dashboardStorageHealth");
  var bottomEl = document.getElementById("dashboardBottomStorageHealth");
  var dataLabel = byId("dataStorageHealthLabel");
  var dataDetail = byId("dataStorageHealthDetail");
  if (dashboardEl) {
    dashboardEl.textContent = "● " + display.shortLabel;
    dashboardEl.className = display.className;
    if (dashboardEl.parentElement && typeof dashboardEl.parentElement.setAttribute === "function") dashboardEl.parentElement.setAttribute("data-dash-tip", display.detail);
  }
  if (bottomEl) { bottomEl.textContent = display.shortLabel; bottomEl.className = display.className; }
  if (dataLabel) { dataLabel.textContent = display.label; dataLabel.className = display.className; }
  if (dataDetail) dataDetail.textContent = display.detail;
}

function acceptStorageBackupSnapshot(rows) {
  var list = Array.isArray(rows) ? rows : [];
  storageHealth.idbAvailable = true;
  storageHealth.backupCount = list.length;
  storageHealth.latestBackupAt = list.length ? String(list[0].savedAt || "") : "";
  storageHealth.checked = storageHealth.localWritable != null;
  updateStorageHealthUI();
}

function probeLocalStorageWrite() {
  var key = STORAGE_KEY + "_health_probe";
  var token = String(Date.now()) + "-" + Math.random();
  try {
    localStorage.setItem(key, token);
    var ok = localStorage.getItem(key) === token;
    localStorage.removeItem(key);
    if (ok) storageHealth.error = "";
    return ok;
  } catch (err) {
    try { localStorage.removeItem(key); } catch (cleanupErr) {}
    storageHealth.error = String(err && err.message ? err.message : err);
    return false;
  }
}

function refreshStorageHealth() {
  storageHealth.localWritable = probeLocalStorageWrite();
  storageHealth.checked = true;
  var estimatePromise = typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function"
    ? navigator.storage.estimate().catch(function () { return null; })
    : Promise.resolve(null);
  var backupPromise = typeof idbOpen === "function"
    ? idbOpen().then(function (db) {
      if (!db) return { available: false, rows: [] };
      return idbListBackups(db).then(function (rows) { return { available: true, rows: rows }; });
    }).catch(function () { return { available: false, rows: [] }; })
    : Promise.resolve({ available: false, rows: [] });
  return Promise.all([estimatePromise, backupPromise]).then(function (results) {
    var estimate = results[0], backup = results[1];
    storageHealth.usage = estimate && typeof estimate.usage === "number" ? estimate.usage : null;
    storageHealth.quota = estimate && typeof estimate.quota === "number" ? estimate.quota : null;
    storageHealth.idbAvailable = backup.available;
    storageHealth.backupCount = backup.rows.length;
    storageHealth.latestBackupAt = backup.rows.length ? String(backup.rows[0].savedAt || "") : "";
    updateStorageHealthUI();
    return storageHealth;
  });
}

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
    if (typeof refreshStorageHealth === "function") refreshStorageHealth();
    return true;
  } catch (err) {
    notify("保存失败：浏览器本地存储空间可能已满，请先导出备份。");
    return false;
  }
}

syncMeta = loadSyncMeta();
if (syncMeta.localUpdatedAt) {
  var hydratedSavedAt = new Date(syncMeta.localUpdatedAt);
  if (!isNaN(hydratedSavedAt.getTime())) lastSavedAt = hydratedSavedAt;
}
state = loadState();
