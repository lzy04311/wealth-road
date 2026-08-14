"use strict";

function isPlainObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function validateSchemaVersion(data) {
  var errors = [];
  if (!isPlainObject(data)) return ["备份文件必须是 JSON 对象。"];
  if (!Object.prototype.hasOwnProperty.call(data, "schemaVersion")) errors.push("缺少 schemaVersion。");
  else if (!Number.isInteger(Number(data.schemaVersion))) errors.push("schemaVersion 必须是数字。");
  else if (Number(data.schemaVersion) < 1) errors.push("schemaVersion 不能小于 1。");
  else if (Number(data.schemaVersion) > CURRENT_SCHEMA_VERSION) errors.push("不支持的未来备份版本：" + data.schemaVersion + "。");
  return errors;
}
function validateStateShape(data) {
  var errors = validateSchemaVersion(data);
  if (errors.length && !isPlainObject(data)) return errors;

  ["accounts", "incomes", "expenses", "investments", "snapshots"].forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) errors.push("缺少核心字段 " + key + "。");
    else if (!Array.isArray(data[key])) errors.push("核心字段 " + key + " 必须是数组。");
  });
  if (!Object.prototype.hasOwnProperty.call(data, "monthlyPlans")) errors.push("缺少核心字段 monthlyPlans。");
  else if (!isPlainObject(data.monthlyPlans)) errors.push("核心字段 monthlyPlans 必须是对象。");
  if (!Object.prototype.hasOwnProperty.call(data, "rules")) errors.push("缺少核心字段 rules。");
  else if (typeof data.rules !== "string") errors.push("核心字段 rules 必须是字符串。");
  if (Number(data.schemaVersion) >= 2) {
    if (!Object.prototype.hasOwnProperty.call(data, "assetItems")) errors.push("缺少核心字段 assetItems。");
    else if (!Array.isArray(data.assetItems)) errors.push("核心字段 assetItems 必须是数组。");
  }
  if (Number(data.schemaVersion) >= 3) {
    ["transfers", "liabilities"].forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) errors.push("缺少核心字段 " + key + "。");
      else if (!Array.isArray(data[key])) errors.push("核心字段 " + key + " 必须是数组。");
    });
  }
  if (Number(data.schemaVersion) >= 4) {
    ["moneyAccounts", "allocations"].forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) errors.push("缺少核心字段 " + key + "。");
      else if (!Array.isArray(data[key])) errors.push("核心字段 " + key + " 必须是数组。");
    });
  }
  if (Number(data.schemaVersion) >= 5) {
    if (!Object.prototype.hasOwnProperty.call(data, "reconciliations")) errors.push("缺少核心字段 reconciliations。");
    else if (!Array.isArray(data.reconciliations)) errors.push("核心字段 reconciliations 必须是数组。");
  }
  return errors;
}
function validateImportData(data) { return validateStateShape(data); }
function stateValidationErrors(data) { return validateStateShape(data); }
function importedStateSummary(rawState) {
  var targets = Array.isArray(rawState.accounts) ? rawState.accounts.filter(function (account) { return numberValue(account && account.target) > 0; }).length : 0;
  return [
    "备份版本：v" + rawState.schemaVersion,
    "账户数量：" + (Array.isArray(rawState.accounts) ? rawState.accounts.length : 0),
    "收入记录：" + (Array.isArray(rawState.incomes) ? rawState.incomes.length : 0),
    "支出记录：" + (Array.isArray(rawState.expenses) ? rawState.expenses.length : 0),
    "投资数量：" + (Array.isArray(rawState.investments) ? rawState.investments.length : 0),
    "转账数量：" + (Array.isArray(rawState.transfers) ? rawState.transfers.length : 0),
    "真实账户：" + (Array.isArray(rawState.moneyAccounts) ? rawState.moneyAccounts.length : 0),
    "资金分配：" + (Array.isArray(rawState.allocations) ? rawState.allocations.length : 0),
    "余额核对：" + (Array.isArray(rawState.reconciliations) ? rawState.reconciliations.length : 0),
    "负债数量：" + (Array.isArray(rawState.liabilities) ? rawState.liabilities.length : 0),
    "目标数量：" + targets,
    "快照数量：" + (Array.isArray(rawState.snapshots) ? rawState.snapshots.length : 0)
  ].join("\n");
}
function prepareImportedState(rawState) {
  try {
    var migrated = migrateState(rawState);
    return { ok: true, state: normalizeState(migrated), summary: importedStateSummary(migrated), errors: [] };
  } catch (err) {
    return { ok: false, state: null, summary: "", errors: String(err && err.message ? err.message : err).split("\n") };
  }
}
