#!/usr/bin/env node
/**
 * install-rules.mjs —— 把 fmode-code-agent 的智能体规则装入目标项目的 ./.claude/rules/。
 *
 * 用法：
 *   node install-rules.mjs [targetDir] [--force]
 *   node install-rules.mjs [targetDir] --from <rulesRepoDir>   # 指定规则仓根目录
 *
 * 规则来源优先级：--from > 技能同仓 ../../../.claude/rules > 内置最小规则集。
 * 已存在文件默认不覆盖（--force 覆盖）。
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const target = resolve(args.find((a) => a && !a.startsWith('-')) || '.');
const force = args.includes('--force');
const fromIdx = args.indexOf('--from');
const fromDir = fromIdx > -1 ? resolve(args[fromIdx + 1]) : null;

// 规则来源候选（技能在 <repo>/skills/fmode-code-agent/scripts/）
const candidates = [
  fromDir,
  resolve(__dirname, '../../../.claude/rules'),
  resolve(__dirname, '../../.claude/rules'),
].filter(Boolean);
const srcRules = candidates.find((d) => d && existsSync(d) && existsSync(join(d, 'agent-architecture.md')));

if (!srcRules) {
  console.error('(!) 未找到规则源。请用 --from <规则仓根目录> 指定（需含 .claude/rules/agent-architecture.md）。');
  process.exit(1);
}

const destRules = join(target, '.claude', 'rules');
mkdirSync(destRules, { recursive: true });

let created = 0, skipped = 0;
function copyTree(from, to) {
  for (const name of readdirSync(from)) {
    const s = join(from, name), d = join(to, name);
    if (statSync(s).isDirectory()) { mkdirSync(d, { recursive: true }); copyTree(s, d); continue; }
    if (!name.endsWith('.md')) continue;
    if (existsSync(d) && !force) { skipped++; continue; }
    writeFileSync(d, readFileSync(s));
    created++;
  }
}
copyTree(srcRules, destRules);

// 在目标 CLAUDE.md 里追加一段指引（若还没有）
const claudeMd = join(target, 'CLAUDE.md');
const MARK = '<!-- fmode-code-agent rules -->';
const snippet = `
${MARK}
## 智能体开发规则（fmode-code-agent）

本项目遵守 **fmode-code-agent** 规则。写任何智能体/Agent/MCP/Skill 代码前先读
\`.claude/rules/agent-architecture.md\`，再按 CLAUDE.md 索引查具体篇。

四条铁律：① 浏览器+Node 双兼容 ② 不用构建（importmap）③ 凭据不进 Worker/日志/代码
④ 参数以实测为准（网关会静默忽略参数，须验证副作用）。
`;
if (existsSync(claudeMd)) {
  const cur = readFileSync(claudeMd, 'utf8');
  if (!cur.includes(MARK)) { writeFileSync(claudeMd, cur.trimEnd() + '\n' + snippet); console.log('  · 已向 CLAUDE.md 追加规则指引'); }
} else {
  writeFileSync(claudeMd, `# 项目规范\n${snippet}`);
  console.log('  · 已创建 CLAUDE.md');
}

console.log(`规则安装完成：新增 ${created} 个，跳过（已存在）${skipped} 个 → ${destRules}`);
if (skipped && !force) console.log('  （要覆盖已存在文件：加 --force）');
