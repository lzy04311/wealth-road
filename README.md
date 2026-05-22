# 财富志 / 本地优先私人资金管理网页

财富志是一个本地优先的私人资金管理网页应用，用于记录和理解现金流、投资状态、资产变化、资金分配边界和阶段性目标。

当前项目已经完成一轮工程加固，处于阶段性收口状态。后续可以在不破坏数据安全和工程边界的前提下，继续 dashboard 视觉复刻、二级页面统一和小步维护。

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

## 使用方式

直接打开 `index.html`，或使用 VS Code Live Server 打开。

## 数据说明

- 数据仍保存在浏览器 `localStorage`。
- 不要随意修改 localStorage 主 key。
- 不要随意修改 state 字段名。
- 导出 JSON 备份时，不要把个人备份数据提交到代码仓库。
