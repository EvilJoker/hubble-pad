<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useHooks } from '@/composables/useHooks'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuActions,
  SidebarMenuActionButton,
  SidebarMenuCollapseButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const props = defineProps<{
  // Hooks 相关（如需外部覆盖可传，默认内部加载）
  hooks?: Array<{ id?: string; name: string; desc?: string; enabled?: boolean; lastRunAt?: string | null; lastError?: string | null }>
  // 外部请求打开数据编辑器（用于 WorkItem 行编辑）
  externalEditor?: { open: boolean; text: string; id?: string } | null
}>()

const emits = defineEmits<{
  'openHooksEditor': []
  'saveHooks': [text: string]
  'runHooksAll': []
  'runHook': [id: string]
  'dataSaved': []
}>()

// Vue 3 中 v-model 使用 kebab-case，但 props 定义使用 camelCase
defineOptions({
  inheritAttrs: false,
})

// WorkItems 编辑内部状态
const editorOpen = ref(false)
const editorText = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const editingItemId = ref<string | null>(null)

// Hooks 相关状态
const { hooks: hooksData, load: loadHooks } = useHooks()
const hooksOpen = ref(false)
const hooksEditorOpen = ref(false)
const hooksEditorText = ref('')
const savingHooks = ref(false)
// 运行中状态
const runningAll = ref(false)
const runningNames = ref<Set<string>>(new Set())
let runAllPollTimer: any = null
let runAllStartMap: Map<string, string | null> | null = null

// 使用 props 的 hooks 或内部加载的 hooks
const hooks = computed(() => props.hooks ?? hooksData.value)

// WorkItems 目录路径
const dataDir = ref<string>('')

// 加载配置
async function loadConfig() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' })
    if (res.ok) {
      const config = await res.json()
      dataDir.value = config.dataDir || ''
    }
  } catch (e) {
    // 忽略错误，使用空值
  }
}

// 初始化加载 hooks 和配置
loadHooks()
onMounted(() => {
  loadConfig()
})

async function openHooksEditor() {
  try {
    const res = await fetch('/data/hooks.json', { cache: 'no-store' })
    hooksEditorText.value = await res.text()
    hooksEditorOpen.value = true
    emits('openHooksEditor')
  } catch (e) {
    hooksEditorText.value = '[]'
    hooksEditorOpen.value = true
    emits('openHooksEditor')
  }
}

async function saveHooks() {
  savingHooks.value = true
  try {
    JSON.parse(hooksEditorText.value)
    await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: hooksEditorText.value })
    hooksEditorOpen.value = false
    await loadHooks()
    emits('saveHooks', hooksEditorText.value)
  } catch (e) {
    alert('保存失败: ' + (e as Error).message)
  } finally {
    savingHooks.value = false
  }
}

// 删除旧的 handleRunHooksAll 实现（已替换为带超时与占用检测的版本）

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
    // 通知右侧刷新
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
  if (runningNames.value.size > 0 || runningAll.value) {
    alert('存在子任务正在运行，请等待完成后再执行全部')
    return
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  runningAll.value = true
  // 预先点亮所有启用脚本的子按钮 spinner
  try {
    const list = Array.isArray(hooks.value) ? hooks.value : []
    const enabled = list.filter((x: any) => x && x.enabled).map((x: any) => x.name as string)
    enabled.forEach((n: string) => runningNames.value.add(n))
    // 记录开始时的 lastRunAt，用来判断单个脚本完成
    runAllStartMap = new Map<string, string | null>()
    for (const h of list) {
      if (h && h.name) runAllStartMap.set(h.name, h.lastRunAt ?? null)
    }
    // 轮询刷新状态，逐个清除 spinner
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
    emits('runHooksAll')
    // 通知右侧刷新
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
    // 若仍有残留（异常时），兜底清理
    if (runningNames.value.size > 0) runningNames.value.clear()
  }
}

function handleSaveEditor() {
  saveEditor()
}

// 当打开 WorkItems 编辑对话框时，读取文件
import { watch } from 'vue'
watch(editorOpen, async (v) => {
  if (!v) return
  // 若是从子条目进入（editingItemId 已设置），不要覆盖外部传入的编辑内容
  if (editingItemId.value) return
  try {
    const res = await fetch('/data/workitems.json', { cache: 'no-store' })
    const raw = await res.text()
    saveError.value = null
    editorText.value = raw
  } catch (e) {
    saveError.value = (e as Error).message
    editorText.value = ''
  }
})

