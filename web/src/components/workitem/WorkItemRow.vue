<script setup lang="ts">
import { ref, watch } from 'vue'
import type { WorkItem } from '@/types/workitem'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Item, ItemHeader, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item'

const props = defineProps<{ item: WorkItem }>()
const emit = defineEmits<{ (e: 'edit', item: WorkItem): void; (e: 'open', item: WorkItem): void }>()

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
</script>

<template>
  <Item size="sm" class="bg-white">
    <ItemHeader class="items-start">
      <ItemContent class="min-w-0">
        <a :href="item.url" target="_blank" class="block" @click="onOpen">
          <ItemTitle class="truncate">{{ item.title }}</ItemTitle>
          <ItemDescription class="truncate">{{ item.description }}</ItemDescription>
        </a>
      </ItemContent>
      <ItemActions class="whitespace-nowrap gap-1">
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
              <a :href="item.url" target="_blank" aria-label="打开链接">
                <Button variant="ghost" size="icon-sm">
                  <icon-lucide-external-link class="w-4 h-4" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent class="z-50">{{ item.url }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ItemActions>
    </ItemHeader>
  </Item>
</template>
