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
    document: { getElementById: function () { return null; } },
    TextEncoder: TextEncoder,
    Blob: Blob,
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
  if (options && options.actionsData) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "app-actions-data.js"), "utf8"), context);
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

function validV6Backup(overrides) {
  return Object.assign(validV5Backup(), {
    schemaVersion: 6
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

function dashboardSampleFixture() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tests", "fixtures", "dashboard-sample.json"), "utf8"));
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

test("large production backups round-trip above the retired 1MB ceiling", function () {
  var context = createContext(null, { actionsData: true });
  var expenses = [];
  for (var i = 0; i < 6000; i += 1) {
    expenses.push({ id: "expense-" + i, date: "2026-08-01", month: "2026-08", accountId: "living", category: "日常", amount: i % 500 + 1, note: "大数据往返校验记录-" + i + "-" + "x".repeat(160) });
  }
  var backup = validV5Backup({ expenses: expenses });
  var text = context.serializeStateBackup(backup);
  var bytes = context.backupTextBytes(text);
  assert.ok(bytes > 1024 * 1024, "fixture must exceed the retired 1MB limit");
  assert.ok(bytes < context.MAX_IMPORT_BYTES, "fixture must remain inside the production import limit");
  var result = context.prepareImportedState(JSON.parse(text));
  assert.strictEqual(result.ok, true, (result.errors || []).join("\n"));
  assert.strictEqual(result.state.expenses.length, expenses.length);
  assert.strictEqual(result.state.expenses[5999].id, "expense-5999");
});

test("storage health distinguishes untested, writable and unverified backup states", function () {
  var context = createContext();
  assert.strictEqual(context.storageHealthPresentation().shortLabel, "待检测");
  assert.strictEqual(context.probeLocalStorageWrite(), true);
  context.storageHealth.checked = true;
  context.storageHealth.localWritable = true;
  context.storageHealth.idbAvailable = false;
  assert.match(context.storageHealthPresentation().label, /本地可写/);
  assert.doesNotMatch(context.storageHealthPresentation().label, /正常|健康/);
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

test("a relationally complete v5 backup migrates to the current schema", function () {
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
  assert.strictEqual(result.state.schemaVersion, context.CURRENT_SCHEMA_VERSION);
  assert.strictEqual(result.state.expenses[0].paymentMode, "money_account");
});

test("schema v6 rejects payroll withholding linked to a cash account", function () {
  var context = createContext();
  var backup = validV6Backup({
    accounts: [{ id: "daily", name: "日常开支", type: "生活消费", budgetPercent: 100, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0 }],
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 0, openingBalanceDate: "2026-07-31" }],
    expenses: [{ id: "meal", date: "2026-08-15", month: "2026-08", accountId: "daily", sourceAccountId: "", moneyAccountId: "bank", paymentMode: "payroll_withholding", category: "餐饮", amount: 70, note: "" }]
  });
  var result = context.prepareImportedState(backup);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), /工资代扣不能关联/);
});

test("payroll withholding counts as consumption without double-reducing cash or wealth", function () {
  var context = createContext(null, { calculations: true });
  var backup = validV6Backup({
    accounts: [{ id: "daily", name: "日常开支", type: "生活消费", budgetPercent: 100, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, openingBalance: 0, openingBalanceDate: "" }],
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 0, openingBalanceDate: "2026-07-31" }],
    monthlyPlans: { "2026-08": { plannedIncome: 5430, payday: 15 } },
    incomes: [{ id: "salary", date: "2026-08-15", month: "2026-08", accountId: "", moneyAccountId: "bank", source: "工资", amount: 5430, note: "实际到账" }],
    expenses: [{ id: "meal", date: "2026-08-15", month: "2026-08", accountId: "daily", sourceAccountId: "", moneyAccountId: "", paymentMode: "payroll_withholding", category: "餐饮", amount: 70, note: "工资到账前代扣" }]
  });
  var prepared = context.prepareImportedState(backup);
  assert.strictEqual(prepared.ok, true, (prepared.errors || []).join("\n"));
  context.state = prepared.state;
  var summary = context.monthlySummary("2026-08");
  assert.strictEqual(summary.income, 5430);
  assert.strictEqual(summary.expense, 70);
  assert.strictEqual(summary.cashExpense, 0);
  assert.strictEqual(summary.payrollWithholdingExpense, 70);
  assert.strictEqual(summary.netCashFlow, 5430);
  assert.strictEqual(summary.freeCash, 5430);
  assert.strictEqual(summary.budgetBalance, 5360);
  assert.strictEqual(context.monthlyExpense("daily", "2026-08"), 70);
  assert.strictEqual(context.moneyAccountBalance(context.state.moneyAccounts[0], "2026-08"), 5430);
  assert.strictEqual(context.accountBalance(context.state.accounts[0], "2026-08"), 0);
  assert.strictEqual(context.unallocatedCashSummary("2026-08").value, 5430);
  assert.strictEqual(context.wealthChange("2026-08").change, 5430);
  var attribution = context.wealthAttribution("2026-08");
  assert.strictEqual(attribution.cashflowContribution, 5430);
  assert.strictEqual(attribution.unexplained, 0);

  context.state.moneyAccounts = [];
  assert.strictEqual(context.unallocatedCashSummary("2026-08").value, 5430);
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

test("financial health model exposes stable versioned rules", function () {
  var context = createContext(null, { calculations: true });
  assert.strictEqual(context.FINANCIAL_HEALTH_MODEL.version, 1);
  assert.strictEqual(context.FINANCIAL_HEALTH_MODEL.label, "月度执行健康度");
  assert.strictEqual(context.FINANCIAL_HEALTH_MODEL.adjustments.incompleteAssetBaseline, -8);
  assert.strictEqual(context.FINANCIAL_HEALTH_MODEL.thresholds.stable, 82);
});

test("financial health level boundaries are explicit", function () {
  var context = createContext(null, { calculations: true });
  assert.strictEqual(context.financialHealthLevel(82).label, "稳定");
  assert.strictEqual(context.financialHealthLevel(64).label, "可控");
  assert.strictEqual(context.financialHealthLevel(45).label, "需关注");
  assert.strictEqual(context.financialHealthLevel(44).label, "高压力");
});

test("financial health rewards a complete on-plan month", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationState());
  var health = context.financialHealth("2026-05");
  assert.strictEqual(health.score, 94);
  assert.strictEqual(health.level, "稳定");
  assert.strictEqual(health.label, "月度执行健康度");
  assert.strictEqual(health.modelVersion, 1);
});

