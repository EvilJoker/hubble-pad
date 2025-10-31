<script setup lang="ts">
import type { HTMLAttributes, VNode } from "vue"
import { useSlots, computed } from "vue"
import { cn } from "@/lib/utils"
import SidebarMenuCollapseButton from "./SidebarMenuCollapseButton.vue"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  // 整体距右侧的距离（px）
  rightOffset?: number
  // 按钮之间的间距（Tailwind gap 值：1=4px, 2=8px）
  gap?: 1 | 2 | 3 | 4
  // 折叠位（位置5）距右侧的固定距离（px），无论是否显示折叠按钮都保留
  collapseRightOffset?: number
}>()

const { rightOffset = 8, gap = 1, collapseRightOffset = 7 } = props

const slots = useSlots()
const buttonSize = 5 // 按钮尺寸与实际按钮一致（size-5 = 20px）

// 从 VNode 中提取 position 属性
function getPosition(vnode: VNode): number | null {
  // 检查组件 props
  if (vnode.props?.position !== undefined) {
    return Number(vnode.props.position)
  }

  // 如果是 SidebarMenuActionButton 或 SidebarMenuCollapseButton
  if (typeof vnode.type === 'object' && vnode.type !== null) {
    const componentName = (vnode.type as any).name || (vnode.type as any).__name
    if (componentName === 'SidebarMenuActionButton' || componentName === 'SidebarMenuCollapseButton') {
      if (vnode.props?.position !== undefined) {
        return Number(vnode.props.position)
      }
    }
  }

  // 递归查找子组件
  if (vnode.children) {
    if (typeof vnode.children === 'object' && 'default' in vnode.children) {
      const defaultFn = (vnode.children as any).default
      if (typeof defaultFn === 'function') {
        const childVNodes = defaultFn()
        if (Array.isArray(childVNodes) && childVNodes[0]) {
          return getPosition(childVNodes[0])
        }
      }
    } else if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        const pos = getPosition(child as VNode)
        if (pos) return pos
      }
    }
  }

  return null
}

// 处理并排序子元素，创建固定5个位置的数组
const sortedChildren = computed(() => {
  const defaultSlot = slots.default?.()
  if (!defaultSlot) return []

  // 收集所有按钮，按 position 分组
  const buttonsByPosition: Map<number, VNode> = new Map()

  function extractButtons(vnodes: VNode[]) {
    for (const vnode of vnodes) {
      if (!vnode) continue

      const position = getPosition(vnode)
      if (position && position >= 1 && position <= 5) {
        buttonsByPosition.set(position, vnode)
      }

      // 递归处理子元素
      if (vnode.children) {
        if (typeof vnode.children === 'object' && 'default' in vnode.children) {
          const defaultFn = (vnode.children as any).default
          if (typeof defaultFn === 'function') {
            const childVNodes = defaultFn()
            if (Array.isArray(childVNodes)) {
              extractButtons(childVNodes)
            }
          }
        } else if (Array.isArray(vnode.children)) {
          extractButtons(vnode.children as VNode[])
        }
      }
    }
  }

  if (Array.isArray(defaultSlot)) {
    extractButtons(defaultSlot)
  }

  // 创建固定的5个位置数组
  const result: Array<{ position: number; vnode: VNode | null; isPlaceholder: boolean }> = []
  for (let pos = 1; pos <= 5; pos++) {
    const button = buttonsByPosition.get(pos)
    result.push({
      position: pos,
      vnode: button || null,
      isPlaceholder: !button,
    })
  }

  return result
})
</script>

<template>
  <div
    data-slot="sidebar-menu-actions"
    data-sidebar="menu-actions"
    :class="cn(
      'absolute top-1.5 right-1 flex items-center outline-hidden',
      `gap-${gap}`,
      'peer-data-[size=sm]/menu-button:top-1',
      'peer-data-[size=default]/menu-button:top-1.5',
      'peer-data-[size=lg]/menu-button:top-2.5',
      'group-data-[collapsible=icon]:hidden',
      props.class,
    )"
    :style="{ right: `${rightOffset}px` }"
  >
    <template v-for="item in sortedChildren" :key="item.position">
      <!-- 如果有实际按钮，渲染它 -->
      <component v-if="item.vnode && !item.isPlaceholder" :is="item.vnode" />
      <!-- 位置5：无论是否传入折叠按钮，都保留同样的右侧空位 -->
      <SidebarMenuCollapseButton
        v-else-if="item.position === 5 && !item.vnode"
        :position="5"
        :right-offset="collapseRightOffset"
        :class="'invisible pointer-events-none'"
      />
      <!-- 其他位置：创建占位元素 -->
      <div
        v-else
        :class="`size-${buttonSize} invisible pointer-events-none`"
      />
    </template>
  </div>
</template>
