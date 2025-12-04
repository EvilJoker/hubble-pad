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

// 添加记录相关状态
const recordDialogOpen = ref(false)
const recordContent = ref('')
const recordItemId = ref<string | null>(null)
const recordItemTitle = ref('')
const recordError = ref<string | null>(null)
const addingRecord = ref(false)

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

async function handleDelete(item: { id: string; title?: string }) {
  const name = item.title || item.id
  const ok = window.confirm(`确定要删除该条目吗？\n\n${name}`)
  if (!ok) return

  try {
    const res = await fetch(`/__data/delete/${encodeURIComponent(item.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json().catch(() => ({ ok: false }))
    if (!res.ok || !data.ok) {
      const msg = (data && (data as any).message) ? (data as any).message : `HTTP ${res.status}`
      alert('删除失败：' + msg)
      return
    }
    // 删除成功后刷新列表
    await reload()
    window.dispatchEvent(new CustomEvent('workitems-updated'))
  } catch (e) {
    const msg = (e as Error).message
    alert('删除失败：' + msg)
  }
}

function closeRecordDialog() {
  recordDialogOpen.value = false
  recordContent.value = ''
  recordItemId.value = null
  recordItemTitle.value = ''
  recordError.value = null
}

function handleAddRecord(item: { id: string; title?: string }) {
  recordItemId.value = item.id
  recordItemTitle.value = item.title || item.id || ''
  recordContent.value = '' // 使用空值，让 placeholder 显示
  recordError.value = null
  recordDialogOpen.value = true
}

// 工具函数：生成当前日期的 YYYYMMDD 格式
function getCurrentDatePrefix(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

// 工具函数：验证日期前缀是否有效（YYYYMMDD 格式且为有效日期）
function isValidDatePrefix(str: string): boolean {
  if (!/^\d{8}/.test(str)) return false
  const y = parseInt(str.slice(0, 4), 10)
  const m = parseInt(str.slice(4, 6), 10)
  const d = parseInt(str.slice(6, 8), 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function getRecordPlaceholder(): string {
  const datePrefix = getCurrentDatePrefix()
  const defaultLabel = recordItemTitle.value || ''
  return `${datePrefix} <内容>（必须以 YYYYMMDD 开头，且不少于 20 个字）`
}

async function saveRecord() {
  if (addingRecord.value) return

  const value = recordContent.value.trim()
  recordError.value = null

  // 格式校验
  if (value.length < 20) {
    recordError.value = '格式错误：内容总长度不少于 20 个字符。'
    return
  }
  if (value.length > 500) {
    recordError.value = '格式错误：内容总长度不能超过 500 个字符。'
    return
  }
  if (!isValidDatePrefix(value)) {
    recordError.value = '格式错误：内容必须以有效的 8 位日期（YYYYMMDD）开头。'
    return
  }

  if (!recordItemId.value) {
    recordError.value = '错误：缺少工作项 ID'
    return
  }

  addingRecord.value = true
  try {
    const res = await fetch(`/__data/add-record/${encodeURIComponent(recordItemId.value)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record: {
          content: value,
          type: 'manual',
        },
      }),
    })
    const data = await res.json().catch(() => ({ ok: false }))
    if (!res.ok || !data.ok) {
      const msg = (data && (data as any).message) ? (data as any).message : `HTTP ${res.status}`
      recordError.value = '添加记录失败：' + msg
      return
    }
    // 添加记录成功后关闭对话框并刷新
    closeRecordDialog()
    await reload()
    window.dispatchEvent(new CustomEvent('workitems-updated'))
  } catch (e) {
    const msg = (e as Error).message
    recordError.value = '添加记录失败：' + msg
  } finally {
    addingRecord.value = false
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
              :index="idx"
              @edit="handleEdit"
              @delete="handleDelete"
              @add-record="handleAddRecord"
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

    <!-- 添加记录对话框 -->
    <Dialog v-model:open="recordDialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>更新进展 - {{ recordItemTitle }}</DialogTitle>
        </DialogHeader>
        <div>
          <Textarea
            v-model="recordContent"
            :placeholder="getRecordPlaceholder()"
            class="min-h-32"
            :maxlength="500"
          />
          <p v-if="recordError" class="text-red-600 mt-2 text-sm">{{ recordError }}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="closeRecordDialog">取消</Button>
          <Button type="button" @click="saveRecord" :disabled="addingRecord">
            {{ addingRecord ? '保存中…' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

