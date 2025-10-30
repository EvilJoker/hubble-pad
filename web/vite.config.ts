import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

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
      },
    },
  ],
})

// removed duplicate default export
