<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

const props = defineProps<{
  // 按钮在5个位置中的槽位（1-5）
  position?: 1 | 2 | 3 | 4 | 5
  // 按钮尺寸（Tailwind size 值：5=20px, 6=24px）
  size?: 5 | 6
  // Tooltip 文本（不传则不显示 tooltip）
  tooltip?: string
  // 自定义类名
  class?: HTMLAttributes["class"]
}>()

const { size = 5 } = props

const emits = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <TooltipProvider v-if="tooltip">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          :data-position="position"
          :class="cn(
            'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground flex aspect-square items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2',
            `size-${size}`,
            '[&>svg]:size-3.5 [&>svg]:shrink-0',
            'after:absolute after:-inset-2 md:after:hidden',
            props.class,
          )"
          @click="emits('click', $event)"
        >
          <slot />
        </button>
      </TooltipTrigger>
      <TooltipContent class="z-50">{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <button
    v-else
    :data-position="position"
    :class="cn(
      'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground flex aspect-square items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2',
      `size-${size}`,
      '[&>svg]:size-3.5 [&>svg]:shrink-0',
      'after:absolute after:-inset-2 md:after:hidden',
      props.class,
    )"
    @click="emits('click', $event)"
  >
    <slot />
  </button>
</template>
