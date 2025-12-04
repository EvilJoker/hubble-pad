<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CheckboxRoot, CheckboxIndicator } from 'radix-vue'
import { Check, Minus } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    checked?: boolean | 'indeterminate'
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    checked: false,
    disabled: false,
  }
)

const emits = defineEmits<{
  (e: 'update:checked', value: boolean): void
}>()

const isChecked = computed(() => props.checked === true)
const isIndeterminate = computed(() => props.checked === 'indeterminate')
</script>

<template>
  <CheckboxRoot
    :checked="isChecked || isIndeterminate"
    :disabled="disabled"
    @update:checked="emits('update:checked', $event)"
    :class="
      cn(
        'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        props.class
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <Check v-if="isChecked" class="h-4 w-4" />
      <Minus v-else-if="isIndeterminate" class="h-4 w-4" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>



