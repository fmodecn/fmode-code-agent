# fmode-code-agent · 纯 JS 网页版 Bot 智能体技能

> **这是方便数字人（FmodeAgent / FmodeCode）进行项目开发的基础规则技能。**
> 它把踩过的坑沉淀成硬性约束，让 AI 在生成代码时不重犯同类错误。

> **未来飞马 — 让 AI 进化提前发生，让 AI 落地快人一步**

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-brightgreen.svg)](LICENSE)
[![ESM](https://img.shields.io/badge/module-native--ESM-orange.svg)](#)

---

## 简介

`fmode-code-agent` 是教 AI 用 **纯 JS（浏览器 + Node 双兼容、无构建）** 写**网页版 Bot 智能体**的
Claude Code 技能：Agent 决策 / MCP 协议 / Skill 执行三层分离，LangGraph.js 浏览器直跑，
token/速度**实测**，**提交后自动部署**。

配套 **规则仓**（本仓 `.claude/rules/`）提供架构、MCP/Skill、无构建配方、实测、部署等完整规范。

适用 **FmodeCode / Claude Code / FmodeAgent**；Node ≥ 18 直接运行。

## 核心能力

- 🏗 **项目脚手架** —— 一键生成智能体骨架（index.html + importmap + lib/ + mcp/）
- 🔌 **MCP/Skill 范式** —— 统一 MCP 契约、Skill 注册/调用、多 MCP 命名/冲突/隔离规则
- 🕸 **LangGraph 无构建配方** —— importmap + 3 个替身 + 6 个实测坑
- 📏 **实测方法** —— token 归因、输入/输出 token 比例、框架调度 vs IO 计时
- 🚀 **自动部署** —— 提交后自动「体检 → 发布 → 验真」，可 watch / CI
- 📚 **完整规则仓** —— 8 篇规范 + 24 条血泪坑位

## 快速开始

```bash
# 生成一个最小智能体骨架
node node_modules/@fmode/skill-code-agent/skills/fmode-code-agent/scripts/scaffold.mjs ./my-agent --project my-agent

# 给已有项目装规则
node node_modules/@fmode/skill-code-agent/skills/fmode-code-agent/scripts/install-rules.mjs .

# 自检（含 scaffold 产物 + MCP 协议功能测试）
node node_modules/@fmode/skill-code-agent/skills/fmode-code-agent/scripts/smoke.mjs
```

## 四条铁律

1. **浏览器 + Node 双兼容**：核心纯 JS；`fs`/`path` 只在分发脚本里用。
2. **不用构建**：不引打包器；依赖走 importmap（浏览器）或 npm（Node）。
3. **凭据不进 Worker / 日志 / 代码**；要凭据的动作在**主线程**执行。
4. **参数以实测为准**：网关会**静默忽略**参数 —— 必须**验证副作用**，不能只看 200。

## 诚实失败

- 生成前先探测目标目录；已存在文件**不覆盖**（除非 `--force`）。
- 本项目**未实测**的能力（多 MCP 并发、HTTP/SSE 传输…）在规则里**明确标注「未验证」**，不写成规范。
- 参数真值以**实测**为准；某参数不支持就**如实标注**，不编造。

## 依赖版本（2026-10 实测可用）

```
@langchain/langgraph@1.5.1  @langchain/core@1.2.18
@langchain/langgraph-checkpoint@1.2.0  @langchain/protocol@0.0.19
uuid@11.0.5  zod@4.6.7
```

## 开源协议

MPL-2.0（见 [LICENSE](./LICENSE)）。商标「未来飞马」等不随协议授权。
