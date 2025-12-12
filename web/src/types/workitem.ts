export interface WorkItem {
  id: string
  title: string
  description: string
  url: string
  kind?: string
  favorite?: boolean
  archive?: boolean
  attributes?: Record<string, unknown>
  storage?: {
    records?: Array<{
      content: string
      type?: string
      createdAt?: string
    }>
  }
}
