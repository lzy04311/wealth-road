# Data Model

本文档记录财记当前本地 state 数据模型，用于后续维护、迁移、云同步和商业化准备。

## 1. Schema Version

### 当前版本

- 当前 `schemaVersion`: `5`
- 定义位置：`scripts/app-state.js` 中的 `CURRENT_SCHEMA_VERSION`

### v1 到 v2 迁移

当前迁移管线位于 `scripts/app-migrations.js`。

v1 -> v2 的迁移规则：

- 保留原始 state 中已有字段。
- 如果 `assetItems` 不存在或不是数组，则补为 `[]`。
- 将 `schemaVersion` 升级为 `2`。

### v2 到 v3 迁移

- 新增 `transfers` 与 `liabilities` 顶层数组。
- 为账户补齐期初余额、估值方式和归档状态。
- 为收入、支出和投资补齐实际资金账户字段。
- 为资产清单补齐估值口径、关联账户和估值日期。
- 保留所有旧记录、ID 和 localStorage 键，不推断或重写历史金额。

### v3 到 v4 迁移

- 新增 `moneyAccounts`，表示银行卡、支付账户、现金和投资平台等真实资金位置。
- 新增 `allocations`，表示资金池之间的用途调整；不计入收入、支出或净资产变化。
- 收入和支出新增 `moneyAccountId`。
- 投资新增 `sourceMoneyAccountId` 与 `targetMoneyAccountId`。
- 转账新增 `fromMoneyAccountId` 与 `toMoneyAccountId`。
- 不根据旧资金池名称猜测真实账户，所有历史真实账户引用默认留空。

### v4 到 v5 迁移

- 新增 `reconciliations`，记录真实账户余额核对及差额调整。
- 历史备份迁移时该字段补为 `[]`，不会修改期初余额或旧流水。
- 缺少真实账户引用的历史流水继续保留空引用，由用户在“历史流水待补账户”中确认。

### 未来版本升级原则

- 新增字段必须通过 migration 补齐默认值。
- 不允许在 `normalizeState()` 中偷偷完成版本升级。
- `migrateState(rawState)` 负责版本升级。
- `normalizeState(data)` 只负责字段补齐、类型清洗和默认值处理。
- 不认识的未来版本必须拒绝，不能静默降级。
- 每次升级 `schemaVersion` 后，必须同步更新导入校验和回归测试。

## 2. State Top-Level Structure

```js
{
  schemaVersion: 5,
  accounts: [],
  moneyAccounts: [],
  reconciliations: [],
  allocations: [],
  incomes: [],
  expenses: [],
  investments: [],
  transfers: [],
  snapshots: [],
  monthlyPlans: {},
  rules: "",
  assetItems: [],
  liabilities: []
}
```

### 顶层字段说明

- `schemaVersion`: number。当前备份和 state 的数据结构版本。
- `accounts`: array。资金池、预算用途、投资策略和目标配置；界面统一称为“资金池”。
- `moneyAccounts`: array。银行卡、支付账户、现金和投资平台等真实资金位置。
- `reconciliations`: array。真实账户余额核对及差额调整记录。
- `allocations`: array。资金池之间的用途调整记录。
- `incomes`: array。收入记录。
- `expenses`: array。支出记录。
- `investments`: array。投资、储蓄、转入、转出记录。
- `snapshots`: array。资产账户净值快照。
- `monthlyPlans`: object。按月份保存计划收入和发薪日。
- `rules`: string。用户自定义资金规则文本。
- `assetItems`: array。非账户型资产或实物/订阅/软件等资产清单。
- `transfers`: array。账户之间的双边内部调拨，不计入收入、支出或净资产变化。
- `liabilities`: array。信用卡、贷款和借款等当前未偿还余额。

### v4 双维度财务口径

