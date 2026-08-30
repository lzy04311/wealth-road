"use strict";

function serializeStateBackup(payload) {
  return JSON.stringify(payload, null, 2);
}

function backupTextBytes(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(String(text)).length;
  if (typeof Blob !== "undefined") return new Blob([String(text)]).size;
  return unescape(encodeURIComponent(String(text))).length;
}

function downloadStateBackup(payload, fileName, serializedText) {
  var text = serializedText == null ? serializeStateBackup(payload) : String(serializedText);
  var blob = new Blob([text], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  return { ok: true, verified: false, bytes: blob.size, fileName: fileName };
}

function saveStateBackup(payload, fileName) {
  var text;
  try { text = serializeStateBackup(payload); }
  catch (err) { return Promise.resolve({ ok: false, verified: false, error: "备份序列化失败" }); }
  var bytes = backupTextBytes(text);
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    return window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "财记 JSON 备份", accept: { "application/json": [".json"] } }]
    }).then(function (handle) {
      return handle.createWritable().then(function (writable) {
        return writable.write(text).then(function () { return writable.close(); });
      });
    }).then(function () {
      return { ok: true, verified: true, bytes: bytes, fileName: fileName };
    }).catch(function (err) {
      if (err && err.name === "AbortError") return { ok: false, canceled: true, verified: false, bytes: bytes, fileName: fileName };
      try { return downloadStateBackup(payload, fileName, text); }
      catch (fallbackErr) { return { ok: false, verified: false, bytes: bytes, fileName: fileName, error: String(fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr) }; }
    });
  }
  try { return Promise.resolve(downloadStateBackup(payload, fileName, text)); }
  catch (err) { return Promise.resolve({ ok: false, verified: false, bytes: bytes, fileName: fileName, error: String(err && err.message ? err.message : err) }); }
}

function backupResultMessage(result) {
  if (!result || !result.ok) return result && result.canceled ? "已取消保存备份" : "备份下载未能启动，请检查浏览器下载权限";
  var size = storageByteText(result.bytes);
  if (result.verified) return "备份已写入并关闭文件（" + size + "）";
  return "已发起浏览器下载（" + size + "），请在下载列表确认文件已保存";
}

function exportData() {
  return saveStateBackup(state, "caiji-backup_" + backupTimestamp() + ".json").then(function (result) {
    notify(backupResultMessage(result));
    return result;
  });
}

function createSafetyCheckpoint(snapshot, prefix) {
  var fileName = prefix + backupTimestamp() + ".json";
  var downloadResult;
  try { downloadResult = downloadStateBackup(snapshot, fileName); }
  catch (err) { downloadResult = { ok: false, verified: false, error: String(err && err.message ? err.message : err) }; }
  var verifiedPromise = typeof idbCreateVerifiedBackup === "function" ? idbCreateVerifiedBackup(snapshot) : Promise.resolve(false);
  return verifiedPromise.then(function (verified) {
    if (verified && typeof refreshStorageHealth === "function") refreshStorageHealth();
    return { localVerified: !!verified, download: downloadResult };
  });
}

function importData() {
  var file = byId("importFile").files[0];
  if (!file) {
    notify("请先选择 JSON 文件");
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    notify("导入失败：备份文件超过 16MB，请确认文件是否正确。");
    return;
  }
  if (file.size > LARGE_BACKUP_WARNING_BYTES) notify("正在校验较大的备份文件，请稍候…");

  var reader = new FileReader();
  reader.onload = function () {
    var parsed;
    var prepared;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      notify("导入失败：JSON 文件格式不正确。");
      return;
    }

    prepared = prepareImportedState(parsed);
    if (!prepared.ok) {
      appAlert("导入失败", "这不是可用的本项目备份。\n\n" + prepared.errors.join("\n"), "关闭");
      return;
    }

    createSafetyCheckpoint(state, "caiji-backup-before-import_").then(function (checkpoint) {
      var checkpointText = checkpoint.localVerified
        ? "当前数据已写入 IndexedDB 并完成读回校验；同时已发起 JSON 下载，请在下载列表确认。"
        : "未能完成本机自动备份读回校验。已尝试发起 JSON 下载，请先确认下载列表中存在该文件。";
      return appConfirm("确认导入", checkpointText + "\n\n" + prepared.summary + "\n\n确认继续导入并覆盖当前本地数据吗？", "继续导入", "取消");
    }).then(function (confirmed) {
      if (!confirmed) return;
      var previous = state;
      state = prepared.state;
      if (save()) {
        renderAll();
        if (typeof auditLog === "function") auditLog({ operation: "import", collection: "state", entityId: "", summary: "导入备份 · " + (prepared.summary || "").split("\n")[0] });
        notify("导入完成");
      } else {
        state = previous;
        notify("导入失败：保存阶段未完成，已回滚。");
      }
    });
  };
  reader.readAsText(file, "UTF-8");
}

function restoreIdbBackup() {
  if (typeof idbReadLatestBackup !== "function") { notify("自动备份不可用"); return; }
  idbReadLatestBackup().then(function (backup) {
    if (!backup || !backup.state) { notify("没有可恢复的自动备份"); return; }
    var prepared = prepareImportedState(backup.state);
    if (!prepared.ok) {
      appAlert("恢复失败", "自动备份数据未通过校验：\n\n" + prepared.errors.join("\n"), "关闭");
      return;
    }
    createSafetyCheckpoint(state, "caiji-backup-before-restore_").then(function (checkpoint) {
      var checkpointText = checkpoint.localVerified ? "当前数据已形成并验证恢复前检查点。" : "恢复前检查点未能完成读回验证；请先确认浏览器下载列表中已有 JSON 备份。";
      return appConfirm("从自动备份恢复", checkpointText + "\n\n将用 " + String(backup.savedAt || "").replace("T", " ").slice(0, 19) + " 的自动备份覆盖当前本地数据，确认继续？", "恢复", "取消");
    }).then(function (confirmed) {
      if (!confirmed) return;
      var previous = state;
      state = prepared.state;
      if (save()) {
        renderAll();
        if (typeof auditLog === "function") auditLog({ operation: "restore", collection: "state", entityId: "", summary: "从自动备份恢复 · " + String(backup.savedAt || "").replace("T", " ").slice(0, 19) });
        notify("已从自动备份恢复");
      } else {
        state = previous;
        notify("恢复失败：保存阶段未完成，已回滚。");
      }
    });
  }).catch(function () {
    notify("读取自动备份失败");
  });
}
