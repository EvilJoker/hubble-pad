<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

// 类型定义
interface KindItem {
  value: string
  label: string
  color: string
  description?: string
  example?: string
}

// 10种流行颜色
const popularColors = [
  { value: 'bg-blue-100 text-blue-700', label: '蓝色', preview: 'bg-blue-100' },
  { value: 'bg-green-100 text-green-700', label: '绿色', preview: 'bg-green-100' },
  { value: 'bg-purple-100 text-purple-700', label: '紫色', preview: 'bg-purple-100' },
  { value: 'bg-yellow-100 text-yellow-700', label: '黄色', preview: 'bg-yellow-100' },
  { value: 'bg-red-100 text-red-700', label: '红色', preview: 'bg-red-100' },
  { value: 'bg-pink-100 text-pink-700', label: '粉色', preview: 'bg-pink-100' },
  { value: 'bg-indigo-100 text-indigo-700', label: '靛蓝', preview: 'bg-indigo-100' },
  { value: 'bg-teal-100 text-teal-700', label: '青色', preview: 'bg-teal-100' },
  { value: 'bg-orange-100 text-orange-700', label: '橙色', preview: 'bg-orange-100' },
  { value: 'bg-gray-100 text-gray-700', label: '灰色', preview: 'bg-gray-100' },
]


const kinds = ref<KindItem[]>([])
const loading = ref(false)
const keyword = ref('')

const filteredKinds = computed(() => {
  let result = [...kinds.value]
  // 应用关键词搜索
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    result = result.filter((it) =>
      [it.value, it.label, it.description].some((f) => (f || '').toLowerCase().includes(k)),
    )
  }
  return result
})

// 行选择
const rowSelection = ref<Record<string, boolean>>({})
const isSelectAll = computed(() => {
  if (filteredKinds.value.length === 0) return false
  return filteredKinds.value.every((item) => rowSelection.value[item.value])
})
const isSelectSome = computed(() => {
  const count = Object.values(rowSelection.value).filter(Boolean).length
  return count > 0 && count < filteredKinds.value.length
})
const selectedCount = computed(() => {
  return Object.values(rowSelection.value).filter(Boolean).length
})

function toggleSelectAll(checked: boolean) {
  if (checked) {
    filteredKinds.value.forEach((item) => {
      rowSelection.value[item.value] = true
    })
  } else {
    filteredKinds.value.forEach((item) => {
      delete rowSelection.value[item.value]
    })
  }
}

function toggleRowSelection(itemValue: string, checked: boolean) {
  if (checked) {
    rowSelection.value[itemValue] = true
  } else {
    delete rowSelection.value[itemValue]
  }
}

async function deleteSelectedKinds() {
  const selectedValues = Object.keys(rowSelection.value).filter((v) => rowSelection.value[v])
  if (!selectedValues.length) return
  const ok = window.confirm(`确定要删除选中的 ${selectedValues.length} 个类型吗？`)
  if (!ok) return

  const valuesToDelete = new Set(selectedValues)
  kinds.value = kinds.value.filter((k) => !valuesToDelete.has(k.value))
  rowSelection.value = {}
  await saveKinds()
}

// 新增类型对话框
const addKindDialogOpen = ref(false)
const newKind = ref<Partial<KindItem>>({
  value: '',
  label: '',
  color: popularColors[0].value,
  description: '',
  example: '',
})

// 编辑类型对话框
const editKindDialogOpen = ref(false)
const editingKindValue = ref<string | null>(null)
const editKind = ref<Partial<KindItem>>({
  value: '',
  label: '',
  color: popularColors[0].value,
  description: '',
  example: '',
})

// 示例对话框
const exampleDialogOpen = ref(false)
const viewingExampleKind = ref<KindItem | null>(null)
const exampleContent = ref('')

// 加载 kinds 数据
async function loadKinds() {
  loading.value = true
  try {
    const res = await fetch('/__data/kinds')
    if (res.ok) {
      const data = await res.json()
      kinds.value = Array.isArray(data) ? data : []
    } else {
      console.error('Failed to load kinds:', res.statusText)
      kinds.value = []
    }
  } catch (error) {
    console.error('Error loading kinds:', error)
    kinds.value = []
  } finally {
    loading.value = false
  }
}

// 保存 kinds 数据
async function saveKinds() {
  try {
    const res = await fetch('/__data/kinds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kinds.value),
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to save kinds')
    }
    return true
  } catch (error) {
    console.error('Error saving kinds:', error)
    alert('保存失败：' + (error instanceof Error ? error.message : String(error)))
    return false
  }
}

function openAddKindDialog() {
  newKind.value = {
    value: '',
    label: '',
    color: popularColors[0].value,
    description: '',
    example: '',
  }
  addKindDialogOpen.value = true
}