test("financial health remains unknown without a plan or current-month evidence", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(null);
  var health = context.financialHealth("2026-08");
  assert.strictEqual(health.score, null);
  assert.strictEqual(health.level, "待评估");
  assert.strictEqual(health.status, "insufficient");
  assert.strictEqual(context.dashboardReadiness("2026-08").onboardingNeeded, true);
});

test("financial health applies budget, cash and snapshot adjustments", function () {
  var context = createContext(null, { calculations: true });
  var overBudget = calculationState();
  overBudget.expenses = [{ id: "over", date: "2026-05-02", month: "2026-05", accountId: "living", category: "生活", amount: 700, note: "" }];
  context.state = context.normalizeState(overBudget);
  var stressed = context.financialHealth("2026-05");
  assert.strictEqual(stressed.score, 46);
  assert.strictEqual(stressed.level, "需关注");
  assert.match(stressed.advice, /超支/);

  var noSnapshot = calculationState();
  noSnapshot.snapshots = [];
  context.state = context.normalizeState(noSnapshot);
  var missingBaseline = context.financialHealth("2026-05");
  assert.strictEqual(missingBaseline.score, 86);
  assert.strictEqual(missingBaseline.level, "稳定");

  var estimatedBaseline = calculationState();
  estimatedBaseline.accounts.push({
    id: "estimated-asset", name: "待补净值账户", type: "长期投资", budgetPercent: 0,
    fixedBudget: false, includeExpense: false, includeAsset: true, target: 0,
    openingBalance: 100, openingBalanceDate: "2026-05-01", valuationMethod: "净值快照",
    archived: false, note: ""
  });
  context.state = context.normalizeState(estimatedBaseline);
  assert.strictEqual(context.assetSnapshotSummary("2026-05").completeness, "estimated");
  var estimatedHealth = context.financialHealth("2026-05");
  assert.strictEqual(estimatedHealth.score, 86);
  assert.match(estimatedHealth.advice, /补齐净值更新/);
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

test("daysUntilDate signs past and future dates relative to today", function () {
  var context = createContext(null, { calculations: true });
  assert.ok(context.daysUntilDate("2000-01-01") < 0, "past date should be negative");
  assert.ok(context.daysUntilDate("2099-12-31") > 0, "future date should be positive");
  assert.strictEqual(context.daysUntilDate("not-a-date"), null);
  assert.strictEqual(context.daysUntilDate(""), null);
});

test("archived money accounts remain in financial assets", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(validV5Backup({
    accounts: [],
    moneyAccounts: [{ id: "closed-bank", name: "旧工资卡", type: "银行卡", openingBalance: 880, openingBalanceDate: "2026-01-01", archived: true, note: "" }]
  }));
  assert.strictEqual(context.hasMoneyAccounts(), true);
  assert.strictEqual(context.moneyAccountsTotal("2026-08"), 880);
  assert.strictEqual(context.wealthSummary("2026-08").financialAssets, 880);
});

test("fund-pool opening balance excludes earlier linked transactions", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(validV5Backup({
    accounts: [{ id: "pool", name: "备用现金", type: "短期储蓄", budgetPercent: 0, fixedBudget: false, includeExpense: false, includeAsset: true, target: 0, openingBalance: 100, openingBalanceDate: "2026-08-01", valuationMethod: "流水余额", archived: false, note: "" }],
    incomes: [{ id: "old-income", date: "2026-07-20", month: "2026-07", accountId: "pool", moneyAccountId: "", source: "其他", amount: 50, note: "" }],
    expenses: [{ id: "new-expense", date: "2026-08-05", month: "2026-08", accountId: "pool", sourceAccountId: "pool", moneyAccountId: "", category: "其他", amount: 20, note: "" }]
  }));
  assert.strictEqual(context.accountBalance(context.state.accounts[0], "2026-08"), 80);
});

