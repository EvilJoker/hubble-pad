<script setup lang="ts">
import { DropdownMenuTrigger as DropdownMenuTriggerPrimitive } from 'radix-vue'
import type { HTMLAttributes } from 'vue'

const props = defineProps<{
  class?: HTMLAttributes['class']
  asChild?: boolean
}>()
</script>

<template>
  <DropdownMenuTriggerPrimitive :as-child="props.asChild">
    <slot />
  </DropdownMenuTriggerPrimitive>
</template>

