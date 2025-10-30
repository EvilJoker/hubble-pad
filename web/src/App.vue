<script setup lang="ts">
import { useWorkitems } from './composables/useWorkitems'
const { items, loading, error, keyword, sortKey, reload } = useWorkitems()
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { ref, watch } from 'vue'
import WorkItemRow from '@/components/workitem/WorkItemRow.vue'
import { ItemSeparator } from '@/components/ui/item'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const editorText = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const editorOpen = ref(false)
type EditorMode = 'full' | 'item'
const editorMode = ref<EditorMode>('full')
const editingItemId = ref<string | null>(null)
let fullDataSnapshot: any[] | null = null

watch(editorOpen, async (v) => {
  if (!v) return
  try {
    const res = await fetch('/data/workitems.json', { cache: 'no-store' })
    const raw = await res.text()
    saveError.value = null
    if (editorMode.value === 'full') {
      editorText.value = raw
      fullDataSnapshot = null
      editingItemId.value = null
    } else {
      const arr = JSON.parse(raw)
      fullDataSnapshot = Array.isArray(arr) ? arr : []
      const obj = fullDataSnapshot.find((x: any) => x && x.id === editingItemId.value)
      editorText.value = JSON.stringify(obj ?? {}, null, 2)
    }
  } catch (e) {
    saveError.value = (e as Error).message
    editorText.value = ''
  }
})

function openItemEditor(it: { id: string }) {
  editorMode.value = 'item'
  editingItemId.value = it.id
  editorOpen.value = true
}

async function saveEditor() {
  saveError.value = null
  saving.value = true
  try {
    // 本地校验与准备 payload
    let payload: string
    if (editorMode.value === 'full') {
      JSON.parse(editorText.value)
      payload = editorText.value
    } else {
      const obj = JSON.parse(editorText.value)
      if (!fullDataSnapshot) throw new Error('快照丢失，请重试')
      const idx = fullDataSnapshot.findIndex((x: any) => x && x.id === editingItemId.value)
      if (idx >= 0) fullDataSnapshot[idx] = obj
      else fullDataSnapshot.push(obj)
      payload = JSON.stringify(fullDataSnapshot, null, 2)
    }

    const res = await fetch('/__data/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    const j = await res.json().catch(() => ({ ok: false }))
    if (!res.ok || !j.ok) {
      const msg = (j && j.message) ? j.message : `HTTP ${res.status}`
      saveError.value = msg
      alert('保存失败：' + msg)
      return
    }
    await reload()
    editorOpen.value = false
  } catch (e) {
    // 理论上不会走到这里；兜底提示但不抛异常
    const msg = (e as Error).message
    saveError.value = msg
    alert('发生未知错误：' + msg)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="h-screen flex">
    <SidebarProvider>
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
            <SidebarMenuItem>
              <Dialog v-model:open="editorOpen">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <DialogTrigger as-child>
                        <div class="flex items-center justify-between w-full">
                          <SidebarMenuButton as-child>
                            <a href="#" class="flex items-center gap-2" @click="editorMode='full'; editingItemId=null">
                              <icon-lucide-database class="w-4 h-4" />
                              <span>Data</span>
                            </a>
                          </SidebarMenuButton>
                          <SidebarMenuAction>
                            <icon-lucide-pencil class="w-4 h-4" />
                          </SidebarMenuAction>
                        </div>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">数据文件</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DialogContent class="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>编辑 data/workitems.json</DialogTitle>
                  </DialogHeader>
                  <div>
                    <Textarea v-model="editorText" class="h-80 font-mono text-sm" />
                    <p v-if="saveError" class="text-red-600 mt-2">{{ saveError }}</p>
                  </div>
                  <DialogFooter>
                    <Button type="button" @click="saveEditor" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SidebarMenuItem>
          </SidebarMenu>
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

      <!-- Content -->
      <main class="flex-1 p-6">
      <div id="right-pane" class="max-w-full ml-5">
      <div class="mb-4 flex items-center gap-3">
        <Input v-model="keyword" placeholder="搜索 title/description" class="w-72" />
        <Select v-model="sortKey">
          <SelectTrigger class="w-32">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">按标题</SelectItem>
            <SelectItem value="description">按描述</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="default" @click="reload">刷新</Button>
      </div>

      <div v-if="loading">加载中…</div>
      <div v-else-if="error" class="text-red-600">数据文件不可用：{{ error }}</div>
      <div v-else>
        <div v-if="items.length === 0" class="text-gray-500">暂无资源，等待钩子更新</div>
        <div v-else class="rounded border bg-white w-[720px]">
          <template v-for="(it, idx) in items" :key="it.id">
            <WorkItemRow
              :item="it"
              @edit="openItemEditor"
            />
            <ItemSeparator v-if="idx < items.length - 1" />
          </template>
        </div>
      </div>
      </div>
      </main>
    </SidebarProvider>
  </div>
</template>
