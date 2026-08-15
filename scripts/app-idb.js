"use strict";

// 财记 IndexedDB 持久层
// 职责：自动版本化备份 + 操作审计日志，作为 localStorage 之外的持久化安全网。
// 主存储仍保留 localStorage（同步契约不变），本文件只提供异步冗余与审计能力。
// 无 IndexedDB 环境（Node 测试、旧浏览器）时所有入口安全降级为 no-op。

var IDB_NAME = "caiji-store";
var IDB_VERSION = 1;
var IDB_BACKUP_STORE = "state_backups";
var IDB_AUDIT_STORE = "audit_log";
var IDB_MAX_BACKUPS = 30;
var IDB_BACKUP_DEBOUNCE_MS = 400;

var idbConnection = null;
var idbBackupTimer = null;

function idbAvailable() {
  return typeof indexedDB !== "undefined";
}

function idbOpen() {
  if (!idbAvailable()) return Promise.resolve(null);
  if (idbConnection) return Promise.resolve(idbConnection);
  return new Promise(function (resolve) {
    var request;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (err) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(IDB_BACKUP_STORE)) {
        db.createObjectStore(IDB_BACKUP_STORE, { keyPath: "savedAt" });
      }
      if (!db.objectStoreNames.contains(IDB_AUDIT_STORE)) {
        db.createObjectStore(IDB_AUDIT_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = function () {
      idbConnection = request.result;
      resolve(idbConnection);
    };
    request.onerror = function () { resolve(null); };
    request.onblocked = function () { resolve(null); };
  });
}

function idbRequestToPromise(request) {
  return new Promise(function (resolve, reject) {
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error || new Error("indexedDB request failed")); };
  });
}

function idbTxToPromise(tx) {
  return new Promise(function (resolve, reject) {
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error || new Error("indexedDB transaction failed")); };
    tx.onabort = function () { reject(tx.error || new Error("indexedDB transaction aborted")); };
  });
}

// 纯函数：把备份列表按 savedAt 降序，返回保留与待删除两组，便于单元测试。
function idbCropList(list, max) {
  var rows = (list || []).slice().sort(function (a, b) {
    return String(b.savedAt).localeCompare(String(a.savedAt));
  });
  return { keep: rows.slice(0, max), remove: rows.slice(max) };
}

function idbWriteBackup(db, stateSnapshot, savedAt) {
  if (!db) return Promise.resolve(false);
  try {
    var stamp = savedAt || new Date().toISOString();
    var tx = db.transaction(IDB_BACKUP_STORE, "readwrite");
    var store = tx.objectStore(IDB_BACKUP_STORE);
    store.put({
      savedAt: stamp,
      schemaVersion: typeof CURRENT_SCHEMA_VERSION !== "undefined" ? CURRENT_SCHEMA_VERSION : null,
      state: JSON.parse(JSON.stringify(stateSnapshot))
    });
    return idbTxToPromise(tx).then(function () {
      return idbListBackups(db).then(function (rows) {
        var plan = idbCropList(rows, IDB_MAX_BACKUPS);
        if (!plan.remove.length) return true;
        var cropTx = db.transaction(IDB_BACKUP_STORE, "readwrite");
        var cropStore = cropTx.objectStore(IDB_BACKUP_STORE);
        plan.remove.forEach(function (item) { cropStore.delete(item.savedAt); });
        return idbTxToPromise(cropTx).then(function () { return true; });
      });
    });
  } catch (err) {
    return Promise.resolve(false);
  }
}

function idbListBackups(db) {
  if (!db) return Promise.resolve([]);
  try {
    var tx = db.transaction(IDB_BACKUP_STORE, "readonly");
    var store = tx.objectStore(IDB_BACKUP_STORE);
    return idbRequestToPromise(store.getAll()).then(function (rows) {
      return (rows || []).slice().sort(function (a, b) {
        return String(b.savedAt).localeCompare(String(a.savedAt));
      });
    }).catch(function () { return []; });
  } catch (err) {
    return Promise.resolve([]);
  }
}

function idbReadLatestBackup() {
  return idbOpen().then(function (db) {
    if (!db) return null;
    return idbListBackups(db).then(function (rows) { return rows[0] || null; });
  });
}

function idbWriteAudit(db, entry) {
  if (!db) return Promise.resolve(false);
  try {
    var tx = db.transaction(IDB_AUDIT_STORE, "readwrite");
    var store = tx.objectStore(IDB_AUDIT_STORE);
    store.add(Object.assign({ at: new Date().toISOString() }, entry || {}));
    return idbTxToPromise(tx).then(function () { return true; });
  } catch (err) {
    return Promise.resolve(false);
  }
}

function idbReadAudit(limit) {
  return idbOpen().then(function (db) {
    if (!db) return [];
    try {
      var tx = db.transaction(IDB_AUDIT_STORE, "readonly");
      var store = tx.objectStore(IDB_AUDIT_STORE);
      return idbRequestToPromise(store.getAll()).then(function (rows) {
        return (rows || []).slice().sort(function (a, b) {
          return String(b.at).localeCompare(String(a.at));
        }).slice(0, limit || 50);
      }).catch(function () { return []; });
    } catch (err) {
      return Promise.resolve([]);
    }
  });
}