function testDateOffset(dateText, days) {
  var parts = String(dateText).split("-").map(Number);
  var date = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function calculationAccountFixture(overrides) {
  return Object.assign({
    accounts: [{ id: "living", name: "日常开支", type: "生活消费", includeExpense: true, includeAsset: false, valuationMethod: "流水余额" }],
    moneyAccounts: [], reconciliations: [], allocations: [], incomes: [], expenses: [], investments: [], transfers: [], snapshots: [], assetItems: [], liabilities: [], monthlyPlans: {}
  }, overrides || {});
}

test("wealthChange does not invent a zero opening baseline", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({ incomes: [{ id: "income", date: "2026-05-05", source: "工资", amount: 1000 }] }));
  var change = context.wealthChange("2026-05");
  assert.strictEqual(change.hasBaseline, false);
  assert.strictEqual(change.openingNetWorth, null);
  assert.strictEqual(change.closingNetWorth, 1000);
  assert.strictEqual(change.change, null);
});

test("wealth attribution uses external income minus consumption without investments", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    moneyAccounts: [{ id: "bank", name: "工资卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-04-30" }],
    incomes: [{ id: "income", date: "2026-05-05", moneyAccountId: "bank", source: "工资", amount: 500 }],
    expenses: [{ id: "expense", date: "2026-05-06", moneyAccountId: "bank", accountId: "living", category: "餐饮", amount: 200 }]
  }));
  var change = context.wealthChange("2026-05"), attribution = context.wealthAttribution("2026-05");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(change)), { openingNetWorth: 1000, closingNetWorth: 1300, change: 300, changeRate: 30, hasBaseline: true });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(attribution)), { cashflowContribution: 300, investmentPnl: 0, liabilityChange: 0, otherChange: 0, unexplained: 0, totalChange: 300 });
});

