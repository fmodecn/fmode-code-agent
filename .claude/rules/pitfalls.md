# 坑位合集（血泪）

---

## 一、无构建 ESM

1. **装饰器不可用**：浏览器原生 JS 不执行 `@customElement` 等 → `SyntaxError`。
   用 `static properties` + `customElements.define()`（见 fmode-code-lit）。
2. **module worker 不支持 importmap**：Worker 内只能 import**相对路径纯 JS**；
   裸标识符（`zod/v4`）直接加载失败。→ Worker 侧写 JSON Schema，主线程侧写 zod。
3. **`.mjs` 的 MIME**：OBS 对 `.mjs` 回 `octet-stream`，浏览器拒执行 → 落盘时改名 `.js`。
4. **`new URL(path, baseURI)` 丢前缀**：子路径部署下路由 404（见 fmode-code-lit 路由篇）。
5. **CJS-only 包**：如 `base64-js` 只有 CJS，无构建下需 ESM 薄封装。

## 二、LangGraph 浏览器 ESM

6. `langsmith` 是**静态依赖**，必须替身（否则一进 core 就炸）。
7. `node:async_hooks` 是**裸标识符**，importmap 需显式键指向替身。
8. `zod/v4/core` 需**子目录映射**（前缀映射覆盖不到）。**实测坑**。
9. 替身后 ALS **no-op** → `getCurrentTaskInput()` / callbacks 上下文失效 →
   **全部走 Graph State 显式传递**。
10. 节点第二参是 **RunnableConfig** 不是你的 ctx；用 `config.configurable.__dc` 传上下文，
    **别用闭包**（图只编译一次，闭包会固化首轮凭据）。
11. **State 会被 checkpoint 序列化** → 凭据/大对象**不进 State**。

## 三、网关 / 参数

12. **静默忽略参数**：不认识的字段不报错、直接丢弃，返回 200。
    必须**验证副作用**（如 `image_tokens > 0`）才知道参数有没有生效。
13. **参考图不能凭空传**：`/v1/images/generations` 不接受；走 `/v1/images/edits` 的
    `images: [{ image_url }]`（元素是**对象**，不是字符串）。
14. **尺寸 ÷16**：`1080x1920` 被拒；9:16 用 `1024x1792`。
15. **旧端点会死**：`accounts/sendCode` 等云函数已失效，以**当前实测**为准。

## 四、计时 / 度量

16. **`await LLM` 被算进框架耗时** → 占比虚高到 96%。→ `await` 期间**暂停框架计时**。
17. **估算当真值**：无 `usage` 时用字符估算可以，但**必须标注**，别当计费值。
18. **输出 token 无真值** → 输入:输出比例**渲染为 `—`**，不硬凑。

## 五、部署

19. **只 curl 首页不算验收**：模块 404 / MIME 错 / 回退没配都白屏而首页仍 200。
20. **CDN 刷新假成功**：`refresh_task` 是**字符串**，读成 `.id` 恒 undefined 但脚本照常退出 0。
21. **CDN 冷边缘首次 404**：新 key 首次拉取偶发 404，重试即消，别立刻判故障。
22. **index.html 被 sync Skip**：按 size+mtime 判，需**先删后传** + `no-cache`。

## 六、入库 / 数据

23. **parse-server 不会按 session 自动补 `user` 指针**：新建记录时 `user` 会是 null。
    要「user 指向该用户自己」**必须显式**先 `GET /parse/users/me` 拿 objectId 再传 Pointer。
    （本项目实测：`GET /parse/users/me` 返回 objectId + company 指针。）
24. **入库失败不应影响主流程**：记录是「尽力而为」，任何失败都不该让出图失败。
