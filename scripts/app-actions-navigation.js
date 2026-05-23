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
