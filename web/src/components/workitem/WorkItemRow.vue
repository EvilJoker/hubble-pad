<script setup lang="ts">
import type { WorkItem } from '@/types/workitem'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Item, ItemHeader, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item'

const props = defineProps<{ item: WorkItem }>()
const emit = defineEmits<{ (e: 'edit', item: WorkItem): void; (e: 'open', item: WorkItem): void }>()

function onEdit() {
  emit('edit', props.item)
}
function onOpen() {
  // 允许父层拦截或统计
  emit('open', props.item)
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
