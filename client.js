window.__ModuleLoader__.load({
  id: 'dsh-bws',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-bws-style'

    const CSS = `
.bwsx-root {
  display: flex; flex-direction: column; gap: 12px; container-type: inline-size;
  color: var(--dsw-text-primary, #e6e8ee); font-size: 13px; line-height: 1.45;
}
.bwsx-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.bwsx-title { margin: 0 0 3px; font-size: 14px; font-weight: 600; }
.bwsx-sub { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--dsw-text-secondary, #9aa3b2); font-size: 12px; }
.bwsx-sub code { font-family: var(--dsw-font-mono, ui-monospace, monospace); }
.bwsx-btn {
  appearance: none; flex: none; cursor: pointer; font: inherit; font-size: 12px;
  padding: 5px 11px; border-radius: 8px; color: inherit;
  border: 1px solid var(--dsw-border, #34384a); background: var(--dsw-bg-elevated, #22242f);
}
.bwsx-btn:hover { background: var(--dsw-hover, #2b2e3b); }
.bwsx-btn:disabled { opacity: .55; cursor: default; }
.bwsx-banner {
  padding: 8px 10px; border-radius: 8px; font-size: 12px;
  border: 1px solid var(--dsw-alias-state-error-primary, #b4443f);
  background: rgba(180, 68, 63, .12);
}
.bwsx-banner b { display: block; margin-bottom: 2px; }
.bwsx-warn {
  padding: 7px 10px; border-radius: 8px; font-size: 12px; line-height: 1.5;
  border: 1px solid rgba(214, 158, 46, .55); background: rgba(214, 158, 46, .12);
}
.bwsx-warn b { color: #e0b050; margin-right: 6px; }
.bwsx-warn button { margin-left: 8px; }
.bwsx-search {
  width: 100%; box-sizing: border-box; font: inherit; font-size: 12.5px;
  padding: 6px 10px; border-radius: 8px; color: inherit;
  border: 1px solid var(--dsw-border, #34384a);
  background: var(--dsw-bg-inset, #1b1d26);
}
.bwsx-search:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #4c7dff); }
.bwsx-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.bwsx-chip {
  appearance: none; cursor: pointer; font: inherit; font-size: 11.5px;
  padding: 3px 10px; border-radius: 999px; color: var(--dsw-text-secondary, #9aa3b2);
  border: 1px solid var(--dsw-border, #34384a); background: transparent;
}
.bwsx-chip:hover { color: var(--dsw-text-primary, #e6e8ee); }
.bwsx-chip[data-on="1"] {
  color: var(--dsw-text-primary, #e6e8ee);
  border-color: var(--dsw-alias-brand-primary, #4c7dff);
  background: rgba(76, 125, 255, .16);
}
.bwsx-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: start; }
/* 版面跟面板宽度走，不跟视口走：设置面板只有 ~560px 时保持单列。 */
@container (min-width: 700px) {
  .bwsx-body { grid-template-columns: minmax(0, 1fr) 288px; }
}
@container (max-width: 699px) {
  .bwsx-list { max-height: 34vh; }
}
.bwsx-list {
  max-height: 46vh; overflow: auto; display: flex; flex-direction: column; gap: 2px;
  padding: 4px; border-radius: 10px;
  border: 1px solid var(--dsw-border, #34384a); background: var(--dsw-bg-inset, #1b1d26);
}
.bwsx-row {
  display: flex; flex-direction: column; gap: 1px; cursor: pointer; width: 100%;
  padding: 6px 8px; border-radius: 7px; border: 1px solid transparent;
  text-align: left; font: inherit; color: inherit; background: transparent;
}
.bwsx-row:hover { background: var(--dsw-hover, #2b2e3b); }
.bwsx-row[data-sel="1"] {
  background: var(--dsw-bg-elevated, #262936);
  border-color: var(--dsw-alias-brand-primary, #4c7dff);
}
.bwsx-key {
  font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bwsx-note {
  font-size: 11.5px; color: var(--dsw-text-secondary, #9aa3b2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bwsx-empty { padding: 18px 10px; text-align: center; color: var(--dsw-text-secondary, #9aa3b2); font-size: 12px; }
.bwsx-detail {
  padding: 10px 12px; border-radius: 10px; min-width: 0;
  border: 1px solid var(--dsw-border, #34384a); background: var(--dsw-bg-elevated, #22242f);
}
.bwsx-detail h4 {
  margin: 0 0 8px; font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere;
  font-family: var(--dsw-font-mono, ui-monospace, monospace);
}
.bwsx-kv {
  display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 8px;
  padding: 5px 0; border-top: 1px solid var(--dsw-border, #34384a); font-size: 12px;
}
.bwsx-kv:first-of-type { border-top: 0; }
.bwsx-kv dt { color: var(--dsw-text-secondary, #9aa3b2); margin: 0; }
.bwsx-kv dd { margin: 0; overflow-wrap: anywhere; }
.bwsx-secret {
  font-family: var(--dsw-font-mono, ui-monospace, monospace); letter-spacing: 1px;
  color: var(--dsw-text-secondary, #9aa3b2);
}
.bwsx-sk {
  height: 33px; border-radius: 7px;
  background: linear-gradient(90deg, #23262f 25%, #2c3040 37%, #23262f 63%);
  background-size: 400% 100%; animation: bwsx-sh 1.3s ease-in-out infinite;
}
@keyframes bwsx-sh { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
.bwsx-foot { font-size: 11px; color: var(--dsw-text-secondary, #9aa3b2); }

/* —— M3：分层与授权 —— */
.bwsx-stack { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.bwsx-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--dsw-border, rgba(255,255,255,.09)); padding-bottom: 2px; }
.bwsx-tab {
  appearance: none; cursor: pointer; font: inherit; font-size: 12px; padding: 5px 12px;
  border: 1px solid transparent; border-radius: 8px 8px 0 0; background: transparent;
  color: var(--dsw-text-secondary, #9aa3b2);
}
.bwsx-tab[data-on="1"] {
  color: var(--dsw-text-primary, #e6e8ee); background: var(--dsw-bg-elevated, rgba(255,255,255,.05));
  border-color: var(--dsw-border, rgba(255,255,255,.09)); border-bottom-color: transparent;
}
.bwsx-access { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.bwsx-arow {
  border: 1px solid var(--dsw-border, rgba(255,255,255,.09)); border-radius: 10px;
  padding: 9px 11px; background: var(--dsw-bg-inset, rgba(255,255,255,.03));
  display: flex; flex-direction: column; gap: 8px; min-width: 0;
}
.bwsx-ah { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.bwsx-ah b { font-size: 13px; font-weight: 600; }
.bwsx-ah select, .bwsx-aw select { margin-left: auto; }
.bwsx-awork { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.bwsx-wcard { border: 1px solid var(--dsw-border, #2a3040); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.bwsx-wcard[data-new="1"] { border-color: var(--dsw-alias-brand-primary, #4f7cff); }
.bwsx-wh { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: nowrap; }
.bwsx-wh b { flex: 0 1 auto; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bwsx-wpath { flex: 1 1 auto; min-width: 0; text-align: right; font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; color: var(--dsw-text-secondary, #9aa3b2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bwsx-tag { flex: none; white-space: nowrap; font-size: 11px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--dsw-alias-brand-primary, #4f7cff); color: var(--dsw-alias-brand-primary, #4f7cff); }
.bwsx-tag[data-tone="warn"] { border-color: var(--dsw-alias-state-warning-primary, #d6a52a); color: var(--dsw-alias-state-warning-primary, #d6a52a); }
.bwsx-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.bwsx-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 3px 8px; border-radius: 999px; cursor: pointer; background: var(--dsw-bg-inset, #171b24); color: var(--dsw-text-secondary, #9aa3b2); border: 1px solid var(--dsw-border, #2a3040); }
.bwsx-chip em { font-style: normal; font-size: 11px; opacity: .75; }
.bwsx-chip[data-lv="read"] { border-color: var(--dsw-alias-brand-primary, #4f7cff); color: var(--dsw-text-primary, #e6e9ef); }
.bwsx-chip[data-lv="write"] { border-color: var(--dsw-alias-brand-primary, #4f7cff); background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4f7cff) 18%, transparent); color: var(--dsw-text-primary, #e6e9ef); }
.bwsx-chip[data-lv="all"] { border-style: dashed; }
.bwsx-aw { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; }
.bwsx-gid { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; color: var(--dsw-text-secondary, #9aa3b2); }
.bwsx-aw span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

/* —— M2：取值 / 增删改 / 试运行 —— */
.bwsx-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.bwsx-btn[data-tone="danger"] { border-color: rgba(180, 68, 63, .6); color: #e78680; }
.bwsx-btn[data-tone="primary"] { border-color: var(--dsw-alias-brand-primary, #4c7dff); background: rgba(76, 125, 255, .14); }
.bwsx-value {
  margin: 2px 0 6px; padding: 7px 9px; border-radius: 8px; max-height: 160px; overflow: auto;
  border: 1px dashed rgba(214, 158, 46, .6); background: rgba(214, 158, 46, .08);
  font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11.5px;
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.bwsx-notice {
  padding: 6px 10px; border-radius: 8px; font-size: 12px;
  border: 1px solid var(--dsw-border, #34384a); background: var(--dsw-bg-inset, #1b1d26);
}
.bwsx-notice[data-kind="err"] { border-color: rgba(180, 68, 63, .6); background: rgba(180, 68, 63, .12); }
.bwsx-notice[data-kind="ok"] { border-color: rgba(74, 158, 108, .55); background: rgba(74, 158, 108, .12); }
.bwsx-run { border-top: 1px solid var(--dsw-border, #34384a); padding-top: 10px; }
.bwsx-run summary { cursor: pointer; font-size: 12px; color: var(--dsw-text-secondary, #9aa3b2); }
.bwsx-run-body { display: flex; flex-direction: column; gap: 8px; margin-top: 9px; }
.bwsx-field { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--dsw-text-secondary, #9aa3b2); }
.bwsx-field input, .bwsx-field select, .bwsx-field textarea {
  width: 100%; box-sizing: border-box; font: inherit; font-size: 12px; color: var(--dsw-text-primary, #e6e8ee);
  padding: 6px 9px; border-radius: 8px; border: 1px solid var(--dsw-border, #34384a);
  background: var(--dsw-bg-inset, #1b1d26);
}
.bwsx-field textarea { min-height: 64px; resize: vertical; font-family: var(--dsw-font-mono, ui-monospace, monospace); }
.bwsx-field input:focus, .bwsx-field select:focus, .bwsx-field textarea:focus {
  outline: none; border-color: var(--dsw-alias-brand-primary, #4c7dff);
}
.bwsx-out {
  margin: 0; padding: 8px 9px; border-radius: 8px; max-height: 220px; overflow: auto;
  background: #12141b; border: 1px solid var(--dsw-border, #34384a);
  font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11.5px;
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.bwsx-out[data-err="1"] { border-color: rgba(180, 68, 63, .6); }
.bwsx-modal {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  background: rgba(8, 9, 13, .55); padding: 18px;
}
.bwsx-card {
  width: min(460px, 100%); max-height: 84vh; overflow: auto; box-sizing: border-box;
  padding: 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px;
  background: var(--dsw-bg-elevated, #22242f); border: 1px solid var(--dsw-border, #34384a);
  box-shadow: 0 18px 48px rgba(0, 0, 0, .45);
}
.bwsx-card h4 { margin: 0; font-size: 13px; }
.bwsx-card-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
.bwsx-hint { font-size: 11px; color: var(--dsw-text-secondary, #9aa3b2); line-height: 1.5; }
`

    function ensureStyle() {
      if (typeof document === 'undefined' || !document.head) return
      if (document.getElementById(STYLE_ID)) return
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = CSS
      document.head.appendChild(el)
    }

    // 浏览器侧的兜底：上一次取到的元数据留在本机（无 value），
    // 这样 bws 掉线时面板仍能显示索引，而不是一片空白。
    const CACHE_KEY = 'dsh-bws:vault:v1'

    function readCache() {
      try {
        if (typeof localStorage === 'undefined') return null
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw || raw.length > 512 * 1024) return null
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.secrets)) return null
        return parsed
      } catch {
        return null
      }
    }

    function writeCache(vault) {
      try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(CACHE_KEY, JSON.stringify(vault))
      } catch {
        // 配额满/隐私模式：忽略即可，服务端还有快照。
      }
    }

    /** 写操作带自定义头：浏览器会先发 CORS 预检，别的站点伪造不了。 */
    async function post(path, body) {
      const response = await fetch('/bws' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dsh-bws': '1', accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body === undefined ? {} : body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || response.status + ' ' + response.statusText)
      }
      return payload
    }

    async function getJson(path) {
      const response = await fetch('/bws' + path, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || response.status + ' ' + response.statusText)
      }
      return payload
    }

    function Panel() {
      const [phase, setPhase] = React.useState('loading')
      const [status, setStatus] = React.useState(null)
      const [vault, setVault] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [pass, setPass] = React.useState('')
      const [pass2, setPass2] = React.useState('')
      const [authError, setAuthError] = React.useState(null)
      const [query, setQuery] = React.useState('')
      const [groupId, setGroupId] = React.useState('all')
      const [selectedKey, setSelectedKey] = React.useState(null)
      const [revealed, setRevealed] = React.useState(null)
      const [editor, setEditor] = React.useState(null)
      const [pendingDelete, setPendingDelete] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [credCheck, setCredCheck] = React.useState(null) // 本机钥匙/口令是否真的能开库
      const [hintDismissed, setHintDismissed] = React.useState(false)
      const [run, setRun] = React.useState({ group: 'all', command: '', busy: false, result: null, error: null })
      const [tab, setTab] = React.useState('secrets')
      const [access, setAccess] = React.useState({ status: 'idle', data: null, error: null, busy: false, draft: null, notice: null, newGroup: '' })
      const [sync, setSync] = React.useState({ busy: false, result: null, error: null, gh: '', gitee: '', saving: false })
      const [passwd, setPasswd] = React.useState({ current: '', next: '', again: '', busy: false, msg: null })
      const detailRef = React.useRef(null)

      const checkCredentials = React.useCallback(() => {
        post('/credential/check', {})
          .then((body) => setCredCheck(body))
          .catch(() => setCredCheck(null))
      }, [])

      const loadVault = React.useCallback(() => {
        setBusy(true)
        getJson('/vault')
          .then((body) => {
            writeCache(body)
            setVault(body)
            setError(null)
            setPhase('ready')
          })
          .catch((err) => {
            const cached = readCache()
            if (cached) {
              setVault({ ...cached, stale: true, staleReason: String((err && err.message) || err) })
              setPhase('ready')
            } else {
              setError(String((err && err.message) || err))
              setPhase('error')
            }
          })
          .finally(() => setBusy(false))
      }, [])

      const bootstrap = React.useCallback(() => {
        setPhase((prev) => (prev === 'ready' ? prev : 'loading'))
        getJson('/status')
          .then((body) => {
            setStatus(body)
            setSync((prev) => {
              const byName = new Map((body.remotes || []).map((r) => [r.name, r.url]))
              return { ...prev, gh: byName.get('origin') || prev.gh, gitee: byName.get('gitee') || prev.gitee }
            })
            if (!body.initialized) { setPhase('setup'); return }
            if (body.locked) { setPhase('locked'); return }
            loadVault()
            checkCredentials()
          })
          .catch((err) => { setError(String((err && err.message) || err)); setPhase('error') })
      }, [loadVault])

      React.useEffect(() => { bootstrap() }, [bootstrap])

      // 空闲自动锁定发生在服务端：面板每 30 秒探一次，发现被锁就回到口令门。
      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        const timer = setInterval(() => {
          getJson('/status').then((body) => {
            if (!body || !body.locked) return
            setVault(null)
            setRevealed(null)
            setPass('')
            setAuthError('金库空闲超过设定时间，已自动锁定')
            setPhase('locked')
          }).catch(() => {})
        }, 30_000)
        return () => clearInterval(timer)
      }, [phase])

      React.useEffect(() => {
        if (!revealed) return undefined
        const timer = setTimeout(() => setRevealed(null), 20_000)
        return () => clearTimeout(timer)
      }, [revealed])

      // Esc 关闭弹窗（编辑 / 删除确认）。
      React.useEffect(() => {
        if (!editor && !pendingDelete) return undefined
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          if (editor && !editor.busy) setEditor(null)
          else if (pendingDelete) setPendingDelete(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [editor, pendingDelete])

      // ---- 口令门 ----
      const doSetup = () => {
        if (busy) return
        if (pass.length < 8) { setAuthError('口令至少 8 个字符'); return }
        if (pass !== pass2) { setAuthError('两次输入不一致'); return }
        setBusy(true)
        setAuthError(null)
        post('/setup', { passphrase: pass })
          .then((body) => {
            setPass(''); setPass2('')
            if (body && body.passphraseFile) setNotice({ kind: 'ok', text: `主口令已存到本机：${body.passphraseFile}（0600）` })
            bootstrap()
          })
          .catch((err) => setAuthError(String((err && err.message) || err)))
          .finally(() => setBusy(false))
      }

      const doUnlockWithKeyFile = () => {
        if (busy) return
        setBusy(true)
        setAuthError(null)
        post('/unlock', { useKeyFile: true })
          .then(() => { setPass(''); bootstrap() })
          .catch((err) => setAuthError(String((err && err.message) || err)))
          .finally(() => setBusy(false))
      }

      const doUnlock = () => {
        if (busy) return
        setBusy(true)
        setAuthError(null)
        post('/unlock', { passphrase: pass })
          .then(() => getJson('/status'))
          .then((body) => {
            if (body) setStatus(body)
            setPass('')
            return null
          })
          .catch(() => null)
          .finally(() => { bootstrap() })
          .catch((err) => setAuthError(String((err && err.message) || err)))
          .finally(() => setBusy(false))
      }

      const doSaveKeyFile = () => {
        post('/keyfile/save', {})
          .then((body) => {
            setCredCheck({ keyFileValid: true, passphraseFileValid: status ? !!status.passphraseFile : false })
            setStatus((prev) => ({ ...(prev || {}), keyFile: body.keyFile }))
            setNotice({ kind: 'ok', text: `解锁密钥已存到本机：${body.keyFile}（0600，仅本用户可读）` })
          })
          .catch((err) => setNotice({ kind: 'err', text: String((err && err.message) || err) }))
      }

      const doLock = () => {
        post('/lock', {})
          .then(() => { setVault(null); setRevealed(null); setPhase('locked'); setPass(''); setTab('secrets') })
          .catch((err) => setNotice({ kind: 'err', text: String((err && err.message) || err) }))
      }

      // ---- 授权：以工作区为主，一个工作区可以勾选多个分组 ----
      const SEEN_KEY = 'dsh-bws:seen-ws:v1'
      const readSeen = () => {
        try {
          const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(SEEN_KEY)
          const list = raw ? JSON.parse(raw) : []
          return new Set(Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [])
        } catch { return new Set() }
      }
      const writeSeen = (ids) => {
        try { if (typeof window !== 'undefined') window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids])) } catch {}
      }

      const buildDraft = (body) => {
        const groups = (body.groups || []).map((group) => ({ id: group.id, title: group.title, tier: group.tier === 'shared' ? 'shared' : 'project' }))
        const levels = {}
        for (const workspace of body.workspaces || []) {
          levels[workspace.id] = {}
          for (const group of groups) {
            if (group.tier !== 'project') continue
            const grant = (body.grants || []).find((item) => item.workspace === workspace.id && item.group === group.id)
            levels[workspace.id][group.id] = grant ? grant.level : 'none'
          }
        }
        const seen = readSeen()
        const allIds = (body.workspaces || []).map((w) => w.id)
        // 第一次使用这个浏览器时没有基线：不把全部工作区都标成「新」，只建立基线。
        const firstRun = seen.size === 0
        const freshIds = firstRun ? [] : allIds.filter((id) => !seen.has(id))
        // 打开面板即视为「已看过」，这样「新」只在工作区真的新增时出现。
        if (freshIds.length > 0 || firstRun) writeSeen(new Set([...seen, ...allIds]))
        return { groups, levels, freshIds }
      }

      const loadAccess = React.useCallback(() => {
        setAccess((prev) => ({ ...prev, status: prev.data ? prev.status : 'loading', error: null }))
        getJson('/groups')
          .then((body) => setAccess({ status: 'ready', data: body, error: null, busy: false, draft: buildDraft(body), notice: null, newGroup: '' }))
          .catch((err) => setAccess((prev) => ({ ...prev, status: 'error', busy: false, error: String((err && err.message) || err) })))
      }, [])

      React.useEffect(() => {
        if (tab === 'access' && access.status === 'idle' && phase === 'ready') loadAccess()
      }, [tab, access.status, phase, loadAccess])

      const setGroupTier = (gid, tier) => setAccess((prev) => {
        const levels = {}
        for (const [wsId, map] of Object.entries(prev.draft.levels)) {
          levels[wsId] = { ...map }
          if (tier === 'shared') delete levels[wsId][gid]
        }
        return {
          ...prev, notice: null,
          draft: { ...prev.draft, levels, groups: prev.draft.groups.map((group) => (group.id === gid ? { ...group, tier } : group)) },
        }
      })

      const setLevel = (workspaceId, groupId, level) => setAccess((prev) => ({
        ...prev, notice: null,
        draft: { ...prev.draft, levels: { ...prev.draft.levels, [workspaceId]: { ...(prev.draft.levels[workspaceId] || {}), [groupId]: level } } },
      }))

      const cycleLevel = (workspaceId, groupId) => setAccess((prev) => {
        const current = (prev.draft.levels[workspaceId] || {})[groupId] || 'none'
        const next = current === 'none' ? 'read' : current === 'read' ? 'write' : 'none'
        return { ...prev, notice: null, draft: { ...prev.draft, levels: { ...prev.draft.levels, [workspaceId]: { ...(prev.draft.levels[workspaceId] || {}), [groupId]: next } } } }
      })

      const setAllFor = (workspaceId, level) => setAccess((prev) => {
        const map = {}
        for (const group of prev.draft.groups) if (group.tier === 'project') map[group.id] = level
        return { ...prev, notice: null, draft: { ...prev.draft, levels: { ...prev.draft.levels, [workspaceId]: map } } }
      })

      const addGroup = () => {
        const title = (access.newGroup || '').trim()
        if (title.length === 0) return
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('g' + Date.now().toString(36))
        if (access.draft.groups.some((group) => group.id === id)) {
          setAccess((prev) => ({ ...prev, notice: { kind: 'err', text: '分组已存在：' + id } }))
          return
        }
        setAccess((prev) => ({ ...prev, newGroup: '', notice: null, draft: { ...prev.draft, groups: [...prev.draft.groups, { id, title, tier: 'project' }] } }))
      }

      const saveAccess = () => {
        if (!access.data || !access.draft || access.busy) return
        const grants = []
        for (const workspace of access.data.workspaces || []) {
          for (const group of access.draft.groups) {
            if (group.tier !== 'project') continue
            const level = (access.draft.levels[workspace.id] || {})[group.id]
            if (level === 'read' || level === 'write') grants.push({ workspace: workspace.id, group: group.id, level })
          }
        }
        setAccess((prev) => ({ ...prev, busy: true, notice: null }))
        post('/groups/save', { groups: access.draft.groups, grants })
          .then(() => {
            const seen = readSeen()
            for (const workspace of access.data.workspaces || []) seen.add(workspace.id)
            writeSeen(seen)
            setAccess((prev) => ({
              ...prev, busy: false, draft: { ...prev.draft, freshIds: [] },
              notice: { kind: 'ok', text: '已保存：' + access.draft.groups.length + ' 个分组、' + grants.length + ' 条授权' },
            }))
            loadVault()
          })
          .catch((err) => setAccess((prev) => ({ ...prev, busy: false, notice: { kind: 'err', text: String((err && err.message) || err) } })))
      }

      // ---- 取值 / 增删改 ----
      const revealSecret = (secret) => {
        if (revealed && revealed.key === secret.key) { setRevealed(null); return }
        setNotice(null)
        post('/secret/' + encodeURIComponent(secret.key) + '/reveal', {})
          .then((body) => setRevealed({ key: body.key, value: body.value, length: body.length }))
          .catch((err) => setNotice({ kind: 'err', text: String((err && err.message) || err) }))
      }

      const copyValue = () => {
        if (!revealed) return
        const done = () => setNotice({ kind: 'ok', text: '已复制 ' + revealed.key + '（剪贴板，用完记得清）' })
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(revealed.value).then(done).catch(() => setNotice({ kind: 'err', text: '复制失败，请手动选中' }))
        } else {
          setNotice({ kind: 'err', text: '此环境不支持剪贴板，请手动选中' })
        }
      }

      const openEditor = (secret) => {
        setNotice(null)
        setEditor(secret
          ? {
              mode: 'edit', key: secret.key, originalKey: secret.key,
              value: '', note: secret.note || '', originalNote: secret.note || '',
              group: secret.group || 'common', originalGroup: secret.group || 'common',
              busy: false, error: null,
            }
          : {
              mode: 'create', key: '', originalKey: '', value: '', note: '', originalNote: '',
              group: groups[0] ? groups[0].id : 'common', originalGroup: '', busy: false, error: null,
            })
      }

      const saveEditor = () => {
        const draft = editor
        if (!draft || draft.busy) return
        const key = draft.key.trim()
        if (key.length === 0) { setEditor({ ...draft, error: '键名不能为空' }); return }
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) { setEditor({ ...draft, error: '键名只能是大写字母、数字、下划线，且以字母开头' }); return }
        if (draft.mode === 'create' && draft.value.length === 0) { setEditor({ ...draft, error: '新建必须给一个值' }); return }
        const request = draft.mode === 'create'
          ? post('/secrets', { key, value: draft.value, group: draft.group, note: draft.note })
          : post('/secret/' + encodeURIComponent(draft.originalKey), {
              ...(draft.value !== '' ? { value: draft.value } : {}),
              ...(draft.note !== draft.originalNote ? { note: draft.note } : {}),
              ...(draft.group !== draft.originalGroup ? { group: draft.group } : {}),
              ...(key !== draft.originalKey ? { newKey: key } : {}),
            })
        setEditor({ ...draft, busy: true, error: null })
        request
          .then(() => {
            setEditor(null)
            setRevealed(null)
            setNotice({ kind: 'ok', text: (draft.mode === 'create' ? '已新建 ' : '已更新 ') + key })
            loadVault()
          })
          .catch((err) => setEditor((prev) => (prev ? { ...prev, busy: false, error: String((err && err.message) || err) } : prev)))
      }

      const confirmDelete = () => {
        const target = pendingDelete
        if (!target) return
        setPendingDelete(null)
        post('/secret/' + encodeURIComponent(target.key) + '/delete', {})
          .then(() => {
            setRevealed(null)
            setNotice({ kind: 'ok', text: '已删除 ' + target.key })
            loadVault()
          })
          .catch((err) => setNotice({ kind: 'err', text: String((err && err.message) || err) }))
      }

      const startRun = () => {
        const command = run.command.trim()
        if (command.length === 0 || run.busy) return
        setRun((prev) => ({ ...prev, busy: true, result: null, error: null }))
        const body = { command, shell: true }
        if (run.group !== 'all') body.group = run.group
        post('/run', body)
          .then((payload) => setRun((prev) => ({ ...prev, busy: false, result: payload })))
          .catch((err) => setRun((prev) => ({ ...prev, busy: false, error: String((err && err.message) || err) })))
      }

      // ---- 同步 ----
      const saveRemotes = () => {
        if (sync.saving) return
        const remotes = []
        if (sync.gh.trim()) remotes.push({ name: 'origin', url: sync.gh.trim() })
        if (sync.gitee.trim()) remotes.push({ name: 'gitee', url: sync.gitee.trim() })
        setSync((prev) => ({ ...prev, saving: true, error: null }))
        post('/remotes/save', { remotes })
          .then(() => { setSync((prev) => ({ ...prev, saving: false, result: { kind: 'remotes', count: remotes.length } })); bootstrap() })
          .catch((err) => setSync((prev) => ({ ...prev, saving: false, error: String((err && err.message) || err) })))
      }

      const doSync = (direction) => {
        if (sync.busy) return
        setSync((prev) => ({ ...prev, busy: true, error: null, result: null }))
        post('/sync', { direction })
          .then((payload) => {
            setSync((prev) => ({ ...prev, busy: false, result: { kind: direction, ...payload } }))
            if (payload.relock) {
              // 首次拉取换了 KDF 的盐：内存里那把密钥失效，必须用同一口令重新解锁。
              setVault(null)
              setRevealed(null)
              setPass('')
              setAuthError('已采用远端金库的盐，请用同一口令重新解锁')
              setPhase('locked')
              return
            }
            if (direction === 'pull') loadVault()
            else bootstrap()
          })
          .catch((err) => setSync((prev) => ({ ...prev, busy: false, error: String((err && err.message) || err) })))
      }

      const saveAutoLock = (minutes) => {
        setSync((prev) => ({ ...prev, saving: true, error: null }))
        post('/config/save', { autoLockMinutes: minutes })
          .then(() => { setSync((prev) => ({ ...prev, saving: false })); bootstrap() })
          .catch((err) => setSync((prev) => ({ ...prev, saving: false, error: String((err && err.message) || err) })))
      }

      const doImport = () => {
        if (sync.busy) return
        setSync((prev) => ({ ...prev, busy: true, error: null, result: null }))
        post('/import-bws', { group: sync.importGroup || (groups[0] && groups[0].id) || '' })
          .then((payload) => { setSync((prev) => ({ ...prev, busy: false, result: { kind: 'import', ...payload } })); loadVault() })
          .catch((err) => setSync((prev) => ({ ...prev, busy: false, error: String((err && err.message) || err) })))
      }

      // ---- 派生数据 ----
      const secrets = (vault && vault.secrets) || []
      const groups = React.useMemo(() => (vault && Array.isArray(vault.groups) ? vault.groups : []), [vault])
      const groupTitle = React.useCallback((id) => {
        const hit = groups.find((group) => group.id === id)
        return hit ? hit.title : (id || '未分组')
      }, [groups])
      const groupCounts = React.useMemo(() => {
        const counts = {}
        for (const secret of secrets) counts[secret.group] = (counts[secret.group] || 0) + 1
        return counts
      }, [secrets])

      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        return secrets.filter((secret) => {
          if (groupId !== 'all' && secret.group !== groupId) return false
          if (!needle) return true
          return (secret.key + ' ' + (secret.note || '') + ' ' + groupTitle(secret.group)).toLowerCase().includes(needle)
        })
      }, [secrets, query, groupId, groupTitle])

      const selected = React.useMemo(
        () => filtered.find((secret) => secret.key === selectedKey) || filtered[0] || null,
        [filtered, selectedKey],
      )

      const choose = (key) => {
        setSelectedKey(key)
        if (detailRef.current && typeof window !== 'undefined' && window.matchMedia
          && detailRef.current.getBoundingClientRect().top > window.innerHeight - 120) {
          detailRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }

      // ---- 口令门渲染 ----
      if (phase === 'loading') {
        return h('div', { className: 'bwsx-root' },
          h('div', { className: 'bwsx-head' }, h('div', null,
            h('h3', { className: 'bwsx-title' }, '凭证金库'),
            h('div', { className: 'bwsx-sub' }, '本地加密 · git 同步'),
          )),
          h('div', { className: 'bwsx-list' },
            Array.from({ length: 4 }, (_, index) => h('div', { key: index, className: 'bwsx-sk', style: { margin: '2px 0' } })),
          ),
        )
      }

      if (phase === 'setup' || phase === 'locked' || phase === 'error') {
        const isSetup = phase === 'setup'
        const card = phase === 'error'
          ? h('div', { className: 'bwsx-banner' },
              h('b', null, '读取失败'),
              h('span', null, error || '未知错误'),
              h('div', { style: { marginTop: '6px' } },
                h('button', { type: 'button', className: 'bwsx-btn', onClick: bootstrap }, '重试')),
            )
          : h('div', { className: 'bwsx-card', style: { width: 'min(430px, 100%)', boxShadow: 'none' } },
              h('h4', null, isSetup ? '设置主口令' : '解锁金库'),
              h('div', { className: 'bwsx-hint' },
                isSetup
                  ? '口令只用于派生加密密钥，不会保存到任何地方。忘记口令 = 无法恢复金库。'
                  : '输入主口令解锁。解锁状态只在本次 dsh-web 进程内有效，重启后需要再次解锁。'),
              h('label', { className: 'bwsx-field' },
                h('span', null, '主口令'),
                h('input', {
                  type: 'password', value: pass, autoFocus: true,
                  autoComplete: isSetup ? 'new-password' : 'current-password',
                  onChange: (event) => { setPass(event.target.value); setAuthError(null) },
                  onKeyDown: (event) => { if (event.key === 'Enter') (isSetup ? doSetup() : doUnlock()) },
                }),
              ),
              isSetup
                ? h('label', { className: 'bwsx-field' },
                    h('span', null, '再输一次'),
                    h('input', {
                      type: 'password', value: pass2, autoComplete: 'new-password',
                      onChange: (event) => { setPass2(event.target.value); setAuthError(null) },
                      onKeyDown: (event) => { if (event.key === 'Enter') doSetup() },
                    }),
                  )
                : null,
              authError ? h('div', { className: 'bwsx-notice', 'data-kind': 'err' }, authError) : null,
              h('div', { className: 'bwsx-card-foot' },
                h('button', {
                  type: 'button', className: 'bwsx-btn', 'data-tone': 'primary',
                  disabled: busy, onClick: isSetup ? doSetup : doUnlock,
                }, busy ? '处理中…' : (isSetup ? '创建金库' : '解锁')),
                !isSetup && status && status.keyFile
                  ? h('button', { type: 'button', className: 'bwsx-btn', disabled: busy, onClick: doUnlockWithKeyFile }, '用本机钥匙解锁')
                  : null,
              ),
            )
        return h('div', { className: 'bwsx-root' },
          h('div', { className: 'bwsx-head' }, h('div', null,
            h('h3', { className: 'bwsx-title' }, '凭证金库'),
            h('div', { className: 'bwsx-sub' },
              isSetup ? '首次使用：先设一个主口令' : '已锁定：解锁后才能取值与写入'),
          )),
          card,
          h('div', { className: 'bwsx-foot' },
            '数据保存在本机 SQLite，密文随 git 同步；口令与明文都不落盘。'),
        )
      }

      // ---- 主体 ----
      const meta = []
      meta.push(secrets.length + ' 条 / ' + groups.length + ' 组')
      if (status && status.remotes && status.remotes.length > 0) meta.push('远端 ' + status.remotes.length)
      if (status && status.lastSync && status.lastSync.at) meta.push('上次同步 ' + new Date(status.lastSync.at).toLocaleString('zh-CN', { hour12: false }))
      if (vault && vault.stale === true) meta.push('离线缓存')

      const head = h('div', { className: 'bwsx-head' },
        h('div', null,
          h('h3', { className: 'bwsx-title' }, '凭证金库'),
          h('div', { className: 'bwsx-sub' },
            meta.flatMap((item, index) => (index === 0 ? [item] : [h('span', { key: 'dot' + index }, '·'), item])),
          ),
        ),
        h('div', { style: { display: 'flex', gap: '6px', flex: 'none' } },
          h('button', {
            type: 'button', className: 'bwsx-btn', 'data-tone': 'primary',
            disabled: groups.length === 0,
            onClick: () => openEditor(null),
            title: groups.length === 0 ? '先在「授权」页新建一个分组' : '新建一条凭证',
          }, '新建'),
          h('button', { type: 'button', className: 'bwsx-btn', disabled: busy, onClick: loadVault }, busy ? '读取中…' : '刷新'),
          h('button', { type: 'button', className: 'bwsx-btn', onClick: doLock, title: '清空内存中的密钥' }, '锁定'),
        ),
      )

      const warn = vault && vault.stale === true
        ? h('div', { className: 'bwsx-warn' },
            h('b', null, '离线缓存'),
            h('span', null, 'Host 暂时不可达' + (vault.staleReason ? '（' + vault.staleReason + '）' : '') + '，以下是本地缓存索引。'),
            h('button', { type: 'button', className: 'bwsx-btn', onClick: loadVault }, '重试'),
          )
        : null

      const search = h('input', {
        className: 'bwsx-search', type: 'search', value: query,
        placeholder: '按键名 / 备注 / 分组过滤…',
        onChange: (event) => setQuery(event.target.value),
        'aria-label': '过滤凭证',
      })

      const chips = h('div', { className: 'bwsx-chips' },
        h('button', {
          type: 'button', className: 'bwsx-chip', 'data-on': groupId === 'all' ? '1' : '0',
          onClick: () => setGroupId('all'),
        }, '全部 ' + secrets.length),
        groups.map((group) =>
          h('button', {
            key: group.id, type: 'button', className: 'bwsx-chip',
            'data-on': groupId === group.id ? '1' : '0',
            onClick: () => setGroupId(group.id),
            title: group.tier === 'shared' ? '通用层（全员可读写）' : '项目层（仅授权工作区）',
          }, group.title + ' ' + (groupCounts[group.id] || 0)),
        ),
      )

      const list = h('div', { className: 'bwsx-list' },
        filtered.length === 0
          ? h('div', { className: 'bwsx-empty' }, secrets.length === 0 ? (groups.length === 0 ? '还没有分组：先到「授权」页新建一个分组（比如 common），再回这里新建凭证或从 bws 迁移' : '还没有凭证：点右上角「新建」，或在「同步」页从 bws 迁移') : '没有匹配的凭证')
          : filtered.map((secret) =>
              h('button', {
                key: secret.key, type: 'button', className: 'bwsx-row',
                'data-sel': selected && selected.key === secret.key ? '1' : '0',
                onClick: () => choose(secret.key),
                title: secret.key,
              },
                h('span', { className: 'bwsx-key' }, secret.key),
                h('span', { className: 'bwsx-note' },
                  (secret.group ? groupTitle(secret.group) + ' · ' : '')
                    + (secret.note ? secret.note.split('\n')[0].trim().slice(0, 80) : '')),
              ),
            ),
      )

      const detail = h('div', { className: 'bwsx-detail', ref: detailRef },
        selected
          ? [
              h('h4', { key: 'k' }, selected.key),
              h('div', { key: 'act', className: 'bwsx-actions' },
                h('button', {
                  type: 'button', className: 'bwsx-btn', 'data-tone': revealed && revealed.key === selected.key ? 'danger' : 'primary',
                  onClick: () => revealSecret(selected),
                }, revealed && revealed.key === selected.key ? '隐藏值' : '显示值'),
                revealed && revealed.key === selected.key
                  ? h('button', { type: 'button', className: 'bwsx-btn', onClick: copyValue }, '复制')
                  : null,
                h('button', { type: 'button', className: 'bwsx-btn', onClick: () => openEditor(selected) }, '编辑'),
                h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'danger', onClick: () => setPendingDelete(selected) }, '删除'),
              ),
              revealed && revealed.key === selected.key
                ? h('div', { key: 'val', className: 'bwsx-value' }, revealed.value || '(空值)')
                : null,
              h('dl', { key: 'kv', style: { margin: 0 } },
                h('div', { className: 'bwsx-kv' }, h('dt', null, '分组'), h('dd', null, groupTitle(selected.group))),
                h('div', { className: 'bwsx-kv' }, h('dt', null, '值'),
                  h('dd', null,
                    h('span', { className: 'bwsx-secret' }, '••••••••'),
                    h('span', { style: { color: 'var(--dsw-text-secondary, #9aa3b2)' } }, ' · 密文 ' + (selected.valueLength || 0) + ' 字节'),
                  )),
                h('div', { className: 'bwsx-kv' }, h('dt', null, '更新'),
                  h('dd', null, selected.updatedAt ? new Date(selected.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '—')),
                h('div', { className: 'bwsx-kv' }, h('dt', null, '备注'),
                  h('dd', { style: { whiteSpace: 'pre-wrap' } }, (selected.note || '').slice(0, 600) || '—')),
                h('div', { className: 'bwsx-kv' }, h('dt', null, '版本'),
                  h('dd', null, 'rev ' + selected.revision)),
              ),
            ]
          : [h('div', { className: 'bwsx-empty', key: 'none' }, '选择左侧条目查看详情')],
      )

      const renderEditor = (draft) => h('div', {
        className: 'bwsx-modal',
        onMouseDown: (event) => { if (event.target === event.currentTarget && !draft.busy) setEditor(null) },
      },
        h('div', { className: 'bwsx-card' },
          h('h4', null, draft.mode === 'create' ? '新建凭证' : '编辑 ' + draft.originalKey),
          h('label', { className: 'bwsx-field' },
            h('span', null, '键名（大写 + 下划线；项目级密钥带项目前缀）'),
            h('input', { value: draft.key, autoFocus: true, onChange: (event) => setEditor({ ...draft, key: event.target.value.toUpperCase() }) }),
          ),
          h('label', { className: 'bwsx-field' },
            h('span', null, '分组（决定谁能读/写；通用层全员可读写）'),
            h('select', { value: draft.group, onChange: (event) => setEditor({ ...draft, group: event.target.value }) },
              groups.map((group) => h('option', { key: group.id, value: group.id },
                group.title + (group.tier === 'shared' ? '（通用层）' : '（项目层）')))),
          ),
          h('label', { className: 'bwsx-field' },
            h('span', null, draft.mode === 'create' ? '值' : '新值（留空表示不改）'),
            h('textarea', {
              value: draft.value,
              placeholder: draft.mode === 'edit' ? '留空 = 保持原值' : '',
              onChange: (event) => setEditor({ ...draft, value: event.target.value }),
            }),
          ),
          h('label', { className: 'bwsx-field' },
            h('span', null, '备注（建议首行：type=env|pem|json… consumer=谁在用）'),
            h('textarea', { value: draft.note, onChange: (event) => setEditor({ ...draft, note: event.target.value }) }),
          ),
          draft.error ? h('div', { className: 'bwsx-notice', 'data-kind': 'err' }, draft.error) : null,
          h('div', { className: 'bwsx-hint' },
            '值只在浏览器 → Host 的这一跳里出现，落盘前就加密；不会进入命令行参数，也不会写日志。'),
          h('div', { className: 'bwsx-card-foot' },
            h('button', { type: 'button', className: 'bwsx-btn', disabled: draft.busy, onClick: () => setEditor(null) }, '取消'),
            h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'primary', disabled: draft.busy, onClick: saveEditor },
              draft.busy ? '保存中…' : '保存'),
          ),
        ),
      )

      const renderDelete = (secret) => h('div', { className: 'bwsx-modal' },
        h('div', { className: 'bwsx-card' },
          h('h4', null, '删除 ' + secret.key + '？'),
          h('div', { className: 'bwsx-hint' },
            '本地会标记删除并同步到远端（历史提交里仍留有旧密文，真正作废需要轮换该密钥）。'),
          h('div', { className: 'bwsx-card-foot' },
            h('button', { type: 'button', className: 'bwsx-btn', onClick: () => setPendingDelete(null) }, '取消'),
            h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'danger', onClick: confirmDelete }, '删除'),
          ),
        ),
      )

      const tabs = h('div', { className: 'bwsx-tabs' },
        h('button', { type: 'button', className: 'bwsx-tab', 'data-on': tab === 'secrets' ? '1' : '0', onClick: () => setTab('secrets') }, '凭证 ' + secrets.length),
        h('button', { type: 'button', className: 'bwsx-tab', 'data-on': tab === 'access' ? '1' : '0', onClick: () => setTab('access') }, '授权'),
        h('button', { type: 'button', className: 'bwsx-tab', 'data-on': tab === 'sync' ? '1' : '0', onClick: () => setTab('sync') }, '同步'),
      )

      const accessView = (() => {
        if (access.status === 'error') {
          return h('div', { className: 'bwsx-banner' },
            h('b', null, '读取分组失败'), h('span', null, access.error),
            h('div', { style: { marginTop: '6px' } }, h('button', { type: 'button', className: 'bwsx-btn', onClick: loadAccess }, '重试')))
        }
        if (access.status !== 'ready' || !access.data || !access.draft) {
          return h('div', { className: 'bwsx-hint' }, '读取分组配置…')
        }
        const data = access.data
        const draft = access.draft
        const counts = data.counts || {}
        const workspaces = data.workspaces || []
        const freshIds = new Set(draft.freshIds || [])
        const projectGroups = draft.groups.filter((group) => group.tier === 'project')
        const sharedGroups = draft.groups.filter((group) => group.tier === 'shared')

        const wsCards = workspaces.map((workspace) => {
          const levels = draft.levels[workspace.id] || {}
          const granted = projectGroups.filter((group) => (levels[group.id] || 'none') !== 'none').length
          const label = workspace.title || String(workspace.path || '').split('/').filter(Boolean).slice(-1)[0] || workspace.id
          return h('div', { key: workspace.id, className: 'bwsx-wcard', 'data-new': freshIds.has(workspace.id) ? '1' : '0' },
            h('div', { className: 'bwsx-wh' },
              h('b', null, label),
              freshIds.has(workspace.id) ? h('span', { className: 'bwsx-tag' }, '新') : null,
              granted === 0 ? h('span', { className: 'bwsx-tag', 'data-tone': 'warn' }, '未授权') : h('span', { className: 'bwsx-hint' }, granted + ' / ' + projectGroups.length),
              h('span', { className: 'bwsx-wpath', title: workspace.path }, workspace.path),
            ),
            projectGroups.length === 0
              ? h('div', { className: 'bwsx-hint' }, '还没有项目层分组；先在下面新建分组，再回来授权。')
              : h('div', { className: 'bwsx-chips' },
                  projectGroups.map((group) => {
                    const level = levels[group.id] || 'none'
                    return h('button', {
                      key: group.id, type: 'button', className: 'bwsx-chip', 'data-lv': level,
                      title: '点击切换：无权限 → 可读 → 可读写',
                      onClick: () => cycleLevel(workspace.id, group.id),
                    }, h('span', null, group.title), h('em', null, level === 'write' ? '读写' : level === 'read' ? '只读' : '无'))
                  }),
                  h('button', { type: 'button', className: 'bwsx-chip', 'data-lv': 'all', onClick: () => setAllFor(workspace.id, 'write') }, '全部可读写'),
                  h('button', { type: 'button', className: 'bwsx-chip', 'data-lv': 'all', onClick: () => setAllFor(workspace.id, 'none') }, '清空'),
                ),
          )
        })

        const groupRows = draft.groups.map((group) => h('div', { key: group.id, className: 'bwsx-arow' },
          h('div', { className: 'bwsx-ah' },
            h('b', null, group.title),
            h('code', { className: 'bwsx-gid' }, group.id),
            h('span', { className: 'bwsx-hint' }, (counts[group.id] || 0) + ' 条'),
            h('select', { value: group.tier, onChange: (event) => setGroupTier(group.id, event.target.value) },
              h('option', { value: 'shared' }, '通用层 · 全员可读写'),
              h('option', { value: 'project' }, '项目层 · 按工作区授权'),
            ),
          ),
        ))

        return h('div', { className: 'bwsx-access' },
          h('div', { className: 'bwsx-hint' },
            '以工作区为主：点分组标签切换「无 / 只读 / 读写」，一个工作区可选多个分组。' +
            '通用层全员可读写、不需要单独授权；共 ' + data.total + ' 条 / ' + draft.groups.length + ' 个分组 / ' + workspaces.length + ' 个工作区。'),
          workspaces.length === 0
            ? h('div', { className: 'bwsx-hint' }, '还没有工作区；在 DSH 里打开一个目录为工作区后会出现在这里。')
            : wsCards,
          h('div', { className: 'bwsx-ah', style: { marginTop: '6px' } }, h('b', null, '分组')),
          groupRows,
          h('div', { className: 'bwsx-ah', style: { marginTop: '2px' } },
            h('input', {
              className: 'bwsx-search', style: { flex: '1 1 160px', margin: 0 },
              value: access.newGroup || '', placeholder: '新增分组名，例如 orders',
              onChange: (event) => setAccess((prev) => ({ ...prev, newGroup: event.target.value })),
              onKeyDown: (event) => { if (event.key === 'Enter') addGroup() },
            }),
            h('button', { type: 'button', className: 'bwsx-btn', onClick: addGroup }, '新增分组'),
          ),
          sharedGroups.length > 0
            ? h('div', { className: 'bwsx-hint' }, '通用层：' + sharedGroups.map((group) => group.title).join('、') + '（所有工作区可读写）')
            : null,
          access.notice ? h('div', { className: 'bwsx-notice', 'data-kind': access.notice.kind }, access.notice.text) : null,
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'primary', disabled: access.busy, onClick: saveAccess },
              access.busy ? '保存中…' : '保存授权'),
            h('button', { type: 'button', className: 'bwsx-btn', disabled: access.busy, onClick: loadAccess }, '重新读取'),
          ),
        )
      })()

      const doChangePassphrase = () => {
        if (passwd.busy) return
        if (passwd.next.length < 8) { setPasswd((p) => ({ ...p, msg: { kind: 'err', text: '新口令至少 8 个字符' } })); return }
        if (passwd.next !== passwd.again) { setPasswd((p) => ({ ...p, msg: { kind: 'err', text: '两次输入不一致' } })); return }
        setPasswd((p) => ({ ...p, busy: true, msg: null }))
        post('/passwd', { current: passwd.current, next: passwd.next })
          .then((body) => {
            setPasswd({ current: '', next: '', again: '', busy: false, msg: { kind: 'ok', text: `已换钥：${body.rotated} 条密文重新加密；本机口令文件已更新。记得推送。` } })
            setPass('')
            setPass2('')
          })
          .catch((err) => setPasswd((p) => ({ ...p, busy: false, msg: { kind: 'err', text: String((err && err.message) || err) } })))
      }

      const syncResult = sync.result
      const syncView = h('div', { className: 'bwsx-access' },
        h('div', { className: 'bwsx-hint' },
          '金库内容（只有密文与元数据）在一个 git 仓库里，可同时推到 GitHub 与 Gitee。' +
          '推送需要本机的 git 凭证（SSH key 或 credential helper），插件本身不保存 git token。'),
        h('label', { className: 'bwsx-field' },
          h('span', null, 'GitHub 仓库 URL'),
          h('input', { value: sync.gh, placeholder: 'git@github.com:you/dsh-vault.git', onChange: (event) => setSync((prev) => ({ ...prev, gh: event.target.value })) }),
        ),
        h('label', { className: 'bwsx-field' },
          h('span', null, 'Gitee 仓库 URL'),
          h('input', { value: sync.gitee, placeholder: 'git@gitee.com:you/dsh-vault.git', onChange: (event) => setSync((prev) => ({ ...prev, gitee: event.target.value })) }),
        ),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { type: 'button', className: 'bwsx-btn', disabled: sync.saving, onClick: saveRemotes }, sync.saving ? '保存中…' : '保存远端'),
          h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'primary', disabled: sync.busy, onClick: () => doSync('push') }, sync.busy ? '…' : '推送'),
          h('button', { type: 'button', className: 'bwsx-btn', disabled: sync.busy, onClick: () => doSync('pull') }, '拉取'),
          h('button', {
            type: 'button',
            className: 'bwsx-btn',
            disabled: sync.busy || groups.length === 0,
            title: groups.length === 0 ? '先在「授权」页新建至少一个分组' : '',
            onClick: doImport,
          }, '从 bws 迁移'),
        ),
        groups.length === 0
          ? h('div', { className: 'bwsx-hint' }, '迁移前要先有分组：去「授权」页新建，比如 common / citywalk。')
          : h('label', { className: 'bwsx-field' },
              h('span', null, '迁移时未识别的键归入'),
              h('select', {
                value: sync.importGroup || groups[0].id,
                onChange: (event) => setSync((prev) => ({ ...prev, importGroup: event.target.value })),
              }, groups.map((group) => h('option', { key: group.id, value: group.id }, group.title + ' (' + group.id + ')'))),
            ),
        sync.error ? h('div', { className: 'bwsx-notice', 'data-kind': 'err' }, sync.error) : null,
        syncResult
          ? h('div', { className: 'bwsx-notice', 'data-kind': syncResult.success === false ? 'err' : 'ok' },
              syncResult.kind === 'import'
                ? '迁移完成：bws ' + syncResult.total + ' 条，新建 ' + syncResult.created + '，更新 ' + syncResult.updated + '，跳过 ' + syncResult.skipped
                : syncResult.kind === 'remotes'
                  ? '已保存 ' + syncResult.count + ' 个远端'
                  : (syncResult.direction === 'push' ? '推送：' : '拉取：')
                    + ((syncResult.push && syncResult.push.results) || (syncResult.pull && syncResult.pull.results) || [])
                      .map((r) => r.remote + (r.ok ? ' ✓' : ' ✗' + (r.conflict ? '(冲突)' : '')))
                      .join(' · '),
            )
          : null,
        h('label', { className: 'bwsx-field' },
          h('span', null, '空闲自动锁定'),
          h('select', {
            value: String((status && status.autoLockMinutes != null) ? status.autoLockMinutes : 15),
            onChange: (event) => saveAutoLock(Number(event.target.value)),
          }, [0, 5, 15, 30, 60, 120].map((m) => h('option', { key: m, value: String(m) }, m === 0 ? '关闭' : m + ' 分钟'))),
        ),
        status && status.lastSync && status.lastSync.at
          ? h('div', { className: 'bwsx-hint' }, '上次同步：' + new Date(status.lastSync.at).toLocaleString('zh-CN', { hour12: false }))
          : h('div', { className: 'bwsx-hint' }, '还没有同步过。'),
        h('div', { className: 'bwsx-hint' },
          '冲突处理：同一台机器 last-write-wins（按 revision）；两台机器改同一条时拉取会报冲突并保留本地版本，需要人工择一。'),
        h('div', { className: 'bwsx-ah', style: { marginTop: '10px' } }, h('b', null, '主口令')),
        h('div', { className: 'bwsx-hint' },
          '改口令会重新封装全部密文（约每千条约一秒），写完立即生效；其它机器拉取后用新口令解锁，旧口令失效。'),
        h('label', { className: 'bwsx-field' },
          h('span', null, '当前口令'),
          h('input', { type: 'password', value: passwd.current, onChange: (event) => setPasswd((p) => ({ ...p, current: event.target.value })) }),
        ),
        h('label', { className: 'bwsx-field' },
          h('span', null, '新口令（≥ 8 字符）'),
          h('input', { type: 'password', value: passwd.next, onChange: (event) => setPasswd((p) => ({ ...p, next: event.target.value })) }),
        ),
        h('label', { className: 'bwsx-field' },
          h('span', null, '再输一次'),
          h('input', { type: 'password', value: passwd.again, onChange: (event) => setPasswd((p) => ({ ...p, again: event.target.value })) }),
        ),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'primary', disabled: passwd.busy, onClick: doChangePassphrase },
            passwd.busy ? '换钥中…' : '修改主口令'),
        ),
        passwd.msg ? h('div', { className: 'bwsx-notice', 'data-kind': passwd.msg.kind }, passwd.msg.text) : null,
      )

      return h('div', { className: 'bwsx-root' },
        head,
        tabs,
        tab === 'secrets'
          ? h('div', { className: 'bwsx-stack' },
              warn,
              (() => {
                if (phase !== 'ready' || hintDismissed) return null
                const hasFiles = !!(status && (status.keyFile || status.passphraseFile))
                const invalid = credCheck ? !(credCheck.keyFileValid || credCheck.passphraseFileValid) : false
                if (hasFiles && !invalid) return null
                return h('div', { className: 'bwsx-warn' },
                  h('b', null, hasFiles ? '本机保存的钥匙打不开这个金库' : '本机还没保存解锁密钥'),
                  hasFiles
                    ? '文件可能已过期（比如换过主口令）。服务与终端命令现在无法自动解锁。'
                    : '服务与终端命令（systemd / ssh 隧道）无法自动解锁。',
                  h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'primary', onClick: doSaveKeyFile }, hasFiles ? '覆盖保存（0600）' : '保存到本机（0600）'),
                  h('button', { type: 'button', className: 'bwsx-btn', onClick: () => setHintDismissed(true) }, '以后再说'))
              })(),
              search,
              chips,
              notice ? h('div', { className: 'bwsx-notice', 'data-kind': notice.kind }, notice.text) : null,
              h('div', { className: 'bwsx-body' }, list, detail),
              h('details', { className: 'bwsx-run' },
                h('summary', null, '试运行：把某个分组的凭证注入环境变量，执行一条命令（值不进日志、不落盘）'),
                h('div', { className: 'bwsx-run-body' },
                  h('div', { className: 'bwsx-field' },
                    h('span', null, '分组（注入该分组的全部凭证）'),
                    h('select', { value: run.group, onChange: (event) => setRun((prev) => ({ ...prev, group: event.target.value })) },
                      h('option', { value: 'all' }, '全部（' + secrets.length + ' 条）'),
                      groups.map((group) => h('option', { key: group.id, value: group.id }, group.title + '（' + (groupCounts[group.id] || 0) + '）')),
                    ),
                  ),
                  h('div', { className: 'bwsx-field' },
                    h('span', null, '命令（经 bash -c 执行）'),
                    h('input', {
                      value: run.command, placeholder: '例如：echo ${#GITHUB_TOKEN} 或 env | grep -c ^CITYWALK',
                      onChange: (event) => setRun((prev) => ({ ...prev, command: event.target.value })),
                      onKeyDown: (event) => { if (event.key === 'Enter') startRun() },
                    }),
                  ),
                  h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                    h('button', { type: 'button', className: 'bwsx-btn', 'data-tone': 'primary', disabled: run.busy, onClick: startRun },
                      run.busy ? '执行中…' : '执行'),
                    h('span', { className: 'bwsx-hint' }, '命令自己打印出来的值会显示在下面，别把输出贴到聊天里。'),
                  ),
                  run.error ? h('div', { className: 'bwsx-notice', 'data-kind': 'err' }, run.error) : null,
                  run.result
                    ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                        h('div', { className: 'bwsx-hint' },
                          'exit ' + String(run.result.exitCode) + ' · ' + run.result.durationMs + 'ms · 注入 ' + (run.result.injected ? run.result.injected.length : 0) + ' 个变量'
                          + (run.result.injected && run.result.injected.length > 0 ? '（' + run.result.injected.slice(0, 8).join(', ') + (run.result.injected.length > 8 ? ' …' : '') + '）' : '')),
                        run.result.stdout ? h('pre', { className: 'bwsx-out' }, run.result.stdout) : null,
                        run.result.stderr ? h('pre', { className: 'bwsx-out', 'data-err': '1' }, run.result.stderr) : null,
                        !run.result.stdout && !run.result.stderr ? h('div', { className: 'bwsx-hint' }, '（无输出）') : null,
                      )
                    : null,
                ),
              ),
            )
          : tab === 'access' ? accessView : syncView,
        h('div', { className: 'bwsx-foot' },
          '索引里没有明文：面板、SQLite、git 仓库都只有键名/分组/备注/长度与密文。取值只在一次调用内解密。'),
        editor ? renderEditor(editor) : null,
        pendingDelete ? renderDelete(pendingDelete) : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ensureStyle()
        ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register(
          { name: 'settings.plugins.tab', id: 'bws', order: 60, label: () => '凭证金库' },
          Panel,
        ))
      },
    }
  },
})
