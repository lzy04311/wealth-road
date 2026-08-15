# Architecture

本文件记录当前项目结构和模块职责。工程状态以 `docs/ENGINEERING_STATUS.md` 为准，数据结构以 `docs/DATA_MODEL.md` 为准，视觉规则以 `docs/DESIGN_SYSTEM.md` 为准；现役代码优先于历史资料。

## 1. 系统定位

财记是本地优先的私人资金管理网页应用，服务个人现金流、投资、资产、分配和目标管理。

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

### Browser Script Contract

- 浏览器运行时使用 26 个 `defer` 经典脚本，不依赖构建工具或运行时模块加载器。
- 固定方向是 state / validation / storage -> calculations -> render -> actions -> optional auth and sync -> navigation / init / PWA。
- 完整文件顺序和顶层声明唯一性由 `scripts/check-project.js` 精确校验；新增跨文件接口必须先确定所属层，不能依赖偶然加载顺序。

### State / Storage Layer

- `scripts/app-state.js`
  - 全局 state 变量。
  - 常量、枚举、基础工具函数。
  - 默认 state、默认账户、normalize 系列函数。

- `scripts/app-ui-feedback.js`
  - 保存状态提示、操作反馈和可撤销操作反馈条。
  - 只负责 UI 反馈，不持有业务数据结构。

- `scripts/app-validators.js`
  - `validateImportData`
  - `validateStateShape`
  - `validateSchemaVersion`
  - 导入摘要与 `prepareImportedState`

- `scripts/app-migrations.js`
  - `CURRENT_SCHEMA_VERSION` 对应的迁移管线。
  - 当前支持 v1 -> v2 -> v3 -> v4 -> v5。
  - 不认识的未来版本必须拒绝。

- `scripts/app-storage.js`
  - `STORAGE_KEY`
  - recovery key
  - `loadState`
  - `save`
  - localStorage 损坏数据保护。

### Optional Backend Layer

- `scripts/app-backend-config.js`
  - 可选 Supabase 配置和本地模式判断。
  - 默认配置为空，不加载外部客户端。

- `scripts/app-auth.js`
  - 可选认证会话和本地模式回退。

- `scripts/app-sync.js`
  - 可选云端读写、冲突判断和覆盖前本地备份。
  - 启用边界以 `docs/OPTIONAL_SYNC.md` 为准。

### Calculations

- `scripts/app-calculations.js`
  - 月度收入、支出、预算、资金池余额和真实账户余额。
  - 余额核对、资产快照与统一净资产汇总。
  - 版本化月度执行健康度、预测和账户状态。
  - `FINANCIAL_HEALTH_MODEL` 是评分权重、阈值和展示说明的单一事实源。

### Render Layer

- `scripts/app-render-core.js`
  - 通用选项、状态卡、空状态和摘要渲染工具。
  - 月度渲染上下文的创建与缓存。

- `scripts/app-render-dashboard.js`
  - Dashboard 首页驾驶舱渲染。

- `scripts/app-render-flow.js`
  - Flow 页面顶部概览、tab 和复盘区域渲染。

- `scripts/app-render-investments.js`
  - Investments 页面渲染。

- `scripts/app-render-assets.js`
  - Assets 页面、资产清单、净值记录渲染。

- `scripts/app-render-records.js`
  - 收入、支出、资金池、真实账户、余额核对和历史待补账户渲染。

- `scripts/app-render-monthly.js`
  - 月报、目标和统一 `renderAll` 入口。

### Actions Layer

- `scripts/app-actions-data.js`
  - `downloadStateBackup`
  - `exportData`
  - `importData`

- `scripts/app-actions-crud.js`
  - `upsert`
  - `removeRecord`
  - `editRecord`
  - 历史流水真实账户关联与撤销。

- `scripts/app-actions-quick-entry.js`
  - 快捷录入弹窗打开/关闭。
  - 快捷收入、支出、投资提交绑定。

