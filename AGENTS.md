# Repository Agent Instructions

## Project Operating Contract

- 财记是本地优先的私人资金管理网页应用，使用原生 HTML、CSS 和 JavaScript，无构建步骤。
- 浏览器入口是 `index.html`；PWA 验证需要 localhost HTTP 服务。
- 工程修改后运行 `node scripts/check-project.js`，不得通过降低门禁阈值掩盖失败。
- 当前权威工程状态是 `docs/ENGINEERING_STATUS.md`，数据结构以 `docs/DATA_MODEL.md` 为准，视觉以 `docs/DESIGN_SYSTEM.md` 为准。
- 保持现有 localStorage 主 key、state 字段和迁移链兼容；新增结构必须配套 migration 与测试。
- 不引入框架或外部依赖、不大规模重写、不启用云同步，除非用户明确授权对应范围。
- 可选 Supabase 模块默认禁用；在认证、RLS、冲突处理、同源客户端脚本和部署配置验证前不得启用。
- 小步修改并保留可回退性；现役代码优先于历史计划和归档资料。

## Financial Recording Protocol

When the user describes an actual financial change in natural language, record it in the private append-only ledger through `scripts/finance-ledger.js`.

- Treat questions, examples, forecasts, and hypothetical scenarios as non-recording requests unless the user explicitly says the event happened or asks to record it.
- Preserve the user's original message exactly in `source_text`. The ledger tool stores an exact base64 copy and SHA-256 digest as well.
- Use `CNY` when the user gives no currency and the surrounding context is this personal wealth system.
- Resolve relative dates such as "today" in `Asia/Shanghai`. If no date is given for a clearly completed event, use today's date and say so in the result.
- Never invent an amount, transaction direction, or transfer endpoint. Ask a short clarification when one of those is ambiguous.
- A transfer must contain both `from_account` and `to_account`, and the two accounts must differ.
- Missing nonessential classification such as category may be left blank with `review_state=needs_review`; report that status to the user.
- Do not edit or delete an existing CSV row. Corrections are new `correction` or reversing events with `supersedes_event_id`.
- Use these canonical account names when the user's wording clearly matches: `日常开支`, `学习成长`, `长期投资`, `备用现金`, `高风险投资`, `应急金`, `娱乐消费`.
- Normalize common aliases without asking: `生活费/吃饭/交通/日常` -> `日常开支`; `学习/课程/书籍/健身` -> `学习成长`; `定投/核心仓/长线` -> `长期投资`; `现金/短债/活钱` -> `备用现金`; `A股玩耍仓/兴趣仓/短线` -> `高风险投资`; `保命钱/安全垫` -> `应急金`; `败家/娱乐/小确幸` -> `娱乐消费`.
- Append with `node scripts/finance-ledger.js append --base64 <UTF8_JSON_BASE64>`, then run `node scripts/finance-ledger.js validate`.
- After a successful append, report the event ID, date, type, amount, account direction, and review state.
- Never stage or commit `data/raw/wealth-events.csv`; it contains private financial information and is intentionally ignored by Git.

The schema and examples are documented in `docs/RAW_FINANCE_LEDGER.md`.
