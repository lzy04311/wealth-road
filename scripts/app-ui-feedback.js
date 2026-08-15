"use strict";

var statusNoticeTimer = null;
var actionFeedbackTimer = null;
var actionFeedbackHandler = null;

function updateSaveStatusUI() {
  var text = savedTimeText(lastSavedAt);
  var topEl = byId("saveStatusText");
  var dataEl = byId("dataLastSavedText");
  if (topEl) topEl.textContent = "已保存";
  if (dataEl) dataEl.textContent = text;
}

function notify(message) {
  var topEl = byId("saveStatusText");
  if (!topEl) return;
  topEl.textContent = cleanText(message, 80) || "已保存";
  if (statusNoticeTimer) clearTimeout(statusNoticeTimer);
  statusNoticeTimer = setTimeout(function () {
    topEl.textContent = "已保存";
    statusNoticeTimer = null;
  }, 2600);
}

function dismissActionFeedback() {
  var bar = byId("actionFeedback");
  if (actionFeedbackTimer) clearTimeout(actionFeedbackTimer);
  actionFeedbackTimer = null;
  actionFeedbackHandler = null;
  if (!bar) return;
  bar.classList.remove("open");
  bar.setAttribute("aria-hidden", "true");
}

function showActionFeedback(message, actionLabel, actionHandler, duration) {
  var bar = byId("actionFeedback");
  var textEl = byId("actionFeedbackText");
  var actionBtn = byId("actionFeedbackButton");
  if (!bar || !textEl || !actionBtn) { notify(message); return; }
  if (actionFeedbackTimer) clearTimeout(actionFeedbackTimer);
  textEl.textContent = cleanText(message, 140) || "操作已完成";
  actionFeedbackHandler = typeof actionHandler === "function" ? actionHandler : null;
  actionBtn.textContent = cleanText(actionLabel, 20) || "";
  actionBtn.style.display = actionFeedbackHandler ? "" : "none";
  bar.classList.add("open");
  bar.setAttribute("aria-hidden", "false");
  actionFeedbackTimer = setTimeout(dismissActionFeedback, duration || (actionFeedbackHandler ? 6500 : 3600));
}

function runActionFeedback() {
  var handler = actionFeedbackHandler;
  dismissActionFeedback();
  if (handler) handler();
}
