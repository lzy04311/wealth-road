"use strict";

// Run with:
// node scripts/app-render-smoke.test.js

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

function MockElement() {
  this.innerHTML = "";
  this.textContent = "";
  this.value = "";
  this.className = "";
  this.checked = false;
  this.files = [];
  this.style = {};
  this.dataset = {};
  this._children = {};
  this._listeners = {};
  this.parentElement = { querySelector: function () { return new MockElement(); } };
  var classSet = {};
  this.classList = {
    add: function (name) { classSet[name] = true; },
    remove: function (name) { delete classSet[name]; },
    toggle: function (name, force) {
      if (force === true) classSet[name] = true;
      else if (force === false) delete classSet[name];
      else if (classSet[name]) delete classSet[name];
      else classSet[name] = true;
      return !!classSet[name];
    },
    contains: function (name) { return !!classSet[name]; }
  };
}
MockElement.prototype.addEventListener = function (type, handler) {
  if (!this._listeners[type]) this._listeners[type] = [];
  this._listeners[type].push(handler);
};
MockElement.prototype.setAttribute = function () {};
MockElement.prototype.focus = function () {};
MockElement.prototype.querySelector = function (selector) {
  if (!this._children[selector]) this._children[selector] = new MockElement();
  return this._children[selector];
};
MockElement.prototype.querySelectorAll = function () { return []; };
MockElement.prototype.closest = function () { return null; };
MockElement.prototype.appendChild = function () {};
MockElement.prototype.remove = function () {};
MockElement.prototype.click = function () {
  var handlers = this._listeners.click || [];
  handlers.forEach(function (fn) { fn(); });
};
MockElement.prototype.reset = function () {};
MockElement.prototype.scrollIntoView = function () {};

function createContext() {
  var elements = {};
  var store = {};
  var document = {
    readyState: "complete",
    body: new MockElement(),
    createElement: function () { return new MockElement(); },
    getElementById: function (id) {
      if (!elements[id]) elements[id] = new MockElement();
      return elements[id];
    },
    querySelector: function () { return new MockElement(); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  };
  var context = {
    console: console,
    document: document,
    window: { document: document, scrollTo: function () {} },
    Blob: function () {},
    URL: { createObjectURL: function () { return "blob:mock"; }, revokeObjectURL: function () {} },
    FileReader: function () { this.readAsText = function () {}; },
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem: function (key, value) { store[key] = String(value); },
      removeItem: function (key) { delete store[key]; }
    },
    setInterval: function () { return 1; },
    clearTimeout: function () {},
    setTimeout: function (fn) { if (typeof fn === "function") fn(); return 1; },
    alert: function () {},
    confirm: function () { return false; },
    Date: Date,
    Math: Math
  };
  vm.createContext(context);
  [
    "app-state.js",
    "app-validators.js",
    "app-migrations.js",
    "app-storage.js",
    "app-backend-config.js",
    "app-calculations.js",
    "app-render-core.js",
    "dashboard/dashboard-formatters.js",
    "dashboard/render-bottom-strip.js",
    "app-render-dashboard.js",
    "app-render-assets.js",
    "app-render-records.js",
    "app-render-investments.js",
    "app-render-monthly.js",
    "app-render-flow.js",
    "app-actions-data.js",
    "app-actions-crud.js",
    "app-actions-quick-entry.js",
    "app-actions-modals.js",
    "app-auth.js",
    "app-sync.js",
    "app-actions-navigation.js",
    "app-actions.js"
  ].forEach(function (fileName) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, fileName), "utf8"), context);
  });
  context.__elements = elements;
  return context;
}

var testChain = Promise.resolve();
function test(name, fn) {
  testChain = testChain.then(function () {
    return Promise.resolve().then(fn).then(function () {
      console.log("PASS " + name);
    }).catch(function (err) {
      console.error("FAIL " + name);
      console.error(err && err.stack ? err.stack : err);
      process.exitCode = 1;
    });
  });
}

test("renderAll does not throw in DOM smoke context", function () {
  var context = createContext();
  assert.doesNotThrow(function () {
    context.renderAll();
  });
  assert.ok(context.__elements.dashboardTotalAsset);
  assert.ok(context.__elements.incomeList);
  assert.ok(context.__elements.expenseList);
});

