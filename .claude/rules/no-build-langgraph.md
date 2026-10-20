# LangGraph.js 浏览器无构建配方（血泪版）

> 目标：**零打包器**，让浏览器原生 ESM 直接跑 `@langchain/langgraph`。
> 本项目实测版本：langgraph 1.5.1 / core 1.2.18 / checkpoint 1.2.0 / protocol 0.0.19 / zod 4.6.7。
> 凡本文标「实测」的，都是本项目跑出来的；未验证的一律标注。

---

## 一、总思路

npm 包的 dist ESM 里大量出现**裸标识符 import**（`@langchain/core/…`）与 **Node 专有模块**
（`node:async_hooks`）。浏览器无打包器时：

1. **裸标识符** → 靠 **importmap** 把深层子路径重定向到 `vendor/` 落盘路径；
2. **Node 专有模块 / 重依赖** → 用 **vendor/shims/ 替身**顶上（importmap 指过去）；
3. **落盘** → `npm pack` 解包原始 ESM，**不转译**（无构建原则）。

---

## 二、落盘（vendor）

```bash
npm pack @langchain/langgraph@1.5.1 @langchain/core@1.2.18 \
         @langchain/langgraph-checkpoint@1.2.0 @langchain/protocol@0.0.19 \
         uuid@11.0.5 zod@4.6.7
# 解包 → vendor/langgraph/@langchain/*、vendor/langgraph/uuid …
# 瘦身：删 *.map / *.cjs / *.d.ts（浏览器用不到，且 .cjs 会被 MIME 坑）
```

入口：`@langchain/langgraph` → `vendor/langgraph/@langchain/langgraph/dist/web.js`。

---

## 三、必装替身（3 个，缺一白屏）

| 替身 | 顶替 | 为什么 |
|------|------|--------|
| `vendor/shims/langsmith.js` | `langsmith` + `langsmith/run_trees` | core/langgraph **静态** import 它；而它依赖 p-queue、`node:fs`、`child_process`… 与浏览器冲突。替身给 `RunTree`/`Client` **空实现**（no-op，不发网络）。 |
| `vendor/shims/async-hooks.js` | `node:async_hooks` | 实测报错：`Access to script at 'node:async_hooks' … blocked by CORS`。只有 `AsyncLocalStorage` 一个符号，浏览器没有 → 退化为 **no-op store**。 |
| `vendor/shims/base64-js.js` | `base64-js` | 该包**只有 CJS**（`index.js` 是 CJS），无构建下不可直接当 ESM 用 → 提供 ESM 版薄封装。 |

> `traceable.js` 是 langsmith 替身的连带（`@langchain/core/tracers/traceable` 用到）。

---

## 四、importmap（124 条，从 package.json 派生）

**不要手写 importmap**。用脚本从 `package.json` 依赖**派生**，并做**可达性 + MIME 校验**
（本项目 `scripts/gen-importmap.mjs`，校验 477 个文件可达 + `text/javascript`）。

必须覆盖的映射类型：

```jsonc
{
  "imports": {
    "@langchain/langgraph": "./vendor/langgraph/@langchain/langgraph/dist/web.js",
    "@langchain/langgraph/": "./vendor/langgraph/@langchain/langgraph/",   // 前缀映射
    "@langchain/core": "./vendor/langgraph/@langchain/core/dist/index.js",
    "@langchain/core/": "./vendor/langgraph/@langchain/core/",
    "langsmith": "./vendor/shims/langsmith.js",                 // 替身
    "langsmith/run_trees": "./vendor/shims/langsmith.js",
    "node:async_hooks": "./vendor/shims/async-hooks.js",        // 替身（裸 node: 标识符）
    "base64-js": "./vendor/shims/base64-js.js",                 // 替身
    "uuid": "./vendor/langgraph/uuid/dist/esm-browser/index.js",
    "zod": "./vendor/.../zod/v4/index.js",
    "zod/v4/core": "./vendor/.../zod/v4/core/index.js"          // ⚠️ 子目录映射（见坑 4）
  }
}
```

---

## 五、6 个实测坑

1. **`langsmith` 静态依赖**：不是「用到才加载」，是模块顶层就 import。
   不装替身 → 一进 core 就炸。**必须**先装替身。
2. **`node:async_hooks` 是裸标识符**：浏览器把它当 URL 解析，报 CORS。
   importmap 里加 `"node:async_hooks"` 键指向替身。
3. **`base64-js` 只有 CJS**：`import` 它会拿到 CJS 的 `module.exports`，在浏览器 ESM 下时常不对。
   → ESM 薄封装。
4. **`zod/v4/core` 目录映射**：zod 的 exports 有子目录，importmap **前缀映射**要单独覆盖，
   否则 `zod/v4/core` 解析失败（不是 `zod/v4/` 前缀能覆盖的，需显式键）。**实测坑**。
5. **`.mjs` 的 MIME**：OBS/部分主机对 `.mjs` 回 `binary/octet-stream`，浏览器**拒绝执行**模块脚本
   （"Expected a JavaScript-or-Wasm module script"）。→ 落盘时就**改名 `.js`**，别指望服务端改 MIME。
6. **AsyncLocalStorage 语义缺失**：替身让 ALS **no-op** → `getCurrentTaskInput()`、
   callbacks 上下文注入**拿不到值**。本项目**刻意全部走 Graph State 显式传递**，不依赖 ALS。
   若你要用 ALS 相关 API，需换真 polyfill。

---

## 六、State 与 ctx 的写法（踩过的）

- **ctx 挂 `config.configurable.__dc`**，不要用闭包：
  图**只编译一次、多轮复用**，闭包会把第一轮的 token 固化进编译产物（**安全隐患**）。
- 节点签名 `node(state, config)` 的第二参是 **RunnableConfig**，不是你的 ctx。
  早期版本把它当 ctx 用，读 `undefined` 直接抛错（实测）。
- **凭据不进 State**（State 会被 checkpoint 序列化）。

---

## 七、验证

上线上不了浏览器之前，先用脚本爬**模块图**：

```bash
node scripts/gen-importmap.mjs        # 派生 importmap + 校验可达性/MIME
python3 scripts/verify-live.py <url>  # HTTP 层：跟随相对 import 走完整图，断言 200 + text/javascript
```

**只看首屏 200 不算通过** —— 一个深层模块 404 就白屏而首屏仍 200。