async function saveNewKind() {
  if (!newKind.value.value || !newKind.value.label) {
    alert('请填写类型值和标签')
    return
  }

  // 检查是否已存在
  if (kinds.value.some((k) => k.value === newKind.value.value)) {
    alert('该类型值已存在')
    return
  }

  kinds.value.push({
    value: newKind.value.value!,
    label: newKind.value.label!,
    color: newKind.value.color || popularColors[0].value,
    description: newKind.value.description || '',
    example: newKind.value.example || '',
  })

  const success = await saveKinds()
  if (success) {
    addKindDialogOpen.value = false
  }
}

function openEditKindDialog(kind: KindItem) {
  editingKindValue.value = kind.value
  editKind.value = {
    value: kind.value,
    label: kind.label,
    color: kind.color,
    description: kind.description || '',
    example: kind.example || '',
  }
  editKindDialogOpen.value = true
}

async function saveEditKind() {
  if (!editKind.value.value || !editKind.value.label || !editingKindValue.value) {
    alert('请填写类型值和标签')
    return
  }

  const index = kinds.value.findIndex((k) => k.value === editingKindValue.value)
  if (index >= 0) {
    kinds.value[index] = {
      value: editKind.value.value,
      label: editKind.value.label,
      color: editKind.value.color || popularColors[0].value,
      description: editKind.value.description || '',
      example: editKind.value.example || '',
    }
  }

  const success = await saveKinds()
  if (success) {
    editKindDialogOpen.value = false
    editingKindValue.value = null
  }
}

async function handleDeleteKind(value: string) {
  const kind = kinds.value.find((k) => k.value === value)
  if (!kind) return
  const ok = window.confirm(`确定要删除类型 "${kind.label}" 吗？`)
  if (!ok) return

  const index = kinds.value.findIndex((k) => k.value === value)
  if (index >= 0) {
    kinds.value.splice(index, 1)
    await saveKinds()
  }
}


function openKindExampleDialog(kind: KindItem) {
  viewingExampleKind.value = { ...kind }
  // 计算并设置示例内容
  exampleContent.value = getExampleContent(kind)
  exampleDialogOpen.value = true
}

// 生成 workitem 示例 JSON
function getWorkitemExample(kindValue: string): string {
  const baseExample = {
    id: 'EXAMPLE-001',
    title: '示例工作项标题',
    description: '这是工作项的描述信息',
    url: 'https://example.com/workitems/001',
    kind: kindValue,
    attributes: {
      priority: 'high',
      status: 'in-progress',
    },
    favorite: false,
    storage: {
      records: [
        {
          content: '20251204 这是变更记录内容',
          type: 'update',
          createdAt: '2025-12-04T10:00:00.000Z',
        },
      ],
    },
  }
  return JSON.stringify(baseExample, null, 2)
}

// 获取示例内容，处理转义字符
function getExampleContent(kind: KindItem | null): string {
  if (!kind) return ''

  // 如果没有 example 字段或为空，使用默认示例
  if (!kind.example || !kind.example.trim()) {
    return getWorkitemExample(kind.value)
  }

  let exampleStr = kind.example

  // 如果字符串中包含转义的 \n，需要先处理
  // 从 JSON 文件读取时，转义字符可能已经被解析，也可能还是字符串形式
  if (exampleStr.includes('\\n')) {
    // 替换转义的换行符和引号
    exampleStr = exampleStr.replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }

  // 尝试解析为 JSON 对象，然后格式化输出
  try {
    const parsed = JSON.parse(exampleStr)
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    // 如果解析失败，可能是格式问题，直接返回原字符串
    console.warn('Failed to parse example JSON:', e, 'Raw example:', exampleStr)
    return exampleStr
  }
}

onMounted(() => {
  loadKinds()
})
</script>

