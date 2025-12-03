import { ref, onMounted, computed, watch, nextTick } from 'vue'
import type { WorkItem } from '../types/workitem'
import { logger } from '@/lib/logger'

export type SortKey = 'title' | 'description'
export type KindFilter = '' | 'code' | 'task' | 'environment' | 'knowledge'

export function useWorkitems() {
  const allItems = ref<WorkItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const keyword = ref('')
  const sortKey = ref<SortKey>('title')
  const kindFilter = ref<KindFilter>('')

  // 标志位，防止循环更新
  let isSyncingFromURL = false

  // 从 URL query 读取 kind 参数
  function syncKindFromURL() {
    if (typeof window !== 'undefined') {
      isSyncingFromURL = true
      const params = new URLSearchParams(window.location.search)
      const kind = params.get('kind') || ''
      if (kind === '' || kind === 'code' || kind === 'task' || kind === 'environment' || kind === 'knowledge') {
        const newKind = kind as KindFilter
        // 只有当值不同时才更新，避免不必要的触发
        if (kindFilter.value !== newKind) {
          kindFilter.value = newKind
        }
      }
      // 使用 nextTick 确保在下一个事件循环中重置标志
      nextTick(() => {
        isSyncingFromURL = false
      })
    }
  }

  // 更新 URL query 参数
  function updateURLKind(kind: KindFilter) {
    if (typeof window !== 'undefined' && !isSyncingFromURL) {
      const url = new URL(window.location.href)
      const currentKind = url.searchParams.get('kind') || ''
      // 只有当 URL 中的值不同时才更新，避免不必要的 history 操作
      if ((kind === '' && currentKind === '') || (kind !== '' && currentKind === kind)) {
        return
      }
      if (kind === '') {
        url.searchParams.delete('kind')
      } else {
        url.searchParams.set('kind', kind)
      }
      window.history.replaceState({}, '', url.toString())
    }
  }

  // 监听 kindFilter 变化，同步到 URL
  watch(kindFilter, (newKind) => {
    if (!isSyncingFromURL) {
      updateURLKind(newKind)
      logger.info('workitems.kind.changed', { kind: newKind || 'all' })
    }
  })

  async function load() {
    loading.value = true
    error.value = null
    try {
      logger.info('workitems.load.start')
      const res = await fetch('/data/workitems.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      allItems.value = await res.json()
      logger.info('workitems.load.success', { count: allItems.value.length })
    } catch (e: unknown) {
      error.value = (e as Error).message
      allItems.value = []
      logger.error('workitems.load.failed', { message: error.value || '' })
    } finally {
      loading.value = false
    }
  }

  const items = computed(() => {
    let base = allItems.value

    // 按 kind 过滤：kindFilter 为空显示全部，否则只显示匹配的条目
    // 注意：没有 kind 字段的条目只在 kindFilter 为空时显示
    if (kindFilter.value !== '') {
      base = base.filter((it) => it.kind === kindFilter.value)
    }

    // 关键词搜索
    const k = keyword.value.trim().toLowerCase()
    if (k) {
      base = base.filter((it) =>
        [it.title, it.description].some((f) => (f || '').toLowerCase().includes(k)),
      )
    }

    // 排序：收藏的条目优先，然后按 sortKey 排序
    return [...base].sort((a, b) => {
      // 优先显示收藏的条目
      const aFavorite = a.favorite === true ? 1 : 0
      const bFavorite = b.favorite === true ? 1 : 0
      if (aFavorite !== bFavorite) {
        return bFavorite - aFavorite // 收藏的在前
      }
      // 相同收藏状态时，按 sortKey 排序
      const av = (a[sortKey.value] || '').toString().toLowerCase()
      const bv = (b[sortKey.value] || '').toString().toLowerCase()
      return av.localeCompare(bv)
    })
  })

  onMounted(() => {
    syncKindFromURL()
    load()
  })

  return {
    allItems,
    items,
    loading,
    error,
    keyword,
    sortKey,
    kindFilter,
    reload: load,
  }
}
