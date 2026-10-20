# fmode-code-agent — 纯 JS 网页版 Bot 智能体开发规则总纲

> 本文件是 AI（Claude Code / FmodeCode）在本仓、或引用本仓规则时的**第一入口**。
> 写任何「网页里跑智能体」的代码前，先读本文件，再按下表索引到具体规则篇。
> 姊妹仓：**fmode-code-lit**（前端 Lit 无构建规范）—— 本仓专注**智能体（Agent）**那一层，
> 两者可叠加使用：前端用 lit 规则，智能体用本仓规则。

---

## 0. 三条铁律（违反即返工）

1. **浏览器与 Node 双兼容**：智能体核心（图 / MCP / Skill 抽象 / 遥测）必须是**纯 JS、无 Node 专有 API**
   （`fs`/`path`/`process` 只在**分发脚本**里用）。同一份 `lib/` 要能在浏览器 ESM 直跑、也能在 Node 里 `import` 单测。
2. **不用构建**：不引 rollup/esbuild/vite/webpack。依赖走 **importmap**（浏览器）或 npm（Node），
   源码即产物。**LangGraph 这类"要先编译再用"的库，只能在浏览器里靠 importmap + 替身硬跑**（见规则 4）。
3. **凭据不进 Worker、不进日志、不进代码**。出图/调模型这类**要凭据的动作在主线程**执行；
   Worker 只做协议与编排。错误信息出界前**剔除**疑似 key。

---

## 1. 规则索引

| # | 规则篇 | 内容 | 何时读 |
|---|--------|------|--------|
| 1 | [agent-architecture.md](./.claude/rules/agent-architecture.md) | Agent/MCP/Skill 三层、图编排、状态放哪、可观测性 | 起智能体 / 定架构 |
| 2 | [agent-mcp-skill.md](./.claude/rules/agent-mcp-skill.md) | MCP 客户端统一管理、Skill 注册/调用协议、多 MCP 多 Skill 命名/冲突/隔离 | 接 MCP / 加 Skill |
| 3 | [no-build-langgraph.md](./.claude/rules/no-build-langgraph.md) | LangGraph.js 浏览器无构建配方（importmap + 替身 + 6 个坑） | 用 LangGraph / 图编排 |
| 4 | [agent-ui-bridge.md](./.claude/rules/agent-ui-bridge.md) | 智能体 ↔ UI 桥接（事件流、阶段、进度、失败如实说明） | 做对话界面 |
| 5 | [llm-gateway.md](./.claude/rules/llm-gateway.md) | LLM / 出图网关对接（OpenAI 兼容、usage 真值、参数真值以实测为准） | 调模型 / 出图 |
| 6 | [measurement.md](./.claude/rules/measurement.md) | **实测方法**：token 归因、输入/输出比例、框架调度 vs IO 计时 | 优化 / 出报告 |
| 7 | [deployment.md](./.claude/rules/deployment.md) | 无构建部署 + **自动部署**（hook/CI/watch）+ 验真 | 上线 / 配流水线 |
| 8 | [pitfalls.md](./.claude/rules/pitfalls.md) | 血泪坑位合集（无构建 ESM / 网关静默忽略参数 / 假成功…） | 排查问题 |

---

## 2. 一句话架构

```
用户输入 ─▶ Agent 决策（图 / Re-act）─▶ 选中工具 ─▶ MCP 协议层 ─▶ Skill 执行（凭据在这里）
                    ▲                                      │
                    └────────── 观测（token / 耗时）◀───────┘
```

- **Agent**：决定「这轮调不调工具、调哪个」。可换框架（PageAgent ⇄ LangGraph），换框架**不动** MCP/Skill。
- **MCP**：把工具暴露成 JSON-RPC 2.0 协议（浏览器里常跑在 Web Worker）。
- **Skill**：真正干活的纯函数式能力（出图 / 转写 / 视觉分析）。

> 本项目实测：把 Agent 从 PageAgent 换到 LangGraph，**MCP 与 Skill 一行未改** —— 分层奏效的证据。

---

## 3. 默认技术选型

| 关注点 | 选择 | 备注 |
|--------|------|------|
| 图编排 | **LangGraph.js**（`@langchain/langgraph`） | 显式图 + 条件边 + checkpoint；浏览器需 importmap + 替身 |
| 轻量 Agent | 自写 Re-act 循环 | 不想要图依赖时的替代（PageAgent 亦属此类） |
| 工具协议 | **MCP（JSON-RPC 2.0）** | 本项目自建浏览器端 MCP server；跑在 Web Worker |
| 工具 schema | Worker 侧 **JSON Schema** + 主线程侧 **zod** | Worker 不能 import zod（无 importmap），故两份 + 断言一致 |
| 状态管理 | 框架 State + 检索式外存 | State 只存**索引/摘要**，大对象进 IndexedDB / service |
| 模型调用 | 自写最小 OpenAI 兼容客户端 | 不引 `@langchain/openai`（省依赖 + 可控） |
| 观测 | 自写 telemetry（token / 耗时分离） | 不依赖框架自带（口径要自己定） |
| 部署 | 无构建直传 OBS + CDN | 见规则 7 |

---

## 4. 用本规则仓

```bash
# 把规则装进目标项目（写 .claude/rules/ + CLAUDE.md 摘要）
node skills/fmode-code-agent/scripts/install-rules.mjs ./

# 生成一个最小智能体骨架（index.html + importmap + lib/ + mcp/）
node skills/fmode-code-agent/scripts/scaffold.mjs ./my-agent --project my-agent
```

---

## 5. 关系图

```
fmode-code-lit      ── 前端怎么写（Lit / 无构建 / 部署）
fmode-code-agent    ── 智能体怎么写（Agent/MCP/Skill / LangGraph / 实测 / 自动部署）  ← 本仓
skill-image 等      ── 具体能力（被 MCP 包装成工具）
```

冲突时：前端细节以 fmode-code-lit 为准；智能体细节以本仓为准。
