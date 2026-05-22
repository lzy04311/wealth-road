# Data Model

本文档记录财富志当前本地 state 数据模型，用于后续维护、迁移、云同步和商业化准备。

## 1. Schema Version

### 当前版本

- 当前 `schemaVersion`: `2`
- 定义位置：`scripts/app-state.js` 中的 `CURRENT_SCHEMA_VERSION`

### v1 到 v2 迁移

当前迁移管线位于 `scripts/app-migrations.js`。

v1 -> v2 的迁移规则：

- 保留原始 state 中已有字段。
- 如果 `assetItems` 不存在或不是数组，则补为 `[]`。
- 将 `schemaVersion` 升级为 `2`。

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
  schemaVersion: 2,
  accounts: [],
  incomes: [],
  expenses: [],
  investments: [],
  snapshots: [],
  monthlyPlans: {},
  rules: "",
  assetItems: []
}
```

### 顶层字段说明

- `schemaVersion`: number。当前备份和 state 的数据结构版本。
- `accounts`: array。资金账户、预算账户、资产账户、目标账户配置。
- `incomes`: array。收入记录。
- `expenses`: array。支出记录。
- `investments`: array。投资、储蓄、转入、转出记录。
- `snapshots`: array。资产账户净值快照。
- `monthlyPlans`: object。按月份保存计划收入和发薪日。
- `rules`: string。用户自定义资金规则文本。
- `assetItems`: array。非账户型资产或实物/订阅/软件等资产清单。

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
| `note` | string | 备注，最大长度受 `MAX_NOTE_LENGTH` 限制。 |

### incomes

收入记录字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 收入记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`。 |
| `source` | string | 收入来源，必须属于 `incomeSources`，否则归一化为 `其他`。 |
| `amount` | number | 收入金额，范围 `0-999999999`。 |
| `note` | string | 备注。 |

### expenses

支出记录字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 支出记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`。 |
| `accountId` | string | 关联的 `accounts[].id`。 |
| `category` | string | 支出分类，为空时归一化为 `未分类`。 |
| `amount` | number | 支出金额，范围 `0-999999999`。 |
| `note` | string | 备注。 |

### investments

投资/储蓄记录字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 投资记录唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`。 |
| `accountId` | string | 关联的 `accounts[].id`。 |
| `type` | string | 投资类型，必须属于 `investmentTypes`，否则归一化为 `投资`。 |
| `amount` | number | 金额，范围 `0-999999999`。 |
| `product` | string | 产品名称或标的名称。 |
| `note` | string | 备注。 |

说明：

- `type === "转出"` 时，在余额和投资净额计算中按负数处理。
- 其他类型通常按正向投入处理。

### snapshots

净值快照字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | 快照唯一 id。 |
| `date` | string | 日期，格式 `YYYY-MM-DD`。 |
| `month` | string | 月份，格式 `YYYY-MM`。 |
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

- `expenses[].accountId` 关联 `accounts[].id`。
- `investments[].accountId` 关联 `accounts[].id`。
- `snapshots[].accountId` 关联 `accounts[].id`。

当前代码中渲染账户名时，如果找不到账户，会显示 `已删除账户`。

### 删除账户为什么要谨慎

账户被以下记录引用时，删除会导致历史记录失去账户配置上下文：

- 支出记录：`expenses`
- 投资/储蓄记录：`investments`
- 净值快照：`snapshots`

因此删除账户时需要二次确认。删除后历史记录不会自动删除，但相关账户名称会退化为 `已删除账户`。

### 页面和计算依赖

- Dashboard
  - 依赖 `accounts`, `incomes`, `expenses`, `investments`, `snapshots`, `monthlyPlans`。
  - 关键计算：`monthlySummary`, `financialHealth`, `monthlyForecast`, `assetSnapshotSummary`。

- Assets
  - 依赖 `accounts.includeAsset`, `investments`, `snapshots`, `assetItems`。
  - 快照优先用于真实净值；没有快照时回退到累计投资净额。

- Investments
  - 依赖 `accounts.includeAsset`, `investments`, `snapshots`。
  - `type === "转出"` 会减少投资净额。

- Flow
  - 依赖 `incomes`, `expenses`, `investments`, `monthlyPlans`。
  - 用于流水、月度节奏、预算消耗和现金流判断。

## 5. Data Safety Rules

- 不允许随意修改 state 字段名。
- 不允许随意修改 localStorage 主 key。
- 导入数据必须经过 `validateImportData()`。
- `loadState()` 和 `importData()` 必须统一经过 `migrateState()`。
- `normalizeState()` 只负责补齐字段、清洗类型、约束范围和默认值。
- `normalizeState()` 不负责版本迁移。
- 未知未来版本必须拒绝导入，不能静默降级。
- 数据导入前必须生成当前 state 自动备份。
- 校验失败时不得覆盖当前 state。

## 6. Cloud Sync Preparation

如果未来接入 Supabase 或其他云数据库，第一阶段建议仍然把完整 state 作为一个 `jsonb` 文档保存，而不是一开始拆成多张关系表。

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

未来当字段和业务边界稳定后，再考虑把账户、流水、快照、资产清单拆成独立表。
