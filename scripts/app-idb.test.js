"use strict";

// Run with:
// node scripts/app-idb.test.js

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

// 内存版 IndexedDB：覆盖 app-idb.js 用到的 open / createObjectStore / transaction /
// objectStore 的 put / add / getAll / delete。request 与 transaction 均在下一宏任务结算。
var FAKE_IDB_SRC = [
  "(function () {",
  "  function request(result) {",
  "    var r = { result: result, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };",
  "    setTimeout(function () { if (r.onsuccess) r.onsuccess({ target: r }); }, 0);",
  "    return r;",
  "  }",
  "  function Store(name, options) {",
  "    this.name = name;",
  "    this.keyPath = options ? options.keyPath : null;",
  "    this.autoIncrement = !!(options && options.autoIncrement);",
  "    this.map = new Map();",
  "    this.next = 1;",
  "  }",
  "  Store.prototype.put = function (value) {",
  "    var key = this.keyPath ? value[this.keyPath] : null;",
  "    this.map.set(key, JSON.parse(JSON.stringify(value)));",
  "    return request(key);",
  "  };",
  "  Store.prototype.add = function (value) {",
  "    var key = this.keyPath ? value[this.keyPath] : null;",
  "    if (this.autoIncrement && (key == null)) { key = this.next++; if (this.keyPath) value[this.keyPath] = key; }",
  "    this.map.set(key, JSON.parse(JSON.stringify(value)));",
  "    return request(key);",
  "  };",
  "  Store.prototype.getAll = function () {",
  "    return request(Array.from(this.map.values()).map(function (v) { return JSON.parse(JSON.stringify(v)); }));",
  "  };",
  "  Store.prototype.delete = function (key) {",
  "    this.map.delete(key);",
  "    return request(undefined);",
  "  };",
  "  function transaction(stores) {",
  "    var t = { oncomplete: null, onerror: null, onabort: null, error: null, objectStore: function (name) { return stores[name]; } };",
  "    setTimeout(function () { if (t.oncomplete) t.oncomplete({ target: t }); }, 0);",
  "    return t;",
  "  }",
  "  function database() {",
  "    var self = {",
  "      stores: {},",
  "      objectStoreNames: { contains: function (name) { return Object.prototype.hasOwnProperty.call(self.stores, name); } },",
  "      createObjectStore: function (name, options) { self.stores[name] = new Store(name, options); return self.stores[name]; },",
  "      transaction: function (name, mode) { return transaction(self.stores); }",
  "    };",
  "    return self;",
  "  }",
  "  var db = database();",
  "  return { open: function () {",
  "    var r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };",
  "    setTimeout(function () {",
  "      if (r.onupgradeneeded) r.onupgradeneeded({ target: r });",
  "      if (r.onsuccess) r.onsuccess({ target: r });",
  "    }, 0);",
  "    return r;",
  "  } };",
  "})()"
].join("\n");

function createContext(withIdb) {
  var context = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "app-state.js"), "utf8"), context);
  if (withIdb) {
    vm.runInContext("indexedDB = " + FAKE_IDB_SRC + ";", context);
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, "app-idb.js"), "utf8"), context);
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

test("degrades safely without IndexedDB", function () {
  var context = createContext(false);
  assert.strictEqual(context.idbAvailable(), false);
  assert.doesNotThrow(function () {
    context.scheduleIdbBackup();
    context.auditLog({ operation: "create", collection: "incomes" });
  });
  return context.idbOpen().then(function (db) {
    assert.strictEqual(db, null);
    return context.idbReadLatestBackup();
  }).then(function (backup) {
    assert.strictEqual(backup, null);
  });
});

test("writes and reads the latest state backup", function () {
  var context = createContext(true);
  context.state = { rules: "v1", accounts: [] };
  return context.idbOpen().then(function (db) {
    assert.ok(db, "db should open");
    return context.idbWriteBackup(db, { rules: "v1" }, "2026-08-15T00:00:00.000Z");
  }).then(function (ok) {
    assert.strictEqual(ok, true);
    return context.idbReadLatestBackup();
  }).then(function (backup) {
    assert.ok(backup, "backup should exist");
    assert.strictEqual(backup.state.rules, "v1");
    assert.strictEqual(backup.schemaVersion, 5);
  });
});

test("keeps only the newest backup limit", function () {
  var context = createContext(true);
  return context.idbOpen().then(function (db) {
    var chain = Promise.resolve();
    for (var i = 0; i < 35; i++) {
      chain = chain.then(function (i) {
        var stamp = "2026-08-15T00:00:" + String(i).padStart(2, "0") + ".000Z";
        return context.idbWriteBackup(db, { rules: "r" + i }, stamp);
      }.bind(null, i));
    }
    return chain.then(function () { return context.idbListBackups(db); });
  }).then(function (rows) {
    assert.strictEqual(rows.length, 30);
    assert.strictEqual(rows[0].state.rules, "r34");
    assert.strictEqual(rows[rows.length - 1].state.rules, "r5");
  });
});

test("crop helper keeps newest rows in order", function () {
  var context = createContext(false);
  var plan = context.idbCropList([
    { savedAt: "2026-08-15T00:00:03.000Z", state: "c" },
    { savedAt: "2026-08-15T00:00:01.000Z", state: "a" },
    { savedAt: "2026-08-15T00:00:02.000Z", state: "b" }
  ], 2);
  assert.strictEqual(plan.keep.length, 2);
  assert.strictEqual(plan.keep[0].state, "c");
  assert.strictEqual(plan.keep[1].state, "b");
  assert.strictEqual(plan.remove.length, 1);
  assert.strictEqual(plan.remove[0].state, "a");
});

test("appends and reads audit log entries", function () {
  var context = createContext(true);
  return context.idbOpen().then(function (db) {
    return context.idbWriteAudit(db, { operation: "create", collection: "incomes", entityId: "i1", summary: "收入 100" });
  }).then(function (ok) {
    assert.strictEqual(ok, true);
    return context.idbReadAudit(50);
  }).then(function (rows) {
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].operation, "create");
    assert.strictEqual(rows[0].collection, "incomes");
    assert.strictEqual(rows[0].entityId, "i1");
    assert.ok(rows[0].at, "audit entry should have a timestamp");
  });
});

testChain.then(function () {}, function () {});
