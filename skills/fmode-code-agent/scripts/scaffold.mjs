#!/usr/bin/env node
/**
 * scaffold.mjs —— 生成一个**最小可跑的智能体骨架**（无构建）。
 *
 * 用法：node scaffold.mjs <targetDir> --project <name> [--force]
 *
 * 产出结构（源码即产物，浏览器直跑）：
 *   <target>/
 *     CLAUDE.md
 *     src/ index.html   <base> + importmap(最小) + 入口
 *          app.js       装配 + 路由
 *          lib/         智能体核心（纯 JS，双兼容）
 *            graph.js   一个最小 LangGraph 图（route → plan → respond）
 *            fmode-chat.js  最小 OpenAI 兼容客户端
 *            telemetry.js   token/耗时埋点
 *          mcp/         MCP 层
 *            protocol.js  JSON-RPC 2.0 骨架
 *            tool-specs.js 工具规格（JSON Schema）
 *            worker.js   Worker 宿主
 *     scripts/ deploy.sh  无构建部署 + 自动部署 + 验真
 *     .claude/rules/       智能体规则（从规则仓同步）
 *
 * 诚实失败：目标已存在文件默认**不覆盖**（--force 才覆盖）。
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const target = args.find((a) => a && !a.startsWith('-'));
const projIdx = args.indexOf('--project');
const project = projIdx > -1 ? args[projIdx + 1] : 'my-agent';
const force = args.includes('--force');

if (!target) { console.error('用法：node scaffold.mjs <targetDir> --project <name> [--force]'); process.exit(2); }
const root = resolve(target);

const files = {};
const add = (p, c) => { files[p] = c; };

add('src/index.html', `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <base href="/${project}/" />
  <title>${project} · 智能体</title>
  <!-- 依赖走 importmap（浏览器无构建）。生产环境可改为 Repose 公共 importmap。 -->
  <script type="importmap">
  {
    "imports": {
      "lit": "/dev/npm/lit/v3.3.3/index.js",
      "lit/": "/dev/npm/lit/v3.3.3/",
      "@lit-labs/signals": "/dev/npm/@lit-labs/signals/v0.3.0/index.js",
      "@langchain/langgraph": "./vendor/langgraph/@langchain/langgraph/dist/web.js",
      "@langchain/langgraph/": "./vendor/langgraph/@langchain/langgraph/",
      "@langchain/core": "./vendor/langgraph/@langchain/core/dist/index.js",
      "@langchain/core/": "./vendor/langgraph/@langchain/core/",
      "langsmith": "./vendor/shims/langsmith.js",
      "langsmith/run_trees": "./vendor/shims/langsmith.js",
      "node:async_hooks": "./vendor/shims/async-hooks.js",
      "base64-js": "./vendor/shims/base64-js.js"
    }
  }
  </script>
</head>
<body>
  <app-root></app-root>
  <script type="module" src="./app.js"></script>
</body>
</html>
`);

add('src/app.js', `/**
 * app.js —— 最小智能体入口（无构建）。
 * 依赖：lit（importmap）+ lib/graph.js。此处只要跑通「一句话 → 图 → 回复」。
 */
import { html, LitElement } from 'lit';
import { signal } from '@lit-labs/signals';
import { runTurn } from './lib/graph.js';

class AppRoot extends LitElement {
  static properties = { _reply: { type: String, state: true }, _busy: { type: Boolean, state: true } };
  createRenderRoot() { return this; }              // 无构建演示：不用 Shadow DOM 也行
  constructor() { super(); this._reply = ''; this._busy = false; }

  async _submit(e) {
    e.preventDefault();
    const text = this.renderRoot.querySelector('input').value.trim();
    if (!text) return;
    this._busy = true; this._reply = '';
    try {
      const out = await runTurn({ utterance: text }, { token: window.__FMODE_TOKEN__ || '' });
      this._reply = out.state?.reply || '（无回复）';
    } catch (err) {
      this._reply = '出错：' + (err?.message || err);
    } finally { this._busy = false; }
  }

