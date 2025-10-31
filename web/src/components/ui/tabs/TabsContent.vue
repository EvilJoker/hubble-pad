<script setup lang="ts">
import type { HTMLAttributes, ComputedRef } from "vue"
import { inject, computed } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  value: string
  class?: HTMLAttributes["class"]
}>()

const tabsValue = inject<ComputedRef<string>>("tabsValue")

const isActive = computed(() => tabsValue?.value === props.value)
</script>

<template>
  <div
    v-if="isActive"
    data-slot="tabs-content"
    :class="cn(
      'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
