"use strict";

function openSnapshotRecords() { var modal = byId("snapshotRecordsModal"); if (!modal) return; renderAssets(); modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); }
function closeSnapshotRecords() { var modal = byId("snapshotRecordsModal"); if (!modal) return; modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
function handleHealthDetailClick(event) {
  var healthDetail = event.target.closest("[data-health-detail]");
  if (!healthDetail) return false;
  var type = healthDetail.dataset.healthDetail, modal = byId("healthModal"), body = byId("healthModalBody");
  if (!modal || !body) return true;
  if (type === "score") {
    body.innerHTML = "<h3>评分规则</h3><p>基准 <b>72</b> 分</p><p>未填计划收入 <b>-18</b>｜工资到账 <b>+8</b> / 逾期 <b>-12</b></p><p>超支 <b>-18</b>｜支出&lt;55% <b>+6</b></p><p>负结余 <b>-16</b> / 正结余 <b>+8</b></p><p>无快照 <b>-8</b>｜回撤 <b>-8</b> / 增长 <b>+4</b></p>";
  } else {
    body.innerHTML = "<h3>风险等级</h3><p>≥82 <b>低风险</b></p><p>≥64 <b>可控</b></p><p>≥45 <b>需关注</b></p><p>&lt;45 <b>高风险</b></p>";
  }
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  return true;
}
