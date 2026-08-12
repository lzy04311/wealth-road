function renderAssets() {
  var month = currentMonth(), summary = assetSnapshotSummary(month), list = state.snapshots.filter(function (x) { return x.month === month; });
  renderAssetInventory(wealthSummary(month));
  renderLiabilities();
  var fallbackTip = summary.fallbackAccounts.length ? ("｜估算账户：" + summary.fallbackAccounts.join("、") + "（该账户使用投入净额估算）") : "";
  if (byId("snapshotSummary")) byId("snapshotSummary").textContent = month + " 共 " + list.length + " 条更新记录" + fallbackTip;
  if (byId("snapshotList")) byId("snapshotList").innerHTML = list.length ? list.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (item) {
    var pnl = numberValue(item.marketValue) - numberValue(item.principal), roi = numberValue(item.principal) > 0 ? pnl / numberValue(item.principal) * 100 : null;
    return "<div class=\"record-card\"><div class=\"row-title\"><span>" + esc(accountName(item.accountId)) + "</span><span class=\"badge\">净值更新</span></div><div class=\"row-meta\">日期：" + esc(item.date) + "</div><div class=\"account-mini-grid\"><div class=\"account-mini\"><span>当前市值</span><strong>" + money(item.marketValue) + "</strong></div><div class=\"account-mini\"><span>累计本金</span><strong>" + money(item.principal) + "</strong></div><div class=\"account-mini\"><span>浮动盈亏</span><strong class=\"" + (pnl >= 0 ? "positive" : "negative") + "\">" + money(pnl) + "</strong></div><div class=\"account-mini\"><span>收益率</span><strong class=\"" + ((roi || 0) >= 0 ? "positive" : "negative") + "\">" + (roi == null ? "--" : roi.toFixed(2) + "%") + "</strong></div></div><div class=\"row-meta\">备注：" + esc(item.note || "无") + "</div><div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"snapshot\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"snapshot\" data-id=\"" + esc(item.id) + "\">删除</button></div></div>";
  }).join("") : empty("还没有净值更新。", "先记录一次当前资产，未来的变化才有坐标。", "", "📸");
}

