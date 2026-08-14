"use strict";

function setDashboardHomeMode(viewName) {
  document.body.classList.toggle("dashboard-home-mode", viewName === "dashboard");
  document.body.classList.toggle("module-page-mode", viewName !== "dashboard");
  document.querySelectorAll(".dashboard-bottom-nav [data-view]").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
}
function activateView(viewName) {
  if (!viewName || !byId(viewName)) return false;
  document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
  document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
  var targetTab = document.querySelector(".tab[data-view=\"" + viewName + "\"]");
  if (targetTab) targetTab.classList.add("active");
  byId(viewName).classList.add("active");
  setDashboardHomeMode(viewName);
  if (viewName === "dashboard") window.scrollTo(0, 0);
  else window.scrollTo(0, 0);
  return true;
}
function shiftCurrentMonth(delta) {
  var parts = currentMonth().split("-");
  var currentDateValue = byId("dashboardDate").value || today();
  var currentDay = parseInt(currentDateValue.slice(8, 10), 10) || 1;
  var target = new Date(Number(parts[0]), Number(parts[1]) - 1 + Number(delta || 0), 1);
  var daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  var month = target.getFullYear() + "-" + String(target.getMonth() + 1).padStart(2, "0");
  byId("currentMonth").value = month;
  byId("dashboardDate").value = month + "-" + String(Math.min(currentDay, daysInTarget)).padStart(2, "0");
  selectedExpenseDate = "";
  renderTodayWidget();
  renderAll();
}
function handleViewSwitchClick(event) {
  var backHomeBtn = event.target.closest("[data-action=\"back-home\"]");
  if (backHomeBtn) {
    activateView("dashboard");
    return true;
  }
  var tab = event.target.closest(".tab");
  if (tab) {
    activateView(tab.dataset.view);
    return true;
  }
  var openViewBtn = event.target.closest("[data-action=\"open-view\"]");
  if (!openViewBtn) return false;
  var targetView = openViewBtn.dataset.view;
  activateView(targetView);
  return true;
}
