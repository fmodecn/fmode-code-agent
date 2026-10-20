# 智能体分层架构（Agent / MCP / Skill）

## 一、三层职责（边界即纪律）

| 层 | 职责 | 不该做的事 |
|----|------|-----------|
| **Agent**（决策） | 决定「这轮调不调工具、调哪个、怎么串」 | 不直接 import Skill；不含协议细节 |
| **MCP**（协议） | 把工具暴露成统一协议；把调用转成执行 | 不做业务编排；不持有凭据（浏览器场景） |
| **Skill**（实现） | 真正干活（出图/转写/分析），纯能力 | 不假设调用方是谁；不藏全局态 |

**换框架不动 MCP/Skill** 是分层的验收标准：
本项目把 Agent 从 PageAgent 换到 LangGraph，`design-mcp.js` 与 `image-service.js` **零改动**。

## 二、Agent 侧：图编排 vs Re-act

| 维度 | 显式图（LangGraph） | Re-act 循环 |
|------|--------------------|-------------|
| 可观测 | 节点轨迹可展示、可断点、可回滚 | 只能看到「思考中…」 |
| Token 控制 | 可在节点里**预筛工具**、**按需检索** 后再进 LLM | 全量工具 schema + 线性历史，膨胀 |
| 失败分支 | 「没出图」是**显式分支** | 只能事后靠猜兜底 |
| 成本 | 需 importmap + 替身（浏览器） | 轻 |

**建议**：要 token 可控 + 可观测 → 显式图；只是简单问答 → Re-act 足够。

### 2.1 节点切分原则（本项目 7 节点实例）

```
route（本地预筛，零 LLM/零 token）
  → recall（检索式记忆，按需召回）
  → plan（唯一一次"决定做什么"的 LLM）
  → invoke（执行工具）
  → assert（断言"真出图了吗"）
  → reflect（给一句说明，不带工具，避免它再调一次）
  → respond（收尾）
```

- **不调 LLM 的节点放最前**（route/recall）→ 省 token 且几乎不花时间。
- **工具产物直接进 State**，不做「消息序列化往返」。
- **独立 assert 节点**让「工具说了要干活但没干成」成为**显式分支**。

### 2.2 State 放什么（关键）

**State 只存索引与摘要**，大对象（图片 URL、历史正文）放 service / IndexedDB。

- 好处：checkpoint 序列化快、快照不膨胀、State 可安全进日志。
- **凭据不进 State**：State 会被快照序列化 → token 进 State 等于进快照。运行时上下文
  挂在 `config.configurable.__dc`（**不是**闭包，闭包会把首轮 token 固化进编译产物）。
- ⚠️ LangGraph 节点签名是 `node(state, config)`，**第二参是 RunnableConfig 不是你的 ctx**（实测坑）。

## 三、MCP 侧

见 [agent-mcp-skill.md](./agent-mcp-skill.md)（契约、命名空间、Worker 约束、凭据纪律）。

## 四、可观测性（一套埋点，三处复用）

无论几个 MCP/Skill，**口径必须统一**：

- **Token**：每次 LLM 调用记 system/tools/history/retrieved 分项；有 `usage` 真值**以真值为准**。
- **输入/输出比例**：分别记 prompt_tokens / completion_tokens。
- **耗时**：**框架调度**与**IO（LLM/网络）分开记**。
  ⚠️ 实测踩坑：用 `t0()` 包住整个 `await LLM` 会把 LLM 的 1.4s 算进「框架开销」，
  占比虚高到 96%。正确做法：`await` 期间**暂停框架计时**，只把「发起调用前后」算框架的。

详见 [measurement.md](./measurement.md)。

## 五、降级与失败隔离

- **每个外部依赖都有降级路径**：本项目 MCP 起不来 → 自动走「直连 Skill 出图」，用户总能拿到图。
- **失败如实说明，不静默兜底**：工具没出图就明说「这次没出图」，不偷偷换条路再出一张（用户会困惑）。
- **一个组件失败不拖垮整体**：一个 MCP 挂 → 其它 MCP 与 Agent 仍可用。
