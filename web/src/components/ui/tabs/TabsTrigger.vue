<script setup lang="ts">
import type { HTMLAttributes, ComputedRef } from "vue"
import { inject, computed } from "vue"
import { cn } from "@/lib/utils"
import { Button } from "../button"

const props = defineProps<{
  value: string
  class?: HTMLAttributes["class"]
}>()

const tabsValue = inject<ComputedRef<string> & { "update:modelValue": (val: string) => void }>("tabsValue")

const isActive = computed(() => tabsValue?.value === props.value)

function handleClick() {
  if (tabsValue && tabsValue.value !== undefined) {
    tabsValue.value = props.value
  }
}
</script>

<template>
  <Button
    :variant="isActive ? 'default' : 'ghost'"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      isActive ? 'bg-background text-foreground shadow-sm' : '',
      props.class,
    )"
    @click="handleClick"
  >
    <slot />
  </Button>
</template>