- `scripts/app-actions-modals.js`
  - 净值记录弹窗。
  - 健康评分说明弹窗。

- `scripts/app-actions-forms.js`
  - 各领域表单的提交绑定和 DOM 数据收集。
  - 保存成功后的统一关闭、重置和重渲染流程。

- `scripts/app-actions-navigation.js`
  - `setDashboardHomeMode`
  - `handleViewSwitchClick`

- `scripts/app-actions.js`
  - 表单抽屉生命周期与 form helpers。
  - 页面级事件委托和 feature toggles。
  - `bindClicks` 与唯一 `init` 启动入口。

### PWA Layer

- `scripts/app-pwa.js`
  - Service Worker 注册和安装入口。

- `service-worker.js`
  - 同源应用外壳预缓存和运行时缓存边界。

- `manifest.webmanifest`
  - 应用名称、启动入口、主题和图标声明。

### Styles

- `styles.css`
  - 样式入口。

- `styles/base.css`
  - design tokens、基础布局、header、tabs、views、dashboard home mode。

- `styles/components.css`
  - 通用 cards/stats。

- `styles/controls.css`
  - 全局表单、输入控件、按钮和操作行。
  - 页面文件不得重新定义这些基础职责。

- `styles/dashboard.css`
  - Dashboard 样式入口，仅导入布局和响应式入口，不写具体组件样式。

- `styles/dashboard/layout-topbar.css`
  - 顶部标题、状态条和快捷按钮。

- `styles/dashboard/layout-main-center-right.css`
  - 左侧资产卡、中枢和右侧状态卡。

- `styles/dashboard/layout-bottom-strip.css`
  - Dashboard 底部数据带。

- `styles/dashboard/layout-bottom-nav.css`
  - 底部状态与导航条。

- `styles/dashboard/responsive.css`
  - Dashboard 手机和平板布局。

- `styles/pages.css`
  - 一级业务页面样式入口，只按固定顺序导入页面模块，不承载具体规则。

- `styles/pages/assets.css`
  - 资产总览和资产配置页面。

- `styles/pages/accounts.css`
  - 账户列表、账户卡片和账户页操作。

- `styles/pages/records.css`
  - 流水记录列表和记录页状态。

- `styles/pages/data.css`
  - 数据管理页面。

- `styles/pages/flow.css`
  - 现金流、月度视图和对应页面组件。

- `styles/pages/investments.css`
  - 投资页面和投资相关组件。

- `styles/subpages.css`
  - 二级工作区样式入口，只按固定顺序导入工作区模块，不承载具体规则。

- `styles/subpages/workspace-base.css`
  - 二级页面外壳、标题栏、返回按钮、上下文条、顶部统计、侧栏检查区、内容卡片和响应式工作区规则。
  - 是二级工作区的唯一基础与层级规则文件，不再叠加后置覆盖层。

- `styles/subpages/form-drawer.css`
  - 响应式表单抽屉及其状态。

- `styles/responsive.css`
  - 响应式规则。

### Project Gate

- `scripts/check-project.js`
  - 运行全部 Node 回归测试与 JavaScript 语法检查。
  - 精确检查全部浏览器脚本加载顺序、全局符号、层级职责、页面 CSS 导入顺序与缓存版本、DOM 合同、CSS 覆盖预算、品牌、Markdown 链接、Git 空白和私密账本边界。

## 4. 数据结构

数据结构以 `docs/DATA_MODEL.md` 为准。

关键约束：

- 不随意修改 state 字段名。
- 不随意修改 localStorage 主 key。
- 导入必须经过 `validateImportData`。
- `loadState` 和 `importData` 必须经过 `migrateState`。
- `normalizeState` 只负责补齐和清洗，不负责版本迁移。
- `moneyAccounts` 表示钱实际存放的位置，`accounts` 表示钱的用途；二者不得混为同一维度。
- `reconciliations` 是可追溯差额事件，不修改真实账户期初余额。

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
