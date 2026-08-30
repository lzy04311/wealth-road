"use strict";

var backendAuthState = {
  client: null,
  session: null,
  user: null,
  initialized: false,
  status: "local-only",
  error: ""
};

function getBackendClient() {
  return backendAuthState.client;
}

function getBackendUser() {
  return backendAuthState.user;
}

function backendClientAvailable() {
  return typeof isBackendConfigured === "function" &&
    isBackendConfigured() &&
    typeof window !== "undefined" &&
    window.supabase &&
    typeof window.supabase.createClient === "function";
}

function loadSupabaseClientScript() {
  return new Promise(function (resolve, reject) {
    if (backendClientAvailable()) {
      resolve();
      return;
    }
    if (typeof document === "undefined" || typeof window === "undefined") {
      reject(new Error("document unavailable"));
      return;
    }
    var scriptSrc = BACKEND_CONFIG && BACKEND_CONFIG.supabaseClientScript ? String(BACKEND_CONFIG.supabaseClientScript) : "";
    if (!scriptSrc) {
      reject(new Error("supabase client script not configured"));
      return;
    }
    var existing = document.querySelector("script[data-supabase-client]");
    if (existing) {
      existing.addEventListener("load", function () { resolve(); }, { once: true });
      existing.addEventListener("error", function () { reject(new Error("supabase client failed")); }, { once: true });
      return;
    }
    var script = document.createElement("script");
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      reject(new Error("supabase client timeout"));
    }, 5000);
    script.src = scriptSrc;
    script.async = true;
    script.dataset.supabaseClient = "true";
    script.onload = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (backendClientAvailable()) resolve();
      else reject(new Error("supabase client unavailable"));
    };
    script.onerror = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error("supabase client failed"));
    };
    document.head.appendChild(script);
  });
}

function setBackendAuthStatus(status, error) {
  backendAuthState.status = status;
  backendAuthState.error = error || "";
  renderBackendAuthPanel();
}

function renderBackendAuthPanel() {
  var statusEl = byId("backendAuthStatus");
  var syncEl = byId("backendSyncStatus");
  var emailEl = byId("backendLoginEmail");
  var sendBtn = byId("backendSendLogin");
  var verifyBtn = byId("backendVerifyOtp");
  var logoutBtn = byId("backendLogout");
  var pullBtn = byId("backendPullCloud");
  var pushBtn = byId("backendPushLocal");
  if (!statusEl) return;

  var signedIn = !!backendAuthState.user;
  var configured = backendClientAvailable();
  if (!configured) {
    statusEl.textContent = "本地模式：Supabase 未配置或客户端未加载";
  } else if (signedIn) {
    statusEl.textContent = "已登录：" + (backendAuthState.user.email || backendAuthState.user.id);
  } else if (backendAuthState.error) {
    statusEl.textContent = backendAuthState.error;
  } else {
    statusEl.textContent = "未登录：输入邮箱获取登录邮件";
  }

  if (syncEl && typeof renderBackendSyncStatus === "function") renderBackendSyncStatus();
  if (emailEl) emailEl.disabled = !configured || signedIn;
  if (sendBtn) sendBtn.disabled = !configured || signedIn;
  if (verifyBtn) verifyBtn.disabled = !configured || signedIn;
  if (logoutBtn) logoutBtn.disabled = !configured || !signedIn;
  if (pullBtn) pullBtn.disabled = !configured || !signedIn;
  if (pushBtn) pushBtn.disabled = !configured || !signedIn;
}

async function initBackendAuth() {
  backendAuthState.initialized = true;
  if (typeof isBackendConfigured !== "function" || !isBackendConfigured()) {
    setBackendAuthStatus("local-only");
    return;
  }
  try {
    if (!backendClientAvailable()) await loadSupabaseClientScript();
    backendAuthState.client = window.supabase.createClient(
      BACKEND_CONFIG.supabaseUrl,
      BACKEND_CONFIG.supabaseAnonKey
    );
    var sessionResult = await backendAuthState.client.auth.getSession();
    backendAuthState.session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    backendAuthState.user = backendAuthState.session ? backendAuthState.session.user : null;
    setBackendAuthStatus(backendAuthState.user ? "signed-in" : "signed-out");
    backendAuthState.client.auth.onAuthStateChange(function (_event, session) {
      backendAuthState.session = session || null;
      backendAuthState.user = session && session.user ? session.user : null;
      setBackendAuthStatus(backendAuthState.user ? "signed-in" : "signed-out");
      if (backendAuthState.user && typeof syncOnAuthReady === "function") syncOnAuthReady();
    });
    if (backendAuthState.user && typeof syncOnAuthReady === "function") syncOnAuthReady();
  } catch (err) {
    backendAuthState.client = null;
    backendAuthState.session = null;
    backendAuthState.user = null;
    setBackendAuthStatus("error", "云同步初始化失败，当前仍可本地使用");
  }
}

