# Document Priority Notice

本文件为早期项目规则/个人偏好记录。若与 `docs/ENGINEERING_STATUS.md`、`docs/DATA_MODEL.md`、`docs/DESIGN_SYSTEM.md` 冲突，以 `docs/` 下的新文档为准。

# AI_RULES

## 项目性质

这是我的本地个人资产管理系统，只给我自己使用。

## 私人应用原则

财记不是面向大众的商业产品，而是我的私人资金管理应用。

不要把它做成标准记账 App、标准理财 App 或冷冰冰后台系统。
它优先服务我的个人使用逻辑、审美偏好和判断需求。

判断标准不是“是否像成熟产品”，而是：
- 是否让我更快理解当前资金状态
- 是否降低我的记录和判断摩擦
- 是否符合我的温暖手账风与个人语言系统
- 是否保留我的资金命名和生活边界感
- 是否让我愿意长期打开和使用

## 固定原则

* 本地优先
* 简洁可维护
* 数据安全优先
* 保持温暖手账风
* 不做商业 SaaS
* 不做人生管理器
* 不做知识库
* 不做任务管理器
* 私人使用逻辑优先于通用产品规范
* 信息密度要有设计，不要堆叠页面
* 二级页面应尽量采用横向、错落、折叠、主次分明的面板编排
* 操作入口要轻，核心状态要重

## 禁止事项

* 不修改 localStorage key
* 不随意修改 state 字段名
* 不删除旧数据兼容逻辑
* 不引入外部库，除非我明确同意
* 不做登录
* 不做云同步
* 不做后端数据库
* 不做真实账户抓取
* 不重写整个项目
* 不输出整文件，除非我明确要求
* 不把页面做成多个旧模块从上到下拼接
* 不为了通用性抹掉我的个性化账户命名
* 不把所有信息默认完整展开
* 不让表格和长列表占据页面主视觉

## 每次修改前必须判断

1. 是否符合 ARCHITECTURE.md？
2. 是否符合 ROADMAP.md？
3. 是否会影响数据结构？
4. 是否会增加维护复杂度？
5. 是否真的需要现在做？

## 输出格式

* 先说影响范围
* 再给必要改动
* 不长篇解释
* 最后给最多 5 条测试清单

## Repomix 使用规则

* repomix-output.xml 只是代码库快照，不是源文件。
* 日常修改不得依赖旧的 repomix-output.xml。
* 如果 repomix-output.xml 与 index.html、styles.css、app.js 不一致，以原始源文件为准。
* 只有做全局审查、整体重构评估、重复代码检查时，才允许使用最新生成的 repomix-output.xml。
* 不要修改 repomix-output.xml，任何修改都必须回到原始源文件。
* 生成 repomix 文件时，文件名必须带日期时间，避免误用旧版本。

## 渲染文件边界

* 首页总览渲染：优先改 `scripts/app-render-dashboard.js`。
* 资产页渲染：优先改 `scripts/app-render-assets.js`。
* 流水页渲染（收入/支出/计划收入/分配页账户区）：优先改 `scripts/app-render-records.js`。
* 投资页渲染（投资驾驶舱/持仓卡片/投资记录）：优先改 `scripts/app-render-investments.js`。
* 流水页概览与交互联动（顶部概览/Tab/复盘折叠）：优先改 `scripts/app-render-flow.js`。
* 月账、目标、统一 renderAll 入口：优先改 `scripts/app-render-monthly.js`。
* 通用渲染工具、空状态、饼图、通用卡片函数：才改 `scripts/app-render-core.js`。
* `scripts/app-render.js` 只是兼容说明文件，正常任务不要改。
* 首页样式优先改 `styles/dashboard.css`。
* 通用组件样式才改 `styles/components.css`。
* 不要为了一个页面的小改动跨多个渲染文件乱改。
