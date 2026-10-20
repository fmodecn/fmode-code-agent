# 部署（无构建 + 自动部署）

> 前端无构建部署的**完整规范**见 **fmode-code-lit** 规则仓 `.claude/rules/deployment.md`
> 与 `routing-best-practices.md`（Repose 依赖 + OBS/CDN + History 回退）。
> 本篇只讲**智能体项目特有**的部分：自动部署流水线 + 验真。

---

## 一、无构建部署速记

- `src/` **即产物**（无 build 步骤），`obsutil sync` 直传 OBS，`public-read`。
- `<base href>` == OBS 前缀 == importmap 业务前缀（**同一变量派生 + 硬校验**）。
- `index.html` **先删后传** + `Cache-Control: no-cache`（防 sync 按 size/mtime Skip）。
- CDN 刷新：`type:'directory'`（URL 以 `/` 结尾），**域名对号入座 domain_id**，
  读 `refresh_task`（**字符串 ID**，不是对象），失败**退出非 0**。
- 依赖（lit / langgraph 全家桶）走 **importmap**，可托管在 **Repose**，**不落业务仓**。

---

## 二、自动部署（本项目实测形态）

### 2.1 三层脚本，单一发布入口

| 脚本 | 职责 |
|------|------|
| `scripts/deploy.sh` | **只负责发**：体检 → 上传 OBS → 刷 CDN → 冒烟。所有站点/前缀/域名**参数化**。 |
| `scripts/auto-deploy.sh` | **编排**：`体检 → deploy.sh → verify-deploy.sh`，支持 `--watch` 常驻。 |
| `scripts/verify-deploy.sh` | **验真**：关键文件可达 + 深链接回退 + 模块图爬取。 |
| `scripts/install-hooks.sh` | 装 git hook 触发自动部署。 |

**关键**：`auto-deploy.sh` **不改** deploy.sh 的发布逻辑，只在其前后加「该不该发/发没发成功」
—— 保持**单一发布入口**，避免两套逻辑漂移。

### 2.2 触发方式（三选，可叠加）

| 方式 | 命令 | 取舍 |
|------|------|------|
| **pre-push hook**（推荐） | `bash scripts/install-hooks.sh` | push 才发，避开 WIP 提交；失败**阻断推送** |
| post-commit hook | `install-hooks.sh --on-commit` | 一提交就发；适合小团队 |
| **watch** | `auto-deploy.sh --watch` | 常驻轮询工作区指纹，变了就发；适合本地开发 |
| CI | 在 CI 里跑 `auto-deploy.sh` | 多人都推 → CI 发，避免每人本地都发 |

> **为什么默认 pre-push 而非 post-commit**：commit 频繁且含 WIP，每提交就发会污染生产；
> push 才是「要分享」的信号。跳过：`git push --no-verify`；临时禁：`DEPLOY_ENABLED=0`。

### 2.3 多人协作要点

- **只让一个人/一处发**：要么 CI 发，要么约定「只有 main 分支推的人发」（hook 已按分支过滤）。
- **域名/前缀参数化**（`SITE_DOMAINS` / `PROJECT`），不要硬编码 —— 换环境不改脚本。
- **watch 用内容指纹**（`find … | md5sum`）而非 inotify：容器里 inotify 常不可用，且跨平台。

---

## 三、验真：**不能只 curl 首页**

`curl` 首页 200 **只证明 index.html 在**。无构建应用白屏的典型原因
（某模块 404、MIME 错、回退没配、相对路径错一个字符），它**一个都不覆盖**。

分层验收：

1. **静态体检**（部署前）：`node --check`；无装饰器残留；相对 import 带 `.js`；裸标识符都在 importmap。
2. **模块图爬取**（部署后，HTTP 层）：从入口跟随相对 import 走完整图，
   断言每个文件 **200 + `Content-Type: text/javascript`**；**深链接 200 且内容为 index.html（禁 302）**。
3. **真实浏览器**：点导航 + 刷新深链接，确认不 404、无控制台报错。
4. **缓存层**：核对 CDN 返回的**内容是新版**（不只是状态码）——
   `curl … | grep 新特征串`。

> ⚠️ **CDN 冷边缘**：新 key 首次被边缘节点拉取**偶发 404**（回源竞争），重跑即消 ——
> 验真脚本对新 key 首次 404 应**重试**再判失败。

---

## 四、checklist

- [ ] `<base href>` 与部署前缀一致（同一变量派生 + 硬校验）？
- [ ] 自动部署脚本**参数化**（域名/前缀），无硬编码？
- [ ] pre-push / CI 触发；失败退出非 0（能阻断）？
- [ ] 部署后跑**模块图爬取 + 深链接回退**（非只看首页）？
- [ ] 核对线上**内容是新版**（非仅状态码）？
- [ ] `DEPLOY_ENABLED` / `--no-verify` 等**逃生阀**存在？
- [ ] AK/SK 只在脚本内以环境变量形态存在，**不写进文档/新文件**？
