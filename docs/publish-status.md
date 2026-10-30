# 发布状态与登记

> 最后更新：2026-10-30

## 当前状态：已发布

`fmode-code-agent` 是「**方便数字人（FmodeAgent / FmodeCode）进行项目开发的基础规则技能**」，
已完成自检（`npm run smoke` 全绿），并发布到以下渠道。

## 发布渠道

| 渠道 | 地址 | 状态 |
|------|------|------|
| GitHub | `https://github.com/fmodecn/fmode-code-agent` | 已推送 |
| npm | `@fmode/skill-code-agent` | 已发布（0.1.1） |
| cnpm | `cnpm sync @fmode/skill-code-agent` | 已同步 |
| Gogs | `fmode/fmode-skills` → `skills/fmode-code-agent/` | 已合并 |

## 发布前检查清单

- [x] `LICENSE`（MPL-2.0）已在根与 skills/ 两级
- [x] `README.md` + `SKILL.md` frontmatter 完整
- [x] `skill-package-manifest.json` 字段齐全（`npmPackage: @fmode/skill-code-agent`）
- [x] `npm run smoke` 全绿
- [x] 脱敏：移除内网路径、桶名、端点等内部信息

## 未覆盖

- skillhub：企业 key 当前失效（服务端 401），待重新签发后补发。
