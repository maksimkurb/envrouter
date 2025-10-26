import { useEffect, useState } from 'react'
import { SSEvent } from '@/sse/api'
import { BASE_PATH } from '@/axios/base'

type SSEEventHandler = (event: SSEvent) => void

/**
 * Centralized SSE subscription hook to prevent duplicate connections
 * and provide consistent error handling across the application.
 */
export function useSSESubscription(onEvent: SSEEventHandler) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connect = () => {
      try {
        eventSource = new EventSource(`${BASE_PATH}/api/v1/subscription`)

        eventSource.onopen = () => {
          setConnected(true)
          setError(null)
        }

        eventSource.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data) as SSEvent
            onEvent(event)
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
      } catch (err) {
        setError(err as Error)
      }
    }

    connect()

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [onEvent])

  return { connected, error }
}
