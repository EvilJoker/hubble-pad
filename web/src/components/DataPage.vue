<script setup lang="ts">
import { useWorkitems } from '@/composables/useWorkitems'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import DataFacetedFilter from '@/components/DataFacetedFilter.vue'
import type { WorkItem } from '@/types/workitem'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const { items: allItems, loading, error, keyword, reload } = useWorkitems()

// 排序相关
type DataSortKey = 'title' | 'description' | 'kind' | null
type DataSortOrder = 'asc' | 'desc' | null

const dataSortKey = ref<DataSortKey>(null)
const dataSortOrder = ref<DataSortOrder>(null)

// 类型筛选（多选）
const selectedKindFilters = ref<string[]>([])

// 计算每个类型的数量（基于应用关键词搜索后的数据，但不包括类型筛选）
const kindOptions = computed(() => {
  // 先应用关键词搜索（但不应用类型筛选）
  let filtered = [...allItems.value]
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    filtered = filtered.filter((it) =>
      [it.title, it.description].some((f) => (f || '').toLowerCase().includes(k)),
    )
  }

  // 统计每个类型的数量
  const counts: Record<string, number> = {}
  for (const item of filtered) {
    const kind = item.kind
    if (!kind) continue
    counts[kind] = (counts[kind] || 0) + 1
  }

  return [
    { label: 'Code', value: 'code', count: counts.code || 0 },
    { label: 'Task', value: 'task', count: counts.task || 0 },
    { label: 'Environment', value: 'environment', count: counts.environment || 0 },
    { label: 'Knowledge', value: 'knowledge', count: counts.knowledge || 0 },
  ]
})

// 行选择
const rowSelection = ref<Record<string, boolean>>({})
const isSelectAll = computed(() => {
  if (items.value.length === 0) return false
  return items.value.every((item) => rowSelection.value[item.id])
})
const isSelectSome = computed(() => {
  const count = Object.values(rowSelection.value).filter(Boolean).length
  return count > 0 && count < items.value.length
})
const selectedCount = computed(() => {
  return Object.values(rowSelection.value).filter(Boolean).length
})

function toggleSelectAll(checked: boolean) {
  if (checked) {
    items.value.forEach((item) => {
      rowSelection.value[item.id] = true
    })
  } else {
    items.value.forEach((item) => {
      delete rowSelection.value[item.id]
    })
  }
}

function toggleRowSelection(itemId: string, checked: boolean) {
  if (checked) {
    rowSelection.value[itemId] = true
  } else {
    delete rowSelection.value[itemId]
  }
}

// 排序后的列表（收藏始终排在前面）
const items = computed(() => {
  let result = [...allItems.value]

  // 应用类型筛选（多选）
  if (selectedKindFilters.value.length > 0) {
    const set = new Set(selectedKindFilters.value)
    result = result.filter((it) => it.kind && set.has(it.kind))
  }

  // 应用关键词搜索
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    result = result.filter((it) =>
      [it.title, it.description].some((f) => (f || '').toLowerCase().includes(k)),
    )
  }

  // 应用排序（先整体排序，再按收藏拆分，以保证收藏/非收藏各自内部仍按当前排序）
  if (dataSortKey.value && dataSortOrder.value) {
    result.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (dataSortKey.value) {
        case 'title':
          aVal = (a.title || '').toLowerCase()
          bVal = (b.title || '').toLowerCase()
          break
        case 'description':
          aVal = (a.description || '').toLowerCase()
          bVal = (b.description || '').toLowerCase()
          break
        case 'kind':
          aVal = (a.kind || '').toLowerCase()
          bVal = (b.kind || '').toLowerCase()
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal)
        return dataSortOrder.value === 'asc' ? comparison : -comparison
      } else {
        const comparison = aVal - bVal
        return dataSortOrder.value === 'asc' ? comparison : -comparison
      }
    })
  }

  // 收藏始终排在前面：按收藏状态分组，但保留各自内部的相对顺序
  const favorites: typeof result = []
  const others: typeof result = []
  for (const it of result) {
    const isFavorite = favoriteStates.value.get(it.id) === true || it.favorite === true
    if (isFavorite) {
      favorites.push(it)
    } else {
      others.push(it)
    }
  }

  return [...favorites, ...others]
})

function handleDataSort(key: DataSortKey) {
  if (dataSortKey.value === key) {
    // 切换排序顺序：asc -> desc -> null
    if (dataSortOrder.value === 'asc') {
      dataSortOrder.value = 'desc'
    } else if (dataSortOrder.value === 'desc') {
      dataSortKey.value = null
      dataSortOrder.value = null
    }
  } else {
    dataSortKey.value = key
    dataSortOrder.value = 'asc'
  }
}

