import { ref } from 'vue'

export interface HookItem {
  id?: string
  name: string
  desc?: string
  cmd: string
  cwd?: string
  enabled: boolean
  lastRunAt?: string | null
  lastError?: string | null
}

export function useHooks() {
  const hooks = ref<HookItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/__hooks/list', { cache: 'no-store' })
      const arr = await res.json()
      hooks.value = Array.isArray(arr) ? arr : []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function runOne(id: string) {
    await fetch(`/__hooks/run/${id}`, { method: 'POST' })
    await load()
  }

  async function runAll() {
    await fetch(`/__hooks/run-all`, { method: 'POST' })
    await load()
  }

  return { hooks, loading, error, load, runOne, runAll }
}
