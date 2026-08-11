"use strict";

var BACKEND_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseClientScript: "",
  tableName: "user_finance_states"
};

function isBackendConfigured() {
  return !!(
    BACKEND_CONFIG &&
    /^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(String(BACKEND_CONFIG.supabaseUrl || "")) &&
    String(BACKEND_CONFIG.supabaseAnonKey || "").length > 20 &&
    String(BACKEND_CONFIG.tableName || "").length > 0
  );
}

function backendRedirectUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  return String(window.location.href || "").split("#")[0];
}
