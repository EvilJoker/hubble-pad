export interface WorkItem {
  id: string
  title: string
  description: string
  url: string
  kind?: string
  favorite?: boolean
  attributes?: Record<string, unknown>
}
