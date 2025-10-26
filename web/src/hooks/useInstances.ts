import { useEffect, useState } from 'react'
import { Instance as BaseInstance, InstancePod, DefaultApiFp } from '@/axios'
import { SSEvent } from '@/sse/api'
import { BASE_PATH } from '@/axios/base'

const api = DefaultApiFp()

// Extended Instance type with instancePods array
export interface Instance extends Omit<BaseInstance, 'application' | 'environment'> {
  applicationName: string
  environmentName: string
  refHead?: string
  instancePods?: InstancePod[]
}

export function useInstances() {
  const [data, setData] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Fetch initial data
    Promise.all([
      api.apiV1InstancesGet().then((request) => request()),
      api.apiV1InstancePodsGet().then((request) => request()),
    ])
      .then(([instancesRes, podsRes]) => {
        const instances = instancesRes.data
        const pods = podsRes.data

        // Combine instances with their pods
        const combinedInstances: Instance[] = instances.map((inst) => ({
          ...inst,
          applicationName: inst.application,
          environmentName: inst.environment,
          refHead: inst.ref,
          instancePods: pods.filter(
            (pod) =>
              pod.application === inst.application &&
              pod.environment === inst.environment
          ),
        }))

        setData(combinedInstances)
        setLoading(false)
      })
      .catch((err) => {
        setError(err)
        setLoading(false)
      })

    // Setup SSE for real-time updates
    const eventSource = new EventSource(`${BASE_PATH}/api/v1/subscription`)

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data) as SSEvent

      switch (event.itemType) {
        case 'InstancePod': {
          const instancePod = event.item as InstancePod
          setData((current) => {
            return current.map((inst) => {
              if (
                inst.applicationName === instancePod.application &&
                inst.environmentName === instancePod.environment
              ) {
                const pods = inst.instancePods || []
                const podIndex = pods.findIndex((p) => p.name === instancePod.name)

                let updatedPods: InstancePod[]
                if (event.event === 'DELETED') {
                  updatedPods = pods.filter((p) => p.name !== instancePod.name)
                } else if (podIndex === -1) {
                  updatedPods = [...pods, instancePod]
                } else {
                  updatedPods = [
                    ...pods.slice(0, podIndex),
                    instancePod,
                    ...pods.slice(podIndex + 1),
                  ]
                }

                return {
                  ...inst,
                  instancePods: updatedPods,
                }
              }
              return inst
            })
          })
          break
        }

        case 'Instance': {
          const instance = event.item as BaseInstance
          setData((current) => {
            const index = current.findIndex(
              (i) =>
                i.name === instance.name &&
                i.applicationName === instance.application &&
                i.environmentName === instance.environment
            )

            const newInstance: Instance = {
              ...instance,
              applicationName: instance.application,
              environmentName: instance.environment,
              refHead: instance.ref,
              instancePods:
                index !== -1 ? current[index].instancePods : [],
            }

            if (event.event === 'DELETED') {
              return current.filter((_, i) => i !== index)
            } else if (index === -1) {
              return [...current, newInstance]
            } else {
              return [
                ...current.slice(0, index),
                newInstance,
                ...current.slice(index + 1),
              ]
            }
          })
          break
        }
      }
    }

    return () => {
      eventSource.close()
    }
  }, [])

  return { data, loading, error }
}
