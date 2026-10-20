#!/usr/bin/env node
/**
 * smoke.mjs —— fmode-code-agent 技能自检（不联网、不写业务仓）。
 *
 * 检查：
 *   1) 规则文件齐全（CLAUDE.md 索引到的每一篇都在）
 *   2) SKILL.md frontmatter 完整
 *   3) 各脚本可被 node --check 解析
 *   4) scaffold 能生成骨架且产物语法正确（在临时目录里真跑一遍）
 *   5) 生成骨架里的 MCP 协议**功能可用**（initialize / tools/list / tools/call）
 *
 * 退出码非 0 = 有问题。
 */
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, '..');
const repoRoot = resolve(skillDir, '../..');

let fail = 0;
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad = (m) => { console.log('  \x1b[31m✗\x1b[0m ' + m); fail++; };

console.log('fmode-code-agent 自检\n');

// 1) 规则文件
console.log('[1] 规则文件');
const rulesDir = join(repoRoot, '.claude', 'rules');
const mustHave = ['agent-architecture.md', 'agent-mcp-skill.md', 'no-build-langgraph.md',
  'measurement.md', 'deployment.md', 'llm-gateway.md', 'agent-ui-bridge.md', 'pitfalls.md'];
for (const f of mustHave) {
  existsSync(join(rulesDir, f)) ? ok(`rules/${f}`) : bad(`缺 rules/${f}`);
}
// CLAUDE.md 里索引到的篇章必须都存在
const claude = join(repoRoot, 'CLAUDE.md');
if (existsSync(claude)) {
  const txt = readFileSync(claude, 'utf8');
  const linked = [...txt.matchAll(/\(\.\/\.claude\/rules\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
  const missing = linked.filter((l) => !existsSync(join(rulesDir, l)));
  missing.length ? bad('CLAUDE.md 索引了不存在的规则：' + missing.join(', ')) : ok(`CLAUDE.md 索引的 ${linked.length} 篇规则均存在`);
} else bad('缺 CLAUDE.md');

// 2) SKILL.md frontmatter
console.log('[2] SKILL.md');
const skillMd = join(skillDir, 'SKILL.md');
if (existsSync(skillMd)) {
  const t = readFileSync(skillMd, 'utf8');
  const has = (k) => new RegExp(`^${k}:`, 'm').test(t);
  ['name', 'description', 'version', 'license'].every(has) ? ok('frontmatter 完整') : bad('frontmatter 缺字段');
  /^name:\s*fmode-code-agent\s*$/m.test(t) ? ok('name = fmode-code-agent') : bad('name 不是 fmode-code-agent');
} else bad('缺 SKILL.md');

// 3) 脚本语法
console.log('[3] 脚本语法（node --check）');
for (const s of ['install-rules.mjs', 'scaffold.mjs', 'smoke.mjs']) {
  const p = join(skillDir, 'scripts', s);
  if (!existsSync(p)) { bad(`缺 scripts/${s}`); continue; }
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); ok(`scripts/${s}`); }
  catch (e) { bad(`scripts/${s} 语法错误：${String(e.stderr || e).slice(0, 120)}`); }
}

// 4) scaffold 真跑一遍 + 产物语法
console.log('[4] scaffold 产物');
const tmp = mkdtempSync(join(tmpdir(), 'fca-smoke-'));
try {
  execFileSync(process.execPath, [join(skillDir, 'scripts', 'scaffold.mjs'), tmp, '--project', 'smoke-agent'], { stdio: 'pipe' });
  const need = ['src/index.html', 'src/app.js', 'src/lib/graph.js', 'src/mcp/protocol.js', 'src/mcp/worker.js', 'scripts/deploy.sh'];
  for (const f of need) existsSync(join(tmp, f)) ? ok(`产出 ${f}`) : bad(`缺产出 ${f}`);
  // 产物语法
  for (const f of ['src/app.js', 'src/lib/graph.js', 'src/lib/fmode-chat.js', 'src/lib/telemetry.js', 'src/mcp/protocol.js', 'src/mcp/worker.js']) {
    const p = join(tmp, f);
    if (!existsSync(p)) continue;
    try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
    catch { bad(`产物语法错误 ${f}`); }
  }
  ok('产物语法全部通过');

  // 5) MCP 协议功能
  console.log('[5] 生成骨架的 MCP 协议功能');
  const script = `
    import { McpServer } from ${JSON.stringify(join(tmp, 'src/mcp/protocol.js'))};
    import { TOOL_SPECS } from ${JSON.stringify(join(tmp, 'src/mcp/tool-specs.js'))};
    const s = new McpServer({name:'smoke'});
    for (const spec of TOOL_SPECS) s.register({ name: spec.name, description: spec.description, inputSchema: spec.inputSchema, handler: async (a)=>({content:[{type:'text',text:'ok:'+spec.buildBrief(a)}]}) });
    const init = await s.handle({jsonrpc:'2.0',id:1,method:'initialize'});
    if (!init.result?.serverInfo?.name) throw new Error('initialize 失败');
    const list = await s.handle({jsonrpc:'2.0',id:2,method:'tools/list'});
    if (!list.result?.tools?.length) throw new Error('tools/list 空');
    const call = await s.handle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'echo',arguments:{text:'hi'}}});
    if (call.result?.content?.[0]?.text !== 'ok:hi') throw new Error('tools/call 结果不符');
    console.log('protocol-ok');
  `;
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe' }).toString();
    out.includes('protocol-ok') ? ok('MCP 协议 initialize/tools-list/tools-call 均可跑') : bad('MCP 协议输出异常');
  } catch (e) { bad('MCP 协议功能测试失败：' + String(e.stderr || e).slice(0, 160)); }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
if (fail === 0) { console.log('自检通过 ✓'); process.exit(0); }
console.log(`自检失败（${fail} 项）`); process.exit(1);