function assetKindIcon(kind) {
  var map = { "现金": "💵", "投资": "📈", "电子产品": "💻", "贵重物品": "💎", "电子订阅": "🔁", "买断软件": "🧩", "数字资产": "☁️", "其他": "📦" };
  return map[kind] || map["其他"];
}
function assetKindClass(kind) {
  var map = { "现金": "cash", "投资": "investment", "电子产品": "device", "贵重物品": "valuable", "电子订阅": "subscription", "买断软件": "software", "数字资产": "digital", "其他": "other" };
  return map[kind] || "other";
}
function isSubscriptionAsset(item) { return item.kind === "电子订阅"; }
function isLiquidAsset(item) { return item.kind === "现金" || item.kind === "投资"; }
function daysSinceDate(dateText) {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateText))) return null;
  var parts = String(dateText).split("-").map(Number);
  var target = new Date(parts[0], parts[1] - 1, parts[2]);
  var now = new Date(), todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var days = Math.floor((todayDate.getTime() - target.getTime()) / 86400000);
  return isFinite(days) ? Math.max(0, days) : null;
}
function ratioLabel(value) {
  if (value == null) return "--";
  return value.toFixed(0) + "%";
}
function assetStatusPlan(data) {
  if (!data.items.length && data.investmentValue <= 0) {
    return { label: "待建账", level: "warning", text: "先补现金、设备、订阅和投资账户，资产板块才会有判断力。" };
  }
  if (data.daysSinceUpdate == null || data.daysSinceUpdate > 14) {
    return { label: "待更新", level: "warning", text: "净值更新有点久了，补一次市值和清单估值会更准。" };
  }
  if (data.subscriptionCost > 0 && !data.nextRenewal) {
    return { label: "订阅待查", level: "warning", text: "订阅成本已有记录，建议把下次扣费日补齐，避免自动续费失控。" };
  }
  if (data.liquidityRatio != null && data.liquidityRatio < 25) {
    return { label: "流动性低", level: "negative", text: "可动用资产占比偏低，后续大额消费前先看现金缓冲。" };
  }
  if (data.idleValue > 0) {
    return { label: "有闲置", level: "warning", text: "有一部分资产处于闲置状态，可以考虑转卖、归档或重新投入使用。" };
  }
  return { label: "结构清楚", level: "positive", text: "资产分类、更新节奏和订阅成本都比较清楚，继续保持。" };
}
function renderAssetInventory(wealth) {
  var items = state.assetItems || [];
  var subscriptionCost = sum(items, function (item) { return isSubscriptionAsset(item) ? item.monthlyCost : 0; });
  var inventoryValue = numberValue(wealth.independentAssets);
  var liquidValue = sum(independentAssetItems(currentMonth()), function (item) { return isLiquidAsset(item) ? item.currentValue : 0; });
  var nonLiquidValue = sum(independentAssetItems(currentMonth()), function (item) { return !isLiquidAsset(item) ? item.currentValue : 0; });
  var investmentValue = numberValue(wealth.financialAssets);
  liquidValue += investmentValue;
  var totalAsset = numberValue(wealth.grossAssets);
  var netWorth = numberValue(wealth.netWorth);
  var idleItems = independentAssetItems(currentMonth()).filter(function (item) { return item.status === "闲置"; });
  var idleValue = sum(idleItems, function (item) { return item.currentValue; });
  var latest = state.snapshots.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); })[0] || null;
  var daysSinceUpdate = latest ? daysSinceDate(latest.date) : null;
  var now = today();
  var nextRenewal = items.filter(function (item) {
    return isSubscriptionAsset(item) && item.renewalDate && String(item.renewalDate) >= now;
  }).sort(function (a, b) { return String(a.renewalDate).localeCompare(String(b.renewalDate)); })[0] || null;
  var liquidityRatio = totalAsset > 0 ? liquidValue / totalAsset * 100 : null;
  var nonLiquidRatio = totalAsset > 0 ? nonLiquidValue / totalAsset * 100 : null;
  var status = assetStatusPlan({
    items: items,
    investmentValue: investmentValue,
    subscriptionCost: subscriptionCost,
    nextRenewal: nextRenewal,
    liquidityRatio: liquidityRatio,
    daysSinceUpdate: daysSinceUpdate,
    idleValue: idleValue
  });
  if (byId("assetInventorySummary")) byId("assetInventorySummary").textContent = "共 " + items.length + " 项，独立计入 " + money(inventoryValue) + "，待确认 " + wealth.unresolvedAssets.length + " 项，每月订阅 " + money(subscriptionCost);
  if (byId("assetsOverview")) {
    byId("assetsOverview").innerHTML = "<article class=\"assets-panorama-card\">"
      + "<div class=\"ap-head\"><div><h2>资产全景</h2><p>金融资产、独立资产与负债采用统一口径</p></div><span class=\"status-pill " + esc(status.level) + "\">" + esc(status.label) + "</span></div>"
      + "<div class=\"ap-hero\"><strong class=\"" + (netWorth >= 0 ? "positive" : "negative") + "\">" + money(netWorth) + "</strong><span>当前净资产</span></div>"
      + "<div class=\"ap-metrics\">"
      + "<div class=\"ap-metric\"><span>金融资产</span><strong>" + money(wealth.financialAssets) + "</strong><small>含待归集 " + money(wealth.unallocatedCash) + "</small></div>"
      + "<div class=\"ap-metric\"><span>独立资产</span><strong>" + money(wealth.independentAssets) + "</strong><small>不与账户重复</small></div>"
      + "<div class=\"ap-metric\"><span>负债</span><strong class=\"" + (wealth.liabilities > 0 ? "negative" : "") + "\">" + money(wealth.liabilities) + "</strong><small>总资产 " + money(totalAsset) + "</small></div>"
      + "<div class=\"ap-metric\"><span>每月订阅</span><strong class=\"" + (subscriptionCost > 0 ? "warning" : "") + "\">" + money(subscriptionCost) + "</strong><small>年 " + money(subscriptionCost * 12) + "</small></div>"
      + "</div>"
      + "<div class=\"ap-bars\">"
      + "<div class=\"ap-bar-row\"><span>流动性</span><div class=\"ap-bar\"><span style=\"width:" + Math.max(2, Math.min(100, liquidityRatio || 0)).toFixed(0) + "%\"></span></div><strong>" + ratioLabel(liquidityRatio) + "</strong></div>"
      + "<div class=\"ap-bar-row\"><span>非流动</span><div class=\"ap-bar muted\"><span style=\"width:" + Math.max(2, Math.min(100, nonLiquidRatio || 0)).toFixed(0) + "%\"></span></div><strong>" + ratioLabel(nonLiquidRatio) + "</strong></div>"
      + "</div>"
      + "<div class=\"ap-footer\">"
      + "<div class=\"ap-footer-item\"><span>最近更新</span><strong>" + esc(latest ? latest.date : "尚未更新") + "</strong><small>" + esc(daysSinceUpdate == null ? "还没有净值更新" : daysSinceUpdate + " 天前") + "</small></div>"
      + "<div class=\"ap-footer-item\"><span>最近扣费</span><strong>" + esc(nextRenewal ? nextRenewal.name + " · " + nextRenewal.renewalDate : "暂无") + "</strong><small>" + esc(nextRenewal ? "订阅续费日" : "暂无订阅扣费") + "</small></div>"
      + "</div>"
      + "<div class=\"ap-advice\">" + esc(status.text) + "</div>"
      + (wealth.unresolvedAssets.length ? "<div class=\"notice warning\">有 " + wealth.unresolvedAssets.length + " 项现金/投资清单待确认口径，当前未计入净资产，避免与账户重复。</div>" : "")
      + (wealth.unallocatedGap > 0 ? "<div class=\"notice warning\">有 " + money(wealth.unallocatedGap) + " 的历史资金来源尚未关联账户，当前资产金额保留，但需要后续补齐来源。</div>" : "")
      + "</article>";
  }
  var filterKinds = ["全部"].concat(assetKinds);
  if (byId("assetKindTabs")) {
    byId("assetKindTabs").innerHTML = filterKinds.map(function (kind) {
      var count = kind === "全部" ? items.length : items.filter(function (item) { return item.kind === kind; }).length;
      return "<button type=\"button\" class=\"" + (assetKindFilter === kind ? "active" : "") + "\" data-action=\"set-asset-kind\" data-kind=\"" + esc(kind) + "\"><span>" + esc(kind === "全部" ? "◎" : assetKindIcon(kind)) + "</span>" + esc(kind) + "<strong>" + count + "</strong></button>";
    }).join("");
  }
  var visible = assetKindFilter === "全部" ? items : items.filter(function (item) { return item.kind === assetKindFilter; });
  if (byId("assetItemList")) {
    byId("assetItemList").innerHTML = visible.length ? visible.slice().sort(function (a, b) { return numberValue(b.currentValue) - numberValue(a.currentValue); }).map(assetItemCard).join("") : empty("还没有这一类资产。", "点上方「添加资产」，把现金、设备、订阅或软件放进清单。", "", "📦");
  }
}
function assetItemCard(item) {
  var isSub = isSubscriptionAsset(item);
  var depreciation = item.purchasePrice > 0 && !isSub ? (item.currentValue - item.purchasePrice) / item.purchasePrice * 100 : null;
  var mainLabel = isSub ? "月成本" : "当前估值";
  var mainValue = isSub ? money(item.monthlyCost) : money(item.currentValue);
  var secondaryLabel = isSub ? "下次扣费" : "购买价/本金";
  var secondaryValue = isSub ? (item.renewalDate || "未设置") : money(item.purchasePrice);
  var thirdLabel = isSub ? "年成本" : "折旧/盈亏";
  var thirdValue = isSub ? money(item.monthlyCost * 12) : (depreciation == null ? money(item.currentValue - item.purchasePrice) : depreciation.toFixed(1) + "%");
  var thirdClass = isSub ? "warning" : (item.currentValue >= item.purchasePrice ? "positive" : "negative");
  return "<article class=\"asset-item-card asset-kind-" + esc(assetKindClass(item.kind)) + "\">"
    + "<div class=\"asset-item-head\"><div class=\"asset-kind-icon\">" + esc(assetKindIcon(item.kind)) + "</div><div><h3>" + esc(item.name) + "</h3><p>" + esc(item.kind) + (item.owner ? " · " + esc(item.owner) : "") + "</p></div><span class=\"status-pill\">" + esc(item.valuationMode || "待确认") + "</span></div>"
    + "<div class=\"asset-item-main\"><span>" + esc(mainLabel) + "</span><strong>" + esc(mainValue) + "</strong></div>"
    + "<div class=\"asset-item-facts\"><div><span>" + esc(secondaryLabel) + "</span><strong>" + esc(secondaryValue) + "</strong></div><div><span>" + esc(thirdLabel) + "</span><strong class=\"" + thirdClass + "\">" + esc(thirdValue) + "</strong></div></div>"
    + "<div class=\"asset-item-note\">" + esc(item.note || (isSub ? "检查使用频率和自动续费。" : "记录估值、保修、转卖或继续使用状态。")) + "</div>"
    + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"assetItem\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"assetItem\" data-id=\"" + esc(item.id) + "\">删除</button></div>"
    + "</article>";
}

