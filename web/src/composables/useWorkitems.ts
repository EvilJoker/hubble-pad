import { ref, onMounted, computed } from 'vue'
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

  async function load() {
    loading.value = true
    error.value = null
    try {
      logger.info('workitems.load.start')
      const res = await fetch('/data/workitems.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const contentType = res.headers.get('content-type')
      if (contentType && !contentType.includes('application/json')) {
        // 如果返回的不是 JSON，可能是 HTML 错误页面
        const text = await res.text()
        if (text.trim().startsWith('<!')) {
          throw new Error('Received HTML instead of JSON. File may not exist.')
        }
        throw new Error(`Unexpected content type: ${contentType}`)
      }
      const data = await res.json()
      allItems.value = Array.isArray(data) ? data : []
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
