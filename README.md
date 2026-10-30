# fmode-code-agent · 纯 JS 网页版 Bot 智能体开发规则仓

> **这是方便数字人（FmodeAgent / FmodeCode）进行项目开发的基础规则技能。**
> 它把踩过的坑沉淀成硬性约束，让 AI 在生成代码时不重犯同类错误。

> **未来飞马 — 让 AI 进化提前发生，让 AI 落地快人一步**

`fmode-code-agent` 是 FMODE 组织下的 **智能体（Agent）开发规则仓库**：为「纯 JS（浏览器 + Node 双兼容、
无任何打包器）实现的网页版 Bot 智能体」定义一套可被 AI（Claude Code / FmodeCode）直接执行的工程规则。

本仓 **不是** 框架，也 **不是** 运行时库。它是 **规则 + 脚手架技能** 的组合体：

| 交付物 | 路径 | 作用 |
|--------|------|------|
| 规则总纲 | [`CLAUDE.md`](./CLAUDE.md) | AI 进入本仓/引用本仓的第一入口，索引全部规则 |
| 分层规则 | [`.claude/rules/`](./.claude/rules/) | 三层架构、MCP/Skill、LangGraph 无构建、实测、部署、坑位逐篇规范 |
| 全局技能 | [`skills/fmode-code-agent/`](./skills/fmode-code-agent/) | 给 AI 的智能体项目初始化技能 + 脚手架 |

> 姊妹仓：**[fmode-code-lit](https://github.com/fmodecn/fmode-code-lit)**（Lit 前端无构建规范）。
> 前端细节以 lit 仓为准，智能体细节以本仓为准，两者可叠加使用。

## 一句话记住它

> **Agent 决策、MCP 协议、Skill 执行。换 Agent 框架时，MCP 与 Skill 一行不改。**

## 三层架构

```
Agent（决策）   决定「这轮调不调工具、调哪个」。可换框架（PageAgent ⇄ LangGraph）。
  └─ MCP（协议） 把工具暴露成 JSON-RPC 2.0（浏览器常跑在 Web Worker）。不含业务编排。
       └─ Skill（实现）真正干活（出图/转写/分析），纯函数式能力。
```

**验收标准**：本项目把 Agent 从 PageAgent 换到 LangGraph，**MCP 与 Skill 零改动**。

## 规则索引

| # | 规则篇 | 内容 |
|---|--------|------|
| 1 | [`agent-architecture.md`](./.claude/rules/agent-architecture.md) | 三层职责、图编排 vs Re-act、State 放什么、可观测性 |
| 2 | [`agent-mcp-skill.md`](./.claude/rules/agent-mcp-skill.md) | MCP 契约、多 MCP 命名空间、Worker 铁律、Skill 注册/调用、隔离 |
| 3 | [`no-build-langgraph.md`](./.claude/rules/no-build-langgraph.md) | LangGraph.js 浏览器无构建配方（importmap + 3 替身 + 6 坑） |
| 4 | [`llm-gateway.md`](./.claude/rules/llm-gateway.md) | OpenAI 兼容、usage 真值、**静默忽略参数**陷阱、多模态拼接 |
| 5 | [`measurement.md`](./.claude/rules/measurement.md) | token 归因、**输入/输出比例**、框架调度 vs IO 计时 |
| 6 | [`agent-ui-bridge.md`](./.claude/rules/agent-ui-bridge.md) | 事件流/阶段/进度、失败如实说明、移动端 |
| 7 | [`deployment.md`](./.claude/rules/deployment.md) | 无构建部署 + **自动部署**（hook/CI/watch）+ 验真 |
| 8 | [`pitfalls.md`](./.claude/rules/pitfalls.md) | 24 条血泪坑位合集 |

## 技术底座

- **语言**：纯 JS（ESM），浏览器与 Node 双兼容（核心无 Node 专有 API）
- **图编排**：LangGraph.js（`@langchain/langgraph`），浏览器靠 importmap + 替身直跑
- **工具协议**：MCP（JSON-RPC 2.0），浏览器端跑在 Web Worker
- **模型调用**：自写最小 OpenAI 兼容客户端（不引 SDK）
- **观测**：自写 telemetry（token / 耗时分离）
- **部署**：无构建直传 OBS + CDN；提交后自动部署

## 用法

```bash
# 0) 安装（npm）
npm i @fmode/skill-code-agent          # 装到 node_modules，技能目录在 node_modules/@fmode/skill-code-agent/skills/

# 1) 生成智能体骨架
node node_modules/@fmode/skill-code-agent/skills/fmode-code-agent/scripts/scaffold.mjs ./my-agent --project my-agent

# 2) 给已有项目装规则
node node_modules/@fmode/skill-code-agent/skills/fmode-code-agent/scripts/install-rules.mjs .

# 3) 自检
node node_modules/@fmode/skill-code-agent/skills/fmode-code-agent/scripts/smoke.mjs
```

## 四条铁律

1. **浏览器 + Node 双兼容**：核心纯 JS；`fs`/`path` 只在分发脚本里用。
2. **不用构建**：不引打包器；依赖走 importmap（浏览器）或 npm（Node）。
3. **凭据不进 Worker / 日志 / 代码**：要凭据的动作在**主线程**执行。
4. **参数以实测为准**：网关会**静默忽略**参数 —— 必须**验证副作用**，不能只看 200。

## 开源协议

MPL-2.0（见 [LICENSE](./LICENSE)）。商标「未来飞马」等不随协议授权。
