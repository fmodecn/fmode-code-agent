# MCP / Skill 抽象规则

> 细则展开见 designer-chat 仓 `docs/agent-mcp-skill-rules.md`（同源，本项目实测版）。
> 本篇是**可复用标准**。

## 一、MCP 客户端统一契约（强制）

任何 MCP 必须有一个**稳定契约模块**，对外只暴露固定方法：

```js
start(opts) → { ok, tools?, error? }   // 幂等
listTools() → ToolSpec[]               // MCP JSON Schema
callTool(name, args) → { ok, result?, error? }
state → signal('idle'|'starting'|'ready'|'error')
transport → 'worker'|'iframe'|'http'|'inproc'
```

- **幂等 start**：调用 N 次只起一份资源（ready 时只挂监听不重启）。
- **惰性**：无凭据时不白起 Worker。
- **可观测**：`state` 可订阅，UI 靠它显示连接状态。

## 二、多 MCP 管理（规范建议；本项目只接了 1 个 MCP）

| 关注点 | 规则 |
|--------|------|
| 注册表 | `Map<mcpId, McpHandle>`，每个 MCP 有稳定 `id` |
| 命名空间 | 全名 = `${mcpId}.${toolName}`，避免跨 MCP 同名冲突 |
| 生命周期 | 各自独立 start/stop，一个挂了不拖垮其它 |
| 聚合视图 | Agent 只对「所有**就绪** MCP 的工具并集」编程 |
| 隔离 | 凭据/状态互不可见 |

**冲突优先级**：`显式注册 > 内置 > 后启动`，且**启动时告警**，不静默覆盖。

## 三、Worker 铁律（浏览器端 MCP，实测血泪）

- **module worker 不支持 importmap** → Worker 内**只能 import 相对路径纯 JS**；
  裸标识符（`zod/v4`、`@page-agent/core`）会**直接加载失败**。
- 需要 schema 时写两份：**Worker 侧 JSON Schema** + **主线程侧 zod**，
  启动时 `assertSpecParity()` 断言参数键一致，**防漂移**。
- **凭据永不进 Worker**：出图/调模型这类要凭据的动作**在主线程**执行，
  Worker 只做协议与编排（本项目用「反向回调主线程」实现）。

## 四、Skill 规范

### 4.1 入口

```js
async function doThing(params, { token, signal }) → result
```

- 凭据**显式传入**（不读环境/全局）→ 便于多租户与 mock 单测。
- **无隐藏全局态**；进度/缓存放调用方（service 层）。
- **结构化错误**（含 `status`），由上层翻译成人话。

### 4.2 注册到 MCP

```js
server.register({
  name, title, description,
  inputSchema,     // MCP JSON Schema
  annotations,     // readOnlyHint / destructiveHint / openWorldHint
  defaultMode,     // (ctx) => 默认值
  buildBrief,      // (args) => 人类可读描述（纯函数）
  handler,         // async (args, ctx) => MCP result
});
```

- **一个 Skill 可映射多个工具**（差异在「提示词前缀 + 画幅 + 风格约束」，不是换模型）。
- **`buildBrief` 必须纯**（Worker 内可用，无 DOM/网络）。

## 五、多 Skill 加载/命名/冲突/隔离（设计）

- **加载**：声明式 `skills.manifest.json`（启用项 + 版本 + 对应 MCP）；可懒加载。
- **命名**：包 `skill-<capability>`；工具 `<verb>_<object>`；全名 `<mcpId>.<toolName>`。
- **冲突**：同名工具用命名空间规避，仍冲突则**启动报错**；同能力不同实现**并列注册**
  （由 Agent 按语义/成本选），不互相覆盖。
- **隔离**：状态/失败/凭据三重隔离 —— 一个 Skill 失败返回 `isError`，不抛穿到 Agent。

## 六、检查清单

- [ ] 契约模块齐全（start 幂等 / listTools / callTool / state）？
- [ ] 工具名带 MCP 命名空间？无跨 MCP 碰撞？
- [ ] Worker 依赖链只含相对纯 JS？
- [ ] 凭据不进 Worker？错误剔除凭据？
- [ ] Skill 凭据显式传入、无隐藏全局态？
- [ ] Skill 失败返回 `isError` 而非抛穿？
- [ ] 一个 MCP 挂掉时其余仍可用？
