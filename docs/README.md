# 财记 / 本地优先私人资金管理网页

财记是一个本地优先的私人资金管理网页应用，用于记录和理解现金流、投资状态、资产变化、资金分配边界和阶段性目标。

截至 2026-08-15，项目已完成一轮数据安全与财务口径加固，当前本地 state 为 schema v5。真实资金账户、双边转账、资金用途分配、余额核对和历史流水补账户已进入现役代码；二级页面工作区与表单抽屉仍在当前工作分支继续收尾。

上述能力已通过自动化测试和本地浏览器运行检查。本文档不代表代码已经部署或 live verified；集成与发布状态必须以当前 Git 和部署证据为准。

## 文档优先级

后续 AI 或人工修改项目时，优先遵守以下文档：

1. `docs/ENGINEERING_STATUS.md`
2. `docs/DATA_MODEL.md`
3. `docs/DESIGN_SYSTEM.md`

如果旧文档与 `docs/` 下的新文档冲突，以 `docs/` 下的新文档为准。

## 历史规则 / 早期规划

以下文件保留为历史规则、个人偏好和早期规划参考：

- `01_DAILY_RULES.md`
- `02_AI_RULES.md`
- `03_ARCHITECTURE.md`
- `04_ROADMAP.md`

其中 `03_ARCHITECTURE.md` 和 `04_ROADMAP.md` 已按当前工程状态更新，但仍低于 `docs/` 下三份核心文档。

## 当前结构概览

- `index.html`: 页面结构和表单容器。
- `styles.css`: CSS 入口文件。
- `styles/`: 样式模块。
- `scripts/`: 运行中的 JS 模块。
- `docs/`: 当前最高优先级工程文档。

## 财务原始数据与完善路线

- `RAW_FINANCE_LEDGER.md`: 自然语言记账、追加式 CSV、校验和现有 JSON 备份迁移流程。
- `FINANCIAL_SYSTEM_CLOSURE_PLAN.md`: 已完成能力、当前遗留风险和后续分阶段完善路线。
- `data/raw/wealth-events.csv`: 本机私有原始事件账本，由工具创建并写入，已排除在 Git 之外。

## 使用方式

核心本地功能可以直接打开 `index.html`。需要验证 PWA、Service Worker 或缓存行为时，应通过 localhost HTTP 服务或 VS Code Live Server 打开。

## 数据说明

- 数据仍保存在浏览器 `localStorage`。
- 云同步模块目前没有生产配置，默认保持本地模式。
- 不要随意修改 localStorage 主 key。
- 不要随意修改 state 字段名。
- 导出 JSON 备份时，不要把个人备份数据提交到代码仓库。
