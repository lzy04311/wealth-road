"use strict";

function setDashboardHomeMode(viewName) {
  document.body.classList.toggle("dashboard-home-mode", viewName === "dashboard");
  document.querySelectorAll(".dashboard-bottom-nav [data-view]").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
}
function handleViewSwitchClick(event) {
  var tab = event.target.closest(".tab");
  if (tab) {
    document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
    document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
    tab.classList.add("active");
    byId(tab.dataset.view).classList.add("active");
    setDashboardHomeMode(tab.dataset.view);
    return true;
  }
  var openViewBtn = event.target.closest("[data-action=\"open-view\"]");
  if (!openViewBtn) return false;
  var targetView = openViewBtn.dataset.view;
  if (!targetView || !byId(targetView)) return true;
  document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
  document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
  var targetTab = document.querySelector(".tab[data-view=\"" + targetView + "\"]");
  if (targetTab) targetTab.classList.add("active");
  byId(targetView).classList.add("active");
  setDashboardHomeMode(targetView);
  return true;
}
