import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

export default defineConfig({
  server: {
    port: 10002,
  },
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
        // 开发环境的数据根目录：
        // 优先使用环境变量 HUBBLE_PAD_DATA_DIR，其次使用当前工作目录下的 data 目录，最后使用 ~/.local/.hubble-pad
        const envDataDir = process.env.HUBBLE_PAD_DATA_DIR
        let dataDir: string
        if (envDataDir && envDataDir.trim()) {
          dataDir = path.resolve(envDataDir)
        } else {
          // 优先使用当前工作目录下的 data 目录
          const currentWorkingDir = process.cwd()
          const currentDirData = path.resolve(currentWorkingDir, 'data')
          if (fs.existsSync(currentDirData)) {
            dataDir = currentDirData
          } else {
            // 如果当前工作目录没有 data 目录，则使用 ~/.local/.hubble-pad
            dataDir = path.join(os.homedir(), '.local', '.hubble-pad')
          }
        }
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
        // dev: 返回配置的数据目录，供前端展示
        server.middlewares.use('/api/config', (_req, res, _next) => {
          try {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ dataDir }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
        })
        server.middlewares.use('/data', (req, res, next) => {
          // 只处理 GET 请求，POST 请求留给其他中间件处理
          if (req.method !== 'GET') {
            return next()
          }
          const url = req.url || '/'
          const rel = decodeURIComponent(url.replace(/^\/data\/?/, ''))
          const filePath = path.join(dataDir, rel)
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              // 设置正确的 Content-Type
              if (filePath.endsWith('.json')) {
                res.setHeader('Content-Type', 'application/json')
              }
              fs.createReadStream(filePath).pipe(res)
              return
            }
            // 如果文件不存在，对于 JSON 文件返回空数组，避免返回 HTML
            if (rel.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end('[]')
              return
            }
          } catch {
            // ignore
          }
          next()
        })

        // 写入服务状态信息到 status.json
        function writeStatusFile() {
          try {
            const statusFile = path.join(dataDir, 'status.json')
            const networkInterfaces = os.networkInterfaces()
            const addresses: string[] = []

            // 收集所有 IPv4 地址
            for (const interfaceName of Object.keys(networkInterfaces)) {
              const interfaces = networkInterfaces[interfaceName]
              if (interfaces) {
                for (const iface of interfaces) {
                  if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.push(iface.address)
                  }
                }
              }
            }

            const status = {
              server: {
                ip: addresses.length > 0 ? addresses[0] : '127.0.0.1',
                port: 10002,
                url: `http://${addresses.length > 0 ? addresses[0] : '127.0.0.1'}:10002`,
                localUrl: 'http://127.0.0.1:10002',
              },
              dataDir: dataDir,
              startedAt: new Date().toISOString(),
            }

            fs.writeFileSync(statusFile, JSON.stringify(status, null, 2) + '\n', 'utf-8')
          } catch (error) {
            // 忽略写入错误，不影响服务启动
            console.warn('Failed to write status.json:', (error as Error).message)
          }
        }

        // 在服务器配置完成后写入状态文件
        writeStatusFile()

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

        // dev only toggle favorite endpoint
        // Note: mount without trailing slash so both '/__data/toggle-favorite' and '/__data/toggle-favorite/:id' work
        server.middlewares.use('/__data/toggle-favorite', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            // When mounted at '/__data/toggle-favorite', req.url starts with '/:id' or ''
            const url = req.url || ''
            const id = decodeURIComponent(url.replace(/^\//, ''))
            if (!id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'id is required' }))
              return
            }

            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (c) => chunks.push(Buffer.from(c)))
              req.on('end', () => resolve())
              req.on('error', (e) => reject(e))
            })
            const raw = Buffer.concat(chunks).toString('utf-8')
            const body = JSON.parse(raw)
            const { favorite } = body

            if (typeof favorite !== 'boolean') {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'favorite must be boolean' }))
              return
            }

            const target = path.join(dataDir, 'workitems.json')
            if (!fs.existsSync(target)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'workitems.json not found' }))
              return
            }

            const content = fs.readFileSync(target, 'utf-8')
            const workitems = JSON.parse(content)

            if (!Array.isArray(workitems)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'workitems must be an array' }))
              return
            }

            const item = workitems.find((it: any) => it && it.id === id)
            if (!item) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: `WorkItem with id "${id}" not found` }))
              return
            }

            // 更新收藏状态
            if (favorite) {
              item.favorite = true
            } else {
              delete item.favorite
            }

            // 原子写入：先写到临时文件，再重命名，避免并发写入导致数据丢失
            const tmpFile = target + '.tmp'
            fs.writeFileSync(tmpFile, JSON.stringify(workitems, null, 2) + '\n', 'utf-8')
            fs.renameSync(tmpFile, target)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        // dev only delete endpoint
        // Note: mount without trailing slash so both '/__data/delete' and '/__data/delete/:id' work
        server.middlewares.use('/__data/delete', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const url = req.url || ''
            const id = decodeURIComponent(url.replace(/^\//, ''))
            if (!id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'id is required' }))
              return
            }

            const target = path.join(dataDir, 'workitems.json')
            if (!fs.existsSync(target)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'workitems.json not found' }))
              return
            }

            const content = fs.readFileSync(target, 'utf-8')
            const workitems = JSON.parse(content || '[]')
            if (!Array.isArray(workitems)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'workitems must be an array' }))
              return
            }

            const before = workitems.length
            const nextList = workitems.filter((it: any) => !it || typeof it !== 'object' ? false : it.id !== id)
            const after = nextList.length

            if (before === after) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: `WorkItem with id "${id}" not found` }))
              return
            }

            const tmpFile = target + '.tmp'
            fs.writeFileSync(tmpFile, JSON.stringify(nextList, null, 2) + '\n', 'utf-8')
            fs.renameSync(tmpFile, target)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, deleted: before - after }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
          }
        })

        // dev only add-record endpoint
        // Note: mount without trailing slash so both '/__data/add-record' and '/__data/add-record/:id' work
        server.middlewares.use('/__data/add-record', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const url = req.url || ''
            const id = decodeURIComponent(url.replace(/^\//, ''))
            if (!id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'id is required' }))
              return
            }

            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (c) => chunks.push(Buffer.from(c)))
              req.on('end', () => resolve())
              req.on('error', (e) => reject(e))
            })
            const raw = Buffer.concat(chunks).toString('utf-8')
            const body = JSON.parse(raw || '{}')
            const record = (body as any).record

            if (!record || typeof record !== 'object' || typeof record.content !== 'string') {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'record.content must be string' }))
              return
            }

            const target = path.join(dataDir, 'workitems.json')
            if (!fs.existsSync(target)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'workitems.json not found' }))
              return
            }

            const content = fs.readFileSync(target, 'utf-8')
            const workitems = JSON.parse(content || '[]')
            if (!Array.isArray(workitems)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: 'workitems must be an array' }))
              return
            }

            const item = workitems.find((it: any) => it && it.id === id)
            if (!item) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: `WorkItem with id "${id}" not found` }))
              return
            }

            // 确保 storage.records 存在
            if (!item.storage) item.storage = {}
            if (!Array.isArray(item.storage.records)) item.storage.records = []

            const recordWithTime = {
              ...record,
              createdAt: record.createdAt || new Date().toISOString(),
            }
            item.storage.records.push(recordWithTime)

            const tmpFile = target + '.tmp'
            fs.writeFileSync(tmpFile, JSON.stringify(workitems, null, 2) + '\n', 'utf-8')
            fs.renameSync(tmpFile, target)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, record: recordWithTime }))
          } catch (e) {
            res.statusCode = 500
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

        // --- kinds endpoints ---
        const kindsFile = path.join(dataDir, 'kind.json')
        const notifyFile = path.join(dataDir, 'notify.json')

        server.middlewares.use('/__data/kinds', async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              if (!fs.existsSync(kindsFile)) {
                res.setHeader('Content-Type', 'application/json')
                res.end('[]')
                return
              }
              const txt = fs.readFileSync(kindsFile, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(txt)
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: (e as Error).message }))
            }
            return
          }
          if (req.method === 'POST') {
            try {
              const chunks: Buffer[] = []
              await new Promise<void>((resolve, reject) => {
                req.on('data', (c) => chunks.push(Buffer.from(c)))
                req.on('end', () => resolve())
                req.on('error', (e) => reject(e))
              })
              const raw = Buffer.concat(chunks).toString('utf-8')
              const json = JSON.parse(raw)
              if (!Array.isArray(json)) {
                throw new Error('kinds must be an array')
              }
              for (const kind of json) {
                if (!kind || typeof kind !== 'object') {
                  throw new Error('kind must be object')
                }
                if (typeof kind.value !== 'string' || !kind.value.trim()) {
                  throw new Error('kind.value must be non-empty string')
                }
                if (typeof kind.label !== 'string' || !kind.label.trim()) {
                  throw new Error('kind.label must be non-empty string')
                }
                if (typeof kind.color !== 'string') {
                  throw new Error('kind.color must be string')
                }
              }
              const tmpFile = kindsFile + '.tmp'
              fs.writeFileSync(tmpFile, JSON.stringify(json, null, 2) + '\n', 'utf-8')
              fs.renameSync(tmpFile, kindsFile)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (e) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: (e as Error).message }))
            }
            return
          }
          next()
        })

        // --- notify endpoints ---
        server.middlewares.use('/__data/notify', async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const url = new URL(req.originalUrl || req.url || '', 'http://localhost')
              const workitemId = url.searchParams.get('workitemId') || ''
              if (!fs.existsSync(notifyFile)) {
                res.setHeader('Content-Type', 'application/json')
                res.end('[]')
                return
              }
              const txt = fs.readFileSync(notifyFile, 'utf-8')
              let items: any[] = []
              try {
                const parsed = JSON.parse(txt || '[]')
                items = Array.isArray(parsed) ? parsed : []
              } catch {
                items = []
              }
              if (workitemId) {
                items = items.filter((it: any) => it && it.workitemId === workitemId)
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(items))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: (e as Error).message }))
            }
            return
          }
          if (req.method === 'POST') {
            try {
              const chunks: Buffer[] = []
              await new Promise<void>((resolve, reject) => {
                req.on('data', (c) => chunks.push(Buffer.from(c)))
                req.on('end', () => resolve())
                req.on('error', (e) => reject(e))
              })
              const raw = Buffer.concat(chunks).toString('utf-8')
              const body = JSON.parse(raw || '{}')
              const action = body.action
              const exists = fs.existsSync(notifyFile) ? fs.readFileSync(notifyFile, 'utf-8') : '[]'
              let items: any[] = []
              try {
                const parsed = JSON.parse(exists || '[]')
                items = Array.isArray(parsed) ? parsed : []
              } catch {
                items = []
              }

              if (action === 'add') {
                const item = body.item || {}
                if (!item || typeof item !== 'object') {
                  throw new Error('item must be object')
                }
                const now = new Date().toISOString()
                const id = typeof item.id === 'string' && item.id.trim()
                  ? item.id.trim()
                  : Math.random().toString(36).slice(2)
                const next = {
                  id,
                  title: typeof item.title === 'string' ? item.title : '提醒',
                  content: typeof item.content === 'string' ? item.content : '',
                  workitemId: typeof item.workitemId === 'string' ? item.workitemId : undefined,
                  createdAt: item.createdAt || now,
                }
                items.push(next)
              } else if (action === 'clearByWorkitem') {
                const workitemId = typeof body.workitemId === 'string' ? body.workitemId : ''
                if (!workitemId) throw new Error('workitemId is required')
                items = items.filter((it: any) => !it || it.workitemId !== workitemId)
              } else if (action === 'clearAll') {
                items = []
              } else if (action === 'removeById') {
                const id = typeof body.id === 'string' ? body.id : ''
                if (!id) throw new Error('id is required')
                items = items.filter((it: any) => !it || it.id !== id)
              } else if (action === 'removeByIds') {
                const ids = Array.isArray(body.ids) ? body.ids : []
                if (ids.length === 0) throw new Error('ids array is required and cannot be empty')
                const idSet = new Set(ids.filter((id: any) => typeof id === 'string' && id.trim()))
                items = items.filter((it: any) => !it || !idSet.has(it.id))
              } else {
                throw new Error('invalid action')
              }

              const tmpFile = notifyFile + '.tmp'
              fs.writeFileSync(tmpFile, JSON.stringify(items, null, 2) + '\n', 'utf-8')
              fs.renameSync(tmpFile, notifyFile)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (e) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: (e as Error).message }))
            }
            return
          }
          next()
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
            if (!out || out.trim() === '') {
              appendLog({ level: 'error', message: 'hooks.exec.no_output', index, stderr: stderr ? stderr.slice(0, 500) : null })
              return { ok: false, items: [], error: 'Hook 未输出有效的 JSON 结果', stderr: stderr ? stderr.slice(0, 1000) : '脚本执行完成但无输出' }
            }
            // 优先查找 response= 格式的输出
            let jsonStr = ''
            const responseMatch = out.match(/response\s*=\s*(\{[\s\S]*\})/i)
            if (responseMatch && responseMatch[1]) {
              jsonStr = responseMatch[1]
            } else {
              // 如果没有找到 response= 格式，回退到原来的解析方式
              // 查找最后一个完整的 JSON 对象
              const jsonMatch = out.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}$/s)
              if (jsonMatch) {
                jsonStr = jsonMatch[0]
              } else {
                // 如果正则匹配失败，尝试简单的匹配
                const simpleMatch = out.match(/\{[\s\S]*\}$/)
                jsonStr = simpleMatch ? simpleMatch[0] : out
              }
              // 如果还是找不到，尝试直接解析整个输出
              if (!jsonStr || jsonStr.trim() === '') {
                jsonStr = out
              }
            }
            parsed = JSON.parse(jsonStr)
            appendLog({ level: 'info', message: 'hooks.exec.parsed', index, ok: parsed?.ok ?? parsed?.status, items: Array.isArray(parsed?.items) ? parsed.items.length : 0 })
          } catch (e) {
            appendLog({ level: 'error', message: 'hooks.exec.parse_failed', index, stderr: stderr ? stderr.slice(0, 500) : null, error: (e as Error).message })
            return { ok: false, items: [], error: `JSON 解析失败: ${(e as Error).message}`, stderr: stderr ? stderr.slice(0, 1000) : `stdout: ${done.slice(0, 200)}` }
          }
          const ok = !!(parsed && (parsed.ok === true || parsed.status === 'success'))
          const items: any[] = Array.isArray(parsed?.items) ? parsed.items : []
          // 如果 parsed 中有 error 字段，使用它作为错误信息
          const errorMsg = ok ? null : (parsed?.error || 'Hook failed')
          return { ok, items, error: errorMsg, stderr: stderr ? stderr.slice(0, 1000) : null }
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

        // run-all API removed - use individual task scheduling instead

        server.middlewares.use('/__hooks/run/', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          const id = (req.url || '').split('/').pop() as string
          try {
            const index = Number(id)
            const nowISO = new Date().toISOString()
            const r = await execHookByIndex(index)
            if (!r.ok) {
              const errorMsg = r.error || r.stderr || 'Hook failed'
              updateHookStatus(index, nowISO, false, errorMsg)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, message: errorMsg, stderr: r.stderr ? r.stderr.slice(0, 2000) : null }))
              appendLog({ level: 'error', message: 'hooks.run_one.failed', index, error: errorMsg, stderr: r.stderr ? r.stderr.slice(0, 500) : null })
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
