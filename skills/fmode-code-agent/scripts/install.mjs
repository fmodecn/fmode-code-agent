#!/usr/bin/env node
/**
 * install.mjs —— 把 fmode-code-agent 技能装到用户级/工作区级 .claude/skills/。
 *
 * 用法：
 *   node install.mjs install [--force]     # 装到 ~/.claude/skills/fmode-code-agent/
 *   node install.mjs workspace [--force]   # 装到 ./.claude/skills/fmode-code-agent/
 *   node install.mjs rules [dir] [--force] # 等价于 install-rules.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillSrc = resolve(__dirname, '..');
const args = process.argv.slice(2);
const cmd = args[0] || 'install';
const force = args.includes('--force');

if (cmd === 'rules') {
  const dir = args.find((a) => a && !a.startsWith('-') && a !== 'rules') || '.';
  execFileSync(process.execPath, [join(__dirname, 'install-rules.mjs'), dir, ...(force ? ['--force'] : [])], { stdio: 'inherit' });
  process.exit(0);
}

const base = cmd === 'workspace' ? join(process.cwd(), '.claude') : join(homedir(), '.claude');
const dest = join(base, 'skills', 'fmode-code-agent');
mkdirSync(dest, { recursive: true });

const files = ['SKILL.md', 'README.md', 'package.json', 'skill-package-manifest.json'];
let n = 0;
for (const f of files) {
  const s = join(skillSrc, f);
  if (!existsSync(s)) continue;
  const d = join(dest, f);
  if (existsSync(d) && !force) { console.log('  · 跳过（已存在）', f); continue; }
  writeFileSync(d, readFileSync(s)); n++;
}
console.log(`已安装 fmode-code-agent → ${dest}（${n} 个文件）`);
console.log('提示：再跑 `node install-rules.mjs <项目目录>` 可把规则写进具体项目。');
