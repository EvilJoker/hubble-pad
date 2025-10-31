import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    Icons({ compiler: 'vue3', autoInstall: true }),
    Components({
      // 仅用于解析 Icons，禁用本地组件的自动注册，避免与 shadcn 组件命名冲突
      dirs: [],
      resolvers: [IconsResolver({ prefix: 'icon', enabledCollections: ['lucide'] })],
      dts: false,
    }),
    {
      name: 'data-dev-map',
      configureServer(server) {
        const dataDir = path.resolve(__dirname, '../data')
        const logDir = path.join(dataDir, 'logs')
        const logFile = path.join(logDir, 'dev.log')
        const repoRoot = path.resolve(__dirname, '..')

        function ensureLogDir() {
          try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true }) } catch {}
        }

        function appendLog(entry: any) {
          try {
            ensureLogDir()
            const line = JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n'
            fs.appendFileSync(logFile, line, 'utf-8')
          } catch {}
        }
        server.middlewares.use('/data', (req, res, next) => {
          const url = req.url || '/'
          const rel = decodeURIComponent(url.replace(/^\/data\/?/, ''))
          const filePath = path.join(dataDir, rel)
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              fs.createReadStream(filePath).pipe(res)
              return
            }
          } catch {
            // ignore
          }
          next()
        })

        // dev only save endpoint
        server.middlewares.use('/__data/save', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (c) => chunks.push(Buffer.from(c)))
              req.on('end', () => resolve())
              req.on('error', (e) => reject(e))
            })
            const raw = Buffer.concat(chunks).toString('utf-8')
            const json = JSON.parse(raw)
            // 最小 schema 校验：必须是数组，元素需包含 id/title/description/url 字段（string）
            if (!Array.isArray(json)) {
              throw new Error('workitems must be an array')
            }
            for (const it of json) {
              if (!it || typeof it !== 'object') throw new Error('workitem must be object')
              const reqFields = ['id', 'title', 'description', 'url']
              for (const f of reqFields) {
                if (typeof (it as any)[f] !== 'string') throw new Error(`workitem.${f} must be string`)
              }
            }
            const target = path.join(dataDir, 'workitems.json')
            fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n', 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        // unified log endpoint
        server.middlewares.use('/__log', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (c) => chunks.push(Buffer.from(c)))
              req.on('end', () => resolve())
              req.on('error', (e) => reject(e))
            })
            const raw = Buffer.concat(chunks).toString('utf-8')
            const json = JSON.parse(raw)
            appendLog(json)
            const level = String(json?.level || 'info').toLowerCase()
            const msg = String(json?.message || '')
            const line = `[dev/log] ${level.toUpperCase()} ${msg}`
            if (level === 'error') console.error(line)
            else if (level === 'warn') console.warn(line)
            else if (level === 'debug') console.debug(line)
            else console.log(line)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        // --- RFC-002 hooks endpoints ---
        const hooksFile = path.join(dataDir, 'hooks.json')
        const workitemsFile = path.join(dataDir, 'workitems.json')

        server.middlewares.use('/__hooks/list', async (req, res, next) => {
          if (req.method !== 'GET') return next()
          try {
            const txt = fs.readFileSync(hooksFile, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(txt)
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        // 执行脚本：仅运行一次并返回结果与 stderr 片段
        async function execHookByIndex(index: number) {
          const arr = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'))
          const hook = arr[index]
          if (!hook) throw new Error('Hook not found: ' + index)
          const cmdStr = String(hook.cmd)
          const execCwd = path.isAbsolute(hook.cwd || '')
            ? (hook.cwd as string)
            : path.resolve(repoRoot, hook.cwd || '.')
          appendLog({ level: 'info', message: 'hooks.exec.start', index, name: hook.name || '', cmd: cmdStr, cwd: execCwd })
          const child = spawn('bash', ['-lc', cmdStr], { cwd: execCwd })
          const chunks: Buffer[] = []
          const errChunks: Buffer[] = []
          const done = await new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
              try { child.kill('SIGKILL') } catch {}
              reject(new Error('Hook timeout'))
            }, 60_000)
            child.stdout.on('data', (c) => chunks.push(Buffer.from(c)))
            child.stderr.on('data', (c) => errChunks.push(Buffer.from(c)))
            child.on('error', (e) => { clearTimeout(timer); reject(e) })
            child.on('close', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf-8')) })
          })
          const stderr = Buffer.concat(errChunks).toString('utf-8')
          let parsed: any
          try {
            const out = done.trim()
            const match = out.match(/\{[\s\S]*\}$/)
            parsed = JSON.parse(match ? match[0] : out)
            appendLog({ level: 'info', message: 'hooks.exec.parsed', index, ok: parsed?.ok ?? parsed?.status, items: Array.isArray(parsed?.items) ? parsed.items.length : 0 })
          } catch (e) {
            appendLog({ level: 'error', message: 'hooks.exec.parse_failed', index, stderr: stderr ? stderr.slice(0, 500) : null })
            throw new Error('Invalid JSON output from hook: ' + index + (stderr ? ('; stderr: ' + stderr.slice(0, 500)) : ''))
          }
          const ok = !!(parsed && (parsed.ok === true || parsed.status === 'success'))
          const items: any[] = Array.isArray(parsed?.items) ? parsed.items : []
          return { ok, items, error: ok ? null : (parsed?.error || 'Hook failed'), stderr: stderr ? stderr.slice(0, 500) : null }
        }

        function validateWorkitemMinimal(it: any): boolean {
          return it && typeof it === 'object'
            && typeof it.id === 'string'
            && typeof it.title === 'string'
            && typeof it.description === 'string'
            && typeof it.url === 'string'
        }

        // 合并结果至 workitems.json，并更新 hook 状态（LWW 整条覆盖）
        function mergeItemsFrom(index: number, nowISO: string, items: any[]) {
          const arr = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'))
          const hook = arr[index]
          let added = 0, updated = 0
          const exists = fs.existsSync(workitemsFile) ? fs.readFileSync(workitemsFile, 'utf-8') : '[]'
          const current: any[] = JSON.parse(exists || '[]')
          const map = new Map<string, any>(current.map((x: any) => [x.id, x]))
          const beforeCount = current.length
          for (const it of items) {
            if (!validateWorkitemMinimal(it)) continue
            const next = { ...it, source: `hook:${hook?.name || index}`, updatedAt: nowISO }
            if (map.has(it.id)) updated++; else added++
            map.set(it.id, next)
          }
          const tmp = workitemsFile + '.tmp'
          const outData = JSON.stringify(Array.from(map.values()), null, 2) + '\n'
          fs.writeFileSync(tmp, outData, 'utf-8')
          fs.renameSync(tmp, workitemsFile)
          const afterStat = fs.statSync(workitemsFile)
          appendLog({ level: 'info', message: 'hooks.merge.done', index, added, updated, file: workitemsFile, beforeCount, afterSize: afterStat.size, mtime: afterStat.mtime.toISOString() })
          return { added, updated }
        }

        function updateHookStatus(index: number, nowISO: string, ok: boolean, lastError: string | null) {
          const arr = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'))
          const hook = arr[index]
          if (!hook) return
          hook.lastRunAt = nowISO
          hook.lastError = ok ? null : (lastError || 'Hook failed')
          fs.writeFileSync(hooksFile, JSON.stringify(arr, null, 2) + '\n', 'utf-8')
        }

        server.middlewares.use('/__hooks/run-all', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const arr = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'))
            const enabledIdx = arr.map((h: any, i: number) => (h && h.enabled ? i : -1)).filter((i: number) => i >= 0)
            // 并发执行脚本，收集结果（不合并）
            const execResults = await Promise.allSettled(enabledIdx.map((i: number) => execHookByIndex(i)))
            // 串行合并：从上到下，跳过失败，仅合并一次
            let added = 0, updated = 0
            const details: any[] = []
            for (let k = 0; k < enabledIdx.length; k++) {
              const i = enabledIdx[k]
              const r = execResults[k]
              const nowISO = new Date().toISOString()
              if (r.status === 'fulfilled' && r.value.ok) {
                const items = Array.isArray(r.value.items) ? r.value.items : []
                // 合并前最小校验
                const filtered = items.filter((x: any) => validateWorkitemMinimal(x))
                const mr = mergeItemsFrom(i, nowISO, filtered)
                updateHookStatus(i, nowISO, true, null)
                added += mr.added; updated += mr.updated
                appendLog({ level: 'info', message: 'hooks.run_all.merged', index: i, added: mr.added, updated: mr.updated })
                details.push({ index: i, ok: true, added: mr.added, updated: mr.updated, items: filtered })
              } else {
                const reason = r.status === 'rejected' ? String(r.reason) : (r.value?.error || 'Hook failed')
                appendLog({ level: 'error', message: 'hooks.run_all.failed', index: i, reason })
                updateHookStatus(i, nowISO, false, reason)
                details.push({ index: i, ok: false, error: reason })
              }
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, added, updated, results: details }))
          } catch (e) {
            console.error('[hooks] run-all error', e)
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        server.middlewares.use('/__hooks/run/', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          const id = (req.url || '').split('/').pop() as string
          try {
            const index = Number(id)
            const nowISO = new Date().toISOString()
            const r = await execHookByIndex(index)
            if (!r.ok) {
              updateHookStatus(index, nowISO, false, r.error || r.stderr || 'Hook failed')
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: r.error || r.stderr || 'Hook failed' }))
              appendLog({ level: 'error', message: 'hooks.run_one.failed', index, error: r.error || r.stderr || 'Hook failed' })
              return
            }
            const filtered = (Array.isArray(r.items) ? r.items : []).filter((x) => validateWorkitemMinimal(x))
            const mr = mergeItemsFrom(index, nowISO, filtered)
            appendLog({ level: 'info', message: 'hooks.run_one.merged', index, added: mr.added, updated: mr.updated })
            updateHookStatus(index, nowISO, true, null)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, added: mr.added, updated: mr.updated, items: filtered }))
          } catch (e) {
            appendLog({ level: 'error', message: 'hooks.run_one.error', id, error: String((e as Error).message || e) })
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        // save hooks.json
        server.middlewares.use('/__hooks/save', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (c) => chunks.push(Buffer.from(c)))
              req.on('end', () => resolve())
              req.on('error', (e) => reject(e))
            })
            const raw = Buffer.concat(chunks).toString('utf-8')
            const json = JSON.parse(raw)
            // 最小 schema 校验：必须是数组，元素需包含 name/cmd/enabled 基本字段
            if (!Array.isArray(json)) throw new Error('hooks must be an array')
            for (const h of json) {
              if (!h || typeof h !== 'object') throw new Error('hook must be object')
              if (typeof (h as any).name !== 'string') throw new Error('hook.name must be string')
              if (typeof (h as any).cmd !== 'string') throw new Error('hook.cmd must be string')
              if (typeof (h as any).enabled !== 'boolean') throw new Error('hook.enabled must be boolean')
            }
            fs.writeFileSync(hooksFile, JSON.stringify(json, null, 2) + '\n', 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })
      },
    },
  ],
})

// removed duplicate default export
