<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
// 移除 Dialog 组件，使用自定义模态框避免遮蔽问题
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { useHooks, type HookItem } from '@/composables/useHooks'

const { hooks: hooksData, load: loadHooks } = useHooks()

// 排序相关
type SortKey = 'name' | 'status' | 'type' | 'lastRunAt' | null
type SortOrder = 'asc' | 'desc' | null

const sortKey = ref<SortKey>(null)
const sortOrder = ref<SortOrder>(null)

// 计算任务状态
function getTaskStatus(hook: HookItem): { label: string; color: string; icon: string } {
  if (runningNames.value.has(hook.name || '')) {
    return { label: '运行中', color: 'bg-blue-100 text-blue-700', icon: 'loader-2' }
  }
  if (hook.lastError) {
    return { label: '失败', color: 'bg-red-100 text-red-700', icon: 'x-circle' }
  }
  if (hook.lastRunAt) {
    return { label: '已完成', color: 'bg-green-100 text-green-700', icon: 'check-circle' }
  }
  return { label: '待执行', color: 'bg-gray-100 text-gray-700', icon: 'circle' }
}

const keyword = ref('')

// 行选择
const rowSelection = ref<Record<string, boolean>>({})

// 排序后的任务列表
const hooks = computed(() => {
  let result = [...hooksData.value]

  // 应用关键词搜索
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    result = result.filter((it) =>
      [it.name, it.desc].some((f) => (f || '').toLowerCase().includes(k)),
    )
  }

  if (!sortKey.value || !sortOrder.value) {
    return result
  }

  result.sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sortKey.value) {
      case 'name':
        aVal = (a.name || '').toLowerCase()
        bVal = (b.name || '').toLowerCase()
        break
      case 'status':
        aVal = getTaskStatus(a).label
        bVal = getTaskStatus(b).label
        break
      case 'type':
        aVal = getTypeLabel(a.type) || ''
        bVal = getTypeLabel(b.type) || ''
        break
      case 'lastRunAt':
        aVal = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0
        bVal = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0
        break
      default:
        return 0
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const comparison = aVal.localeCompare(bVal)
      return sortOrder.value === 'asc' ? comparison : -comparison
    } else {
      const comparison = aVal - bVal
      return sortOrder.value === 'asc' ? comparison : -comparison
    }
  })

  return result
})

const isSelectAll = computed(() => {
  if (hooks.value.length === 0) return false
  return hooks.value.every((item) => item.name && rowSelection.value[item.name])
})
const isSelectSome = computed(() => {
  const count = Object.values(rowSelection.value).filter(Boolean).length
  return count > 0 && count < hooks.value.length
})
const selectedCount = computed(() => {
  return Object.values(rowSelection.value).filter(Boolean).length
})

function toggleSelectAll(checked: boolean) {
  if (checked) {
    hooks.value.forEach((item) => {
      if (item.name) {
        rowSelection.value[item.name] = true
      }
    })
  } else {
    hooks.value.forEach((item) => {
      if (item.name) {
        delete rowSelection.value[item.name]
      }
    })
  }
}

function toggleRowSelection(itemName: string, checked: boolean) {
  if (checked) {
    rowSelection.value[itemName] = true
  } else {
    delete rowSelection.value[itemName]
  }
}

