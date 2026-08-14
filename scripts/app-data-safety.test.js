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

function validV5Backup(overrides) {
  return Object.assign(validV2Backup(), {
    schemaVersion: 5,
    transfers: [],
    liabilities: [],
    moneyAccounts: [],
    allocations: [],
    reconciliations: []
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

test("non-object entities and invalid IDs are rejected", function () {
  var context = createContext();
  var backup = validV5Backup({ incomes: ["not-an-object"], expenses: [{ id: "bad id", date: "2026-08-01", amount: 10 }] });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /incomes\[0\].*对象/);
  assert.match(result.errors.join("\n"), /expenses\[0\]\.id/);
});

test("duplicate entity IDs are rejected within a collection", function () {
  var context = createContext();
  var backup = validV5Backup({
    incomes: [
      { id: "same", date: "2026-08-01", amount: 10 },
      { id: "same", date: "2026-08-02", amount: 20 }
    ]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /重复 ID.*same/);
});

test("invalid dates, amounts and derived months are rejected", function () {
  var context = createContext();
  var backup = validV5Backup({
    incomes: [{ id: "income", date: "2026-02-30", month: "2026-03", amount: -1 }]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /date.*YYYY-MM-DD/);
  assert.match(result.errors.join("\n"), /month.*date/);
  assert.match(result.errors.join("\n"), /amount.*有效数字/);
});

test("missing transaction amounts and out-of-range percentages are rejected", function () {
  var context = createContext();
  var backup = validV5Backup({
    accounts: [{ id: "daily", name: "日常开支", type: "生活消费", budgetPercent: 120 }],
    expenses: [{ id: "expense", date: "2026-08-01", accountId: "daily" }]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /budgetPercent.*0-100/);
  assert.match(result.errors.join("\n"), /expenses\[0\]\.amount.*不能为空/);
});

test("orphan account and money-account references are rejected", function () {
  var context = createContext();
  var backup = validV5Backup({
    incomes: [{ id: "income", date: "2026-08-01", accountId: "missing-pool", moneyAccountId: "missing-bank", amount: 10 }]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /accountId.*不存在/);
  assert.match(result.errors.join("\n"), /moneyAccountId.*不存在/);
});

test("partial or same-endpoint transfers are rejected", function () {
  var context = createContext();
  var backup = validV5Backup({
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 0 }],
    transfers: [
      { id: "partial", date: "2026-08-01", fromMoneyAccountId: "bank", toMoneyAccountId: "", amount: 10 },
      { id: "same", date: "2026-08-02", fromMoneyAccountId: "bank", toMoneyAccountId: "bank", amount: 10 }
    ]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /同时填写或同时留空/);
  assert.match(result.errors.join("\n"), /实际转账两端必须不同/);
});

test("reconciliation differences must match their balances", function () {
  var context = createContext();
  var backup = validV5Backup({
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 100 }],
    reconciliations: [{ id: "check", date: "2026-08-01", moneyAccountId: "bank", bookBalance: 100, actualBalance: 90, adjustment: 5 }]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /adjustment.*actualBalance - bookBalance/);
});

test("a relationally complete v5 backup is accepted", function () {
  var context = createContext();
  var backup = validV5Backup({
    accounts: [{ id: "daily", name: "日常开支", type: "生活消费", budgetPercent: 100, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0 }],
    moneyAccounts: [
      { id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-08-01" },
      { id: "wallet", name: "钱包", type: "支付账户", openingBalance: 0, openingBalanceDate: "2026-08-01" }
    ],
    incomes: [{ id: "income", date: "2026-08-01", month: "2026-08", accountId: "daily", moneyAccountId: "bank", amount: 100 }],
    expenses: [{ id: "expense", date: "2026-08-02", month: "2026-08", accountId: "daily", moneyAccountId: "wallet", amount: 10 }],
    transfers: [{ id: "transfer", date: "2026-08-02", fromMoneyAccountId: "bank", toMoneyAccountId: "wallet", amount: 50 }],
    allocations: [{ id: "allocation", date: "2026-08-01", fromAccountId: "", toAccountId: "daily", amount: 100 }],
    snapshots: [{ id: "snapshot", date: "2026-08-03", accountId: "daily", marketValue: 100, principal: 100 }],
    reconciliations: [{ id: "check", date: "2026-08-04", moneyAccountId: "bank", bookBalance: 1050, actualBalance: 1048, adjustment: -2 }]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, true, (result.errors || []).join("\n"));
  assert.strictEqual(result.state.schemaVersion, 5);
});

test("browser E2E recovery fixture passes the production import pipeline", function () {
  var context = createContext();
  var fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tests", "fixtures", "browser-e2e-backup.json"), "utf8"));
  var result = context.prepareImportedState(fixture);
  assert.strictEqual(result.ok, true, (result.errors || []).join("\n"));
  assert.strictEqual(result.state.moneyAccounts[0].name, "恢复验证账户");
  assert.strictEqual(result.state.incomes[0].amount, 321);
});

test("browser E2E cleanup fixture passes the production import pipeline", function () {
  var context = createContext();
  var fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tests", "fixtures", "browser-empty-backup.json"), "utf8"));
  var result = context.prepareImportedState(fixture);
  assert.strictEqual(result.ok, true, (result.errors || []).join("\n"));
  assert.strictEqual(result.state.moneyAccounts.length, 0);
  assert.strictEqual(result.state.incomes.length, 0);
});

test("valid v1 backup migrates to current schema and adds financial collections", function () {
  var context = createContext();
  var result = context.prepareImportedState(validV1Backup());
  assert.strictEqual(result.ok, true, (result.errors || []).join(", "));
  assert.strictEqual(result.state.schemaVersion, context.CURRENT_SCHEMA_VERSION);
  assert.ok(Array.isArray(result.state.assetItems));
  assert.ok(Array.isArray(result.state.transfers));
  assert.ok(Array.isArray(result.state.liabilities));
  assert.ok(Array.isArray(result.state.moneyAccounts));
  assert.ok(Array.isArray(result.state.allocations));
  assert.ok(Array.isArray(result.state.reconciliations));
  assert.strictEqual(result.state.assetItems.length, 0);
});

test("valid v2 backup migrates to current schema", function () {
  var context = createContext();
  var result = context.prepareImportedState(validV2Backup());
  assert.strictEqual(result.ok, true, (result.errors || []).join(", "));
  assert.strictEqual(result.state.schemaVersion, context.CURRENT_SCHEMA_VERSION);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.state.moneyAccounts)), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.state.allocations)), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.state.reconciliations)), []);
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
  ["accounts", "moneyAccounts", "reconciliations", "allocations", "incomes", "expenses", "investments", "transfers", "snapshots", "assetItems", "liabilities"].forEach(function (key) {
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
  assert.strictEqual(summary.allocationBudget, 1000);
  assert.strictEqual(summary.spendingBudget, 600);
  assert.strictEqual(summary.budget, 600);
  assert.strictEqual(summary.expense, 130);
  assert.strictEqual(summary.investment, 420);
  assert.strictEqual(summary.surplus, 450);
  assert.strictEqual(summary.budgetBalance, 470);
  assert.strictEqual(summary.assetNet, 620);
  assert.strictEqual(summary.assetMarketValue, 760);
  assert.strictEqual(summary.orphanExpenseCount, 0);
  assert.strictEqual(summary.orphanExpenseTotal, 0);
  assert.strictEqual(summary.overBudget, false);
});

test("monthlySummary includes orphan expenses and reports them", function () {
  var context = createContext(null, { calculations: true });
  var fixture = calculationState();
  fixture.expenses.push({ id: "orphan-exp", date: "2026-05-06", month: "2026-05", accountId: "missing-account", category: "异常", amount: 88, note: "" });
  context.state = context.normalizeState(fixture);
  var summary = context.monthlySummary("2026-05");
  assert.strictEqual(summary.expense, 218);
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

test("accountBalance does not subtract classification-only expenses", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationState());
  var account = context.state.accounts.find(function (item) { return item.id === "invest"; });
  assert.strictEqual(context.accountBalance(account, "2026-05"), 620);
});

test("explicit zero snapshot remains zero in unified wealth total", function () {
  var context = createContext(null, { calculations: true });
  var fixture = calculationState();
  fixture.snapshots = [{ id: "zero", date: "2026-05-31", month: "2026-05", accountId: "invest", marketValue: 0, principal: 620, note: "" }];
  context.state = context.normalizeState(fixture);
  var wealth = context.wealthSummary("2026-05");
  assert.strictEqual(wealth.accountAssets, 0);
  assert.strictEqual(wealth.netWorth, 250);
  assert.strictEqual(wealth.unallocatedGap, 0);
});

test("spending budget excludes savings and investment allocations", function () {
  var context = createContext(null, { calculations: true });
  var fixture = calculationState();
  fixture.expenses = [{ id: "exp", date: "2026-05-02", month: "2026-05", accountId: "living", amount: 700, category: "生活", note: "" }];
  context.state = context.normalizeState(fixture);
  var summary = context.monthlySummary("2026-05");
  assert.strictEqual(summary.spendingBudget, 600);
  assert.strictEqual(summary.overBudget, true);
});

test("two-sided transfer conserves total account assets", function () {
  var context = createContext(null, { calculations: true });
  var fixture = validV2Backup({
    accounts: [
      { id: "a", name: "备用现金", type: "短期储蓄", includeAsset: true, includeExpense: false, openingBalance: 1000, openingBalanceDate: "2026-05-01", valuationMethod: "流水余额" },
      { id: "b", name: "应急金", type: "应急金", includeAsset: true, includeExpense: false, openingBalance: 0, openingBalanceDate: "2026-05-01", valuationMethod: "流水余额" }
    ],
    transfers: [{ id: "t", date: "2026-05-10", month: "2026-05", fromAccountId: "a", toAccountId: "b", amount: 300, note: "" }],
    liabilities: []
  });
  fixture.schemaVersion = 3;
  context.state = context.normalizeState(fixture);
  assert.strictEqual(context.accountBalance(context.state.accounts[0], "2026-05"), 700);
  assert.strictEqual(context.accountBalance(context.state.accounts[1], "2026-05"), 300);
  assert.strictEqual(context.wealthSummary("2026-05").accountAssets, 1000);
});

test("liabilities reduce net worth and unresolved cash items do not double count", function () {
  var context = createContext(null, { calculations: true });
  var fixture = validV2Backup({
    assetItems: [{ id: "cash", kind: "现金", name: "银行卡", currentValue: 1000, status: "在用" }],
    liabilities: [{ id: "card", name: "信用卡", type: "信用卡", currentBalance: 300, balanceDate: "2026-05-01", status: "还款中" }],
    transfers: []
  });
  fixture.schemaVersion = 3;
  context.state = context.normalizeState(fixture);
  var wealth = context.wealthSummary("2026-05");
  assert.strictEqual(wealth.independentAssets, 0);
  assert.strictEqual(wealth.liabilities, 300);
  assert.strictEqual(wealth.unresolvedAssets.length, 1);
});

test("default account can retain a zero allocation percentage", function () {
  var context = createContext();
  var fixture = validV2Backup({ accounts: [{ id: "daily", name: "日常开支", type: "生活消费", budgetPercent: 0, includeExpense: true, includeAsset: false }] });
  var account = context.normalizeState(fixture).accounts[0];
  assert.strictEqual(account.budgetPercent, 0);
});

test("dated records always derive month from date", function () {
  var context = createContext();
  var fixture = validV2Backup({
    incomes: [{ id: "inc", date: "2026-08-13", month: "2026-07", accountId: "asset", source: "工资", amount: 100, note: "" }],
    expenses: [{ id: "exp", date: "2026-09-01", month: "2026-08", accountId: "living", category: "餐饮", amount: 20, note: "" }],
    investments: [{ id: "inv", date: "2026-10-02", month: "2026-09", accountId: "asset", type: "投资", amount: 30, product: "基金", note: "" }],
    transfers: [{ id: "transfer", date: "2026-11-03", month: "2026-10", fromAccountId: "living", toAccountId: "asset", amount: 10, note: "" }],
    snapshots: [{ id: "snap", date: "2026-12-04", month: "2026-11", accountId: "asset", marketValue: 50, principal: 40, note: "" }]
  });
  fixture.schemaVersion = 3;
  var normalized = context.normalizeState(fixture);
  assert.strictEqual(normalized.incomes[0].month, "2026-08");
  assert.strictEqual(normalized.expenses[0].month, "2026-09");
  assert.strictEqual(normalized.investments[0].month, "2026-10");
  assert.strictEqual(normalized.transfers[0].month, "2026-11");
  assert.strictEqual(normalized.snapshots[0].month, "2026-12");
});

test("income allocation and funded investment conserve owned cash", function () {
  var context = createContext(null, { calculations: true });
  var fixture = validV2Backup({
    accounts: [
      { id: "cash", name: "备用现金", type: "短期储蓄", includeAsset: true, includeExpense: false, valuationMethod: "流水余额" },
      { id: "fund", name: "长期投资", type: "长期投资", includeAsset: true, includeExpense: false, valuationMethod: "流水余额" }
    ],
    incomes: [{ id: "inc", date: "2026-05-01", month: "2026-05", accountId: "cash", source: "工资", amount: 1000, note: "" }],
    investments: [{ id: "inv", date: "2026-05-02", month: "2026-05", accountId: "fund", sourceAccountId: "cash", type: "投资", amount: 400, product: "基金", note: "" }],
    transfers: [], liabilities: []
  });
  fixture.schemaVersion = 3;
  context.state = context.normalizeState(fixture);
  assert.strictEqual(context.accountBalance(context.state.accounts[0], "2026-05"), 600);
  assert.strictEqual(context.accountBalance(context.state.accounts[1], "2026-05"), 400);
  assert.strictEqual(context.wealthSummary("2026-05").accountAssets, 1000);
});

test("real accounts and fund pools stay as separate balanced dimensions", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState({
    accounts: [
      { id: "daily", name: "日常开支", type: "生活消费", includeExpense: true, includeAsset: false, valuationMethod: "流水余额" },
      { id: "emergency", name: "应急金", type: "应急金", includeExpense: false, includeAsset: true, valuationMethod: "流水余额" },
      { id: "long", name: "长期投资", type: "长期投资", includeExpense: false, includeAsset: true, valuationMethod: "净值快照" }
    ],
    moneyAccounts: [
      { id: "bank", name: "招商工资卡", type: "银行卡", openingBalance: 10000, openingBalanceDate: "2026-08-01" },
      { id: "wallet", name: "支付宝", type: "支付账户", openingBalance: 1000, openingBalanceDate: "2026-08-01" },
      { id: "broker", name: "证券账户", type: "投资账户", openingBalance: 0, openingBalanceDate: "2026-08-01" }
    ],
    incomes: [
      { id: "old-salary", date: "2026-07-31", moneyAccountId: "bank", accountId: "", source: "工资", amount: 9999 },
      { id: "salary", date: "2026-08-02", moneyAccountId: "bank", accountId: "", source: "工资", amount: 10000 }
    ],
    expenses: [{ id: "lunch", date: "2026-08-03", moneyAccountId: "wallet", accountId: "daily", category: "餐饮", amount: 36 }],
    investments: [
      { id: "fund", date: "2026-08-04", sourceMoneyAccountId: "bank", targetMoneyAccountId: "broker", accountId: "long", type: "投资", amount: 2000 },
      { id: "redeem", date: "2026-08-06", sourceMoneyAccountId: "broker", targetMoneyAccountId: "bank", accountId: "long", type: "转出", amount: 500 }
    ],
    transfers: [{ id: "move", date: "2026-08-05", fromMoneyAccountId: "bank", toMoneyAccountId: "wallet", amount: 1000 }],
    allocations: [
      { id: "daily-plan", date: "2026-08-02", fromAccountId: "", toAccountId: "daily", amount: 1000 },
      { id: "safe-plan", date: "2026-08-02", fromAccountId: "", toAccountId: "emergency", amount: 3000 }
    ],
    snapshots: [{ id: "broker-value", date: "2026-08-15", accountId: "long", marketValue: 1700, principal: 1500 }]
  });
  assert.strictEqual(context.moneyAccountBalance(context.state.moneyAccounts[0], "2026-08"), 17500);
  assert.strictEqual(context.moneyAccountBalance(context.state.moneyAccounts[0], "2026-07"), 0);
  assert.strictEqual(context.moneyAccountBalance(context.state.moneyAccounts[1], "2026-08"), 1964);
  assert.strictEqual(context.moneyAccountBalance(context.state.moneyAccounts[2], "2026-08"), 1500);
  assert.strictEqual(context.moneyAccountsTotal("2026-08"), 20964);
  assert.strictEqual(context.accountBalance(context.state.accounts[0], "2026-08"), 964);
  assert.strictEqual(context.accountBalance(context.state.accounts[1], "2026-08"), 3000);
  assert.strictEqual(context.accountBalance(context.state.accounts[2], "2026-08"), 1500);
  assert.strictEqual(context.unallocatedCashSummary("2026-08").value, 15500);
  assert.strictEqual(context.wealthSummary("2026-08").financialAssets, 21164);
});

