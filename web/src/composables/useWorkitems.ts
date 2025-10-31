import { ref, onMounted, computed, watch } from 'vue'
import type { WorkItem } from '../types/workitem'
import { logger } from '@/lib/logger'

export type SortKey = 'title' | 'description'
export type KindFilter = '' | 'code' | 'task' | 'environment'

export function useWorkitems() {
  const allItems = ref<WorkItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const keyword = ref('')
  const sortKey = ref<SortKey>('title')
  const kindFilter = ref<KindFilter>('')

  // 从 URL query 读取 kind 参数
  function syncKindFromURL() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const kind = params.get('kind') || ''
      if (kind === '' || kind === 'code' || kind === 'task' || kind === 'environment') {
        kindFilter.value = kind as KindFilter
      }
    }
  }

  // 更新 URL query 参数
  function updateURLKind(kind: KindFilter) {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
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
    updateURLKind(newKind)
    logger.info('workitems.kind.changed', { kind: newKind || 'all' })
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

    // 排序
    return [...base].sort((a, b) => {
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
