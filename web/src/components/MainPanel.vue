<script setup lang="ts">
import { useWorkitems } from '@/composables/useWorkitems'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import WorkItemRow from '@/components/workitem/WorkItemRow.vue'
import { ItemSeparator } from '@/components/ui/item'

const props = defineProps<{
  // 用于编辑功能
  editorOpen?: boolean
  // 当该值变化时，触发一次 reload
  refreshToken?: number
}>()

const emits = defineEmits<{
  'open-item-editor': [item: { id: string }]
}>()

const { items, loading, error, keyword, sortKey, reload } = useWorkitems()

function handleEdit(item: { id: string }) {
  emits('open-item-editor', item)
}

// 监听 refreshToken 变化，触发一次 reload
import { watch, onMounted, onUnmounted } from 'vue'
watch(() => props.refreshToken, () => reload())

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
  <main class="flex-1 min-w-0 p-2 overflow-auto ml-14">
    <div id="right-pane" class="max-w-full min-w-0">
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
              @edit="handleEdit"
            />
            <ItemSeparator v-if="idx < items.length - 1" />
          </template>
        </div>
      </div>
    </div>
  </main>
</template>
