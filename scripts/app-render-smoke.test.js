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
    "app-ui-feedback.js",
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
    "app-actions-forms.js",
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

function dashboardSampleFixture() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tests", "fixtures", "dashboard-sample.json"), "utf8"));
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

test("bottom strip list bullets use the semantic dot class", function () {
  var context = createContext();
  var emptyList = context.dashboardStripTopList([], "等待数据");
  var populatedList = context.dashboardStripTopList([{ name: "日常", pct: 100 }], "等待数据");
  assert.match(emptyList, /class="dashboard-strip-dot" aria-hidden="true"/);
  assert.match(populatedList, /class="dashboard-strip-dot" aria-hidden="true"/);
  assert.doesNotMatch(emptyList, /<i><\/i>/);
  assert.doesNotMatch(populatedList, /<i><\/i>/);
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
        rpc: function (name, payload) {
          assert.strictEqual(name, "save_finance_state");
          requests.push(payload.p_state);
          return {
            single: function () {
              return new Promise(function (resolve) { resolvers.push(resolve); });
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

  resolvers.shift()({ data: { updated_at: "2026-08-15T00:00:00.000Z", conflict: false }, error: null });
  return firstPush.then(function () {
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(requests[1].rules, "second");
    resolvers.shift()({ data: { updated_at: "2026-08-15T00:00:01.000Z", conflict: false }, error: null });
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

test("backend config rejects privileged and missing client credentials", function () {
  var context = createContext();
  assert.strictEqual(context.isAllowedBackendAnonKey("sb_secret_abcdefghijklmnopqrstuvwxyz"), false);
  assert.strictEqual(context.isAllowedBackendAnonKey("sb_publishable_abcdefghijklmnopqrstuvwxyz"), true);
  assert.strictEqual(context.isAllowedBackendClientScript("https://cdn.example.com/supabase.js"), false);
  assert.strictEqual(context.isAllowedBackendClientScript("./scripts/vendor/supabase-js.js"), true);
});

test("server-side sync conflict blocks cloud overwrite", function () {
  var context = createContext();
  context.getSyncClientAndUser = function () {
    return {
      user: { id: "user-a" },
      client: {
        rpc: function () {
          return { single: function () { return Promise.resolve({ data: { updated_at: "2026-08-16T00:00:00.000Z", conflict: true }, error: null }); } };
        }
      }
    };
  };
  return context.pushLocalStateToCloud().then(function (ok) {
    assert.strictEqual(ok, false);
    assert.strictEqual(context.backendSyncState.unresolvedConflict, true);
    assert.strictEqual(context.backendSyncState.status, "conflict");
  });
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

test("dashboard compass renders six wealth-semantic nodes with only existing page links", function () {
  var context = createContext();
  context.dashboardInvestmentMetric = function () { return { value: "+¥80.00", context: "本月损益", className: "positive" }; };
  context.renderDashboardCompass(
    { netCashFlow: 300 }, {},
    { hasBaseline: true, change: 500 },
    { investmentPnl: 80 },
    { name: "应急金", progress: 60 },
    [{}, {}, {}],
    [{ title: "普通洞察", priority: "medium" }, { title: "优先洞察", priority: "high" }],
    "资金状态"
  );
  var html = context.__elements.wealthCompassNodes.innerHTML;
  assert.strictEqual((html.match(/<button\b/g) || []).length, 3);
  assert.strictEqual((html.match(/<div\b[^>]*role="status"/g) || []).length, 3);
  ["财富变化", "现金流", "投资", "近期", "目标", "洞察"].forEach(function (label) { assert.ok(html.includes(label), label); });
  ["node-data", "node-flow", "node-invest", "node-assets", "node-goals", "node-accounts"].forEach(function (key) { assert.ok(html.includes(key), key); });
  assert.strictEqual((html.match(/is-core/g) || []).length, 3);
  assert.strictEqual((html.match(/is-aux/g) || []).length, 3);
  assert.strictEqual((html.match(/class="node-name"/g) || []).length, 6);
  assert.strictEqual((html.match(/<strong\b/g) || []).length, 6);
  assert.strictEqual((html.match(/class="node-desc"/g) || []).length, 6);
  assert.match(html, /\+¥500\.00/);
  assert.match(html, /3项/);
  assert.match(html, /60%/);
  assert.match(html, /优先洞察/);
  assert.strictEqual((html.match(/data-action="open-view"/g) || []).length, 3);
  assert.doesNotMatch(html, /data-dashboard-node=/);
  assert.match(html, /data-view="flow"/);
  assert.match(html, /data-view="investments"/);
  assert.match(html, /data-view="goals"/);
  assert.doesNotMatch(html, />备份</);
});

test("dashboard shows baseline pending instead of a fabricated zero change", function () {
  var context = createContext();
  context.__elements.currentMonth.value = context.monthOf(context.today());
  context.state = context.normalizeState({ accounts: [{ id: "daily", name: "日常开支", type: "生活消费", includeExpense: true, includeAsset: false }] });
  context.renderDashboard(context.buildRenderContext(context.currentMonth()));
  assert.match(context.__elements.dashboardAssetChange.innerHTML, /基线待补/);
  assert.match(context.__elements.wealthCompassNodes.innerHTML, /财富变化/);
  assert.match(context.__elements.wealthCompassNodes.innerHTML, /基线待补/);
  assert.match(context.__elements.dashboardBottomStrip.innerHTML, /等待形成完整基线/);
  assert.match(context.__elements.dashboardTrendFacts.innerHTML, /最低偿债率[\s\S]*待记录/);
  assert.doesNotMatch(context.__elements.dashboardAssetChange.innerHTML, /\+¥0\.00/);
  assert.doesNotMatch(context.__elements.dashboardTrendFacts.innerHTML, /\+¥0\.00/);
});

test("dashboard renders a verified current-month wealth change", function () {
  var context = createContext();
  var month = context.monthOf(context.today()), openingDate = context.calculationDateBefore(month + "-01");
  context.__elements.currentMonth.value = month;
  context.state = context.normalizeState({
    accounts: [{ id: "daily", name: "日常开支", type: "生活消费", includeExpense: true, includeAsset: false }],
    moneyAccounts: [{ id: "bank", name: "银行卡", type: "银行卡", openingBalance: 1000, openingBalanceDate: openingDate }],
    incomes: [{ id: "income", date: context.today(), moneyAccountId: "bank", source: "工资", amount: 250 }]
  });
  context.renderDashboard(context.buildRenderContext(month));
  assert.match(context.__elements.dashboardAssetChange.innerHTML, /\+¥250\.00/);
  assert.match(context.__elements.dashboardTrendFacts.innerHTML, /最低偿债率/);
  assert.match(context.__elements.wealthCompassNodes.innerHTML, /\+¥250\.00/);
  assert.match(context.__elements.dashboardBottomStrip.innerHTML, /财富归因/);
  assert.match(context.__elements.dashboardBottomStrip.innerHTML, /\+¥250\.00/);
});

test("future outflow card only shows known subscription and minimum-payment outflows", function () {
  var context = createContext();
  var html = context.dashboardFutureOutflowCard([
    { type: "renewal", direction: "out", amount: 40, title: "云服务续费" },
    { type: "due", direction: "out", amount: 600, title: "信用卡还款" },
    { type: "payday", direction: "in", amount: null, title: "发薪日" }
  ]);
  assert.match(html, /未来30天/);
  assert.match(html, /未来30天已知流出/);
  assert.match(html, /¥640\.00/);
  assert.match(html, /订阅 ¥40\.00/);
  assert.match(html, /最低还款 ¥600\.00/);
  assert.doesNotMatch(html, /预计总支出|未来总支出/);
  var emptyHtml = context.dashboardFutureOutflowCard([]);
  assert.match(emptyHtml, /暂无已记录流出/);
});

test("finance event card keeps unknown amounts out of any net-impact claim", function () {
  var context = createContext();
  var html = context.dashboardFinanceEventsCard([{ date: "2026-08-18", title: "发薪日", amount: null, direction: "in", sourceId: "salary" }]);
  assert.match(html, /金额待定/);
  assert.doesNotMatch(html, /净影响/);
  var emptyHtml = context.dashboardFinanceEventsCard([]);
  assert.match(emptyHtml, /无已记录事项/);
  assert.match(emptyHtml, /添加续费、还款或发薪计划后显示/);
});

test("goal dashboard uses the nearest unfinished goal and preserves a real empty state", function () {
  var context = createContext();
  context.state = context.normalizeState({ accounts: [
    { id: "near", name: "应急金", type: "应急金", includeAsset: true, openingBalance: 800, openingBalanceDate: "2026-01-01", valuationMethod: "流水余额", target: 1000 },
    { id: "far", name: "长期储备", type: "短期储蓄", includeAsset: true, openingBalance: 200, openingBalanceDate: "2026-01-01", valuationMethod: "流水余额", target: 1000 }
  ] });
  var goal = context.dashboardPrimaryGoal("2026-08", context.state.accounts);
  assert.strictEqual(goal.name, "应急金");
  assert.strictEqual(goal.progress, 80);
  assert.strictEqual(goal.remaining, 200);
  assert.match(context.dashboardPrimaryGoalCard(goal), /¥800\.00 \/ ¥1,000\.00/);
  var emptyHtml = context.dashboardPrimaryGoalCard(null);
  assert.match(emptyHtml, /暂无目标/);
  assert.doesNotMatch(emptyHtml, /0%/);
});

test("right dashboard renders four assigned regions and real portfolio labels", function () {
  var context = createContext();
  context.state = context.normalizeState({
    accounts: [{ id: "long", name: "证券账户", type: "长期投资", includeAsset: true, valuationMethod: "净值快照" }],
    investments: [{ id: "buy", date: "2026-05-05", accountId: "long", type: "投资", amount: 1000, product: "指数基金" }],
    snapshots: [{ id: "snap", date: "2026-05-31", accountId: "long", marketValue: 1080, principal: 1000 }]
  });
  var rows = context.dashboardInvestmentPortfolioRows("2026-05", context.state.accounts);
  assert.strictEqual(rows[0].name, "指数基金");
  assert.strictEqual(rows[0].value, 1080);
  context.renderDashboardRightCards("2026-05", rows, [], [], null);
  var html = context.__elements.dashboardRightCards.innerHTML;
  assert.strictEqual((html.match(/<article\b/g) || []).length, 4);
  ["投资组合", "未来30天", "近期事件", "目标进度"].forEach(function (label) { assert.ok(html.includes(label), label); });
  assert.match(html, /指数基金/);
  assert.doesNotMatch(html, /资产结构|当前配置概览|备份与安全|月度执行健康/);
});

test("R2.7 complete dashboard sample renders all data-backed modules", function () {
  var context = createContext();
  context.__elements.currentMonth.value = "2026-08";
  context.state = context.normalizeState(dashboardSampleFixture());
  context.renderDashboard(context.buildRenderContext("2026-08"));
  var html = Object.keys(context.__elements).map(function (id) { return context.__elements[id].innerHTML || ""; }).join("\n");
  ["最低偿债率", "下次计划发薪", "未来30天", "本金", "浮动盈亏", "财富归因", "资金池执行", "应急金"].forEach(function (label) { assert.ok(html.includes(label), label); });
  assert.match(html, /最低偿债率[\s\S]*6\.7%/);
  assert.match(html, /下次计划发薪[\s\S]*09\.09 · ¥6,942\.75/);
  assert.match(context.__elements.dashboardRightCards.innerHTML, /未来30天已知流出/);
  assert.match(context.__elements.dashboardRightCards.innerHTML, /¥546\.80/);
  assert.match(context.__elements.dashboardBottomStrip.innerHTML, /计划分配/);
  assert.match(context.__elements.dashboardBottomStrip.innerHTML, /实际分配/);
  assert.match(context.__elements.dashboardBottomStrip.innerHTML, /偏差 -¥328\.35/);
  assert.doesNotMatch(html, /NaN|undefined|\[object Object\]/);
});

test("bottom strip exposes the six stage 8.2 semantic blocks", function () {
  var context = createContext();
  context.__elements.currentMonth.value = "2026-05";
  context.dashboardInvestmentMetric = function () { return { value: "+¥50.00", context: "本月损益", className: "positive" }; };
  context.renderDashboardBottomStrip(
    { income: 1000, expense: 300, netCashFlow: 700, freeCash: 700 },
    { roi: 5, performanceAsset: 1050 },
    { hasBaseline: true, change: 750 },
    { cashflowContribution: 700, investmentPnl: 50, liabilityChange: 0, otherChange: 0, unexplained: 0 },
    { name: "应急金", current: 800, target: 1000, remaining: 200, progress: 80 }
  );
  var html = context.__elements.dashboardBottomStrip.innerHTML;
  assert.strictEqual((html.match(/<article\b/g) || []).length, 6);
  ["现金流总览", "收支结构", "投资回报", "财富归因", "资金池执行", "本月一句话"].forEach(function (label) { assert.ok(html.includes(label), label); });
  assert.match(html, /本金/);
  assert.match(html, /浮动盈亏/);
  assert.match(html, /收支贡献 \+¥700\.00/);
  assert.match(html, /稳住节奏/);
  assert.match(html, /慢就是快，复利是时间给耐心者的奖赏。/);
  assert.doesNotMatch(html, /本月平稳/);
  assert.doesNotMatch(html, /暂无显著变化/);
  assert.doesNotMatch(html, /资产概览/);
});

test("monthly quote keeps its own static copy instead of factual insights", function () {
  var context = createContext();
  context.__elements.currentMonth.value = "2026-05";
  context.dashboardInvestmentMetric = function () { return { value: "—", context: "数据不足", className: "warning" }; };
  context.renderDashboardBottomStrip(
    { income: 800, expense: 1000, netCashFlow: -200, freeCash: -200 },
    { roi: null, performanceAsset: 0 },
    { hasBaseline: false, change: null },
    { cashflowContribution: 0, investmentPnl: 0, liabilityChange: 0, otherChange: 0, unexplained: 0 },
    null
  );
  var html = context.__elements.dashboardBottomStrip.innerHTML;
  assert.match(html, /本月一句话/);
  assert.match(html, /稳住节奏/);
  assert.match(html, /先守住现金流，再谈进攻。/);
  assert.doesNotMatch(html, /本月平稳/);
  assert.doesNotMatch(html, /暂无显著变化/);
});

test("left asset metrics label pending allocation by its real semantics", function () {
  var context = createContext();
  context.renderDashboardAssetCard(
    "2026-08",
    { freeCash: 456 },
    { score: 82, className: "positive" },
    1500,
    { financialAssets: 1200, liabilities: 300, netWorth: 1500 },
    { hasBaseline: true, change: 100 },
    400
  );
  var html = context.__elements.dashboardAssetMetrics.innerHTML;
  assert.match(html, /本月待分配/);
  assert.match(html, /¥456\.00/);
  assert.match(html, /收入减支出减投入/);
  assert.doesNotMatch(html, /可动用资金/);
});

test("first-use dashboard separates unknown values and renders an actionable guide", function () {
  var context = createContext();
  context.__elements.currentMonth.value = "2026-08";
  context.state = context.normalizeState(null);
  context.renderDashboard(context.buildRenderContext("2026-08"));
  assert.match(context.__elements.dashboardAssetHealth.textContent, /待评估/);
  assert.strictEqual(context.__elements.dashboardTotalAsset.textContent, "待建账");
  assert.match(context.__elements.dashboardAssetMetrics.innerHTML, /待记录/);
  assert.match(context.__elements.dashboardRightCards.innerHTML, /先建立三条真实基线/);
  assert.match(context.__elements.dashboardRightCards.innerHTML, /去建账户/);
  assert.doesNotMatch(context.__elements.wealthCompassNodes.innerHTML, /本月平稳|0项/);
  assert.doesNotMatch(context.__elements.dashboardBottomStatus.innerHTML, /账目结构正常|本地可用/);
});

test("fallback backup copy never claims an unverifiable browser download succeeded", function () {
  var context = createContext();
  var message = context.backupResultMessage({ ok: true, verified: false, bytes: 2048 });
  assert.match(message, /已发起浏览器下载/);
  assert.match(message, /下载列表确认/);
  assert.doesNotMatch(message, /备份已成功|备份已保存/);
});

test("backup access and existing page navigation remain available outside the dashboard core", function () {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok((html.match(/data-action="open-view" data-view="data"/g) || []).length >= 2);
  assert.match(html, /id="data" class="view"/);
  ["flow", "investments", "goals", "assets", "accounts"].forEach(function (view) {
    assert.match(html, new RegExp("id=\"" + view + "\" class=\"view\""), view);
  });
});

testChain.then(function () {}, function () {});
