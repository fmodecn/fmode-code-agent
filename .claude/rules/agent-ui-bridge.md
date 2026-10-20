# 智能体 ↔ UI 桥接

> 目标：把「智能体在干什么」变成用户**看得见、能打断、失败有交代**的体验。
> 参照 fmode-code-lit 的分层：**组件只渲染，业务在 service，智能体在 modules**。

---

## 一、接口稳定：换 Agent 框架不改 UI

**服务对外接口与实现解耦**是本项目一条纪律：

- `agentService` 暴露 `messages / status / stage / submit / answer / stop / retryTask / regenerate …`。
- 换框架（PageAgent → LangGraph）时**接口一字不改**，故 `components/` 一行不用动。

**做法**：modules 里的具体框架实现（`graph.js`）只被 `agent-service.js` 引用；
组件只认 service。

---

## 二、阶段与节点轨迹（可观测性上屏）

- 把「框架在跑哪个节点」**实时**打成一条轨迹（如 `route → recall → plan → invoke → assert`）。
- 节点 → UI 阶段映射（例）：`plan→thinking`、`invoke→calling`、`reflect→generating`、`respond→done`。
- Re-act 循环下用户只能看到「思考中…」；**显式图能把过程展示出来**——这是选图的理由之一。

```js
// onNode 回调把节点名推进 trace signal，UI 订阅它
const onNode = (name) => { trace.push({ name, at: Date.now() }); this.#nodeTrace.set([...trace]); };
```

---

## 三、进度：没有真实进度时用时间估算

- 出图 20~60s、无进度回调 → 用**时间估算**给「在动」的反馈
  （0→90% 渐进收敛，完成置 100）。**不要**假装精确。
- 计时**以真实起点为准**（用图片记录的 `at`，而非 UI 阶段切换时刻）。

---

## 四、失败如实说明（**不静默兜底**）

- 工具宣称要出图但**没出图** → 明确告诉用户「这次没出图，可以重试」，
  **不要**偷偷换条路再出一张（用户会困惑「为什么和我说的话不一样」）。
- 错误翻译成**可行动**的话（`friendlyError`）：401→重新登录；402→余额不足；
  429→稍后再试；超时→重试。
- **兜底要有边界**：MCP 起不来时降级「直连出图」是**显式降级**（会提前告知），不是静默替换。

---

## 五、凭据与安全（UI 侧）

- 登录后凭据只存 `localStorage`（可退出清除）；手动填 Key 默认只存内存。
- **不打日志**；错误信息出界前**剔除**疑似 key。
- **token 永不进 MCP Worker**：出图在主线程执行，Worker 只传「工具名 + 参数 + 结果」。

---

## 六、移动端（对话类 UI 必处理）

- `100dvh` + `visualViewport` 监听：软键盘弹出时整窗上推，输入区不被遮挡。
- 安全区 `env(safe-area-inset-*)`；输入框字号 **≥16px**（iOS 聚焦不自动放大）。
- 回车键：桌面 Enter 发送；**移动端** Enter 换行（用发送按钮）。
- 无横向溢出：`min-width:0` + `overflow-wrap:anywhere`。
