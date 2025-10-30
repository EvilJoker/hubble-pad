import { ref, onMounted, computed } from 'vue'
import type { WorkItem } from '../types/workitem'

export type SortKey = 'title' | 'description'

export function useWorkitems() {
  const allItems = ref<WorkItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const keyword = ref('')
  const sortKey = ref<SortKey>('title')

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/data/workitems.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      allItems.value = await res.json()
    } catch (e: unknown) {
      error.value = (e as Error).message
      allItems.value = []
    } finally {
      loading.value = false
    }
  }

  const items = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    const base = k
      ? allItems.value.filter((it) =>
          [it.title, it.description].some((f) => (f || '').toLowerCase().includes(k)),
        )
      : allItems.value
    return [...base].sort((a, b) => {
      const av = (a[sortKey.value] || '').toString().toLowerCase()
      const bv = (b[sortKey.value] || '').toString().toLowerCase()
      return av.localeCompare(bv)
    })
  })

  onMounted(load)
  return { allItems, items, loading, error, keyword, sortKey, reload: load }
}
