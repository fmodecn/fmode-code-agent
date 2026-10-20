# 发布状态与登记

> 最后更新：2026-10-20

## 当前状态：**本地初版，尚未发布**

`fmode-code-agent` 是本机（`/opt/data/git-repos/fmode-code-agent`）的**初版规则技能**，
已完成自检（`node skills/fmode-code-agent/scripts/smoke.mjs` 全绿），但**尚未发布到任何渠道**。

## 已登记

已登记到 Fmode 技能清单：

- 机器真值：`/opt/data/git-repos/skill-core-guide/lib/inventory.mjs`（`INVENTORY` 数组，`status: 'draft'`）
- 人类可读：`/opt/data/git-repos/skill-core-guide/inventory.md`（系统层 §9）

登记字段已注明：本机路径、`publishPending`（发布待用户指示）。

## 待办（待用户指示）

### 1. 发布到 Gogs / GitHub（参照 fmode-code-lit 流程）

`fmode-code-lit` 的公开发布经验（四渠道）：

| 渠道 | 命令/做法 |
|------|-----------|
| Gogs | `git remote add origin git@git.fmode.cn:fmode/fmode-code-agent.git && git push -u origin main` |
| GitHub | 建 `github.com/fmodecn/skill-code-agent`（或 `fmode-code-agent`）镜像 + push |
| npm | `npm publish`（包名 `skill-code-agent`，见根 `package.json`） |
| skillhub | `skillhub login --key <KEY> --host https://api.skillhub.cn && skillhub publish . --changelog "首版"` |

⚠️ **skillhub 企业 key 当前失效**（`sk-ent-…` 服务端 401，与 `skill-core-guide` 同因）——
需重新签发 key 后补发。

### 2. 发布前检查清单

- [ ] `LICENSE`（MPL-2.0）已在根与 skills/ 两级 ⏳（已就位）
- [ ] `README.md` + `SKILL.md` frontmatter 完整 ⏳（已就位）
- [ ] `skill-package-manifest.json` 字段齐全 ⏳（已就位）
- [ ] `npm run smoke` 全绿 ⏳（22 项通过）
- [ ] 敏感信息扫描（无 AK/SK、无 token）—— ⏳ 发布前再跑一次
- [ ] 版本号（当前 `0.1.0`）与 changelog

### 3. 版本号

当前 `0.1.0`。首次公开发布建议 `1.0.0`（对齐 `fmode-code-lit@1.0.0`），
届时同步更新根 `package.json` 与 `skills/fmode-code-agent/package.json`。
