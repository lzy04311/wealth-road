"use strict";

function downloadStateBackup(payload, fileName) { var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function exportData() { downloadStateBackup(state, "money-os-backup_" + backupTimestamp() + ".json"); }
function importData() {
  var file = byId("importFile").files[0];
  if (!file) { alert("请先选择 JSON 文件"); return; }
  if (file.size > MAX_IMPORT_BYTES) { alert("导入失败：备份文件超过 1MB，请确认文件是否正确。"); return; }
  var reader = new FileReader();
  reader.onload = function () {
    var parsed, prepared;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      alert("导入失败：JSON 文件格式不正确");
      return;
    }
    prepared = prepareImportedState(parsed);
    if (!prepared.ok) {
      alert("导入失败：这不是可用的本项目备份。\n\n" + prepared.errors.join("\n"));
      return;
    }
    downloadStateBackup(state, "money-os-backup-before-import_" + backupTimestamp() + ".json");
    if (!confirm("已准备导入备份文件。系统已先导出当前数据作为安全备份。\n\n" + prepared.summary + "\n\n确认继续导入并覆盖当前本地数据吗？")) return;
    var previous = state;
    state = prepared.state;
    if (save()) {
      renderAll();
      alert("导入完成");
    } else {
      state = previous;
    }
  };
  reader.readAsText(file, "UTF-8");
}
