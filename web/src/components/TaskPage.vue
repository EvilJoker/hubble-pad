<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useHooks } from '@/composables/useHooks'
import { ItemSeparator } from '@/components/ui/item'

const { hooks: hooksData, load: loadHooks } = useHooks()
const hooks = computed(() => hooksData.value)

// 编辑相关状态
const hooksEditorOpen = ref(false)
const hooksEditorText = ref('')
const savingHooks = ref(false)

// 运行中状态
const runningAll = ref(false)
const runningNames = ref<Set<string>>(new Set())
let runAllPollTimer: any = null
let runAllStartMap: Map<string, string | null> | null = null

onMounted(() => {
  loadHooks()
})

async function openHooksEditor() {
  try {
    const res = await fetch('/data/hooks.json', { cache: 'no-store' })
    hooksEditorText.value = await res.text()
    hooksEditorOpen.value = true
  } catch (e) {
    hooksEditorText.value = '[]'
    hooksEditorOpen.value = true
  }
}

async function saveHooks() {
  savingHooks.value = true
  try {
    JSON.parse(hooksEditorText.value)
    await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: hooksEditorText.value })
    hooksEditorOpen.value = false
    await loadHooks()
  } catch (e) {
    alert('保存失败: ' + (e as Error).message)
  } finally {
    savingHooks.value = false
  }
}

async function handleRunHookByName(name: string | undefined) {
  if (!name) return
  if (runningNames.value.has(name)) return
  const list = Array.isArray(hooks.value) ? hooks.value : []
  const idx = list.findIndex((x: any) => x && x.name === name)
  if (idx < 0) return
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  runningNames.value.add(name)
  try {
    const res = await fetch(`/__hooks/run/${idx}`, { method: 'POST', signal: controller.signal })
    const j = await res.json().catch(() => ({ ok: false }))
    console.log('[hooks][client] run-one result:', j)
    await loadHooks()
    window.dispatchEvent(new CustomEvent('workitems-updated'))
  } catch (e) {
    if ((e as any).name === 'AbortError') {
      alert('运行超时（60s），已中止：' + name)
    } else {
      alert('运行失败：' + (e as Error).message)
    }
  } finally {
    clearTimeout(timeoutId)
    runningNames.value.delete(name)
  }
}

async function handleRunHooksAll() {
  if (runningAll.value) return
  if (runningNames.value.size > 0) runningNames.value.clear()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  runningAll.value = true
  try {
    const list = Array.isArray(hooks.value) ? hooks.value : []
    const enabled = list.filter((x: any) => x && x.enabled).map((x: any) => x.name as string)
    enabled.forEach((n: string) => runningNames.value.add(n))
    runAllStartMap = new Map<string, string | null>()
    for (const h of list) {
      if (h && h.name) runAllStartMap.set(h.name, h.lastRunAt ?? null)
    }
    runAllPollTimer = setInterval(async () => {
      await loadHooks()
      const cur = Array.isArray(hooks.value) ? hooks.value : []
      for (const h of cur) {
        if (!h || !h.name) continue
        if (runningNames.value.has(h.name)) {
          const before = runAllStartMap?.get(h.name) ?? null
          if ((h.lastRunAt ?? null) !== before) {
            runningNames.value.delete(h.name)
          }
        }
      }
      if (runningNames.value.size === 0 && runAllPollTimer) {
        clearInterval(runAllPollTimer)
        runAllPollTimer = null
      }
    }, 1000)
  } catch {}
  try {
    const res = await fetch('/__hooks/run-all', { method: 'POST', signal: controller.signal })
    const j = await res.json().catch(() => ({ ok: false }))
    console.log('[hooks][client] run-all result:', j)
    await loadHooks()
    window.dispatchEvent(new CustomEvent('workitems-updated'))
  } catch (e) {
    if ((e as any).name === 'AbortError') {
      alert('全部运行超时（60s），已中止')
    } else {
      alert('全部运行失败：' + (e as Error).message)
    }
  } finally {
    clearTimeout(timeoutId)
    runningAll.value = false
    if (runAllPollTimer) { clearInterval(runAllPollTimer); runAllPollTimer = null }
    runAllStartMap = null
    if (runningNames.value.size > 0) runningNames.value.clear()
  }
}

async function toggleHookEnabled(targetName: string | undefined, enabled: boolean) {
  try {
    if (!targetName) return
    const current = Array.isArray(hooks.value) ? hooks.value : []
    const updated = current.map((x: any) => x && x.name === targetName ? { ...x, enabled } : x)
    await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    await loadHooks()
  } catch (e) {
    alert('切换启用失败：' + (e as Error).message)
  }
}
</script>

<template>
  <div class="flex-1 min-w-0 overflow-auto">
    <div class="max-w-7xl mx-auto p-8 pl-12">
      <!-- 页面标题和操作 -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Task</h1>
          <p class="text-sm text-muted-foreground mt-1">Manage your task hooks</p>
        </div>
        <div class="flex gap-2">
          <Button @click="handleRunHooksAll" :disabled="runningAll">
            <icon-lucide-loader-2 v-if="runningAll" class="w-4 h-4 mr-2 animate-spin" />
            <icon-lucide-play v-else class="w-4 h-4 mr-2" />
            {{ runningAll ? '运行中…' : '运行全部' }}
          </Button>
          <Button variant="outline" @click="openHooksEditor">
            <icon-lucide-pencil class="w-4 h-4 mr-2" />
            编辑
          </Button>
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-if="hooks.length === 0" class="text-gray-500 text-center py-12">
        暂无任务，点击"编辑"添加任务
      </div>
      <div v-else class="rounded border bg-white">
        <template v-for="(h, idx) in hooks" :key="h.name">
          <div class="p-4 hover:bg-gray-50 transition-colors">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <icon-lucide-file-code-2 :class="['w-4 h-4 flex-shrink-0', h.lastError ? 'text-red-500' : 'text-muted-foreground']" />
                  <h3 class="text-base font-medium truncate">{{ h.name }}</h3>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <Switch :checked="h.enabled" @update:checked="(val) => toggleHookEnabled(h.name, val)" />
                  </div>
                </div>
                <p v-if="h.desc" class="text-sm text-muted-foreground mb-2">{{ h.desc }}</p>
                <div class="flex items-center gap-4 text-xs text-muted-foreground">
                  <span v-if="h.lastRunAt">最后运行：{{ new Date(h.lastRunAt).toLocaleString() }}</span>
                  <span v-if="h.lastError" class="text-red-600">错误：{{ h.lastError }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="runningNames.has(h.name || '')"
                  @click="() => handleRunHookByName(h.name)"
                >
                  <icon-lucide-loader-2 v-if="runningNames.has(h.name || '')" class="w-3 h-3 mr-1 animate-spin" />
                  <icon-lucide-play v-else class="w-3 h-3 mr-1" />
                  运行
                </Button>
              </div>
            </div>
          </div>
          <ItemSeparator v-if="idx < hooks.length - 1" />
        </template>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <Dialog v-model:open="hooksEditorOpen">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>编辑 data/hooks.json</DialogTitle>
        </DialogHeader>
        <div>
          <Textarea v-model="hooksEditorText" class="h-80 font-mono text-sm" />
        </div>
        <DialogFooter>
          <Button type="button" @click="saveHooks" :disabled="savingHooks">{{ savingHooks ? '保存中…' : '保存' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