// 自动备份：防抖后异步把当前 state 快照写入 IndexedDB，合并连续保存。
function scheduleIdbBackup() {
  if (!idbAvailable()) return;
  if (idbBackupTimer) return;
  idbBackupTimer = setTimeout(function () {
    idbBackupTimer = null;
    if (typeof state === "undefined" || !state) return;
    idbOpen().then(function (db) {
      if (!db) return;
      return idbWriteBackup(db, state);
    }).catch(function () {});
  }, IDB_BACKUP_DEBOUNCE_MS);
}

// 审计入口：fire-and-forget 写入一条操作记录，不影响调用方同步流程。
function auditLog(entry) {
  if (!idbAvailable()) return;
  idbOpen().then(function (db) {
    if (!db) return;
    return idbWriteAudit(db, entry);
  }).catch(function () {});
}

// 渲染 Data 页的自动备份与操作审计面板，由 renderAll 异步调用。
function renderIdbPanel() {
  var statusEl = byId("idbBackupStatus");
  var latestEl = byId("idbBackupLatest");
  var restoreBtn = byId("idbRestoreLatest");
  var auditEl = byId("idbAuditList");
  if (!statusEl && !latestEl && !restoreBtn && !auditEl) return;
  function emptyHtml(title, desc) {
    return "<div class=\"empty empty-card\"><div class=\"empty-title\">" + esc(title) + "</div><div class=\"empty-desc\">" + esc(desc) + "</div></div>";
  }
  if (!idbAvailable()) {
    if (statusEl) statusEl.textContent = "当前浏览器不支持 IndexedDB，自动备份不可用";
    if (latestEl) latestEl.textContent = "--";
    if (restoreBtn) restoreBtn.disabled = true;
    if (auditEl) auditEl.innerHTML = emptyHtml("当前环境不支持自动备份", "请使用手动 JSON 导出作为备份");
    return;
  }
  idbOpen().then(function (db) {
    if (!db) {
      if (statusEl) statusEl.textContent = "自动备份暂不可用";
      if (restoreBtn) restoreBtn.disabled = true;
      if (auditEl) auditEl.innerHTML = emptyHtml("自动备份暂不可用", "请使用手动 JSON 导出作为备份");
      return;
    }
    idbListBackups(db).then(function (rows) {
      if (statusEl) statusEl.textContent = "已保存 " + rows.length + " 份自动备份，最多保留 " + IDB_MAX_BACKUPS + " 份";
      if (latestEl) latestEl.textContent = rows.length ? String(rows[0].savedAt).replace("T", " ").slice(0, 19) : "尚无备份";
      if (restoreBtn) restoreBtn.disabled = rows.length === 0;
    }).catch(function () {
      if (statusEl) statusEl.textContent = "读取自动备份失败";
      if (restoreBtn) restoreBtn.disabled = true;
    });
    idbReadAudit(50).then(function (entries) {
      if (!auditEl) return;
      if (!entries.length) {
        auditEl.innerHTML = emptyHtml("还没有操作记录", "保存、删除、导入等操作会记录在这里");
        return;
      }
      var opLabel = { create: "新增", update: "更新", delete: "删除", link_money_account: "补齐账户", import: "导入", archive: "归档", restore: "恢复备份", cloud_pull: "云同步覆盖" };
      var auditable = { incomes: 1, expenses: 1, investments: 1, transfers: 1, snapshots: 1, accounts: 1, moneyAccounts: 1, reconciliations: 1, allocations: 1, assetItems: 1, liabilities: 1 };
      auditEl.innerHTML = entries.map(function (entry) {
        var viewBtn = auditable[entry.collection] && entry.entityId ? "<button class=\"btn small ghost\" type=\"button\" data-action=\"audit-open\" data-collection=\"" + esc(entry.collection) + "\" data-id=\"" + esc(entry.entityId) + "\">查看</button>" : "";
        return "<div class=\"idb-audit-row\"><div class=\"row-title\"><span>" + esc((opLabel[entry.operation] || entry.operation || "操作")) + " · " + esc(entry.summary || "") + "</span><span class=\"badge\">" + esc(entry.collection || "") + "</span></div><div class=\"row-meta\">" + esc(String(entry.at || "").replace("T", " ").slice(0, 19)) + "</div>" + (viewBtn ? "<div class=\"row-actions\">" + viewBtn + "</div>" : "") + "</div>";
      }).join("");
    }).catch(function () {
      if (auditEl) auditEl.innerHTML = emptyHtml("读取操作记录失败", "请稍后重试");
    });
  }).catch(function () {
    if (statusEl) statusEl.textContent = "自动备份不可用";
    if (restoreBtn) restoreBtn.disabled = true;
  });
}
