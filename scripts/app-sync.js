"use strict";

var backendSyncState = {
  busy: false,
  status: "local-only",
  error: "",
  unresolvedConflict: false,
  pendingCloudState: null,
  pendingCloudPush: false,
  cloudPushScheduled: false
};

function isoTimeValue(value) {
  var n = Date.parse(value || "");
  return Number.isFinite(n) ? n : 0;
}

function detectSyncConflict(meta, cloudUpdatedAt) {
  var localTime = isoTimeValue(meta && meta.localUpdatedAt);
  var lastCloudTime = isoTimeValue(meta && meta.lastCloudUpdatedAt);
  var cloudTime = isoTimeValue(cloudUpdatedAt);
  return {
    cloudNewer: cloudTime > localTime,
    localChangedSinceCloud: localTime > lastCloudTime,
    cloudChangedSinceSync: cloudTime > lastCloudTime,
    conflict: localTime > lastCloudTime && cloudTime > lastCloudTime && cloudTime !== localTime
  };
}

function setBackendSyncStatus(status, error) {
  backendSyncState.status = status;
  backendSyncState.error = error || "";
  renderBackendSyncStatus();
}

function renderBackendSyncStatus() {
  var syncEl = byId("backendSyncStatus");
  var localEl = byId("backendLocalSavedAt");
  var cloudEl = byId("backendCloudSyncedAt");
  if (syncEl) {
    if (backendSyncState.error) syncEl.textContent = backendSyncState.error;
    else if (backendSyncState.busy) syncEl.textContent = "云同步处理中";
    else if (backendSyncState.status === "synced") syncEl.textContent = "云端已同步";
    else if (backendSyncState.status === "conflict") syncEl.textContent = "发现多设备冲突，需手动选择";
    else if (backendSyncState.status === "cloud-newer") syncEl.textContent = "云端有较新数据，需手动确认";
    else syncEl.textContent = "本地可用，云同步待登录";
  }
  if (localEl) localEl.textContent = syncMeta && syncMeta.localUpdatedAt ? syncMeta.localUpdatedAt.replace("T", " ").slice(0, 19) : "--";
  if (cloudEl) cloudEl.textContent = syncMeta && syncMeta.lastCloudUpdatedAt ? syncMeta.lastCloudUpdatedAt.replace("T", " ").slice(0, 19) : "--";
}

function getSyncClientAndUser() {
  var client = typeof getBackendClient === "function" ? getBackendClient() : null;
  var user = typeof getBackendUser === "function" ? getBackendUser() : null;
  if (!client || !user || !user.id) return null;
  return { client: client, user: user };
}

