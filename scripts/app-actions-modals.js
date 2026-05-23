"use strict";

var activeDialogResolver = null;
var activeDialogKind = "";

function resolveActiveDialog(payload) {
  if (!activeDialogResolver) return;
  var resolver = activeDialogResolver;
  activeDialogResolver = null;
  activeDialogKind = "";
  resolver(payload);
}

function openSnapshotRecords() { var modal = byId("snapshotRecordsModal"); if (!modal) return; renderAssets(); modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); }
function closeSnapshotRecords() { var modal = byId("snapshotRecordsModal"); if (!modal) return; modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }

function closeHealthModal(reason) {
  var modal = byId("healthModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (reason === "dismiss") {
    if (activeDialogKind === "confirm") resolveActiveDialog(false);
    else if (activeDialogKind === "alert") resolveActiveDialog();
  }
}

function openHealthModal(contentHtml) {
  var modal = byId("healthModal");
  var body = byId("healthModalBody");
  if (!modal || !body) return;
  body.innerHTML = contentHtml;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function appAlert(title, message, buttonText) {
  if (activeDialogResolver) resolveActiveDialog();
  return new Promise(function (resolve) {
    activeDialogResolver = resolve;
    activeDialogKind = "alert";
    openHealthModal(
      "<h3>" + esc(title || "提示") + "</h3>"
      + "<p>" + esc(message || "") + "</p>"
      + "<div class=\"actions\"><button type=\"button\" class=\"btn primary\" data-dialog-action=\"ok\">" + esc(buttonText || "知道了") + "</button></div>"
    );
    var body = byId("healthModalBody");
    if (!body) { resolveActiveDialog(); return; }
    var btn = body.querySelector("[data-dialog-action=\"ok\"]");
    if (!btn) { resolveActiveDialog(); return; }
    btn.addEventListener("click", function () {
      closeHealthModal();
      resolveActiveDialog();
    }, { once: true });
  });
}

function appConfirm(title, message, okText, cancelText) {
  if (activeDialogResolver) resolveActiveDialog(false);
  return new Promise(function (resolve) {
    activeDialogResolver = resolve;
    activeDialogKind = "confirm";
    openHealthModal(
      "<h3>" + esc(title || "请确认") + "</h3>"
      + "<p>" + esc(message || "") + "</p>"
      + "<div class=\"actions\">"
      + "<button type=\"button\" class=\"btn ghost\" data-dialog-action=\"cancel\">" + esc(cancelText || "取消") + "</button>"
      + "<button type=\"button\" class=\"btn primary\" data-dialog-action=\"ok\">" + esc(okText || "确认") + "</button>"
      + "</div>"
    );
    var body = byId("healthModalBody");
    if (!body) { resolveActiveDialog(false); return; }
    var okBtn = body.querySelector("[data-dialog-action=\"ok\"]");
    var cancelBtn = body.querySelector("[data-dialog-action=\"cancel\"]");
    if (!okBtn || !cancelBtn) { resolveActiveDialog(false); return; }
    okBtn.addEventListener("click", function () {
      closeHealthModal();
      resolveActiveDialog(true);
    }, { once: true });
    cancelBtn.addEventListener("click", function () {
      closeHealthModal();
      resolveActiveDialog(false);
    }, { once: true });
  });
}

function handleHealthDetailClick(event) {
  var healthDetail = event.target.closest("[data-health-detail]");
  if (!healthDetail) return false;
  var type = healthDetail.dataset.healthDetail;
  if (type === "score") {
    openHealthModal("<h3>评分规则</h3><p>基准 <b>72</b> 分</p><p>未填计划收入 <b>-18</b>｜工资到账 <b>+8</b> / 逾期 <b>-12</b></p><p>超支 <b>-18</b>｜支出&lt;55% <b>+6</b></p><p>负结余 <b>-16</b> / 正结余 <b>+8</b></p><p>无快照 <b>-8</b>｜回撤 <b>-8</b> / 增长 <b>+4</b></p>");
  } else {
    openHealthModal("<h3>风险等级</h3><p>≥82 <b>低风险</b></p><p>≥64 <b>可控</b></p><p>≥45 <b>需关注</b></p><p>&lt;45 <b>高风险</b></p>");
  }
  return true;
}
