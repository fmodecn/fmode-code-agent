---
name: fmode-code-agent
description: "用纯 JS（浏览器 + Node 双兼容、无构建）写网页版 Bot 智能体。触发词：智能体、agent、MCP、Skill、LangGraph、Re-act、工具调用 function calling、Web Worker MCP、Agent 架构、token 实测、自动部署。适用场景：(1) 新建一个网页内跑的智能体（对话 + 工具调用）(2) 把能力封装成 MCP 工具 / 接入多个 MCP (3) 用 LangGraph.js 做图编排（浏览器无构建）(4) 给智能体加 token/速度实测与输入输出比例 (5) 配自动部署。产出遵循 fmode-code-agent 规则仓的分层与命名规范。"
description_en: "Build in-page Bot agents in pure JS (browser + Node compatible, no build). Triggers: agent, MCP, Skill, LangGraph, Re-act, function calling, Web Worker MCP, agent architecture, token measurement, auto-deploy. Use for: (1) scaffolding a web agent (chat + tool calls), (2) wrapping capabilities as MCP tools / joining multiple MCPs, (3) LangGraph.js graph orchestration without a bundler, (4) adding token/latency measurement and input/output ratio, (5) setting up auto-deploy. Output follows the fmode-code-agent rules repo's layering and naming conventions."
schema_version: 1.0.0
level: system
category: development
keywords:
  - agent
  - mcp
  - skill
  - langgraph
  - react-loop
  - function-calling
  - tool-calling
  - webworker
  - no-build
  - native-esm
  - importmap
  - token
  - telemetry
  - browser
  - node
  - fmode
version: 1.0.0
author: Yuyang001 (FmodeAgent)
license: MPL-2.0
copyright: "Copyright (c) 2026 未来飞马 Fmode"
tags: [未来飞马, 智能体技能, 超级技能, 开发级, 智能体, Agent, MCP, Skill, LangGraph, 无构建, ESM, FmodeCode, Claude Code]
---

# fmode-code-agent — 纯 JS 网页版 Bot 智能体

## Overview

教 AI 用**纯 JS（浏览器 + Node 双兼容、无任何打包器）**实现网页里跑的智能体：
三层架构（Agent 决策 / MCP 协议 / Skill 实现）、LangGraph.js 图编排（浏览器 ESM 直跑）、
浏览器端 MCP（Web Worker + JSON-RPC 2.0）、token/速度**实测方法**、**自动部署**。

> 前端 Lit 规范见姊妹技能 **fmode-code-lit**；本技能管**智能体那一层**。

## 何时触发

- 「做一个**智能体** / **Agent** / 对话机器人，能调用工具」
- 「把能力封装成 **MCP**」「接**多个 MCP**」「**Skill** 注册/调用」
- 「用 **LangGraph** 做图编排」「Re-act 循环」「**function calling**」
- 「**浏览器**里跑智能体、**Web Worker** 里跑 MCP」
- 「统计 **token** / **输入输出比例** / 框架耗时」
- 「配**自动部署**（提交后自动发）」

## 三层架构（记牢边界）

```
Agent（决策）──不 import Skill；换框架不动 MCP/Skill
  └─ MCP（协议）──把工具暴露成 JSON-RPC；不含业务编排；凭据不进 Worker
       └─ Skill（实现）──真正干活（纯函数）；不假设调用方
```

**验收标准**：换 Agent 框架时，**MCP 与 Skill 一行不改**。

## 四条铁律

1. **浏览器 + Node 双兼容**：核心是纯 JS，`fs`/`path` 只在分发脚本里用。
2. **不用构建**：不引打包器；依赖走 importmap（浏览器）或 npm（Node）。
3. **凭据不进 Worker、不进日志、不进代码**：要凭据的动作在**主线程**执行。
4. **参数以实测为准**：网关可能**静默忽略**参数——必须**验证副作用**，不能只看 200。

## 用法

### 1) 生成一个最小智能体骨架

```bash
node <skill_dir>/scripts/scaffold.mjs ./my-agent --project my-agent
```

生成：`index.html`（importmap）+ `app.js` + `lib/`（graph / 协议 / 遥测）+ `mcp/`（Worker + 工具规格）。

### 2) 给已有项目装上规则

```bash
node <skill_dir>/scripts/install-rules.mjs .      # 写入 ./.claude/rules/ + CLAUDE.md 片段
```

### 3) 配自动部署

```bash
bash scripts/install-hooks.sh        # pre-push 触发「体检 → 发布 → 验真」
bash scripts/auto-deploy.sh          # 手动跑一轮
bash scripts/auto-deploy.sh --watch  # 常驻监听，改了即发
```

## 关键约定速查

| 项 | 约定 |
|----|------|
| MCP 契约 | `start`(幂等) / `listTools` / `callTool` / `state` / `transport` |
| 工具全名 | 多 MCP 时 `<mcpId>.<toolName>`，避同名冲突 |
| Worker | 只 import 相对路径**纯 JS**；**不能** import 裸包（无 importmap） |
| schema | Worker 侧 JSON Schema + 主线程侧 zod，`assertSpecParity()` 保证一致 |
| 凭据 | **不进 Worker**；出图/调模型在主线程；错误剔除 key |
| State | 只存**索引/摘要**；凭据**不进** State（会被 checkpoint 序列化） |
| ctx | 挂 `config.configurable.__dc`，**别用闭包**（图编译一次复用） |
| LangGraph | 浏览器需 importmap + **3 个替身**（langsmith / node:async_hooks / base64-js） |
| 尺寸 | 出图 `size` 宽高须 **÷16**；9:16 用 `1024x1792`（不是 1080x1920） |
| 参考图 | 只走 `/v1/images/edits` 的 `images: [{ image_url }]` |
| 实测 | 框架调度与 IO **分开计时**；`await` 期间暂停框架计时 |
| 入库 | parse-server **不会**自动补 `user` 指针 → 先 `GET /parse/users/me`，显式传 Pointer |
| 部署 | 无构建直传 OBS+CDN；**只 curl 首页不算验收**（须爬模块图 + 深链接回退） |

## 诚实失败

- 生成前先探测目标目录；已存在文件**不覆盖**（除非 `--force`）。
- 凡本项目**未实测**的能力（如多 MCP 并发、HTTP/SSE 传输），规则里**明确标注「未验证」**，
  **不写成规范**。
- 参数真值以**实测**为准；某参数不支持就**如实标注**，不编造。

## 依赖版本（2026-10 实测可用）

```
@langchain/langgraph@1.5.1  @langchain/core@1.2.18
@langchain/langgraph-checkpoint@1.2.0  @langchain/protocol@0.0.19
uuid@11.0.5  zod@4.6.7
```
