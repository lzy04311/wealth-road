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

var importEntityCollections = ["accounts", "moneyAccounts", "reconciliations", "allocations", "incomes", "expenses", "investments", "transfers", "snapshots", "assetItems", "liabilities"];
var importDatedCollections = ["reconciliations", "allocations", "incomes", "expenses", "investments", "transfers", "snapshots"];
var importAmountFields = {
  accounts: ["budgetPercent", "target", "openingBalance"],
  moneyAccounts: ["openingBalance"],
  reconciliations: ["bookBalance", "actualBalance", "adjustment"],
  allocations: ["amount"],
  incomes: ["amount"],
  expenses: ["amount"],
  investments: ["amount"],
  transfers: ["amount"],
  snapshots: ["marketValue", "principal"],
  assetItems: ["purchasePrice", "currentValue", "monthlyCost"],
  liabilities: ["currentBalance", "interestRate", "minimumPayment"]
};
var importSignedAmountFields = { reconciliations: { bookBalance: true, actualBalance: true, adjustment: true } };
var importRequiredAmountFields = {
  moneyAccounts: { openingBalance: true },
  reconciliations: { bookBalance: true, actualBalance: true, adjustment: true },
  allocations: { amount: true },
  incomes: { amount: true },
  expenses: { amount: true },
  investments: { amount: true },
  transfers: { amount: true },
  snapshots: { marketValue: true, principal: true },
  liabilities: { currentBalance: true }
};
var importPercentFields = { accounts: { budgetPercent: true }, liabilities: { interestRate: true } };