function getKindLabel(kind?: string): string {
  switch (kind) {
    case 'code':
      return 'Code'
    case 'task':
      return 'Task'
    case 'environment':
      return 'Environment'
    case 'knowledge':
      return 'Knowledge'
    default:
      return '-'
  }
}

function getKindColor(kind?: string): string {
  switch (kind) {
    case 'code':
      return 'bg-blue-100 text-blue-700'
    case 'task':
      return 'bg-green-100 text-green-700'
    case 'environment':
      return 'bg-purple-100 text-purple-700'
    case 'knowledge':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

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

// 收藏状态管理
const favoriteStates = ref<Map<string, boolean>>(new Map())
const togglingFavorites = ref<Set<string>>(new Set())

// 初始化收藏状态
watch(allItems, (newItems) => {
  newItems.forEach((item) => {
    favoriteStates.value.set(item.id, item.favorite === true)
  })
}, { immediate: true })

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

async function toggleFavorite(item: WorkItem) {
  if (togglingFavorites.value.has(item.id)) return
  togglingFavorites.value.add(item.id)

  const currentFavorite = favoriteStates.value.get(item.id) || false
  const newFavorite = !currentFavorite

  try {
    const res = await fetch(`/__data/toggle-favorite/${encodeURIComponent(item.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: newFavorite })
    })
    if (res.ok) {
      favoriteStates.value.set(item.id, newFavorite)
      window.dispatchEvent(new CustomEvent('workitems-updated'))
    } else {
      const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      console.error('Failed to toggle favorite:', errorData.message || 'Unknown error')
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
  } finally {
    togglingFavorites.value.delete(item.id)
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


      <!-- 搜索和筛选控制 -->
      <div class="mb-4 flex items-center gap-2">
        <Input v-model="keyword" placeholder="Filter tasks..." class="max-w-sm" />
        <DataFacetedFilter
          title="类型"
          :options="kindOptions"
          v-model="selectedKindFilters"
        />
        <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="刷新" title="刷新" @click="reload">
          <icon-lucide-refresh-ccw class="w-4 h-4" />
        </Button>
        </div>
      </div>

      <div v-if="loading">加载中…</div>
      <div v-else-if="error" class="text-red-600">数据文件不可用：{{ error }}</div>
      <div v-else>
        <div v-if="items.length === 0" class="text-gray-500 text-center py-12">
          {{ selectedKindFilters.length > 0 ? '暂无匹配的资源' : '暂无资源，等待钩子更新' }}
        </div>
        <div v-else class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12">
                  <Checkbox
                    :checked="isSelectAll ? true : (isSelectSome ? 'indeterminate' : false)"
                    @update:checked="toggleSelectAll"
                  />
                </TableHead>
                <TableHead class="w-[50px]">#</TableHead>
                <TableHead>
                  <button
                    class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                    @click="handleDataSort('title')"
                  >
                    标题
                    <icon-lucide-arrow-up-down
                      v-if="dataSortKey !== 'title'"
                      class="h-4 w-4 text-muted-foreground opacity-50"
                    />
                    <icon-lucide-arrow-up
                      v-else-if="dataSortOrder === 'asc'"
                      class="h-4 w-4"
                    />
                    <icon-lucide-arrow-down
                      v-else-if="dataSortOrder === 'desc'"
                      class="h-4 w-4"
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                    @click="handleDataSort('description')"
                  >
                    描述
                    <icon-lucide-arrow-up-down
                      v-if="dataSortKey !== 'description'"
                      class="h-4 w-4 text-muted-foreground opacity-50"
                    />
                    <icon-lucide-arrow-up
                      v-else-if="dataSortOrder === 'asc'"
                      class="h-4 w-4"
                    />
                    <icon-lucide-arrow-down
                      v-else-if="dataSortOrder === 'desc'"
                      class="h-4 w-4"
                    />
                  </button>
                </TableHead>
                <TableHead class="w-[120px]">
                  <button
                    class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                    @click="handleDataSort('kind')"
                  >
                    类型
                    <icon-lucide-arrow-up-down
                      v-if="dataSortKey !== 'kind'"
                      class="h-4 w-4 text-muted-foreground opacity-50"
                    />
                    <icon-lucide-arrow-up
                      v-else-if="dataSortOrder === 'asc'"
                      class="h-4 w-4"
                    />
                    <icon-lucide-arrow-down
                      v-else-if="dataSortOrder === 'desc'"
                      class="h-4 w-4"
                    />
                  </button>
                </TableHead>
                <TableHead class="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(it, idx) in items" :key="it.id">
                <TableCell>
                  <Checkbox
                    :checked="!!rowSelection[it.id]"
                    @update:checked="(checked) => toggleRowSelection(it.id, checked)"
                  />
                </TableCell>
                <TableCell class="text-muted-foreground">{{ idx + 1 }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <button
                            class="flex items-center gap-1"
                            :disabled="togglingFavorites.has(it.id)"
                            @click="toggleFavorite(it)"
                          >
                            <icon-lucide-star
                              :class="[
                                'h-4 w-4 flex-shrink-0',
                                favoriteStates.get(it.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                              ]"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {{ favoriteStates.get(it.id) ? '取消收藏' : '收藏' }}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span class="font-medium" :title="it.title">{{ it.title }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span class="text-sm text-muted-foreground" :title="it.description">{{ it.description || '-' }}</span>
                </TableCell>
                <TableCell>
                  <span v-if="it.kind" :class="['px-2 py-0.5 rounded text-xs font-medium', getKindColor(it.kind)]">
                    {{ it.kind }}
                  </span>
                  <span v-else class="text-sm text-muted-foreground">-</span>
                </TableCell>
                <TableCell class="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                        <icon-lucide-more-horizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="() => handleEdit(it)">
                        <icon-lucide-pencil class="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <a
                          v-if="it.url"
                          :href="it.url"
                          target="_blank"
                          rel="noreferrer"
                          class="flex items-center w-full"
                        >
                          <icon-lucide-external-link class="mr-2 h-4 w-4" />
                          打开链接
                        </a>
                        <span v-else class="flex items-center text-muted-foreground">
                          <icon-lucide-external-link class="mr-2 h-4 w-4" />
                          无链接
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="() => handleAddRecord(it)">
                        <icon-lucide-clipboard-plus class="mr-2 h-4 w-4" />
                        更新进展
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="() => handleDelete(it)" class="text-red-600">
                        <icon-lucide-trash-2 class="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <!-- 选择计数和批量操作 -->
        <div v-if="selectedCount > 0" class="flex items-center justify-between px-2 py-4 border-t">
          <div class="text-sm text-muted-foreground">
            {{ selectedCount }} of {{ items.length }} row(s) selected.
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="() => {
                const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id])
                if (confirm(`确定要删除选中的 ${selectedIds.length} 个条目吗？`)) {
                  selectedIds.forEach(id => handleDelete({ id }))
                  rowSelection = {}
                }
              }"
            >
              <icon-lucide-trash-2 class="w-4 h-4 mr-2" />
              删除选中
            </Button>
            <Button variant="outline" size="sm" @click="rowSelection = {}">
              取消选择
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑对话框（自定义实现，避免第三方 Dialog 遮罩层干扰） -->
    <div
      v-if="editorOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="() => { editorOpen = false; editingItemId = null; saveError = null }"
    >
      <div class="bg-background rounded-lg border shadow-lg w-full max-w-3xl p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">
            {{ editingItemId ? '编辑条目' : '编辑 data/workitems.json' }}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{
              editingItemId
                ? '编辑工作项的 JSON 数据。修改后点击保存按钮保存更改。'
                : '编辑整个工作项数据文件。修改后点击保存按钮保存更改。'
            }}
          </p>
        </div>
        <div>
          <Textarea v-model="editorText" class="h-80 font-mono text-sm" />
          <p v-if="saveError" class="text-red-600 mt-2">{{ saveError }}</p>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" @click="() => { editorOpen = false; editingItemId = null; saveError = null }">
            取消
          </Button>
          <Button type="button" @click="saveEditor" :disabled="saving">
            {{ saving ? '保存中…' : '保存' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- 添加记录对话框（自定义实现） -->
    <div
      v-if="recordDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="closeRecordDialog"
    >
      <div class="bg-background rounded-lg border shadow-lg w-full max-w-2xl p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">更新进展 - {{ recordItemTitle }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            添加工作项的进展记录。格式：以日期开头（YYYYMMDD），内容总长度 20-500 字符。
          </p>
        </div>
        <div>
          <Textarea
            v-model="recordContent"
            :placeholder="getRecordPlaceholder()"
            class="min-h-32"
            :maxlength="500"
          />
          <p v-if="recordError" class="text-red-600 mt-2 text-sm">{{ recordError }}</p>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" @click="closeRecordDialog">
            取消
          </Button>
          <Button type="button" @click="saveRecord" :disabled="addingRecord">
            {{ addingRecord ? '保存中…' : '保存' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
