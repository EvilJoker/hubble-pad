<script setup lang="ts">
import { useWorkitems } from '@/composables/useWorkitems'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import WorkItemRow from '@/components/workitem/WorkItemRow.vue'
import { ItemSeparator } from '@/components/ui/item'
import { ref, watch, onMounted, onUnmounted } from 'vue'

const { items, loading, error, keyword, sortKey, kindFilter, reload } = useWorkitems()

// 编辑相关状态
const editorOpen = ref(false)
const editorText = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const editingItemId = ref<string | null>(null)

function handleEdit(item: { id: string }) {
  editingItemId.value = item.id
  fetch('/data/workitems.json', { cache: 'no-store' })
    .then((r) => r.text())
    .then((raw) => {
      try {
        const arr = JSON.parse(raw)
        const obj = Array.isArray(arr) ? arr.find((x: any) => x && x.id === item.id) : null
        editorText.value = JSON.stringify(obj ?? {}, null, 2)
        editorOpen.value = true
      } catch {
        editorText.value = '{}'
        editorOpen.value = true
      }
    })
}

function openFullEditor() {
  editingItemId.value = null
  fetch('/data/workitems.json', { cache: 'no-store' })
    .then((r) => r.text())
    .then((raw) => {
      saveError.value = null
      editorText.value = raw
      editorOpen.value = true
    })
    .catch((e) => {
      saveError.value = (e as Error).message
      editorText.value = ''
      editorOpen.value = true
    })
}

async function saveEditor() {
  saveError.value = null
  saving.value = true
  try {
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
    reload()
    window.dispatchEvent(new CustomEvent('workitems-updated'))
  } catch (e) {
    const msg = (e as Error).message
    saveError.value = msg
    alert('发生未知错误：' + msg)
  } finally {
    saving.value = false
  }
}

// 事件监听器模式：监听全局的 workitems 更新事件
function handleWorkitemsUpdated() {
  reload()
}

onMounted(() => {
  window.addEventListener('workitems-updated', handleWorkitemsUpdated)
})

onUnmounted(() => {
  window.removeEventListener('workitems-updated', handleWorkitemsUpdated)
})
</script>

<template>
  <div class="flex-1 min-w-0 overflow-auto">
    <div class="max-w-7xl mx-auto p-8 pl-12">
      <!-- 页面标题和操作 -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Data</h1>
          <p class="text-sm text-muted-foreground mt-1">Manage your work items</p>
        </div>
        <Button @click="openFullEditor">
          <icon-lucide-pencil class="w-4 h-4 mr-2" />
          编辑数据
        </Button>
      </div>

      <!-- 顶部标签页导航 -->
      <div class="mb-4">
        <Tabs v-model:modelValue="kindFilter" class="w-full">
          <TabsList class="inline-flex h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
            <TabsTrigger value="">
              <icon-lucide-grid class="w-4 h-4 mr-2" />
              全部
            </TabsTrigger>
            <TabsTrigger value="code">
              <icon-lucide-code class="w-4 h-4 mr-2" />
              Code
            </TabsTrigger>
            <TabsTrigger value="task">
              <icon-lucide-check-square class="w-4 h-4 mr-2" />
              Task
            </TabsTrigger>
            <TabsTrigger value="environment">
              <icon-lucide-server class="w-4 h-4 mr-2" />
              Environment
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <icon-lucide-book-open class="w-4 h-4 mr-2" />
              Knowledge
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <!-- 搜索和排序控制 -->
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
        <Button variant="ghost" size="icon" aria-label="刷新" title="刷新" @click="reload">
          <icon-lucide-refresh-ccw class="w-4 h-4" />
        </Button>
      </div>

      <div v-if="loading">加载中…</div>
      <div v-else-if="error" class="text-red-600">数据文件不可用：{{ error }}</div>
      <div v-else>
        <div v-if="items.length === 0" class="text-gray-500">
          {{ kindFilter
            ? `暂无 ${kindFilter === 'code' ? '代码' : kindFilter === 'task' ? '任务' : kindFilter === 'environment' ? '环境' : '知识'} 资源`
            : '暂无资源，等待钩子更新' }}
        </div>
        <div v-else class="rounded border bg-white">
          <template v-for="(it, idx) in items" :key="it.id">
            <WorkItemRow
              :item="it"
              @edit="handleEdit"
            />
            <ItemSeparator v-if="idx < items.length - 1" />
          </template>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <Dialog v-model:open="editorOpen">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{{ editingItemId ? '编辑条目' : '编辑 data/workitems.json' }}</DialogTitle>
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
  </div>
</template>

