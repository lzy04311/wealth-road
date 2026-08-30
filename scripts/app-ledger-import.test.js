"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

function MockElement() {
  this.value = "";
  this.innerHTML = "";
  this.textContent = "";
  this.hidden = false;
  this.disabled = false;
  this.files = [];
  this.dataset = {};
  this._listeners = {};
}
MockElement.prototype.addEventListener = function (type, handler) { this._listeners[type] = handler; };
MockElement.prototype.closest = function () { return null; };

function createContext() {
  var elements = {};
  var context = {
    console: console,
    TextEncoder: TextEncoder,
    Blob: Blob,
    document: {
      getElementById: function (id) {
        if (!elements[id]) elements[id] = new MockElement();
        return elements[id];
      }
    },
    localStorage: {
      getItem: function () { return null; },
      setItem: function () {},
      removeItem: function () {}
    },
    navigator: {},
    notify: function () {},
    appAlert: function () {},
    appConfirm: function () { return Promise.resolve(false); }
  };
  vm.createContext(context);
  ["app-state.js", "app-validators.js", "app-migrations.js", "app-calculations.js", "app-actions-ledger-import.js"].forEach(function (fileName) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, fileName), "utf8"), context);
  });
  context.state = context.normalizeState({
    schemaVersion: 6,
    accounts: [
      { id: "daily", name: "日常开支", type: "生活消费", budgetPercent: 60, fixedBudget: true, includeExpense: true, includeAsset: false, target: 0 },
      { id: "long", name: "长期投资", type: "长期投资", budgetPercent: 40, fixedBudget: true, includeExpense: false, includeAsset: true, target: 0 }
    ],
    moneyAccounts: [
      { id: "bank", name: "银行卡", type: "银行卡", openingBalance: 0, openingBalanceDate: "2026-07-31" },
      { id: "broker", name: "投资平台", type: "投资账户", openingBalance: 0, openingBalanceDate: "2026-07-31" }
    ],
    reconciliations: [], allocations: [], incomes: [], expenses: [], investments: [], transfers: [], snapshots: [], assetItems: [], liabilities: [], monthlyPlans: {}, rules: "rule"
  });
  context.__elements = elements;
  context.populateLedgerCsvMappings();
  return context;
}

function setMappings(context) {
  context.byId("ledgerCsvExpenseAccount").value = "daily";
  context.byId("ledgerCsvInvestmentAccount").value = "long";
  context.byId("ledgerCsvIncomeMoneyAccount").value = "bank";
  context.byId("ledgerCsvExpenseMoneyAccount").value = "bank";
  context.byId("ledgerCsvInvestmentSourceMoneyAccount").value = "bank";
  context.byId("ledgerCsvInvestmentTargetMoneyAccount").value = "broker";
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

test("CSV parser handles BOM, quoted commas, escaped quotes and embedded newlines", function () {
  var context = createContext();
  var text = "\uFEFF日期,项目,分类,收入,支出,类型,备注\r\n2026/8/15,\"公司,工资\",工资,5430,,收入,\"到账\n备注 \"\"已核对\"\"\"\r\n";
  var rows = context.ledgerCsvReadRows(text);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].date, "2026-08-15");
  assert.strictEqual(rows[0].project, "公司,工资");
  assert.match(rows[0].note, /已核对/);
});

