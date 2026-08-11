"use strict";

// Run with:
// node scripts/app-data-safety.test.js

var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function createContext(seedStorage, options) {
  var store = Object.assign({}, seedStorage || {});
  var alerts = [];
  var context = {
    console: console,
    alert: function (message) { alerts.push(String(message)); },
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem: function (key, value) { store[key] = String(value); },
      removeItem: function (key) { delete store[key]; }
    }
  };
  vm.createContext(context);
  ["app-state.js", "app-validators.js", "app-migrations.js", "app-storage.js"].forEach(function (fileName) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, fileName), "utf8"), context);
  });
  if (options && options.calculations) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "app-calculations.js"), "utf8"), context);
  }
  context.__store = store;
  context.__alerts = alerts;
  return context;
}

function validV2Backup(overrides) {
  return Object.assign({
    schemaVersion: 2,
    accounts: [
      { id: "living", name: "生活账户", type: "生活消费", budgetPercent: 50, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, note: "" },
      { id: "asset", name: "资产账户", type: "长期投资", budgetPercent: 50, fixedBudget: true, includeExpense: false, includeAsset: true, target: 2000, note: "" }
    ],
    incomes: [],
    expenses: [],
    investments: [],
    snapshots: [],
    assetItems: [],
    monthlyPlans: {},
    rules: "rule"
  }, overrides || {});
}

function validV1Backup(overrides) {
  return Object.assign({
    schemaVersion: 1,
    accounts: [],
    incomes: [],
    expenses: [],
    investments: [],
    snapshots: [],
    monthlyPlans: {},
    rules: "rule"
  }, overrides || {});
}

function calculationState() {
  return validV2Backup({
    accounts: [
      { id: "living", name: "生活账户", type: "生活消费", budgetPercent: 60, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, note: "" },
      { id: "invest", name: "投资账户", type: "长期投资", budgetPercent: 40, fixedBudget: true, includeExpense: false, includeAsset: true, target: 1500, note: "" }
    ],
    monthlyPlans: {
      "2026-05": { plannedIncome: 1000, payday: 15 }
    },
    incomes: [
      { id: "inc1", date: "2026-05-01", month: "2026-05", source: "工资", amount: 1000, note: "" }
    ],
    expenses: [
      { id: "exp1", date: "2026-05-02", month: "2026-05", accountId: "living", category: "餐饮", amount: 100, note: "" },
      { id: "exp2", date: "2026-05-03", month: "2026-05", accountId: "invest", category: "不计支出", amount: 30, note: "" }
    ],
    investments: [
      { id: "inv1", date: "2026-05-04", month: "2026-05", accountId: "invest", type: "投资", amount: 500, product: "基金", note: "" },
      { id: "inv2", date: "2026-05-05", month: "2026-05", accountId: "invest", type: "转出", amount: 80, product: "", note: "" },
      { id: "inv3", date: "2026-04-28", month: "2026-04", accountId: "invest", type: "投资", amount: 200, product: "基金", note: "" }
    ],
    snapshots: [
      { id: "snap1", date: "2026-05-10", month: "2026-05", accountId: "invest", marketValue: 700, principal: 620, note: "" },
      { id: "snap2", date: "2026-05-20", month: "2026-05", accountId: "invest", marketValue: 760, principal: 620, note: "" }
    ]
  });
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
  } catch (err) {
    console.error("FAIL " + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

test("ordinary JSON object import is rejected", function () {
  var context = createContext();
  var result = context.prepareImportedState({ hello: "world" });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /schemaVersion/);
});

test("missing schemaVersion is rejected", function () {
  var context = createContext();
  var backup = validV2Backup();
  delete backup.schemaVersion;
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /schemaVersion/);
});

test("future schemaVersion is rejected", function () {
  var context = createContext();
  var result = context.prepareImportedState(validV2Backup({ schemaVersion: context.CURRENT_SCHEMA_VERSION + 1 }));
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /未来|不支持/);
});

test("missing core field is rejected", function () {
  var context = createContext();
  var backup = validV2Backup();
  delete backup.expenses;
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /expenses/);
});

test("wrong core field type is rejected", function () {
  var context = createContext();
  var result = context.prepareImportedState(validV2Backup({ investments: {} }));
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /investments/);
});

test("valid v1 backup migrates to v2 and adds assetItems", function () {
  var context = createContext();
  var result = context.prepareImportedState(validV1Backup());
  assert.strictEqual(result.ok, true, (result.errors || []).join(", "));
  assert.strictEqual(result.state.schemaVersion, context.CURRENT_SCHEMA_VERSION);
  assert.ok(Array.isArray(result.state.assetItems));
  assert.strictEqual(result.state.assetItems.length, 0);
});