async function fetchCloudStateRow() {
  var ctx = getSyncClientAndUser();
  if (!ctx) return null;
  var result = await ctx.client
    .from(BACKEND_CONFIG.tableName)
    .select("schema_version,state,updated_at")
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

function prepareCloudStateRow(row) {
  if (!row || !row.state) return { ok: false, state: null, updatedAt: "", errors: ["云端暂无数据"] };
  var prepared = prepareImportedState(row.state);
  if (!prepared.ok) return { ok: false, state: null, updatedAt: row.updated_at || "", errors: prepared.errors };
  return { ok: true, state: prepared.state, updatedAt: row.updated_at || "", errors: [] };
}

function markCloudStateNeedsConfirmation(prepared) {
  backendSyncState.pendingCloudState = prepared;
  backendSyncState.unresolvedConflict = false;
  setBackendSyncStatus("cloud-newer");
}

async function pushLocalStateToCloud(options) {
  var ctx = getSyncClientAndUser();
  if (!ctx) {
    setBackendSyncStatus("local-only");
    return false;
  }
  if (backendSyncState.unresolvedConflict && !(options && options.force)) {
    setBackendSyncStatus("conflict");
    return false;
  }
  if (backendSyncState.busy) {
    backendSyncState.pendingCloudPush = true;
    return false;
  }
  backendSyncState.pendingCloudPush = false;
  backendSyncState.busy = true;
  renderBackendSyncStatus();
  try {
    var updatedAt = new Date().toISOString();
    var stateSnapshot = JSON.parse(JSON.stringify(state));
    var result = await ctx.client
      .from(BACKEND_CONFIG.tableName)
      .upsert({
        user_id: ctx.user.id,
        schema_version: CURRENT_SCHEMA_VERSION,
        state: stateSnapshot,
        updated_at: updatedAt
      }, { onConflict: "user_id" })
      .select("updated_at")
      .single();
    if (result.error) throw result.error;
    var cloudUpdatedAt = result.data && result.data.updated_at ? result.data.updated_at : updatedAt;
    updateSyncMeta({ lastCloudUpdatedAt: cloudUpdatedAt, lastSyncedAt: new Date().toISOString() });
    backendSyncState.unresolvedConflict = false;
    backendSyncState.pendingCloudState = null;
    setBackendSyncStatus("synced");
    return true;
  } catch (err) {
    setBackendSyncStatus("error", "本地已保存，云同步失败");
    return false;
  } finally {
    backendSyncState.busy = false;
    renderBackendSyncStatus();
    if (backendSyncState.pendingCloudPush && !backendSyncState.unresolvedConflict) scheduleCloudPushAfterLocalSave();
  }
}

async function applyCloudState(prepared) {
  var previous = state;
  if (typeof downloadStateBackup === "function") {
    downloadStateBackup(previous, "caiji-backup-before-cloud-pull_" + backupTimestamp() + ".json");
  }
  state = prepared.state;
  if (save()) {
    updateSyncMeta({
      localUpdatedAt: prepared.updatedAt || new Date().toISOString(),
      lastCloudUpdatedAt: prepared.updatedAt || "",
      lastSyncedAt: new Date().toISOString()
    });
    backendSyncState.unresolvedConflict = false;
    backendSyncState.pendingCloudState = null;
    renderAll();
    setBackendSyncStatus("synced");
    notify("已使用云端数据");
    return true;
  }
  state = previous;
  notify("云端数据应用失败，已保留本地数据");
  return false;
}

async function resolveCloudStateRow(row, manual) {
  var prepared = prepareCloudStateRow(row);
  if (!prepared.ok) {
    if (manual) appAlert("云同步失败", prepared.errors.join("\n"), "关闭");
    return false;
  }
  var check = detectSyncConflict(syncMeta || {}, prepared.updatedAt);
  if (check.conflict) {
    backendSyncState.unresolvedConflict = true;
    backendSyncState.pendingCloudState = prepared;
    setBackendSyncStatus("conflict");
    if (!manual) return false;
    var useCloud = await appConfirm("发现多设备冲突", "云端和本机都发生过更新。是否使用云端数据覆盖本机？取消后可先导出本地备份。", "使用云端", "取消");
    if (useCloud) return applyCloudState(prepared);
    return false;
  }
  if (check.cloudNewer && !manual) {
    markCloudStateNeedsConfirmation(prepared);
    return false;
  }
  if (check.cloudNewer || manual) {
    var ok = manual ? await appConfirm("使用云端数据", "这会用云端数据覆盖当前本机数据。建议先导出本地备份。", "使用云端", "取消") : true;
    if (ok) return applyCloudState(prepared);
  }
  updateSyncMeta({ lastCloudUpdatedAt: prepared.updatedAt || "", lastSyncedAt: new Date().toISOString() });
  setBackendSyncStatus("synced");
  return true;
}

async function pullCloudState(manual) {
  var ctx = getSyncClientAndUser();
  if (!ctx) {
    notify("请先登录云同步");
    return false;
  }
  backendSyncState.busy = true;
  renderBackendSyncStatus();
  try {
    var row = await fetchCloudStateRow();
    if (!row) {
      if (manual) notify("云端暂无数据，可先上传本地数据");
      setBackendSyncStatus("signed-in");
      return false;
    }
    return await resolveCloudStateRow(row, !!manual);
  } catch (err) {
    setBackendSyncStatus("error", "云端读取失败");
    return false;
  } finally {
    backendSyncState.busy = false;
    renderBackendSyncStatus();
  }
}

function scheduleCloudPushAfterLocalSave() {
  if (backendSyncState.unresolvedConflict) return;
  var ctx = getSyncClientAndUser();
  if (!ctx) return;
  backendSyncState.pendingCloudPush = true;
  if (backendSyncState.busy || backendSyncState.cloudPushScheduled) return;
  backendSyncState.cloudPushScheduled = true;
  setTimeout(function () {
    backendSyncState.cloudPushScheduled = false;
    if (!backendSyncState.pendingCloudPush || backendSyncState.busy || backendSyncState.unresolvedConflict) return;
    pushLocalStateToCloud();
  }, 0);
}

function syncOnAuthReady() {
  pullCloudState(false);
}