test("CSV rows map into income, expense, investment and payroll withholding records", function () {
  var context = createContext();
  setMappings(context);
  var text = [
    "日期,项目,分类,收入,支出,类型,备注",
    "2026-08-15,实际到账工资,工资,5430,,收入,",
    "2026-08-16,早餐,餐饮,,20,支出,",
    "2026-08-17,指数基金,长期投资,,1000,投资转入,",
    "2026-08-15,公司餐费,餐饮,,70,工资代扣,到账前结算"
  ].join("\n");
  context.ledgerCsvSession = { rows: context.ledgerCsvReadRows(text), decisions: {} };
  var model = context.ledgerCsvPreviewModel();
  assert.deepStrictEqual([model.counts.incomes, model.counts.expenses, model.counts.investments], [1, 2, 1]);
  var records = model.rows.map(function (entry) { return entry.candidate.record; });
  assert.strictEqual(records[0].moneyAccountId, "bank");
  assert.strictEqual(records[1].paymentMode, "money_account");
  assert.strictEqual(records[1].moneyAccountId, "bank");
  assert.strictEqual(records[2].type, "投资");
  assert.strictEqual(records[2].product, "指数基金");
  assert.strictEqual(records[2].sourceMoneyAccountId, "bank");
  assert.strictEqual(records[2].targetMoneyAccountId, "broker");
  assert.strictEqual(records[3].paymentMode, "payroll_withholding");
  assert.strictEqual(records[3].moneyAccountId, "");
  assert.strictEqual(records[3].accountId, "daily");
});

test("suspected duplicates remain unresolved until the user explicitly imports or skips them", function () {
  var context = createContext();
  setMappings(context);
  context.state.expenses.push(context.normalizeExpense({ id: "existing", date: "2026-08-18", accountId: "daily", moneyAccountId: "bank", paymentMode: "money_account", category: "交通", amount: 3, note: "项目：地铁" }, {}));
  var text = [
    "日期,项目,分类,收入,支出,类型,备注",
    "2026-08-18,地铁,交通,,3,支出,第一次",
    "2026-08-18,地铁,交通,,3,支出,第二次"
  ].join("\n");
  context.ledgerCsvSession = { rows: context.ledgerCsvReadRows(text), decisions: {} };
  var unresolved = context.ledgerCsvPreviewModel();
  assert.strictEqual(unresolved.counts.duplicates, 2);
  assert.strictEqual(unresolved.counts.unresolved, 2);
  assert.strictEqual(unresolved.counts.expenses, 0);
  context.ledgerCsvSession.decisions[0] = "import";
  context.ledgerCsvSession.decisions[1] = "skip";
  var resolved = context.ledgerCsvPreviewModel();
  assert.strictEqual(resolved.counts.unresolved, 0);
  assert.strictEqual(resolved.counts.expenses, 1);
  assert.strictEqual(resolved.rows[0].include, true);
  assert.strictEqual(resolved.rows[1].include, false);
});

test("invalid type and conflicting amount columns stay out of the append set", function () {
  var context = createContext();
  setMappings(context);
  var text = [
    "日期,项目,分类,收入,支出,类型,备注",
    "2026-08-19,错误类型,其他,,10,退款,",
    "2026-08-20,双边金额,其他,10,10,收入,"
  ].join("\n");
  context.ledgerCsvSession = { rows: context.ledgerCsvReadRows(text), decisions: {} };
  var model = context.ledgerCsvPreviewModel();
  assert.strictEqual(model.counts.invalid, 2);
  assert.strictEqual(model.counts.incomes + model.counts.expenses + model.counts.investments, 0);
});

test("selected CSV records form a valid append-only full-state draft", function () {
  var context = createContext();
  setMappings(context);
  var text = [
    "日期,项目,分类,收入,支出,类型,备注",
    "2026-08-15,实际到账工资,工资,5430,,收入,",
    "2026-08-15,公司餐费,餐饮,,70,工资代扣,"
  ].join("\n");
  context.ledgerCsvSession = { rows: context.ledgerCsvReadRows(text), decisions: {} };
  var model = context.ledgerCsvPreviewModel();
  var merged = context.clonePlain(context.state);
  model.rows.filter(function (entry) { return entry.include; }).forEach(function (entry) { merged[entry.candidate.collection].push(entry.candidate.record); });
  var prepared = context.prepareImportedState(merged);
  assert.strictEqual(prepared.ok, true, (prepared.errors || []).join("\n"));
  assert.strictEqual(prepared.state.incomes.length, 1);
  assert.strictEqual(prepared.state.expenses.length, 1);
  assert.strictEqual(context.state.incomes.length, 0, "preview must not mutate existing state");
});
