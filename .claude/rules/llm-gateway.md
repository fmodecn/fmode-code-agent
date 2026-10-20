# LLM / 出图网关对接

> 核心纪律：**参数以「实测 / 文档」为准，不编造**。同一字段名在不同网关可能语义不同，
> 甚至**静默忽略**（返回 200 但没生效）—— 必须**验证副作用**，不能只看状态码。

---

## 一、OpenAI 兼容客户端（自写，不引 SDK）

```js
chatComplete({ token, model, messages, tools, signal, timeoutMs })
  → { content, toolCalls, usage }
```

- **不引 `@langchain/openai`**：省依赖、可控、便于塞自定义字段。
- **错误剔除凭据**：`scrub()` 把 `sk-…` / `Bearer …` 替换成 `[redacted]`。
- **超时**：用 `AbortController`，出图类给 300s，对话类 30~45s。

---

## 二、`usage` 真值

- chat/completions：`usage.prompt_tokens` / `usage.completion_tokens`。
- 出图：`usage.input_tokens` / `usage.output_tokens`（+ `*_tokens_details.image_tokens`）。
- 拿到真值就**覆盖估算**并单列展示（见 [measurement.md](./measurement.md)）。

---

## 三、⚠️ 静默忽略参数的陷阱（血泪）

### 3.1 现象

某些网关对**不认识的参数**不报错，而是**静默丢弃**并照常返回 200。
→ 你以为「参考图传进去了」，其实模型根本没看到。

### 3.2 怎么识破：验证**副作用**，而非状态码

本项目实测（`gpt-image-2.5` 出图）：

- `/v1/images/generations` 传参考图：

  | 参数名 | 结果 |
  |--------|------|
  | `image` / `images` | 400 `Unknown parameter`（**显式**拒绝） |
  | `image_url` / `input_image` / `image_ref` / `ref_image` / `init_image` / `reference_images` | **200 但 `input_tokens_details.image_tokens: 0`** → **图被静默忽略** |

  **判定方法**：看 `image_tokens` 是否 > 0。为 0 = 图没进模型。

- 参考图**唯一通道**：`/v1/images/edits`，body `images: [{ image_url: "<dataURI|URL>" }]`
  （元素**必须是对象**；`{url}`/`{type:…}` 都被拒；multipart 经此网关不通）。
  传 data URI 实测 `image_tokens: 1024` → 图真被消费。

### 3.3 尺寸约束

- `size` 的宽、高**必须能被 16 整除**，否则 400。
- 常见错误：`1080x1920`（最口语化的「9:16」）**被拒**；竖版 9:16 用 **`1024x1792`**。
- `size: "auto"` 通常可用（按语义自选比例）。

> 原则：**任何「参数是否生效」都要设计一个可观测的副作用来验证**，
> 不能凭「返回 200」下结论。

---

## 四、端点真值怎么定

- **先探活**：`GET /v1/models`（无 token 应 401；能列出模型说明端点 live）。
- **旧参考文档常失效**：本项目实测 `accounts/sendCode` 等云函数已死，以**当前实测**为准。
- 把「活/死」的端点写进项目记忆，避免后来者重踩。

---

## 五、图 + 文多模态的拼接

当网关没有独立的「参考图说明」字段时，「怎么用这些图」只能**写进 prompt 文本**：

```
[参考图说明] + [使用意图] + [原提示词]
```

- 1 张：`参考所提供图片的风格/主体/配色来生成新设计。`
- N 张：逐张编号 `参考图1…参考图N`，让模型能区分主图与风格图。

见本项目 `image-service.js` 的 `composeRefPrompt()`。