test("new investment principal is an asset conversion rather than wealth growth", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    accounts: [{ id: "long", name: "长期投资", type: "长期投资", includeExpense: false, includeAsset: true, valuationMethod: "净值快照" }],
    moneyAccounts: [
      { id: "bank", name: "银行卡", type: "银行卡", openingBalance: 2000, openingBalanceDate: "2026-04-30" },
      { id: "broker", name: "证券账户", type: "投资账户", openingBalance: 1000, openingBalanceDate: "2026-04-30" }
    ],
    investments: [{ id: "buy", date: "2026-05-10", accountId: "long", sourceMoneyAccountId: "bank", targetMoneyAccountId: "broker", type: "投资", amount: 500 }],
    snapshots: [
      { id: "opening", date: "2026-04-30", accountId: "long", marketValue: 1000, principal: 1000 },
      { id: "closing", date: "2026-05-31", accountId: "long", marketValue: 1500, principal: 1500 }
    ]
  }));
  var attribution = context.wealthAttribution("2026-05");
  assert.strictEqual(attribution.investmentPnl, 0);
  assert.strictEqual(attribution.totalChange, 0);
  assert.strictEqual(attribution.unexplained, 0);
});

test("market gain without new principal is investment PnL", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    accounts: [{ id: "long", name: "长期投资", type: "长期投资", includeExpense: false, includeAsset: true, valuationMethod: "净值快照" }],
    moneyAccounts: [{ id: "broker", name: "证券账户", type: "投资账户", openingBalance: 1000, openingBalanceDate: "2026-04-30" }],
    snapshots: [
      { id: "opening", date: "2026-04-30", accountId: "long", marketValue: 1000, principal: 1000 },
      { id: "closing", date: "2026-05-31", accountId: "long", marketValue: 1100, principal: 1000 }
    ]
  }));
  var attribution = context.wealthAttribution("2026-05");
  assert.strictEqual(attribution.investmentPnl, 100);
  assert.strictEqual(attribution.totalChange, 100);
  assert.strictEqual(attribution.unexplained, 0);
});

test("a liability first measured during the month leaves the opening baseline unavailable", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-04-30" }],
    liabilities: [{ id: "loan", name: "借款", type: "借款", currentBalance: 300, balanceDate: "2026-05-15", status: "还款中" }]
  }));
  assert.strictEqual(context.wealthChange("2026-05").hasBaseline, false);
  assert.strictEqual(context.wealthAttribution("2026-05").liabilityChange, null);
});

test("internal transfer does not change wealth attribution", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    moneyAccounts: [
      { id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-04-30" },
      { id: "wallet", name: "钱包", type: "支付账户", openingBalance: 200, openingBalanceDate: "2026-04-30" }
    ],
    transfers: [{ id: "move", date: "2026-05-10", fromMoneyAccountId: "bank", toMoneyAccountId: "wallet", amount: 300 }]
  }));
  var attribution = context.wealthAttribution("2026-05");
  assert.strictEqual(attribution.cashflowContribution, 0);
  assert.strictEqual(attribution.totalChange, 0);
  assert.strictEqual(attribution.unexplained, 0);
});

test("dashboardInsights returns an empty array when no factual rule matches", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.dashboardInsights("2026-05"))), []);
});

test("dashboardInsights detects a material category increase", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({ expenses: [
    { id: "feb", date: "2026-02-05", accountId: "living", category: "餐饮", amount: 100 },
    { id: "mar", date: "2026-03-05", accountId: "living", category: "餐饮", amount: 120 },
    { id: "apr", date: "2026-04-05", accountId: "living", category: "餐饮", amount: 80 },
    { id: "may", date: "2026-05-05", accountId: "living", category: "餐饮", amount: 600 }
  ] }));
  var insight = context.dashboardInsights("2026-05").find(function (item) { return item.type === "expense_anomaly"; });
  assert.ok(insight);
  assert.strictEqual(insight.value, 600);
});

test("dashboardInsights skips a category with fewer than three historical month samples", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({ expenses: [
    { id: "feb-food", date: "2026-02-05", accountId: "living", category: "餐饮", amount: 100 },
    { id: "mar-food", date: "2026-03-05", accountId: "living", category: "餐饮", amount: 120 },
    { id: "apr-other", date: "2026-04-05", accountId: "living", category: "交通", amount: 80 },
    { id: "may-food", date: "2026-05-05", accountId: "living", category: "餐饮", amount: 600 }
  ] }));
  assert.ok(!context.dashboardInsights("2026-05").some(function (item) { return item.type === "expense_anomaly" && item.title === "餐饮支出上升"; }));
});

