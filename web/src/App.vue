<script setup lang="ts">
import { ref } from 'vue'
import SidebarPanel from '@/components/SidebarPanel.vue'
import MainPanel from '@/components/MainPanel.vue'
import { useWorkitems } from './composables/useWorkitems'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const { reload } = useWorkitems()
const refreshTick = ref(0)
const externalEditor = ref<{ open: boolean; text: string; id?: string } | null>(null)

type EditorMode = 'full' | 'item'
const editorMode = ref<EditorMode>('full')
const editingItemId = ref<string | null>(null)

function openItemEditor(it: { id: string }) {
  editorMode.value = 'item'
  editingItemId.value = it.id
  // 打开侧栏的数据编辑器，仅编辑该条目
  fetch('/data/workitems.json', { cache: 'no-store' })
    .then((r) => r.text())
    .then((raw) => {
      try {
        const arr = JSON.parse(raw)
        const obj = Array.isArray(arr) ? arr.find((x: any) => x && x.id === it.id) : null
        externalEditor.value = { open: true, id: it.id, text: JSON.stringify(obj ?? {}, null, 2) }
      } catch {
        externalEditor.value = { open: true, id: it.id, text: '{}' }
      }
    })
}
</script>

<template>
  <SidebarProvider>
    <TooltipProvider>
      <div class="h-screen flex">
        <SidebarPanel :external-editor="externalEditor" @dataSaved="() => { reload(); refreshTick++ }" />

        <MainPanel :refresh-token="refreshTick" @open-item-editor="openItemEditor" />
      </div>
    </TooltipProvider>
  </SidebarProvider>
</template>
