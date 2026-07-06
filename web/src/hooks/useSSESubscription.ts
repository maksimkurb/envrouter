import { useEffect, useRef, useState } from 'react'
import { SSEvent } from '@/sse/api'
import { BASE_PATH } from '@/axios/base'

type SSEEventHandler = (event: SSEvent) => void

/**
 * Centralized SSE subscription hook to prevent duplicate connections
 * and provide consistent error handling across the application.
 *
 * Handlers are kept in refs so changing identities never tear down the
 * connection. `onReconnect` fires after a dropped connection is
 * re-established — use it to resync state missed while offline.
 */
export function useSSESubscription(onEvent: SSEEventHandler, onReconnect?: () => void) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    let wasDropped = false

    const connect = () => {
      if (disposed) return
      eventSource = new EventSource(`${BASE_PATH}/api/v1/subscription`)

      eventSource.onopen = () => {
        setConnected(true)
        setError(null)
        if (wasDropped) {
          wasDropped = false
          onReconnectRef.current?.()
        }
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
        wasDropped = true
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
  }, [])

  return { connected, error }
}
