<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

interface OptionItem {
  label: string
  value: string
  count?: number
}

const props = defineProps<{
  title: string
  options: OptionItem[]
  modelValue: string[]
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const search = ref('')

const filteredOptions = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((opt) => {
    const label = opt.label.toLowerCase()
    const value = opt.value.toLowerCase()
    return label.includes(q) || value.includes(q)
  })
})

function toggleValue(value: string) {
  const set = new Set(props.modelValue)
  if (set.has(value)) {
    set.delete(value)
  } else {
    set.add(value)
  }
  emits('update:modelValue', Array.from(set))
}

function clearAll() {
  emits('update:modelValue', [])
  search.value = ''
}

const displayLabel = computed(() => {
  const count = props.modelValue.length
  if (count === 0) return props.title
  if (count === 1) {
    const target = props.options.find((opt) => opt.value === props.modelValue[0])
    return target ? `${props.title}: ${target.label}` : `${props.title} (1)`
  }
  return `${props.title} (${count})`
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="gap-2">
        <icon-lucide-plus class="h-4 w-4" />
        {{ displayLabel }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56 p-0">
      <div class="p-2 border-b">
        <Input
          v-model="search"
          placeholder="筛选..."
          class="h-8 px-2 text-xs"
        />
      </div>
      <DropdownMenuItem @click="clearAll">
        <div class="flex items-center gap-2">
          <Checkbox :checked="modelValue.length === 0" />
          <span :class="modelValue.length === 0 ? 'font-medium' : ''">全部</span>
        </div>
      </DropdownMenuItem>
      <div class="max-h-64 overflow-auto">
        <DropdownMenuItem
          v-for="opt in filteredOptions"
          :key="opt.value"
          @click="toggleValue(opt.value)"
        >
          <div class="flex w-full items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Checkbox :checked="modelValue.includes(opt.value)" />
              <span>{{ opt.label }}</span>
            </div>
            <span v-if="typeof opt.count === 'number'" class="ml-2 text-xs text-muted-foreground">
              {{ opt.count }}
            </span>
          </div>
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>


