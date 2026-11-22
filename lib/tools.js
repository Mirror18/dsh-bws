/**
 * Agent tools for dsh-bws.
 *
 * 设计原则：**工具永远不把明文返回给模型**。
 * - `bws_list` 只回元数据（键名/分组/备注/长度）。
 * - `bws_run` 把值注入子进程环境变量后执行命令，只回 exit/stdout/stderr。
 *   这样明文只存在于那一次子进程的内存里，不会进入会话记录。
 *
 * 权限按调用方 workspace 判定（`canAccess`），与面板里的授权矩阵同一份数据。
 */

const JSON_OUT = {} // 注解式 schema：不约束 JSON 根（官方 SDK 对 json 输出就是这样发 {}）

function json (value) { return value }

function text (value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
}

function failure (message) {
  return { ok: false, error: String(message ?? 'unknown error') }
}

function int (value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

/**
 * @param {object} ctx Cordis context (with `tools` service).
 * @param {object} api host surface:
 *   `{ store(), groups(), canAccess(workspace, group, want), workspaceOf(exec), resolveWorkspace(input, exec), exec(command, env, opts) }`
 */
export function registerTools (ctx, api) {
  const disposers = []

  disposers.push(ctx.tools.register({
    name: 'bws_list',
    description:
      '列出凭证金库里的条目（只返回键名、分组、备注、长度，**不返回值**）。' +
      '可按 group 或名字片段过滤。要看某个值或要用它，请用 bws_run 把它注入环境变量执行命令。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        group: { type: 'string', description: '只看某个分组（分组 id，见返回里的 groups）' },
        query: { type: 'string', description: '按键名或备注做子串过滤' }
      }
    },
    output: { schema: JSON_OUT, render: (_args, value) => text(value) },
    async execute (args, exec) {
      const group = args?.group ? String(args.group) : ''
      const query = args?.query ? String(args.query).toLowerCase() : ''
      const workspace = await api.workspaceOf(exec)
      const groups = api.groups()
      const visible = groups.filter((g) => api.canAccess(workspace, g, 'read'))
      if (group && !visible.some((g) => g.id === group)) {
        return failure(`没有权限或不存在这个分组：${group}`)
      }
      const allowed = new Set(visible.map((g) => g.id))
      const items = api.store().list()
        .filter((s) => allowed.has(s.group))
        .filter((s) => !group || s.group === group)
        .filter((s) => !query || s.key.toLowerCase().includes(query) || String(s.note ?? '').toLowerCase().includes(query))
        .map((s) => ({
          key: s.key,
          group: s.group,
          note: s.note ?? '',
          valueLength: s.valueLength,
          updatedAt: s.updatedAt
        }))
      return json({
        ok: true,
        workspace,
        total: items.length,
        groups: visible.map((g) => ({
          id: g.id,
          title: g.title,
          tier: g.tier,
          count: api.store().list().filter((s) => s.group === g.id).length
        })),
        secrets: items
      })
    }
  }))

  disposers.push(ctx.tools.register({
    name: 'bws_run',
    description:
      '把凭证金库里的值注入环境变量，执行一条 shell 命令（bash -c），返回 exit/stdout/stderr。' +
      '这是使用凭证的正确方式：值不会出现在参数、日志或会话里。' +
      '注意命令自己的输出会回到会话中，所以不要让命令把密钥本身打印出来；要落盘就重定向到文件。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['command'],
      properties: {
        command: { type: 'string', description: '要执行的 shell 命令（bash -c）' },
        group: { type: 'string', description: '只注入这个分组（默认注入你有权限的全部）' },
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: '只注入这些键名（优先于 group）'
        },
        timeoutMs: { type: 'integer', description: '超时毫秒，默认 30000，最大 120000' }
      }
    },
    output: { schema: JSON_OUT, render: (_args, value) => text(value) },
    async execute (args, exec) {
      const store = api.store()
      if (!store.kdf()) return failure('凭证金库还没有初始化：请到 设置 → 内置插件 → 凭证金库 设置主口令')
      if (store.isLocked()) return failure('凭证金库已锁定：请到 设置 → 内置插件 → 凭证金库 解锁后再试')
      const command = String(args?.command ?? '').trim()
      if (!command) return failure('command 不能为空')

      const workspace = await api.workspaceOf(exec)
      const groups = api.groups()
      const byId = new Map(groups.map((g) => [g.id, g]))

      const wanted = Array.isArray(args?.keys) && args.keys.length > 0
        ? new Set(args.keys.map(String))
        : null
      const groupId = args?.group ? String(args.group) : ''
      if (groupId && !byId.has(groupId)) return failure(`不存在这个分组：${groupId}`)

      const injected = {}
      const denied = []
      for (const item of store.list()) {
        if (wanted) {
          if (!wanted.has(item.key)) continue
        } else if (groupId && item.group !== groupId) {
          continue
        }
        const group = byId.get(item.group)
        if (!api.canAccess(workspace, group, 'read')) { denied.push(item.key); continue }
        injected[item.key] = store.reveal(item.key)
      }
      if (denied.length > 0 && Object.keys(injected).length === 0) {
        return failure(`没有权限读取这些凭证（${denied.slice(0, 5).join(', ')}${denied.length > 5 ? ' …' : ''}）：请在 设置 → 内置插件 → 凭证金库 的「授权」里给当前工作区授权`)
      }

      const timeoutMs = Math.min(Math.max(int(args?.timeoutMs, 30000), 1000), 120000)
      const started = Date.now()
      const result = await api.exec(command, injected, { timeoutMs })
      return json({
        ok: true,
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        durationMs: Date.now() - started,
        injected: Object.keys(injected),
        skipped: denied,
        stdout: result.stdout,
        stderr: result.stderr
      })
    }
  }))

  disposers.push(ctx.tools.register({
    name: 'bws_grant',
    description:
      '给一个工作区授权某个凭证分组（read=只读 / write=读写 / none=撤销）。' +
      '新建工作区后可以用它把项目层分组授权给新工作区；通用层分组对所有工作区可读写，不需要授权。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        group: { type: 'string', description: '分组 id（见 bws_list 返回的 groups）' },
        level: { type: 'string', enum: ['read', 'write', 'none'], description: 'read=只读，write=读写，none=撤销授权' },
        workspace: { type: 'string', description: '工作区路径或 id；省略=当前会话所在工作区' }
      },
      required: ['group', 'level']
    },
    output: { schema: JSON_OUT, render: (_args, value) => text(value) },
    async execute (args, exec) {
      const store = api.store()
      const group = store.groups().find((g) => g.id === args.group)
      if (!group) {
        return { ok: false, error: '没有这个分组：' + args.group, groups: store.groups().map((g) => g.id) }
      }
      if (group.tier === 'shared') {
        return { ok: false, error: '「' + group.title + '」是通用层分组，对所有工作区可读写，不需要单独授权' }
      }
      const target = await api.resolveWorkspace(args.workspace, exec)
      if (!target) {
        return { ok: false, error: '找不到工作区：' + (args.workspace || '(当前会话所在工作区)') }
      }
      const grants = store.grants().filter((g) => !(g.workspace === target.id && g.group === group.id))
      if (args.level !== 'none') grants.push({ workspace: target.id, group: group.id, level: args.level })
      store.saveGrants(grants)
      return {
        ok: true,
        workspace: { id: target.id, title: target.title, path: target.path },
        group: group.id,
        level: args.level
      }
    }
  }))

  return () => {
    for (const dispose of disposers.reverse()) {
      try { dispose?.() } catch { /* 已经掉了就算了 */ }
    }
  }
}