test("dashboardInsights reports stale investment data and a dominant cashflow source", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    accounts: [{ id: "long", name: "长期投资", type: "长期投资", includeExpense: false, includeAsset: true, valuationMethod: "净值快照" }],
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-04-30" }],
    incomes: [{ id: "income", date: "2026-05-05", moneyAccountId: "bank", source: "工资", amount: 800 }],
    snapshots: [{ id: "old", date: "2026-04-30", accountId: "long", marketValue: 0, principal: 0 }]
  }));
  var insights = context.dashboardInsights("2026-05");
  assert.ok(insights.some(function (item) { return item.type === "investment_snapshot_stale"; }));
  assert.ok(insights.some(function (item) { return item.type === "wealth_driver" && item.value === 800; }));
});

test("reconciliation is an explicit other wealth change", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-04-30" }],
    reconciliations: [{ id: "check", date: "2026-05-10", moneyAccountId: "bank", bookBalance: 1000, actualBalance: 1050, adjustment: 50 }]
  }));
  var attribution = context.wealthAttribution("2026-05");
  assert.strictEqual(attribution.otherChange, 50);
  assert.strictEqual(attribution.totalChange, 50);
  assert.strictEqual(attribution.unexplained, 0);
});

test("upcomingFinanceEvents unifies payday, subscription and repayment", function () {
  var context = createContext(null, { calculations: true });
  var now = context.today(), renewal = testDateOffset(now, 1), laterRenewal = testDateOffset(now, 10), repayment = testDateOffset(now, 2), payday = testDateOffset(now, 3), payMonth = payday.slice(0, 7), payDay = parseInt(payday.slice(8, 10), 10);
  var plans = {};
  plans[payMonth] = { plannedIncome: 5000, payday: payDay };
  context.state = context.normalizeState(calculationAccountFixture({
    monthlyPlans: plans,
    assetItems: [
      { id: "sub", kind: "电子订阅", name: "云服务", monthlyCost: 400, renewalDate: renewal, status: "在用", valuationMode: "不计入" },
      { id: "later-sub", kind: "电子订阅", name: "季刊", monthlyCost: 20, renewalDate: laterRenewal, status: "在用", valuationMode: "不计入" }
    ],
    liabilities: [{ id: "card", name: "信用卡", type: "信用卡", currentBalance: 2000, balanceDate: now, minimumPayment: 600, dueDate: repayment, status: "还款中" }]
  }));
  var events = context.upcomingFinanceEvents(7);
  assert.ok(events.some(function (item) { return item.type === "payday" && item.direction === "in" && item.amount === null; }));
  assert.ok(events.some(function (item) { return item.type === "renewal" && item.amount === 400 && item.sourceId === "sub"; }));
  assert.ok(events.some(function (item) { return item.type === "due" && item.amount === 600 && item.sourceId === "card"; }));
  assert.ok(!events.some(function (item) { return item.sourceId === "later-sub"; }));
  assert.ok(context.upcomingFinanceEvents(14).some(function (item) { return item.sourceId === "later-sub"; }));
  assert.ok(events.every(function (item) { return item.daysLeft >= 0 && item.daysLeft <= 7; }));
  assert.ok(context.dashboardInsights("2026-05").some(function (item) { return item.type === "upcoming_cash_events"; }));
});

test("dashboardInsights reports one explicit large outflow and ignores null amounts", function () {
  var context = createContext(null, { calculations: true });
  var now = context.today(), subscriptionDate = testDateOffset(now, 1), repaymentDate = testDateOffset(now, 2);
  context.state = context.normalizeState(calculationAccountFixture({
    assetItems: [{ id: "unknown-sub", kind: "电子订阅", name: "待定续费", monthlyCost: 0, renewalDate: subscriptionDate, status: "在用", valuationMode: "不计入" }],
    liabilities: [{ id: "large-payment", name: "大额还款", type: "借款", currentBalance: 3000, balanceDate: now, minimumPayment: 1200, dueDate: repaymentDate, status: "还款中" }]
  }));
  var events = context.upcomingFinanceEvents(7);
  assert.ok(events.some(function (item) { return item.sourceId === "unknown-sub" && item.amount === null; }));
  var insight = context.dashboardInsights("2026-05").find(function (item) { return item.type === "upcoming_cash_events"; });
  assert.ok(insight);
  assert.strictEqual(insight.value, 1200);
  assert.match(insight.detail, /已记录 1 项/);
});

