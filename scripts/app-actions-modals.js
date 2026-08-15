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

function healthScoreDelta(value) {
  return value > 0 ? "+" + value : String(value);
}

function healthScoreRulesHtml() {
  var model = FINANCIAL_HEALTH_MODEL;
  var adjustments = model.adjustments;
  return "<h3>" + esc(model.label) + " · 评分规则</h3>"
    + "<p>模型版本 <b>v" + esc(model.version) + "</b>｜基准 <b>" + esc(model.baseScore) + "</b> 分</p>"
    + "<p>未填计划收入 <b>" + esc(healthScoreDelta(adjustments.missingPlannedIncome)) + "</b>｜收入达到计划的 " + esc(model.salaryReceivedRatio * 100) + "% <b>" + esc(healthScoreDelta(adjustments.salaryReceived)) + "</b> / 发薪日后 " + esc(model.salaryGraceDays) + " 天仍未达到 <b>" + esc(healthScoreDelta(adjustments.salaryLate)) + "</b></p>"
    + "<p>消费预算超支 <b>" + esc(healthScoreDelta(adjustments.overBudget)) + "</b>｜预算使用低于 " + esc(model.lowSpendingRatio * 100) + "% <b>" + esc(healthScoreDelta(adjustments.lowSpending)) + "</b></p>"
    + "<p>月度自由现金为负 <b>" + esc(healthScoreDelta(adjustments.negativeFreeCash)) + "</b> / 为正 <b>" + esc(healthScoreDelta(adjustments.positiveFreeCash)) + "</b></p>"
    + "<p>资产判断基线不完整 <b>" + esc(healthScoreDelta(adjustments.incompleteAssetBaseline)) + "</b></p>"
    + "<p>这是预算与现金流执行提示，不是综合投资或偿债风险评级。</p>";
}

function healthLevelRulesHtml() {
  var thresholds = FINANCIAL_HEALTH_MODEL.thresholds;
  return "<h3>月度执行状态</h3>"
    + "<p>≥" + esc(thresholds.stable) + " <b>稳定</b></p>"
    + "<p>≥" + esc(thresholds.controlled) + " <b>可控</b></p>"
    + "<p>≥" + esc(thresholds.attention) + " <b>需关注</b></p>"
    + "<p>&lt;" + esc(thresholds.attention) + " <b>高压力</b></p>";
}

function handleHealthDetailClick(event) {
  var healthDetail = event.target.closest("[data-health-detail]");
  if (!healthDetail) return false;
  var type = healthDetail.dataset.healthDetail;
  if (type === "score") {
    openHealthModal(healthScoreRulesHtml());
  } else {
    openHealthModal(healthLevelRulesHtml());
  }
  return true;
}
