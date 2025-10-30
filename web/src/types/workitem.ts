export interface WorkItem {
  id: string
  title: string
  description: string
  url: string
  kind?: string
  attributes?: Record<string, unknown>
}