test("upcomingFinanceEvents returns empty without explicit future data", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.upcomingFinanceEvents())), []);
});

test("R2.5 debt service rate uses only known next-30-day minimum payments", function () {
  var context = createContext(null, { calculations: true });
  var now = context.today(), month = now.slice(0, 7);
  context.state = context.normalizeState(calculationAccountFixture({
    incomes: [{ id: "salary", date: now, accountId: "living", source: "工资", amount: 2000 }],
    liabilities: [
      { id: "card", name: "信用卡", type: "信用卡", currentBalance: 3000, balanceDate: now, minimumPayment: 300, dueDate: testDateOffset(now, 5), status: "还款中" },
      { id: "loan", name: "借款", type: "借款", currentBalance: 6000, balanceDate: now, minimumPayment: 200, dueDate: testDateOffset(now, 20), status: "还款中" }
    ]
  }));
  var rate = context.dashboardMinimumDebtServiceRate(month);
  assert.strictEqual(rate.minimumPayment, 500);
  assert.strictEqual(rate.income, 2000);
  assert.strictEqual(rate.rate, 25);
  assert.strictEqual(rate.eventCount, 2);

  context.state = context.normalizeState(calculationAccountFixture({ liabilities: [{ id: "card", name: "信用卡", type: "信用卡", currentBalance: 3000, balanceDate: now, minimumPayment: 300, dueDate: testDateOffset(now, 5), status: "还款中" }] }));
  assert.strictEqual(context.dashboardMinimumDebtServiceRate(month).rate, null);
});

test("R2.5 next planned payday is explicit and does not imply actual receipt", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({ monthlyPlans: {
    "2026-08": { plannedIncome: 3000, payday: 1 },
    "2026-09": { plannedIncome: 5500, payday: 9 }
  } }));
  var next = context.dashboardNextPlannedPayday("2026-08-30");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(next)), { date: "2026-09-09", month: "2026-09", payday: 9, plannedIncome: 5500 });
});

test("R2.5 allocation execution compares planned pools with recorded assignment", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(validV5Backup({
    accounts: [
      { id: "living", name: "日常开支", type: "生活消费", budgetPercent: 60, fixedBudget: true, includeExpense: true, includeAsset: false },
      { id: "save", name: "备用现金", type: "短期储蓄", budgetPercent: 40, fixedBudget: true, includeExpense: false, includeAsset: true }
    ],
    monthlyPlans: { "2026-05": { plannedIncome: 2000, payday: 5 } },
    incomes: [{ id: "income", date: "2026-05-05", accountId: "living", source: "工资", amount: 1000 }],
    allocations: [{ id: "allocation", date: "2026-05-05", toAccountId: "save", amount: 800 }]
  }));
  var execution = context.dashboardAllocationExecution("2026-05");
  assert.strictEqual(execution.planned, 2000);
  assert.strictEqual(execution.actual, 1800);
  assert.strictEqual(execution.deviation, -200);
  assert.deepStrictEqual(execution.pools.map(function (row) { return [row.id, row.planned, row.actual]; }), [["living", 1200, 1000], ["save", 800, 800]]);
});