test("dated record forms do not expose duplicate month inputs", function () {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  [
    "quickIncomeMonth", "quickExpenseMonth", "quickInvestmentMonth",
    "incomeMonth", "expenseMonth", "investmentMonth", "transferMonth", "snapshotMonth"
  ].forEach(function (id) {
    assert.doesNotMatch(html, new RegExp("id=[\\\"']" + id + "[\\\"']"), id + " should not exist");
  });
  assert.match(html, /id=["']currentMonth["'][^>]*hidden/);
  assert.match(html, /id=["']planMonth["'][^>]*hidden/);
});

test("core render functions reuse provided month context", function () {
  var context = createContext();
  var current = context.currentMonth();
  var renderCtx = context.buildRenderContext(current);
  var originalMonthlySummary = context.monthlySummary;
  context.monthlySummary = function (month) {
    if (month === current) throw new Error("should not recompute current-month summary when ctx is provided");
    return originalMonthlySummary(month);
  };
  assert.doesNotThrow(function () { context.renderExpenses(renderCtx); });
  assert.doesNotThrow(function () { context.renderInvestments(renderCtx); });
  assert.doesNotThrow(function () { context.renderMonthly(renderCtx); });
  assert.doesNotThrow(function () { context.renderFlow(renderCtx); });
});

test("actual account selectors become required after real accounts are enabled", function () {
  var context = createContext();
  var ids = ["incomeMoneyAccount", "expenseMoneyAccount", "investmentSourceMoneyAccount", "investmentTargetMoneyAccount", "quickIncomeMoneyAccount", "quickExpenseMoneyAccount", "quickInvestmentSourceMoneyAccount", "quickInvestmentTargetMoneyAccount"];
  context.state = context.normalizeState({ moneyAccounts: [{ id: "bank", name: "测试银行卡", type: "银行卡", openingBalance: 0, openingBalanceDate: "2026-08-15" }] });
  context.syncSelects();
  ids.forEach(function (id) {
    assert.strictEqual(context.__elements[id].required, true, id + " should be required");
    assert.match(context.__elements[id].innerHTML, /请选择实际账户/);
  });
  assert.strictEqual(context.ensureMoneyAccountsSelected(["incomeMoneyAccount"]), false);
  context.__elements.incomeMoneyAccount.value = "bank";
  assert.strictEqual(context.ensureMoneyAccountsSelected(["incomeMoneyAccount"]), true);
});

test("transfer entry guides users to create two real accounts first", function () {
  var context = createContext();
  var event = { target: { closest: function (selector) { return selector === "[data-open-form]" ? { dataset: { openForm: "transfer" } } : null; } } };
  assert.strictEqual(context.handleFormAndModalClick(event), true);
  assert.strictEqual(context.__elements.accounts.classList.contains("active"), true);
  assert.strictEqual(context.__elements.moneyAccountFormCard.classList.contains("open"), true);

  context = createContext();
  context.state = context.normalizeState({ moneyAccounts: [
    { id: "a", name: "账户 A", type: "银行卡", openingBalance: 0, openingBalanceDate: "2026-08-15" },
    { id: "b", name: "账户 B", type: "支付账户", openingBalance: 0, openingBalanceDate: "2026-08-15" }
  ] });
  assert.strictEqual(context.handleFormAndModalClick(event), true);
  assert.strictEqual(context.__elements.transferFormCard.classList.contains("open"), true);
});

test("reconciliation entry guides users to create a real account first", function () {
  var context = createContext();
  var event = { target: { closest: function (selector) { return selector === "[data-open-form]" ? { dataset: { openForm: "reconciliation" } } : null; } } };
  assert.strictEqual(context.handleFormAndModalClick(event), true);
  assert.strictEqual(context.__elements.moneyAccountFormCard.classList.contains("open"), true);
  assert.strictEqual(context.document.getElementById("reconciliationFormCard").classList.contains("open"), false);
});

test("historical unlinked income can be assigned to a real account", function () {
  var context = createContext();
  context.state = context.normalizeState({
    moneyAccounts: [{ id: "bank", name: "测试银行卡", type: "银行卡", openingBalance: 0, openingBalanceDate: "2026-08-15" }],
    incomes: [{ id: "old", date: "2026-08-15", source: "工资", amount: 100, accountId: "", moneyAccountId: "" }]
  });
  context.renderUnlinkedMoneyRecords();
  assert.match(context.__elements.unlinkedMoneySummary.innerHTML, /1/);
  context.document.getElementById("repair-income-old").value = "bank";
  context.linkHistoricalMoneyAccount("income", "old");
  assert.strictEqual(context.state.incomes[0].moneyAccountId, "bank");
  assert.strictEqual(context.unlinkedMoneyRecords().length, 0);
});

test("appConfirm resolves true when clicking ok", function () {
  var context = createContext();
  var result = null;
  context.appConfirm("确认", "测试", "确定", "取消").then(function (ok) { result = ok; });
  var body = context.document.getElementById("healthModalBody");
  var okBtn = body.querySelector("[data-dialog-action=\"ok\"]");
  assert.ok(okBtn, "ok button should exist");
  okBtn.click();
  return Promise.resolve().then(function () {
    assert.strictEqual(result, true);
  });
});

test("appConfirm resolves false on dismiss close", function () {
  var context = createContext();
  var result = null;
  context.appConfirm("确认", "测试", "确定", "取消").then(function (ok) { result = ok; });
  context.closeHealthModal("dismiss");
  return Promise.resolve().then(function () {
    assert.strictEqual(result, false);
  });
});

test("health detail modal is derived from the active score model", function () {
  var context = createContext();
  var target = { closest: function () { return { dataset: { healthDetail: "score" } }; } };
  assert.strictEqual(context.handleHealthDetailClick({ target: target }), true);
  var html = context.document.getElementById("healthModalBody").innerHTML;
  assert.match(html, /月度执行健康度/);
  assert.match(html, /模型版本 <b>v1<\/b>/);
  assert.match(html, /资产判断基线不完整/);
  assert.doesNotMatch(html, /回撤|增长 \+4/);
});

test("activateView switches between home and module page modes", function () {
  var context = createContext();
  context.activateView("flow");
  assert.strictEqual(context.document.body.classList.contains("module-page-mode"), true);
  assert.strictEqual(context.document.body.classList.contains("dashboard-home-mode"), false);
  context.activateView("dashboard");
  assert.strictEqual(context.document.body.classList.contains("dashboard-home-mode"), true);
  assert.strictEqual(context.document.body.classList.contains("module-page-mode"), false);
});

test("module forms open in a dismissible drawer instead of expanding the page", function () {
  var context = createContext();
  context.openForm("income");
  assert.strictEqual(context.__elements.incomeFormCard.classList.contains("open"), true);
  assert.strictEqual(context.document.body.classList.contains("form-drawer-open"), true);
  assert.strictEqual(context.activeFormPrefix, "income");
  context.closeActiveFormDrawer(true);
  assert.strictEqual(context.__elements.incomeFormCard.classList.contains("open"), false);
  assert.strictEqual(context.document.body.classList.contains("form-drawer-open"), false);
});

test("module-level actions have a single contextual entry point", function () {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.strictEqual((html.match(/data-open-form=["']moneyAccount["']/g) || []).length, 1);
  assert.strictEqual((html.match(/id=["']flowAddRecord["']/g) || []).length, 1);
  assert.doesNotMatch(html, /id=["']flowAddRecordTop["']/);
  assert.doesNotMatch(html, /id=["']exportDataTop["']/);
});

test("month navigation clamps dates at shorter month end", function () {
  var context = createContext();
  context.__elements.currentMonth.value = "2026-03";
  context.__elements.dashboardDate.value = "2026-03-31";
  context.shiftCurrentMonth(-1);
  assert.strictEqual(context.__elements.currentMonth.value, "2026-02");
  assert.strictEqual(context.__elements.dashboardDate.value, "2026-02-28");
});

test("flow search matches account, category, note and amount", function () {
  var context = createContext();
  context.state = context.normalizeState({
    accounts: [{ id: "daily", name: "日常开支", type: "生活消费", includeExpense: true }],
    expenses: [
      { id: "a", date: "2026-08-01", accountId: "daily", category: "餐饮", amount: 36, note: "午饭" },
      { id: "b", date: "2026-08-02", accountId: "daily", category: "交通", amount: 18, note: "地铁" }
    ]
  });
  context.flowRecordSearch = "午饭";
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.filterFlowRecords(context.state.expenses, "expense").map(function (item) { return item.id; }))), ["a"]);
  context.flowRecordSearch = "18";
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.filterFlowRecords(context.state.expenses, "expense").map(function (item) { return item.id; }))), ["b"]);
});

test("unassigned funding account is presented as pending allocation", function () {
  var context = createContext();
  assert.strictEqual(context.fundingAccountName(""), "待分配资金");
  assert.strictEqual(context.recordList([{ id: "i", date: "2026-08-13", source: "工资", amount: 123, note: "" }], "income").includes("收入归属：待分配资金"), true);
  context.flowRecordSearch = "待分配";
  assert.strictEqual(context.filterFlowRecords([{ id: "i", date: "2026-08-13", source: "工资", amount: 123, note: "" }], "income").length, 1);
});

test("deleted record can be restored from action feedback", function () {
  var context = createContext();
  context.setTimeout = function () { return 1; };
  context.state.incomes = [{ id: "income-a", date: "2026-08-01", month: "2026-08", accountId: "", source: "工资", amount: 100, note: "" }];
  context.removeRecordFinal("income", "income-a", "incomes");
  assert.strictEqual(context.state.incomes.length, 0);
  context.runActionFeedback();
  assert.strictEqual(context.state.incomes.length, 1);
  assert.strictEqual(context.state.incomes[0].id, "income-a");
});

test("failed undo save rolls the restored record back out of memory", function () {
  var context = createContext();
  var saveCalls = 0;
  context.setTimeout = function () { return 1; };
  context.save = function () { saveCalls += 1; return saveCalls === 1; };
  context.state.incomes = [{ id: "income-a", date: "2026-08-01", month: "2026-08", accountId: "", source: "工资", amount: 100, note: "" }];
  context.removeRecordFinal("income", "income-a", "incomes");
  assert.strictEqual(context.state.incomes.length, 0);
  context.runActionFeedback();
  assert.strictEqual(context.state.incomes.length, 0);
});

test("a local save during cloud sync queues a snapshot of the latest state", function () {
  var context = createContext();
  var requests = [];
  var resolvers = [];
  context.setTimeout = function (fn) { fn(); return 1; };
  context.getSyncClientAndUser = function () {
    return {
      user: { id: "user-a" },
      client: {
        from: function () {
          return {
            upsert: function (payload) {
              requests.push(payload.state);
              return {
                select: function () {
                  return {
                    single: function () {
                      return new Promise(function (resolve) { resolvers.push(resolve); });
                    }
                  };
                }
              };
            }
          };
        }
      }
    };
  };

  context.state.rules = "first";
  var firstPush = context.pushLocalStateToCloud();
  assert.strictEqual(requests.length, 1);
  context.state.rules = "second";
  context.scheduleCloudPushAfterLocalSave();
  assert.strictEqual(context.backendSyncState.pendingCloudPush, true);
  assert.strictEqual(requests[0].rules, "first");

  resolvers.shift()({ data: { updated_at: "2026-08-15T00:00:00.000Z" }, error: null });
  return firstPush.then(function () {
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(requests[1].rules, "second");
    resolvers.shift()({ data: { updated_at: "2026-08-15T00:00:01.000Z" }, error: null });
    return Promise.resolve();
  });
});

test("backend auth stays local-only when Supabase client is unavailable", function () {
  var context = createContext();
  assert.strictEqual(context.backendAuthState.status, "local-only");
  assert.strictEqual(context.backendAuthState.user, null);
});

test("backend config is local-only by default", function () {
  var context = createContext();
  assert.strictEqual(context.isBackendConfigured(), false);
});

test("sync conflict detection flags two-device edits", function () {
  var context = createContext();
  var result = context.detectSyncConflict({
    localUpdatedAt: "2026-06-07T10:10:00.000Z",
    lastCloudUpdatedAt: "2026-06-07T10:00:00.000Z"
  }, "2026-06-07T10:12:00.000Z");
  assert.strictEqual(result.conflict, true);
  assert.strictEqual(result.localChangedSinceCloud, true);
  assert.strictEqual(result.cloudChangedSinceSync, true);
});

test("automatic cloud resolution does not overwrite local state", function () {
  var context = createContext();
  context.state.rules = "local rules";
  context.syncMeta = {
    localUpdatedAt: "2026-06-07T09:00:00.000Z",
    lastCloudUpdatedAt: "2026-06-07T09:00:00.000Z",
    lastSyncedAt: "2026-06-07T09:00:00.000Z"
  };
  var cloudState = context.normalizeState(null);
  cloudState.rules = "cloud rules";
  return context.resolveCloudStateRow({
    state: cloudState,
    updated_at: "2026-06-07T10:00:00.000Z"
  }, false).then(function (result) {
    assert.strictEqual(result, false);
    assert.strictEqual(context.state.rules, "local rules");
    assert.strictEqual(context.backendSyncState.status, "cloud-newer");
    assert.ok(context.backendSyncState.pendingCloudState);
  });
});

test("applying cloud state exports local backup first", function () {
  var context = createContext();
  var backups = [];
  context.state.rules = "local rules";
  context.downloadStateBackup = function (payload, fileName) {
    backups.push({ payload: payload, fileName: fileName });
  };
  var cloudState = context.normalizeState(null);
  cloudState.rules = "cloud rules";
  return context.applyCloudState({
    state: cloudState,
    updatedAt: "2026-06-07T10:00:00.000Z"
  }).then(function (result) {
    assert.strictEqual(result, true);
    assert.strictEqual(backups.length, 1);
    assert.match(backups[0].fileName, /^caiji-backup-before-cloud-pull_/);
    assert.strictEqual(backups[0].payload.rules, "local rules");
    assert.strictEqual(context.state.rules, "cloud rules");
  });
});

testChain.then(function () {}, function () {});
