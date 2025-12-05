<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWorkitems } from '@/composables/useWorkitems'
import type { WorkItem } from '@/types/workitem'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import DataFacetedFilter from '@/components/DataFacetedFilter.vue'

const { allItems, loading, error, reload, keyword } = useWorkitems()

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

  // 统计每个类型的数量（基于有记录的 workitems）
  const counts: Record<string, number> = {}
  for (const item of filtered) {
    if (!item.storage?.records || !Array.isArray(item.storage.records) || item.storage.records.length === 0) {
      continue
    }
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

// 记录类型定义
interface ActivityRecord {
  date: string // YYYYMMDD
  dateFormatted: string // YYYY-MM-DD
  workItem: WorkItem
  record: {
    content: string
    type?: string
    createdAt?: string
  }
}

// 从 content 中提取日期（YYYYMMDD 格式）
function extractDate(content: string): string | null {
  const match = content.match(/^(\d{8})/)
  if (!match) return null
  const dateStr = match[1]
  // 验证日期有效性
  const y = parseInt(dateStr.slice(0, 4), 10)
  const m = parseInt(dateStr.slice(4, 6), 10)
  const d = parseInt(dateStr.slice(6, 8), 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return dateStr
}

// 格式化日期显示
function formatDate(dateStr: string): string {
  const y = dateStr.slice(0, 4)
  const m = dateStr.slice(4, 6)
  const d = dateStr.slice(6, 8)
  return `${y}-${m}-${d}`
}

// 计算日期距离今天的天数（0 = 今天，1 = 昨天，...）
function daysFromToday(dateStr: string): number {
  const y = parseInt(dateStr.slice(0, 4), 10)
  const m = parseInt(dateStr.slice(4, 6), 10) - 1
  const d = parseInt(dateStr.slice(6, 8), 10)
  const recordDate = new Date(y, m, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  recordDate.setHours(0, 0, 0, 0)
  const diffTime = today.getTime() - recordDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// 处理记录数据，按日期分组
const groupedRecords = computed(() => {
  const records: ActivityRecord[] = []

  // 遍历所有 workitems，提取 records
  for (const item of allItems.value) {
    // 按类别筛选（多选）
    if (selectedKindFilters.value.length > 0) {
      if (!item.kind || !selectedKindFilters.value.includes(item.kind)) continue
    }

    if (!item.storage?.records || !Array.isArray(item.storage.records)) continue

    for (const record of item.storage.records) {
      if (!record.content) continue
      const dateStr = extractDate(record.content)
      if (!dateStr) continue

      // 只保留最近 10 天的记录（今天 + 过去 9 天 = 10 天）
      const daysDiff = daysFromToday(dateStr)
      if (daysDiff < 0 || daysDiff >= 10) continue // 0-9 天，共 10 天

      records.push({
        date: dateStr,
        dateFormatted: formatDate(dateStr),
        workItem: item,
        record: {
          content: record.content,
          type: record.type,
          createdAt: record.createdAt,
        },
      })
    }
  }

  // 按日期分组
  const grouped: Record<string, ActivityRecord[]> = {}
  for (const record of records) {
    if (!grouped[record.date]) {
      grouped[record.date] = []
    }
    grouped[record.date].push(record)
  }

  // 转换为数组，按日期倒序排列（最新的在前）
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return sortedDates.map((date) => ({
    date,
    dateFormatted: formatDate(date),
    records: grouped[date],
  }))
})

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
      <!-- 页面标题 -->
      <div class="mb-6">
        <h1 class="text-2xl font-semibold">Activity</h1>
        <p class="text-sm text-muted-foreground mt-1">变更记录（最近 10 天）</p>
      </div>

      <!-- 筛选控制 -->
      <div class="mb-4 flex items-center gap-2">
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
        <div v-if="groupedRecords.length === 0" class="text-gray-500 text-center py-12">暂无变更记录</div>
        <div v-else class="rounded-md border w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[100px]">日期</TableHead>
                <TableHead class="w-[80px]">时间</TableHead>
                <TableHead class="w-[120px]">工作项ID</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="group in groupedRecords" :key="group.date">
                <TableRow v-for="(activity, idx) in group.records" :key="`${activity.workItem.id}-${idx}`">
                  <TableCell class="font-medium">
                    {{ idx === 0 ? group.dateFormatted : '' }}
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    <span v-if="activity.record.createdAt">
                      {{ new Date(activity.record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
                    </span>
                    <span v-else>--:--</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm font-medium text-blue-600">{{ activity.workItem.id }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm text-muted-foreground">{{ activity.workItem.title }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm text-foreground">{{ activity.record.content }}</span>
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </div>
</template>