test("expense category does not reduce an asset account without a payment account", function () {
  var context = createContext(null, { calculations: true });
  var fixture = validV2Backup({
    accounts: [{ id: "cash", name: "备用现金", type: "短期储蓄", includeAsset: true, includeExpense: false, openingBalance: 500, openingBalanceDate: "2026-05-01", valuationMethod: "流水余额" }],
    expenses: [{ id: "exp", date: "2026-05-02", month: "2026-05", accountId: "cash", sourceAccountId: "", category: "测试", amount: 100, note: "" }],
    transfers: [], liabilities: []
  });
  fixture.schemaVersion = 3;
  context.state = context.normalizeState(fixture);
  assert.strictEqual(context.accountBalance(context.state.accounts[0], "2026-05"), 500);
  assert.strictEqual(context.monthlySummary("2026-05").expense, 100);
});

test("balance reconciliation adjusts the ledger without changing opening balance", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState({
    moneyAccounts: [{ id: "bank", name: "工资卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-08-01" }],
    expenses: [{ id: "fee", date: "2026-08-05", moneyAccountId: "bank", accountId: "", category: "手续费", amount: 100 }],
    reconciliations: [{ id: "check", date: "2026-08-10", moneyAccountId: "bank", bookBalance: 900, actualBalance: 850, adjustment: -50 }],
    incomes: [{ id: "refund", date: "2026-08-12", moneyAccountId: "bank", accountId: "", source: "其他", amount: 200 }]
  });
  var account = context.state.moneyAccounts[0];
  assert.strictEqual(account.openingBalance, 1000);
  assert.strictEqual(context.moneyAccountBalanceUntil(account, "2026-08-10", "check"), 900);
  assert.strictEqual(context.moneyAccountBalanceUntil(account, "2026-08-10"), 850);
  assert.strictEqual(context.moneyAccountBalance(account, "2026-08"), 1050);
});
