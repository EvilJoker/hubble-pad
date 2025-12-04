<script setup lang="ts">
import { DropdownMenuRoot } from 'radix-vue'
import type { HTMLAttributes } from 'vue'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <DropdownMenuRoot>
    <slot />
  </DropdownMenuRoot>
</template>