- `accounts.openingBalance` / `openingBalanceDate`: 建账前已经存在的账户余额和生效日期。
- `accounts.valuationMethod`: `流水余额` 由交易流水推导；`净值快照` 使用最近快照并补计快照后的资金变动。
- `incomes.accountId`: 收入归属资金池；为空时进入待分配资金。
- `incomes.moneyAccountId`: 实际到账的银行卡、支付宝等资金账户。
- `expenses.accountId`: 使用的消费资金池；`moneyAccountId` 是实际付款账户。
- `investments.accountId`: 长期投资、高风险投资等策略资金池。
- `investments.sourceMoneyAccountId` / `targetMoneyAccountId`: 实际付款位置和投资资金位置。
- 旧 `sourceAccountId`、`fromAccountId`、`toAccountId` 只用于兼容历史数据，不再由新表单写入。
- `assetItems.valuationMode`: `独立计入`、`关联账户`、`不计入` 或 `待确认`。现金和投资类旧清单默认待确认，避免重复计入。
- `assetItems.valuationDate`: 当前估值的生效日期。
- `liabilities.balanceDate`: 当前负债余额的生效日期。

统一公式：`净资产 = 金融资产 + 独立计入资产 - 未结清负债`。建立真实账户后，`金融资产 = 真实账户账面余额合计 + 投资浮动盈亏`；内部转账和资金用途分配只改变分布，不改变净资产。

## 3. Entity Fields

### accounts

账户对象字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 账户唯一 id。其他记录通过 `accountId` 关联它。 |
| `name` | string | 账户名称。为空时归一化为 `未命名账户`。 |
| `type` | string | 账户类型，必须属于 `accountTypes`，否则归一化为 `其他`。 |
| `budgetPercent` | number | 月度预算比例，范围 `0-100`。 |
| `fixedBudget` | boolean | 是否作为固定比例预算账户。 |
| `includeExpense` | boolean | 是否计入支出预算统计。 |
| `includeAsset` | boolean | 是否计入资产统计。 |
| `target` | number | 账户目标金额，范围 `0-999999999`。 |
| `openingBalance` | number | 建账前已有的资金池余额。 |
| `openingBalanceDate` | string | 期初余额生效日期。 |
| `valuationMethod` | string | `流水余额` 或 `净值快照`。 |
| `archived` | boolean | 是否停止用于新记录。 |
| `note` | string | 备注，最大长度受 `MAX_NOTE_LENGTH` 限制。 |

### moneyAccounts

真实资金账户字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 实际账户唯一 id。 |
| `name` | string | 工资卡、支付宝、现金、证券账户等名称。 |
| `type` | string | `银行卡`、`支付账户`、`现金`、`投资账户` 或 `其他`。 |
| `openingBalance` | number | 开始记账前可以核对的真实余额。 |
| `openingBalanceDate` | string | 期初余额生效日期；更早的关联流水不参与该账户余额计算。 |
| `archived` | boolean | 是否停止用于新流水。 |
| `note` | string | 备注。 |

### reconciliations

余额核对与差额调整字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 核对记录唯一 id。 |
| `date` | string | 核对日期。 |
| `month` | string | 由日期自动派生的月份。 |
| `moneyAccountId` | string | 被核对的真实账户。 |
| `bookBalance` | number | 核对前系统账面余额。 |
| `actualBalance` | number | 银行或平台显示的实际余额。 |
| `adjustment` | number | `actualBalance - bookBalance`，作为可追溯差额事件计入后续余额。 |
| `note` | string | 差额原因或核对备注。 |

删除核对记录会撤销该差额影响；系统不会通过核对修改真实账户的期初余额。

### allocations

资金用途调整字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 分配记录唯一 id。 |
| `date` | string | 调整日期。 |
| `month` | string | 由日期自动派生的月份。 |
| `fromAccountId` | string | 转出资金池；为空表示从待分配资金转出。 |
| `toAccountId` | string | 转入资金池。 |
| `amount` | number | 调整金额。 |
| `note` | string | 备注。 |

### incomes

