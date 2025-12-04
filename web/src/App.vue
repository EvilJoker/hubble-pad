<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SidebarPanel from '@/components/SidebarPanel.vue'
import KindPage from '@/components/KindPage.vue'
import DataPage from '@/components/DataPage.vue'
import TaskPage from '@/components/TaskPage.vue'
import ActivityPage from '@/components/ActivityPage.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const currentPath = ref('/kind')

function handleNavigate(path: string) {
  currentPath.value = path
  window.location.hash = path
}

function syncPathFromHash() {
  const hash = window.location.hash.slice(1) || '/kind'
  if (hash === '/kind' || hash === '/data' || hash === '/task' || hash === '/activity') {
    currentPath.value = hash
  } else {
    currentPath.value = '/kind'
    window.location.hash = '/kind'
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
    case '/kind':
      return KindPage
    case '/data':
      return DataPage
    case '/task':
      return TaskPage
    case '/activity':
      return ActivityPage
    default:
      return KindPage
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