function handleSort(key: SortKey) {
  if (sortKey.value === key) {
    // 切换排序顺序：asc -> desc -> null
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc'
    } else if (sortOrder.value === 'desc') {
      sortKey.value = null
      sortOrder.value = null
    }
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

// 编辑相关状态
const hooksEditorOpen = ref(false)
const hooksEditorText = ref('')
const savingHooks = ref(false)

// 新增任务对话框
const addTaskDialogOpen = ref(false)
const newTask = ref<Partial<HookItem>>({
  name: '',
  desc: '',
  cmd: '',
  cwd: './',
  enabled: true,
  type: 'update',
  schedule: undefined,
})

// 编辑任务对话框
const editTaskDialogOpen = ref(false)
const editingTaskName = ref<string | null>(null)
const editTask = ref<Partial<HookItem>>({
  name: '',
  desc: '',
  cmd: '',
  cwd: './',
  enabled: true,
  type: 'update',
  schedule: undefined,
})

// 运行中状态
const runningNames = ref<Set<string>>(new Set())

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

function openAddTaskDialog() {
  newTask.value = {
    name: '',
    desc: '',
    cmd: '',
    cwd: './',
    enabled: true,
    type: 'update',
    schedule: undefined,
  }
  addTaskDialogOpen.value = true
}

async function saveNewTask() {
  if (!newTask.value.name || !newTask.value.cmd) {
    alert('请填写任务名称和命令')
    return
  }

  try {
    const current = Array.isArray(hooks.value) ? hooks.value : []
    const updated = [
      ...current,
      {
        name: newTask.value.name,
        desc: newTask.value.desc || '',
        cmd: newTask.value.cmd,
        cwd: newTask.value.cwd || './',
        enabled: newTask.value.enabled ?? true,
        type: newTask.value.type || 'update',
        schedule: newTask.value.schedule || undefined,
        lastRunAt: null,
        lastError: null,
      },
    ]
    const res = await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    const result = await res.json()
    if (!res.ok || !result.ok) {
      throw new Error(result.message || '保存失败')
    }
    addTaskDialogOpen.value = false
    await loadHooks()
  } catch (e) {
    alert('添加任务失败: ' + (e as Error).message)
  }
}

function openEditTaskDialog(hook: HookItem) {
  editingTaskName.value = hook.name
  editTask.value = {
    name: hook.name,
    desc: hook.desc || '',
    cmd: hook.cmd,
    cwd: hook.cwd || './',
    enabled: hook.enabled ?? true,
    type: hook.type || 'update',
    schedule: hook.schedule || undefined,
  }
  editTaskDialogOpen.value = true
}

async function saveEditTask() {
  if (!editTask.value.name || !editTask.value.cmd || !editingTaskName.value) {
    alert('请填写任务名称和命令')
    return
  }

  try {
    const current = Array.isArray(hooks.value) ? hooks.value : []
    const updated = current.map((h) => {
      if (h && h.name === editingTaskName.value) {
        return {
          ...h,
          name: editTask.value.name,
          desc: editTask.value.desc || '',
          cmd: editTask.value.cmd,
          cwd: editTask.value.cwd || './',
          enabled: editTask.value.enabled ?? true,
          type: editTask.value.type || 'update',
          schedule: editTask.value.schedule || undefined,
        }
      }
      return h
    })
    const res = await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    const result = await res.json()
    if (!res.ok || !result.ok) {
      throw new Error(result.message || '保存失败')
    }
    editTaskDialogOpen.value = false
    editingTaskName.value = null
    await loadHooks()
  } catch (e) {
    alert('保存任务失败: ' + (e as Error).message)
  }
}

async function handleDeleteTask(name: string | undefined) {
  if (!name) return
  const ok = window.confirm(`确定要删除任务 "${name}" 吗？`)
  if (!ok) return

  try {
    const current = Array.isArray(hooks.value) ? hooks.value : []
    const updated = current.filter((h) => h && h.name !== name)
    await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    await loadHooks()
    delete rowSelection.value[name]
  } catch (e) {
    alert('删除任务失败: ' + (e as Error).message)
  }
}

async function deleteSelectedTasks() {
  const selectedNames = Object.keys(rowSelection.value).filter((n) => rowSelection.value[n])
  if (!selectedNames.length) return
  const ok = window.confirm(`确定要删除选中的 ${selectedNames.length} 个任务吗？`)
  if (!ok) return

  try {
    const current = Array.isArray(hooks.value) ? hooks.value : []
    const namesToDelete = new Set(selectedNames)
    const updated = current.filter((h) => !h || !h.name || !namesToDelete.has(h.name))
    await fetch('/__hooks/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    rowSelection.value = {}
    await loadHooks()
  } catch (e) {
    alert('删除任务失败: ' + (e as Error).message)
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
    const j = await res.json().catch(() => ({ ok: false, message: '无法解析服务器响应' }))
    console.log('[hooks][client] run-one result:', j)

    if (!res.ok || !j.ok) {
      // 构建详细的错误信息
      let errorMsg = j.message || j.error || '运行失败'
      if (j.stderr) {
        errorMsg += `\n\n详细错误信息：\n${j.stderr}`
      }
      alert(`任务 "${name}" 执行失败：\n${errorMsg}`)
    } else {
      // 成功时显示简要信息（可选）
      const count = j.count || j.items?.length || 0
      if (count > 0) {
        console.log(`任务 "${name}" 执行成功，处理了 ${count} 项`)
      }
      // 通知侧边栏更新提醒数量（任务可能生成了新的提醒）
      window.dispatchEvent(new CustomEvent('notify-updated'))
    }

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

function getTypeLabel(type?: string): string {
  switch (type) {
    case 'update':
      return '更新信息'
    case 'auto':
      return '自动化'
    default:
      return '未分类'
  }
}

function getTypeColor(type?: string): string {
  switch (type) {
    case 'update':
      return 'bg-blue-100 text-blue-700'
    case 'auto':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-700'
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
      </div>

      <!-- 搜索控制 -->
      <div class="mb-4 flex items-center gap-2">
        <Input v-model="keyword" placeholder="Filter tasks..." class="max-w-sm" />
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" @click="openAddTaskDialog">
            <icon-lucide-plus class="w-4 h-4 mr-2" />
            新增任务
          </Button>
          <Button variant="outline" size="sm" @click="openHooksEditor">
            <icon-lucide-pencil class="w-4 h-4 mr-2" />
            编辑
          </Button>
          <Button variant="ghost" size="icon" aria-label="刷新" title="刷新" @click="loadHooks">
            <icon-lucide-refresh-ccw class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- 任务列表 - 使用表格布局 -->
      <div v-if="hooks.length === 0" class="text-gray-500 text-center py-12">
        {{ keyword.trim() ? '暂无匹配的任务' : '暂无任务，点击"新增任务"添加任务' }}
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
              <TableHead class="w-[100px]">
                <button
                  class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                  @click="handleSort('name')"
                >
                  任务名称
                  <icon-lucide-arrow-up-down
                    v-if="sortKey !== 'name'"
                    class="h-4 w-4 text-muted-foreground opacity-50"
                  />
                  <icon-lucide-arrow-up
                    v-else-if="sortOrder === 'asc'"
                    class="h-4 w-4"
                  />
                  <icon-lucide-arrow-down
                    v-else-if="sortOrder === 'desc'"
                    class="h-4 w-4"
                  />
                </button>
              </TableHead>
              <TableHead>描述</TableHead>
              <TableHead class="w-[120px]">
                <button
                  class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                  @click="handleSort('type')"
                >
                  类型
                  <icon-lucide-arrow-up-down
                    v-if="sortKey !== 'type'"
                    class="h-4 w-4 text-muted-foreground opacity-50"
                  />
                  <icon-lucide-arrow-up
                    v-else-if="sortOrder === 'asc'"
                    class="h-4 w-4"
                  />
                  <icon-lucide-arrow-down
                    v-else-if="sortOrder === 'desc'"
                    class="h-4 w-4"
                  />
                </button>
              </TableHead>
              <TableHead class="w-[150px]">定时设置</TableHead>
              <TableHead class="w-[100px]">
                <button
                  class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                  @click="handleSort('status')"
                >
                  状态
                  <icon-lucide-arrow-up-down
                    v-if="sortKey !== 'status'"
                    class="h-4 w-4 text-muted-foreground opacity-50"
                  />
                  <icon-lucide-arrow-up
                    v-else-if="sortOrder === 'asc'"
                    class="h-4 w-4"
                  />
                  <icon-lucide-arrow-down
                    v-else-if="sortOrder === 'desc'"
                    class="h-4 w-4"
                  />
                </button>
              </TableHead>
              <TableHead class="w-[100px]">启用</TableHead>
              <TableHead class="w-[150px]">
                <button
                  class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                  @click="handleSort('lastRunAt')"
                >
                  最后运行
                  <icon-lucide-arrow-up-down
                    v-if="sortKey !== 'lastRunAt'"
                    class="h-4 w-4 text-muted-foreground opacity-50"
                  />
                  <icon-lucide-arrow-up
                    v-else-if="sortOrder === 'asc'"
                    class="h-4 w-4"
                  />
                  <icon-lucide-arrow-down
                    v-else-if="sortOrder === 'desc'"
                    class="h-4 w-4"
                  />
                </button>
              </TableHead>
              <TableHead class="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="h in hooks" :key="h.name">
              <TableCell>
                <Checkbox
                  :checked="h.name ? rowSelection[h.name] === true : false"
                  @update:checked="(val) => h.name && toggleRowSelection(h.name, !!val)"
                />
              </TableCell>
              <TableCell class="font-medium">{{ h.name }}</TableCell>
              <TableCell>
                <div class="max-w-[500px]">
                  <p class="truncate">{{ h.desc || '-' }}</p>
                  <p v-if="h.lastError" class="text-xs text-red-600 mt-1 truncate">错误：{{ h.lastError }}</p>
                </div>
              </TableCell>
              <TableCell>
                <span :class="['px-2 py-0.5 rounded text-xs font-medium', getTypeColor(h.type)]">
                  {{ getTypeLabel(h.type) }}
                </span>
              </TableCell>
              <TableCell>
                <span v-if="h.schedule" class="text-sm text-muted-foreground">{{ h.schedule }}</span>
                <span v-else class="text-sm text-muted-foreground">-</span>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <icon-lucide-loader-2
                    v-if="getTaskStatus(h).icon === 'loader-2'"
                    class="h-4 w-4 flex-shrink-0 animate-spin text-blue-600"
                  />
                  <icon-lucide-x-circle
                    v-else-if="getTaskStatus(h).icon === 'x-circle'"
                    class="h-4 w-4 flex-shrink-0 text-red-600"
                  />
                  <icon-lucide-check-circle
                    v-else-if="getTaskStatus(h).icon === 'check-circle'"
                    class="h-4 w-4 flex-shrink-0 text-green-600"
                  />
                  <icon-lucide-circle
                    v-else
                    class="h-4 w-4 flex-shrink-0 text-gray-400"
                  />
                  <span :class="['px-2 py-0.5 rounded text-xs font-medium flex-shrink-0', getTaskStatus(h).color]">
                    {{ getTaskStatus(h).label }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Switch :checked="h.enabled" @update:checked="(val) => toggleHookEnabled(h.name, val)" />
              </TableCell>
              <TableCell>
                <span v-if="h.lastRunAt" class="text-sm text-muted-foreground">
                  {{ new Date(h.lastRunAt).toLocaleString() }}
                </span>
                <span v-else class="text-sm text-muted-foreground">-</span>
              </TableCell>
              <TableCell class="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger :as-child="true">
                    <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                      <icon-lucide-more-horizontal class="h-4 w-4" />
                </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="() => handleRunHookByName(h.name)" :disabled="runningNames.has(h.name || '')">
                      <icon-lucide-loader-2 v-if="runningNames.has(h.name || '')" class="mr-2 h-4 w-4 animate-spin" />
                      <icon-lucide-play v-else class="mr-2 h-4 w-4" />
                      运行
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="() => openEditTaskDialog(h)">
                      <icon-lucide-pencil class="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="() => handleDeleteTask(h.name)" class="text-red-600">
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

      <!-- 选中项操作栏 -->
      <div v-if="selectedCount > 0" class="flex items-center justify-between px-2 py-4 border-t">
        <div class="text-sm text-muted-foreground">
          {{ selectedCount }}/{{ hooks.length }} 个事项被选中.
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="deleteSelectedTasks">
            删除选中
          </Button>
          <Button variant="outline" size="sm" @click="rowSelection = {}">
            取消选择
                </Button>
              </div>
      </div>
    </div>

    <!-- 编辑对话框（自定义实现，避免第三方 Dialog 遮罩层干扰） -->
    <div
      v-if="hooksEditorOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="hooksEditorOpen = false"
    >
      <div class="bg-background rounded-lg border shadow-lg w-full max-w-3xl p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">编辑 data/hooks.json</h2>
        </div>
        <div>
          <Textarea v-model="hooksEditorText" class="h-80 font-mono text-sm" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" @click="hooksEditorOpen = false">取消</Button>
          <Button type="button" @click="saveHooks" :disabled="savingHooks">{{ savingHooks ? '保存中…' : '保存' }}</Button>
        </div>
      </div>
    </div>

    <!-- 新增任务对话框（自定义实现，避免第三方 Dialog 遮罩层干扰） -->
    <div
      v-if="addTaskDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="addTaskDialogOpen = false"
    >
      <div class="bg-background rounded-lg border shadow-lg w-full max-w-2xl p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">新增任务</h2>
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">任务名称 *</label>
            <Input v-model="newTask.name" placeholder="例如：fetch-rdc" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">任务描述</label>
            <Input v-model="newTask.desc" placeholder="例如：拉取 RDC 工作项" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">任务类型</label>
            <Select v-model="newTask.type">
              <SelectTrigger>
                <SelectValue placeholder="选择任务类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">更新信息类</SelectItem>
                <SelectItem value="auto">自动化类</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">执行命令 *</label>
            <Input v-model="newTask.cmd" placeholder="例如：python data/hook/rdc_export/get_rdc_workitems.py" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">工作目录</label>
            <Input v-model="newTask.cwd" placeholder="例如：./" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">定时设置（可选）</label>
            <Input :model-value="newTask.schedule || ''" @update:model-value="(val) => { const str = typeof val === 'string' ? val.trim() : (val != null ? String(val).trim() : ''); newTask.schedule = str || undefined; }" placeholder="例如：*/5 * * * * (cron) 或 300000 (毫秒间隔)" />
            <p class="text-xs text-muted-foreground mt-1">
              支持 cron 表达式（如 "*/5 * * * *" 表示每 5 分钟）或毫秒间隔（如 "300000" 表示 5 分钟）
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Switch :checked="newTask.enabled ?? true" @update:checked="(val) => newTask.enabled = val" />
            <label class="text-sm">启用任务</label>
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" @click="addTaskDialogOpen = false">取消</Button>
          <Button type="button" @click="saveNewTask">保存</Button>
        </div>
      </div>
    </div>

    <!-- 编辑任务对话框（自定义实现，避免第三方 Dialog 遮罩层干扰） -->
    <div
      v-if="editTaskDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="editTaskDialogOpen = false"
    >
      <div class="bg-background rounded-lg border shadow-lg w-full max-w-2xl p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">编辑任务</h2>
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">任务名称 *</label>
            <Input v-model="editTask.name" placeholder="例如：fetch-rdc" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">任务描述</label>
            <Input v-model="editTask.desc" placeholder="例如：拉取 RDC 工作项" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">任务类型</label>
            <Select v-model="editTask.type">
              <SelectTrigger>
                <SelectValue placeholder="选择任务类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">更新信息类</SelectItem>
                <SelectItem value="auto">自动化类</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">执行命令 *</label>
            <Input v-model="editTask.cmd" placeholder="例如：python data/hook/rdc_export/get_rdc_workitems.py" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">工作目录</label>
            <Input v-model="editTask.cwd" placeholder="例如：./" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">定时设置（可选）</label>
            <Input :model-value="editTask.schedule || ''" @update:model-value="(val) => { const str = typeof val === 'string' ? val.trim() : (val != null ? String(val).trim() : ''); editTask.schedule = str || undefined; }" placeholder="例如：*/5 * * * * (cron) 或 300000 (毫秒间隔)" />
            <p class="text-xs text-muted-foreground mt-1">
              支持 cron 表达式（如 "*/5 * * * *" 表示每 5 分钟）或毫秒间隔（如 "300000" 表示 5 分钟）
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Switch :checked="editTask.enabled ?? true" @update:checked="(val) => editTask.enabled = val" />
            <label class="text-sm">启用任务</label>
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" @click="editTaskDialogOpen = false">取消</Button>
          <Button type="button" @click="saveEditTask">保存</Button>
        </div>
      </div>
    </div>
  </div>
</template>