收入记录字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 收入记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`；由 `date` 自动派生，不单独录入。 |
| `accountId` | string | 收入归属的资金池；为空表示待分配资金。 |
| `moneyAccountId` | string | 收入实际到账的真实账户。 |
| `source` | string | 收入来源，必须属于 `incomeSources`，否则归一化为 `其他`。 |
| `amount` | number | 收入金额，范围 `0-999999999`。 |
| `note` | string | 备注。 |

### expenses

支出记录字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 支出记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`；由 `date` 自动派生，不单独录入。 |
| `accountId` | string | 关联的 `accounts[].id`。 |
| `moneyAccountId` | string | 实际扣款的真实账户。 |
| `sourceAccountId` | string | 旧数据兼容字段；建立真实账户后不再作为实际付款位置写入。 |
| `category` | string | 支出分类，为空时归一化为 `未分类`。 |
| `amount` | number | 支出金额，范围 `0-999999999`。 |
| `note` | string | 备注。 |

### investments

投资/储蓄记录字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 投资记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`；由 `date` 自动派生，不单独录入。 |
| `accountId` | string | 关联的 `accounts[].id`。 |
| `sourceMoneyAccountId` | string | 投资动作的实际转出账户。 |
| `targetMoneyAccountId` | string | 投资动作的实际转入账户；同平台交易可与转出账户相同。 |
| `sourceAccountId` | string | 旧数据兼容字段。 |
| `type` | string | 投资类型，必须属于 `investmentTypes`，否则归一化为 `投资`。 |
| `amount` | number | 金额，范围 `0-999999999`。 |
| `product` | string | 产品名称或标的名称。 |
| `note` | string | 备注。 |

说明：

- `type === "转出"` 时，在余额和投资净额计算中按负数处理。
- 其他类型通常按正向投入处理。

### transfers

账户间转账字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 转账记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`；由 `date` 自动派生，不单独录入。 |
| `fromMoneyAccountId` | string | 转出真实账户的 `moneyAccounts[].id`。 |
| `toMoneyAccountId` | string | 转入真实账户的 `moneyAccounts[].id`；必须与转出账户不同。 |
| `fromAccountId` | string | 旧资金池转账兼容字段；新表单不再写入。 |
| `toAccountId` | string | 旧资金池转账兼容字段；新表单不再写入。 |
| `amount` | number | 转账金额，范围 `0-999999999`。 |
| `note` | string | 备注。 |

### snapshots

