# 财记文档索引

财记是本地优先的私人资金管理网页应用，用于记录和理解现金流、投资状态、资产变化、资金分配边界和阶段性目标。

截至 2026-08-15，当前本地 state 为 schema v5。真实资金账户、双边转账、资金用途分配、余额核对、历史流水补账户，以及版本化的“月度执行健康度”均已进入现役代码并通过本地门禁。

这些结论只代表当前工作分支的本地验证，不代表已经推送、合并、部署或 live verified。

## 现役权威文档

1. `ENGINEERING_STATUS.md`：当前工程状态、检查命令和发布边界。
2. `DATA_MODEL.md`：state schema、迁移、财务计算和评分边界。
3. `DESIGN_SYSTEM.md`：现役视觉与组件规则。
4. `03_ARCHITECTURE.md`：运行入口和代码职责。
5. `04_ROADMAP.md`：尚未完成的优先级。

专项证据：

- `RAW_FINANCE_LEDGER.md`：自然语言记账与私有追加式账本协议。
- `BROWSER_E2E_VERIFICATION.md`：隔离浏览器写入、编辑、核对、归档、导出和恢复证据。
- `OPTIONAL_SYNC.md`：可选 Supabase 模块的当前禁用状态、启用门槛和回退边界。
- `assets/reference-dashboard.png`：Dashboard 视觉比较基准。

Git 历史负责保存已经完成的实施计划、Dashboard 拆分过程和旧规则，不再让它们冒充现役指令。

## 当前结构

- `index.html`：页面结构、表单容器和运行脚本顺序。
- `styles.css` / `styles/`：样式入口和模块。
- `scripts/`：运行代码、项目门禁和私有账本工具。
- `tests/fixtures/`：不含私人数据的浏览器恢复夹具。
- `AGENTS.md`：Agent 必须先遵守的项目边界。

## 使用与验证

核心本地功能可以直接打开 `index.html`。需要验证 PWA、Service Worker 或缓存行为时，通过 localhost HTTP 服务打开。

```powershell
node scripts\check-project.js
```

该命令运行自动化测试、JavaScript 语法、浏览器全局符号、DOM 合同、CSS 覆盖预算、品牌、Markdown 链接、Git 空白和私密账本边界检查。

数据默认保存在浏览器 `localStorage`。云同步模块配置为空，当前保持本地模式；不要提交个人 JSON 备份或 `data/raw/` 下的私密账本。
