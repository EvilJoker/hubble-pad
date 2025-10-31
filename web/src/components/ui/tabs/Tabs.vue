<script setup lang="ts">
import type { HTMLAttributes, ComputedRef } from "vue"
import { provide, computed, ref } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  modelValue?: string
}>()

const emits = defineEmits<{
  "update:modelValue": [value: string]
}>()

const internalValue = ref(props.modelValue || "")

const currentValue = computed({
  get: () => props.modelValue !== undefined ? props.modelValue : internalValue.value,
  set: (val: string) => {
    internalValue.value = val
    emits("update:modelValue", val)
  },
})

provide<ComputedRef<string> & { "update:modelValue": (val: string) => void }>("tabsValue", currentValue as any)
</script>

<template>
  <div
    data-slot="tabs"
    :class="cn('inline-flex h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground', props.class)"
  >
    <slot />
  </div>
</template>
