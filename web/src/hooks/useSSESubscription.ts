import { useCallback, useEffect, useRef, useState } from 'react'
import { SSEvent } from '@/sse/api'
import { BASE_PATH } from '@/axios/base'

type SSEEventHandler = (event: SSEvent) => void

/**
 * Subscription to the v2 stream (/api/v2/subscription): the server sends a
 * full Snapshot event first, then live deltas — so every (re)connect is a
 * complete resync by construction.
 *
 * The handler is kept in a ref so changing identities never tear down the
 * connection. `reconnect()` forces an immediate fresh connection (used by
 * the error panel's Retry).
 */
export function useSSESubscription(onEvent: SSEEventHandler) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const reconnect = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const connect = () => {
      if (disposed) return
      eventSource = new EventSource(`${BASE_PATH}/api/v2/subscription`)

      eventSource.onopen = () => {
        setConnected(true)
        setError(null)
      }

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as SSEvent
          onEventRef.current(event)
        } catch (err) {
          console.error('Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        setConnected(false)
        setError(new Error('SSE connection error'))
        eventSource?.close()

        // Attempt reconnection after 5 seconds
        reconnectTimeout = setTimeout(() => {
          console.log('Attempting SSE reconnection...')
          connect()
        }, 5000)
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [nonce])

  return { connected, error, reconnect }
}
