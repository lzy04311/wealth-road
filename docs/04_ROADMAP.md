# Roadmap

本文件记录当前阶段路线图。若与 `docs/ENGINEERING_STATUS.md`、`docs/DATA_MODEL.md`、`docs/DESIGN_SYSTEM.md` 冲突，以 `docs/` 下的新文档为准。

## 1. 已完成：工程加固阶段

当前工程加固已阶段性完成：

- P0 数据安全加固。
- `scripts/app-data-safety.test.js` 已扩展到 35 个回归测试。
- 当前 schema 已推进到 v5，包含真实账户、资金用途分配和余额核对。
- 已加入两侧真实账户转账、账户归档和历史流水补账户流程。
- state 层拆分：
  - `scripts/app-state.js`
  - `scripts/app-validators.js`
  - `scripts/app-migrations.js`
  - `scripts/app-storage.js`
- actions 层拆分：
  - `scripts/app-actions-data.js`
  - `scripts/app-actions-crud.js`
  - `scripts/app-actions-quick-entry.js`
  - `scripts/app-actions-modals.js`
  - `scripts/app-actions-navigation.js`
  - `scripts/app-actions.js`
- CSS 注释分区：
  - `styles/base.css`
  - `styles/components.css`
  - `styles/pages.css`
  - `styles/responsive.css`
- 新增核心文档：
  - `docs/ENGINEERING_STATUS.md`
  - `docs/DATA_MODEL.md`
  - `docs/DESIGN_SYSTEM.md`

## 2. 当前优先级

### P0

- 数据安全。
- 备份可靠性。
- 导入导出可靠性。
- localStorage 损坏恢复。
- 明确 schema migration。

当前 P0 已完成一轮加固，后续只在发现真实风险时继续处理。

### P1

- 二级页面布局统一与表单抽屉进入收尾阶段。
- Dashboard 视觉复刻需要独立任务继续。
- CSS 逐步迁移和作用域收紧。
- render 层后续拆分评估。
- 保持现役文档与界面的“财记”品牌口径一致。

### P2

- 更完整的测试覆盖。
- 完整浏览器写入、归档、核对、导出和恢复流程测试。
- 旧 selector 验证和清理。
- 更细的组件边界整理。

## 3. 下一阶段建议

下一阶段可以回到视觉和体验，但必须遵守 `docs/DESIGN_SYSTEM.md`：

- Dashboard 视觉复刻继续。
- 保持香槟金金融座舱和私人财富驾驶舱方向。
- 不把 dashboard 改回普通堆卡片仪表盘。
- 二级页面逐步统一，而不是一次性大规模重写。
- CSS 迁移采用小步、可回退策略。
- render 层拆分先评估，再执行。

## 4. 暂不做

当前仍然保持以下限制：

- 暂不登录。
- 暂不云同步。
- 暂不小程序。
- 暂不 App Store。
- 暂不自动净值抓取。
- 暂不接入真实账户、券商、基金接口。
- 暂不引入前端框架。
- 暂不做大规模 CSS 迁移。

## 5. 每次新增功能前必须确认

1. 是否符合 `docs/ENGINEERING_STATUS.md`。
2. 是否会改变 state 字段名。
3. 是否会改变 localStorage key。
4. 是否需要 migration。
5. 是否需要新增测试。
6. 是否符合 `docs/DESIGN_SYSTEM.md`。
7. 是否真的属于当前阶段。
