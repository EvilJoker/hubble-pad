<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { WorkItem } from '@/types/workitem'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Item, ItemHeader, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item'

const props = defineProps<{ item: WorkItem; index?: number }>()
const emit = defineEmits<{
  (e: 'edit', item: WorkItem): void;
  (e: 'open', item: WorkItem): void;
  (e: 'delete', item: WorkItem): void;
  (e: 'add-record', item: WorkItem): void;
}>()

const isFavorite = ref(props.item.favorite === true)
const toggling = ref(false)

// 同步 props.item.favorite 的变化
watch(() => props.item.favorite, (newVal) => {
  isFavorite.value = newVal === true
}, { immediate: true })

function onEdit() {
  emit('edit', props.item)
}
function onOpen() {
  // 允许父层拦截或统计
  emit('open', props.item)
}
function onDelete() {
  emit('delete', props.item)
}
function onAddRecord() {
  emit('add-record', props.item)
}

async function toggleFavorite() {
  if (toggling.value) return
  toggling.value = true
  try {
    const newFavorite = !isFavorite.value
    const res = await fetch(`/__data/toggle-favorite/${encodeURIComponent(props.item.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: newFavorite })
    })
    if (res.ok) {
      isFavorite.value = newFavorite
      // 触发全局更新事件，让列表重新加载
      window.dispatchEvent(new Event('workitems-updated'))
    } else {
      // 读取错误信息
      const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      console.error('Failed to toggle favorite:', errorData.message || 'Unknown error')
      // TODO: 可以添加用户提示，如 toast 通知
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
    // TODO: 可以添加用户提示，如 toast 通知
  } finally {
    toggling.value = false
  }
}

// 文本阶段：优先在显示层处理，保留原始数据与链接可点击
function truncateMiddle(text: string | undefined, max: number): string {
  const s = (text || '').trim()
  if (s.length <= max) return s
  // 采用首尾保留策略，兼顾 URL/长路径
  const head = Math.max(0, Math.floor(max * 0.6))
  const tail = Math.max(0, max - head - 1)
  return s.slice(0, head) + '…' + s.slice(s.length - tail)
}

const displayTitle = computed(() => truncateMiddle(props.item.title, 80))
const displayDescription = computed(() => truncateMiddle(props.item.description, 120))
</script>

<template>
  <Item size="sm" class="bg-white">
    <ItemHeader class="items-start">
      <!-- 左侧序号，仅用于当前列表展示，不写入数据 -->
      <div class="w-8 text-xs text-gray-400 flex items-start justify-end pr-2 select-none">
        <span>{{ (props.index ?? 0) + 1 }}</span>
      </div>
      <ItemContent class="min-w-0 flex-1 overflow-hidden">
        <!-- 仅展示文本，不做默认跳转；跳转由右侧按钮负责 -->
        <div class="block min-w-0 cursor-default select-text">
          <ItemTitle class="block" :title="item.title">{{ displayTitle }}</ItemTitle>
          <ItemDescription class="block" :title="item.description">{{ displayDescription }}</ItemDescription>
        </div>
      </ItemContent>
      <ItemActions class="whitespace-nowrap gap-1 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="isFavorite ? '取消收藏' : '收藏'"
                :disabled="toggling"
                @click="toggleFavorite"
              >
                <icon-lucide-star :class="['w-4 h-4', isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400']" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="z-50">{{ isFavorite ? '取消收藏' : '收藏' }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-sm" aria-label="编辑" @click="onEdit">
                <icon-lucide-pencil class="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="z-50">编辑</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <a :href="item.url" target="_blank" aria-label="打开链接" @click="onOpen">
                <Button variant="ghost" size="icon-sm">
                  <icon-lucide-external-link class="w-4 h-4" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent class="z-50">{{ item.url }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="删除"
                class="text-red-500 hover:text-red-600"
                @click="onDelete"
              >
                <icon-lucide-trash-2 class="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="z-50">删除</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="更新进展"
                @click="onAddRecord"
              >
                <icon-lucide-clipboard-plus class="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="z-50">更新进展</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ItemActions>
    </ItemHeader>
  </Item>
</template>