// 监听外部触发的编辑器打开
watch(() => props.externalEditor, (val) => {
  if (val && val.open) {
    editorText.value = val.text || '{}'
    saveError.value = null
    editorOpen.value = true
    editingItemId.value = val.id ?? null
  }
}, { deep: true })

async function saveEditor() {
  saveError.value = null
  saving.value = true
  try {
    // 如果是从子条目进入（editingItemId 存在），则执行 item 级别合并保存
    if (editingItemId.value) {
      const obj = JSON.parse(editorText.value)
      const res0 = await fetch('/data/workitems.json', { cache: 'no-store' })
      const raw = await res0.text()
      const arr = JSON.parse(raw)
      const list = Array.isArray(arr) ? arr : []
      const idx = list.findIndex((x: any) => x && x.id === editingItemId.value)
      if (idx >= 0) list[idx] = obj
      else list.push(obj)
      const payload = JSON.stringify(list, null, 2)
      const res = await fetch('/__data/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
      const j = await res.json().catch(() => ({ ok: false }))
      if (!res.ok || !j.ok) {
        const msg = (j && (j as any).message) ? (j as any).message : `HTTP ${res.status}`
        saveError.value = msg
        alert('保存失败：' + msg)
        return
      }
    } else {
      // 全量编辑模式
      JSON.parse(editorText.value)
      const res = await fetch('/__data/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: editorText.value })
      const j = await res.json().catch(() => ({ ok: false }))
      if (!res.ok || !j.ok) {
        const msg = (j && (j as any).message) ? (j as any).message : `HTTP ${res.status}`
        saveError.value = msg
        alert('保存失败：' + msg)
        return
      }
    }
    editorOpen.value = false
    editingItemId.value = null
    emits('dataSaved')
    // 通知右侧刷新
    window.dispatchEvent(new CustomEvent('workitems-updated'))
  } catch (e) {
    const msg = (e as Error).message
    saveError.value = msg
    alert('发生未知错误：' + msg)
  } finally {
    saving.value = false
  }
}

// 启用/禁用某个 hook
async function toggleHookEnabled(targetName: string | undefined, enabled: boolean) {
  try {
    if (!targetName) return
    // 以当前 hooks 为基准更新 enabled 字段
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
  <Sidebar class="border-r min-w-0" style="--sidebar-width: 18rem; --sidebar-width-mobile: 18rem;">
      <SidebarHeader>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="p-4 w-full box-border flex items-center gap-3 rounded-md hover:bg-accent/50 transition-colors cursor-default max-w-full">
                <Avatar class="h-9 w-9">
                  <AvatarImage src="/logo.png" alt="Hubble Pad" />
                  <AvatarFallback class="bg-blue-100 text-blue-600 flex items-center justify-center">
                    <icon-lucide-bolt class="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate text-blue-500">Hubble Pad</div>
                  <div class="text-xs text-muted-foreground truncate">Stand</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent class="bg-blue-500 text-white border-blue-500">极简的工作平台</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>
      <SidebarContent class="w-full min-w-0 overflow-y-auto overflow-x-hidden">
        <SidebarMenu>
          <SidebarSeparator />
        </SidebarMenu>

        <!-- Common group: contains WorkItems and Hooks -->
        <SidebarGroup>
          <SidebarGroupLabel>Common</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <!-- Config item -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#" @click.prevent class="flex items-center gap-2 pl-3">
                          <icon-lucide-settings class="w-4 h-4" />
                          <span>Config</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">
                      <div class="text-xs">
                        配置文件目录：<span v-if="dataDir" class="font-mono break-all">{{ dataDir }}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              <!-- WorkItems item -->
              <SidebarMenuItem>
                <Dialog v-model:open="editorOpen">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <SidebarMenuButton as-child>
                          <a href="#" @click.prevent class="flex items-center gap-2 pl-3">
                            <icon-lucide-database class="w-4 h-4" />
                            <span>WorkItems</span>
                          </a>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent class="z-50">
                        <div class="text-xs">
                          数据文件：
                          <a
                            href="https://github.com/EvilJoker/hubble-pad/blob/main/data/workitems.json"
                            target="_blank"
                            class="text-blue-600 underline ml-1"
                          >
                            示例
                          </a>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <SidebarMenuActions>
                    <SidebarMenuActionButton :position="1" tooltip="编辑" @click.stop="editorOpen = true">
                      <icon-lucide-pencil class="w-3.5 h-3.5" />
                    </SidebarMenuActionButton>
                  </SidebarMenuActions>
                  <DialogContent class="sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>编辑 data/workitems.json</DialogTitle>
                    </DialogHeader>
                    <div>
                      <Textarea v-model="editorText" class="h-80 font-mono text-sm" />
                      <p v-if="saveError" class="text-red-600 mt-2">{{ saveError }}</p>
                    </div>
                    <DialogFooter>
                      <Button type="button" @click="handleSaveEditor" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </SidebarMenuItem>

              <!-- Hooks item with sub-menu (default collapsed) -->
                  <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#" class="flex items-center gap-2 pl-3">
                          <icon-lucide-plug class="w-4 h-4" />
                          <span>Hooks</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">钩子脚本：<a
                            href="https://github.com/EvilJoker/hubble-pad/blob/main/data/hooks.json"
                            target="_blank"
                            class="text-blue-600 underline ml-1"
                          >
                            示例
                          </a></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <SidebarMenuActions>
                  <SidebarMenuActionButton :position="1" :tooltip="runningAll ? '运行中…' : '运行全部'" @click.stop="handleRunHooksAll">
                    <template v-if="runningAll">
                      <icon-lucide-loader-2 class="animate-spin w-3.5 h-3.5" />
                    </template>
                    <template v-else>
                      <icon-lucide-play class="w-3.5 h-3.5" />
                    </template>
                  </SidebarMenuActionButton>
                  <SidebarMenuActionButton :position="2" tooltip="编辑" @click.stop="openHooksEditor">
                    <icon-lucide-pencil class="w-3.5 h-3.5" />
                  </SidebarMenuActionButton>
                  <SidebarMenuCollapseButton :position="5" v-model:open="hooksOpen" :right-offset="6" />
                </SidebarMenuActions>
                <SidebarMenuSub v-if="hooksOpen && hooks.length" class="border-l-10 border-gray-300 ml-5">
                  <SidebarMenuSubItem v-for="h in hooks" :key="h.name">
                    <div class="flex items-center w-full pl-3 gap-2">
                      <SidebarMenuSubButton as-child>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <a href="#" @click.prevent class="flex items-center gap-2 text-gray-800">
                                <icon-lucide-file-code-2 :class="['w-3.5 h-3.5', h.lastError ? 'text-red-500' : 'text-gray-500']" />
                                <span>{{ h.name }}</span>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent class="z-50">
                              <div class="text-xs whitespace-pre-line">
                                {{ (h.desc || '脚本') + (h.lastRunAt ? '  ' + h.lastRunAt : '') }}
                                <template v-if="h.lastError">\n{{ h.lastError }}</template>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </SidebarMenuSubButton>
                      <!-- 启用/禁用 开关 -->
                      <SidebarMenuActionButton
                        class="ml-auto self-center"
                        :size="5"
                        :tooltip="h.enabled ? '禁用' : '启用'"
                        @click="() => toggleHookEnabled(h.name, !h.enabled)"
                      >
                        <icon-lucide-power :class="h.enabled ? 'text-green-500' : 'text-gray-400'" />
                      </SidebarMenuActionButton>

                      <!-- 运行按钮 -->
                      <template v-if="runningNames.has(h.name || '')">
                        <div class="mr-[15px] self-center flex items-center justify-center size-5">
                          <icon-lucide-loader-2 class="animate-spin w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </template>
                      <SidebarMenuActionButton
                        v-else
                        class="mr-[15px] self-center"
                        :size="5"
                        tooltip="运行"
                        @click="() => handleRunHookByName(h.name)"
                      >
                        <icon-lucide-play />
                      </SidebarMenuActionButton>
                    </div>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <!-- Hooks JSON editor dialog -->
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
      </SidebarContent>
      <SidebarFooter>
        <div class="p-4 w-full box-border flex items-center gap-3 max-w-full">
          <Avatar class="h-8 w-8 border border-sky-500 rounded-full">
            <AvatarFallback class="bg-white text-sky-500 flex items-center justify-center">
              <icon-lucide-cat class="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">shadcn</div>
            <div class="text-xs text-muted-foreground truncate">m@example.com</div>
          </div>
        </div>
      </SidebarFooter>
  </Sidebar>
</template>