净值快照字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 快照唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`；由 `date` 自动派生，不单独录入。 |
| `accountId` | string | 关联的 `accounts[].id`。 |
| `marketValue` | number | 当前市值或真实余额。 |
| `principal` | number | 累计本金。 |
| `note` | string | 备注。 |

### monthlyPlans

`monthlyPlans` 是以月份为 key 的对象：

```js
{
  "2026-05": {
    plannedIncome: 12000,
    payday: 15
  }
}
```

字段说明：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `plannedIncome` | number 或 empty string | 本月计划收入。空字符串表示未设置。 |
| `payday` | number | 发薪日，范围 `1-31`，默认 `15`。 |

### assetItems

资产清单字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 资产条目唯一 id。 |
| `kind` | string | 资产类型，必须属于 `assetKinds`，否则归一化为 `其他`。 |
| `name` | string | 资产名称，为空时归一化为 `未命名资产`。 |
| `owner` | string | 归属、位置、持有人或使用主体。 |
| `purchasePrice` | number | 购买价或本金。 |
| `currentValue` | number | 当前估值或余额。 |
| `monthlyCost` | number | 月成本，例如订阅费、维护费。 |
| `renewalDate` | string | 续费日或到期日，格式 `YYYY-MM-DD`，可为空。 |
| `status` | string | 状态，必须属于 `assetStatuses`，否则归一化为 `在用`。 |
| `note` | string | 备注。 |

### rules

- `rules` 是一段用户自定义文本。
- 用于记录个人资金管理原则、预算规则、资产配置纪律等。
- 当前最大长度按 `cleanText(base.rules, 5000)` 清洗。

## 4. Data Relationships

### Account References

- 资金池引用：`incomes[].accountId`、`expenses[].accountId`、`investments[].accountId`、`snapshots[].accountId`、`allocations[].fromAccountId/toAccountId` 关联 `accounts[].id`。
- 真实账户引用：收入和支出的 `moneyAccountId`、投资的 `sourceMoneyAccountId/targetMoneyAccountId`、转账的 `fromMoneyAccountId/toMoneyAccountId`、余额核对的 `moneyAccountId` 关联 `moneyAccounts[].id`。

当前代码中渲染账户名时，如果找不到账户，会显示 `已删除账户`。

### 删除账户为什么要谨慎

资金池或真实账户被历史记录引用时，直接删除会使记录失去配置上下文。当前界面会将这类账户归档并停止用于新记录；只有没有任何引用的账户才允许删除。

历史引用覆盖收入、支出、投资、转账、净值快照、资金分配和余额核对。归档不会删除这些历史记录，并支持撤销恢复。

### 页面和计算依赖

- Dashboard
  - 依赖 `accounts`, `moneyAccounts`, `reconciliations`, `incomes`, `expenses`, `investments`, `snapshots`, `liabilities`, `monthlyPlans`。
  - 关键计算：`monthlySummary`, `financialHealth`, `monthlyForecast`, `assetSnapshotSummary`, `wealthSummary`。

- Assets
  - 依赖 `accounts.includeAsset`, `investments`, `snapshots`, `assetItems`。
  - 快照优先用于真实净值；没有快照时回退到累计投资净额。

- Investments
  - 依赖 `accounts.includeAsset`, `investments`, `snapshots`。
  - `type === "转出"` 会减少投资净额。

- Flow
  - 依赖 `incomes`, `expenses`, `investments`, `monthlyPlans`。
  - 用于流水、月度节奏、预算消耗和现金流判断。

- Accounts
  - 依赖 `moneyAccounts`, `reconciliations`, `allocations`, `accounts` 和各类历史流水。
  - 用于真实余额核对、历史账户补全和资金用途调整。

## 5. Data Safety Rules

- 不允许随意修改 state 字段名。
- 不允许随意修改 localStorage 主 key。
- 导入数据必须经过 `validateImportData()`。
- 导入中的实体必须是对象，并具有合法且在各自集合内唯一的 ID。
- 非空账户引用必须指向现存资金池或真实账户；历史未关联记录允许保留空引用。
- 日期、月份、金额、比例、转账两端和余额核对差额必须通过实体级约束。
- `loadState()` 和 `importData()` 必须统一经过 `migrateState()`。
- `normalizeState()` 只负责补齐字段、清洗类型、约束范围和默认值。
- `normalizeState()` 不负责版本迁移。
- 未知未来版本必须拒绝导入，不能静默降级。
- 数据导入前必须生成当前 state 自动备份。
- 校验失败时不得覆盖当前 state。

## 6. Cloud Sync Boundary

仓库已有可选 Supabase 同步模块和完整 state `jsonb` 方案，但默认配置为空，当前现役模式仍是本地 `localStorage`。启用前必须配置认证、RLS、重定向地址并完成真实多设备冲突验收。

建议第一阶段云端结构：

```sql
user_finance_states (
  user_id uuid primary key,
  schema_version integer not null,
  state jsonb not null,
  updated_at timestamptz not null
)
```

原因：

- 当前项目仍处于本地优先和工程加固期，数据模型还可能继续演化。
- 完整 state jsonb 更接近现有导入/导出备份格式，迁移成本低。
- 可以复用当前 `validateImportData -> migrateState -> normalizeState` 管线。
- 避免过早拆表导致 schema 频繁变更、同步冲突和迁移成本上升。

只有当字段和业务边界稳定、且多设备同步成为明确产品目标后，才考虑把账户、流水、快照、资产清单拆成独立表。
