"use strict";

function downloadStateBackup(payload, fileName) {
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportData() {
  downloadStateBackup(state, "caiji-backup_" + backupTimestamp() + ".json");
  notify("已导出备份文件");
}

function importData() {
  var file = byId("importFile").files[0];
  if (!file) {
    notify("请先选择 JSON 文件");
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    notify("导入失败：备份文件超过 1MB，请确认文件是否正确。");
    return;
  }

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

    downloadStateBackup(state, "caiji-backup-before-import_" + backupTimestamp() + ".json");
    appConfirm("确认导入", "系统已先导出当前数据作为安全备份。\n\n" + prepared.summary + "\n\n确认继续导入并覆盖当前本地数据吗？", "继续导入", "取消").then(function (confirmed) {
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
    downloadStateBackup(state, "caiji-backup-before-restore_" + backupTimestamp() + ".json");
    appConfirm("从自动备份恢复", "系统已先导出当前数据作为安全备份。\n\n将用 " + String(backup.savedAt || "").replace("T", " ").slice(0, 19) + " 的自动备份覆盖当前本地数据，确认继续？", "恢复", "取消").then(function (confirmed) {
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
