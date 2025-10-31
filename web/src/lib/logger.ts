export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerOptions {
  enableRemote?: boolean
  endpoint?: string
}

export interface LogPayload {
  level: LogLevel
  message: string
  data?: Record<string, unknown> | null
  time?: string
}

export function createLogger(options: LoggerOptions = {}) {
  const endpoint = options.endpoint || '/__log'
  const enableRemote = options.enableRemote === true

  async function emit(level: LogLevel, message: string, data?: Record<string, unknown> | null) {
    const payload: LogPayload = { level, message, data: data ?? null, time: new Date().toISOString() }
    // console 输出
    const line = `[${payload.time}] ${level.toUpperCase()} ${message}${payload.data ? ' ' + JSON.stringify(payload.data) : ''}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else if (level === 'debug') console.debug(line)
    else console.log(line)

    // 远端上报（开发中间件将写入到文件）
    if (enableRemote) {
      try {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } catch {
        // 忽略
      }
    }
  }

  return {
    debug: (msg: string, data?: Record<string, unknown> | null) => emit('debug', msg, data),
    info: (msg: string, data?: Record<string, unknown> | null) => emit('info', msg, data),
    warn: (msg: string, data?: Record<string, unknown> | null) => emit('warn', msg, data),
    error: (msg: string, data?: Record<string, unknown> | null) => emit('error', msg, data),
  }
}

export const logger = createLogger({ enableRemote: true })
