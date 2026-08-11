# Raw Finance Ledger

## Purpose

`data/raw/wealth-events.csv` is the private, append-only source ledger for this wealth system. It is designed for three jobs:

1. Preserve every confirmed financial change and the original natural-language message.
2. Provide stable structured rows for later analysis.
3. Preserve enough identifiers and raw payloads to migrate into a future data model.

The file is intentionally ignored by Git. Do not upload it to the public repository.

## Source Of Truth

- The CSV is an immutable event log, not a current-state table.
- Existing rows are never edited or deleted.
- Corrections append a new `correction` or reversing event and reference the old row through `supersedes_event_id`.
- `source_text_base64` preserves the exact UTF-8 user message.
- `source_text_sha256` verifies the original message.
- `row_hash_sha256` detects accidental or manual changes to a stored row.
- `raw_payload_json` preserves the interpreted event or the original object imported from an App backup.

## Natural-Language Recording Flow

For an unambiguous actual event, Codex should:

1. Identify whether the message describes a completed event, not a question or hypothetical scenario.
2. Resolve the effective date in `Asia/Shanghai`; default to today only when no date is given.
3. Preserve the user's complete original message in `source_text`.
4. Build one or more structured events.
5. Reject unclear amounts, transaction directions, or incomplete transfers.
6. Append through the ledger CLI and run validation.
7. Return the generated event ID and structured summary.

Missing optional classification can be saved with `review_state=needs_review`. Missing essential facts must be clarified before writing.

Canonical account names are `日常开支`, `学习成长`, `长期投资`, `备用现金`, `高风险投资`, `应急金`, and `娱乐消费`. Older or conversational aliases are normalized to these names while the original wording remains in `source_text_base64`.

## Event Types

| Type | Use |
| --- | --- |
| `income` | Salary, bonus, side income, refunds received. |
| `expense` | Completed spending. |
| `transfer` | Money moved between two owned accounts; requires both endpoints. |
| `investment` | Investment contribution, purchase, sale, dividend, or withdrawal. |
| `savings` | Savings contribution or withdrawal. |
| `asset_snapshot` | Account market value or real balance at a date. |
| `asset_item` | Physical asset, software, subscription, or other inventory change. |
| `account` | Account creation or configuration event. |
| `monthly_plan` | Planned income or payday for a month. |
| `goal` | Goal target or goal configuration. |
| `rule_set` | Personal financial rule change. |
| `correction` | Correction or reversal of an earlier event. |
| `state_import` | Exact full App JSON backup retained during migration. |

`event_subtype` carries more specific meaning such as salary, dining, buy, sell, dividend, or the legacy investment type.

## Important Columns

- Identity: `event_id`, `entity_id`, `supersedes_event_id`.
- Time: `recorded_at`, `effective_date`, `month`.
- Classification: `event_type`, `event_subtype`, `category`, `subcategory`, `tags`.
- Money direction: `account`, `from_account`, `to_account`, `amount`, `currency`.
- Investment and asset facts: `asset_name`, `quantity`, `unit_price`, `market_value`, `principal`.
- Planning: `target_amount`, `planned_income`, `payday`, `renewal_date`.
- Audit: `source_channel`, `source_message_id`, `source_text_base64`, both SHA-256 fields, `raw_payload_json`.

Money values are stored as decimal text with two decimal places to avoid binary floating-point drift. Quantity and unit price allow eight decimal places.

## Commands

```powershell
node scripts/finance-ledger.js init
node scripts/finance-ledger.js validate
node scripts/finance-ledger.js tail --limit 10
```

Codex appends a UTF-8 JSON object encoded as base64:

```powershell
node scripts/finance-ledger.js append --base64 <UTF8_JSON_BASE64>
```

After exporting the current App data as JSON, preserve and convert it with:

```powershell
node scripts/finance-ledger.js import-state --input <backup.json>
node scripts/finance-ledger.js validate
```

The import writes one `state_import` row containing the original JSON text byte-for-byte after UTF-8 decoding and additional normalized rows for analysis. It never modifies the source backup.

## Examples

Natural language:

> 今天午饭 32 元，记到日常开支。

Structured event:

```json
{
  "event_type": "expense",
  "effective_date": "2026-08-12",
  "amount": "32.00",
  "currency": "CNY",
  "account": "日常开支",
  "category": "餐饮",
  "review_state": "verified",
  "source_text": "今天午饭 32 元，记到日常开支。"
}
```

Transfer:

> 从备用现金转 1000 元到应急金。

This must become one `transfer` row with both `from_account` and `to_account`. It must not create income or expense.
