<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'

interface NotifyItem {
  id: string
  title: string
  content?: string
  workitemId?: string
  createdAt?: string
}

const allItems = ref<NotifyItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const selectedIds = ref<Record<string, boolean>>({})
const keyword = ref('')

const hasSelection = computed(() => Object.values(selectedIds.value).some(Boolean))

const items = computed(() => {
  let result = [...allItems.value]
  // 应用关键词搜索
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    result = result.filter((it) =>
      [it.title, it.content, it.workitemId].some((f) => (f || '').toLowerCase().includes(k)),
    )
  }
  return result
})

async function loadNotify() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/__data/notify', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    allItems.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = (e as Error).message
    allItems.value = []
  } finally {
    loading.value = false
  }
}

async function postNotify(body: any) {
  const res = await fetch('/__data/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    const msg = (data && (data as any).message) ? (data as any).message : `HTTP ${res.status}`
    throw new Error(msg)
  }
}

async function clearAll() {
  if (!allItems.value.length) return
  if (!confirm('确定要将所有提醒标记为已完成并删除吗？')) return
  try {
    await postNotify({ action: 'clearAll' })
    allItems.value = []
    selectedIds.value = {}
    // 等待一小段时间确保服务器文件写入完成
    await new Promise(resolve => setTimeout(resolve, 150))
    // 通知侧边栏更新提醒数量
    if (import.meta.env.DEV) {
      console.log('[NotifyPage] 触发 notify-updated 事件 (clearAll)')
    }
    window.dispatchEvent(new CustomEvent('notify-updated'))
  } catch (e) {
    alert('清空失败：' + (e as Error).message)
  }
}

async function clearSelected() {
  const ids = Object.keys(selectedIds.value).filter((id) => selectedIds.value[id])
  if (!ids.length) return
  if (!confirm(`确定要删除选中的 ${ids.length} 条提醒吗？`)) return
  try {
    // 使用批量删除 API
    await postNotify({ action: 'removeByIds', ids })
    selectedIds.value = {}
    // 重新加载数据以确保同步
    await loadNotify()
    // 等待一小段时间确保服务器文件写入完成
    await new Promise(resolve => setTimeout(resolve, 150))
    // 通知侧边栏更新提醒数量
    if (import.meta.env.DEV) {
      console.log('[NotifyPage] 触发 notify-updated 事件 (clearSelected)')
    }
    window.dispatchEvent(new CustomEvent('notify-updated'))
  } catch (e) {
    alert('删除失败：' + (e as Error).message)
  }
}

function toggleSelectAll(checked: boolean) {
  if (checked) {
    const map: Record<string, boolean> = {}
    items.value.forEach((it) => { map[it.id] = true })
    selectedIds.value = map
  } else {
    selectedIds.value = {}
  }
}

const isSelectAll = computed(() => {
  if (items.value.length === 0) return false
  return items.value.every((it) => selectedIds.value[it.id])
})

const isSelectSome = computed(() => {
  const count = Object.values(selectedIds.value).filter(Boolean).length
  return count > 0 && count < items.value.length
})

onMounted(() => {
  loadNotify()
})
</script>

<template>
  <div class="flex-1 min-w-0 overflow-auto">
    <div class="max-w-7xl mx-auto p-8 pl-12">
      <!-- 页面标题和操作 -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Notify</h1>
          <p class="text-sm text-muted-foreground mt-1">查看和管理待办提醒</p>
        </div>
      </div>

      <!-- 搜索控制 -->
      <div class="mb-4 flex items-center gap-2">
        <Input v-model="keyword" placeholder="Filter tasks..." class="max-w-sm" />
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" @click="clearAll" :disabled="!allItems.length">
            全部标记已完成
          </Button>
          <Button variant="ghost" size="icon" aria-label="刷新" title="刷新" @click="loadNotify">
            <icon-lucide-refresh-ccw class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div v-if="loading">加载中…</div>
      <div v-else-if="error" class="text-red-600">加载失败：{{ error }}</div>
      <div v-else>
        <div v-if="items.length === 0" class="text-gray-500 text-center py-12">
          {{ keyword.trim() ? '暂无匹配的提醒' : '暂无提醒' }}
        </div>
        <div v-else class="rounded-md border w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12">
                  <Checkbox
                    :checked="isSelectAll ? true : (isSelectSome ? 'indeterminate' : false)"
                    @update:checked="toggleSelectAll"
                  />
                </TableHead>
                <TableHead class="w-[120px]">关联 WorkItem</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>内容</TableHead>
                <TableHead class="w-[160px]">创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="it in items" :key="it.id">
                <TableCell>
                  <Checkbox
                    :checked="selectedIds[it.id] === true"
                    @update:checked="(val) => { selectedIds[it.id] = !!val }"
                  />
                </TableCell>
                <TableCell>
                  <span v-if="it.workitemId" class="font-mono text-xs text-blue-600">
                    {{ it.workitemId }}
                  </span>
                  <span v-else class="text-xs text-muted-foreground">-</span>
                </TableCell>
                <TableCell class="font-medium">
                  {{ it.title || '提醒' }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ it.content || '-' }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  <span v-if="it.createdAt">
                    {{ new Date(it.createdAt).toLocaleString() }}
                  </span>
                  <span v-else>-</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div v-if="hasSelection" class="flex items-center justify-between px-2 py-4 border-t">
          <div class="text-sm text-muted-foreground">
            {{ Object.values(selectedIds).filter(Boolean).length }}/{{ items.length }} 个事项被选中.
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="clearSelected">
              删除选中
            </Button>
            <Button variant="outline" size="sm" @click="selectedIds = {}">
              取消选择
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


