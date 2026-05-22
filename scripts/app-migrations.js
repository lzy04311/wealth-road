"use strict";

function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
function v1ToV2(rawState) {
  var next = clonePlain(rawState);
  next.assetItems = Array.isArray(next.assetItems) ? next.assetItems : [];
  next.schemaVersion = 2;
  return next;
}
function migrateState(rawState) {
  var errors = validateImportData(rawState);
  if (errors.length) throw new Error(errors.join("\n"));
  var version = Number(rawState.schemaVersion);
  var next = clonePlain(rawState);
  if (version === 1) {
    next = v1ToV2(rawState);
    version = 2;
  }
  if (version !== CURRENT_SCHEMA_VERSION) throw new Error("不支持的备份版本：" + rawState.schemaVersion + "。");
  return next;
}
