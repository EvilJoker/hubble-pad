<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const emits = defineEmits<{
  'navigate': [path: string]
}>()

// Vue 3 中 v-model 使用 kebab-case，但 props 定义使用 camelCase
defineOptions({
  inheritAttrs: false,
})

// WorkItems 目录路径
const dataDir = ref<string>('')

// 提醒数量
const notifyCount = ref<number>(0)

// 加载配置
async function loadConfig() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' })
    if (res.ok) {
      const config = await res.json()
      dataDir.value = config.dataDir || ''
    }
  } catch (e) {
    // 忽略错误，使用空值
  }
}

// 加载提醒数量
async function loadNotifyCount() {
  try {
    // 添加时间戳防止缓存
    const timestamp = Date.now()
    const res = await fetch(`/__data/notify?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
    if (res.ok) {
      const data = await res.json()
      const newCount = Array.isArray(data) ? data.length : 0
      notifyCount.value = newCount
      if (import.meta.env.DEV) {
        console.log('[SidebarPanel] 提醒数量已更新:', newCount)
      }
    } else {
      notifyCount.value = 0
    }
  } catch (e) {
    // 忽略错误，使用 0
    if (import.meta.env.DEV) {
      console.error('[SidebarPanel] 加载提醒数量失败:', e)
    }
    notifyCount.value = 0
  }
}

let notifyCountInterval: ReturnType<typeof setInterval> | null = null

// 监听提醒更新事件
function handleNotifyUpdated() {
  if (import.meta.env.DEV) {
    console.log('[SidebarPanel] 收到 notify-updated 事件，开始更新提醒数量')
  }
  // 添加小延迟确保服务器文件写入完成
  setTimeout(() => {
    loadNotifyCount()
  }, 100)
}

onMounted(() => {
  loadConfig()
  loadNotifyCount()
  // 监听提醒更新事件
  window.addEventListener('notify-updated', handleNotifyUpdated)
  // 每 30 秒刷新一次提醒数量
  notifyCountInterval = setInterval(() => {
    loadNotifyCount()
  }, 30000)
})

onUnmounted(() => {
  window.removeEventListener('notify-updated', handleNotifyUpdated)
  if (notifyCountInterval) {
    clearInterval(notifyCountInterval)
    notifyCountInterval = null
  }
})
</script>

<template>
  <Sidebar class="border-r min-w-0" style="--sidebar-width: 18rem; --sidebar-width-mobile: 18rem;">
      <SidebarHeader>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="p-4 w-full box-border flex items-center gap-3 rounded-md hover:bg-accent/50 transition-colors cursor-default max-w-full">
                <Avatar class="h-9 w-9">
                  <AvatarImage src="/logo.png" alt="Hubble Pad" />
                  <AvatarFallback class="bg-blue-100 text-blue-600 flex items-center justify-center">
                    <icon-lucide-bolt class="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate text-blue-500">Hubble Pad</div>
                  <div class="text-xs text-muted-foreground truncate">Stand</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent class="bg-blue-500 text-white border-blue-500">极简的工作平台</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>
      <SidebarContent class="w-full min-w-0 overflow-y-auto overflow-x-hidden">
        <SidebarMenu>
          <SidebarSeparator />
        </SidebarMenu>

        <!-- Common group: contains Kind, Data, Task and Activity -->
        <SidebarGroup>
          <SidebarGroupLabel>Common</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <!-- Kind item -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip :delayDuration="100">
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#/kind" @click.prevent="emits('navigate', '/kind')" class="flex items-center gap-2 pl-3">
                          <icon-lucide-tag class="w-4 h-4" />
                          <span>Kind</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">管理 workitem 类型</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              <!-- Data item -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip :delayDuration="100">
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#/data" @click.prevent="emits('navigate', '/data')" class="flex items-center gap-2 pl-3">
                          <icon-lucide-database class="w-4 h-4" />
                          <span>Data</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">
                      <div class="text-xs">
                        数据文件：
                        <a
                          href="https://github.com/EvilJoker/hubble-pad/blob/main/data/workitems.json"
                          target="_blank"
                          class="text-blue-600 underline ml-1"
                        >
                          示例
                        </a>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              <!-- Task item -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip :delayDuration="100">
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#/task" @click.prevent="emits('navigate', '/task')" class="flex items-center gap-2 pl-3">
                          <icon-lucide-check-square class="w-4 h-4" />
                          <span>Task</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">任务脚本：<a
                            href="https://github.com/EvilJoker/hubble-pad/blob/main/data/hooks.json"
                            target="_blank"
                            class="text-blue-600 underline ml-1"
                          >
                            示例
                          </a></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              <!-- Activity item -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip :delayDuration="100">
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#/activity" @click.prevent="emits('navigate', '/activity')" class="flex items-center gap-2 pl-3">
                          <icon-lucide-activity class="w-4 h-4" />
                          <span>Activity</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">变更记录（最近 10 天）</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              <!-- Notify item -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip :delayDuration="100">
                    <TooltipTrigger as-child>
                      <SidebarMenuButton as-child>
                        <a href="#/notify" @click.prevent="emits('navigate', '/notify')" class="flex items-center gap-2 pl-3 w-full">
                          <icon-lucide-bell class="w-4 h-4" />
                          <span>Notify</span>
                          <span v-if="notifyCount > 0" class="ml-auto text-xs font-semibold text-red-600">{{ notifyCount }}</span>
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent class="z-50">查看待办提醒</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <TooltipProvider>
          <Tooltip :delayDuration="100">
            <TooltipTrigger as-child>
              <div class="p-4 w-full box-border flex items-center gap-3 rounded-md hover:bg-accent/50 transition-colors cursor-default max-w-full">
                <Avatar class="h-8 w-8">
                  <AvatarFallback class="bg-muted flex items-center justify-center">
                    <icon-lucide-settings class="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">Settings</div>
                  <div v-if="dataDir" class="text-xs text-muted-foreground truncate font-mono">{{ dataDir }}</div>
                  <div v-else class="text-xs text-muted-foreground truncate">Configuration</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent class="z-50">
              <div class="text-xs">
                配置文件目录：<span v-if="dataDir" class="font-mono break-all">{{ dataDir }}</span>
                <span v-else>未配置</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarFooter>
  </Sidebar>
</template>