function renderLiabilities() {
  var items = state.liabilities || [];
  var total = liabilityTotal(currentMonth());
  if (byId("liabilitySummary")) byId("liabilitySummary").textContent = "共 " + items.length + " 项，未偿还 " + money(total);
  if (!byId("liabilityList")) return;
  byId("liabilityList").innerHTML = items.length ? items.map(function (item) {
    return "<article class=\"asset-item-card\"><div class=\"asset-item-head\"><div class=\"asset-kind-icon\">−</div><div><h3>" + esc(item.name) + "</h3><p>" + esc(item.type) + "</p></div><span class=\"status-pill\">" + esc(item.status) + "</span></div>"
      + "<div class=\"asset-item-main\"><span>当前未偿还</span><strong class=\"negative\">" + money(item.currentBalance) + "</strong></div>"
      + "<div class=\"asset-item-facts\"><div><span>年利率</span><strong>" + numberValue(item.interestRate).toFixed(2) + "%</strong></div><div><span>最低还款</span><strong>" + money(item.minimumPayment) + "</strong></div></div>"
      + "<div class=\"asset-item-note\">" + esc(item.note || (item.dueDate ? "到期日：" + item.dueDate : "持续更新未偿还余额。")) + "</div>"
      + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"liability\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"liability\" data-id=\"" + esc(item.id) + "\">删除</button></div></article>";
  }).join("") : empty("还没有负债记录。", "没有负债可以保持为空；有信用卡或贷款时在这里登记未偿还余额。", "", "−");
}
