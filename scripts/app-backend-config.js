"use strict";

// 可选 Supabase 云同步配置。默认全部为空，保持本地模式。
// 配置从 localStorage（BACKEND_CONFIG_KEY）注入，避免把 anon/publishable key 写进源码或提交到 Git。
// 用户在 Data 页「多设备同步」卡片填写 URL 与公开 key 后即可启用（配合 SQL 脚本与部署）。

var BACKEND_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseClientScript: "",
  tableName: "user_finance_states"
};

var BACKEND_CONFIG_KEY = "caiji_backend_config";

function loadBackendConfig() {
  try {
    if (typeof localStorage === "undefined") return;
    var raw = localStorage.getItem(BACKEND_CONFIG_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    if (typeof parsed.supabaseUrl === "string" && parsed.supabaseUrl) BACKEND_CONFIG.supabaseUrl = parsed.supabaseUrl;
    if (typeof parsed.supabaseAnonKey === "string" && parsed.supabaseAnonKey) BACKEND_CONFIG.supabaseAnonKey = parsed.supabaseAnonKey;
    if (typeof parsed.supabaseClientScript === "string" && parsed.supabaseClientScript) BACKEND_CONFIG.supabaseClientScript = parsed.supabaseClientScript;
    if (typeof parsed.tableName === "string" && parsed.tableName) BACKEND_CONFIG.tableName = parsed.tableName;
  } catch (err) {}
}
loadBackendConfig();

function saveBackendConfig(patch) {
  var current = {};
  try {
    var raw = typeof localStorage !== "undefined" ? localStorage.getItem(BACKEND_CONFIG_KEY) : null;
    if (raw) current = JSON.parse(raw) || {};
  } catch (err) { current = {}; }
  var next = Object.assign({}, current, patch || {});
  Object.keys(next).forEach(function (key) {
    if (typeof next[key] === "string") next[key] = next[key].trim();
  });
  if (typeof next.supabaseUrl === "string" && next.supabaseUrl) BACKEND_CONFIG.supabaseUrl = next.supabaseUrl;
  if (typeof next.supabaseAnonKey === "string" && next.supabaseAnonKey) BACKEND_CONFIG.supabaseAnonKey = next.supabaseAnonKey;
  if (typeof next.supabaseClientScript === "string" && next.supabaseClientScript) BACKEND_CONFIG.supabaseClientScript = next.supabaseClientScript;
  if (typeof next.tableName === "string" && next.tableName) BACKEND_CONFIG.tableName = next.tableName;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(BACKEND_CONFIG_KEY, JSON.stringify(next));
  } catch (err) {}
  return next;
}

function clearBackendConfig() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(BACKEND_CONFIG_KEY);
  } catch (err) {}
  BACKEND_CONFIG.supabaseUrl = "";
  BACKEND_CONFIG.supabaseAnonKey = "";
  BACKEND_CONFIG.supabaseClientScript = "";
}

function backendKeyRole(key) {
  var text = String(key || "");
  if (/^sb_secret_/i.test(text)) return "service_role";
  var parts = text.split(".");
  if (parts.length !== 3 || typeof atob !== "function") return "";
  try {
    var payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    var parsed = JSON.parse(atob(payload));
    return String(parsed.role || "");
  } catch (err) {
    return "";
  }
}
function isAllowedBackendAnonKey(key) {
  var text = String(key || "");
  if (text.length <= 20 || backendKeyRole(text) === "service_role") return false;
  return /^sb_publishable_/i.test(text) || backendKeyRole(text) === "anon";
}
function isAllowedBackendClientScript(value) {
  var text = String(value || "");
  return /^(?:\.\/|\/)[A-Za-z0-9_./-]+\.js(?:\?[A-Za-z0-9_.=&-]+)?$/.test(text);
}
function isBackendConfigured() {
  return !!(
    BACKEND_CONFIG &&
    /^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(String(BACKEND_CONFIG.supabaseUrl || "")) &&
    isAllowedBackendAnonKey(BACKEND_CONFIG.supabaseAnonKey) &&
    isAllowedBackendClientScript(BACKEND_CONFIG.supabaseClientScript) &&
    String(BACKEND_CONFIG.tableName || "").length > 0
  );
}

function backendRedirectUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  return String(window.location.href || "").split("#")[0];
}