function validImportId(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value); }
function validImportDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var parts = value.split("-"), date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.getFullYear() === Number(parts[0]) && date.getMonth() === Number(parts[1]) - 1 && date.getDate() === Number(parts[2]);
}
function validImportAmount(value, signed) {
  if (value === "" || value == null || typeof value === "boolean") return false;
  var number = Number(value);
  return Number.isFinite(number) && number <= 999999999 && number >= (signed ? -999999999 : 0);
}
function importItemLabel(collection, index) { return collection + "[" + index + "]"; }
function importIdSet(items) {
  var ids = {};
  (items || []).forEach(function (item) { if (isPlainObject(item) && validImportId(item.id)) ids[item.id] = true; });
  return ids;
}
function validateImportReference(errors, item, label, field, targets, required) {
  var value = item[field];
  if (value == null || value === "") {
    if (required) errors.push(label + "." + field + " 不能为空。");
    return;
  }
  if (!validImportId(value)) errors.push(label + "." + field + " 不是有效 ID。");
  else if (!targets[value]) errors.push(label + "." + field + " 引用了不存在的记录 " + value + "。");
}
function validateImportEntities(data) {
  var errors = [];
  importEntityCollections.forEach(function (collection) {
    if (!Array.isArray(data[collection])) return;
    var seen = {};
    data[collection].forEach(function (item, index) {
      var label = importItemLabel(collection, index);
      if (!isPlainObject(item)) { errors.push(label + " 必须是对象。"); return; }
      if (!validImportId(item.id)) errors.push(label + ".id 必须是 1-80 位字母、数字、下划线或连字符。");
      else if (seen[item.id]) errors.push(collection + " 中存在重复 ID：" + item.id + "。");
      else seen[item.id] = true;

      (importAmountFields[collection] || []).forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(item, field)) {
          if (importRequiredAmountFields[collection] && importRequiredAmountFields[collection][field]) errors.push(label + "." + field + " 不能为空。");
          return;
        }
        var signed = !!(importSignedAmountFields[collection] && importSignedAmountFields[collection][field]);
        if (!validImportAmount(item[field], signed)) errors.push(label + "." + field + " 金额超出范围或不是有效数字。");
        else if (importPercentFields[collection] && importPercentFields[collection][field] && Number(item[field]) > 100) errors.push(label + "." + field + " 必须在 0-100 之间。");
      });
    });
  });

  importDatedCollections.forEach(function (collection) {
    if (!Array.isArray(data[collection])) return;
    data[collection].forEach(function (item, index) {
      if (!isPlainObject(item)) return;
      var label = importItemLabel(collection, index);
      if (!validImportDate(item.date)) errors.push(label + ".date 必须是有效的 YYYY-MM-DD 日期。");
      if (item.month != null && item.month !== "" && item.month !== String(item.date || "").slice(0, 7)) errors.push(label + ".month 必须与 date 一致。");
    });
  });

  [
    ["accounts", "openingBalanceDate"], ["moneyAccounts", "openingBalanceDate"],
    ["assetItems", "valuationDate"], ["assetItems", "renewalDate"],
    ["liabilities", "balanceDate"], ["liabilities", "dueDate"]
  ].forEach(function (entry) {
    var collection = entry[0], field = entry[1];
    if (!Array.isArray(data[collection])) return;
    data[collection].forEach(function (item, index) {
      if (!isPlainObject(item) || item[field] == null || item[field] === "") return;
      if (!validImportDate(item[field])) errors.push(importItemLabel(collection, index) + "." + field + " 必须是有效的 YYYY-MM-DD 日期。");
    });
  });

  if (isPlainObject(data.monthlyPlans)) {
    Object.keys(data.monthlyPlans).forEach(function (month) {
      var plan = data.monthlyPlans[month];
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { errors.push("monthlyPlans 包含无效月份：" + month + "。"); return; }
      if (!isPlainObject(plan)) { errors.push("monthlyPlans[" + month + "] 必须是对象。"); return; }
      if (plan.plannedIncome !== "" && plan.plannedIncome != null && !validImportAmount(plan.plannedIncome, false)) errors.push("monthlyPlans[" + month + "].plannedIncome 不是有效金额。");
      if (plan.payday != null && (!Number.isInteger(Number(plan.payday)) || Number(plan.payday) < 1 || Number(plan.payday) > 31)) errors.push("monthlyPlans[" + month + "].payday 必须在 1-31 之间。");
    });
  }

  var accountIds = importIdSet(data.accounts);
  var moneyAccountIds = importIdSet(data.moneyAccounts);
  function each(collection, callback) {
    if (!Array.isArray(data[collection])) return;
    data[collection].forEach(function (item, index) { if (isPlainObject(item)) callback(item, importItemLabel(collection, index)); });
  }
  each("incomes", function (item, label) {
    validateImportReference(errors, item, label, "accountId", accountIds, false);
    validateImportReference(errors, item, label, "moneyAccountId", moneyAccountIds, false);
  });
  each("expenses", function (item, label) {
    validateImportReference(errors, item, label, "accountId", accountIds, false);
    validateImportReference(errors, item, label, "sourceAccountId", accountIds, false);
    validateImportReference(errors, item, label, "moneyAccountId", moneyAccountIds, false);
  });
  each("investments", function (item, label) {
    validateImportReference(errors, item, label, "accountId", accountIds, false);
    validateImportReference(errors, item, label, "sourceAccountId", accountIds, false);
    validateImportReference(errors, item, label, "sourceMoneyAccountId", moneyAccountIds, false);
    validateImportReference(errors, item, label, "targetMoneyAccountId", moneyAccountIds, false);
    if (!!item.sourceMoneyAccountId !== !!item.targetMoneyAccountId) errors.push(label + " 的实际转出和转入账户必须同时填写或同时留空。");
  });
  each("snapshots", function (item, label) { validateImportReference(errors, item, label, "accountId", accountIds, true); });
  each("assetItems", function (item, label) { validateImportReference(errors, item, label, "linkedAccountId", accountIds, item.valuationMode === "关联账户"); });
  each("allocations", function (item, label) {
    validateImportReference(errors, item, label, "fromAccountId", accountIds, false);
    validateImportReference(errors, item, label, "toAccountId", accountIds, true);
    if (item.fromAccountId && item.fromAccountId === item.toAccountId) errors.push(label + " 的转出和转入资金池必须不同。");
  });
  each("transfers", function (item, label) {
    validateImportReference(errors, item, label, "fromAccountId", accountIds, false);
    validateImportReference(errors, item, label, "toAccountId", accountIds, false);
    validateImportReference(errors, item, label, "fromMoneyAccountId", moneyAccountIds, false);
    validateImportReference(errors, item, label, "toMoneyAccountId", moneyAccountIds, false);
    if (!!item.fromAccountId !== !!item.toAccountId) errors.push(label + " 的旧资金池转账两端必须同时填写或同时留空。");
    if (item.fromAccountId && item.fromAccountId === item.toAccountId) errors.push(label + " 的旧资金池转账两端必须不同。");
    if (!!item.fromMoneyAccountId !== !!item.toMoneyAccountId) errors.push(label + " 的实际转账两端必须同时填写或同时留空。");
    if (item.fromMoneyAccountId && item.fromMoneyAccountId === item.toMoneyAccountId) errors.push(label + " 的实际转账两端必须不同。");
  });
  each("reconciliations", function (item, label) {
    validateImportReference(errors, item, label, "moneyAccountId", moneyAccountIds, true);
    if (validImportAmount(item.bookBalance, true) && validImportAmount(item.actualBalance, true) && validImportAmount(item.adjustment, true)) {
      var expected = Math.round((Number(item.actualBalance) - Number(item.bookBalance)) * 100) / 100;
      if (Math.abs(expected - Number(item.adjustment)) > 0.009) errors.push(label + ".adjustment 必须等于 actualBalance - bookBalance。");
    }
  });

  return errors;
}
function validateImportData(data) {
  var errors = validateStateShape(data);
  if (errors.length) return errors;
  return errors.concat(validateImportEntities(data));
}
function stateValidationErrors(data) { return validateImportData(data); }
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
