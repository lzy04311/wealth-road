"use strict";

function dashboardStripLabel(name) {
  var text = cleanText(name || "");
  if (!text) return "主要类别";
  if (/^[a-zA-Z0-9_-]+$/.test(text) && text.length <= 4) return "本月支出结构";
  return text.length > 6 ? text.slice(0, 6) : text;
}

function dashboardShortName(name) {
  if (name.indexOf("纳斯") >= 0) return "投资";
  if (name.indexOf("流动") >= 0) return "现金";
  if (name.indexOf("保命") >= 0) return "保障";
  return String(name).length > 4 ? String(name).slice(0, 4) : String(name);
}

function dashboardStripIcon(icon) {
  var map = { cash: "⌁", balance: "◍", invest: "↗", asset: "◎", goal: "◉", quote: "❛" };
  return map[icon] || "•";
}
