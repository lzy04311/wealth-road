"use strict";

var STORAGE_KEY = "general_money_manager_v1";
var STORAGE_RECOVERY_KEY = STORAGE_KEY + "_recovery";

function storeCorruptState(rawText, err) {
  try {
    localStorage.setItem(STORAGE_RECOVERY_KEY, JSON.stringify({ savedAt: new Date().toISOString(), error: String(err && err.message ? err.message : err), raw: rawText }));
  } catch (storageErr) {}
}
function loadState() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeState(null);
  try {
    return normalizeState(migrateState(JSON.parse(raw)));
  } catch (err) {
    storeCorruptState(raw, err);
    alert("本地数据可能已损坏，系统已进入安全默认模式。损坏原文已保存到 recovery key，请先导出或联系维护者处理。");
    return normalizeState(null);
  }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastSavedAt = new Date();
    updateSaveStatusUI();
    return true;
  } catch (err) {
    alert("保存失败：浏览器本地存储空间可能已满，请先导出备份。");
    return false;
  }
}

state = loadState();
