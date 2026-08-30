# Cloud Sync Activation

Last verified: 2026-08-16

本文档把 `docs/OPTIONAL_SYNC.md` 的 8 项启用门槛拆成可执行步骤。财记默认是本地模式，云同步模块（`scripts/app-backend-config.js` / `app-auth.js` / `app-sync.js`）在满足以下全部条件前不会启用。

## 前置资源（需要你准备）

- 一个 [Supabase](https://supabase.com) 账号与项目（免费额度对个人记账足够）。
- 一个 HTTPS 静态托管（Vercel / Netlify / Cloudflare Pages / GitHub Pages 均可；`file://` 或纯 localhost 无法做真实跨设备同步）。

## 激活步骤

### Step 1 — 创建 Supabase 项目

1. 注册并创建项目，记下两项：
   - **Project URL**：形如 `https://xxxxxxxx.supabase.co`
   - **anon public key 或 publishable key**（公开 key，不是 service_role key）
2. 到 **Authentication → Providers → Email**，开启 **Email OTP（Magic Link）**。
3. 到 **Authentication → URL Configuration**，把 **Site URL** 设为你的部署域名（如 `https://your-app.example.com`）。

### Step 2 — 建表与 RLS

在 Supabase SQL Editor 执行 `scripts/supabase-schema.sql`（建 `user_finance_states` 表 + RLS 策略）。RLS 保证每个登录用户只能读写自己的 `user_id` 行。

### Step 3 — 同源客户端脚本（CSP 要求）

应用 CSP 的 `script-src 'self'` 不允许从 CDN 加载脚本，因此 supabase-js 必须同源提供：

1. 下载 supabase-js v2 的浏览器 UMD 单文件（`supabase.js`）。
2. 放到 `scripts/vendor/supabase-js.js`。
3. 在 Data 页「云同步配置」里把「客户端脚本」填为 `./scripts/vendor/supabase-js.js`。

> 如果你希望改用 CDN，需要同步修改 `index.html` 的 CSP `script-src`，这属于安全边界变更，应单独评审。

### Step 4 — 部署到 HTTPS

把仓库部署到你的 HTTPS 静态托管，确认 `index.html` 通过 HTTPS 访问。

### Step 5 — 在 Data 页填写配置

1. 打开部署后的应用，进入 **备份（安全舱）** 页。
2. 在「云同步配置」里填：Supabase URL、anon/publishable key、同源客户端脚本路径；三项都必须填写。
3. 点「保存配置」。配置只写入本机 `localStorage`，不会提交到 Git。

### Step 6 — 登录并首测

1. 输入邮箱 → 发送登录邮件 → 用邮箱里的验证码登录。
2. 登录后「上传本机」把当前数据推到云端；「拉取云端」把云端数据拉回本机。
3. 在第二台设备重复登录，实测「先本机改动、再云端改动」的冲突处理。云端 RPC 会在版本不一致时拒绝写入，界面提示冲突，绝不静默覆盖。

### Step 7 — 冲突与回退边界

- 双端同时改动：`save_finance_state` 会比较客户端最后同步的 `updated_at` 并原子写入；不一致时拒绝上传，用户可拉取云端或先导出本机备份，不会自动合并或静默覆盖。
- 云同步失败不会回滚已成功的本地保存。
- 回退：在「云同步配置」点「清除配置」，应用即回到本地模式；本地数据与 JSON 导入导出不受影响。

## 安全红线

- **只填 anon/publishable key**：service_role key 或管理员密钥绝不能进入前端代码或配置表单。
- **RLS 必须生效**：未执行 `supabase-schema.sql`（或 RLS 被关闭）时不要启用，否则数据会互相可见。
- **不要提交 key**：配置存于本机 `localStorage`，已通过 `caiji_backend_config` 与 Git 隔离。

## 尚未闭合

- 无 Supabase 项目、部署域名或双设备实测前，云同步保持禁用状态。
- 当前本地保存后会尝试自动推送，手动上传使用同一 CAS 保护；真实双设备实测完成前仍不得宣称云同步已上线。
