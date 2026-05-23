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

test("activateView switches between home and module page modes", function () {
  var context = createContext();
  context.activateView("flow");
  assert.strictEqual(context.document.body.classList.contains("module-page-mode"), true);
  assert.strictEqual(context.document.body.classList.contains("dashboard-home-mode"), false);
  context.activateView("dashboard");
  assert.strictEqual(context.document.body.classList.contains("dashboard-home-mode"), true);
  assert.strictEqual(context.document.body.classList.contains("module-page-mode"), false);
});

testChain.then(function () {}, function () {});
