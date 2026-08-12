# Architecture

本文件记录当前项目结构和模块职责。若与 `docs/ENGINEERING_STATUS.md`、`docs/DATA_MODEL.md`、`docs/DESIGN_SYSTEM.md` 冲突，以 `docs/` 下的新文档为准。

## 1. 系统定位

财富志是本地优先的私人资金管理网页应用，服务个人现金流、投资、资产、分配和目标管理。

它不是通用 SaaS，不是标准记账 App，也不是后台管理系统。

## 2. 核心页面

- Dashboard / 总览：整体资金驾驶舱，展示当前状态、趋势、风险和关键判断。
- Flow / 流水：收入、支出、投资动作和月度现金流复盘。
- Investments / 投资：投资和储蓄记录、持仓状态、净值和收益变化。
- Assets / 资产：资产账户、净值快照和资产清单。
- Accounts / 分配：资金账户、预算比例、目标和账户边界。
- Goals / 目标：阶段性目标进度。
- Data / 数据：导入、导出和备份。

## 3. 当前文件结构

### HTML

- `index.html`
  - 页面结构、视图容器、表单 DOM、脚本加载顺序。
  - 不承载业务计算。

### State / Storage Layer

- `scripts/app-state.js`
  - 全局 state 变量。
  - 常量、枚举、基础工具函数。
  - 默认 state、默认账户、normalize 系列函数。

- `scripts/app-validators.js`
  - `validateImportData`
  - `validateStateShape`
  - `validateSchemaVersion`
  - 导入摘要与 `prepareImportedState`

- `scripts/app-migrations.js`
  - `CURRENT_SCHEMA_VERSION` 对应的迁移管线。
  - 当前支持 v1 -> v2 -> v3。
  - 不认识的未来版本必须拒绝。

- `scripts/app-storage.js`
  - `STORAGE_KEY`
  - recovery key
  - `loadState`
  - `save`
  - localStorage 损坏数据保护。

### Calculations

- `scripts/app-calculations.js`
  - 月度收入、支出、预算、余额。
  - 资产快照汇总。
  - 财务健康分、预测、账户状态。

### Render Layer

- `scripts/app-render-core.js`
  - 通用渲染工具、选项渲染、饼图、趋势图基础渲染。

- `scripts/app-render-dashboard.js`
  - Dashboard 首页驾驶舱渲染。

- `scripts/app-render-flow.js`
  - Flow 页面顶部概览、tab 和复盘区域渲染。

- `scripts/app-render-investments.js`
  - Investments 页面渲染。

- `scripts/app-render-assets.js`
  - Assets 页面、资产清单、净值记录渲染。

- `scripts/app-render-records.js`
  - 收入、支出、账户区域相关渲染。

- `scripts/app-render-monthly.js`
  - 月报、目标和统一 `renderAll` 入口。

- `scripts/app-render.js`
  - 兼容说明文件，正常任务不要优先修改。

### Actions Layer

- `scripts/app-actions-data.js`
  - `downloadStateBackup`
  - `exportData`
  - `importData`

- `scripts/app-actions-crud.js`
  - `upsert`
  - `removeRecord`
  - `editRecord`

- `scripts/app-actions-quick-entry.js`
  - 快捷录入弹窗打开/关闭。
  - 快捷收入、支出、投资提交绑定。

- `scripts/app-actions-modals.js`
  - 净值记录弹窗。
  - 健康评分说明弹窗。

- `scripts/app-actions-navigation.js`
  - `setDashboardHomeMode`
  - `handleViewSwitchClick`

- `scripts/app-actions.js`
  - form helpers。
  - form submit binding。
  - feature toggles。
  - `bindClicks`。
  - `init`。

### Styles

- `styles.css`
  - 样式入口。

- `styles/base.css`
  - design tokens、基础布局、header、tabs、views、dashboard home mode。

- `styles/components.css`
  - 通用 cards/stats。
  - 当前仍包含部分 legacy cockpit components，后续需二次验证。

- `styles/dashboard.css`
  - Dashboard 首页视觉和座舱布局。

- `styles/pages.css`
  - Assets、Accounts、Forms、Buttons、Records、Data、Flow、Monthly 等页面样式。

- `styles/responsive.css`
  - 响应式规则。
  - 当前已标记旧 dashboard responsive selector 风险。

## 4. 数据结构

数据结构以 `docs/DATA_MODEL.md` 为准。

关键约束：

- 不随意修改 state 字段名。
- 不随意修改 localStorage 主 key。
- 导入必须经过 `validateImportData`。
- `loadState` 和 `importData` 必须经过 `migrateState`。
- `normalizeState` 只负责补齐和清洗，不负责版本迁移。

## 5. 视觉规则

视觉系统以 `docs/DESIGN_SYSTEM.md` 为准。

当前视觉方向：

- 香槟金金融座舱。
- 私人财富驾驶舱。
- 克制、高级、清晰、有工具感。
- 不回到普通后台，不做科技蓝大屏，不做大面积绿色主视觉。

## 6. 修改原则

- 小步修改。
- 不重写整个项目。
- 不跨过当前任务范围顺手重构。
- 工程改动后运行必要检查。
- 文档、数据模型、视觉系统冲突时，优先遵守 `docs/` 下的新文档。