test("valid v2 backup passes validation", function () {
  var context = createContext();
  var result = context.prepareImportedState(validV2Backup());
  assert.strictEqual(result.ok, true, (result.errors || []).join(", "));
  assert.strictEqual(result.state.schemaVersion, context.CURRENT_SCHEMA_VERSION);
});

test("migrateState does not silently accept unknown future versions", function () {
  var context = createContext();
  assert.throws(function () {
    context.migrateState(validV2Backup({ schemaVersion: context.CURRENT_SCHEMA_VERSION + 10 }));
  }, /未来|不支持/);
});

test("normalizeState always returns core array fields", function () {
  var context = createContext();
  var normalized = context.normalizeState({});
  ["accounts", "incomes", "expenses", "investments", "snapshots", "assetItems"].forEach(function (key) {
    assert.ok(Array.isArray(normalized[key]), key + " should be an array");
  });
});

test("legacy personalized account names migrate to simple names without changing IDs", function () {
  var context = createContext();
  var backup = validV2Backup({
    accounts: [
      { id: "daily", name: "生存专项拨款", type: "生活消费", budgetPercent: 25.8, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, note: "" },
      { id: "emergency", name: "保命钱", type: "应急金", budgetPercent: 30.6, fixedBudget: true, includeExpense: false, includeAsset: true, target: 25000, note: "" }
    ],
    expenses: [{ id: "exp", date: "2026-08-12", month: "2026-08", accountId: "daily", category: "餐饮", amount: 32, note: "" }]
  });
  var normalized = context.normalizeState(backup);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.accounts.map(function (account) { return [account.id, account.name]; }))), [
    ["daily", "日常开支"], ["emergency", "应急金"]
  ]);
  assert.strictEqual(normalized.expenses[0].accountId, "daily");
});

test("corrupt localStorage string writes recovery key", function () {
  var broken = "{not json";
  var context = createContext({ general_money_manager_v1: broken });
  assert.ok(context.__store.general_money_manager_v1_recovery);
  assert.match(context.__store.general_money_manager_v1_recovery, /\{not json/);
  assert.strictEqual(context.__alerts.length, 1);
});

test("corrupt localStorage string does not immediately overwrite main key", function () {
  var broken = "{not json";
  var context = createContext({ general_money_manager_v1: broken });
  assert.strictEqual(context.__store.general_money_manager_v1, broken);
});

test("corrupt sync metadata falls back to safe defaults", function () {
  var context = createContext({ general_money_manager_v1_sync_meta: "{bad json" });
  var meta = context.loadSyncMeta();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(meta)), { localUpdatedAt: "", lastCloudUpdatedAt: "", lastSyncedAt: "" });
});

test("monthlySummary returns expected totals for fixture state", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationState());
  var summary = context.monthlySummary("2026-05");
  assert.strictEqual(summary.income, 1000);
  assert.strictEqual(summary.plannedIncome, 1000);
  assert.strictEqual(summary.budget, 1000);
  assert.strictEqual(summary.expense, 100);
  assert.strictEqual(summary.investment, 420);
  assert.strictEqual(summary.surplus, 480);
  assert.strictEqual(summary.budgetBalance, 900);
  assert.strictEqual(summary.assetNet, 590);
  assert.strictEqual(summary.assetMarketValue, 760);
  assert.strictEqual(summary.orphanExpenseCount, 0);
  assert.strictEqual(summary.orphanExpenseTotal, 0);
  assert.strictEqual(summary.overBudget, false);
});

test("monthlySummary ignores orphan expenses and reports them", function () {
  var context = createContext(null, { calculations: true });
  var fixture = calculationState();
  fixture.expenses.push({ id: "orphan-exp", date: "2026-05-06", month: "2026-05", accountId: "missing-account", category: "异常", amount: 88, note: "" });
  context.state = context.normalizeState(fixture);
  var summary = context.monthlySummary("2026-05");
  assert.strictEqual(summary.expense, 100);
  assert.strictEqual(summary.orphanExpenseCount, 1);
  assert.strictEqual(summary.orphanExpenseTotal, 88);
});

test("assetSnapshotSummary returns expected asset values for fixture state", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationState());
  var summary = context.assetSnapshotSummary("2026-05");
  assert.strictEqual(summary.totalAsset, 760);
  assert.strictEqual(summary.totalPrincipal, 620);
  assert.strictEqual(summary.pnl, 140);
  assert.strictEqual(summary.roi.toFixed(2), "22.58");
  assert.strictEqual(summary.monthChange, 60);
  assert.ok(Array.isArray(summary.fallbackAccounts));
  assert.strictEqual(summary.fallbackAccounts.length, 0);
});

test("accountBalance returns expected cumulative net balance", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationState());
  var account = context.state.accounts.find(function (item) { return item.id === "invest"; });
  assert.strictEqual(context.accountBalance(account, "2026-05"), 590);
});
