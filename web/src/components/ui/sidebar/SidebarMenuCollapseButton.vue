<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

const props = defineProps<{
  // 按钮在5个位置中的槽位（通常是5）
  position?: 1 | 2 | 3 | 4 | 5
  // 是否展开
  open?: boolean
  // Tooltip 文本（不传则不显示 tooltip）
  tooltip?: string
  // 自定义类名
  class?: HTMLAttributes["class"]
  // 距右侧的距离（px），用于调整折叠箭头位置
  rightOffset?: number
}>()

const emits = defineEmits<{
  "update:open": [open: boolean]
  click: [event: MouseEvent]
}>()

const { position = 5, rightOffset = 0 } = props

const isOpen = computed(() => props.open ?? false)
// 动态 tooltip 文案：优先使用外部传入，否则根据展开状态显示“展开/折叠”
const computedTooltip = computed(() => {
  return props.tooltip ?? (isOpen.value ? "折叠" : "展开")
})

function handleClick(event: MouseEvent) {
  emits("update:open", !isOpen.value)
  emits("click", event)
}
</script>

<template>
  <TooltipProvider v-if="computedTooltip">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          :data-position="position"
          :style="{ marginRight: `${rightOffset}px` }"
          :class="cn(
            'text-sky-500 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 cursor-pointer',
            'size-5',
            '[&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:transition-transform',
            props.class,
          )"
          @click="handleClick"
        >
          <slot>
            <!-- 默认使用 chevron-right 图标 -->
            <icon-lucide-chevron-right class="text-sky-500" :class="{ 'rotate-90': isOpen }" />
          </slot>
        </button>
      </TooltipTrigger>
      <TooltipContent class="z-50">{{ computedTooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <button
    v-else
    :data-position="position"
    :style="{ marginRight: `${rightOffset}px` }"
    :class="cn(
      'text-sky-500 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 cursor-pointer',
      'size-5',
      '[&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:transition-transform',
      props.class,
    )"
    @click="handleClick"
  >
    <slot>
      <!-- 默认使用 chevron-right 图标 -->
      <icon-lucide-chevron-right class="text-sky-500" :class="{ 'rotate-90': isOpen }" />
    </slot>
  </button>
</template>