<template>
  <div class="flex-1 min-w-0 overflow-auto">
    <div class="max-w-7xl mx-auto p-8 pl-12">
      <!-- 页面标题和操作 -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Kind</h1>
          <p class="text-sm text-muted-foreground mt-1">Manage work item types</p>
        </div>
      </div>

      <!-- 搜索控制 -->
      <div class="mb-4 flex items-center gap-2">
        <Input v-model="keyword" placeholder="Filter tasks..." class="max-w-sm" />
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" @click="openAddKindDialog">
            <icon-lucide-plus class="w-4 h-4 mr-2" />
            新增类型
          </Button>
          <Button variant="ghost" size="icon" aria-label="刷新" title="刷新" @click="loadKinds">
            <icon-lucide-refresh-ccw class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- 类型列表 -->
      <div v-if="loading" class="text-gray-500 text-center py-12">加载中…</div>
      <div v-else-if="filteredKinds.length === 0" class="text-gray-500 text-center py-12">
        {{ keyword.trim() ? '暂无匹配的类型' : '暂无类型，点击"新增类型"添加类型' }}
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
              <TableHead class="w-[100px]">值</TableHead>
              <TableHead>标签</TableHead>
              <TableHead class="w-[200px]">描述</TableHead>
              <TableHead class="w-[100px]">示例</TableHead>
              <TableHead class="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="k in filteredKinds" :key="k.value">
              <TableCell>
                <Checkbox
                  :checked="rowSelection[k.value] === true"
                  @update:checked="(val) => toggleRowSelection(k.value, !!val)"
                />
              </TableCell>
              <TableCell class="font-medium">{{ k.value }}</TableCell>
              <TableCell>
                <span :class="['px-2 py-0.5 rounded text-xs font-medium', k.color]">
                  {{ k.label }}
                </span>
              </TableCell>
              <TableCell>
                <span class="text-sm text-muted-foreground">{{ k.description || '-' }}</span>
              </TableCell>
              <TableCell>
                <Button
                  v-if="k.example || k.value"
                  variant="ghost"
                  size="sm"
                  @click="openKindExampleDialog(k)"
                >
                  <icon-lucide-file-text class="w-4 h-4 mr-1" />
                  查看
                </Button>
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
                    <DropdownMenuItem @click="() => openEditKindDialog(k)">
                      <icon-lucide-pencil class="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="() => handleDeleteKind(k.value)" class="text-red-600">
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
          {{ selectedCount }}/{{ filteredKinds.length }} 个事项被选中.
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="deleteSelectedKinds">
            删除选中
          </Button>
          <Button variant="outline" size="sm" @click="rowSelection = {}">
            取消选择
          </Button>
        </div>
      </div>
    </div>

    <!-- 新增类型对话框 -->
    <Dialog v-model:open="addKindDialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新增类型</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">
              类型值 <span class="text-blue-600">*</span>
            </label>
            <Input v-model="newKind.value" placeholder="例如：code" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">
              标签 <span class="text-blue-600">*</span>
            </label>
            <Input v-model="newKind.label" placeholder="例如：Code" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">
              颜色 <span class="text-blue-600">*</span>
            </label>
            <Select v-model="newKind.color">
              <SelectTrigger>
                <SelectValue placeholder="选择颜色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="color in popularColors"
                  :key="color.value"
                  :value="color.value"
                  class="flex items-center gap-2"
                >
                  <div :class="['w-4 h-4 rounded', color.preview]"></div>
                  <span>{{ color.label }}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">描述</label>
            <Input v-model="newKind.description" placeholder="例如：用于代码相关的工作项" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">示例</label>
            <Textarea
              v-model="newKind.example"
              placeholder="输入 workitem JSON 示例，或留空使用默认示例"
              rows="6"
              class="font-mono text-xs"
            />
            <p class="text-xs text-muted-foreground mt-1">
              留空时将使用系统默认示例。示例应包含完整的 workitem JSON 结构。
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="addKindDialogOpen = false">取消</Button>
          <Button type="button" @click="saveNewKind">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 编辑类型对话框 -->
    <Dialog v-model:open="editKindDialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑类型</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">
              类型值 <span class="text-blue-600">*</span>
            </label>
            <Input v-model="editKind.value" placeholder="例如：code" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">
              标签 <span class="text-blue-600">*</span>
            </label>
            <Input v-model="editKind.label" placeholder="例如：Code" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">
              颜色 <span class="text-blue-600">*</span>
            </label>
            <Select v-model="editKind.color">
              <SelectTrigger>
                <SelectValue placeholder="选择颜色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="color in popularColors"
                  :key="color.value"
                  :value="color.value"
                  class="flex items-center gap-2"
                >
                  <div :class="['w-4 h-4 rounded', color.preview]"></div>
                  <span>{{ color.label }}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">描述</label>
            <Input v-model="editKind.description" placeholder="例如：用于代码相关的工作项" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">示例</label>
            <Textarea
              v-model="editKind.example"
              placeholder="输入 workitem JSON 示例，或留空使用默认示例"
              rows="6"
              class="font-mono text-xs"
            />
            <p class="text-xs text-muted-foreground mt-1">
              留空时将使用系统默认示例。示例应包含完整的 workitem JSON 结构。
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="editKindDialogOpen = false">取消</Button>
          <Button type="button" @click="saveEditKind">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 示例对话框 -->
    <Dialog v-model:open="exampleDialogOpen">
      <DialogContent class="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {{ viewingExampleKind ? `${viewingExampleKind.label} 类型 - WorkItem 示例` : 'Kind 配置示例' }}
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <!-- 如果是查看特定 kind 的示例 -->
          <template v-if="viewingExampleKind">
            <div>
              <h3 class="text-sm font-medium mb-2">WorkItem JSON 示例：</h3>
              <Textarea
                v-model="exampleContent"
                readonly
                class="font-mono text-xs"
                rows="15"
              />
            </div>
            <div>
              <h3 class="text-sm font-medium mb-2">字段说明：</h3>
              <div class="space-y-2 text-sm">
                <div>
                  <span class="font-medium text-blue-600">id:</span>
                  <span class="text-muted-foreground ml-2">工作项唯一标识符，字符串，<span class="text-blue-600">必填</span>（例如：ITRAN-1629113, EXAMPLE-001）</span>
                </div>
                <div>
                  <span class="font-medium text-blue-600">title:</span>
                  <span class="text-muted-foreground ml-2">工作项标题，字符串，<span class="text-blue-600">必填</span></span>
                </div>
                <div>
                  <span class="font-medium">description:</span>
                  <span class="text-muted-foreground ml-2">工作项描述，字符串，可为空</span>
                </div>
                <div>
                  <span class="font-medium text-blue-600">url:</span>
                  <span class="text-muted-foreground ml-2">工作项链接，字符串，<span class="text-blue-600">必填</span></span>
                </div>
                <div>
                  <span class="font-medium">kind:</span>
                  <span class="text-muted-foreground ml-2">
                    工作项类型，字符串，可选，应与 kind 配置中的 value 值匹配（例如：code, task, environment, knowledge）
                  </span>
                </div>
                <div>
                  <span class="font-medium">attributes:</span>
                  <span class="text-muted-foreground ml-2">
                    扩展属性，对象，可选，可存储任意自定义字段（例如：priority, status, assignee 等）
                  </span>
                </div>
                <div>
                  <span class="font-medium">favorite:</span>
                  <span class="text-muted-foreground ml-2">收藏标记，布尔值，可选，true 表示已收藏</span>
                </div>
                <div>
                  <span class="font-medium">storage:</span>
                  <span class="text-muted-foreground ml-2">
                    本地存储字段，对象，可选，用于存储本地信息（不会被外部系统覆盖）
                  </span>
                </div>
                <div>
                  <span class="font-medium">storage.records:</span>
                  <span class="text-muted-foreground ml-2">
                    变更记录数组，可选，每个记录包含 content（字符串，格式：YYYYMMDD 开头，长度20-500）、type（字符串，可选）、createdAt（ISO 日期字符串，可选）
                  </span>
                </div>
                <div>
                  <span class="font-medium">source:</span>
                  <span class="text-muted-foreground ml-2">数据来源，字符串，可选，通常由系统自动填充（例如：hook:fetch-rdc）</span>
                </div>
                <div>
                  <span class="font-medium">updatedAt:</span>
                  <span class="text-muted-foreground ml-2">更新时间，ISO 日期字符串，可选，通常由系统自动填充</span>
                </div>
              </div>
            </div>
          </template>
          <!-- 如果是查看 Kind 配置示例 -->
          <template v-else>
            <div>
              <h3 class="text-sm font-medium mb-2">Kind 配置 JSON 示例：</h3>
              <Textarea
                :value="JSON.stringify(
                  [
                    { value: 'code', label: 'Code', color: 'bg-blue-100 text-blue-700', description: '用于代码相关的工作项', example: '' },
                    { value: 'task', label: 'Task', color: 'bg-green-100 text-green-700', description: '用于任务管理', example: '' },
                  ],
                  null,
                  2
                )"
                readonly
                class="font-mono text-xs"
                rows="10"
              />
            </div>
            <div>
              <h3 class="text-sm font-medium mb-2">字段说明：</h3>
              <div class="space-y-2 text-sm">
                <div>
                  <span class="font-medium">value:</span>
                  <span class="text-muted-foreground ml-2">类型值，字符串，必填，唯一标识符（例如：code, task）</span>
                </div>
                <div>
                  <span class="font-medium">label:</span>
                  <span class="text-muted-foreground ml-2">类型标签，字符串，必填，显示名称（例如：Code, Task）</span>
                </div>
                <div>
                  <span class="font-medium">color:</span>
                  <span class="text-muted-foreground ml-2">
                    Tailwind CSS 颜色类，字符串，必填，格式为 "bg-{color}-100 text-{color}-700"（例如：bg-blue-100 text-blue-700）
                  </span>
                </div>
                <div>
                  <span class="font-medium">description:</span>
                  <span class="text-muted-foreground ml-2">类型描述，字符串，可选，用于说明该类型的用途</span>
                </div>
                <div>
                  <span class="font-medium">example:</span>
                  <span class="text-muted-foreground ml-2">
                    WorkItem JSON 示例，字符串，可选，用于展示该类型的工作项数据示例。留空时使用系统默认示例
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>
        <DialogFooter>
          <Button type="button" @click="exampleDialogOpen = false">关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>

