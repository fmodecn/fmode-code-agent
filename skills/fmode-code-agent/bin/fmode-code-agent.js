#!/usr/bin/env node
/**
 * fmode-code-agent CLI
 * 用法：
 *   node bin/fmode-code-agent.js install      # 装技能到 ~/.claude/skills/（默认）
 *   node bin/fmode-code-agent.js workspace    # 装技能到 ./.claude/skills/
 *   node bin/fmode-code-agent.js rules [dir]  # 把智能体规则装入目标项目 ./.claude/rules/
 *   node bin/fmode-code-agent.js scaffold <dir> --project <name>   # 生成智能体骨架
 *   node bin/fmode-code-agent.js smoke        # 自检
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(__dirname, '..', 'scripts');
const [cmd = 'install', ...rest] = process.argv.slice(2);

const MAP = {
  install: 'install.mjs',
  workspace: 'install.mjs',
  rules: 'install-rules.mjs',
  scaffold: 'scaffold.mjs',
  smoke: 'smoke.mjs',
};

const script = MAP[cmd];
if (!script) {
  console.error(`未知命令：${cmd}\n可用：${Object.keys(MAP).join(', ')}`);
  process.exit(2);
}
const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...(cmd === 'smoke' ? [] : [cmd === 'install' || cmd === 'workspace' ? cmd : '', ...rest].filter((x) => x !== ''))], { stdio: 'inherit' });
process.exit(r.status ?? 1);
