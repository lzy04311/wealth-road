"use strict";

function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
function v1ToV2(rawState) {
  var next = clonePlain(rawState);
  next.assetItems = Array.isArray(next.assetItems) ? next.assetItems : [];
  next.schemaVersion = 2;
  return next;
}
function v2ToV3(rawState) {
  var next = clonePlain(rawState);
  next.transfers = Array.isArray(next.transfers) ? next.transfers : [];
  next.liabilities = Array.isArray(next.liabilities) ? next.liabilities : [];
  next.accounts = (next.accounts || []).map(function (account) {
    account.openingBalance = account.openingBalance == null ? 0 : account.openingBalance;
    account.openingBalanceDate = account.openingBalanceDate || "";
    account.valuationMethod = account.valuationMethod || (account.type === "长期投资" ? "净值快照" : "流水余额");
    account.archived = !!account.archived;
    return account;
  });
  next.incomes = (next.incomes || []).map(function (item) { item.accountId = item.accountId || ""; return item; });
  next.expenses = (next.expenses || []).map(function (item) { item.sourceAccountId = item.sourceAccountId || ""; return item; });
  next.investments = (next.investments || []).map(function (item) { item.sourceAccountId = item.sourceAccountId || ""; return item; });
  next.assetItems = (next.assetItems || []).map(function (item) {
    item.valuationMode = item.valuationMode || defaultAssetValuationMode(item);
    item.linkedAccountId = item.linkedAccountId || "";
    item.valuationDate = item.valuationDate || "";
    return item;
  });
  next.schemaVersion = 3;
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
  if (version === 2) {
    next = v2ToV3(next);
    version = 3;
  }
  if (version !== CURRENT_SCHEMA_VERSION) throw new Error("不支持的备份版本：" + rawState.schemaVersion + "。");
  return next;
}