async function sendBackendLoginEmail() {
  var client = getBackendClient();
  var emailEl = byId("backendLoginEmail");
  var email = cleanText(emailEl ? emailEl.value : "", 160);
  if (!client || !email) {
    notify("请先填写邮箱");
    return;
  }
  try {
    setBackendAuthStatus("sending");
    var result = await client.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: backendRedirectUrl(),
        shouldCreateUser: true
      }
    });
    if (result.error) throw result.error;
    setBackendAuthStatus("email-sent", "登录邮件已发送，请查看邮箱");
    notify("登录邮件已发送");
  } catch (err) {
    setBackendAuthStatus("error", "登录邮件发送失败");
    notify("登录邮件发送失败");
  }
}

async function verifyBackendEmailOtp() {
  var client = getBackendClient();
  var email = cleanText(byId("backendLoginEmail") ? byId("backendLoginEmail").value : "", 160);
  var token = cleanText(byId("backendOtpToken") ? byId("backendOtpToken").value : "", 32);
  if (!client || !email || !token) {
    notify("请填写邮箱和验证码");
    return;
  }
  try {
    var result = await client.auth.verifyOtp({ email: email, token: token, type: "email" });
    if (result.error) throw result.error;
    backendAuthState.session = result.data ? result.data.session : null;
    backendAuthState.user = backendAuthState.session ? backendAuthState.session.user : null;
    setBackendAuthStatus(backendAuthState.user ? "signed-in" : "signed-out");
    notify("登录成功");
    if (typeof syncOnAuthReady === "function") syncOnAuthReady();
  } catch (err) {
    setBackendAuthStatus("error", "验证码校验失败");
    notify("验证码校验失败");
  }
}

async function logoutBackend() {
  var client = getBackendClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } finally {
    backendAuthState.session = null;
    backendAuthState.user = null;
    setBackendAuthStatus("signed-out");
    notify("已退出云同步");
  }
}

function reconfigureBackend() {
  backendAuthState.client = null;
  backendAuthState.session = null;
  backendAuthState.user = null;
  backendAuthState.initialized = false;
  backendAuthState.status = "local-only";
  backendAuthState.error = "";
  if (typeof backendSyncState !== "undefined") {
    backendSyncState.busy = false;
    backendSyncState.status = "local-only";
    backendSyncState.error = "";
    backendSyncState.unresolvedConflict = false;
    backendSyncState.pendingCloudState = null;
    backendSyncState.pendingCloudPush = false;
    backendSyncState.cloudPushScheduled = false;
  }
  initBackendAuth();
}

function applyBackendConfigFromForm() {
  var urlEl = byId("backendConfigUrl");
  var keyEl = byId("backendConfigAnonKey");
  var scriptEl = byId("backendConfigScript");
  var url = cleanText(urlEl ? urlEl.value : "", 200);
  var key = cleanText(keyEl ? keyEl.value : "", 400);
  var script = cleanText(scriptEl ? scriptEl.value : "", 300);
  if (!url || !key || !script) { notify("请填写 Supabase URL、anon/publishable key 和同源客户端脚本"); return; }
  if (!isAllowedBackendAnonKey(key)) { notify("只允许 Supabase anon/publishable key，禁止 service_role 或无法识别的密钥"); return; }
  if (!isAllowedBackendClientScript(script)) { notify("客户端脚本必须是当前站点内的 .js 路径"); return; }
  saveBackendConfig({ supabaseUrl: url, supabaseAnonKey: key, supabaseClientScript: script });
  reconfigureBackend();
  notify("云同步配置已保存");
}

function clearBackendConfigFromForm() {
  clearBackendConfig();
  reconfigureBackend();
  ["backendConfigUrl", "backendConfigAnonKey", "backendConfigScript"].forEach(function (id) {
    var el = byId(id);
    if (el) el.value = "";
  });
  notify("已清除云同步配置，回到本地模式");
}