test("R2.7 dashboard sample fixture migrates into a complete current business scenario", function () {
  var context = createContext(null, { calculations: true });
  var result = context.prepareImportedState(dashboardSampleFixture());
  assert.strictEqual(result.ok, true, (result.errors || []).join("\n"));
  assert.deepStrictEqual(context.__store, {});
  context.state = result.state;
  assert.strictEqual(result.state.schemaVersion, context.CURRENT_SCHEMA_VERSION);
  assert.strictEqual(result.state.moneyAccounts.length, 2);
  assert.strictEqual(result.state.incomes.length, 1);
  assert.strictEqual(result.state.expenses.length, 7);
  assert.strictEqual(result.state.allocations.length, 6);
  assert.strictEqual(result.state.liabilities.length, 1);
  assert.strictEqual(result.state.assetItems.length, 1);
  assert.strictEqual(result.state.snapshots.length, 2);
  assert.strictEqual(result.state.reconciliations.length, 1);

  var events = context.upcomingFinanceEvents(30);
  assert.ok(events.some(function (item) { return item.type === "renewal" && item.amount === 86.8; }));
  assert.ok(events.some(function (item) { return item.type === "due" && item.amount === 460; }));
  assert.ok(events.some(function (item) { return item.type === "payday" && item.amount === null; }));

  var debtRate = context.dashboardMinimumDebtServiceRate("2026-08");
  assert.ok(debtRate.rate > 0);
  assert.strictEqual(debtRate.minimumPayment, 460);
  assert.strictEqual(debtRate.income, 6888.6);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.dashboardNextPlannedPayday("2026-08-30"))), { date: "2026-09-09", month: "2026-09", payday: 9, plannedIncome: 6942.75 });

  var snapshot = context.assetSnapshotSummary("2026-08");
  assert.strictEqual(snapshot.performancePrincipal, 4004.7);
  assert.strictEqual(snapshot.performanceAsset, 4215.6);
  assert.strictEqual(snapshot.pnl, 210.9);
  assert.ok(snapshot.roi > 0);

  var change = context.wealthChange("2026-08"), attribution = context.wealthAttribution("2026-08");
  assert.strictEqual(change.hasBaseline, true);
  assert.strictEqual(attribution.totalChange, change.change);
  assert.strictEqual(context.numberValue(attribution.cashflowContribution + attribution.investmentPnl + attribution.liabilityChange + attribution.otherChange + attribution.unexplained), attribution.totalChange);

  var execution = context.dashboardAllocationExecution("2026-08");
  assert.strictEqual(execution.planned, 6888.6);
  assert.strictEqual(execution.actual, 6560.25);
  assert.strictEqual(execution.deviation, -328.35);
  [debtRate.rate, snapshot.performancePrincipal, snapshot.performanceAsset, snapshot.pnl, snapshot.roi, change.change, attribution.totalChange, execution.planned, execution.actual, execution.deviation].forEach(function (value) {
    assert.ok(Number.isFinite(value), "core fixture metric must be finite: " + value);
  });
  assert.doesNotMatch(JSON.stringify({ debtRate: debtRate, snapshot: snapshot, change: change, attribution: attribution, execution: execution }), /NaN|Infinity|undefined/);
});

test("R2.7 dashboard sample fixture is outside the production script graph", function () {
  var root = path.join(__dirname, "..");
  var indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(indexHtml, /dashboard-sample\.json/);
  var scriptPattern = /<script\b[^>]*\bsrc="([^"]+\.js)(?:\?[^\"]*)?"[^>]*><\/script>/g;
  var match;
  while ((match = scriptPattern.exec(indexHtml))) {
    var source = fs.readFileSync(path.join(root, match[1]), "utf8");
    assert.doesNotMatch(source, /dashboard-sample\.json/);
  }
});

test("unlinked cashflow remains an unexplained balancing difference", function () {
  var context = createContext(null, { calculations: true });
  context.state = context.normalizeState(calculationAccountFixture({
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: "2026-04-30" }],
    expenses: [{ id: "cash", date: "2026-05-05", accountId: "living", moneyAccountId: "", category: "餐饮", amount: 600 }]
  }));
  var attribution = context.wealthAttribution("2026-05");
  assert.strictEqual(attribution.cashflowContribution, -600);
  assert.strictEqual(attribution.totalChange, 0);
  assert.strictEqual(attribution.unexplained, 600);
  assert.strictEqual(attribution.cashflowContribution + attribution.investmentPnl + attribution.liabilityChange + attribution.otherChange + attribution.unexplained, attribution.totalChange);
  assert.ok(context.dashboardInsights("2026-05").some(function (item) { return item.type === "unexplained_wealth_change"; }));
});
