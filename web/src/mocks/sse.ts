import { SSEvent } from '../sse/api'
import { mockInstancePods, mockInstances, mockRefs } from './data'

// SSE Mock - simulates real-time updates
export class MockSSEConnection {
  private eventSource: EventSource | null = null
  private intervalId: NodeJS.Timeout | null = null
  private listeners: Array<(event: SSEvent) => void> = []

  constructor(private url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      const wrappedListener = (event: SSEvent) => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(event),
        })
        listener(messageEvent)
      }
      this.listeners.push(wrappedListener)
    }
  }

  removeEventListener(type: string, listener: any) {
    // Simple implementation - in real scenario you'd track listeners properly
  }

  close() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // Start sending mock events
  start() {
    let eventCount = 0

    // Send events periodically to simulate real-time updates
    this.intervalId = setInterval(() => {
      eventCount++

      // Cycle through different types of events
      const eventType = eventCount % 3

      switch (eventType) {
        case 0:
          // Update a random InstancePod
          const randomPod = mockInstancePods[Math.floor(Math.random() * mockInstancePods.length)]
          const podEvent: SSEvent = {
            itemType: 'InstancePod',
            item: { ...randomPod },
            event: 'UPDATED',
          }
          this.emit(podEvent)
          break

        case 1:
          // Update a random Instance
          const randomInstance = mockInstances[Math.floor(Math.random() * mockInstances.length)]
          const instanceEvent: SSEvent = {
            itemType: 'Instance',
            item: { ...randomInstance },
            event: 'UPDATED',
          }
          this.emit(instanceEvent)
          break

        case 2:
          // Update a random Ref
          const randomRef = mockRefs[Math.floor(Math.random() * mockRefs.length)]
          const refEvent: SSEvent = {
            itemType: 'RefHead',
            item: { ...randomRef },
            event: 'UPDATED',
          }
          this.emit(refEvent)
          break
      }
    }, 5000) // Send an event every 5 seconds
  }

  private emit(event: SSEvent) {
    this.listeners.forEach((listener) => listener(event))
  }
}

// Override global EventSource when in mock mode
export function setupMockSSE() {
  // @ts-ignore
  window.EventSource = class MockEventSource {
    constructor(url: string) {
      const mock = new MockSSEConnection(url)
      mock.start()
      return mock as any
    }
  }
}
