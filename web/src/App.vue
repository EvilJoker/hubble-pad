<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SidebarPanel from '@/components/SidebarPanel.vue'
import DataPage from '@/components/DataPage.vue'
import TaskPage from '@/components/TaskPage.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const currentPath = ref('/data')

function handleNavigate(path: string) {
  currentPath.value = path
  window.location.hash = path
}

function syncPathFromHash() {
  const hash = window.location.hash.slice(1) || '/data'
  if (hash === '/data' || hash === '/task') {
    currentPath.value = hash
  } else {
    currentPath.value = '/data'
    window.location.hash = '/data'
  }
}

onMounted(() => {
  syncPathFromHash()
  window.addEventListener('hashchange', syncPathFromHash)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncPathFromHash)
})

const currentComponent = computed(() => {
  switch (currentPath.value) {
    case '/data':
      return DataPage
    case '/task':
      return TaskPage
    default:
      return DataPage
  }
})
</script>

<template>
  <SidebarProvider>
    <TooltipProvider>
      <div class="h-screen flex">
        <SidebarPanel @navigate="handleNavigate" />
        <SidebarInset>
          <component :is="currentComponent" />
        </SidebarInset>
      </div>
    </TooltipProvider>
  </SidebarProvider>
</template>