  render() {
    return html\`
      <h1>${project} · 智能体</h1>
      <form @submit=\${this._submit}>
        <input placeholder="说点什么…" ?disabled=\${this._busy} />
        <button ?disabled=\${this._busy}>\${this._busy ? '…' : '发送'}</button>
      </form>
      \${this._reply ? html\`<pre>\${this._reply}</pre>\` : ''}
    \`;
  }
}
customElements.define('app-root', AppRoot);
void signal;
`);

add('src/lib/graph.js', `/**
 * lib/graph.js —— 最小 LangGraph 图：route → plan → respond。
 * ⚠️ 浏览器无构建要点见规则 .claude/rules/no-build-langgraph.md：
 *    - 3 个替身（langsmith / node:async_hooks / base64-js）缺一白屏；
 *    - ctx 挂 config.configurable.__dc（别用闭包）；
 *    - 凭据不进 State。
 */
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { chatComplete } from './fmode-chat.js';

const S = Annotation.Root({
  utterance: Annotation({ reducer: (_, b) => b, default: () => '' }),
  reply: Annotation({ reducer: (_, b) => b, default: () => '' }),
});

function ctxOf(config) {
  const c = config?.configurable?.__dc;
  if (!c) throw new Error('运行时上下文缺失（config.configurable.__dc）');
  return c;
}

async function planNode(state, config) {
  const { token, model } = ctxOf(config);
  const res = await chatComplete({
    token, model,
    messages: [
      { role: 'system', content: '你是一个简洁的助手，用中文回答。' },
      { role: 'user', content: state.utterance },
    ],
  });
  return { reply: res.content || '' };
}
// respond 占位（真实项目在此收尾/落库）
async function respondNode(state) { return {}; }

let compiled = null;
function build() {
  return new StateGraph(S)
    .addNode('plan', planNode)
    .addNode('respond', respondNode)
    .addEdge(START, 'plan')
    .addEdge('plan', 'respond')
    .addEdge('respond', END)
    .compile();
}

export async function runTurn({ utterance }, { token, model = 'deepseek-flash' } = {}) {
  if (!compiled) compiled = build();
  const state = await compiled.invoke(
    { utterance: String(utterance || '') },
    { configurable: { __dc: { token, model } } },
  );
  return { state };
}
`);

add('src/lib/fmode-chat.js', `/**
 * lib/fmode-chat.js —— 最小 OpenAI 兼容客户端（自写，不引 @langchain/openai）。
 * 凭据显式传入；错误剔除疑似 key。
 */
const BASE = 'https://api.fmode.cn/v1';

function scrub(t) { return String(t ?? '').replace(/(sk-[A-Za-z0-9_-]{6,}|Bearer\\s+\\S+)/g, '[redacted]'); }

export async function chatComplete({ token, model, messages, tools, signal, timeoutMs = 45000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(\`\${BASE}/chat/completions\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: \`Bearer \${token}\` } : {}) },
      body: JSON.stringify({ model, messages, ...(tools ? { tools } : {}) }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let data; try { data = JSON.parse(raw); } catch { data = raw; }
    if (!res.ok) throw new Error(scrub(\`HTTP \${res.status} \${typeof data === 'string' ? data : JSON.stringify(data)}\`));
    const msg = data?.choices?.[0]?.message || {};
    return { content: msg.content || '', toolCalls: msg.tool_calls || [], usage: data?.usage || null };
  } finally { clearTimeout(timer); }
}
`);

add('src/lib/telemetry.js', `/**
 * lib/telemetry.js —— token 归因 + 耗时分离（口径见规则 measurement.md）。
 * 关键：框架调度与 IO 分开计时；await 期间暂停框架计时。
 */
const timers = new Map();
export const t0 = (k) => { timers.set(k, performance.now()); return k; };
export const t1 = (k) => { const s = timers.get(k); if (s == null) return 0; timers.delete(k); return performance.now() - s; };

export function estimateTokens(text) {
  const s = String(text ?? ''); let cjk = 0;
  for (const ch of s) { const c = ch.codePointAt(0); if (c >= 0x4e00 && c <= 0x9fff) cjk += 1; }
  return Math.round(cjk + (s.length - cjk) / 4);
}

/** 记一次 LLM 调用的 token（分项 + 输入输出） */
export function newTokenLedger() { return { calls: 0, buckets: {}, io: { in: 0, out: 0, hasReal: false } }; }
export function recordCall(ledger, { system = '', tools = [], history = [], retrieved = '', actual } = {}) {
  const parts = {
    system: estimateTokens(system),
    tools: estimateTokens(JSON.stringify(tools || [])),
    history: estimateTokens(JSON.stringify(history || [])),
    retrieved: estimateTokens(retrieved),
  };
  ledger.calls += 1;
  for (const [k, v] of Object.entries(parts)) ledger.buckets[k] = (ledger.buckets[k] || 0) + v;
  const est = Object.values(parts).reduce((a, b) => a + b, 0);
  ledger.io.in += actual?.prompt_tokens ?? est;
  ledger.io.out += actual?.completion_tokens ?? 0;
  if (actual?.prompt_tokens != null) ledger.io.hasReal = true;
}

/** 输入:输出比例（无输出真值时 ratio=null，不硬凑） */
export function ioRatio(io) {
  const { in: i, out: o } = io || { in: 0, out: 0 };
  return { in: i, out: o, ratio: o > 0 ? +(i / o).toFixed(2) : null, total: i + o };
}
`);

add('src/mcp/protocol.js', `/**
 * mcp/protocol.js —— 最小 MCP（JSON-RPC 2.0）服务端骨架。
 * ⚠️ Worker 内**只能** import 相对路径纯 JS（module worker 不支持 importmap）。
 */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

export class McpServer {
  constructor(info = {}) { this.info = { name: 'mcp', version: '0.1.0', ...info }; this.tools = new Map(); }
  register(tool) {
    if (!tool?.name || typeof tool.handler !== 'function' || !tool.inputSchema) throw new Error('非法工具定义');
    this.tools.set(tool.name, tool);
  }
  async handle(req, ctx = {}) {
    const { id, method, params } = req || {};
    const ok = (result) => ({ jsonrpc: '2.0', id, result });
    const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (method === 'initialize') return ok({ protocolVersion: MCP_PROTOCOL_VERSION, serverInfo: this.info, capabilities: { tools: {} } });
    if (method === 'tools/list') return ok({ tools: [...this.tools.values()].map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    if (method === 'tools/call') {
      const t = this.tools.get(params?.name);
      if (!t) return err(-32602, \`未知工具：\${params?.name}\`);
      try { return ok(await t.handler(params?.arguments || {}, ctx)); }
      catch (e) { return err(-32000, String(e?.message || e)); }
    }
    if (method === 'ping') return ok({});
    return err(-32601, \`未实现的方法：\${method}\`);
  }
}
`);

add('src/mcp/tool-specs.js', `/**
 * mcp/tool-specs.js —— 工具规格（**纯 JS + JSON Schema**，Worker 内可用）。
 * 主线程侧的 zod 版应与本文件的参数键保持一致（assertSpecParity）。
 */
export const TOOL_SPECS = [
  {
    name: 'echo',
    title: '回声',
    description: '把输入原样返回。最小示例工具。',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    buildBrief: (a) => String(a?.text ?? '').trim(),
  },
];
`);

add('src/mcp/worker.js', `/**
 * mcp/worker.js —— Worker 宿主（浏览器端 MCP）。
 * 纪律：只 import 相对路径纯 JS；**凭据不进来**（要凭据的动作由主线程做）。
 */
import { McpServer } from './protocol.js';
import { TOOL_SPECS } from './tool-specs.js';

const server = new McpServer({ name: '${project}-mcp', version: '0.1.0' });
for (const spec of TOOL_SPECS) {
  server.register({
    name: spec.name, description: spec.description, inputSchema: spec.inputSchema,
    handler: async (args) => ({ content: [{ type: 'text', text: 'ok: ' + spec.buildBrief(args) }] }),
  });
}
self.onmessage = async (e) => {
  const m = e.data;
  if (!m || typeof m !== 'object') return;
  const res = await server.handle(m, {});
  if (res) self.postMessage(res);
};
`);

add('package.json', `{
  "name": "${project}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "无构建智能体（源码即产物，浏览器 ESM 直跑）",
  "scripts": {
    "check": "node --check src/app.js && node --check src/lib/graph.js && node --check src/mcp/protocol.js"
  }
}
`);

add('scripts/deploy.sh', `#!/usr/bin/env bash
# 无构建部署 + 自动部署（参数化，别硬编码站点）。
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO_ROOT"
PROJECT="\${PROJECT:-${project}}"
OBSUTIL="\${OBSUTIL:-obsutil}"
EP="\${OBS_ENDPOINT:-obs.<region>.myhuaweicloud.com}"
BUCKET="\${OBS_BUCKET:?请设置 OBS_BUCKET（如 obs://my-bucket）}"
# 凭据从环境注入；**AK/SK 不写进本文件**
OBS_AK="\${OBS_AK:?set OBS_AK}"; OBS_SK="\${OBS_SK:?set OBS_SK}"
PREFIX="dev/$PROJECT"

echo "==> 体检"; node --check src/app.js
echo "==> index.html 先删后传"
"$OBSUTIL" rm "$BUCKET/$PREFIX/index.html" -i="$OBS_AK" -k="$OBS_SK" -e="$EP" -f >/dev/null 2>&1 || true
"$OBSUTIL" cp ./src/index.html "$BUCKET/$PREFIX/index.html" -i="$OBS_AK" -k="$OBS_SK" -e="$EP" -acl=public-read -f \\
  -meta="Cache-Control:no-cache, no-store, must-revalidate#Content-Type:text/html; charset=utf-8" >/dev/null
echo "==> 同步源码 + vendor"
"$OBSUTIL" sync ./src/ "$BUCKET/$PREFIX/" -i="$OBS_AK" -k="$OBS_SK" -e="$EP" -acl=public-read -exclude="index.html"
[ -d ./vendor ] && "$OBSUTIL" sync ./vendor/ "$BUCKET/$PREFIX/vendor/" -i="$OBS_AK" -k="$OBS_SK" -e="$EP" -acl=public-read
echo "==> 刷 CDN（自行接刷新脚本；失败要退出非 0）"
echo "完成：https://<domain>/$PREFIX/"
`);

add('CLAUDE.md', `# ${project} — 项目规范

本项目遵守 **fmode-code-agent** 规则（智能体开发）。

- 规则索引：\`.claude/rules/agent-architecture.md\`（三层架构）、\`agent-mcp-skill.md\`、
  \`no-build-langgraph.md\`、\`measurement.md\`、\`deployment.md\`、\`pitfalls.md\`。
- 前端规范（如用 Lit）见 **fmode-code-lit** 规则仓。

## 自动部署
\`\`\`bash
bash scripts/install-hooks.sh     # 装上 pre-push：体检 → 发布 → 验真
bash scripts/auto-deploy.sh --watch
\`\`\`
`);

// ---- 落盘（不覆盖已存在，除非 --force）----
let created = 0, skipped = 0;
for (const [rel, content] of Object.entries(files)) {
  const p = join(root, rel);
  if (existsSync(p) && !force) { skipped++; console.log('  · 跳过（已存在）', rel); continue; }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  if (rel.endsWith('.sh')) { try { chmodSync(p, 0o755); } catch {} }
  created++;
}

// 同步规则（若有）
console.log(`骨架生成：新增 ${created} 个，跳过 ${skipped} 个 → ${root}`);
console.log('下一步：');
console.log('  1) 同步 LangGraph 依赖到 vendor/（见规则 no-build-langgraph.md）');
console.log('  2) 装规则：node <skill_dir>/scripts/install-rules.mjs .');
console.log('  3) 本地预览：python3 -m http.server（或任意静态服务器）');
